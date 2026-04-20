// app/api/os/tasks/[id]/apply-decision/route.ts
// Executes the recommended (or alternative) verb from the decision engine.
//
// POST /api/os/tasks/:id/apply-decision
//   body: {
//     verb: 'reply' | 'defer' | 'delegate' | 'ping' | 'close' | 'split' | 'schedule',
//     suggestedDraft?: string,        // required for reply/ping
//     proposedDate?: string,          // YYYY-MM-DD — used by defer/ping/schedule
//     latestMessageId?: string,       // required for reply/ping
//     companyId?: string,             // optional; defaults to fallback Google token
//     label?: string,                 // echoed back to the UI for toast copy
//   }
//
// Returns:
//   { ok: true, verb, action, message, taskId, draftId?, draftUrl?, updatedTask? }
//
// Never deletes. Never sends mail. Draft replies land in Gmail as drafts so Chris
// can review + send manually. Every apply emits a `decision.applied` event so we
// can close the feedback loop (did the human accept the AI's recommendation?).
//
// Each verb is handled by a small helper so the switch stays flat and each path
// is testable in isolation.
//
// ⚠️ The verb set here MUST stay in sync with `DecisionVerb` in
//    `lib/decisionEngine.ts`. If a new verb is added there, add a handler here.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { updateTask, getTasks, type TaskRecord, type UpdateTaskInput } from '@/lib/airtable/tasks';
import { logEventAsync } from '@/lib/airtable/activityLog';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity } from '@/lib/personalContext';
import { createDraftReply } from '@/lib/gmail/createDraftReply';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// Types
// ============================================================================

type Verb = 'reply' | 'defer' | 'delegate' | 'ping' | 'close' | 'split' | 'schedule';

const ALLOWED_VERBS: Verb[] = ['reply', 'defer', 'delegate', 'ping', 'close', 'split', 'schedule'];

interface ApplyBody {
  verb: Verb;
  /** The draft Chris is actually sending (post-edit if edited). */
  suggestedDraft?: string;
  /** The original AI-generated draft, so we can detect edits. UI sends it
   *  alongside `suggestedDraft` when the user modified the text. */
  originalDraft?: string;
  proposedDate?: string;
  latestMessageId?: string;
  companyId?: string;
  label?: string;
  /** Who to delegate to (name). Used by the 'delegate' verb. */
  delegateTo?: string;
}

/** Feedback-loop signal: did the human accept the AI draft verbatim, or edit it?
 *  Returned as metadata on `decision.applied` so we can query low-quality drafts. */
interface DraftEditSignal {
  edited: boolean;
  originalChars: number;
  finalChars: number;
  /** Signed char delta (final - original). */
  deltaChars: number;
  /** Jaccard similarity over word tokens (1.0 = identical wording, 0.0 = disjoint). */
  wordSimilarity: number;
}

