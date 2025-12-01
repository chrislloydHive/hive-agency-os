// lib/analytics/workspaceService.ts
// Workspace-level Analytics Service
//
// Aggregates analytics data across all companies in a workspace
// for the global OS Analytics dashboard.

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { buildCompanyAnalyticsSnapshot, presetToDateRange } from './service';
import type {
  AnalyticsDateRange,
  AnalyticsDateRangePreset,
  WorkspaceAnalyticsSummary,
} from './types';

/**
 * Build workspace-level analytics summary
 */
export async function buildWorkspaceAnalyticsSummary(
  preset: AnalyticsDateRangePreset = '30d',
  workspaceId?: string
): Promise<WorkspaceAnalyticsSummary> {
  console.log('[WorkspaceAnalytics] Building workspace summary for:', preset);

  const range = presetToDateRange(preset);

  // Get all companies
  const allCompanies = await getAllCompanies();
  console.log('[WorkspaceAnalytics] Found', allCompanies.length, 'companies');

  // Filter to companies with at least one analytics connection
  const companiesWithAnalytics = allCompanies.filter(
    (c) => c.ga4PropertyId || c.searchConsoleSiteUrl
  );

  console.log('[WorkspaceAnalytics] Companies with analytics:', companiesWithAnalytics.length);

  // Fetch snapshots for each company (in batches to avoid rate limits)
  const batchSize = 5;
  const snapshots: Array<{ company: CompanyRecord; snapshot: Awaited<ReturnType<typeof buildCompanyAnalyticsSnapshot>> | null }> = [];

  for (let i = 0; i < companiesWithAnalytics.length; i += batchSize) {
    const batch = companiesWithAnalytics.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (company) => {
        try {
          const snapshot = await buildCompanyAnalyticsSnapshot(company, preset);
          return { company, snapshot };
        } catch (error) {
          console.warn(`[WorkspaceAnalytics] Failed to fetch for ${company.name}:`, error);
          return { company, snapshot: null };
        }
      })
    );
    snapshots.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < companiesWithAnalytics.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Aggregate totals
  let totalSessions = 0;
  let totalUsers = 0;
  let totalConversions = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  // DMA funnel totals
  let totalDmaStarted = 0;
  let totalDmaCompleted = 0;
  // GAP-IA funnel totals
  let totalGapIaStarted = 0;
  let totalGapIaCompleted = 0;
  // Full GAP funnel totals
  let totalGapFullStarted = 0;
  let totalGapFullProcessingStarted = 0;
  let totalGapFullComplete = 0;
  let totalGapFullReviewCtaClicked = 0;
  let companiesWithGa4 = 0;
  let companiesWithGsc = 0;

  const companyMetrics: Array<{
    companyId: string;
    companyName: string;
    sessions: number;
    conversions: number;
    searchClicks: number;
    dmaCompletions: number;
    gapReviewCtaClicks: number;
    sessionsChange?: number;
    // Full funnel data for breakdown table
    dmaStarted: number;
    dmaCompletionRate: number;
    gapFullStarted: number;
    gapFullComplete: number;
    gapFullCompleteRate: number;
    gapReviewCtaRate: number;
  }> = [];

  const attentionNeeded: WorkspaceAnalyticsSummary['attentionNeeded'] = [];

  for (const { company, snapshot } of snapshots) {
    if (!snapshot) continue;

    // GA4 totals
    if (snapshot.ga4) {
      totalSessions += snapshot.ga4.metrics.sessions;
      totalUsers += snapshot.ga4.metrics.users;
      totalConversions += snapshot.ga4.metrics.conversions;
      companiesWithGa4++;
    }

    // GSC totals
    if (snapshot.searchConsole) {
      totalClicks += snapshot.searchConsole.metrics.clicks;
      totalImpressions += snapshot.searchConsole.metrics.impressions;
      companiesWithGsc++;
    }

    // Funnel totals
    if (snapshot.funnels) {
      // DMA
      totalDmaStarted += snapshot.funnels.metrics.dma.auditsStarted;
      totalDmaCompleted += snapshot.funnels.metrics.dma.auditsCompleted;
      // GAP-IA
      totalGapIaStarted += snapshot.funnels.metrics.gapIa.started;
      totalGapIaCompleted += snapshot.funnels.metrics.gapIa.completed;
      // Full GAP
      totalGapFullStarted += snapshot.funnels.metrics.gapFull.gapStarted;
      totalGapFullProcessingStarted += snapshot.funnels.metrics.gapFull.gapProcessingStarted;
      totalGapFullComplete += snapshot.funnels.metrics.gapFull.gapComplete;
      totalGapFullReviewCtaClicked += snapshot.funnels.metrics.gapFull.gapReviewCtaClicked;
    }

    // Track per-company metrics for rankings
    const funnels = snapshot.funnels?.metrics;
    companyMetrics.push({
      companyId: company.id,
      companyName: company.name,
      sessions: snapshot.ga4?.metrics.sessions ?? 0,
      conversions: snapshot.ga4?.metrics.conversions ?? 0,
      searchClicks: snapshot.searchConsole?.metrics.clicks ?? 0,
      dmaCompletions: funnels?.dma.auditsCompleted ?? 0,
      gapReviewCtaClicks: funnels?.gapFull.gapReviewCtaClicked ?? 0,
      sessionsChange: snapshot.comparison?.ga4?.sessionsChange,
      // Full funnel data for breakdown table
      dmaStarted: funnels?.dma.auditsStarted ?? 0,
      dmaCompletionRate: funnels?.dma.completionRate ?? 0,
      gapFullStarted: funnels?.gapFull.gapStarted ?? 0,
      gapFullComplete: funnels?.gapFull.gapComplete ?? 0,
      gapFullCompleteRate: funnels?.gapFull.startToCompleteRate ?? 0,
      gapReviewCtaRate: funnels?.gapFull.completeToReviewRate ?? 0,
    });

    // Check for attention-needed companies
    if (snapshot.comparison?.ga4?.sessionsChange !== undefined && snapshot.comparison.ga4.sessionsChange < -20) {
      attentionNeeded.push({
        companyId: company.id,
        companyName: company.name,
        reason: 'Traffic declining significantly',
        metric: 'Sessions',
        value: snapshot.comparison.ga4.sessionsChange,
        threshold: -20,
      });
    }

    if (snapshot.comparison?.searchConsole?.clicksChange !== undefined && snapshot.comparison.searchConsole.clicksChange < -20) {
      attentionNeeded.push({
        companyId: company.id,
        companyName: company.name,
        reason: 'Search clicks declining',
        metric: 'Search Clicks',
        value: snapshot.comparison.searchConsole.clicksChange,
        threshold: -20,
      });
    }

    // Low funnel completion rates
    if (snapshot.funnels && snapshot.funnels.metrics.dma.auditsStarted > 10 && snapshot.funnels.metrics.dma.completionRate < 0.3) {
      attentionNeeded.push({
        companyId: company.id,
        companyName: company.name,
        reason: 'Low DMA completion rate',
        metric: 'Completion Rate',
        value: snapshot.funnels.metrics.dma.completionRate * 100,
        threshold: 30,
      });
    }

    // Low GAP Review CTA rate (< 5% of completed GAPs clicking review CTA)
    if (snapshot.funnels && snapshot.funnels.metrics.gapFull.gapComplete >= 5 && snapshot.funnels.metrics.gapFull.completeToReviewRate < 0.05) {
      attentionNeeded.push({
        companyId: company.id,
        companyName: company.name,
        reason: 'Low GAP review CTA rate',
        metric: 'Review CTA Rate',
        value: snapshot.funnels.metrics.gapFull.completeToReviewRate * 100,
        threshold: 5,
      });
    }

    // High GAP error rate
    if (snapshot.funnels && snapshot.funnels.metrics.gapFull.gapStarted >= 10) {
      const errorRate = snapshot.funnels.metrics.gapFull.gapError / snapshot.funnels.metrics.gapFull.gapStarted;
      if (errorRate > 0.1) {
        attentionNeeded.push({
          companyId: company.id,
          companyName: company.name,
          reason: 'High GAP error rate',
          metric: 'Error Rate',
          value: errorRate * 100,
          threshold: 10,
        });
      }
    }
  }

  // Build top companies lists
  const bySessions = [...companyMetrics]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5)
    .map(({ companyId, companyName, sessions }) => ({ companyId, companyName, value: sessions }));

  const byConversions = [...companyMetrics]
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5)
    .map(({ companyId, companyName, conversions }) => ({ companyId, companyName, value: conversions }));

  const bySearchClicks = [...companyMetrics]
    .sort((a, b) => b.searchClicks - a.searchClicks)
    .slice(0, 5)
    .map(({ companyId, companyName, searchClicks }) => ({ companyId, companyName, value: searchClicks }));

  const byDmaCompletions = [...companyMetrics]
    .sort((a, b) => b.dmaCompletions - a.dmaCompletions)
    .slice(0, 5)
    .map(({ companyId, companyName, dmaCompletions }) => ({ companyId, companyName, value: dmaCompletions }));

  const byGapReviewCtaClicks = [...companyMetrics]
    .sort((a, b) => b.gapReviewCtaClicks - a.gapReviewCtaClicks)
    .slice(0, 5)
    .map(({ companyId, companyName, gapReviewCtaClicks }) => ({ companyId, companyName, value: gapReviewCtaClicks }));

  // Build per-company funnel breakdown for dashboard table
  const companyFunnelBreakdown = companyMetrics
    .filter((c) => c.dmaStarted > 0 || c.gapFullStarted > 0) // Only show companies with funnel activity
    .sort((a, b) => (b.dmaStarted + b.gapFullStarted) - (a.dmaStarted + a.gapFullStarted)) // Sort by total activity
    .slice(0, 20) // Limit to top 20
    .map((c) => ({
      companyId: c.companyId,
      companyName: c.companyName,
      dmaStarted: c.dmaStarted,
      dmaCompleted: c.dmaCompletions,
      dmaCompletionRate: c.dmaCompletionRate,
      gapFullStarted: c.gapFullStarted,
      gapFullComplete: c.gapFullComplete,
      gapFullReviewCtaClicked: c.gapReviewCtaClicks,
      gapFullCompleteRate: c.gapFullCompleteRate,
      gapReviewCtaRate: c.gapReviewCtaRate,
    }));

  // Build time series (simplified - just return totals per day from first company with data)
  // In a real implementation, you'd aggregate all companies' time series
  const timeSeries: WorkspaceAnalyticsSummary['timeSeries'] = [];

  // Find a company with time series data
  for (const { snapshot } of snapshots) {
    if (snapshot?.ga4?.timeSeries && snapshot.ga4.timeSeries.length > 0) {
      for (const point of snapshot.ga4.timeSeries) {
        const existing = timeSeries.find((t) => t.date === point.date);
        if (existing) {
          existing.sessions += point.sessions;
          existing.conversions += point.conversions;
        } else {
          timeSeries.push({
            date: point.date,
            sessions: point.sessions,
            conversions: point.conversions,
            clicks: 0,
            dmaCompleted: 0,
          });
        }
      }
    }
  }

  // Sort time series by date
  timeSeries.sort((a, b) => a.date.localeCompare(b.date));

  const summary: WorkspaceAnalyticsSummary = {
    workspaceId: workspaceId || 'default',
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      companies: allCompanies.length,
      companiesWithGa4,
      companiesWithGsc,
      totalSessions,
      totalUsers,
      totalConversions,
      totalClicks,
      totalImpressions,
      // DMA funnel
      totalDmaStarted,
      totalDmaCompleted,
      // GAP-IA funnel
      totalGapIaStarted,
      totalGapIaCompleted,
      // Full GAP funnel
      totalGapFullStarted,
      totalGapFullProcessingStarted,
      totalGapFullComplete,
      totalGapFullReviewCtaClicked,
    },
    topCompanies: {
      bySessions,
      byConversions,
      bySearchClicks,
      byDmaCompletions,
      byGapReviewCtaClicks,
    },
    companyFunnelBreakdown,
    attentionNeeded: attentionNeeded.slice(0, 10),
    timeSeries,
  };

  console.log('[WorkspaceAnalytics] Summary built:', {
    totalCompanies: allCompanies.length,
    withAnalytics: companiesWithAnalytics.length,
    totalSessions,
    totalClicks,
    attentionCount: attentionNeeded.length,
  });

  return summary;
}
