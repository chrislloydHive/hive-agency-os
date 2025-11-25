// lib/os/companies/analyticsData.ts
// Data composer for per-company analytics AI input

import type { CompanyRecord } from '@/lib/airtable/companies';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { fetchCompanySearchConsoleSnapshot } from '@/lib/os/searchConsole/snapshot';
import { fetchCompanyGa4Summary } from '@/lib/os/analytics/companyGa4';
import type {
  CompanyAnalyticsInput,
  CompanyAnalyticsRange,
  CompanyAnalyticsDateRangePreset,
  CompanyGa4Summary,
  CompanySearchConsoleSummary,
  CompanyGapDiagnosticsSummary,
  CompanyWorkSummary,
} from './analyticsTypes';

// ============================================================================
// Date Range Helpers
// ============================================================================

/**
 * Convert preset to date range
 */
export function presetToDateRange(
  preset: CompanyAnalyticsDateRangePreset
): CompanyAnalyticsRange {
  const today = new Date();
  const endDate = new Date(today);

  // For GA4, use today as end date
  // For GSC, we'll handle the 2-3 day delay separately
  let days: number;
  switch (preset) {
    case '7d':
      days = 6;
      break;
    case '90d':
      days = 89;
      break;
    case '30d':
    default:
      days = 29;
      break;
  }

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    preset,
  };
}

/**
 * Get GSC-adjusted date range (accounts for 2-3 day data delay)
 */
function getGscDateRange(range: CompanyAnalyticsRange): CompanyAnalyticsRange {
  // GSC has a 2-3 day data delay, so adjust end date
  const endDate = new Date(range.endDate);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(range.startDate);
  startDate.setDate(startDate.getDate() - 3);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    preset: range.preset,
  };
}

// ============================================================================
// Main Data Composer
// ============================================================================

/**
 * Build complete analytics input for a company
 */
export async function buildCompanyAnalyticsInput(
  company: CompanyRecord,
  preset: CompanyAnalyticsDateRangePreset = '30d'
): Promise<CompanyAnalyticsInput> {
  console.log('[CompanyAnalytics] Building input for:', company.name, preset);

  const range = presetToDateRange(preset);

  // Fetch all data sources in parallel
  const [ga4, searchConsole, gapDiagnostics, work] = await Promise.all([
    fetchGa4ForCompany(company.ga4PropertyId, range),
    fetchSearchConsoleForCompany(company.searchConsoleSiteUrl, range),
    fetchGapDiagnosticsForCompany(company.id),
    fetchWorkSummaryForCompany(company.id),
  ]);

  console.log('[CompanyAnalytics] Input built:', {
    hasGa4: !!ga4,
    hasGsc: !!searchConsole,
    lastGapAt: gapDiagnostics.lastGapAssessmentAt,
    workActive: work.activeCount,
  });

  return {
    companyId: company.id,
    companyName: company.name,
    domain: company.domain || null,
    stage: company.stage || null,
    range,
    ga4,
    searchConsole,
    gapDiagnostics,
    work,
  };
}

// ============================================================================
// Individual Data Fetchers
// ============================================================================

/**
 * Fetch GA4 data for a company
 */
async function fetchGa4ForCompany(
  ga4PropertyId: string | undefined,
  range: CompanyAnalyticsRange
): Promise<CompanyGa4Summary | null> {
  if (!ga4PropertyId) {
    return null;
  }

  try {
    return await fetchCompanyGa4Summary(ga4PropertyId, range);
  } catch (error) {
    console.warn('[CompanyAnalytics] GA4 fetch failed:', error);
    return null;
  }
}

/**
 * Fetch Search Console data for a company
 */
async function fetchSearchConsoleForCompany(
  siteUrl: string | undefined,
  range: CompanyAnalyticsRange
): Promise<CompanySearchConsoleSummary | null> {
  if (!siteUrl) {
    return null;
  }

  try {
    const gscRange = getGscDateRange(range);
    const snapshot = await fetchCompanySearchConsoleSnapshot(
      siteUrl,
      { startDate: gscRange.startDate, endDate: gscRange.endDate },
      10
    );

    return {
      clicks: snapshot.summary.clicks,
      impressions: snapshot.summary.impressions,
      ctr: snapshot.summary.ctr,
      avgPosition: snapshot.summary.avgPosition,
      topQueries: snapshot.topQueries.slice(0, 5).map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
      })),
    };
  } catch (error) {
    console.warn('[CompanyAnalytics] GSC fetch failed:', error);
    return null;
  }
}

/**
 * Fetch GAP and diagnostics summary for a company
 */
async function fetchGapDiagnosticsForCompany(
  companyId: string
): Promise<CompanyGapDiagnosticsSummary> {
  const result: CompanyGapDiagnosticsSummary = {};

  try {
    // Fetch GAP IA runs
    const gapRuns = await getGapIaRunsForCompany(companyId, 10);
    if (gapRuns.length > 0) {
      const latestRun = gapRuns[0];
      result.lastGapAssessmentAt = latestRun.createdAt || null;

      // Try to get overall score from the run data
      const runData = latestRun as any;
      if (runData.overallScore !== undefined) {
        result.lastGapScore = runData.overallScore;
      } else if (runData.summary?.overallScore !== undefined) {
        result.lastGapScore = runData.summary.overallScore;
      }
    }
  } catch (error) {
    console.warn('[CompanyAnalytics] GAP IA fetch failed:', error);
  }

  try {
    // Fetch GAP Plan runs
    const planRuns = await listRecentGapPlanRuns(50);
    const companyPlans = planRuns.filter((p) => p.companyId === companyId);
    if (companyPlans.length > 0) {
      result.lastGapPlanAt = companyPlans[0].createdAt || null;
    }
  } catch (error) {
    console.warn('[CompanyAnalytics] GAP Plan fetch failed:', error);
  }

  try {
    // Fetch diagnostics
    const diagnosticRuns = await listDiagnosticRunsForCompany(companyId);
    if (diagnosticRuns.length > 0) {
      const latestDiag = diagnosticRuns[0];
      result.lastDiagnosticsAt = latestDiag.createdAt || null;
      result.recentDiagnosticsCount = diagnosticRuns.filter((d) => {
        const createdAt = new Date(d.createdAt || 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdAt >= thirtyDaysAgo;
      }).length;

      // Build a brief diagnostics summary
      if (latestDiag.status === 'complete' && latestDiag.toolId) {
        result.diagnosticsSummary = `Last diagnostic: ${latestDiag.toolId}`;
      }
    }
  } catch (error) {
    console.warn('[CompanyAnalytics] Diagnostics fetch failed:', error);
  }

  return result;
}

/**
 * Fetch work summary for a company
 */
async function fetchWorkSummaryForCompany(
  companyId: string
): Promise<CompanyWorkSummary> {
  try {
    const workItems = await getWorkItemsForCompany(companyId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeItems = workItems.filter((w) => w.status !== 'Done');

    const dueToday = activeItems.filter((w) => {
      if (!w.dueDate) return false;
      const dueDate = new Date(w.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    });

    const overdue = activeItems.filter((w) => {
      if (!w.dueDate) return false;
      const dueDate = new Date(w.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });

    return {
      activeCount: activeItems.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      recentItems: activeItems.slice(0, 5).map((w) => ({
        title: w.title,
        status: w.status || 'Backlog',
        area: w.area || null,
        dueDate: w.dueDate || null,
      })),
    };
  } catch (error) {
    console.warn('[CompanyAnalytics] Work items fetch failed:', error);
    return {
      activeCount: 0,
      dueToday: 0,
      overdue: 0,
    };
  }
}
