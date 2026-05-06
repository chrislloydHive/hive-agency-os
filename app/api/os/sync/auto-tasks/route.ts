// app/api/os/sync/auto-tasks/route.ts
//
// Auto-create tasks in Airtable for everything Command Center surfaces as
// "needs attention but isn't a task yet": commitments from sent mail, past
// meetings with no follow-up logged, and stale triage emails (>2 days old).
//
// Dedup key is (Source, SourceRef). Rerunning is safe — existing rows are
// updated in place, never duplicated.
//
// Dismiss semantics: if a task has `DismissedAt` set, we re-surface it (clear
// DismissedAt) only for email-triage when the thread has a newer message than
// the dismissal. Commitments + meeting follow-ups stay dismissed once dismissed.
//
// Triggered by:
//   - My Day mount (fire-and-forget, 60s client-side cooldown)
//   - Command Center "Sync now" button
//   - Can be called manually for testing

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import {
  createTask,
  updateTask,
  findTaskBySourceRef,
  findTaskByThreadUrl,
  getTasks,
  type CreateTaskInput,
  type TaskPriority,
  type TaskRecord,
  type TaskSource,
} from '@/lib/airtable/tasks';
import {
  getWorkspaceDocs,
  updateWorkspaceDoc,
} from '@/lib/airtable/workspaceDocs';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import {
  buildConversationTranscript,
  type GmailMessageLike,
} from '@/lib/gmail/threadContext';
import { createDraftReply } from '@/lib/gmail/createDraftReply';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import { getIdentity, getVoice } from '@/lib/personalContext';

const anthropic = new Anthropic();

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ────────────────────────────────────────────────────────────────────────────
// Process-level mutex: only one sync runs at a time per process. A 60-second
// cooldown window after a successful run short-circuits follow-up calls.
// ────────────────────────────────────────────────────────────────────────────

let lastRunStartedAt = 0;
let lastRunFinishedAt = 0;
let inFlight = false;
const COOLDOWN_MS = 60_000;

function inCooldown(): number {
  const now = Date.now();
  const sinceFinish = now - lastRunFinishedAt;
  if (sinceFinish < COOLDOWN_MS) return COOLDOWN_MS - sinceFinish;
  return 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Priority heuristic
// ────────────────────────────────────────────────────────────────────────────

function priorityForTriage(ageDays: number): TaskPriority {
  // Fresher first — 0-7d is background noise, older gets louder.
  if (ageDays >= 7) return 'P1';
  return 'P2';
}

function priorityForCommitment(): TaskPriority {
  // You promised something — P2 default. Upgrade to P1 in a follow-up pass
  // when a hard deadline phrase is present (TODO).
  return 'P2';
}

function priorityForMeeting(): TaskPriority {
  return 'P3';
}

// ────────────────────────────────────────────────────────────────────────────
// Due-date defaults (YYYY-MM-DD)
// ────────────────────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plusDays(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoDay(d);
}

// ────────────────────────────────────────────────────────────────────────────
// Types mirroring /api/os/command-center response (trimmed to what we need)
// ────────────────────────────────────────────────────────────────────────────

interface CommitmentItem {
  id: string;
  phrase: string;
  to: string;
  subject: string;
  sentAt: string;
  link: string;
  deadline: string | null;
}

interface FollowUpItem {
  id: string;
  title: string;
  when: string;
  attendees: string[];
  link?: string;
}

interface TriageItem {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  fromName: string;
  fromEmail: string;
  date: string;
  link: string;
  hasExistingTask: boolean;
  /** Companies / Is Client primary contact — stale-sync creates tasks same-day. */
  isKnownClientContact?: boolean;
  /** Only populated for website submissions — full form body for Notes. */
  submissionBody?: string;
}

interface DriveDocSummary {
  id: string;
  name: string;
  link: string;
  mimeType: string;
  modifiedTime: string;
  modifiedByMe?: boolean;
  viewedByMeTime?: string;
}

interface CommandCenterResponse {
  commitments?: CommitmentItem[];
  followUps?: FollowUpItem[];
  triage?: TriageItem[];
  websiteSubmissions?: TriageItem[];
  driveDocs?: DriveDocSummary[];
}

// ────────────────────────────────────────────────────────────────────────────
// Source → task mappers
// ────────────────────────────────────────────────────────────────────────────

function commitmentToTaskInput(c: CommitmentItem): CreateTaskInput {
  const phrase = c.phrase.length > 80 ? c.phrase.slice(0, 77) + '…' : c.phrase;
  return {
    task: `Follow up on: ${phrase}`,
    priority: priorityForCommitment(),
    due: plusDays(3),
    from: c.to ? `to ${c.to}` : 'commitment',
    project: '',
    nextAction: `Promised in "${c.subject}" on ${new Date(c.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${c.deadline ? ` — deadline: ${c.deadline}` : ''}. Confirm or deliver.`,
    status: 'Next',
    view: 'inbox',
    threadUrl: c.link,
    source: 'commitment',
    sourceRef: c.id,
    autoCreated: true,
  };
}

function followUpToTaskInput(f: FollowUpItem): CreateTaskInput {
  return {
    task: `Follow up on ${f.title}`,
    priority: priorityForMeeting(),
    due: plusDays(1),
    from: f.attendees.slice(0, 3).join(', ') + (f.attendees.length > 3 ? ` +${f.attendees.length - 3}` : ''),
    project: '',
    nextAction: `Meeting: ${f.when}. Log any follow-up actions or mark "nothing to capture".`,
    status: 'Next',
    view: 'inbox',
    /** Google Calendar event page — do not use Thread URL (Gmail) for this. */
    calendarEventUrl: f.link || null,
    source: 'meeting-follow-up',
    sourceRef: f.id,
    autoCreated: true,
  };
}

