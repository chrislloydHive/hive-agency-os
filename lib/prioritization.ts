/**
 * Prioritization brain — "What should I work on right now?"
 * ------------------------------------------------------------
 * Pure scoring function for Airtable Tasks. Given a task plus optional
 * activity signals (from the Activity Log), returns a score and a breakdown
 * of reasons so the ranking is transparent and debuggable.
 *
 * Design choices:
 *   1. Keep this module pure (no I/O). Callers supply the inputs; this
 *      module just does math. Easy to unit test.
 *   2. Every contribution to the score is a named reason. When Chris asks
 *      "why is this ranked #1?", we can answer with specifics.
 *   3. Scoring is additive, not multiplicative. A task can't be zeroed out
 *      by one missing signal. Overdue P0 still beats "Chris opened it once"
 *      even if the latter has no due date.
 *   4. Tunable via `DEFAULT_WEIGHTS` export — future: per-user overrides.
 *
 * Signal inputs (all optional, all graceful):
 *   - priority, due (from the task itself)
 *   - status (Inbox / Next / Waiting; Done+Archive are excluded upstream)
 *   - age in days since createdAt
 *   - engagement: recent opens, updates, dismissals from Activity Log
 */

import type { TaskRecord } from './airtable/tasks';

// ============================================================================
// Types
// ============================================================================

export interface ActivitySignals {
  /** Count of `task.opened-in-ui` events in the last 7 days. */
  opensLast7d: number;
  /** Count of `task.updated` events (any kind) in the last 7 days. */
  updatesLast7d: number;
  /** Count of `task.dismissed-from-triage` events in the last 14 days. */
  dismissalsLast14d: number;
  /** ISO timestamp of last activity of any kind (for staleness). */
  lastActivityAt?: string;
}

export interface ScoreReason {
  /** Short machine tag: 'priority.P0', 'due.overdue', etc. */
  tag: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Signed contribution to the total. */
  points: number;
}

export interface FocusScore {
  score: number;
  reasons: ScoreReason[];
}

// ============================================================================
// Weights (tunable)
// ============================================================================

export const DEFAULT_WEIGHTS = {
  priority: { P0: 100, P1: 60, P2: 30, P3: 10 },
  due: {
    overdueBase: 80,
    overduePerDay: 5, // additional per day overdue
    overdueCap: 40,   // cap on the per-day add-on
    today: 60,
    tomorrow: 40,
    thisWeek: 20,
    nextWeek: 5,
    later: 0,
  },
  status: { Next: 20, Inbox: 10, Waiting: -10 },
  age: {
    // Days since creation. Nudge tasks that have been sitting.
    d4to7: 5,
    d8to14: 10,
    d15plus: 15,
  },
  engagement: {
    perOpen: 5,
    opensCap: 15,
    perDismissal: -15,
    dismissalsFloor: -30, // most negative contribution allowed from dismissals
  },
} as const;

// ============================================================================
// Date math helpers (local-time midnight for "days until due")
// ============================================================================

/** Days from `today` (midnight local) to `due` (midnight local). Negative = overdue. */
function daysUntil(dueYmd: string, now: Date): number {
  // Parse YYYY-MM-DD as a local-midnight Date so we don't get a UTC day-shift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueYmd);
  if (!m) return Number.POSITIVE_INFINITY;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now.getTime() - t) / (24 * 3600 * 1000));
}

// ============================================================================
// Component scorers — each returns a (possibly empty) list of reasons.
// ============================================================================

function scorePriority(task: TaskRecord, w = DEFAULT_WEIGHTS): ScoreReason[] {
  if (!task.priority) return [];
  const pts = w.priority[task.priority as keyof typeof w.priority] ?? 0;
  if (!pts) return [];
  return [{ tag: `priority.${task.priority}`, label: `${task.priority}`, points: pts }];
}

function scoreDue(task: TaskRecord, now: Date, w = DEFAULT_WEIGHTS): ScoreReason[] {
  if (!task.due) return [];
  const d = daysUntil(task.due, now);
  if (d === Number.POSITIVE_INFINITY) return [];

  if (d < 0) {
    const overdueBy = Math.abs(d);
    const perDay = Math.min(overdueBy * w.due.overduePerDay, w.due.overdueCap);
    return [
      {
        tag: 'due.overdue',
        label: `Overdue ${overdueBy} day${overdueBy === 1 ? '' : 's'}`,
        points: w.due.overdueBase + perDay,
      },
    ];
  }
  if (d === 0) return [{ tag: 'due.today', label: 'Due today', points: w.due.today }];
  if (d === 1) return [{ tag: 'due.tomorrow', label: 'Due tomorrow', points: w.due.tomorrow }];
  if (d <= 7) return [{ tag: 'due.thisWeek', label: `Due in ${d} days`, points: w.due.thisWeek }];
  if (d <= 14) return [{ tag: 'due.nextWeek', label: `Due in ${d} days`, points: w.due.nextWeek }];
  return [{ tag: 'due.later', label: `Due in ${d} days`, points: w.due.later }];
}

