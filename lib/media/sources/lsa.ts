// lib/media/sources/lsa.ts
// Google Local Services Ads Source Adapter
//
// Fetches lead and performance data from Google LSA.
// Captures leads, spend, and call metrics.

import type {
  RawMediaEvent,
  MediaSourceConfig,
  MediaEventsFetchConfig,
  MediaEventsFetchResult,
  MediaSourceAdapter,
} from '../performanceTypes';

/**
 * Fetch media events from Google Local Services Ads
 *
 * TODO: Implement real LSA API integration
 * - Use Local Services API
 * - Authenticate with OAuth
 * - Query detailed lead reports
 * - Transform to RawMediaEvent format
 */
export async function fetchLsaMediaEvents(
  config: MediaSourceConfig,
  params: MediaEventsFetchConfig
): Promise<MediaEventsFetchResult> {
  // TODO: Implement real LSA API integration
  //
  // Example implementation outline:
  // 1. Authenticate with OAuth
  // 2. Call localservices.detailedLeadReports.search with:
  //    - startDate/endDate filters
  //    - Account ID from config.lsaAccountId
  // 3. Also fetch aggregate metrics if available
  // 4. Transform leads to RawMediaEvent format with:
  //    - channel: 'lsa'
  //    - leads: 1 per lead
  //    - calls: 1 if lead type is phone
  //
  // For now, return empty result (stub)

  if (!config.enabled || !config.lsaAccountId) {
    return {
      source: 'lsa',
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'LSA not configured',
    };
  }

  // Stub: Return empty events
  const events: RawMediaEvent[] = [];

  return {
    source: 'lsa',
    events,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * LSA Source Adapter
 */
export const lsaAdapter: MediaSourceAdapter = {
  source: 'lsa',
  fetchEvents: fetchLsaMediaEvents,
};
