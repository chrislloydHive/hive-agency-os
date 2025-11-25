// lib/os/analytics/ga4.ts
// GA4 Workspace Analytics Helper
// Fetches GA4 data using workspace-level OAuth credentials

import { getGa4ClientFromWorkspace } from '@/lib/os/integrations/ga4Client';
import type {
  WorkspaceDateRange,
  Ga4TrafficSummary,
  Ga4ChannelBreakdownItem,
  Ga4LandingPageItem,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface Ga4WorkspaceSummary {
  traffic: Ga4TrafficSummary | null;
  channels: Ga4ChannelBreakdownItem[];
  landingPages: Ga4LandingPageItem[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetches GA4 analytics summary for the workspace.
 * Uses workspace-level OAuth credentials from WorkspaceSettings.
 */
export async function getWorkspaceGa4Summary(
  range: WorkspaceDateRange,
  workspaceId?: string
): Promise<Ga4WorkspaceSummary> {
  console.log('[GA4 Workspace] Fetching data...', {
    startDate: range.startDate,
    endDate: range.endDate,
    preset: range.preset,
  });

  // Get GA4 client from workspace settings
  const clientConfig = await getGa4ClientFromWorkspace(workspaceId);

  if (!clientConfig) {
    console.warn('[GA4 Workspace] GA4 not configured');
    return {
      traffic: null,
      channels: [],
      landingPages: [],
    };
  }

  const { client, propertyId } = clientConfig;

  try {
    // Run all three queries in parallel
    const [traffic, channels, landingPages] = await Promise.all([
      fetchTrafficSummary(client, propertyId, range.startDate, range.endDate),
      fetchChannelBreakdown(client, propertyId, range.startDate, range.endDate),
      fetchLandingPages(client, propertyId, range.startDate, range.endDate),
    ]);

    console.log('[GA4 Workspace] Data fetched:', {
      sessions: traffic?.sessions,
      channelCount: channels.length,
      pageCount: landingPages.length,
    });

    return { traffic, channels, landingPages };
  } catch (error) {
    console.error('[GA4 Workspace] Error fetching data:', error);
    return {
      traffic: null,
      channels: [],
      landingPages: [],
    };
  }
}

// ============================================================================
// Traffic Summary
// ============================================================================

async function fetchTrafficSummary(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4TrafficSummary | null> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      console.log('[GA4 Workspace] No traffic data found');
      return null;
    }

    const row = response.rows[0];
    const metrics = row.metricValues || [];

    return {
      users: metrics[0]?.value ? parseInt(metrics[0].value) : 0,
      sessions: metrics[1]?.value ? parseInt(metrics[1].value) : 0,
      pageviews: metrics[2]?.value ? parseInt(metrics[2].value) : 0,
      bounceRate: metrics[3]?.value ? parseFloat(metrics[3].value) : null,
      avgSessionDurationSeconds: metrics[4]?.value
        ? parseFloat(metrics[4].value)
        : null,
    };
  } catch (error) {
    console.error('[GA4 Workspace] Error fetching traffic summary:', error);
    return null;
  }
}

// ============================================================================
// Channel Breakdown
// ============================================================================

async function fetchChannelBreakdown(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ChannelBreakdownItem[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    if (!response.rows || response.rows.length === 0) {
      console.log('[GA4 Workspace] No channel data found');
      return [];
    }

    return response.rows.map((row: any) => {
      const channel = row.dimensionValues?.[0]?.value || '(not set)';
      const metrics = row.metricValues || [];

      return {
        channel: channel === '(not set)' ? 'Unattributed' : channel,
        sessions: metrics[0]?.value ? parseInt(metrics[0].value) : 0,
        users: metrics[1]?.value ? parseInt(metrics[1].value) : 0,
        conversions: metrics[2]?.value ? parseInt(metrics[2].value) : null,
      };
    });
  } catch (error) {
    console.error('[GA4 Workspace] Error fetching channel breakdown:', error);
    return [];
  }
}

// ============================================================================
// Landing Pages
// ============================================================================

async function fetchLandingPages(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4LandingPageItem[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    });

    if (!response.rows || response.rows.length === 0) {
      console.log('[GA4 Workspace] No landing pages data found');
      return [];
    }

    return response.rows.map((row: any) => {
      const path = row.dimensionValues?.[0]?.value || '/';
      const metrics = row.metricValues || [];

      return {
        path,
        sessions: metrics[0]?.value ? parseInt(metrics[0].value) : 0,
        users: metrics[1]?.value ? parseInt(metrics[1].value) : 0,
        conversions: metrics[2]?.value ? parseInt(metrics[2].value) : null,
        bounceRate: metrics[3]?.value ? parseFloat(metrics[3].value) : null,
      };
    });
  } catch (error) {
    console.error('[GA4 Workspace] Error fetching landing pages:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a WorkspaceDateRange from a preset
 */
export function createDateRange(preset: '7d' | '30d' | '90d'): WorkspaceDateRange {
  const endDate = new Date();
  const startDate = new Date();

  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  startDate.setDate(startDate.getDate() - daysMap[preset]);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    preset,
  };
}

/**
 * Creates a previous period date range for comparison
 */
export function createPreviousPeriodRange(
  currentRange: WorkspaceDateRange
): WorkspaceDateRange {
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
