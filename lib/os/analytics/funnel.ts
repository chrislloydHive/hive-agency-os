// lib/os/analytics/funnel.ts
// Unified Funnel Engine for Hive OS
// Provides a single data model and fetching logic for DMA, Company, and Workspace funnels
//
// NOTE: Types and pure transformation functions are in funnelTypes.ts for client-side use.
// This file contains server-side functions that call GA4/Airtable.

import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';
import { base } from '@/lib/airtable/client';
import type {
  WorkspaceDateRange,
  WorkspaceFunnelSummary,
  FunnelStageMetrics,
} from './types';
import { getWorkspaceGa4Summary } from './ga4';
import { getAuditFunnelSnapshot } from '@/lib/ga4Client';

// Re-export types from funnelTypes for backward compatibility
export type {
  FunnelStageId,
  FunnelStageSummary,
  FunnelTimePoint,
  FunnelChannelPerformance,
  FunnelCampaignPerformance,
  FunnelSummary,
  FunnelDataset,
} from './funnelTypes';
export {
  calculateConversionRate,
  getFunnelConversionRates,
  getDatasetConversionRates,
  transformDmaSnapshotToDataset,
} from './funnelTypes';

import type {
  FunnelStageId,
  FunnelStageSummary,
  FunnelSummary,
  FunnelDataset,
} from './funnelTypes';
import { transformDmaSnapshotToDataset } from './funnelTypes';

// ============================================================================
// Legacy Types (for internal use only)
// ============================================================================

