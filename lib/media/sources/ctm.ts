// lib/media/sources/ctm.ts
// CallTrackingMetrics (CTM) Source Adapter
//
// Fetches call tracking data from CTM API.
// Captures calls, duration, and source attribution.

import type {
  RawMediaEvent,
  MediaSourceConfig,
  MediaEventsFetchConfig,
  MediaEventsFetchResult,
  MediaSourceAdapter,
} from '../performanceTypes';

/**
 * Fetch media events from CallTrackingMetrics
 *
 * TODO: Implement real CTM API integration
 * - Use CTM API
 * - Authenticate with API key
 * - Query calls endpoint
 * - Transform to RawMediaEvent format
 */
export async function fetchCtmMediaEvents(
  config: MediaSourceConfig,
  params: MediaEventsFetchConfig
): Promise<MediaEventsFetchResult> {
  // TODO: Implement real CTM API integration
  //
  // Example implementation outline:
  // 1. Authenticate with config.ctmApiKey
  // 2. Call GET /api/v1/accounts/{account_id}/calls with:
  //    - start_date/end_date filters
  // 3. Handle pagination
  // 4. Transform calls to RawMediaEvent format with:
  //    - channel: inferred from source
  //    - calls: 1 per call
  //    - qualifiedCalls: based on duration threshold
  //
  // For now, return empty result (stub)

  if (!config.enabled || !config.ctmAccountId || !config.ctmApiKey) {
    return {
      source: 'ctm',
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'CTM not configured',
    };
  }

  // Stub: Return empty events
  const events: RawMediaEvent[] = [];

  return {
    source: 'ctm',
    events,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * CTM Source Adapter
 */
export const ctmAdapter: MediaSourceAdapter = {
  source: 'ctm',
  fetchEvents: fetchCtmMediaEvents,
};
