/**
 * Gmail thread dedupe for triage: open tasks block the thread; a task created in
 * the last 24h on the same thread blocks duplicate auto-creates (sync spam).
 * Historical Done/Archive tasks alone do NOT block — a new client reply can
 * surface a new triage item.
 */

import type { TaskRecord } from '@/lib/airtable/tasks';

const RECENT_TASK_MS = 24 * 60 * 60 * 1000;

/** Extract Gmail thread id from a standard Gmail web URL (inbox or search). */
export function parseGmailThreadIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[#/]([0-9a-f]{10,})(?:[?&/#]|$)/i);
  return m ? m[1] : null;
}

export interface TriageThreadDedup {
  /** Thread has an open task (Inbox/Next/Waiting — not Done/Archive). */
  activeThreadIds: Set<string>;
  /** A task was created on this thread in the last 24h (any status). */
  recentCreatedThreadIds: Set<string>;
}

export function buildTriageThreadDedupFromTasks(
  tasks: TaskRecord[],
  nowMs: number = Date.now(),
  recentWindowMs: number = RECENT_TASK_MS,
): TriageThreadDedup {
  const activeThreadIds = new Set<string>();
  const recentCreatedThreadIds = new Set<string>();

  for (const t of tasks) {
    const tid = parseGmailThreadIdFromUrl(t.threadUrl);
    if (!tid) continue;

    const isOpen = !t.done && t.status !== 'Done' && t.status !== 'Archive';
    if (isOpen) activeThreadIds.add(tid);

    const createdMs = t.createdAt ? Date.parse(t.createdAt) : 0;
    if (createdMs && nowMs - createdMs < recentWindowMs) {
      recentCreatedThreadIds.add(tid);
    }
  }

  return { activeThreadIds, recentCreatedThreadIds };
}

/** True if triage should treat the thread as "already has a task row" for dedup. */
export function triageThreadIsDeduped(threadId: string, dedup: TriageThreadDedup): boolean {
  return dedup.activeThreadIds.has(threadId) || dedup.recentCreatedThreadIds.has(threadId);
}
