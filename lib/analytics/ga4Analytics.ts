// lib/analytics/ga4Analytics.ts
// GA4 Analytics Data API integration for Growth Analytics

import { TrafficSummary, ChannelSummary, LandingPageSummary } from './models';
import { getGa4Client, getGa4PropertyId } from './googleAuth';
import { getSiteConfig, getDefaultSite } from './sites';

/**
 * Fetches GA4 analytics snapshot for the specified date range
 * Returns traffic summary, channels, and top landing pages
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param siteId - Optional site ID (defaults to first configured site)
 */
export async function getGa4AnalyticsSnapshot(
  startDate: string,
  endDate: string,
  siteId?: string
): Promise<{
  traffic: TrafficSummary;
  channels: ChannelSummary[];
  topLandingPages: LandingPageSummary[];
}> {
  // Get site config
  const site = siteId ? getSiteConfig(siteId) : getDefaultSite();
  const propertyId = site?.ga4PropertyId || process.env.GA4_PROPERTY_ID;

  // Check for required credentials before attempting to create client
  const hasCredentials = process.env.GOOGLE_CLIENT_ID &&
                         process.env.GOOGLE_CLIENT_SECRET &&
                         process.env.GOOGLE_REFRESH_TOKEN &&
                         propertyId;

  if (!hasCredentials) {
    console.warn('[GA4] Skipping analytics - missing Google OAuth credentials or GA4 property ID', { siteId });
    return {
      traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
      channels: [],
      topLandingPages: [],
    };
  }

  try {
    const client = getGa4Client();

    console.log('[GA4] Fetching analytics for', { startDate, endDate, propertyId, siteId: site?.id });

    // Run all three queries in parallel
    const [trafficData, channelsData, landingPagesData] = await Promise.all([
      fetchTrafficSummary(client, propertyId, startDate, endDate),
      fetchChannelsSummary(client, propertyId, startDate, endDate),
      fetchLandingPages(client, propertyId, startDate, endDate),
    ]);

    return {
      traffic: trafficData,
      channels: channelsData,
      topLandingPages: landingPagesData,
    };
  } catch (error) {
    console.error('[GA4] Error fetching analytics:', error);

    // Return empty/null data on failure
    return {
      traffic: {
        users: null,
        sessions: null,
        pageviews: null,
        avgSessionDurationSeconds: null,
        bounceRate: null,
      },
      channels: [],
      topLandingPages: [],
    };
  }
}

/**
 * Fetch traffic summary metrics
 */
async function fetchTrafficSummary(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<TrafficSummary> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      console.log('[GA4] No traffic data found');
      return {
        users: null,
        sessions: null,
        pageviews: null,
        avgSessionDurationSeconds: null,
        bounceRate: null,
      };
    }

    const row = response.rows[0];
    const metrics = row.metricValues || [];

    return {
      users: metrics[0]?.value ? parseInt(metrics[0].value) : null,
      sessions: metrics[1]?.value ? parseInt(metrics[1].value) : null,
      pageviews: metrics[2]?.value ? parseInt(metrics[2].value) : null,
      avgSessionDurationSeconds: metrics[3]?.value ? parseFloat(metrics[3].value) : null,
      bounceRate: metrics[4]?.value ? parseFloat(metrics[4].value) : null,
    };
  } catch (error) {
    console.error('[GA4] Error fetching traffic summary:', error);
    return {
      users: null,
      sessions: null,
      pageviews: null,
      avgSessionDurationSeconds: null,
      bounceRate: null,
    };
  }
}

/**
 * Fetch channels breakdown
 */
async function fetchChannelsSummary(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ChannelSummary[]> {
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
      console.log('[GA4] No channels data found');
      return [];
    }

    return response.rows.map((row: any) => {
      const channel = row.dimensionValues?.[0]?.value || '(not set)';
      const metrics = row.metricValues || [];

      return {
        channel: channel === '(not set)' ? 'Unattributed' : channel,
        sessions: metrics[0]?.value ? parseInt(metrics[0].value) : 0,
        users: metrics[1]?.value ? parseInt(metrics[1].value) : null,
        conversions: metrics[2]?.value ? parseInt(metrics[2].value) : null,
      };
    });
  } catch (error) {
    console.error('[GA4] Error fetching channels:', error);
    return [];
  }
}

/**
 * Fetch top landing pages
 */
async function fetchLandingPages(
  client: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<LandingPageSummary[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'userEngagementDuration' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    });

    if (!response.rows || response.rows.length === 0) {
      console.log('[GA4] No landing pages data found');
      return [];
    }

    return response.rows.map((row: any) => {
      const path = row.dimensionValues?.[0]?.value || '/';
      const metrics = row.metricValues || [];

      const sessions = metrics[0]?.value ? parseInt(metrics[0].value) : 0;
      const engagementDuration = metrics[3]?.value ? parseFloat(metrics[3].value) : 0;

      // Calculate avg engagement time per session
      const avgEngagementTime = sessions > 0 ? engagementDuration / sessions : null;

      return {
        path,
        sessions,
        users: metrics[1]?.value ? parseInt(metrics[1].value) : null,
        conversions: metrics[2]?.value ? parseInt(metrics[2].value) : null,
        avgEngagementTimeSeconds: avgEngagementTime,
      };
    });
  } catch (error) {
    console.error('[GA4] Error fetching landing pages:', error);
    return [];
  }
}
