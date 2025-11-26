// lib/os/analytics/gsc.ts
// Google Search Console Workspace Analytics Helper
// Fetches GSC data using workspace-level OAuth credentials

import { getGscClientFromWorkspace } from '@/lib/os/integrations/gscClient';
import type {
  WorkspaceDateRange,
  GscQueryItem,
  GscPageItem,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface GscWorkspaceSummary {
  queries: GscQueryItem[];
  pages: GscPageItem[];
  totals: {
    clicks: number;
    impressions: number;
    avgCtr: number | null;
    avgPosition: number | null;
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetches Google Search Console data for the workspace.
 * Uses workspace-level OAuth credentials from WorkspaceSettings.
 */
export async function getWorkspaceGscSummary(
  range: WorkspaceDateRange,
  workspaceId?: string
): Promise<GscWorkspaceSummary> {
  console.log('[GSC Workspace] Fetching data...', {
    startDate: range.startDate,
    endDate: range.endDate,
    preset: range.preset,
    workspaceId: workspaceId || 'default',
  });

  // Get GSC client from workspace settings
  const clientConfig = await getGscClientFromWorkspace(workspaceId);

  if (!clientConfig) {
    console.warn('[GSC Workspace] GSC not configured');
    return {
      queries: [],
      pages: [],
      totals: {
        clicks: 0,
        impressions: 0,
        avgCtr: null,
        avgPosition: null,
      },
    };
  }

  const { client, siteUrl } = clientConfig;

  console.log('[GSC Workspace] Using siteUrl:', siteUrl);

  try {
    // Fetch queries and pages in parallel
    const [queries, pages] = await Promise.all([
      fetchTopQueries(client, siteUrl, range.startDate, range.endDate),
      fetchTopPages(client, siteUrl, range.startDate, range.endDate),
    ]);

    // Calculate totals from query data
    const totals = calculateTotals(queries);

    console.log('[GSC Workspace] Data fetched:', {
      queryCount: queries.length,
      pageCount: pages.length,
      totalClicks: totals.clicks,
    });

    return { queries, pages, totals };
  } catch (error: any) {
    // Handle permission errors gracefully
    if (error?.message?.includes('permission') || error?.code === 403) {
      console.warn(
        '[GSC Workspace] Permission denied - check Google Search Console access'
      );
    } else {
      console.error('[GSC Workspace] Error fetching data:', error);
    }

    return {
      queries: [],
      pages: [],
      totals: {
        clicks: 0,
        impressions: 0,
        avgCtr: null,
        avgPosition: null,
      },
    };
  }
}

// ============================================================================
// Query Fetching
// ============================================================================

async function fetchTopQueries(
  client: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscQueryItem[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 50,
        // Note: GSC API doesn't support orderBy - results are always sorted by clicks descending
      },
    });

    if (!response.data.rows || response.data.rows.length === 0) {
      console.log('[GSC Workspace] No query data found for', siteUrl, { startDate, endDate });
      console.log('[GSC Workspace] Full response:', JSON.stringify(response.data, null, 2));
      return [];
    }

    return response.data.rows.map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr ?? null, // Already a decimal (0-1)
      position: row.position ?? null,
    }));
  } catch (error) {
    console.error('[GSC Workspace] Error fetching queries:', error);
    return [];
  }
}

// ============================================================================
// Page Fetching
// ============================================================================

async function fetchTopPages(
  client: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscPageItem[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 50,
        // Note: GSC API doesn't support orderBy - results are always sorted by clicks descending
      },
    });

    if (!response.data.rows || response.data.rows.length === 0) {
      console.log('[GSC Workspace] No page data found');
      return [];
    }

    return response.data.rows.map((row: any) => ({
      url: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr ?? null, // Already a decimal (0-1)
      position: row.position ?? null,
    }));
  } catch (error) {
    console.error('[GSC Workspace] Error fetching pages:', error);
    return [];
  }
}

// ============================================================================
// Totals Calculation
// ============================================================================

function calculateTotals(queries: GscQueryItem[]): {
  clicks: number;
  impressions: number;
  avgCtr: number | null;
  avgPosition: number | null;
} {
  if (queries.length === 0) {
    return {
      clicks: 0,
      impressions: 0,
      avgCtr: null,
      avgPosition: null,
    };
  }

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);

  // Calculate weighted average position (weighted by clicks)
  let avgPosition: number | null = null;
  if (totalClicks > 0) {
    const weightedSum = queries.reduce(
      (sum, q) => sum + (q.position || 0) * q.clicks,
      0
    );
    avgPosition = weightedSum / totalClicks;
  }

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : null,
    avgPosition,
  };
}
