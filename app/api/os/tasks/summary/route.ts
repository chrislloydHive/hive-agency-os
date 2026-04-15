// app/api/os/tasks/summary/route.ts
// Daily Summary API — 100% Task-backed.
// Source of truth: Airtable Tasks table ONLY.
// Calendar / Gmail / Drive context now lives in the Command Center; this
// endpoint intentionally returns NO Google data.
//
// Query params:
//   ?companyId=xxx  — accepted but unused (kept for client compat)

import { NextRequest, NextResponse } from 'next/server';
import { getTasks } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/os/tasks/summary?companyId=xxx
 * Returns { overdue, hot, dueToday, webLeads, arAging, counts }
 */
export async function GET(_request: NextRequest) {
  try {
    // ── Tasks from Airtable ─────────────────────────────────────────────
    const tasks = await getTasks({ excludeDone: true });
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const overdue: typeof tasks = [];
    const hot: typeof tasks = [];
    const dueToday: typeof tasks = [];

    for (const t of tasks) {
      const isP0 = t.priority === 'P0';
      let dueDate: Date | null = null;
      if (t.due) {
        const parsed = new Date(t.due);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        } else {
          const withYear = new Date(`${t.due}, ${now.getFullYear()}`);
          if (!isNaN(withYear.getTime())) dueDate = withYear;
        }
      }
      const dueDateStr = dueDate ? dueDate.toISOString().slice(0, 10) : null;
      const isPastDue = dueDate && dueDateStr && dueDateStr < todayStr;
      const isDueToday = dueDateStr === todayStr;

      if (isPastDue) overdue.push(t);
      if (isP0) hot.push(t);
      if (isDueToday) dueToday.push(t);
    }

    // ── Web Leads (Website Submissions project) ──────────────────────────
    const webLeads = tasks.filter(t => t.project === 'Website Submissions');

    // ── A/R Aging (only tasks created by the QuickBooks aging report) ───
    const arAging = tasks.filter(t => t.from === 'QuickBooks Aging Report');

    // Deduplicate: remove Web Leads and A/R items from Overdue/Hot/Due Today
    const specialIds = new Set([
      ...webLeads.map(t => t.id),
      ...arAging.map(t => t.id),
    ]);
    const filteredOverdue = overdue.filter(t => !specialIds.has(t.id));
    const filteredHot = hot.filter(t => !specialIds.has(t.id));
    const filteredDueToday = dueToday.filter(t => !specialIds.has(t.id));

    return NextResponse.json({
      overdue: filteredOverdue,
      hot: filteredHot,
      dueToday: filteredDueToday,
      webLeads,
      arAging,
      counts: {
        overdue: filteredOverdue.length,
        hot: filteredHot.length,
        dueToday: filteredDueToday.length,
        totalOpen: tasks.length,
        webLeads: webLeads.length,
        arAging: arAging.length,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Tasks Summary API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 },
    );
  }
}
