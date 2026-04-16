// app/api/os/tasks/focus/route.ts
// The prioritization brain — answers "what should I work on right now?"
//
// GET /api/os/tasks/focus
//   ?limit=N   (default 10, max 50)
//
// Returns a ranked list of live tasks (Done + Archive excluded), each with
// its score and a breakdown of reasons. Reads engagement signals from the
// Activity Log when available; gracefully degrades if not.
//
// Also emits a `focus.viewed` event so we can see how often Chris actually
// pulls this list (closing the feedback loop on Phase 2).

import { NextRequest, NextResponse } from 'next/server';
import { getTasks } from '@/lib/airtable/tasks';
import { rankTasks, type ActivitySignals } from '@/lib/prioritization';
import { getRecentTaskActivity, logEventAsync, type ActivityRow } from '@/lib/airtable/activityLog';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/** Build per-task signals from a flat list of Activity Log rows. */
function aggregateSignals(rows: ActivityRow[], now: Date): Record<string, ActivitySignals> {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const fourteenDaysAgo = now.getTime() - 14 * 24 * 3600 * 1000;

  const byTask: Record<string, ActivitySignals> = {};
  for (const row of rows) {
    if (!row.entityId) continue;
    const t = Date.parse(row.timestamp);
    if (Number.isNaN(t)) continue;

    const sig =
      byTask[row.entityId] ||
      (byTask[row.entityId] = {
        opensLast7d: 0,
        updatesLast7d: 0,
        dismissalsLast14d: 0,
        lastActivityAt: undefined,
      });

    // Track last activity regardless of window.
    if (!sig.lastActivityAt || Date.parse(sig.lastActivityAt) < t) {
      sig.lastActivityAt = row.timestamp;
    }

    if (t >= sevenDaysAgo) {
      if (row.action === 'task.opened-in-ui') sig.opensLast7d += 1;
      else if (row.action.startsWith('task.updated') || row.action === 'task.status-changed')
        sig.updatesLast7d += 1;
    }
    if (t >= fourteenDaysAgo && row.action === 'task.dismissed-from-triage') {
      sig.dismissalsLast14d += 1;
    }
  }
  return byTask;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Pull live tasks. Keep Waiting rows — the scorer penalizes them but they
    // should still be visible so Chris can see what's blocked.
    const all = await getTasks({ excludeDone: true });

    // Pull engagement signals from the last 14 days. Graceful if the Activity
    // Log base isn't configured — getRecentTaskActivity never throws.
    const now = new Date();
    const sinceIso = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();
    const rows = await getRecentTaskActivity({
      sinceIso,
      taskIds: all.map(t => t.id),
    });
    const signals = aggregateSignals(rows, now);

    const ranked = rankTasks(all, signals, now);
    const top = ranked.slice(0, limit).map(r => ({
      id: r.task.id,
      title: r.task.task,
      priority: r.task.priority,
      due: r.task.due,
      status: r.task.status,
      project: r.task.project,
      from: r.task.from,
      nextAction: r.task.nextAction,
      threadUrl: r.task.threadUrl,
      score: r.score,
      reasons: r.reasons,
      signals: signals[r.task.id] || null,
    }));

    // Fire-and-forget: closes the engagement feedback loop.
    logEventAsync({
      actorType: 'user',
      actor: 'Chris',
      action: 'focus.viewed',
      entityType: 'other',
      summary: `Focus list viewed (${top.length} of ${ranked.length} live tasks)`,
      metadata: {
        limit,
        returned: top.length,
        liveTaskCount: ranked.length,
        eventsConsidered: rows.length,
      },
      source: 'app/api/os/tasks/focus',
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      liveTaskCount: ranked.length,
      limit,
      items: top,
    });
  } catch (err) {
    console.error('[api/os/tasks/focus] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute focus list' },
      { status: 500 },
    );
  }
}
