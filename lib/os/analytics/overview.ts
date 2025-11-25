// lib/os/analytics/overview.ts
// Workspace Analytics Overview Aggregator
// Combines all analytics data into a unified overview

import type {
  WorkspaceDateRange,
  DateRangePreset,
  WorkspaceAnalyticsOverview,
} from './types';
import { getWorkspaceGa4Summary, createDateRange } from './ga4';
import { getWorkspaceGscSummary } from './gsc';
import { getWorkspaceFunnelSummary } from './funnel';
import { generateAnalyticsAlerts } from './alerts';
import { isGa4Configured } from '@/lib/os/integrations/ga4Client';
import { isGscConfigured } from '@/lib/os/integrations/gscClient';

// ============================================================================
// Main Function
// ============================================================================

export interface GetWorkspaceOverviewOptions {
  range?: WorkspaceDateRange;
  preset?: DateRangePreset;
  workspaceId?: string;
  includeFunnel?: boolean;
  includeAlerts?: boolean;
}

/**
 * Fetches comprehensive workspace analytics overview.
 * Aggregates GA4, GSC, funnel, and alerts data.
 */
export async function getWorkspaceAnalyticsOverview(
  options: GetWorkspaceOverviewOptions = {}
): Promise<WorkspaceAnalyticsOverview> {
  const {
    range = options.preset ? createDateRange(options.preset) : createDateRange('30d'),
    workspaceId,
    includeFunnel = true,
    includeAlerts = true,
  } = options;

  console.log('[Overview] Fetching workspace analytics...', {
    startDate: range.startDate,
    endDate: range.endDate,
    preset: range.preset,
    includeFunnel,
    includeAlerts,
  });

  // Check which integrations are configured
  const [hasGa4, hasGsc] = await Promise.all([
    isGa4Configured(workspaceId),
    isGscConfigured(workspaceId),
  ]);

  console.log('[Overview] Integration status:', { hasGa4, hasGsc });

  // Fetch all data in parallel
  const [ga4Data, gscData, funnelData] = await Promise.all([
    hasGa4
      ? getWorkspaceGa4Summary(range, workspaceId)
      : Promise.resolve({ traffic: null, channels: [], landingPages: [] }),
    hasGsc
      ? getWorkspaceGscSummary(range, workspaceId)
      : Promise.resolve({ queries: [], pages: [], totals: { clicks: 0, impressions: 0, avgCtr: null, avgPosition: null } }),
    includeFunnel
      ? getWorkspaceFunnelSummary(range, workspaceId)
      : Promise.resolve(null),
  ]);

  // Fetch previous period data for alerts comparison
  let previousGa4Data = null;
  if (includeAlerts && hasGa4) {
    try {
      const previousRange = createPreviousPeriodRange(range);
      const prevData = await getWorkspaceGa4Summary(previousRange, workspaceId);
      previousGa4Data = prevData.traffic;
    } catch (error) {
      console.warn('[Overview] Could not fetch previous period data:', error);
    }
  }

  // Generate alerts
  const alerts = includeAlerts
    ? generateAnalyticsAlerts({
        traffic: ga4Data.traffic,
        previousTraffic: previousGa4Data,
        channels: ga4Data.channels,
        queries: gscData.queries,
        funnel: funnelData,
      })
    : [];

  // Build the overview
  const overview: WorkspaceAnalyticsOverview = {
    range,
    ga4: {
      traffic: ga4Data.traffic,
      channels: ga4Data.channels,
      landingPages: ga4Data.landingPages,
    },
    gsc: {
      queries: gscData.queries,
      pages: gscData.pages,
    },
    funnel: funnelData,
    alerts,
    meta: {
      hasGa4,
      hasGsc,
      generatedAt: new Date().toISOString(),
    },
  };

  console.log('[Overview] Analytics overview generated:', {
    sessions: ga4Data.traffic?.sessions,
    channels: ga4Data.channels.length,
    queries: gscData.queries.length,
    funnelStages: funnelData?.stages.length,
    alerts: alerts.length,
  });

  return overview;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get workspace analytics for the last 7 days
 */
export async function getWorkspaceAnalytics7Days(
  workspaceId?: string
): Promise<WorkspaceAnalyticsOverview> {
  return getWorkspaceAnalyticsOverview({
    preset: '7d',
    workspaceId,
  });
}

/**
 * Get workspace analytics for the last 30 days
 */
export async function getWorkspaceAnalytics30Days(
  workspaceId?: string
): Promise<WorkspaceAnalyticsOverview> {
  return getWorkspaceAnalyticsOverview({
    preset: '30d',
    workspaceId,
  });
}

/**
 * Get workspace analytics for the last 90 days
 */
export async function getWorkspaceAnalytics90Days(
  workspaceId?: string
): Promise<WorkspaceAnalyticsOverview> {
  return getWorkspaceAnalyticsOverview({
    preset: '90d',
    workspaceId,
  });
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
 * Parse date range preset from string
 */
export function parseDateRangePreset(preset: string): DateRangePreset {
  if (preset === '7d' || preset === '30d' || preset === '90d') {
    return preset;
  }
  return '30d'; // Default
}

/**
 * Check if overview has any meaningful data
 */
export function hasAnalyticsData(overview: WorkspaceAnalyticsOverview): boolean {
  const hasTraffic = overview.ga4.traffic !== null && (overview.ga4.traffic.sessions ?? 0) > 0;
  const hasSearch = overview.gsc.queries.length > 0;
  const hasFunnel = overview.funnel !== null && overview.funnel.stages.some((s) => s.value > 0);

  return hasTraffic || hasSearch || hasFunnel;
}

/**
 * Get summary statistics from overview
 */
export function getOverviewStats(overview: WorkspaceAnalyticsOverview): {
  sessions: number;
  users: number;
  bounceRate: number | null;
  searchClicks: number;
  searchImpressions: number;
  avgPosition: number | null;
  alertCount: number;
  criticalAlerts: number;
} {
  const traffic = overview.ga4.traffic;
  const queries = overview.gsc.queries;

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);

  // Calculate weighted average position
  let avgPosition: number | null = null;
  if (totalClicks > 0) {
    const weightedSum = queries.reduce(
      (sum, q) => sum + (q.position || 0) * q.clicks,
      0
    );
    avgPosition = weightedSum / totalClicks;
  }

  return {
    sessions: traffic?.sessions ?? 0,
    users: traffic?.users ?? 0,
    bounceRate: traffic?.bounceRate ?? null,
    searchClicks: totalClicks,
    searchImpressions: totalImpressions,
    avgPosition,
    alertCount: overview.alerts.length,
    criticalAlerts: overview.alerts.filter((a) => a.severity === 'critical').length,
  };
}
