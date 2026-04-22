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
import {
  createTask,
  updateTask,
  findTaskBySourceRef,
  type CreateTaskInput,
  type TaskPriority,
  type TaskSource,
  type TaskRecord,
} from '@/lib/airtable/tasks';

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
}

interface CommandCenterResponse {
  commitments?: CommitmentItem[];
  followUps?: FollowUpItem[];
  triage?: TriageItem[];
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
    threadUrl: f.link || undefined,
    source: 'meeting-follow-up',
    sourceRef: f.id,
    autoCreated: true,
  };
}

function triageToTaskInput(t: TriageItem, ageDays: number): CreateTaskInput {
  const subj = t.subject.length > 80 ? t.subject.slice(0, 77) + '…' : t.subject;
  const snip = t.snippet ? (t.snippet.length > 180 ? t.snippet.slice(0, 177) + '…' : t.snippet) : '';
  return {
    task: `Reply: ${subj}`,
    priority: priorityForTriage(ageDays),
    due: isoDay(new Date()), // due today — it's already stale
    from: t.fromName || t.fromEmail || t.from,
    project: '',
    nextAction: snip || `Email from ${ageDays}d ago — reply, convert to task, or archive.`,
    status: 'Inbox',
    view: 'inbox',
    threadUrl: t.link,
    source: 'email-triage',
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
// Upsert logic
// ────────────────────────────────────────────────────────────────────────────

interface SyncStats {
  created: number;
  updated: number;
  unarchived: number;
  skipped: number;
  errors: number;
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

  const stats: SyncStats = { created: 0, updated: 0, unarchived: 0, skipped: 0, errors: 0 };
  const errors: string[] = [];

  try {
    const { companyId } = await req.json().catch(() => ({}));

    // Fetch the command-center payload from our own API. This is intentional:
    // all the Gmail/Calendar/SentMail computation lives in that route, and we
    // don't want to duplicate it. Cost is one extra fetch — acceptable since
    // this runs at most once per minute.
    const origin = req.nextUrl.origin;
    const qs = new URLSearchParams();
    if (companyId) qs.set('companyId', companyId);
    qs.set('refresh', '1');
    const ccUrl = `${origin}/api/os/command-center?${qs.toString()}`;

    const ccRes = await fetch(ccUrl, { cache: 'no-store' });
    if (!ccRes.ok) {
      throw new Error(`Command Center fetch failed: ${ccRes.status}`);
    }
    const cc: CommandCenterResponse = await ccRes.json();

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

    // Stale triage (>2 days old, no existing task)
    for (const t of cc.triage || []) {
      const ageDays = daysSince(t.date);
      if (ageDays <= 2) continue;
      if (t.hasExistingTask) continue;
      try {
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

    lastRunFinishedAt = Date.now();

    return NextResponse.json({
      ok: true,
      stats,
      errors: errors.slice(0, 10),
      durationMs: lastRunFinishedAt - lastRunStartedAt,
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

/** Only needed for TS unused-import stubs. */
export type { TaskRecord };
