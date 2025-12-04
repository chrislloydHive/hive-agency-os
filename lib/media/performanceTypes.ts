// lib/media/performanceTypes.ts
// Unified Performance Data Contract
//
// Defines a standard interface for ingesting media performance data ("actuals")
// from multiple sources. Each source adapter transforms raw API data into
// RawMediaEvent objects that can be aggregated by the cockpit.
//
// Sources:
// - ga4: Google Analytics 4 (analytics data)
// - google_ads: Google Ads (campaign performance)
// - gbp: Google Business Profile (Maps/local data)
// - lsa: Google Local Services Ads
// - callrail: CallRail call tracking
// - ctm: CallTrackingMetrics

import type { MediaChannel } from './types';
import type { MediaProvider } from '@/lib/types/media';

// ============================================================================
// Source Types
// ============================================================================

/**
 * Data sources for media actuals
 */
export type MediaActualsSource =
  | 'ga4'           // Google Analytics 4
  | 'google_ads'    // Google Ads
  | 'gbp'           // Google Business Profile
  | 'lsa'           // Local Services Ads
  | 'callrail'      // CallRail
  | 'ctm'           // CallTrackingMetrics
  | 'meta_ads'      // Meta Ads Manager
  | 'microsoft_ads' // Microsoft/Bing Ads
  | 'manual';       // Manual import

/**
 * Simplified channel for event categorization
 */
export type MediaEventChannel =
  | 'search'
  | 'social'
  | 'maps'
  | 'lsa'
  | 'radio'
  | 'display'
  | 'youtube'
  | 'email'
  | 'other';

// ============================================================================
// Raw Event Types
// ============================================================================

/**
 * Raw media event - the unified contract for all actuals data
 *
 * Each source adapter transforms its raw API response into this format.
 * Events are then aggregated by the cockpit for dashboards and reporting.
 */
export interface RawMediaEvent {
  // Identity
  id: string;                           // Unique event ID (source-specific)
  companyId: string;                    // Company this event belongs to
  mediaProgramId?: string;              // Optional link to Media Program
  storeId?: string;                     // Optional store attribution

  // Source and classification
  source: MediaActualsSource;           // Which source provided this data
  channel: MediaEventChannel;           // Simplified channel category
  provider?: MediaProvider;             // Specific provider (google_ads, meta_ads, etc.)

  // Temporal
  date: string;                         // YYYY-MM-DD format
  timestamp?: string;                   // ISO 8601 timestamp if available

  // Core metrics (all optional - depends on source capabilities)
  spend?: number;                       // Amount spent in USD
  impressions?: number;                 // Number of impressions
  clicks?: number;                      // Number of clicks
  leads?: number;                       // Form fills, chat starts, etc.
  calls?: number;                       // Phone calls
  installs?: number;                    // Product installs (for auto retailers)

  // Additional metrics
  conversions?: number;                 // Generic conversions
  revenue?: number;                     // Revenue attributed
  directions?: number;                  // Direction requests (Maps)
  bookings?: number;                    // Appointments/bookings

  // Quality metrics
  qualifiedCalls?: number;              // Calls meeting duration threshold
  callDurationSeconds?: number;         // Total call duration

  // Engagement metrics
  videoViews?: number;                  // YouTube/video views
  engagements?: number;                 // Social engagements

  // Source-specific metadata
  meta?: Record<string, any>;           // Raw data from source for debugging
}

// ============================================================================
// Fetch Configuration
// ============================================================================

/**
 * Configuration for fetching media events from a source
 */
export interface MediaEventsFetchConfig {
  companyId: string;
  startDate: string;                    // YYYY-MM-DD
  endDate: string;                      // YYYY-MM-DD
  storeId?: string;                     // Optional store filter
  mediaProgramId?: string;              // Optional program filter
}

/**
 * Result from a source fetch operation
 */
export interface MediaEventsFetchResult {
  source: MediaActualsSource;
  events: RawMediaEvent[];
  fetchedAt: string;                    // ISO 8601 timestamp
  hasMore?: boolean;                    // Pagination indicator
  cursor?: string;                      // Pagination cursor
  error?: string;                       // Error message if partial failure
}

// ============================================================================
// Source Adapter Interface
// ============================================================================

/**
 * Source-specific configuration for API access
 */
export interface MediaSourceConfig {
  // Common
  enabled: boolean;

  // GA4
  ga4PropertyId?: string;
  ga4ServiceAccountKey?: string;

  // Google Ads
  googleAdsCustomerId?: string;
  googleAdsRefreshToken?: string;

  // GBP
  gbpAccountId?: string;
  gbpLocationIds?: string[];

  // LSA
  lsaAccountId?: string;

  // CallRail
  callrailAccountId?: string;
  callrailApiKey?: string;

  // CTM
  ctmAccountId?: string;
  ctmApiKey?: string;

  // Meta Ads
  metaAccessToken?: string;
  metaAdAccountId?: string;

  // Microsoft Ads
  microsoftCustomerId?: string;
  microsoftRefreshToken?: string;
}

/**
 * Interface for source adapters
 */
