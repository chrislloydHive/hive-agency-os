// lib/telemetry/ga4Client.ts
// GA4 Data API Client Helper

import { env } from '@/lib/env';

// Import GA4 SDK
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// ============================================================================
// Types
// ============================================================================

export type Ga4PageMetrics = {
  pagePath: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
  defaultChannelGroup?: string;
};

export type Ga4ChannelMetrics = {
  channelGroup: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
};

export type Ga4Overview = {
  totalSessions: number;
  totalUsers: number;
  totalEngagedSessions: number;
  totalConversions: number;
  engagementRate: number;
};

export type Ga4Snapshot = {
  overview: Ga4Overview;
  pages: Ga4PageMetrics[];
  channels: Ga4ChannelMetrics[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
};

// ============================================================================
// GA4 Client
// ============================================================================

let analyticsDataClient: any = null;

/**
 * Get or initialize GA4 Data API client
 */
function getGA4Client(): any {
  if (analyticsDataClient) {
    return analyticsDataClient;
  }

  try {
    // Initialize client with service account credentials from environment
    // The client will automatically use GOOGLE_APPLICATION_CREDENTIALS env var
    // or explicitly pass credentials
    analyticsDataClient = new BetaAnalyticsDataClient({
      // If you have credentials as JSON string in env:
      credentials: env.GA4_SERVICE_ACCOUNT_KEY
        ? JSON.parse(env.GA4_SERVICE_ACCOUNT_KEY)
        : undefined,
    });

    return analyticsDataClient;
  } catch (error) {
    console.error('[GA4 Client] Failed to initialize GA4 client:', error);
    return null;
  }
}

// ============================================================================
// Main GA4 Data Fetcher
// ============================================================================

/**
 * Fetch GA4 snapshot for a property
 *
 * @param propertyId - GA4 Property ID (e.g., "123456789")
 * @param daysAgo - Number of days to look back (default: 30)
 * @param primaryConversionEvents - Optional list of conversion events to track
 * @returns GA4 snapshot or null if data unavailable
 */
export async function fetchGA4Snapshot(
  propertyId: string,
  daysAgo: number = 30,
  primaryConversionEvents?: string[]
): Promise<Ga4Snapshot | null> {
  const client = getGA4Client();

  if (!client) {
    console.warn('[GA4 Client] GA4 client not initialized, skipping fetch');
    return null;
  }

  try {
    console.log('[GA4 Client] Fetching snapshot for property:', propertyId);

    const startDate = `${daysAgo}daysAgo`;
    const endDate = 'today';

    // ========================================================================
    // 1. Fetch Overview Metrics
    // ========================================================================

    const [overviewResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'conversions' }, // Total conversions across all events
      ],
    });

    const overviewRow = overviewResponse.rows?.[0];
    const overview: Ga4Overview = {
      totalSessions: parseInt(overviewRow?.metricValues?.[0]?.value || '0'),
      totalUsers: parseInt(overviewRow?.metricValues?.[1]?.value || '0'),
      totalEngagedSessions: parseInt(overviewRow?.metricValues?.[2]?.value || '0'),
      engagementRate: parseFloat(overviewRow?.metricValues?.[3]?.value || '0'),
      totalConversions: parseInt(overviewRow?.metricValues?.[4]?.value || '0'),
    };

    console.log('[GA4 Client] Overview fetched:', overview);

    // ========================================================================
    // 2. Fetch Top Pages with Metrics
    // ========================================================================

    const [pagesResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'conversions' },
      ],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
      limit: 20, // Top 20 pages
    });

    const pages: Ga4PageMetrics[] = (pagesResponse.rows || []).map((row: any) => ({
      pagePath: row.dimensionValues?.[0]?.value || '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      engagedSessions: parseInt(row.metricValues?.[1]?.value || '0'),
      engagementRate: parseFloat(row.metricValues?.[2]?.value || '0'),
      conversions: parseInt(row.metricValues?.[3]?.value || '0'),
    }));

    console.log(`[GA4 Client] Fetched ${pages.length} pages`);

    // ========================================================================
    // 3. Fetch Channel Breakdown
    // ========================================================================

    const [channelsResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionDefaultChannelGroup' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'conversions' },
      ],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
    });

    const channels: Ga4ChannelMetrics[] = (channelsResponse.rows || []).map((row: any) => ({
      channelGroup: row.dimensionValues?.[0]?.value || '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      engagedSessions: parseInt(row.metricValues?.[1]?.value || '0'),
      conversions: parseInt(row.metricValues?.[2]?.value || '0'),
    }));

    console.log(`[GA4 Client] Fetched ${channels.length} channels`);

    // ========================================================================
    // 4. Return Snapshot
    // ========================================================================

    return {
      overview,
      pages,
      channels,
      dateRange: {
        startDate,
        endDate,
      },
    };
  } catch (error) {
    // Graceful error handling - don't throw
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GA4 Client] Failed to fetch GA4 data:', errorMsg);

    // Return empty snapshot instead of null to provide some structure
    return {
      overview: {
        totalSessions: 0,
        totalUsers: 0,
        totalEngagedSessions: 0,
        totalConversions: 0,
        engagementRate: 0,
      },
      pages: [],
      channels: [],
      dateRange: {
        startDate: `${daysAgo}daysAgo`,
        endDate: 'today',
      },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if GA4 client is properly configured
 */
export function isGA4Configured(): boolean {
  return !!env.GA4_SERVICE_ACCOUNT_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

/**
 * Validate GA4 Property ID format
 */
export function isValidPropertyId(propertyId?: string): boolean {
  if (!propertyId) return false;
  // GA4 property IDs are typically numeric (9-10 digits)
  return /^\d{9,10}$/.test(propertyId);
}
