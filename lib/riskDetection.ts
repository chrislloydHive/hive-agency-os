/**
 * Risk / stall detection — "what is quietly going wrong?"
 * ---------------------------------------------------------
 * Pure detector over (tasks, activity rows). Flags tasks and workflows that
 * are slipping: waiting too long, overdue with no motion, drafts abandoned,
 * status thrashing.
 *
 * Keep this module pure and deterministic so the rules can be unit-tested
 * and tuned without touching the API layer. Every risk carries:
 *   - `kind`      (machine tag — stable across versions)
 *   - `severity`  ('low' | 'medium' | 'high')
 *   - `reason`    (short human explanation, rendered in UI)
 *   - `entityId` / `entityTitle` (so the UI can deep-link)
 *   - `signals`   (structured context — days since x, counts, etc.)
 *
 * Rules shipped (tunable via `DEFAULT_THRESHOLDS`):
 *   1. stalled.waiting     — Waiting status, no update in W days
 *   2. stalled.inbox       — Inbox status, sitting I days, no updates
 *   3. stalled.overdue     — Past due by O days, no recent activity
 *   4. drift.draft-unsent  — email.draft-created D+ days ago, no follow-up,
 *                            related task not yet Done
 *   5. thrash.status       — T+ status changes in the last TWindow days
 */

import type { TaskRecord } from './airtable/tasks';
import type { ActivityRow } from './airtable/activityLog';

// ============================================================================
// Thresholds
// ============================================================================

export const DEFAULT_THRESHOLDS = {
  stalledWaitingDays: 7,
  stalledInboxDays: 10,
  stalledOverdueDays: 7,
  driftDraftUnsentDays: 3,
  thrashStatusChangeCount: 3,
  thrashWindowDays: 7,
} as const;

// ============================================================================
// Types
// ============================================================================

export type RiskSeverity = 'low' | 'medium' | 'high';

export type RiskKind =
  | 'stalled.waiting'
  | 'stalled.inbox'
  | 'stalled.overdue'
  | 'drift.draft-unsent'
  | 'thrash.status';

export interface RiskItem {
  kind: RiskKind;
  severity: RiskSeverity;
  reason: string;
  entityType: 'task' | 'email';
  entityId: string;
  entityTitle: string;
  signals: Record<string, unknown>;
}

export interface DetectInput {
  tasks: TaskRecord[];
  activity: ActivityRow[];
  now?: Date;
  thresholds?: typeof DEFAULT_THRESHOLDS;
}

// ============================================================================
// Date helpers
// ============================================================================

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now.getTime() - t) / (24 * 3600 * 1000));
}

function daysBetween(aIso: string, bIso: string): number | null {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round(Math.abs(a - b) / (24 * 3600 * 1000));
}

function parseYmd(ymd: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - due.getTime()) / (24 * 3600 * 1000)); // positive = overdue
}

// ============================================================================
// Rules
// ============================================================================

/** Waiting tasks with no recent update. */
function detectStalledWaiting(
  tasks: TaskRecord[],
  activityByTaskId: Map<string, ActivityRow[]>,
  now: Date,
  t: typeof DEFAULT_THRESHOLDS,
): RiskItem[] {
  const out: RiskItem[] = [];
  for (const task of tasks) {
    if (task.status !== 'Waiting') continue;
    // Prefer last activity event over Airtable lastModified (which flips on
    // trivial edits like notes). Fall back to lastModified if no events.
    const events = activityByTaskId.get(task.id) || [];
    const latestEventIso = events.length ? events[events.length - 1].timestamp : null;
    const sinceLastMotion = daysSince(latestEventIso || task.lastModified, now);
    if (sinceLastMotion === null || sinceLastMotion < t.stalledWaitingDays) continue;
    const severity: RiskSeverity =
      sinceLastMotion >= t.stalledWaitingDays * 3
        ? 'high'
        : sinceLastMotion >= t.stalledWaitingDays * 2
          ? 'medium'
          : 'low';
    out.push({
      kind: 'stalled.waiting',
      severity,
      reason: `Waiting ${sinceLastMotion} days with no update — ping the blocker?`,
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      signals: {
        daysSinceMotion: sinceLastMotion,
        from: task.from,
        project: task.project,
        due: task.due,
      },
    });
  }
  return out;
}

