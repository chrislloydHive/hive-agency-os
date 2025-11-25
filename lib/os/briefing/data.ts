// lib/os/briefing/data.ts
// Data composer for Hive OS Briefing
// Pulls data from Airtable, GA4, Search Console and produces a normalized HiveOsBriefingInput

import type {
  HiveOsBriefingInput,
  BriefingInputClientHealth,
  BriefingInputWorkSummary,
  BriefingInputPipelineSummary,
  BriefingInputGapSummary,
  BriefingInputGrowthAnalyticsSummary,
} from './types';
import { getDashboardSummary, type DashboardSummary } from '../dashboardSummary';
import {
  fetchSearchConsoleSnapshot,
  createDateRangeLastNDays,
} from '../searchConsole/snapshot';
import { getGscConnectionStatus } from '../searchConsole/client';

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build the complete HiveOsBriefingInput from all data sources.
 * This function aggregates data from:
 * - Companies, Work Items, Pipeline (via getDashboardSummary)
 * - GAP runs (via getDashboardSummary)
 * - GA4 traffic (via getDashboardSummary growth data)
 * - Search Console (via fetchSearchConsoleSnapshot)
 */
export async function buildHiveOsBriefingInput(): Promise<HiveOsBriefingInput> {
  console.log('[Briefing Data] Building briefing input...');

  // Fetch dashboard summary (companies, work, pipeline, GAP, GA4)
  let dashboardSummary: DashboardSummary;
  try {
    dashboardSummary = await getDashboardSummary();
  } catch (error) {
    console.error('[Briefing Data] Failed to get dashboard summary:', error);
    throw new Error('Failed to fetch dashboard data for briefing');
  }

  // Build each section with graceful error handling
  const [clientHealth, workSummary, pipelineSummary, gapSummary, growthAnalytics] =
    await Promise.all([
      buildClientHealthFromSummary(dashboardSummary),
      buildWorkSummaryFromSummary(dashboardSummary),
      buildPipelineSummaryFromSummary(dashboardSummary),
      buildGapSummaryFromSummary(dashboardSummary),
      buildGrowthAnalyticsSummary(dashboardSummary),
    ]);

  const input: HiveOsBriefingInput = {
    date: new Date().toISOString(),
    timezone: 'America/Los_Angeles', // Default timezone, could be from workspace settings
    clientHealth,
    workSummary,
    pipelineSummary,
    gapSummary,
    growthAnalytics,
  };

  console.log('[Briefing Data] Input built successfully:', {
    clients: clientHealth.clientCount,
    atRisk: clientHealth.atRiskClients.length,
    workDueToday: workSummary.dueToday,
    workOverdue: workSummary.overdue,
    gapAssessments30d: gapSummary.assessmentsLast30d,
    hasGa4: !!growthAnalytics.ga4,
    hasGsc: !!growthAnalytics.searchConsole,
  });

  return input;
}

// ============================================================================
// Section Builders
// ============================================================================

/**
 * Build client health section from dashboard summary
 */
async function buildClientHealthFromSummary(
  summary: DashboardSummary
): Promise<BriefingInputClientHealth> {
  // Count companies by stage
  // Note: We don't have direct access to all companies here,
  // so we estimate from what's available in the summary
  const atRiskClients = summary.clientHealth.atRisk.map((client) => ({
    id: client.companyId,
    name: client.name,
    stage: client.stage,
    domain: client.domain || null,
    reason: client.reason,
    lastGapDate: null, // Would need to enrich from GAP runs if needed
  }));

  const newClientsLast7d = summary.clientHealth.newClients.map((client) => ({
    id: client.companyId,
    name: client.name,
    addedAt: client.createdAt,
  }));

  // We can estimate counts from the summary
  // Client count = those marked as "Client" stage (approximated from at-risk + new)
  // This is a rough estimate - ideally we'd have direct counts
  const clientCount = atRiskClients.length + newClientsLast7d.length;

  return {
    totalCompanies: summary.companiesCount,
    clientCount: Math.max(clientCount, 0),
    prospectCount: Math.max(summary.companiesCount - clientCount, 0),
    atRiskClients,
    newClientsLast7d,
  };
}

/**
 * Build work summary section from dashboard summary
 */