function triageToTaskInput(t: TriageItem, ageDays: number): CreateTaskInput {
  const subj = t.subject.length > 80 ? t.subject.slice(0, 77) + '…' : t.subject;
  const snip = t.snippet ? (t.snippet.length > 180 ? t.snippet.slice(0, 177) + '…' : t.snippet) : '';
  const nextBase =
    snip || `Email from ${ageDays}d ago — reply, convert to task, or archive.`;
  const nextAction = t.isKnownClientContact
    ? `${nextBase} (Client contact — review forward or vendor pitch and decide next step.)`
    : nextBase;
  const notes = t.isKnownClientContact
    ? '[needs your eyes] Known client; short forward may have no explicit ask but still needs judgment.'
    : '';
  return {
    task: `Reply: ${subj}`,
    priority: priorityForTriage(ageDays),
    due: isoDay(new Date()), // due today — it's already stale
    from: t.fromName || t.fromEmail || t.from,
    project: '',
    nextAction,
    notes,
    status: 'Inbox',
    view: 'inbox',
    threadUrl: t.link,
    source: 'email-triage',
    sourceRef: t.id,
    autoCreated: true,
  };
}

function websiteSubmissionToTaskInput(t: TriageItem): CreateTaskInput {
  const subj = t.subject.length > 80 ? t.subject.slice(0, 77) + '…' : t.subject;
  return {
    task: subj, // "New Submission — General Contact" as-is, already scannable
    priority: 'P3', // lowest — routine leads, review when time permits
    // No due date — submissions aren't time-sensitive.
    // from left empty: the row's section header already says "Website submissions".
    from: '',
    project: '',
    // nextAction intentionally empty — the full form body is in notes and the
    // row preview is derived from notes client-side. Avoids duplicating the
    // same info in two fields on the edit panel.
    nextAction: '',
    // Full form body (Name, Email, Phone, Topic, Message). Row preview pulls
    // the Topic + Message lines out of here for display.
    notes: t.submissionBody || '',
    status: 'Inbox',
    view: 'inbox',
    threadUrl: t.link,
    source: 'website-submission',
    sourceRef: t.id,
    autoCreated: true,
  };
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

// ────────────────────────────────────────────────────────────────────────────
// Thread-activity detection (Phase 1 of "smart tasks")
//
// For each active email-tied task, fetch the current thread and record the
// timestamp of the latest message that isn't from us. `Latest Inbound At` is
// compared against `Last Seen At` in the UI to render a "new reply" pill.
// ────────────────────────────────────────────────────────────────────────────

/** Extract a Gmail thread id from a Gmail web URL. Gmail thread ids are hex
 *  strings, typically 16 chars; we accept 10+ to cover edge cases. */
function parseThreadIdFromGmailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/[#/]([0-9a-f]{10,})(?:[?&/#]|$)/i);
  return match ? match[1] : null;
}

type GmailHeader = { name?: string | null; value?: string | null };

function headersFromMessagePayload(payload: unknown): GmailHeader[] {
  if (!payload || typeof payload !== 'object') return [];
  const h = (payload as { headers?: GmailHeader[] | null }).headers;
  return Array.isArray(h) ? h : [];
}

/** Return the best timestamp for a Gmail message: Date header when parseable,
 *  otherwise the message's internalDate (epoch ms string). */
function gmailMessageToIso(msg: {
  payload?: unknown;
  internalDate?: string | null;
}): string | null {
  const headers = headersFromMessagePayload(msg.payload);
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';
  if (dateHeader) {
    const t = Date.parse(dateHeader);
    if (!isNaN(t)) return new Date(t).toISOString();
  }
  if (msg.internalDate) {
    const n = Number(msg.internalDate);
    if (!isNaN(n) && n > 0) return new Date(n).toISOString();
  }
  return null;
}

/** Pick the most recent message in a thread that isn't from the user. Used as
 *  the "inbound activity" signal. Returns null if every message was self-sent. */
function findLatestInboundMessage(
  messages: ReadonlyArray<{
    id?: string | null;
    internalDate?: string | null;
    payload?: unknown;
  }>,
  myEmailLower: string,
): { id: string; iso: string } | null {
  // Walk newest → oldest; Gmail returns oldest first.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const headers = headersFromMessagePayload(m.payload);
    const fromHeader = (
      headers.find((h) => h.name?.toLowerCase() === 'from')?.value || ''
    ).toLowerCase();
    if (myEmailLower && fromHeader.includes(myEmailLower)) continue; // self-sent; skip
    const iso = gmailMessageToIso(m);
    if (!iso || !m.id) continue;
    return { id: m.id, iso };
  }
  return null;
}

interface ThreadActivityContext {
  gmail: ReturnType<typeof google.gmail>;
  myEmailLower: string;
  /** Raw access token — needed by createDraftReply (it builds its own auth client). */
  accessToken: string;
}

/** Ask Claude to rewrite a task's Next Action based on the current state of
 *  the email thread. Returns the new Next Action string, or null if the AI
 *  signals NO_ACTION (thread resolved itself — leave existing Next Action
 *  untouched rather than clobbering with a placeholder).
 *
 *  Intentionally small prompt + cap at 150 output tokens: Next Action should
 *  be one concrete sentence. Model output is trimmed and sanity-checked
 *  (no JSON, no markdown, no multi-sentence essays) before returning. */