function scoreStatus(task: TaskRecord, w = DEFAULT_WEIGHTS): ScoreReason[] {
  const raw = w.status[task.status as keyof typeof w.status];
  // Widen through `number` so an unknown status (undefined) and a potential
  // zero-weight future status both short-circuit cleanly.
  const pts: number = typeof raw === 'number' ? raw : 0;
  if (!pts) return [];
  return [{ tag: `status.${task.status}`, label: `Status: ${task.status}`, points: pts }];
}

function scoreAge(task: TaskRecord, now: Date, w = DEFAULT_WEIGHTS): ScoreReason[] {
  const age = daysSince(task.createdAt, now);
  if (age === null) return [];
  if (age >= 15) return [{ tag: 'age.d15plus', label: `Sitting ${age} days`, points: w.age.d15plus }];
  if (age >= 8) return [{ tag: 'age.d8to14', label: `Sitting ${age} days`, points: w.age.d8to14 }];
  if (age >= 4) return [{ tag: 'age.d4to7', label: `Sitting ${age} days`, points: w.age.d4to7 }];
  return [];
}

function scoreEngagement(signals: ActivitySignals | undefined, w = DEFAULT_WEIGHTS): ScoreReason[] {
  if (!signals) return [];
  const out: ScoreReason[] = [];
  if (signals.opensLast7d > 0) {
    const pts = Math.min(signals.opensLast7d * w.engagement.perOpen, w.engagement.opensCap);
    out.push({
      tag: 'engagement.opens',
      label: `Opened ${signals.opensLast7d}× recently`,
      points: pts,
    });
  }
  if (signals.dismissalsLast14d > 0) {
    // Capped at the floor to avoid aggressive burial.
    const raw = signals.dismissalsLast14d * w.engagement.perDismissal;
    const pts = Math.max(raw, w.engagement.dismissalsFloor);
    out.push({
      tag: 'engagement.dismissals',
      label: `Dismissed ${signals.dismissalsLast14d}× in last 2 weeks`,
      points: pts,
    });
  }
  return out;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute the focus score for a single task with optional activity signals.
 * Pure — no I/O. Safe to call in a tight loop.
 */
export function scoreTask(
  task: TaskRecord,
  signals?: ActivitySignals,
  now: Date = new Date(),
  weights = DEFAULT_WEIGHTS,
): FocusScore {
  const reasons: ScoreReason[] = [
    ...scorePriority(task, weights),
    ...scoreDue(task, now, weights),
    ...scoreStatus(task, weights),
    ...scoreAge(task, now, weights),
    ...scoreEngagement(signals, weights),
  ];
  const score = reasons.reduce((sum, r) => sum + r.points, 0);
  return { score, reasons };
}

/**
 * Rank a collection of tasks.
 *
 * Excludes Done/Archive upstream of this call (scoring assumes live tasks).
 * Returned list is sorted by score desc, with ties broken by overdueness
 * (more overdue first) and finally createdAt (older first).
 */
export function rankTasks(
  tasks: TaskRecord[],
  signalsByTaskId?: Record<string, ActivitySignals | undefined>,
  now: Date = new Date(),
  weights = DEFAULT_WEIGHTS,
): Array<{ task: TaskRecord; score: number; reasons: ScoreReason[] }> {
  const ranked = tasks
    .filter(t => t.status !== 'Done' && t.status !== 'Archive' && !t.done)
    .map(t => {
      const sig = signalsByTaskId?.[t.id];
      const { score, reasons } = scoreTask(t, sig, now, weights);
      return { task: t, score, reasons };
    });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: more overdue first.
    const aDue = a.task.due ? daysUntil(a.task.due, now) : Number.POSITIVE_INFINITY;
    const bDue = b.task.due ? daysUntil(b.task.due, now) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    // Final tie-break: older createdAt first (it's been waiting longer).
    const at = a.task.createdAt ? Date.parse(a.task.createdAt) : Number.POSITIVE_INFINITY;
    const bt = b.task.createdAt ? Date.parse(b.task.createdAt) : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return ranked;
}