/** Inbox items never triaged. */
function detectStalledInbox(
  tasks: TaskRecord[],
  activityByTaskId: Map<string, ActivityRow[]>,
  now: Date,
  t: typeof DEFAULT_THRESHOLDS,
): RiskItem[] {
  const out: RiskItem[] = [];
  for (const task of tasks) {
    if (task.status !== 'Inbox') continue;
    const age = daysSince(task.createdAt, now);
    if (age === null || age < t.stalledInboxDays) continue;
    const events = activityByTaskId.get(task.id) || [];
    // Only count meaningful events — ignore the task.created event itself
    const userEvents = events.filter(e => e.action !== 'task.created');
    if (userEvents.length > 0) continue;
    const severity: RiskSeverity =
      age >= t.stalledInboxDays * 3 ? 'high' : age >= t.stalledInboxDays * 2 ? 'medium' : 'low';
    out.push({
      kind: 'stalled.inbox',
      severity,
      reason: `In Inbox ${age} days, never triaged — decide or delete.`,
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      signals: { daysInInbox: age, priority: task.priority, from: task.from },
    });
  }
  return out;
}

/** Overdue by threshold + no recent activity. */
function detectStalledOverdue(
  tasks: TaskRecord[],
  activityByTaskId: Map<string, ActivityRow[]>,
  now: Date,
  t: typeof DEFAULT_THRESHOLDS,
): RiskItem[] {
  const out: RiskItem[] = [];
  for (const task of tasks) {
    if (!task.due) continue;
    if (task.status === 'Waiting') continue; // covered by stalled.waiting
    const overdueBy = parseYmd(task.due, now);
    if (overdueBy === null || overdueBy < t.stalledOverdueDays) continue;

    const events = activityByTaskId.get(task.id) || [];
    const latestIso = events.length ? events[events.length - 1].timestamp : task.lastModified;
    const sinceMotion = daysSince(latestIso, now);
    if (sinceMotion !== null && sinceMotion < 3) continue; // actively in motion; don't alarm

    const severity: RiskSeverity =
      overdueBy >= t.stalledOverdueDays * 3
        ? 'high'
        : overdueBy >= t.stalledOverdueDays * 2
          ? 'medium'
          : 'low';
    out.push({
      kind: 'stalled.overdue',
      severity,
      reason: `Overdue ${overdueBy} days, last motion ${sinceMotion ?? '?'} days ago — reschedule or do now.`,
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      signals: {
        overdueBy,
        daysSinceMotion: sinceMotion,
        priority: task.priority,
        status: task.status,
      },
    });
  }
  return out;
}

/**
 * Drafts created that were never sent. Heuristic over the Activity Log:
 * find `email.draft-created` events, check that:
 *   - No matching `email.replied` / `email.sent` event later for the same thread
 *   - If metadata.threadId matches a Tasks row's threadUrl, the task isn't Done
 *
 * If we don't have a related task, we still flag the draft.
 */
function detectDriftDraftUnsent(
  activity: ActivityRow[],
  tasks: TaskRecord[],
  now: Date,
  t: typeof DEFAULT_THRESHOLDS,
): RiskItem[] {
  const out: RiskItem[] = [];

  // Map thread id → Tasks row (so we can check completion).
  const taskByThreadId = new Map<string, TaskRecord>();
  for (const task of tasks) {
    if (!task.threadUrl) continue;
    const m = /#inbox\/([a-zA-Z0-9]+)/.exec(task.threadUrl);
    if (m) taskByThreadId.set(m[1], task);
  }

  // Build sets of thread ids that have a later reply/sent marker.
  const resolvedThreads = new Set<string>();
  for (const ev of activity) {
    if (ev.action === 'email.replied' || ev.action === 'email.sent') {
      const tid =
        (ev.metadata?.threadId as string | undefined) || ev.entityId || undefined;
      if (tid) resolvedThreads.add(tid);
    }
  }

  for (const ev of activity) {
    if (ev.action !== 'email.draft-created') continue;
    const draftAge = daysSince(ev.timestamp, now);
    if (draftAge === null || draftAge < t.driftDraftUnsentDays) continue;

    const threadId =
      (ev.metadata?.threadId as string | undefined) || ev.entityId || '';
    if (threadId && resolvedThreads.has(threadId)) continue; // reply happened

    const relatedTask = threadId ? taskByThreadId.get(threadId) : undefined;
    if (relatedTask && (relatedTask.status === 'Done' || relatedTask.status === 'Archive')) {
      continue; // task closed out even without a logged reply
    }

    const severity: RiskSeverity =
      draftAge >= t.driftDraftUnsentDays * 3
        ? 'high'
        : draftAge >= t.driftDraftUnsentDays * 2
          ? 'medium'
          : 'low';
    out.push({
      kind: 'drift.draft-unsent',
      severity,
      reason: `Draft created ${draftAge} days ago, never sent — review and send or delete.`,
      entityType: 'email',
      entityId: threadId || ev.entityId || ev.id,
      entityTitle: ev.entityTitle || (relatedTask ? relatedTask.task : '(untitled draft)'),
      signals: {
        draftAgeDays: draftAge,
        threadId,
        relatedTaskId: relatedTask?.id,
        relatedTaskStatus: relatedTask?.status,
        draftMetadata: ev.metadata,
      },
    });
  }
  return out;
}