interface ApplyResult {
  ok: true;
  verb: Verb;
  /** Short imperative describing what was done. */
  action: string;
  /** User-facing toast copy. */
  message: string;
  taskId: string;
  draftId?: string;
  draftUrl?: string;
  updatedTask?: TaskRecord;
  /** Metadata to include in the decision.applied event. */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Validation helpers
// ============================================================================

function isVerb(v: unknown): v is Verb {
  return typeof v === 'string' && (ALLOWED_VERBS as string[]).includes(v);
}

function isYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Today's date as YYYY-MM-DD (UTC). */
function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Default proposedDate for verbs that need one but didn't get one: today + 3 days. */
function threeDaysFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

/** Treat a past-or-invalid YMD as missing — we'd rather use the 3-day default
 *  than let a stale model-proposed date (e.g. 2024-12-19 in 2026) land on the
 *  task. */
function sanitizeFutureYmd(v: unknown): string | undefined {
  if (!isYmd(v)) return undefined;
  return v > todayYmd() ? v : undefined;
}

/** Tokenize a draft body into a lowercased bag of words, stripping punctuation
 *  and collapsing whitespace. Cheap enough to run on every apply; we only feed
 *  it drafts the user actually typed, so the worst case is a few thousand
 *  tokens. Used only for the feedback signal. */
function wordTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

/** Jaccard similarity between two token sets — |A∩B| / |A∪B|. Returns 1 for
 *  two empty strings (nothing changed) and 0 when the intersection is empty. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const tok of a) if (b.has(tok)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Compute the draft-edit signal (if applicable). Only meaningful when both
 * originalDraft and finalDraft are present — for non-email verbs we return
 * null. Rounded to 3 decimals so the metadata payload stays compact.
 */
function computeDraftEditSignal(
  original: string | undefined,
  final: string | undefined,
): DraftEditSignal | null {
  if (original === undefined || final === undefined) return null;
  const o = original.trim();
  const f = final.trim();
  const edited = o !== f;
  const originalChars = o.length;
  const finalChars = f.length;
  const wordSimilarity = edited
    ? Math.round(jaccardSimilarity(wordTokens(o), wordTokens(f)) * 1000) / 1000
    : 1;
  return {
    edited,
    originalChars,
    finalChars,
    deltaChars: finalChars - originalChars,
    wordSimilarity,
  };
}

// ============================================================================
// Gmail helper (shared by reply + ping)
// ============================================================================

async function resolveGoogleAccessToken(companyId?: string): Promise<string> {
  let refreshToken: string | undefined;
  if (companyId && companyId !== 'default') {
    const integrations = await getCompanyIntegrations(companyId);
    refreshToken = integrations?.google?.refreshToken;
  }
  if (!refreshToken) {
    const fallback = await getAnyGoogleRefreshToken();
    if (fallback) refreshToken = fallback;
  }
  if (!refreshToken) {
    throw new Error(
      'No Google refresh token available. Connect Google to enable reply/ping drafting.',
    );
  }
  return refreshAccessToken(refreshToken);
}

/**
 * Look up the authenticated user's email + display name so the draft's From
 * header matches what Gmail would use in a native reply.
 */
async function resolveSenderIdentity(
  accessToken: string,
): Promise<{ myEmail: string; myName?: string }> {
  const [profileEmail, identity] = await Promise.all([
    getGoogleAccountEmail(accessToken),
    getIdentity(),
  ]);
  const myEmail = profileEmail || identity.email;
  const myName = identity.name || undefined;
  return { myEmail, myName };
}

async function createGmailDraftFor({
  accessToken,
  messageId,
  body,
  myEmail,
  myName,
  threadUrl,
}: {
  accessToken: string;
  messageId: string;
  body: string;
  myEmail: string;
  myName?: string;
  threadUrl: string | null;
}): Promise<{ draftId: string; draftUrl: string; subject: string; toEmail: string }> {
  const draft = await createDraftReply({
    accessToken,
    messageId,
    body,
    myEmail,
    myName,
  });
  // Gmail's web UI doesn't expose a stable link to a specific draft — land the
  // user on the thread itself, which is where the new draft will be visible.
  const draftUrl = draft.threadId
    ? `https://mail.google.com/mail/u/0/#inbox/${draft.threadId}`
    : threadUrl || 'https://mail.google.com/mail/u/0/#drafts';
  return {
    draftId: draft.draftId,
    draftUrl,
    subject: draft.subject,
    toEmail: draft.toEmail,
  };
}

// ============================================================================
// Per-verb handlers
// ============================================================================

async function applyClose(task: TaskRecord): Promise<ApplyResult> {
  const updated = await updateTask(task.id, { status: 'Done', done: true });
  return {
    ok: true,
    verb: 'close',
    action: 'task.closed',
    message: `Marked "${task.task}" as Done.`,
    taskId: task.id,
    updatedTask: updated,
  };
}

async function applyDefer(task: TaskRecord, proposedDate: string | undefined): Promise<ApplyResult> {
  const newDue = sanitizeFutureYmd(proposedDate) || threeDaysFromNow();
  const patch: UpdateTaskInput = { due: newDue, status: 'Waiting' };
  const updated = await updateTask(task.id, patch);
  return {
    ok: true,
    verb: 'defer',
    action: 'task.deferred',
    message: `Deferred until ${newDue}.`,
    taskId: task.id,
    updatedTask: updated,
    metadata: { newDue, previousDue: task.due, previousStatus: task.status },
  };
}

async function applySchedule(
  task: TaskRecord,
  proposedDate: string | undefined,
): Promise<ApplyResult> {
  // v1: set due date + Next status. Calendar block is a future enhancement.
  const newDue = sanitizeFutureYmd(proposedDate) || threeDaysFromNow();
  const updated = await updateTask(task.id, { due: newDue, status: 'Next' });
  return {
    ok: true,
    verb: 'schedule',
    action: 'task.scheduled',
    message: `Queued for focus time on ${newDue}.`,
    taskId: task.id,
    updatedTask: updated,
    metadata: { newDue, previousDue: task.due, previousStatus: task.status },
  };
}

async function applyDelegate(task: TaskRecord, delegateTo?: string): Promise<ApplyResult> {
  const assignee = (delegateTo || '').trim();
  const delegateLabel = assignee || 'someone';
  const note = `[${new Date().toISOString().slice(0, 10)}] Delegated to ${delegateLabel} via decision engine.`;
  const notes = task.notes ? `${note}\n${task.notes}` : note;
  const patch: import('@/lib/airtable/tasks').UpdateTaskInput = {
    status: 'Waiting',
    notes,
    ...(assignee ? { assignedTo: assignee } : {}),
  };
  const updated = await updateTask(task.id, patch);
  return {
    ok: true,
    verb: 'delegate',
    action: 'task.delegated',
    message: assignee
      ? `Delegated to ${assignee} — moved to Waiting.`
      : `Moved to Waiting — remember to forward.`,
    taskId: task.id,
    updatedTask: updated,
    metadata: { previousStatus: task.status, delegateTo: assignee || null },
  };
}

async function applySplit(task: TaskRecord): Promise<ApplyResult> {
  // v1: just append a marker note and set Next; actual child-task creation
  // lives in the UI (Chris gets the triggered new-task panel). Keeps this
  // endpoint idempotent and avoids guessing at sub-tasks.
  const note = `[${new Date().toISOString().slice(0, 10)}] Flagged to split into smaller tasks.`;
  const notes = task.notes ? `${note}\n${task.notes}` : note;
  const updated = await updateTask(task.id, { notes, status: 'Next' });
  return {
    ok: true,
    verb: 'split',
    action: 'task.split-flagged',
    message: `Flagged for split — open and create sub-tasks.`,
    taskId: task.id,
    updatedTask: updated,
    metadata: { previousStatus: task.status },
  };
}

async function applyReplyOrPing(
  task: TaskRecord,
  verb: 'reply' | 'ping',
  body: ApplyBody,
): Promise<ApplyResult> {
  const draftBody = (body.suggestedDraft || '').trim();
  if (!draftBody) {
    throw new Error(`${verb} requires a suggestedDraft body.`);
  }
  if (!body.latestMessageId) {
    throw new Error(
      `${verb} requires latestMessageId — re-run the decision engine to pull the thread.`,
    );
  }

  const accessToken = await resolveGoogleAccessToken(body.companyId);
  const { myEmail, myName } = await resolveSenderIdentity(accessToken);

  const draftResult = await createGmailDraftFor({
    accessToken,
    messageId: body.latestMessageId,
    body: draftBody,
    myEmail,
    myName,
    threadUrl: task.threadUrl,
  });

  // Record the draft on the task itself so the UI can open it with one click
  // and so a future decide-call sees `hasDraftedReply: yes`.
  const updated = await updateTask(task.id, { draftUrl: draftResult.draftUrl });

  return {
    ok: true,
    verb,
    action: verb === 'reply' ? 'email.draft-created' : 'email.ping-drafted',
    message:
      verb === 'reply'
        ? `Draft reply created in Gmail for ${draftResult.toEmail}.`
        : `Ping drafted in Gmail for ${draftResult.toEmail} — review before sending.`,
    taskId: task.id,
    draftId: draftResult.draftId,
    draftUrl: draftResult.draftUrl,
    updatedTask: updated,
    metadata: {
      to: draftResult.toEmail,
      subject: draftResult.subject,
      messageId: body.latestMessageId,
      bodyChars: draftBody.length,
    },
  };
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isVerb(body.verb)) {
    return NextResponse.json(
      { error: `Invalid verb. Expected one of: ${ALLOWED_VERBS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const all = await getTasks({});
    const task = all.find(t => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    let result: ApplyResult;
    switch (body.verb) {
      case 'close':
        result = await applyClose(task);
        break;
      case 'defer':
        result = await applyDefer(task, body.proposedDate);
        break;
      case 'schedule':
        result = await applySchedule(task, body.proposedDate);
        break;
      case 'delegate':
        result = await applyDelegate(task, body.delegateTo);
        break;
      case 'split':
        result = await applySplit(task);
        break;
      case 'reply':
      case 'ping':
        result = await applyReplyOrPing(task, body.verb, body);
        break;
      default: {
        // Exhaustiveness guard — if a new verb is added above, TS will flag here.
        const _exhaustive: never = body.verb;
        throw new Error(`Unhandled verb: ${String(_exhaustive)}`);
      }
    }

    // ── Close the feedback loop ──────────────────────────────────────────
    //
    // Capture *what Chris actually did* vs *what the engine proposed*:
    //   - `decision.applied`     — always emitted; includes draftEdit summary
    //   - `decision.draft-edited` — only when the user rewrote the draft,
    //     so we can easily filter for "AI drafts that needed work."
    //
    // We log these as separate events instead of folding into one so the eval
    // harness can query by action type without string-matching metadata.
    const draftEdit = computeDraftEditSignal(body.originalDraft, body.suggestedDraft);

    logEventAsync({
      actorType: 'user',
      actor: 'decision-engine',
      action: 'decision.applied',
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      summary: `Applied '${result.verb}' → ${result.message}`,
      metadata: {
        verb: result.verb,
        label: body.label,
        hadSuggestedDraft: !!body.suggestedDraft,
        hadProposedDate: !!body.proposedDate,
        hadLatestMessageId: !!body.latestMessageId,
        draftEdit,
        ...(result.metadata || {}),
      },
      source: 'app/api/os/tasks/[id]/apply-decision',
    });

    if (draftEdit?.edited) {
      logEventAsync({
        actorType: 'user',
        actor: 'Chris',
        action: 'decision.draft-edited',
        entityType: 'task',
        entityId: task.id,
        entityTitle: task.task,
        summary:
          `Chris edited the AI draft before applying '${result.verb}' ` +
          `(${Math.round(draftEdit.wordSimilarity * 100)}% similarity, ` +
          `${draftEdit.deltaChars >= 0 ? '+' : ''}${draftEdit.deltaChars} chars).`,
        metadata: {
          verb: result.verb,
          ...draftEdit,
        },
        source: 'app/api/os/tasks/[id]/apply-decision',
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/os/tasks/:id/apply-decision] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to apply decision';
    const lower = msg.toLowerCase();
    let friendly = msg;
    let status = 500;
    if (lower.includes('refresh token') || lower.includes('no google')) {
      friendly = msg;
      status = 400;
    } else if (
      lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('forbidden') ||
      lower.includes('permission') ||
      lower.includes('authentication credential') ||
      lower.includes('access token') ||
      lower.includes('unauthenticated')
    ) {
      friendly =
        'Google permission missing (gmail.compose). Disconnect and reconnect Google integration.';
      status = 403;
    } else if (lower.includes('invalid_grant')) {
      friendly = 'Google token expired. Reconnect Google integration.';
      status = 401;
    } else if (lower.includes('requires suggesteddraft') || lower.includes('requires latestmessageid')) {
      status = 400;
    }

    // For scope / token errors, include a reconnect URL so the frontend can link
    // directly to the OAuth flow instead of making the user hunt for it.
    const needsReconnect = status === 401 || status === 403;
    const reconnectCompanyId = body?.companyId || process.env.DMA_DEFAULT_COMPANY_ID || '';
    return NextResponse.json(
      {
        error: friendly,
        detail: msg,
        ...(needsReconnect && reconnectCompanyId
          ? { reconnectUrl: `/api/integrations/google/authorize?companyId=${reconnectCompanyId}&redirect=${encodeURIComponent('/tasks/command-center')}` }
          : {}),
      },
      { status },
    );
  }
}
