// app/api/os/companies/[companyId]/status/route.ts
// Company Status API endpoint for Overview page header
//
// Returns computed status: performance, work, next best action

import { NextResponse } from 'next/server';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { isStrategyReady } from '@/lib/contextGraph/readiness/strategyReady';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getPerformancePulse } from '@/lib/os/analytics/performancePulse';
import { getProjectsForCompany } from '@/lib/os/projects';
import {
  computeStatusHeader,
  type CompanyStatusHeader,
} from '@/lib/os/companies/companyStatus';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// In-memory cache with 60s TTL
const statusCache = new Map<string, { data: CompanyStatusHeader; expiry: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;

  console.log('[CompanyStatus] Fetching status for company:', companyId);

  // Check cache first
  const cached = statusCache.get(companyId);
  if (cached && cached.expiry > Date.now()) {
    console.log('[CompanyStatus] Returning cached status');
    return NextResponse.json({ ok: true, status: cached.data });
  }

  try {
    // Fetch all required data in parallel
    const [
      workItems,
      strategy,
      contextGraph,
      latestGapRun,
      performancePulse,
      projects,
    ] = await Promise.all([
      getWorkItemsForCompany(companyId).catch(() => []),
      getActiveStrategy(companyId).catch(() => null),
      loadContextGraph(companyId).catch(() => null),
      getLatestRunForCompanyAndTool(companyId, 'gapPlan').catch(() => null),
      getPerformancePulse(companyId).catch(() => null),
      getProjectsForCompany(companyId).catch(() => []),
    ]);

    // Compute work counts
    let inProgress = 0;
    let blocked = 0;
    let dueSoon = 0;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const item of workItems) {
      if (item.status === 'Done') continue;

      if (item.status === 'In Progress') {
        inProgress++;
      }

      // Count critical backlog items as blocked
      if (item.severity === 'Critical' && item.status === 'Backlog') {
        blocked++;
      }

      // Check due soon
      if (item.dueDate) {
        const dueDate = new Date(item.dueDate);
        if (dueDate <= sevenDaysFromNow) {
          dueSoon++;
        }
      }
    }

    const activeItems = workItems.filter((w) => w.status !== 'Done').length;
    const workCounts = { inProgress, blocked, dueSoon, total: activeItems };

    // Check context readiness
    let contextReadinessPercent: number | undefined;
    if (contextGraph) {
      const readiness = isStrategyReady(contextGraph as CompanyContextGraph);
      contextReadinessPercent = readiness.completenessPercent;
    }

    // Check strategy state
    const hasStrategy = !!strategy;
    const pillars = (strategy as any)?.pillars || [];
    const hasAcceptedBets = pillars.some((p: any) =>
      p.status === 'accepted' || p.status === 'active'
    );
    const hasTactics = pillars.some((p: any) => (p.tactics?.length || 0) > 0);

    // Check project state (draft or in_progress are "active")
    const activeProjects = projects.filter((p) =>
      p.status === 'draft' || p.status === 'in_progress'
    );
    const hasActiveProject = activeProjects.length > 0;
    const hasProjectBrief = activeProjects.some((p) => p.briefApproved);

    // Check if diagnostics have been run
    const hasDiagnostics = !!(latestGapRun && latestGapRun.status === 'complete');

    // Compute status header
    const statusHeader = computeStatusHeader({
      companyId,
      performancePulse: performancePulse ? {
        hasGa4: performancePulse.hasGa4,
        hasGsc: performancePulse.hasGsc,
        currentSessions: performancePulse.currentSessions,
        trafficChange7d: performancePulse.trafficChange7d,
        currentConversions: performancePulse.currentConversions,
        conversionsChange7d: performancePulse.conversionsChange7d,
        currentClicks: performancePulse.currentClicks,
        seoVisibilityChange7d: performancePulse.seoVisibilityChange7d,
        hasAnomalies: performancePulse.hasAnomalies,
        anomalySummary: performancePulse.anomalySummary,
      } : null,
      workCounts,
      hasDiagnostics,
      contextReadinessPercent,
      hasStrategy,
      hasAcceptedBets,
      hasTactics,
      hasActiveProject,
      hasProjectBrief,
    });

    // Cache the result
    statusCache.set(companyId, {
      data: statusHeader,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    console.log('[CompanyStatus] Status computed:', {
      companyId,
      performanceState: statusHeader.performance.state,
      workState: statusHeader.work.state,
      nextAction: statusHeader.nextAction.key,
    });

    return NextResponse.json({ ok: true, status: statusHeader });
  } catch (error) {
    console.error('[CompanyStatus] Error computing status:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to compute company status' },
      { status: 500 }
    );
  }
}
