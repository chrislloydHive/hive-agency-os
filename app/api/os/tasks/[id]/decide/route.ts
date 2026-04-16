// app/api/os/tasks/[id]/decide/route.ts
// Decision engine API — asks Claude: "what should Chris do about this task, right now?"
//
// GET  /api/os/tasks/:id/decide
//   ?companyId=xxx  (optional; defaults to fallback Google token)
//
// Returns a structured recommendation from `lib/decisionEngine`:
//   { recommendedVerb, recommendedLabel, rationale, confidence, alternatives, suggestedDraft?, proposedDate? }
//
// Pulls from three substrates:
//   - Airtable Tasks (the task itself)
//   - Gmail (the attached thread, if `threadUrl` is set)
//   - Activity Log (recent events for this task)
//
// Graceful: if Gmail isn't connected we still produce a recommendation from
// task + activity alone. If the Activity Log isn't configured we still work
// from task + thread. The model never sees null / undefined noise.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getTasks } from '@/lib/airtable/tasks';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { getRecentTaskActivity, logEventAsync, type ActivityRow } from '@/lib/airtable/activityLog';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { getIdentity } from '@/lib/personalContext';
import {
  buildDecisionPrompt,
  parseDecisionResponse,
  type DecisionInput,
  type DecisionTaskInput,
  type DecisionThreadInput,
  type DecisionActivitySummary,
} from '@/lib/decisionEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const anthropic = new Anthropic();

type MsgPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MsgPart[] | null;
};

function extractPlainText(payload: MsgPart | undefined | null): string {
  let body = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return body;
}

/** Pull the thread id out of a stored threadUrl. Accepts both old and new Gmail URLs. */
function threadIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m1 = /#inbox\/([a-zA-Z0-9]+)/.exec(url);
  if (m1) return m1[1];
  const m2 = /[?&]th=([a-zA-Z0-9]+)/.exec(url);
  return m2 ? m2[1] : null;
}

function overdueDaysFor(ymd: string | null, now: Date): number | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - due.getTime()) / (24 * 3600 * 1000));
  return diff > 0 ? diff : null;
}

function daysSinceIso(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now.getTime() - t) / (24 * 3600 * 1000));
}

/**
 * Trim an email body for inline preview: strip quoted replies (lines starting
 * with `>`), collapse excess whitespace, and cap at `maxWords`. Returns
 * `{ text, truncated }` so the UI can render a "…" + "show more" affordance.
 */
function trimEmailForPreview(
  raw: string,
  maxWords: number,
): { text: string; truncated: boolean } {
  // Drop trailing quoted-reply chains and signature-separator blocks. These
  // add visual noise without adding context — the decision engine already
  // saw the full thread.
  const keptLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // Stop at common "On <date> <person> wrote:" markers that precede a quoted reply.
    if (/^on .{5,} wrote:\s*$/i.test(line.trim())) break;
    // Stop at `-- ` signature marker (RFC 3676).
    if (line.trim() === '--') break;
    // Skip fully-quoted lines; keep the rest (including replies that splice in).
    if (/^\s*>/.test(line)) continue;
    keptLines.push(line);
  }
  const collapsed = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const words = collapsed.split(/\s+/);
  if (words.length <= maxWords) return { text: collapsed, truncated: false };
  return { text: words.slice(0, maxWords).join(' ') + '…', truncated: true };
}

