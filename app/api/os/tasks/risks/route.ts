// app/api/os/tasks/risks/route.ts
// Risk / stall detection — answers "what is quietly going wrong?"
//
// GET /api/os/tasks/risks
//   ?window=60   (days of activity history to scan, default 60, max 180)
//
// Returns a severity-sorted list of risks: waiting-too-long tasks, stale
// inbox items, overdue-with-no-motion, orphaned drafts, thrashing status.
// Runs the pure detector in `lib/riskDetection.ts`.

import { NextRequest, NextResponse } from 'next/server';
import { getTasks } from '@/lib/airtable/tasks';
import { detectRisks } from '@/lib/riskDetection';
import {
  getRecentTaskActivity,
  getRecentActivityByTypes,
  logEventAsync,
  type ActivityRow,
} from '@/lib/airtable/activityLog';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DEFAULT_WINDOW_DAYS = 60;
const MAX_WINDOW_DAYS = 180;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawWindow = Number(searchParams.get('window'));
    const windowDays =
      Number.isFinite(rawWindow) && rawWindow > 0
        ? Math.min(Math.floor(rawWindow), MAX_WINDOW_DAYS)
        : DEFAULT_WINDOW_DAYS;

    const now = new Date();
    const sinceIso = new Date(now.getTime() - windowDays * 24 * 3600 * 1000).toISOString();

    const tasks = await getTasks({ excludeDone: false });
    // Only consider live tasks for id-scoped activity (drafts + thrash are global).
    const liveTaskIds = tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Archive' && !t.done)
      .map(t => t.id);

    // Two parallel reads:
    //   1. Task events for live task ids (engagement + status flips)
    //   2. Email events globally (to catch orphaned drafts)
    const [taskActivity, emailActivity]: [ActivityRow[], ActivityRow[]] = await Promise.all([
      getRecentTaskActivity({ sinceIso, taskIds: liveTaskIds, maxRows: 2000 }),
      getRecentActivityByTypes({
        sinceIso,
        entityTypes: ['email'],
        maxRows: 500,
      }),
    ]);

    const activity: ActivityRow[] = [...taskActivity, ...emailActivity];

    const risks = detectRisks({ tasks, activity, now });

    logEventAsync({
      actorType: 'system',
      actor: 'risk-detector',
      action: 'risks.scan-run',
      entityType: 'other',
      summary: `Risk scan: ${risks.length} risk(s) across ${tasks.length} tasks (${windowDays}d window)`,
      metadata: {
        windowDays,
        totalTasks: tasks.length,
        liveTaskCount: liveTaskIds.length,
        taskEventsConsidered: taskActivity.length,
        emailEventsConsidered: emailActivity.length,
        risksByKind: risks.reduce<Record<string, number>>((m, r) => {
          m[r.kind] = (m[r.kind] || 0) + 1;
          return m;
        }, {}),
        risksBySeverity: risks.reduce<Record<string, number>>((m, r) => {
          m[r.severity] = (m[r.severity] || 0) + 1;
          return m;
        }, {}),
      },
      source: 'app/api/os/tasks/risks',
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      windowDays,
      totalTasks: tasks.length,
      liveTaskCount: liveTaskIds.length,
      risks,
    });
  } catch (err) {
    console.error('[api/os/tasks/risks] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute risks' },
      { status: 500 },
    );
  }
}