async function refreshNextActionFromThread(args: {
  task: TaskRecord;
  messages: GmailMessageLike[];
  myEmailLower: string;
}): Promise<string | null> {
  const { task, messages, myEmailLower } = args;
  const transcript = buildConversationTranscript(
    messages,
    myEmailLower,
    { maxCharsPerTurn: 600, maxTotalChars: 4000 },
  );
  if (!transcript) return null; // nothing useful to feed the model

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `A task in Chris Lloyd's task list tracks an email thread. A new reply just landed and the task's "Next Action" may need to be refreshed to reflect the latest state of the conversation.

Current task:
- Title: ${task.task}
- Current Next Action: ${task.nextAction || '(none)'}
- Status: ${task.status}
- Source: ${task.source || 'manual'}${task.from ? ` (from ${task.from})` : ''}

Full conversation in the thread (oldest → newest):
"""
${transcript}
"""

Write a new Next Action for Chris based on the CURRENT state of the conversation:
- One short sentence, concrete and actionable.
- Reflect the latest ask or state — not the original one.
- Avoid vague verbs like "follow up" — name the specific action ("Send revised pricing for Option C", "Schedule a kickoff call for next week", etc.).
- If the conversation is clearly resolved and no action is needed, respond with exactly: NO_ACTION

Return ONLY the Next Action text. No explanation. No quote marks. No markdown.`,
        },
      ],
    });
    const content = res.content[0];
    if (!content || content.type !== 'text') return null;
    const raw = content.text.trim();
    if (!raw) return null;
    if (raw === 'NO_ACTION') return null;
    // Defensive cleanup: occasionally models wrap in quotes or add prefixes.
    const cleaned = raw
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^Next Action[:\s-]+/i, '')
      .trim();
    // Sanity: reject suspiciously long or empty outputs (models sometimes
    // explain themselves despite instructions).
    if (!cleaned || cleaned.length < 4 || cleaned.length > 300) return null;
    return cleaned;
  } catch (err) {
    console.warn(
      '[sync/auto-tasks] refreshNextActionFromThread error:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Resolve a Gmail thread id for a task: prefer the URL; fall back to a
 *  messages.get(metadata) on sourceRef (the seed message id). */
async function resolveThreadIdForTask(
  ctx: ThreadActivityContext,
  task: TaskRecord,
): Promise<string | null> {
  const fromUrl = parseThreadIdFromGmailUrl(task.threadUrl);
  if (fromUrl) return fromUrl;
  if (!task.sourceRef) return null;
  // Only email-sourced tasks have a sourceRef that's a Gmail message id.
  if (task.source !== 'email-triage' && task.source !== 'website-submission') return null;
  try {
    const meta = await ctx.gmail.users.messages.get({
      userId: 'me',
      id: task.sourceRef,
      format: 'metadata',
      metadataHeaders: [],
    });
    return meta.data.threadId || null;
  } catch {
    return null;
  }
}

/** Run thread-activity detection for every active email-tied task.
 *  Updates Latest Inbound At when a newer inbound message exists; seeds
 *  Last Seen At on first encounter so pre-existing tasks don't immediately
 *  flash "new reply" badges. */
async function runThreadActivityPass(opts: {
  ctx: ThreadActivityContext;
  stats: SyncStats;
  errors: string[];
}): Promise<void> {
  const { ctx, stats, errors } = opts;

  let activeTasks: TaskRecord[];
  try {
    activeTasks = await getTasks({ excludeDone: true });
  } catch (err) {
    console.warn('[sync/auto-tasks] thread-activity: getTasks failed:', err);
    return;
  }

  // Only active + email-derived tasks are in scope.
  const emailTasks = activeTasks.filter(
    (t) =>
      t.status !== 'Archive' &&
      t.status !== 'Done' &&
      (t.threadUrl || t.sourceRef),
  );

  if (emailTasks.length === 0) return;
  console.log(`[sync/auto-tasks] thread-activity: scanning ${emailTasks.length} active email tasks`);

  // Hard cap to protect against runaway costs on large backlogs. If a user has
  // >50 active email tasks we're in a weird state anyway.
  const MAX_CHECKS_PER_RUN = 50;
  const scoped = emailTasks.slice(0, MAX_CHECKS_PER_RUN);

  // Used for the "don't break everything if the Airtable fields are missing"
  // guard — set on first UNKNOWN_FIELD response and short-circuits the rest.
  let airtableFieldsMissing = false;

  for (const task of scoped) {
    if (airtableFieldsMissing) break;
    stats.threadActivityChecked++;

    const threadId = await resolveThreadIdForTask(ctx, task);
    if (!threadId) continue;

    let latest: { id: string; iso: string } | null;
    let threadMessages: GmailMessageLike[] = [];
    try {
      // format=full so we have message bodies ready if we decide to refresh
      // the Next Action. Slightly more bandwidth than metadata-only but lets
      // us avoid a second round-trip when refresh fires.
      const thread = await ctx.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });
      threadMessages = (thread.data.messages ?? []) as GmailMessageLike[];
      latest = findLatestInboundMessage(threadMessages, ctx.myEmailLower);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Thread deleted / access revoked / rare 404 — skip, don't error loudly.
      if (/not\s*found|404/i.test(msg)) continue;
      errors.push(`thread-activity fetch ${task.id}: ${msg.slice(0, 160)}`);
      stats.errors++;
      continue;
    }
    if (!latest) continue; // every message was from me — nothing to flag

    // Decide what to write. Seed Last Seen At when missing so pre-existing
    // tasks don't suddenly flash a pill on first sync after schema update.
    const updates: {
      latestInboundAt?: string;
      lastSeenAt?: string;
      nextAction?: string;
    } = {};
    const isFirstEncounter = !task.lastSeenAt;
    const currentInbound = task.latestInboundAt || null;
    const inboundChanged = currentInbound !== latest.iso;

    if (inboundChanged) {
      updates.latestInboundAt = latest.iso;
    }
    if (isFirstEncounter) {
      updates.lastSeenAt = latest.iso;
    }

    // Phase 2: refresh Next Action when truly new inbound arrived (not a
    // backfill seeding). Skip when the AI returns NO_ACTION or anything
    // unusable. Errors are isolated — they don't prevent the activity-state
    // fields from persisting.
    const trulyNewInbound = inboundChanged && !isFirstEncounter;
    if (trulyNewInbound) {
      try {
        const refreshed = await refreshNextActionFromThread({
          task,
          messages: threadMessages,
          myEmailLower: ctx.myEmailLower,
        });
        if (
          refreshed &&
          refreshed.trim().length > 0 &&
          refreshed !== task.nextAction
        ) {
          updates.nextAction = refreshed;
        }
      } catch (err) {
        console.warn(
          `[sync/auto-tasks] thread-activity refresh ${task.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (Object.keys(updates).length === 0) continue;

    try {
      await updateTask(task.id, updates);
      stats.threadActivityUpdated++;
      if (updates.nextAction) stats.threadActivityNextActionRefreshed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNKNOWN_FIELD|Unknown field|INVALID_FIELD/i.test(msg)) {
        // Airtable schema not ready. Disable the pass until the fields exist.
        console.warn(
          '[sync/auto-tasks] thread-activity: Airtable fields missing — add "Last Seen At" and "Latest Inbound At" to the Tasks table. Pass disabled for this run.',
        );
        airtableFieldsMissing = true;
        break;
      }
      errors.push(`thread-activity update ${task.id}: ${msg.slice(0, 160)}`);
      stats.errors++;
    }
  }

  if (airtableFieldsMissing) {
    // Don't emit the "N tasks updated" line if we bailed — avoids confusion.
    return;
  }
  console.log(
    `[sync/auto-tasks] thread-activity: checked ${stats.threadActivityChecked}, updated ${stats.threadActivityUpdated}, nextAction refreshed ${stats.threadActivityNextActionRefreshed}`,
  );
}

/** Build the Gmail client + resolve the user's email, using the same token
 *  resolution order as /api/os/gmail/draft-reply. Returns null when no Google
 *  token is available — the pass simply no-ops in that case. */
async function buildThreadActivityContext(companyId: string): Promise<ThreadActivityContext | null> {
  let refreshToken: string | undefined;
  if (companyId && companyId !== 'default') {
    const integrations = await getCompanyIntegrations(companyId);
    if (integrations?.google?.refreshToken) refreshToken = integrations.google.refreshToken;
  }
  const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
  if (!refreshToken && defaultCompanyId) {
    const integrations = await getCompanyIntegrations(defaultCompanyId);
    if (integrations?.google?.refreshToken) refreshToken = integrations.google.refreshToken;
  }
  if (!refreshToken) {
    refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
  }
  if (!refreshToken) {
    console.warn('[sync/auto-tasks] thread-activity: no Google refresh token available, skipping pass');
    return null;
  }
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    const myEmail = (await getGoogleAccountEmail(accessToken)) || '';
    return { gmail, myEmailLower: myEmail.toLowerCase(), accessToken };
  } catch (err) {
    console.warn('[sync/auto-tasks] thread-activity: Google auth failed:', err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-nudge for stale waiting items
//
// Slice 1 surfaced "stalled >7d" tasks with an amber tag in the Waiting section.
// This pass closes the loop: for each waiting task whose latest activity is >
// STALE_NUDGE_DAYS old AND has no draft yet, generate a polite check-in email
// and create a Gmail draft on the original thread. The task flips to
// draft-ready in My Day; Chris reviews + sends from Gmail.
//
// Capped at MAX_NUDGES_PER_RUN to bound LLM + Gmail costs per sync.
// ────────────────────────────────────────────────────────────────────────────

const STALE_NUDGE_DAYS = 7;
const MAX_NUDGES_PER_RUN = 5;
const NUDGE_MODEL = 'claude-sonnet-4-6';

const WAIT_PHRASE_RE =
  /(^|\b)(waiting on|wait for|pending from|awaiting|expect.*from|follow up on|as promised)\b/i;

function isWaitingTask(t: TaskRecord): boolean {
  return !!t.nextAction && WAIT_PHRASE_RE.test(t.nextAction);
}

function waitingDays(t: TaskRecord, now = new Date()): number | null {
  const ts = t.lastSeenAt || t.latestInboundAt || t.createdAt;
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return Math.max(1, Math.round((now.getTime() - d.getTime()) / 86400000));
}

interface NudgeBody {
  body: string;
  /** Brief one-liner the model thinks captures the nudge — used as the new nextAction. */
  summary: string;
}

async function generateNudgeBody(args: {
  task: TaskRecord;
  conversationTranscript: string;
  identity: { name: string; role: string; company: string; email: string };
  voiceTone: string;
}): Promise<NudgeBody | null> {
  const { task, conversationTranscript, identity, voiceTone } = args;

  const systemPrompt = `You are drafting a SHORT, polite follow-up "checking in" email for ${identity.name} (${identity.role}, ${identity.company}). The other party owes a response and has gone quiet for over a week.

Style:
- Voice: ${voiceTone}.
- Plain text only. 3-5 sentences MAX.
- Open warmly but NOT obsequious. No "Hope you're well!" filler.
- Reference what's specifically been waiting (use the thread to anchor).
- Soft ask — give them an easy yes or an easy "still working on it." Avoid pressure.
- Do NOT re-pitch or re-introduce. They already know who you are.
- Do NOT include a signature block — the system appends one.

Output STRICT JSON only — no prose, no markdown:
{"body": "<plain-text email body>", "summary": "<one-line description of what this nudges, max 12 words>"}`;

  const userContent = `Task: ${task.task}
What we're waiting on: ${task.nextAction || '(unspecified)'}
Project: ${task.project || '(none)'}

---
Recent thread (oldest → newest):
${conversationTranscript || '(no thread context available — keep nudge generic)'}`;

  try {
    const ai = await anthropic.messages.create({
      model: NUDGE_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = ai.content[0];
    if (!block || block.type !== 'text') return null;
    const raw = block.text.trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { body?: unknown; summary?: unknown };
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!body) return null;
    return { body, summary: summary || 'Auto-drafted nudge — review and send.' };
  } catch (err) {
    console.warn('[sync/auto-tasks] nudge generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function runStaleNudgePass(
  ctx: ThreadActivityContext,
  activeTasks: TaskRecord[],
  stats: SyncStats,
  errors: string[],
): Promise<void> {
  // Filter: waiting + stalled + no existing draft + has a thread to reply on.
  const candidates = activeTasks
    .filter((t) => !t.done && !t.dismissedAt)
    .filter((t) => isWaitingTask(t))
    .filter((t) => !t.draftUrl)
    .filter((t) => !!t.threadUrl)
    .filter((t) => {
      const days = waitingDays(t);
      return days != null && days > STALE_NUDGE_DAYS;
    })
    .slice(0, MAX_NUDGES_PER_RUN);

  if (candidates.length === 0) return;
  console.log(`[sync/auto-tasks] auto-nudge: ${candidates.length} candidate(s)`);

  // Identity + voice are shared across all candidates; load once.
  const [identity, voice] = await Promise.all([getIdentity(), getVoice()]);

  for (const task of candidates) {
    try {
      const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
      if (!threadId) continue;

      // Fetch full thread, find latest non-Chris message (the one to reply to).
      const threadFull = await ctx.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });
      const messages = threadFull.data.messages || [];
      if (messages.length === 0) continue;

      // Pick the latest message that wasn't sent by us.
      let replyToMessageId: string | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const fromVal = (m.payload?.headers || []).find(
          (h) => h.name?.toLowerCase() === 'from',
        )?.value || '';
        if (ctx.myEmailLower && fromVal.toLowerCase().includes(ctx.myEmailLower)) continue;
        if (m.id) {
          replyToMessageId = m.id;
          break;
        }
      }
      // If every message is from us, nothing to nudge — they never responded.
      // Fall back to the latest message in the thread.
      if (!replyToMessageId) {
        const last = messages[messages.length - 1];
        if (!last?.id) continue;
        replyToMessageId = last.id;
      }

      const conversationTranscript = buildConversationTranscript(
        messages as GmailMessageLike[],
        ctx.myEmailLower,
        { maxCharsPerTurn: 600, maxTotalChars: 4000 },
      );

      const nudge = await generateNudgeBody({
        task,
        conversationTranscript,
        identity,
        voiceTone: voice.tone,
      });
      if (!nudge) continue;

      const created = await createDraftReply({
        accessToken: ctx.accessToken,
        messageId: replyToMessageId,
        threadId,
        body: nudge.body,
        myEmail: identity.email,
        myName: identity.name,
      });

      // Open Gmail at the thread; the new draft is shown there.
      const draftUrl = `https://mail.google.com/mail/u/0/#inbox/${created.threadId || threadId}`;

      await updateTask(task.id, {
        draftUrl,
        nextAction: `Nudge drafted — review & send. ${nudge.summary}`,
      });
      stats.nudgesDrafted++;
      console.log(
        `[sync/auto-tasks] auto-nudge: drafted nudge for "${task.task?.slice(0, 60)}" (waiting ${waitingDays(task)}d)`,
      );
    } catch (err) {
      stats.errors++;
      errors.push(`nudge ${task.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-close sent drafts
//
// Closes the loop opened by auto-nudge: once a task has a draftUrl, list
// Gmail's pending drafts. If the task's thread is no longer in the pending
// set, the draft was sent (or discarded). Transition the task:
//   - draftUrl cleared (so the row stops showing "Review in Gmail")
//   - nextAction → "Sent — awaiting reply" (becomes a Waiting-on item via
//     WAIT_PHRASE_RE)
//   - due → today + 5 days (re-surfaces as a follow-up if no reply lands;
//     auto-nudge re-fires after 7d if it stalls again)
//
// Skips tasks whose draftUrl was set within the last DRAFT_GRACE_MIN minutes
// to avoid racing the just-created auto-nudge drafts.
// ────────────────────────────────────────────────────────────────────────────

const DRAFT_GRACE_MIN = 10;

/** Pull a Gmail thread id out of a `https://mail.google.com/.../<threadId>` URL. */
function threadIdFromMailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[#/]([0-9a-f]{10,})(?:[?&/#]|$)/i);
  return m ? m[1] : null;
}

async function runSentDraftsPass(
  ctx: ThreadActivityContext,
  activeTasks: TaskRecord[],
  stats: SyncStats,
  errors: string[],
): Promise<void> {
  const candidates = activeTasks.filter((t) => !t.done && !t.dismissedAt && !!t.draftUrl);
  if (candidates.length === 0) return;

  // Single bulk call: fetch up to 500 currently-pending drafts. Each draft
  // includes its Gmail threadId, which we use to dedupe against tasks.
  let pendingThreadIds: Set<string>;
  try {
    const res = await ctx.gmail.users.drafts.list({
      userId: 'me',
      maxResults: 500,
    });
    pendingThreadIds = new Set(
      (res.data.drafts || [])
        .map((d) => d.message?.threadId || '')
        .filter(Boolean),
    );
  } catch (err) {
    console.warn('[sync/auto-tasks] sent-drafts: failed to list drafts (skipping pass):', err instanceof Error ? err.message : err);
    return;
  }

  const nowMs = Date.now();
  for (const task of candidates) {
    try {
      const threadId = threadIdFromMailUrl(task.draftUrl) || threadIdFromMailUrl(task.threadUrl);
      if (!threadId) continue;
      // Skip if still pending — Chris hasn't sent yet.
      if (pendingThreadIds.has(threadId)) continue;
      // Grace window: don't transition drafts that were JUST set this run, in
      // case bulk drafts.list has a slight propagation delay.
      const lastTouched = new Date(task.lastModified || 0).getTime();
      if (Number.isFinite(lastTouched) && nowMs - lastTouched < DRAFT_GRACE_MIN * 60_000) {
        continue;
      }

      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 5);
      const yyyy = followUpDate.getFullYear();
      const mm = String(followUpDate.getMonth() + 1).padStart(2, '0');
      const dd = String(followUpDate.getDate()).padStart(2, '0');

      await updateTask(task.id, {
        draftUrl: null,
        nextAction: 'Sent — awaiting reply',
        due: `${yyyy}-${mm}-${dd}`,
      });
      stats.sentDraftsClosed++;
      console.log(
        `[sync/auto-tasks] sent-drafts: closed "${task.task?.slice(0, 60)}" — followup ${yyyy}-${mm}-${dd}`,
      );
    } catch (err) {
      stats.errors++;
      errors.push(`sent-draft ${task.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Upsert logic
// ────────────────────────────────────────────────────────────────────────────

interface SyncStats {
  created: number;
  updated: number;
  unarchived: number;
  skipped: number;
  filteredIrrelevant: number;
  errors: number;
  workspaceCreated: number;
  workspaceUnarchived: number;
  workspaceArchivedStale: number;
  workspaceUrlResolved: number;
  threadActivityChecked: number;
  threadActivityUpdated: number;
  threadActivityNextActionRefreshed: number;
  nudgesDrafted: number;
  sentDraftsClosed: number;
}

// ────────────────────────────────────────────────────────────────────────────
// LLM relevance backstop
//
// Heuristic scoring catches the obvious noise (bulk senders, list-unsubscribe
// headers, marketing patterns), but inevitably misses some cold-outreach and
// service-account email that scores positive. Before turning a triage item
// into a Hive OS task, ask Claude Haiku — cheap, fast — whether this is real
// work or noise.
//
// Skip-on-error degrades OPEN: if the API call fails, we create the task
// rather than silently dropping it. Losing a real task is worse than letting
// occasional noise through.
// ────────────────────────────────────────────────────────────────────────────

const RELEVANCE_MODEL = 'claude-haiku-4-5-20251001';

const RELEVANCE_SYSTEM_PROMPT = `You decide whether an email warrants a work task in Chris Lloyd's task system.

Chris runs an ad agency (Hive). WORK-RELATED email includes:
- Direct messages from clients, prospects, or vendors he actively engages with
- Finance & billing he must act on (unpaid invoices, A/R aging, IRS notices, contracts to sign)
- Operational requests from his team or partners
- Partner/vendor outreach he is actively pursuing (NOT generic cold pitches dressed up as warm)
- Replies to threads HE started or where HE owes a response

NOT WORK-RELATED includes:
- Newsletters, digests, "today's edition", weekly recaps, blogs (often have an Unsubscribe link)
- Promotional / marketing email (sales, % off, new arrivals, free trials, webinars)
- Cold outbound sales pitches — INCLUDING the "warm cold" variety that opens with personalized flattery before a soft pitch
- Auto-generated digests / system notifications (shipping, delivery, receipts, account notifications, security alerts, password resets, daily task digests Chris's own systems email him)
- Social network notifications (LinkedIn, Twitter, etc.)

WARM-COLD PATTERN — flag false even though it sounds personal:
A salesperson Chris doesn't actively work with, opening with a friendly hook ("Hope all is well!", "Congrats on the launch!", "Been a while!"), then transitioning to a pitch ("As you look to scale", "I'd love to reconnect and share how we help agencies improve their media performance", "have any opportunities on your radar"). The flattery is generic, the ask is fishing, and they've sent multiple unanswered follow-ups. This is a SALES PITCH no matter how warmly it's worded.

Strong signals it's warm-cold sales (not real outreach):
- "Hope all is well" / "Hope you're doing well"
- "Congrats on the launch / new role / recent news"
- "Reaching back out" / "Just following up" / "Circling back"
- "Love to (re)connect"
- "Share how we're helping agencies..."
- "Improve their media/advertising performance/efficiency"
- "Opportunities on your radar"
- A previous email (or two) in the thread, all from them, no replies from Chris
- Sender domain is a vendor in Chris's industry (programmatic ad platforms, agency tools, etc.) but not someone he's currently working with

Output STRICT JSON only — no prose, no markdown:
{"workRelated": true|false, "reason": "<short phrase, max 8 words>"}

DEFAULT POSTURE: if the sender appears to be a stranger pitching something, lean FALSE. The cost of a missed cold pitch is near-zero (Chris will star anything important). The cost of a false-positive task is high (it adds noise to his queue). Only flag TRUE when there's a real business signal — a client he works with, a billing item, an active vendor relationship, a question he must answer.`;

interface RelevanceResult {
  workRelated: boolean;
  reason: string;
}

async function isWorkRelatedEmail(t: TriageItem): Promise<RelevanceResult> {
  // Defense in depth: if the sender is one of Chris's own addresses, skip
  // unconditionally. Hive OS itself sends a daily task digest that would
  // otherwise become a task, feeding a self-recursion loop. The Gmail-side
  // -from:me filter should catch this upstream, but belt-and-suspenders.
  const fromEmailLower = (t.fromEmail || '').toLowerCase();
  if (fromEmailLower && /@(hive8\.us|hiveadagency\.com|hiveagencyos\.com)$/.test(fromEmailLower)) {
    return { workRelated: false, reason: 'self-sent system digest' };
  }
  // Known client contact short-circuits the LLM call entirely — they're work
  // by definition, no need to spend a token.
  if (t.isKnownClientContact) {
    return { workRelated: true, reason: 'known client contact' };
  }
  const fromLine = t.from || `${t.fromName || ''} <${t.fromEmail || ''}>`.trim();
  const userContent = `From: ${fromLine}\nSubject: ${t.subject || '(no subject)'}\nSnippet: ${(t.snippet || '').slice(0, 400)}`;
  try {
    const ai = await anthropic.messages.create({
      model: RELEVANCE_MODEL,
      max_tokens: 80,
      system: RELEVANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return { workRelated: true, reason: 'parse fallback' };
    }
    const raw = block.text.trim();
    // Pull out the first {...} block, stripping any code-fence wrap.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return { workRelated: true, reason: 'parse fallback' };
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { workRelated?: unknown; reason?: unknown };
    const workRelated = parsed.workRelated !== false; // default true on missing
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 80) : '';
    return { workRelated, reason };
  } catch (err) {
    console.warn(
      '[sync/auto-tasks] relevance check failed (degrading open, will create task):',
      err instanceof Error ? err.message : err,
    );
    return { workRelated: true, reason: 'check failed' };
  }
}

async function upsertAutoTask(
  source: TaskSource,
  sourceRef: string,
  input: CreateTaskInput,
  /** For email-triage: if the source has newer activity than `existing.dismissedAt`, un-dismiss. */
  sourceActivityDate?: string | null,
): Promise<{ action: 'created' | 'updated' | 'unarchived' | 'skipped' }> {
  const existing = await findTaskBySourceRef(source, sourceRef);

  if (!existing) {
    await createTask(input);
    return { action: 'created' };
  }

  // Task exists. Don't overwrite user-edited fields; only clear dismissal when
  // there's fresh activity on the source.
  if (existing.dismissedAt) {
    if (source === 'email-triage' && sourceActivityDate) {
      const dismissedMs = new Date(existing.dismissedAt).getTime();
      const activityMs = new Date(sourceActivityDate).getTime();
      if (!isNaN(activityMs) && !isNaN(dismissedMs) && activityMs > dismissedMs) {
        await updateTask(existing.id, {
          dismissedAt: null,
          // Also bump the status back to Inbox so it shows up in My Day again.
          status: 'Inbox',
          view: 'inbox',
        });
        return { action: 'unarchived' };
      }
    }
    return { action: 'skipped' }; // dismissed, no new activity
  }

  // Backfill / refresh Calendar URL for meeting follow-ups (moves legacy
  // htmlLink out of Thread URL on first run after the CalendarEventUrl column exists).
  if (source === 'meeting-follow-up' && input.calendarEventUrl) {
    const cal = input.calendarEventUrl;
    if (!existing.calendarEventUrl || existing.calendarEventUrl !== cal) {
      const threadWasCal =
        existing.threadUrl &&
        (existing.threadUrl === cal ||
          /google\.com\/calendar|calendar\.google\.com/.test(existing.threadUrl));
      await updateTask(existing.id, {
        calendarEventUrl: cal,
        ...(threadWasCal ? { threadUrl: null } : {}),
      });
      return { action: 'updated' };
    }
  }

  // Refresh the preview for website submissions on every sync. Earlier syncs
  // stored the boilerplate snippet; re-running the extraction gives the real
  // form content. Limited to this source — commitments / follow-ups have
  // nextAction the user may have edited and shouldn't be clobbered.
  if (
    source === 'website-submission' &&
    input.nextAction &&
    input.nextAction !== existing.nextAction
  ) {
    await updateTask(existing.id, { nextAction: input.nextAction });
    return { action: 'updated' };
  }

  // Otherwise no changes needed — the task exists, isn't dismissed, user has it.
  return { action: 'skipped' };
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (inFlight) {
    return NextResponse.json({ ok: false, reason: 'already-running' }, { status: 429 });
  }
  const cd = inCooldown();
  if (cd > 0) {
    return NextResponse.json(
      { ok: false, reason: 'cooldown', cooldownMsRemaining: cd },
      { status: 429 },
    );
  }

  inFlight = true;
  lastRunStartedAt = Date.now();

  const stats: SyncStats = {
    created: 0, updated: 0, unarchived: 0, skipped: 0, filteredIrrelevant: 0, errors: 0,
    workspaceCreated: 0, workspaceUnarchived: 0, workspaceArchivedStale: 0,
    workspaceUrlResolved: 0,
    threadActivityChecked: 0, threadActivityUpdated: 0, threadActivityNextActionRefreshed: 0,
    nudgesDrafted: 0,
    sentDraftsClosed: 0,
  };
  const errors: string[] = [];

  try {
    const { companyId: bodyCompanyId } = await req.json().catch(() => ({}));
    // Prefer body companyId, fall back to env default (same id Command Center
    // page passes). Passing an explicit id ensures /api/os/command-center uses
    // the correct Google tokens and doesn't take the anonymous fallback path.
    const companyId = bodyCompanyId || process.env.DMA_DEFAULT_COMPANY_ID || 'default';

    // Fetch the command-center payload from our own API. This is intentional:
    // all the Gmail/Calendar/SentMail computation lives in that route, and we
    // don't want to duplicate it. Cost is one extra fetch — acceptable since
    // this runs at most once per minute.
    const origin = req.nextUrl.origin;
    const qs = new URLSearchParams();
    qs.set('companyId', companyId);
    qs.set('refresh', '1');
    const ccUrl = `${origin}/api/os/command-center?${qs.toString()}`;
    console.log(`[sync/auto-tasks] Fetching ${ccUrl}`);

    const ccRes = await fetch(ccUrl, { cache: 'no-store' });
    if (!ccRes.ok) {
      const text = await ccRes.text().catch(() => '');
      throw new Error(`Command Center fetch failed: ${ccRes.status} — ${text.slice(0, 200)}`);
    }
    const cc: CommandCenterResponse = await ccRes.json();
    console.log(
      `[sync/auto-tasks] Command Center returned: ` +
        `commitments=${cc.commitments?.length ?? 0}, ` +
        `followUps=${cc.followUps?.length ?? 0}, ` +
        `triage=${cc.triage?.length ?? 0}`,
    );

    // Commitments
    for (const c of cc.commitments || []) {
      try {
        const r = await upsertAutoTask('commitment', c.id, commitmentToTaskInput(c));
        stats[r.action]++;
      } catch (err) {
        stats.errors++;
        errors.push(`commitment ${c.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Meeting follow-ups
    for (const f of cc.followUps || []) {
      try {
        const r = await upsertAutoTask('meeting-follow-up', f.id, followUpToTaskInput(f));
        stats[r.action]++;
      } catch (err) {
        stats.errors++;
        errors.push(`followup ${f.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Stale triage (>2 days old, no existing task), OR any age when the sender
    // is a known client contact (forwards & trade-out pitches must not wait 3 days).
    for (const t of cc.triage || []) {
      const ageDays = daysSince(t.date);
      if (ageDays <= 2 && !t.isKnownClientContact) continue;
      if (t.hasExistingTask) continue;
      try {
        // LLM relevance backstop — cheap noise filter past the heuristic score.
        // Known clients short-circuit (no LLM call). Failures degrade open.
        const relevance = await isWorkRelatedEmail(t);
        if (!relevance.workRelated) {
          stats.filteredIrrelevant++;
          console.log(
            `[sync/auto-tasks] filtered as not work-related: "${t.subject?.slice(0, 60)}" from ${t.fromEmail} — reason: ${relevance.reason}`,
          );
          continue;
        }
        const r = await upsertAutoTask(
          'email-triage',
          t.id,
          triageToTaskInput(t, ageDays),
          t.date,
        );
        stats[r.action]++;
      } catch (err) {
        stats.errors++;
        errors.push(`triage ${t.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Website submissions — low-priority form fills, all framer.com "New Submission".
    // No freshness filter: we want ALL of them, regardless of age.
    // No hasExistingTask skip either: older tasks pre-date Source/SourceRef
    // and would otherwise be orphaned with stale previews. We adopt them via
    // findTaskByThreadUrl as a fallback.
    for (const t of cc.websiteSubmissions || []) {
      try {
        const input = websiteSubmissionToTaskInput(t);
        // First try (source, sourceRef) — future runs, after backfill.
        const bySourceRef = await findTaskBySourceRef('website-submission', t.id);
        if (bySourceRef) {
          if (bySourceRef.dismissedAt) { stats.skipped++; continue; }
          const needsNotes = input.notes && input.notes !== bySourceRef.notes;
          // Clear any legacy value in nextAction — submissions should have it
          // blank so the edit panel doesn't show the same text twice (once in
          // Next Action, once in Notes).
          const needsClearNextAction = (bySourceRef.nextAction || '').length > 0;
          // Clear the legacy "Hive website" from value that old sync-gmail set.
          const needsClearFrom = bySourceRef.from === 'Hive website';
          if (needsNotes || needsClearNextAction || needsClearFrom) {
            await updateTask(bySourceRef.id, {
              ...(needsNotes ? { notes: input.notes } : {}),
              ...(needsClearNextAction ? { nextAction: '' } : {}),
              ...(needsClearFrom ? { from: '' } : {}),
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
          continue;
        }
        // Fallback: legacy tasks keyed by thread URL only. Adopt + backfill
        // notes, source, sourceRef. Clear legacy from + nextAction.
        const byThread = t.link ? await findTaskByThreadUrl(t.link) : null;
        if (byThread) {
          if (byThread.dismissedAt) { stats.skipped++; continue; }
          await updateTask(byThread.id, {
            nextAction: '',
            notes: input.notes,
            from: '',
            source: 'website-submission',
            sourceRef: t.id,
            autoCreated: true,
          });
          stats.updated++;
          continue;
        }
        // Nothing exists — create fresh.
        await createTask(input);
        stats.created++;
      } catch (err) {
        stats.errors++;
        errors.push(`submission ${t.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Workspace pass — URL resolution ONLY
    //
    // Auto-discovery (creating new workspace docs from Drive activity) and
    // stale-archive were removed intentionally: when the user hard-deleted a
    // row in Airtable, the next sync re-created it from Drive because we
    // have no persistent memory of dismissed URLs outside Airtable. The only
    // reliable fix is to stop auto-creating. Users add docs explicitly via
    // the "Add" dialog in My Day.
    //
    // What remains: a URL-resolution pass that fixes legacy rows which were
    // copy-pasted from a Drive-chip spreadsheet and ended up with the file
    // NAME in the URL field instead of a real http:// link. Purely a fixup
    // of data the user already chose to keep — never creates or archives.
    // ────────────────────────────────────────────────────────────────────────
    try {
      const driveDocs = cc.driveDocs || [];
      const allActiveWorkspaceDocs = await getWorkspaceDocs();

      for (const doc of allActiveWorkspaceDocs) {
        if (/^https?:\/\//i.test(doc.url)) continue; // already a real URL
        if (!doc.url) continue;
        const wanted = doc.url.trim().toLowerCase();
        // Try exact-match first, then fuzzy contains.
        const match =
          driveDocs.find((d) => (d.name || '').trim().toLowerCase() === wanted) ||
          driveDocs.find((d) => (d.name || '').trim().toLowerCase().includes(wanted));
        if (match?.link) {
          try {
            await updateWorkspaceDoc(doc.id, { url: match.link });
            stats.workspaceUrlResolved++;
          } catch (err) {
            stats.errors++;
            errors.push(`workspace url-resolve ${doc.id}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    } catch (err) {
      // Non-fatal — workspace pass failing shouldn't block the rest of the sync.
      console.error('[sync/auto-tasks] workspace pass error:', err);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Thread-activity pass: for each active email-tied task, bump
    // Latest Inbound At when a newer non-self message lands in the thread.
    // Failures are non-fatal — the rest of the sync has already done its job.
    // ────────────────────────────────────────────────────────────────────────
    try {
      const ctx = await buildThreadActivityContext(companyId);
      if (ctx) {
        await runThreadActivityPass({ ctx, stats, errors });
        // Sent-drafts pass: close the loop on drafts Chris has actually sent.
        // Runs BEFORE auto-nudge so we don't immediately re-nudge a task we
        // just discovered was already responded to.
        try {
          const tasksForSentCheck = await getTasks({ excludeDone: true });
          await runSentDraftsPass(ctx, tasksForSentCheck, stats, errors);
        } catch (err) {
          console.error('[sync/auto-tasks] sent-drafts pass error:', err);
        }
        // Auto-nudge pass: re-load active tasks AFTER thread-activity +
        // sent-drafts (both may have updated tasks), then draft polite
        // check-ins for stale waiting items.
        try {
          const freshActiveTasks = await getTasks({ excludeDone: true });
          await runStaleNudgePass(ctx, freshActiveTasks, stats, errors);
        } catch (err) {
          console.error('[sync/auto-tasks] auto-nudge pass error:', err);
        }
      }
    } catch (err) {
      console.error('[sync/auto-tasks] thread-activity pass error:', err);
    }

    lastRunFinishedAt = Date.now();

    return NextResponse.json({
      ok: true,
      stats,
      errors: errors.slice(0, 10),
      durationMs: lastRunFinishedAt - lastRunStartedAt,
      // Diagnostic: what the upstream Command Center returned. If these are
      // all zero, the issue is in /api/os/command-center, not here.
      upstream: {
        companyId,
        commitments: cc.commitments?.length ?? 0,
        followUps: cc.followUps?.length ?? 0,
        triage: cc.triage?.length ?? 0,
        websiteSubmissions: cc.websiteSubmissions?.length ?? 0,
        driveDocs: cc.driveDocs?.length ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        stats,
        errors,
      },
      { status: 500 },
    );
  } finally {
    inFlight = false;
  }
}

/** GET — report last-run status without doing work. Used by the UI to show
 *  "last synced 2m ago" in the Command Center header. */
export async function GET() {
  return NextResponse.json({
    inFlight,
    lastRunStartedAt: lastRunStartedAt || null,
    lastRunFinishedAt: lastRunFinishedAt || null,
    cooldownMsRemaining: inCooldown(),
  });
}

/**
 * PATCH — dismiss an auto-task by (source, sourceRef). Writes DismissedAt so
 * the next sync knows not to re-surface it (unless there's new activity, in
 * the case of email-triage).
 *
 * Body: { source: 'commitment' | 'meeting-follow-up' | 'email-triage', sourceRef: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { source, sourceRef } = await req.json();
    if (!source || !sourceRef) {
      return NextResponse.json({ error: 'source and sourceRef are required' }, { status: 400 });
    }
    const existing = await findTaskBySourceRef(source as TaskSource, sourceRef);
    if (!existing) {
      // Nothing to dismiss yet (sync hasn't run). Treat as success — the
      // item will be created already-dismissed on next sync if we store the
      // dismissal elsewhere, but for v1 we accept the no-op.
      return NextResponse.json({ ok: true, action: 'noop', reason: 'no-matching-task' });
    }
    const now = new Date().toISOString();
    await updateTask(existing.id, {
      dismissedAt: now,
      status: 'Archive',
      view: 'archive',
    });
    return NextResponse.json({ ok: true, action: 'dismissed', taskId: existing.id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to dismiss' },
      { status: 500 },
    );
  }
}

