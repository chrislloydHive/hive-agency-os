// lib/media/sources/ga4.ts
// Google Analytics 4 Source Adapter
//
// Fetches analytics data from GA4 and transforms to RawMediaEvent format.
// Captures website conversions, traffic sources, and engagement metrics.

import type {
  RawMediaEvent,
  MediaSourceConfig,
  MediaEventsFetchConfig,
  MediaEventsFetchResult,
  MediaSourceAdapter,
} from '../performanceTypes';

/**
 * Fetch media events from Google Analytics 4
 *
 * TODO: Implement real GA4 API integration
 * - Use Google Analytics Data API (v1beta)
 * - Authenticate with service account
 * - Query runReport with dimensions: date, sessionSource, sessionMedium
 * - Query metrics: sessions, conversions, totalRevenue
 */
export async function fetchGa4MediaEvents(
  config: MediaSourceConfig,
  params: MediaEventsFetchConfig
): Promise<MediaEventsFetchResult> {
  // TODO: Implement real GA4 API integration
  //
  // Example implementation outline:
  // 1. Authenticate with service account using ga4ServiceAccountKey
  // 2. Call analyticsData.properties.runReport with:
  //    - property: `properties/${config.ga4PropertyId}`
  //    - dateRanges: [{ startDate: params.startDate, endDate: params.endDate }]
  //    - dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }]
  //    - metrics: [{ name: 'sessions' }, { name: 'conversions' }, { name: 'totalRevenue' }]
  // 3. Transform rows to RawMediaEvent format
  //
  // For now, return empty result (stub)

  if (!config.enabled || !config.ga4PropertyId) {
    return {
      source: 'ga4',
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'GA4 not configured',
    };
  }

  // Stub: Return empty events
  // In production, this would make actual API calls
  const events: RawMediaEvent[] = [];

  return {
    source: 'ga4',
    events,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GA4 Source Adapter
 */
export const ga4Adapter: MediaSourceAdapter = {
  source: 'ga4',
  fetchEvents: fetchGa4MediaEvents,
};

/**
 * Map GA4 source/medium to our channel taxonomy
 */
export function mapGa4SourceToChannel(
  source: string,
  medium: string
): 'search' | 'social' | 'display' | 'email' | 'other' {
  const sourceLower = source.toLowerCase();
  const mediumLower = medium.toLowerCase();

  // Search
  if (mediumLower === 'cpc' || mediumLower === 'ppc') {
    if (sourceLower.includes('google') || sourceLower.includes('bing')) {
      return 'search';
    }
  }

  // Social
  if (mediumLower === 'social' || mediumLower === 'paid_social') {
    return 'social';
  }
  if (['facebook', 'instagram', 'meta', 'tiktok', 'twitter'].some(s => sourceLower.includes(s))) {
    return 'social';
  }

  // Display
  if (mediumLower === 'display' || mediumLower === 'banner' || mediumLower === 'cpm') {
    return 'display';
  }

  // Email
  if (mediumLower === 'email') {
    return 'email';
  }

  return 'other';
}
