// lib/media/sources/callrail.ts
// CallRail Source Adapter
//
// Fetches call tracking data from CallRail API.
// Captures calls, duration, and source attribution.

import type {
  RawMediaEvent,
  MediaSourceConfig,
  MediaEventsFetchConfig,
  MediaEventsFetchResult,
  MediaSourceAdapter,
} from '../performanceTypes';

/**
 * Fetch media events from CallRail
 *
 * TODO: Implement real CallRail API integration
 * - Use CallRail API v3
 * - Authenticate with API key
 * - Query calls.json endpoint
 * - Transform to RawMediaEvent format
 */
export async function fetchCallrailMediaEvents(
  config: MediaSourceConfig,
  params: MediaEventsFetchConfig
): Promise<MediaEventsFetchResult> {
  // TODO: Implement real CallRail API integration
  //
  // Example implementation outline:
  // 1. Set Authorization header with config.callrailApiKey
  // 2. Call GET /v3/a/{account_id}/calls.json with:
  //    - start_date/end_date filters
  //    - per_page: 250
  //    - fields: duration, source, first_call, etc.
  // 3. Handle pagination with page parameter
  // 4. Transform calls to RawMediaEvent format with:
  //    - channel: inferred from source/tracking_number
  //    - calls: 1 per call
  //    - qualifiedCalls: 1 if duration >= 60s (configurable threshold)
  //    - callDurationSeconds: actual duration
  //
  // For now, return empty result (stub)

  if (!config.enabled || !config.callrailAccountId || !config.callrailApiKey) {
    return {
      source: 'callrail',
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'CallRail not configured',
    };
  }

  // Stub: Return empty events
  const events: RawMediaEvent[] = [];

  return {
    source: 'callrail',
    events,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * CallRail Source Adapter
 */
export const callrailAdapter: MediaSourceAdapter = {
  source: 'callrail',
  fetchEvents: fetchCallrailMediaEvents,
};

/**
 * Infer channel from CallRail source/tracking number name
 */
export function inferChannelFromCallrailSource(
  source: string,
  trackingNumberName?: string
): 'search' | 'social' | 'lsa' | 'radio' | 'other' {
  const combined = `${source} ${trackingNumberName || ''}`.toLowerCase();

  if (combined.includes('google') || combined.includes('search') || combined.includes('ppc')) {
    return 'search';
  }
  if (combined.includes('lsa') || combined.includes('local service')) {
    return 'lsa';
  }
  if (combined.includes('facebook') || combined.includes('social') || combined.includes('meta')) {
    return 'social';
  }
  if (combined.includes('radio') || combined.includes('broadcast')) {
    return 'radio';
  }

  return 'other';
}
