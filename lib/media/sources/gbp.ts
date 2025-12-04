// lib/media/sources/gbp.ts
// Google Business Profile Source Adapter
//
// Fetches local presence metrics from Google Business Profile API.
// Captures views, searches, direction requests, and calls.

import type {
  RawMediaEvent,
  MediaSourceConfig,
  MediaEventsFetchConfig,
  MediaEventsFetchResult,
  MediaSourceAdapter,
} from '../performanceTypes';

/**
 * Fetch media events from Google Business Profile
 *
 * TODO: Implement real GBP API integration
 * - Use Business Profile Performance API
 * - Authenticate with OAuth
 * - Query location insights
 * - Transform to RawMediaEvent format
 */
export async function fetchGbpMediaEvents(
  config: MediaSourceConfig,
  params: MediaEventsFetchConfig
): Promise<MediaEventsFetchResult> {
  // TODO: Implement real GBP API integration
  //
  // Example implementation outline:
  // 1. Authenticate with OAuth
  // 2. For each location in config.gbpLocationIds:
  //    - Call businessprofileperformance.locations.fetchMultiDailyMetricsTimeSeries
  //    - Request metrics: BUSINESS_IMPRESSIONS_DESKTOP_MAPS, BUSINESS_IMPRESSIONS_MOBILE_MAPS,
  //                       CALL_CLICKS, WEBSITE_CLICKS, BUSINESS_DIRECTION_REQUESTS
  // 3. Transform daily metrics to RawMediaEvent format
  //
  // For now, return empty result (stub)

  if (!config.enabled || !config.gbpAccountId) {
    return {
      source: 'gbp',
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'GBP not configured',
    };
  }

  // Stub: Return empty events
  const events: RawMediaEvent[] = [];

  return {
    source: 'gbp',
    events,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GBP Source Adapter
 */
export const gbpAdapter: MediaSourceAdapter = {
  source: 'gbp',
  fetchEvents: fetchGbpMediaEvents,
};
