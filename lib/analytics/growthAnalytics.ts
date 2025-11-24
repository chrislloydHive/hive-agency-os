// lib/analytics/growthAnalytics.ts
// Unified Growth Analytics combining GA4 and Search Console data

import { GrowthAnalyticsSnapshot } from './models';
import { getGa4AnalyticsSnapshot } from './ga4Analytics';
import { getSearchConsoleSnapshot } from './searchConsoleAnalytics';

/**
 * Fetches unified growth analytics snapshot combining GA4 and Search Console data
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Complete growth analytics snapshot
 */
export async function getGrowthAnalyticsSnapshot(
  startDate: string,
  endDate: string
): Promise<GrowthAnalyticsSnapshot> {
  console.log('[Growth Analytics] Fetching snapshot for', { startDate, endDate });

  try {
    // Fetch GA4 and Search Console data in parallel
    const [ga4Data, searchConsoleData] = await Promise.all([
      getGa4AnalyticsSnapshot(startDate, endDate).catch((error) => {
        console.error('[Growth Analytics] GA4 fetch failed:', error);
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
      }),
      getSearchConsoleSnapshot(startDate, endDate).catch((error) => {
        console.error('[Growth Analytics] Search Console fetch failed:', error);
        return {
          queries: [],
          pages: [],
        };
      }),
    ]);

    const snapshot: GrowthAnalyticsSnapshot = {
      range: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      traffic: ga4Data.traffic,
      channels: ga4Data.channels,
      topLandingPages: ga4Data.topLandingPages,
      searchQueries: searchConsoleData.queries,
      searchPages: searchConsoleData.pages,
      notes: [],
    };

    // Add diagnostic notes
    if (ga4Data.traffic.users === null) {
      snapshot.notes?.push('GA4 data unavailable');
    }
    if (searchConsoleData.queries.length === 0) {
      snapshot.notes?.push('Search Console data unavailable');
    }

    console.log('[Growth Analytics] Snapshot generated successfully', {
      hasTraffic: snapshot.traffic.users !== null,
      channelsCount: snapshot.channels.length,
      landingPagesCount: snapshot.topLandingPages.length,
      queriesCount: snapshot.searchQueries.length,
      pagesCount: snapshot.searchPages.length,
    });

    return snapshot;
  } catch (error) {
    console.error('[Growth Analytics] Error generating snapshot:', error);
    throw error;
  }
}

/**
 * Helper to get default date range (last N days)
 */
export function getDefaultDateRange(days: number = 30): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}
