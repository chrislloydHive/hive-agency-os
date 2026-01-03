// lib/os/overview/resolveOverviewState.ts
// Overview State Resolver
//
// Determines rendering mode for the Company Overview page.
// NO SILENT FALLBACKS - every path is explicit.
//
// V3 Architecture: Business Need–First, Strategy-Aligned
// Canonical component: components/os/overview/CompanyOverviewV3.tsx

import { getCompanyById, getCompanyByCanonicalId } from '@/lib/airtable/companies';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import { getCompanyWorkSummary, type CompanyWorkSummary } from '@/lib/os/companies/workSummary';
import { getCompanyAlerts, type CompanyAlert } from '@/lib/os/companies/alerts';
import {
  getRecentRunsForCompany,
  getCompanyScoreTrends,
  type DiagnosticRun,
  type CompanyScoreTrends,
} from '@/lib/os/diagnostics/runs';
import { getCompanyPerformancePulse } from '@/lib/os/analytics/companyPerformancePulse';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import { getBaselineStatus } from '@/lib/contextGraph/baseline';
import { getMediaLabSummary, type MediaLabSummary } from '@/lib/mediaLab';
import { loadQBRData, getQBRSummary, calculateOverallHealthScore } from '@/lib/os/reports/qbrData';
import { getCompanyStatusSummary } from '@/lib/os/companies/companyStatus';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { DiagnosticToolId, DiagnosticRunStatus } from '@/lib/os/diagnostics/runs';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { CompanyStrategy, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

/**
 * Overview View Model - all data needed to render the canonical Overview
 */
export interface OverviewViewModel {
  company: {
    id: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    stage?: string | null;
    companyType?: string | null;
    sizeBand?: string | null;
    owner?: string | null;
    hasMediaProgram: boolean;
  };
  // V3: Strategy & Plays (primary data)
  strategy: CompanyStrategy | null;
  plays: StrategyPlay[];
  // Legacy: Strategic snapshot (kept for backwards compatibility)
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  workSummary: CompanyWorkSummary;
  scoreTrends: CompanyScoreTrends;
  alerts: CompanyAlert[];
  performancePulse: PerformancePulse | null;
  mediaLabSummary: MediaLabSummary | null;
  statusSummary: CompanyStatusSummary | null;
  analyticsSnapshot: CompanyAnalyticsSnapshot | null;
  baselineStatus: {
    initialized: boolean;
    initializedAt: string | null;
    healthScore?: number;
    completeness?: number;
  } | null;
  qbrSummary: QBRSummaryData | null;
  // V3: Context completeness for AI recommendations
  contextCompleteness: number;
}


export interface QBRSummaryData {
  healthScore: number;
  overallHealthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  lastDiagnosticRun: string | null;
}

/**
 * Overview State - explicit rendering modes
 */
export type OverviewState =
  | { mode: 'ready'; viewModel: OverviewViewModel }
  | { mode: 'empty'; reason: 'no_runs' | 'no_snapshot' | 'no_company' }
  | { mode: 'stale'; viewModel: OverviewViewModel; lastRunAt: string }
  | { mode: 'error'; errorCode: string; message: string; details?: string }
  | { mode: 'legacy'; reason: string };

/**
 * Resolver options
 */
export interface ResolveOverviewOptions {
  companyId: string;
  /** Force legacy mode (explicit opt-in only) */
  forceLegacy?: boolean;
  /** Lead ID for pipeline context */
  leadId?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Staleness threshold in days */
const STALE_THRESHOLD_DAYS = 30;

/** Tool ID to slug mapping */
const TOOL_ID_TO_SLUG: Record<string, string> = {
  gapSnapshot: 'gap-ia',
  gapPlan: 'gap-plan',
  gapHeavy: 'gap-heavy',
  websiteLab: 'website-lab',
  brandLab: 'brand-lab',
  contentLab: 'content-lab',
  seoLab: 'seo-lab',
  demandLab: 'demand-lab',
  opsLab: 'ops-lab',
};

/** Tool labels */
const TOOL_LABELS: Record<string, string> = {
  gapSnapshot: 'GAP Snapshot',
  gapPlan: 'GAP Plan',
  gapHeavy: 'GAP Heavy',
  websiteLab: 'Website Lab',
  brandLab: 'Brand Lab',
  contentLab: 'Content Lab',
  seoLab: 'SEO Lab',
  demandLab: 'Demand Lab',
  opsLab: 'Ops Lab',
};

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve the Overview state for a company.
 * NO SILENT FALLBACKS - every code path is explicit.
 */
export async function resolveOverviewState(
  options: ResolveOverviewOptions
): Promise<OverviewState> {
  const { companyId, forceLegacy, leadId } = options;
  const startTime = Date.now();

  // 1. Check for explicit legacy opt-in
  if (forceLegacy) {
    console.log('[OVERVIEW_MODE]', {
      companyId,
      mode: 'legacy',
      reason: 'explicit_opt_in',
      ts: new Date().toISOString(),
    });
    return { mode: 'legacy', reason: 'Explicit legacy mode requested' };
  }

  try {
    // 2. Fetch company first (required)
    // Try Airtable record ID first (recXXX format), then UUID (Company ID field)
    let company = await getCompanyById(companyId);
    if (!company) {
      // Fallback: try looking up by canonical UUID
      company = await getCompanyByCanonicalId(companyId);
    }
    if (!company) {
      console.log('[OVERVIEW_MODE]', {
        companyId,
        mode: 'empty',
        reason: 'no_company',
        ts: new Date().toISOString(),
      });
      return { mode: 'empty', reason: 'no_company' };
    }

    // 3. Fetch all data in parallel (with explicit error handling)
    const [
      strategyResult,
      strategySnapshotResult,
      recentRunsResult,
      workSummaryResult,
      scoreTrendsResult,
      alertsResult,
      performancePulseResult,
      mediaLabSummaryResult,
      baselineStatusResult,
      qbrDataResult,
      statusSummaryResult,
      analyticsSnapshotResult,
    ] = await Promise.allSettled([
      getActiveStrategy(companyId),
      getCompanyStrategySnapshot(companyId),
      getRecentRunsForCompany(companyId, 5),
      getCompanyWorkSummary(companyId),
      getCompanyScoreTrends(companyId),
      getCompanyAlerts(companyId),
      getCompanyPerformancePulse(companyId),
      getMediaLabSummary(companyId),
      getBaselineStatus(companyId),
      loadQBRData(companyId),
      getCompanyStatusSummary({ companyId, leadId }),
      getCompanyAnalyticsSnapshot({ companyId }),
    ]);

    // 4. Extract values with explicit defaults (NO silent catch)
    // V3: Strategy and plays
    const strategy = strategyResult.status === 'fulfilled'
      ? strategyResult.value
      : null;
    const plays: StrategyPlay[] = strategy?.plays || [];

    const strategySnapshot = strategySnapshotResult.status === 'fulfilled'
      ? strategySnapshotResult.value
      : null;

    const recentRuns = recentRunsResult.status === 'fulfilled'
      ? recentRunsResult.value
      : [];

    const workSummary = workSummaryResult.status === 'fulfilled'
      ? workSummaryResult.value
      : { active: [], doneRecently: [], counts: { active: 0, inProgress: 0, doneRecently: 0 } };

    const scoreTrends = scoreTrendsResult.status === 'fulfilled'
      ? scoreTrendsResult.value
      : { overall: [], website: [], seo: [], brand: [] };

    const alerts = alertsResult.status === 'fulfilled'
      ? alertsResult.value
      : [];

    const performancePulse = performancePulseResult.status === 'fulfilled'
      ? performancePulseResult.value
      : null;

    const mediaLabSummary = mediaLabSummaryResult.status === 'fulfilled'
      ? mediaLabSummaryResult.value
      : null;

    const baselineStatus = baselineStatusResult.status === 'fulfilled'
      ? baselineStatusResult.value
      : null;

    const qbrData = qbrDataResult.status === 'fulfilled'
      ? qbrDataResult.value
      : null;

    const statusSummary = statusSummaryResult.status === 'fulfilled'
      ? statusSummaryResult.value
      : null;

    const analyticsSnapshot = analyticsSnapshotResult.status === 'fulfilled'
      ? analyticsSnapshotResult.value
      : null;

    // 5. Check for empty state (no diagnostic runs)
    if (recentRuns.length === 0) {
      console.log('[OVERVIEW_MODE]', {
        companyId,
        mode: 'empty',
        reason: 'no_runs',
        ts: new Date().toISOString(),
      });
      return { mode: 'empty', reason: 'no_runs' };
    }

    // 6. Transform diagnostics
    const recentDiagnostics = transformDiagnostics(recentRuns, companyId);

    // 7. Compute QBR summary
    const qbrSummary = qbrData ? {
      ...getQBRSummary(qbrData),
      overallHealthScore: calculateOverallHealthScore(qbrData),
    } : null;

    // 8. Check if company has media program
    const hasMediaProgram = company.hasMediaProgram;

    // 9. Compute context completeness from baseline status
    const contextCompleteness = baselineStatus?.completeness ?? 0;

    // 10. Build view model
    const viewModel: OverviewViewModel = {
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
        industry: company.industry,
        stage: company.stage,
        companyType: company.companyType,
        sizeBand: company.sizeBand,
        owner: company.owner,
        hasMediaProgram,
      },
      // V3: Strategy & Plays
      strategy,
      plays,
      // Legacy compatibility
      strategySnapshot,
      recentDiagnostics,
      workSummary,
      scoreTrends,
      alerts,
      performancePulse,
      mediaLabSummary,
      statusSummary,
      analyticsSnapshot,
      baselineStatus,
      qbrSummary,
      // V3: Context completeness
      contextCompleteness,
    };

    // 11. Check for staleness
    const latestRun = recentRuns.find(r => r.status === 'complete');
    if (latestRun) {
      const lastRunAt = latestRun.updatedAt || latestRun.createdAt;
      const daysSinceRun = daysSince(lastRunAt);

      if (daysSinceRun > STALE_THRESHOLD_DAYS) {
        console.log('[OVERVIEW_MODE]', {
          companyId,
          mode: 'stale',
          reason: 'old_runs',
          latestRunId: latestRun.id,
          lastRunAt,
          daysSinceRun,
          durationMs: Date.now() - startTime,
          ts: new Date().toISOString(),
        });
        return { mode: 'stale', viewModel, lastRunAt };
      }
    }

    // 12. Ready state
    console.log('[OVERVIEW_MODE]', {
      companyId,
      mode: 'ready',
      latestRunId: latestRun?.id || null,
      lastRunAt: latestRun?.updatedAt || null,
      durationMs: Date.now() - startTime,
      ts: new Date().toISOString(),
    });

    return { mode: 'ready', viewModel };

  } catch (error) {
    // Explicit error handling - NO fallback to legacy
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OVERVIEW_MODE]', {
      companyId,
      mode: 'error',
      errorCode: 'RESOLVE_FAILED',
      message: errorMessage,
      ts: new Date().toISOString(),
    });

    return {
      mode: 'error',
      errorCode: 'RESOLVE_FAILED',
      message: `Failed to load overview: ${errorMessage}`,
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function transformDiagnostics(
  runs: DiagnosticRun[],
  companyId: string
): RecentDiagnostic[] {
  return runs.map((run) => {
    const slug = TOOL_ID_TO_SLUG[run.toolId] || run.toolId;
    // Competition lab doesn't have per-run pages, just the main lab page
    const reportPath = run.status === 'complete'
      ? run.toolId === 'competitionLab'
        ? `/c/${companyId}/diagnostics/competition`
        : `/c/${companyId}/diagnostics/${slug}/${run.id}`
      : null;
    return {
      id: run.id,
      toolId: run.toolId as DiagnosticToolId,
      toolLabel: TOOL_LABELS[run.toolId] || run.toolId,
      status: run.status as DiagnosticRunStatus,
      score: run.score,
      completedAt: run.status === 'complete' ? run.updatedAt : null,
      reportPath,
      createdAt: run.createdAt,
    };
  });
}

function daysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Exports
// ============================================================================

export type { CompanyWorkSummary, CompanyAlert, CompanyScoreTrends };
