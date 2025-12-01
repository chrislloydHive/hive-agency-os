// app/api/os/companies/[companyId]/activity/route.ts
// Company Activity Timeline API
//
// Aggregates activity events from multiple sources into a unified timeline

import { NextResponse } from 'next/server';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { getExperiments } from '@/lib/airtable/experiments';
import { listDiagnosticRunsForCompany, getToolLabel } from '@/lib/os/diagnostics/runs';

interface ActivityEvent {
  id: string;
  type: 'work_item' | 'experiment' | 'diagnostic' | 'report' | 'insight';
  title: string;
  description?: string;
  timestamp: string;
  status?: string;
  meta?: Record<string, unknown>;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  console.log('[CompanyActivity] Fetching activity for company:', companyId);

  try {
    // Fetch data from multiple sources in parallel
    const [workItems, experiments, diagnosticRuns] = await Promise.all([
      getWorkItemsForCompany(companyId),
      getExperiments({ companyId, limit: 50 }),
      listDiagnosticRunsForCompany(companyId, { limit: 50 }),
    ]);

    const events: ActivityEvent[] = [];

    // Add work item events
    for (const item of workItems) {
      // Created event
      if (item.createdAt) {
        events.push({
          id: `work-created-${item.id}`,
          type: 'work_item',
          title: `Work item created: ${item.title}`,
          description: item.notes?.slice(0, 100),
          timestamp: item.createdAt,
          status: item.status,
          meta: { itemId: item.id, area: item.area },
        });
      }

      // Status change to Done
      if (item.status === 'Done' && item.updatedAt) {
        events.push({
          id: `work-done-${item.id}`,
          type: 'work_item',
          title: `Work item completed: ${item.title}`,
          timestamp: item.updatedAt,
          status: 'Done',
          meta: { itemId: item.id, area: item.area },
        });
      }
    }

    // Add experiment events
    for (const exp of experiments) {
      if (exp.createdAt) {
        events.push({
          id: `exp-created-${exp.id}`,
          type: 'experiment',
          title: `Experiment added: ${exp.name}`,
          description: exp.hypothesis?.slice(0, 100),
          timestamp: exp.createdAt,
          status: exp.status,
          meta: { experimentId: exp.id, area: exp.area },
        });
      }

      // Status changes
      if (exp.status === 'Running' && exp.startDate) {
        events.push({
          id: `exp-started-${exp.id}`,
          type: 'experiment',
          title: `Experiment started: ${exp.name}`,
          timestamp: exp.startDate,
          status: 'Running',
          meta: { experimentId: exp.id },
        });
      }

      if (exp.status === 'Concluded' && exp.endDate) {
        events.push({
          id: `exp-concluded-${exp.id}`,
          type: 'experiment',
          title: `Experiment concluded: ${exp.name} (${exp.outcome || 'No outcome'})`,
          description: exp.learnings?.slice(0, 100),
          timestamp: exp.endDate,
          status: 'Concluded',
          meta: { experimentId: exp.id, outcome: exp.outcome },
        });
      }
    }

    // Add diagnostic run events
    for (const run of diagnosticRuns) {
      if (run.createdAt) {
        events.push({
          id: `diag-${run.id}`,
          type: 'diagnostic',
          title: `Diagnostic run: ${getToolLabel(run.toolId)}`,
          description: run.status === 'complete' ? 'Completed successfully' : `Status: ${run.status}`,
          timestamp: run.createdAt,
          status: run.status,
          meta: { runId: run.id, toolId: run.toolId },
        });
      }
    }

    // Sort by timestamp (newest first) and limit
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedEvents = events.slice(0, limit);

    console.log('[CompanyActivity] Found', events.length, 'events, returning', limitedEvents.length);

    return NextResponse.json({
      ok: true,
      events: limitedEvents,
      total: events.length,
    });
  } catch (error) {
    console.error('[CompanyActivity] Error fetching activity:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