async function buildWorkSummaryFromSummary(
  summary: DashboardSummary
): Promise<BriefingInputWorkSummary> {
  const backlogItems = summary.work.items.map((item) => ({
    id: item.id,
    companyId: item.companyId || null,
    companyName: item.companyName || null,
    title: item.title,
    status: item.status,
    area: null, // Not available in dashboard summary
    dueDate: item.dueDate || null,
  }));

  return {
    totalActive: summary.work.items.length,
    dueToday: summary.work.today,
    overdue: summary.work.overdue,
    mineToday: summary.work.mineToday,
    backlogItems,
  };
}

/**
 * Build pipeline summary section from dashboard summary
 */
async function buildPipelineSummaryFromSummary(
  summary: DashboardSummary
): Promise<BriefingInputPipelineSummary> {
  return {
    newLeadsLast30d: summary.pipeline.newLeads30d,
    activeOpportunities: summary.pipeline.activeOpportunities,
    recentLeads: [], // Not directly available in dashboard summary
  };
}

/**
 * Build GAP summary section from dashboard summary
 */
async function buildGapSummaryFromSummary(
  summary: DashboardSummary
): Promise<BriefingInputGapSummary> {
  const recentAssessments = summary.recentGap.assessments
    .slice(0, 5)
    .map((assessment) => ({
      companyName: assessment.companyName || assessment.domain || 'Unknown',
      createdAt: assessment.createdAt,
    }));

  const recentPlans = summary.recentGap.plans.slice(0, 5).map((plan) => ({
    companyName: plan.companyName || 'Unknown',
    createdAt: plan.createdAt,
  }));

  return {
    assessmentsLast30d: summary.gapAssessments30d,
    plansLast30d: summary.gapPlans30d,
    recentAssessments,
    recentPlans,
  };
}

/**
 * Build growth analytics summary from dashboard summary + Search Console
 */
async function buildGrowthAnalyticsSummary(
  summary: DashboardSummary
): Promise<BriefingInputGrowthAnalyticsSummary> {
  const result: BriefingInputGrowthAnalyticsSummary = {};

  // GA4 data from dashboard summary
  if (summary.growth) {
    result.ga4 = {
      sessions30d: summary.growth.sessions30d,
      users30d: summary.growth.users30d,
      dmaAudits30d: summary.growth.dmaAuditsStarted30d,
      searchClicks30d: summary.growth.searchClicks30d,
      trendLabel: buildTrendLabel(summary.growth),
    };
  }

  // Fetch Search Console data separately
  try {
    const gscStatus = await getGscConnectionStatus();
    if (gscStatus.connected && gscStatus.siteUrl) {
      const range = createDateRangeLastNDays(30);
      const snapshot = await fetchSearchConsoleSnapshot({
        siteUrl: gscStatus.siteUrl,
        range,
        maxRows: 10,
      });

      result.searchConsole = {
        clicks: snapshot.summary.clicks,
        impressions: snapshot.summary.impressions,
        ctr: snapshot.summary.ctr,
        avgPosition: snapshot.summary.avgPosition,
        notableQueries: snapshot.topQueries.slice(0, 5).map((q) => ({
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          avgPosition: q.avgPosition,
        })),
        notablePages: snapshot.topPages.slice(0, 5).map((p) => ({
          url: p.url,
          clicks: p.clicks,
          impressions: p.impressions,
          ctr: p.ctr,
          avgPosition: p.avgPosition,
        })),
      };

      console.log('[Briefing Data] Search Console data fetched:', {
        clicks: snapshot.summary.clicks,
        impressions: snapshot.summary.impressions,
      });
    } else {
      console.log('[Briefing Data] Search Console not connected, skipping');
    }
  } catch (error) {
    console.warn('[Briefing Data] Failed to fetch Search Console data:', error);
    // Continue without GSC data - it's optional
  }

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a trend label from growth data
 */
function buildTrendLabel(growth: DashboardSummary['growth']): string | undefined {
  // We don't have comparison data in the current summary,
  // so just describe what we have
  if (growth.sessions30d) {
    return `${growth.sessions30d.toLocaleString()} sessions in the last 30 days`;
  }
  return undefined;
}