/** Tasks whose status has flipped many times in a short window. */
function detectThrashStatus(
  tasks: TaskRecord[],
  activityByTaskId: Map<string, ActivityRow[]>,
  now: Date,
  t: typeof DEFAULT_THRESHOLDS,
): RiskItem[] {
  const out: RiskItem[] = [];
  const windowCutoff = now.getTime() - t.thrashWindowDays * 24 * 3600 * 1000;
  for (const task of tasks) {
    const events = activityByTaskId.get(task.id) || [];
    const flips = events.filter(e => {
      if (e.action !== 'task.status-changed' && e.action !== 'task.completed') return false;
      const tms = Date.parse(e.timestamp);
      return !Number.isNaN(tms) && tms >= windowCutoff;
    });
    if (flips.length < t.thrashStatusChangeCount) continue;
    const severity: RiskSeverity =
      flips.length >= t.thrashStatusChangeCount * 2 ? 'high' : 'medium';
    out.push({
      kind: 'thrash.status',
      severity,
      reason: `Status flipped ${flips.length}× in ${t.thrashWindowDays} days — pick a lane.`,
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.task,
      signals: {
        flipsInWindow: flips.length,
        windowDays: t.thrashWindowDays,
        currentStatus: task.status,
      },
    });
  }
  return out;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run all detectors and return a deduplicated, severity-sorted list of risks.
 *
 * Dedup: at most one risk per (entityId, kind). We don't hide duplicates
 * across kinds — a task can legitimately be both 'stalled.overdue' and
 * 'thrash.status' at the same time, and both are useful to see.
 */
export function detectRisks(input: DetectInput): RiskItem[] {
  const now = input.now ?? new Date();
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;

  // Group activity by task id (sorted asc by timestamp for easy "latest" reads).
  const byTaskId = new Map<string, ActivityRow[]>();
  const sorted = [...input.activity].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  for (const ev of sorted) {
    if (!ev.entityId) continue;
    if (ev.entityType !== 'task') continue;
    const list = byTaskId.get(ev.entityId);
    if (list) list.push(ev);
    else byTaskId.set(ev.entityId, [ev]);
  }

  const liveTasks = input.tasks.filter(
    task => task.status !== 'Done' && task.status !== 'Archive' && !task.done,
  );

  const risks: RiskItem[] = [
    ...detectStalledWaiting(liveTasks, byTaskId, now, t),
    ...detectStalledInbox(liveTasks, byTaskId, now, t),
    ...detectStalledOverdue(liveTasks, byTaskId, now, t),
    ...detectDriftDraftUnsent(input.activity, input.tasks, now, t),
    ...detectThrashStatus(liveTasks, byTaskId, now, t),
  ];

  // Dedup on (entityId, kind) keeping the highest severity.
  const severityRank: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2 };
  const best = new Map<string, RiskItem>();
  for (const r of risks) {
    const key = `${r.entityId}::${r.kind}`;
    const prev = best.get(key);
    if (!prev || severityRank[r.severity] > severityRank[prev.severity]) {
      best.set(key, r);
    }
  }

  return Array.from(best.values()).sort((a, b) => {
    if (severityRank[b.severity] !== severityRank[a.severity]) {
      return severityRank[b.severity] - severityRank[a.severity];
    }
    return a.entityTitle.localeCompare(b.entityTitle);
  });
}

// Exposed for tests / future tooling.
export const _internal = { daysSince, daysBetween, parseYmd };