/** Summarize activity rows into the DecisionActivitySummary shape the engine expects. */
function summarizeActivity(rows: ActivityRow[], now: Date): DecisionActivitySummary {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const sorted = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const statusFlips = sorted.filter(r => {
    if (r.action !== 'task.status-changed' && r.action !== 'task.completed') return false;
    const tms = Date.parse(r.timestamp);
    return !Number.isNaN(tms) && tms >= sevenDaysAgo;
  }).length;

  const hasDraftedReply = sorted.some(r => r.action === 'email.draft-created');

  const opened = [...sorted].reverse().find(r => r.action === 'task.opened-in-ui');

  return {
    lastActions: sorted.slice(-8).map(r => ({
      action: r.action,
      timestamp: r.timestamp,
      summary: r.summary || '',
    })),
    statusFlips,
    lastOpenedInUi: opened?.timestamp,
    hasDraftedReply,
  };
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    // ── Load the task ─────────────────────────────────────────────────────
    const all = await getTasks({});
    const task: TaskRecord | undefined = all.find(t => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const now = new Date();

    // ── Activity context (best-effort; never throws) ─────────────────────
    const sinceIso = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();
    const activityRows = await getRecentTaskActivity({
      sinceIso,
      taskIds: [task.id],
      maxRows: 100,
    });
    const activity = summarizeActivity(activityRows, now);

    // ── Thread context (best-effort) ──────────────────────────────────────
    let thread: DecisionThreadInput | undefined;
    let latestMessageId: string | null = null;
    const threadId = threadIdFromUrl(task.threadUrl);
    if (threadId) {
      try {
        let refreshToken: string | undefined;
        if (companyId && companyId !== 'default') {
          const integrations = await getCompanyIntegrations(companyId);
          refreshToken = integrations?.google?.refreshToken;
        }
        if (!refreshToken) {
          const fallback = await getAnyGoogleRefreshToken();
          if (fallback) refreshToken = fallback;
        }
        if (refreshToken) {
          const accessToken = await refreshAccessToken(refreshToken);
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: accessToken });
          const gmail = google.gmail({ version: 'v1', auth });

          const t = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
          const messages = t.data.messages || [];
          const last = messages[messages.length - 1];
          latestMessageId = last?.id || null;
          const headers = last?.payload?.headers || [];
          const hget = (n: string) =>
            headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
          const subject = hget('Subject') || '(no subject)';
          const fromHeader = hget('From') || '—';
          const dateStr = hget('Date');
          let dateIso = '';
          try {
            if (dateStr) dateIso = new Date(dateStr).toISOString();
          } catch {
            /* noop */
          }
          const body =
            extractPlainText(last?.payload as MsgPart) || last?.snippet || '';
          thread = {
            subject,
            latestFrom: fromHeader,
            latestDate: dateIso || (last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : ''),
            latestBody: body,
            messageCount: messages.length,
          };
        }
      } catch (err) {
        console.warn('[api/os/tasks/:id/decide] thread fetch failed (continuing):', err);
        // fall through — we still produce a recommendation without the thread
      }
    }

    // ── Build the structured input ────────────────────────────────────────
    const taskInput: DecisionTaskInput = {
      id: task.id,
      title: task.task,
      status: task.status,
      priority: task.priority,
      due: task.due,
      from: task.from || '',
      project: task.project || null,
      nextAction: task.nextAction || '',
      notes: task.notes || '',
      threadUrl: task.threadUrl,
      daysSinceCreated: daysSinceIso(task.createdAt, now),
      daysSinceLastMotion: daysSinceIso(
        activity.lastActions.length ? activity.lastActions[activity.lastActions.length - 1].timestamp : task.lastModified,
        now,
      ),
      overdueByDays: overdueDaysFor(task.due, now),
    };

    const identity = await getIdentity();
    const todayIso = now.toISOString().slice(0, 10);
    const input: DecisionInput = {
      task: taskInput,
      thread,
      activity,
      identityName: identity.name || 'Chris',
      todayIso,
    };

    const prompt = buildDecisionPrompt(input);

    // ── Call Claude ───────────────────────────────────────────────────────
    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = ai.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected AI response type');
    }
    const decision = parseDecisionResponse(content.text, todayIso);

    // ── Log the suggestion so we can close the feedback loop later ───────
    logEventAsync({
      actorType: 'ai',
      actor: 'decision-engine',
      action: 'decision.suggested',
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      summary: `Decision engine → ${decision.recommendedVerb} (${decision.confidence}): ${decision.rationale.slice(0, 160)}`,
      metadata: {
        verb: decision.recommendedVerb,
        confidence: decision.confidence,
        hasThread: !!thread,
        activityRowsConsidered: activityRows.length,
        alternatives: decision.alternatives.map(a => a.verb),
        hasSuggestedDraft: !!decision.suggestedDraft,
        proposedDate: decision.proposedDate,
      },
      source: 'app/api/os/tasks/[id]/decide',
    });

    // Build a trimmed, quote-stripped preview for the UI. The raw body we sent
    // to the model is up to 3000 chars — too much for inline display. 200
    // words is ~1200 chars, about a paragraph that fits in the side panel.
    const threadPreview = thread
      ? (() => {
          const { text, truncated } = trimEmailForPreview(thread.latestBody, 200);
          return {
            subject: thread.subject,
            latestFrom: thread.latestFrom,
            latestDate: thread.latestDate,
            body: text,
            truncated,
            messageCount: thread.messageCount,
          };
        })()
      : null;

    return NextResponse.json({
      taskId: task.id,
      taskTitle: task.task,
      generatedAt: now.toISOString(),
      hasThread: !!thread,
      latestMessageId,
      activityRowsConsidered: activityRows.length,
      decision,
      threadPreview,
    });
  } catch (err) {
    console.error('[api/os/tasks/:id/decide] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to produce decision' },
      { status: 500 },
    );
  }
}