export interface MediaSourceAdapter {
  source: MediaActualsSource;
  fetchEvents: (
    config: MediaSourceConfig,
    params: MediaEventsFetchConfig
  ) => Promise<MediaEventsFetchResult>;
}

// ============================================================================
// Aggregation Types
// ============================================================================

/**
 * Aggregated metrics from raw events
 */
export interface AggregatedMediaMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  installs: number;
  conversions: number;
  qualifiedCalls: number;
  directions: number;

  // Computed
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cpa: number | null;
}

/**
 * Helper to aggregate RawMediaEvent[] into AggregatedMediaMetrics
 */
export function aggregateMediaEvents(events: RawMediaEvent[]): AggregatedMediaMetrics {
  const totals = events.reduce(
    (acc, e) => ({
      spend: acc.spend + (e.spend || 0),
      impressions: acc.impressions + (e.impressions || 0),
      clicks: acc.clicks + (e.clicks || 0),
      leads: acc.leads + (e.leads || 0),
      calls: acc.calls + (e.calls || 0),
      installs: acc.installs + (e.installs || 0),
      conversions: acc.conversions + (e.conversions || 0),
      qualifiedCalls: acc.qualifiedCalls + (e.qualifiedCalls || 0),
      directions: acc.directions + (e.directions || 0),
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      calls: 0,
      installs: 0,
      conversions: 0,
      qualifiedCalls: 0,
      directions: 0,
    }
  );

  const totalLeads = totals.leads + totals.calls;

  return {
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
    cpl: totalLeads > 0 ? totals.spend / totalLeads : null,
    cpa: totals.installs > 0 ? totals.spend / totals.installs : null,
  };
}

/**
 * Group events by a key function
 */
export function groupMediaEvents<K extends string>(
  events: RawMediaEvent[],
  keyFn: (e: RawMediaEvent) => K
): Map<K, RawMediaEvent[]> {
  const grouped = new Map<K, RawMediaEvent[]>();

  for (const event of events) {
    const key = keyFn(event);
    const existing = grouped.get(key) || [];
    existing.push(event);
    grouped.set(key, existing);
  }

  return grouped;
}

/**
 * Group events by channel and aggregate
 */
export function aggregateByChannel(
  events: RawMediaEvent[]
): Map<MediaEventChannel, AggregatedMediaMetrics> {
  const grouped = groupMediaEvents(events, (e) => e.channel);
  const result = new Map<MediaEventChannel, AggregatedMediaMetrics>();

  for (const [channel, channelEvents] of grouped) {
    result.set(channel, aggregateMediaEvents(channelEvents));
  }

  return result;
}

/**
 * Group events by store and aggregate
 */
export function aggregateByStore(
  events: RawMediaEvent[]
): Map<string, AggregatedMediaMetrics> {
  const grouped = groupMediaEvents(events, (e) => e.storeId || 'unassigned');
  const result = new Map<string, AggregatedMediaMetrics>();

  for (const [storeId, storeEvents] of grouped) {
    result.set(storeId, aggregateMediaEvents(storeEvents));
  }

  return result;
}

/**
 * Group events by date and aggregate
 */
export function aggregateByDate(
  events: RawMediaEvent[]
): Map<string, AggregatedMediaMetrics> {
  const grouped = groupMediaEvents(events, (e) => e.date);
  const result = new Map<string, AggregatedMediaMetrics>();

  for (const [date, dateEvents] of grouped) {
    result.set(date, aggregateMediaEvents(dateEvents));
  }

  return result;
}

// ============================================================================
// Channel Mapping Helpers
// ============================================================================

/**
 * Map MediaChannel to MediaEventChannel for simplified aggregation
 */
export function mapChannelToEventChannel(channel: MediaChannel): MediaEventChannel {
  switch (channel) {
    case 'search':
    case 'microsoft_search':
      return 'search';
    case 'social':
    case 'tiktok':
      return 'social';
    case 'maps':
      return 'maps';
    case 'lsa':
      return 'lsa';
    case 'radio':
    case 'tv':
    case 'streaming_audio':
      return 'radio'; // Grouped as traditional audio/video
    case 'display':
    case 'out_of_home':
    case 'print':
    case 'direct_mail':
      return 'display'; // Grouped as display/awareness
    case 'youtube':
      return 'youtube';
    case 'email':
    case 'affiliate':
      return 'email';
    default:
      return 'other';
  }
}

/**
 * Get display label for event channel
 */
export const EVENT_CHANNEL_LABELS: Record<MediaEventChannel, string> = {
  search: 'Search',
  social: 'Social',
  maps: 'Maps/GBP',
  lsa: 'Local Services Ads',
  radio: 'Radio/Audio',
  display: 'Display',
  youtube: 'YouTube',
  email: 'Email/Affiliate',
  other: 'Other',
};

// ============================================================================
// Date Range Helpers
// ============================================================================

/**
 * Get comparison date range for YoY or previous period
 */
export function getComparisonDateRange(
  startDate: string,
  endDate: string,
  compareTo: 'prev_period' | 'prev_year'
): { startDate: string; endDate: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (compareTo === 'prev_year') {
    const prevStart = new Date(start);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    const prevEnd = new Date(end);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);

    return {
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0],
    };
  }

  // prev_period: shift back by the same number of days
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0],
  };
}