interface FunnelCounts {
  sessions: number;
  dmaAudits: number;
  leads: number;
  gapAssessments: number;
  gapPlans: number;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generates workspace funnel summary for the specified date range.
 * Funnel stages:
 * 1. Sessions (from GA4)
 * 2. DMA Audits Started (from Airtable)
 * 3. Leads Generated (from Airtable)
 * 4. GAP Assessments Completed (from Airtable)
 * 5. GAP Plans Created (from Airtable)
 */
export async function getWorkspaceFunnelSummary(
  range: WorkspaceDateRange,
  workspaceId?: string
): Promise<WorkspaceFunnelSummary> {
  console.log('[Funnel] Generating funnel summary...', {
    startDate: range.startDate,
    endDate: range.endDate,
    preset: range.preset,
  });

  try {
    // Fetch all data in parallel
    const [ga4Data, gapIaRuns, gapPlanRuns, leads, dmaAudits] = await Promise.all([
      getWorkspaceGa4Summary(range, workspaceId).catch(() => ({
        traffic: null,
        channels: [],
        landingPages: [],
      })),
      listRecentGapIaRuns(500),
      listRecentGapPlanRuns(500),
      fetchLeadsInRange(range),
      fetchDmaAuditsInRange(range),
    ]);

    // Filter by date range
    const rangeStart = new Date(range.startDate);
    const rangeEnd = new Date(range.endDate);
    rangeEnd.setHours(23, 59, 59, 999); // Include entire end day

    const filteredGapRuns = gapIaRuns.filter((run) => {
      if (!run.createdAt) return false;
      const runDate = new Date(run.createdAt);
      return runDate >= rangeStart && runDate <= rangeEnd && run.status === 'completed';
    });

    const filteredPlanRuns = gapPlanRuns.filter((run) => {
      if (!run.createdAt) return false;
      const runDate = new Date(run.createdAt);
      return runDate >= rangeStart && runDate <= rangeEnd;
    });

    // Build current period counts
    const counts: FunnelCounts = {
      sessions: ga4Data.traffic?.sessions ?? 0,
      dmaAudits: dmaAudits.length,
      leads: leads.length,
      gapAssessments: filteredGapRuns.length,
      gapPlans: filteredPlanRuns.length,
    };

    // Calculate previous period for comparison
    const previousRange = createPreviousPeriodRange(range);
    let prevCounts: FunnelCounts | null = null;

    try {
      const [prevGa4Data, prevLeads, prevDmaAudits] = await Promise.all([
        getWorkspaceGa4Summary(previousRange, workspaceId).catch(() => ({
          traffic: null,
          channels: [],
          landingPages: [],
        })),
        fetchLeadsInRange(previousRange),
        fetchDmaAuditsInRange(previousRange),
      ]);

      // Previous GAP runs
      const prevRangeStart = new Date(previousRange.startDate);
      const prevRangeEnd = new Date(previousRange.endDate);
      prevRangeEnd.setHours(23, 59, 59, 999);

      const prevFilteredGapRuns = gapIaRuns.filter((run) => {
        if (!run.createdAt) return false;
        const runDate = new Date(run.createdAt);
        return runDate >= prevRangeStart && runDate <= prevRangeEnd && run.status === 'completed';
      });

      const prevFilteredPlanRuns = gapPlanRuns.filter((run) => {
        if (!run.createdAt) return false;
        const runDate = new Date(run.createdAt);
        return runDate >= prevRangeStart && runDate <= prevRangeEnd;
      });

      prevCounts = {
        sessions: prevGa4Data.traffic?.sessions ?? 0,
        dmaAudits: prevDmaAudits.length,
        leads: prevLeads.length,
        gapAssessments: prevFilteredGapRuns.length,
        gapPlans: prevFilteredPlanRuns.length,
      };
    } catch (error) {
      console.warn('[Funnel] Could not fetch previous period:', error);
    }

    // Build funnel stages
    const stages: FunnelStageMetrics[] = [
      {
        label: 'Sessions',
        value: counts.sessions,
        prevValue: prevCounts?.sessions ?? null,
      },
      {
        label: 'DMA Audits',
        value: counts.dmaAudits,
        prevValue: prevCounts?.dmaAudits ?? null,
      },
      {
        label: 'Leads',
        value: counts.leads,
        prevValue: prevCounts?.leads ?? null,
      },
      {
        label: 'GAP Assessments',
        value: counts.gapAssessments,
        prevValue: prevCounts?.gapAssessments ?? null,
      },
      {
        label: 'GAP Plans',
        value: counts.gapPlans,
        prevValue: prevCounts?.gapPlans ?? null,
      },
    ];

    console.log('[Funnel] Summary generated:', counts);

    return { stages };
  } catch (error) {
    console.error('[Funnel] Error generating funnel summary:', error);

    // Return empty funnel on error
    return {
      stages: [
        { label: 'Sessions', value: 0, prevValue: null },
        { label: 'DMA Audits', value: 0, prevValue: null },
        { label: 'Leads', value: 0, prevValue: null },
        { label: 'GAP Assessments', value: 0, prevValue: null },
        { label: 'GAP Plans', value: 0, prevValue: null },
      ],
    };
  }
}

// ============================================================================
// Data Fetching Helpers
// ============================================================================

/**
 * Fetch leads within the specified date range
 */
async function fetchLeadsInRange(range: WorkspaceDateRange): Promise<any[]> {
  try {
    const rangeEnd = new Date(range.endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    const records = await base('Leads')
      .select({
        maxRecords: 500,
        filterByFormula: `AND(
          IS_AFTER({Created At}, DATEADD(DATETIME_PARSE('${range.startDate}', 'YYYY-MM-DD'), -1, 'days')),
          IS_BEFORE({Created At}, DATEADD(DATETIME_PARSE('${range.endDate}', 'YYYY-MM-DD'), 1, 'days'))
        )`,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    // Leads table may not exist
    console.warn('[Funnel] Leads fetch failed (table may not exist):', error);
    return [];
  }
}

/**
 * Fetch DMA audits within the specified date range
 * DMA audits are tracked in a separate table or can be inferred from GAP-IA runs with source='public'
 */
async function fetchDmaAuditsInRange(range: WorkspaceDateRange): Promise<any[]> {
  try {
    // First, try the dedicated DMA Audits table
    try {
      const rangeEnd = new Date(range.endDate);
      rangeEnd.setHours(23, 59, 59, 999);

      const records = await base('DMA Audits')
        .select({
          maxRecords: 500,
          filterByFormula: `AND(
            IS_AFTER({Created At}, DATEADD(DATETIME_PARSE('${range.startDate}', 'YYYY-MM-DD'), -1, 'days')),
            IS_BEFORE({Created At}, DATEADD(DATETIME_PARSE('${range.endDate}', 'YYYY-MM-DD'), 1, 'days'))
          )`,
        })
        .all();

      return records.map((record) => ({
        id: record.id,
        createdAt: record.fields['Created At'] as string,
      }));
    } catch {
      // DMA Audits table doesn't exist, fall back to GAP-IA runs with source='public'
      console.log('[Funnel] DMA Audits table not found, using GAP-IA runs as fallback');

      const gapRuns = await listRecentGapIaRuns(500);
      const rangeStart = new Date(range.startDate);
      const rangeEnd = new Date(range.endDate);
      rangeEnd.setHours(23, 59, 59, 999);

      return gapRuns.filter((run) => {
        if (!run.createdAt) return false;
        const runDate = new Date(run.createdAt);
        return (
          runDate >= rangeStart &&
          runDate <= rangeEnd &&
          run.source === 'lead-magnet' // DMA audits come from lead magnet source
        );
      });
    }
  } catch (error) {
    console.warn('[Funnel] DMA audits fetch failed:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a previous period date range for comparison
 */
function createPreviousPeriodRange(currentRange: WorkspaceDateRange): WorkspaceDateRange {
  const currentStart = new Date(currentRange.startDate);
  const currentEnd = new Date(currentRange.endDate);
  const periodDays = Math.ceil(
    (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - periodDays);

  return {
    startDate: previousStart.toISOString().split('T')[0],
    endDate: previousEnd.toISOString().split('T')[0],
    preset: currentRange.preset,
  };
}

/**
 * Calculate conversion rate between funnel stages (legacy version with percentage)
 * Use calculateConversionRate from funnelTypes for the new API (returns 0-1)
 */
function calculateConversionRatePercent(from: number, to: number): number | null {
  if (from === 0) return null;
  return (to / from) * 100;
}

/**
 * Get funnel stage conversion rates for legacy WorkspaceFunnelSummary
 * Use getFunnelConversionRates from funnelTypes for the new FunnelDataset API
 */
export function getWorkspaceFunnelConversionRates(
  funnel: WorkspaceFunnelSummary
): Array<{ from: string; to: string; rate: number | null }> {
  const stages = funnel.stages;
  const rates: Array<{ from: string; to: string; rate: number | null }> = [];

  for (let i = 0; i < stages.length - 1; i++) {
    rates.push({
      from: stages[i].label,
      to: stages[i + 1].label,
      rate: calculateConversionRatePercent(stages[i].value, stages[i + 1].value),
    });
  }

  return rates;
}

// ============================================================================
// Unified Funnel Dataset Fetchers (NEW)
// ============================================================================

/**
 * Get unified DMA funnel dataset
 * Transforms the legacy AuditFunnelSnapshot into the new FunnelDataset format
 */
export async function getDmaFunnelDataset(
  startDate: string,
  endDate: string,
  preset?: '7d' | '30d' | '90d'
): Promise<FunnelDataset> {
  // Fetch the legacy DMA snapshot
  const snapshot = await getAuditFunnelSnapshot(startDate, endDate);

  // Transform to unified format using the function from funnelTypes
  return transformDmaSnapshotToDataset(
    snapshot,
    { startDate, endDate },
    preset
  );
}

/**
 * Get unified Workspace funnel dataset
 * Combines GA4 traffic with Airtable pipeline data
 */
export async function getWorkspaceFunnelDataset(
  range: WorkspaceDateRange,
  workspaceId?: string
): Promise<FunnelDataset> {
  // Get the legacy funnel summary
  const legacyFunnel = await getWorkspaceFunnelSummary(range, workspaceId);

  // Also get DMA data for time series/channels if available
  let dmaDataset: FunnelDataset | null = null;
  try {
    dmaDataset = await getDmaFunnelDataset(range.startDate, range.endDate, range.preset);
  } catch (error) {
    console.warn('[Funnel] Could not fetch DMA dataset for workspace:', error);
  }

  // Build stages from legacy funnel
  const stages: FunnelStageSummary[] = legacyFunnel.stages.map((stage, idx, arr) => {
    const prevStage = idx > 0 ? arr[idx - 1] : null;
    const conversionFromPrevious =
      prevStage && prevStage.value > 0 ? stage.value / prevStage.value : null;

    // Map labels to stage IDs
    let id: FunnelStageId = 'custom';
    if (stage.label === 'Sessions') id = 'sessions';
    else if (stage.label === 'DMA Audits') id = 'audits_started';
    else if (stage.label === 'Leads') id = 'leads';
    else if (stage.label === 'GAP Assessments') id = 'gap_assessments';
    else if (stage.label === 'GAP Plans') id = 'gap_plans';

    return {
      id,
      label: stage.label,
      value: stage.value,
      prevValue: stage.prevValue,
      conversionFromPrevious,
    };
  });

  // Use DMA time series and channels if available
  const timeSeries = dmaDataset?.timeSeries ?? [];
  const channels = dmaDataset?.channels ?? [];
  const campaigns = dmaDataset?.campaigns ?? [];

  // Calculate summary
  const sessionsStage = stages.find((s) => s.id === 'sessions');
  const plansStage = stages.find((s) => s.id === 'gap_plans');
  const totalSessions = sessionsStage?.value ?? 0;
  const totalConversions = plansStage?.value ?? 0;

  const summary: FunnelSummary = {
    totalSessions,
    totalConversions,
    overallConversionRate: totalSessions > 0 ? totalConversions / totalSessions : 0,
    topChannel: channels.length > 0 ? channels[0].channel : null,
    topCampaign: campaigns.length > 0 ? campaigns[0].campaign : null,
    periodChange: calculatePeriodChange(stages),
  };

  return {
    context: 'workspace',
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      preset: range.preset,
    },
    generatedAt: new Date().toISOString(),
    summary,
    stages,
    timeSeries,
    channels,
    campaigns,
  };
}

/**
 * Get unified Company funnel dataset
 * Uses company-specific GA4 property if available
 */
export async function getCompanyFunnelDataset(
  companyId: string,
  startDate: string,
  endDate: string,
  preset?: '7d' | '30d' | '90d',
  _ga4PropertyId?: string
): Promise<FunnelDataset> {
  // For now, return a basic dataset
  // Company-specific funnel data would come from company's GA4 property
  // TODO: Implement company-specific GA4 calls when properties are configured

  const stages: FunnelStageSummary[] = [
    {
      id: 'sessions',
      label: 'Sessions',
      value: 0,
      prevValue: null,
      conversionFromPrevious: null,
    },
    {
      id: 'audits_started',
      label: 'Audits Started',
      value: 0,
      prevValue: null,
      conversionFromPrevious: null,
    },
    {
      id: 'audits_completed',
      label: 'Audits Completed',
      value: 0,
      prevValue: null,
      conversionFromPrevious: null,
    },
  ];

  const summary: FunnelSummary = {
    totalSessions: 0,
    totalConversions: 0,
    overallConversionRate: 0,
    topChannel: null,
    topCampaign: null,
    periodChange: null,
  };

  return {
    context: 'company',
    contextId: companyId,
    range: {
      startDate,
      endDate,
      preset,
    },
    generatedAt: new Date().toISOString(),
    summary,
    stages,
    timeSeries: [],
    channels: [],
    campaigns: [],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate period change percentage from stages with prevValue
 */
function calculatePeriodChange(stages: FunnelStageSummary[]): number | null {
  // Use the first stage with both current and previous values
  const stageWithChange = stages.find(
    (s) => s.value > 0 && s.prevValue !== null && s.prevValue > 0
  );

  if (!stageWithChange || stageWithChange.prevValue === null) {
    return null;
  }

  return (
    ((stageWithChange.value - stageWithChange.prevValue) /
      stageWithChange.prevValue) *
    100
  );
}

// getDatasetConversionRates is re-exported from funnelTypes.ts
