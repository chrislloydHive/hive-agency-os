// lib/types/media.ts
// TypeScript types for the Media module
//
// Represents performance media data structures for clients like Car Toys:
// - Programs (strategic media initiatives)
// - Campaigns (individual channel executions)
// - Markets (geographic territories)
// - Stores (physical locations)
// - Performance (metrics fact table)
//
// PROVIDER/CHANNEL/DATA SOURCE ARCHITECTURE:
// - MediaProvider: The platform or vendor providing the data (Google Ads, Meta, Radio Vendor, etc.)
// - MediaChannel: The type of advertising channel (Search, Social, Radio, etc.)
// - MediaDataSourceType: How the data is ingested (API, manual import, vendor feed)
// - AttributionModel: How conversions are attributed (direct, blended, lift-based)
//
// To add a new provider (e.g., "Spotify Ads / streaming audio"):
// 1. Add to MediaProvider type: 'spotify_ads'
// 2. Add to MEDIA_PROVIDER_OPTIONS with label
// 3. Add to MEDIA_PROVIDER_CONFIG for UI styling
// 4. Add appropriate channel if new (e.g., 'streaming_audio')
// 5. Create ingest handler in lib/integrations/media/ if API-based
// 6. Set default attributionModel based on measurement capabilities

// ============================================================================
// Provider Types (Platform/Vendor)
// ============================================================================

/**
 * MediaProvider - The platform or vendor providing media/analytics data
 *
 * Digital advertising platforms:
 * - google_ads: Google Search, Display, YouTube via Google Ads
 * - meta_ads: Facebook, Instagram via Meta Ads Manager
 * - microsoft_ads: Bing, LinkedIn via Microsoft Advertising
 * - tiktok_ads: TikTok Ads Manager
 * - youtube_ads: YouTube-specific campaigns (subset of google_ads)
 * - dv360: Display & Video 360 (programmatic)
 *
 * Google ecosystem:
 * - ga4: Google Analytics 4 (analytics-only data)
 * - lsa: Google Local Services Ads
 * - gbp: Google Business Profile (organic Maps/Search)
 *
 * Traditional/Offline:
 * - radio_vendor: Radio station or radio ad network
 * - tv_vendor: Television advertising vendor
 * - ooh_vendor: Out-of-home advertising vendor (billboards, transit, etc.)
 * - streaming_audio_vendor: Spotify, Pandora, iHeartRadio, etc.
 * - print_vendor: Print advertising (newspapers, magazines)
 * - direct_mail_vendor: Direct mail campaigns
 *
 * Other:
 * - other: Catch-all for unlisted providers
 */
export type MediaProvider =
  // Digital advertising platforms
  | 'google_ads'
  | 'meta_ads'
  | 'microsoft_ads'
  | 'tiktok_ads'
  | 'youtube_ads'
  | 'dv360'
  // Google ecosystem
  | 'ga4'
  | 'lsa'
  | 'gbp'
  // Traditional/Offline vendors
  | 'radio_vendor'
  | 'tv_vendor'
  | 'ooh_vendor'
  | 'streaming_audio_vendor'
  | 'print_vendor'
  | 'direct_mail_vendor'
  // Other
  | 'other';

/**
 * Provider display options for UI forms
 */
export const MEDIA_PROVIDER_OPTIONS: { value: MediaProvider; label: string; category: 'digital' | 'google' | 'traditional' | 'other' }[] = [
  // Digital advertising platforms
  { value: 'google_ads', label: 'Google Ads', category: 'digital' },
  { value: 'meta_ads', label: 'Meta Ads (Facebook/Instagram)', category: 'digital' },
  { value: 'microsoft_ads', label: 'Microsoft Ads (Bing)', category: 'digital' },
  { value: 'tiktok_ads', label: 'TikTok Ads', category: 'digital' },
  { value: 'youtube_ads', label: 'YouTube Ads', category: 'digital' },
  { value: 'dv360', label: 'Display & Video 360', category: 'digital' },
  // Google ecosystem
  { value: 'ga4', label: 'Google Analytics 4', category: 'google' },
  { value: 'lsa', label: 'Google Local Services Ads', category: 'google' },
  { value: 'gbp', label: 'Google Business Profile', category: 'google' },
  // Traditional/Offline
  { value: 'radio_vendor', label: 'Radio', category: 'traditional' },
  { value: 'tv_vendor', label: 'Television', category: 'traditional' },
  { value: 'ooh_vendor', label: 'Out-of-Home (OOH)', category: 'traditional' },
  { value: 'streaming_audio_vendor', label: 'Streaming Audio (Spotify, etc.)', category: 'traditional' },
  { value: 'print_vendor', label: 'Print', category: 'traditional' },
  { value: 'direct_mail_vendor', label: 'Direct Mail', category: 'traditional' },
  // Other
  { value: 'other', label: 'Other', category: 'other' },
];

/**
 * Provider config for UI styling
 */
export const MEDIA_PROVIDER_CONFIG: Record<MediaProvider, { label: string; color: string; icon?: string }> = {
  google_ads: { label: 'Google Ads', color: 'text-blue-400' },
  meta_ads: { label: 'Meta Ads', color: 'text-pink-400' },
  microsoft_ads: { label: 'Microsoft Ads', color: 'text-cyan-400' },
  tiktok_ads: { label: 'TikTok Ads', color: 'text-slate-100' },
  youtube_ads: { label: 'YouTube Ads', color: 'text-red-400' },
  dv360: { label: 'DV360', color: 'text-purple-400' },
  ga4: { label: 'GA4', color: 'text-amber-400' },
  lsa: { label: 'LSAs', color: 'text-purple-400' },
  gbp: { label: 'GBP', color: 'text-emerald-400' },
  radio_vendor: { label: 'Radio', color: 'text-orange-400' },
  tv_vendor: { label: 'TV', color: 'text-indigo-400' },
  ooh_vendor: { label: 'OOH', color: 'text-teal-400' },
  streaming_audio_vendor: { label: 'Streaming Audio', color: 'text-green-400' },
  print_vendor: { label: 'Print', color: 'text-slate-400' },
  direct_mail_vendor: { label: 'Direct Mail', color: 'text-yellow-400' },
  other: { label: 'Other', color: 'text-slate-400' },
};

// ============================================================================
// Data Source Types
// ============================================================================

/**
 * MediaDataSourceType - How the media data is ingested
 *
 * - platform_api: Direct integration with advertising platform APIs (Google Ads, Meta, etc.)
 * - analytics_api: Data from analytics platforms (GA4, GSC)
 * - manual_import: CSV upload, Airtable entry, or other manual data entry
 * - vendor_feed: Automated or semi-automated vendor data exports (radio post-logs, etc.)
 */
export type MediaDataSourceType =
  | 'platform_api'
  | 'analytics_api'
  | 'manual_import'
  | 'vendor_feed';

/**
 * Data source options for UI forms
 */
export const MEDIA_DATASOURCE_OPTIONS: { value: MediaDataSourceType; label: string; description: string }[] = [
  { value: 'platform_api', label: 'Platform API', description: 'Direct integration with ad platform' },
  { value: 'analytics_api', label: 'Analytics API', description: 'From GA4 or other analytics' },
  { value: 'manual_import', label: 'Manual Import', description: 'CSV, spreadsheet, or manual entry' },
  { value: 'vendor_feed', label: 'Vendor Feed', description: 'Automated vendor data export' },
];

/**
 * Data source config for UI styling
 */
export const MEDIA_DATASOURCE_CONFIG: Record<MediaDataSourceType, { label: string; color: string; icon?: string }> = {
  platform_api: { label: 'API', color: 'text-emerald-400' },
  analytics_api: { label: 'Analytics', color: 'text-blue-400' },
  manual_import: { label: 'Manual', color: 'text-amber-400' },
  vendor_feed: { label: 'Vendor Feed', color: 'text-purple-400' },
};

// ============================================================================
// Attribution Model Types
// ============================================================================

/**
 * AttributionModel - How conversions are attributed to media spend
 *
 * - direct: Last-click or direct conversion attribution (e.g., Google Ads conversions)
 * - blended: Modeled/blended attribution across touchpoints
 * - lift: Lift-based measurement (common for radio, TV, brand campaigns)
 * - unknown: Attribution model not specified or unclear
 */
export type AttributionModel =
  | 'direct'
  | 'blended'
  | 'lift'
  | 'unknown';

/**
 * Attribution model options for UI forms
 */
export const ATTRIBUTION_MODEL_OPTIONS: { value: AttributionModel; label: string; description: string }[] = [
  { value: 'direct', label: 'Direct', description: 'Last-click or direct conversion' },
  { value: 'blended', label: 'Blended', description: 'Modeled across touchpoints' },
  { value: 'lift', label: 'Lift-Based', description: 'Incrementality measurement' },
  { value: 'unknown', label: 'Unknown', description: 'Attribution not specified' },
];

/**
 * Attribution model config for UI styling
 */
export const ATTRIBUTION_MODEL_CONFIG: Record<AttributionModel, { label: string; color: string; description: string }> = {
  direct: { label: 'Direct', color: 'text-emerald-400', description: 'Last-click attribution' },
  blended: { label: 'Blended', color: 'text-blue-400', description: 'Modeled attribution' },
  lift: { label: 'Lift', color: 'text-purple-400', description: 'Incrementality-based' },
  unknown: { label: 'Unknown', color: 'text-slate-400', description: 'Not specified' },
};

// ============================================================================
// Enums & Constants (Original + Extended)
// ============================================================================

export type MediaProgramStatus = 'Planned' | 'Active' | 'Paused' | 'Completed';

export type MediaObjective = 'Installs' | 'Calls' | 'Store Visits' | 'Leads' | 'Traffic';

/**
 * MediaChannel - The type of advertising channel
 *
 * Extended to support both digital and traditional media:
 * - Digital: Search, Social, Video, Display, Retargeting, LSAs, Maps/Local, Email, Affiliate
 * - Traditional: Radio, TV, Streaming Audio, Out-of-Home, Print, Direct Mail
 */
export type MediaChannel =
  // Digital channels
  | 'Search'
  | 'Social'
  | 'Video'
  | 'Display'
  | 'Retargeting'
  | 'LSAs'
  | 'Maps'      // Maps/Local (keeping for backwards compatibility)
  | 'Email'
  | 'Affiliate'
  // Traditional channels
  | 'Radio'
  | 'TV'
  | 'Streaming Audio'
  | 'Out of Home'
  | 'Print'
  | 'Direct Mail'
  // Other
  | 'Other';

/**
 * Channel display options for UI forms
 */
export const MEDIA_CHANNEL_OPTIONS: { value: MediaChannel; label: string; category: 'digital' | 'traditional' | 'other' }[] = [
  // Digital
  { value: 'Search', label: 'Search', category: 'digital' },
  { value: 'Social', label: 'Social', category: 'digital' },
  { value: 'Video', label: 'Video', category: 'digital' },
  { value: 'Display', label: 'Display', category: 'digital' },
  { value: 'Retargeting', label: 'Retargeting', category: 'digital' },
  { value: 'LSAs', label: 'Local Services Ads', category: 'digital' },
  { value: 'Maps', label: 'Maps/Local', category: 'digital' },
  { value: 'Email', label: 'Email', category: 'digital' },
  { value: 'Affiliate', label: 'Affiliate', category: 'digital' },
  // Traditional
  { value: 'Radio', label: 'Radio', category: 'traditional' },
  { value: 'TV', label: 'Television', category: 'traditional' },
  { value: 'Streaming Audio', label: 'Streaming Audio', category: 'traditional' },
  { value: 'Out of Home', label: 'Out-of-Home (OOH)', category: 'traditional' },
  { value: 'Print', label: 'Print', category: 'traditional' },
  { value: 'Direct Mail', label: 'Direct Mail', category: 'traditional' },
  // Other
  { value: 'Other', label: 'Other', category: 'other' },
];

export type MediaCategory = 'CarPlay' | 'Remote Start' | 'Audio' | 'Tint' | 'Other';

export type MediaKPI = 'CPL' | 'CPBooking' | 'CPC' | 'CTR' | 'Store Visits' | 'Conversion Rate';

export type CallTrackingProvider = 'CallRail' | 'CTM' | 'Other';

// ============================================================================
// Metric Names (normalized enum for type safety)
// ============================================================================
//
// CONVENTIONS:
// - Percentages are stored as decimals (e.g., 0.238 for 23.8%)
// - Currency (spend) is stored in dollars as numbers (e.g., 1234.56)
// - Counts are stored as integers
// - Ratings are stored as decimals (e.g., 4.5 for 4.5 stars)
//
export type MetricName =
  // Visibility metrics (Maps/GBP/Search)
  | 'Impressions'
  | 'Search Impressions'
  | 'Maps Impressions'
  // Engagement metrics
  | 'Clicks'
  | 'CTR'
  | 'CPC'
  | 'Direction Requests'
  | 'Website Clicks'
  | 'Photo Views'
  // Spend metrics (always in dollars)
  | 'Spend'
  // Conversion metrics
  | 'Calls'
  | 'Qualified Calls'
  | 'LSAs Leads'
  | 'Leads'
  | 'Installs'
  | 'Bookings'
  | 'Store Visits'
  | 'Conversion Rate'
  | 'Cost Per Lead'
  | 'Cost Per Booking'
  // Review metrics
  | 'Reviews'
  | 'Review Rating'
  // GA4 specific
  | 'Sessions'
  | 'Users'
  | 'New Users'
  | 'Engaged Sessions'
  | 'Engagement Rate'
  | 'Bounce Rate'
  | 'Pages Per Session'
  | 'Avg Session Duration'
  // Custom/Other
  | 'Other';

export type MetricUnit = 'Count' | 'Percent' | 'Currency' | 'Rating' | 'Duration';

export type SourceSystem =
  | 'GA4'
  | 'Google Ads'
  | 'GBP'
  | 'LSAs'
  | 'CallRail'
  | 'CTM'
  | 'Manual'
  | 'Other';

// ============================================================================
// Metric Unit Mapping (for formatting/display)
// ============================================================================

export const METRIC_UNIT_MAP: Record<MetricName, MetricUnit> = {
  // Counts
  Impressions: 'Count',
  'Search Impressions': 'Count',
  'Maps Impressions': 'Count',
  Clicks: 'Count',
  'Direction Requests': 'Count',
  'Website Clicks': 'Count',
  'Photo Views': 'Count',
  Calls: 'Count',
  'Qualified Calls': 'Count',
  'LSAs Leads': 'Count',
  Leads: 'Count',
  Installs: 'Count',
  Bookings: 'Count',
  'Store Visits': 'Count',
  Reviews: 'Count',
  Sessions: 'Count',
  Users: 'Count',
  'New Users': 'Count',
  'Engaged Sessions': 'Count',
  // Percentages (stored as decimals 0-1)
  CTR: 'Percent',
  'Conversion Rate': 'Percent',
  'Engagement Rate': 'Percent',
  'Bounce Rate': 'Percent',
  // Currency (stored in dollars)
  Spend: 'Currency',
  CPC: 'Currency',
  'Cost Per Lead': 'Currency',
  'Cost Per Booking': 'Currency',
  // Ratings (e.g., 4.5 stars)
  'Review Rating': 'Rating',
  // Duration (in seconds)
  'Avg Session Duration': 'Duration',
  'Pages Per Session': 'Count',
  // Other
  Other: 'Count',
};

// ============================================================================
// Status Config (for UI badges)
// ============================================================================

export const MEDIA_STATUS_CONFIG: Record<MediaProgramStatus, { color: string; bgColor: string; borderColor: string }> = {
  Planned: { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  Active: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  Paused: { color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  Completed: { color: 'text-slate-400', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/30' },
};

export const MEDIA_CHANNEL_CONFIG: Record<MediaChannel, { color: string; label: string }> = {
  // Digital channels
  Search: { color: 'text-blue-400', label: 'Search' },
  Social: { color: 'text-pink-400', label: 'Social' },
  Video: { color: 'text-red-400', label: 'Video' },
  Display: { color: 'text-cyan-400', label: 'Display' },
  Retargeting: { color: 'text-indigo-400', label: 'Retargeting' },
  LSAs: { color: 'text-purple-400', label: 'LSAs' },
  Maps: { color: 'text-emerald-400', label: 'Maps' },
  Email: { color: 'text-yellow-400', label: 'Email' },
  Affiliate: { color: 'text-lime-400', label: 'Affiliate' },
  // Traditional channels
  Radio: { color: 'text-orange-400', label: 'Radio' },
  TV: { color: 'text-indigo-400', label: 'TV' },
  'Streaming Audio': { color: 'text-green-400', label: 'Streaming Audio' },
  'Out of Home': { color: 'text-teal-400', label: 'OOH' },
  Print: { color: 'text-slate-400', label: 'Print' },
  'Direct Mail': { color: 'text-yellow-400', label: 'Direct Mail' },
  // Other
  Other: { color: 'text-slate-400', label: 'Other' },
};

export const MEDIA_OBJECTIVE_CONFIG: Record<MediaObjective, { color: string; label: string }> = {
  Installs: { color: 'text-emerald-400', label: 'Installs' },
  Calls: { color: 'text-blue-400', label: 'Calls' },
  'Store Visits': { color: 'text-purple-400', label: 'Store Visits' },
  Leads: { color: 'text-amber-400', label: 'Leads' },
  Traffic: { color: 'text-cyan-400', label: 'Traffic' },
};

// ============================================================================
// Core Types
// ============================================================================

/**
 * MediaProgram - Strategic media program (e.g., "Always-On Install Demand – WA/CO")
 */
export interface MediaProgram {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  status: MediaProgramStatus;
  objective: MediaObjective;
  marketIds: string[];
  marketNames?: string[];
  primaryChannels: MediaChannel[];
  coreCategories: MediaCategory[];
  seasonal: boolean;
  startDate?: string;
  endDate?: string;
  primaryKPI?: MediaKPI;
  monthlyBudget?: number;
  notes?: string;
  linkedCampaignIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * MediaCampaign - Individual campaign/channel inside a program
 */
export interface MediaCampaign {
  id: string;
  companyId: string;
  companyName?: string;
  programId?: string;
  programName?: string;
  name: string;
  channel: MediaChannel;
  // NEW: Provider/Data Source/Attribution fields
  provider?: MediaProvider;
  dataSourceType?: MediaDataSourceType;
  attributionModel?: AttributionModel;
  // Location targeting
  marketId?: string;
  marketName?: string;
  storeIds: string[];
  storeNames?: string[];
  // Campaign config
  objective: MediaObjective;
  status: MediaProgramStatus;
  startDate?: string;
  endDate?: string;
  monthlyBudget?: number;
  bidStrategy?: string;
  keyKPI?: MediaKPI;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * MediaMarket - Geographic market (e.g., Seattle, Denver)
 */
export interface MediaMarket {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  region?: string;
  storeIds: string[];
  storeNames?: string[];
  visibilityScore?: number;
  demandScore?: number;
  conversionScore?: number;
  primaryCategories: MediaCategory[];
  competitors?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * MediaStore - Physical store location
 */
export interface MediaStore {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  storeCode?: string;
  marketId?: string;
  marketName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  gbpLocationId?: string;
  callTrackingNumber?: string;
  callTrackingProvider?: CallTrackingProvider;
  lsaProfileId?: string;
  websiteUrl?: string;
  visibilityScore?: number;
  demandScore?: number;
  conversionScore?: number;
  categoryMix?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * MediaPerformancePoint - Single metric data point (fact table row)
 */
export interface MediaPerformancePoint {
  id: string;
  companyId: string;
  programId?: string;
  campaignId?: string;
  marketId?: string;
  storeId?: string;
  channel?: MediaChannel;
  // NEW: Provider/Data Source/Attribution fields
  provider?: MediaProvider;
  dataSourceType?: MediaDataSourceType;
  attributionModel?: AttributionModel;
  // Metric data
  date: string;
  metricName: MetricName;
  metricValue: number;
  metricUnit: MetricUnit;
  sourceSystem: SourceSystem;
  // Campaign/Ad context (for drill-down)
  campaignName?: string | null;
  adGroupName?: string | null;
  // Meta
  notes?: string;
  createdAt?: string;
}

// ============================================================================
// Computed / Aggregate Types
// ============================================================================

/**
 * Store scorecard with aggregated scores
 */
export interface MediaStoreScorecard {
  store: MediaStore;
  visibilityScore: number;
  demandScore: number;
  conversionScore: number;
  overallScore: number;
  categoryMixParsed: MediaCategory[];
}

/**
 * Program summary with aggregated metrics
 */
export interface MediaProgramSummary {
  program: MediaProgram;
  campaignCount: number;
  marketCount: number;
  storeCount: number;
  totalMonthlyBudget: number;
  // Performance metrics (to be populated from MediaPerformance)
  last30DaySpend?: number;
  last30DayCalls?: number;
  last30DayInstalls?: number;
  last30DayLeads?: number;
}

/**
 * Company-level media overview
 */
export interface MediaOverview {
  companyId: string;
  companyName?: string;
  programCount: number;
  activeCampaignCount: number;
  marketCount: number;
  storeCount: number;
  channelBreakdown: Partial<Record<MediaChannel, number>>;
  totalMonthlyBudget: number;
  // Performance metrics (to be populated from MediaPerformance)
  last30DaySpend?: number;
  last30DayCalls?: number;
  last30DayInstalls?: number;
}

/**
 * Global media hub summary (across all companies)
 */
export interface GlobalMediaSummary {
  totalPrograms: number;
  totalActiveCampaigns: number;
  totalMarkets: number;
  totalStores: number;
  channelBreakdown: Partial<Record<MediaChannel, number>>;
  companyBreakdown: Array<{
    companyId: string;
    companyName: string;
    programCount: number;
    activeCampaignCount: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate overall score from component scores
 */
export function calculateOverallScore(
  visibility?: number,
  demand?: number,
  conversion?: number
): number {
  const scores = [visibility, demand, conversion].filter((s): s is number => s !== undefined);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Parse category mix string to array
 */
export function parseCategoryMix(categoryMix?: string): MediaCategory[] {
  if (!categoryMix) return [];

  const validCategories: MediaCategory[] = ['CarPlay', 'Remote Start', 'Audio', 'Tint', 'Other'];

  return categoryMix
    .split(',')
    .map((c) => c.trim())
    .filter((c): c is MediaCategory => validCategories.includes(c as MediaCategory));
}

/**
 * Get status badge styles
 */
export function getStatusStyles(status: MediaProgramStatus): { color: string; bgColor: string; borderColor: string } {
  return MEDIA_STATUS_CONFIG[status] || MEDIA_STATUS_CONFIG.Planned;
}

/**
 * Get channel badge styles
 */
export function getChannelStyles(channel: MediaChannel): { color: string; label: string } {
  return MEDIA_CHANNEL_CONFIG[channel] || MEDIA_CHANNEL_CONFIG.Other;
}

/**
 * Format currency for display
 */
export function formatBudget(amount?: number): string {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format score for display (0-100)
 */
export function formatScore(score?: number): string {
  if (score === undefined || score === null) return '—';
  return `${Math.round(score)}`;
}

/**
 * Get score color based on value
 */
export function getScoreColor(score?: number): string {
  if (score === undefined || score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Get score background color class
 */
export function getScoreBgColor(score?: number): string {
  if (score === undefined || score === null) return 'bg-slate-500/10';
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

/**
 * Format metric value based on unit type
 */
export function formatMetricValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'Percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'Currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    case 'Rating':
      return value.toFixed(1);
    case 'Duration': {
      // Duration in seconds, format as mm:ss
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    case 'Count':
    default:
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return Math.round(value).toLocaleString();
  }
}

/**
 * Format a number compactly for display
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

// ============================================================================
// V2 Scorecard Types (computed from MediaPerformance)
// ============================================================================

/**
 * Computed store scorecard with metrics derived from MediaPerformance
 */
export interface MediaStoreScorecardV2 {
  storeId: string;
  storeName: string;
  storeCode?: string;
  marketId?: string;
  marketName?: string;
  // Core scores (0-100)
  visibilityScore: number;
  demandScore: number;
  conversionScore: number;
  overallScore: number;
  // Raw metrics (for date range)
  impressions: number;
  clicks: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  lsaLeads: number;
  installs: number;
  spend: number;
  reviews: number;
  reviewRating?: number;
  // Derived metrics
  ctr?: number;
  cpl?: number; // Cost per lead
  // Category data
  categoryMix: MediaCategory[];
}

/**
 * Computed market scorecard with aggregated metrics
 */
export interface MediaMarketScorecard {
  marketId: string;
  marketName: string;
  region?: string;
  storeCount: number;
  // Aggregate scores (0-100, average of stores)
  visibilityScore: number;
  demandScore: number;
  conversionScore: number;
  overallScore: number;
  // Aggregate metrics (sum across stores)
  impressions: number;
  clicks: number;
  calls: number;
  directionRequests: number;
  lsaLeads: number;
  installs: number;
  spend: number;
  // Derived
  ctr?: number;
  cpl?: number;
}

/**
 * Program-level performance overview
 */
export interface MediaProgramOverview {
  programId: string;
  programName: string;
  status: MediaProgramStatus;
  objective: MediaObjective;
  channels: MediaChannel[];
  // Counts
  campaignCount: number;
  marketCount: number;
  storeCount: number;
  // Budget info
  monthlyBudget: number;
  // Performance metrics (for date range)
  spend: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  calls: number;
  lsaLeads: number;
  installs: number;
  // Derived cost metrics
  cpc?: number;
  cpl?: number;
  cpBooking?: number;
}

/**
 * Channel performance breakdown
 */
export interface MediaChannelPerformance {
  channel: MediaChannel;
  spend: number;
  impressions: number;
  clicks: number;
  calls: number;
  lsaLeads: number;
  installs: number;
  ctr?: number;
  cpc?: number;
  cpl?: number;
}

/**
 * Date range for media queries
 */
export interface MediaDateRange {
  start: Date;
  end: Date;
}

/**
 * Standard date range presets
 */
export type MediaDateRangePreset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisQuarter';

/**
 * Get date range from preset
 */
export function getDateRangeFromPreset(preset: MediaDateRangePreset): MediaDateRange {
  const now = new Date();
  const end = new Date(now);

  switch (preset) {
    case 'last7':
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end,
      };
    case 'last30':
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end,
      };
    case 'last90':
      return {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        end,
      };
    case 'thisMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end,
      };
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        start: lastMonth,
        end: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    }
    case 'thisQuarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      return {
        start: new Date(now.getFullYear(), quarter * 3, 1),
        end,
      };
    }
  }
}

// ============================================================================
// Integration Config Types
// ============================================================================

/**
 * GA4 configuration for a company
 */
export interface MediaGa4Config {
  propertyId: string;
  // Optional: mapping from GA4 dimensions to store/market IDs
  dimensionMappings?: {
    storeIdDimension?: string; // e.g., 'customEvent:store_id'
    marketIdDimension?: string;
  };
}

/**
 * Google Ads configuration
 */
export interface MediaGoogleAdsConfig {
  customerId: string;
  // Campaign naming convention to extract store/market
  campaignNamingPattern?: string; // e.g., "[Market] - [Channel] - [Objective]"
}

/**
 * GBP (Google Business Profile) configuration
 */
export interface MediaGbpConfig {
  accountId: string;
  // Mapping from GBP location ID to MediaStore ID
  locationMappings?: Record<string, string>;
}

/**
 * Call tracking configuration
 */
export interface MediaCallTrackingConfig {
  provider: CallTrackingProvider;
  apiKey?: string;
  accountId?: string;
  // Mapping from tracking number to store ID
  numberMappings?: Record<string, string>;
}

/**
 * Complete media integration config for a company
 */
export interface MediaIntegrationConfig {
  companyId: string;
  ga4?: MediaGa4Config;
  googleAds?: MediaGoogleAdsConfig;
  gbp?: MediaGbpConfig;
  callTracking?: MediaCallTrackingConfig;
}

// ============================================================================
// Sync Status Types
// ============================================================================

/**
 * Result of a media sync operation
 */
export interface MediaSyncResult {
  success: boolean;
  companyId: string;
  dateRange: MediaDateRange;
  pointsCreated: number;
  pointsUpdated: number;
  errors: string[];
  sourcesProcessed: SourceSystem[];
  duration: number; // ms
}

/**
 * Composite key for deduplication
 */
export interface MediaPerformanceCompositeKey {
  companyId: string;
  date: string;
  channel: MediaChannel;
  metricName: MetricName;
  storeId?: string;
  marketId?: string;
  campaignId?: string;
}

/**
 * Generate a stable composite key string for deduplication
 */
export function generateCompositeKey(key: MediaPerformanceCompositeKey): string {
  return [
    key.companyId,
    key.date,
    key.channel,
    key.metricName,
    key.storeId || '_',
    key.marketId || '_',
    key.campaignId || '_',
  ].join('|');
}

// ============================================================================
// Media Actuals Row (Aggregated Performance Data)
// ============================================================================

/**
 * MediaActualRow - Aggregated row of media actuals data
 *
 * This is a denormalized view optimized for analytics and reporting,
 * where metrics are columns rather than separate rows.
 */
export interface MediaActualRow {
  id: string;
  companyId: string;
  date: string;             // Daily or weekly granularity
  provider: MediaProvider;
  channel: MediaChannel;
  dataSourceType: MediaDataSourceType;
  attributionModel?: AttributionModel;
  // Location context
  market?: string;
  storeId?: string | null;
  // Campaign context
  campaignName?: string | null;
  adGroupName?: string | null;
  // Metrics (all optional - not all channels have all metrics)
  impressions?: number;
  clicks?: number;
  sessions?: number;
  leads?: number;
  calls?: number;
  installs?: number;        // Primary conversion for car audio
  conversions?: number;     // Generic conversion count
  spend?: number;
  revenue?: number | null;
  // Derived metrics (computed if base metrics present)
  ctr?: number;             // clicks / impressions
  cpc?: number;             // spend / clicks
  cpl?: number;             // spend / leads
  conversionRate?: number;  // conversions / clicks
}

// ============================================================================
// Provider/Channel Mapping Helpers
// ============================================================================

/**
 * Get the default channel for a provider
 */
export function getDefaultChannelForProvider(provider: MediaProvider): MediaChannel {
  switch (provider) {
    case 'google_ads':
      return 'Search';
    case 'meta_ads':
      return 'Social';
    case 'microsoft_ads':
      return 'Search';
    case 'tiktok_ads':
      return 'Social';
    case 'youtube_ads':
      return 'Video';
    case 'dv360':
      return 'Display';
    case 'ga4':
      return 'Other';
    case 'lsa':
      return 'LSAs';
    case 'gbp':
      return 'Maps';
    case 'radio_vendor':
      return 'Radio';
    case 'tv_vendor':
      return 'TV';
    case 'ooh_vendor':
      return 'Out of Home';
    case 'streaming_audio_vendor':
      return 'Streaming Audio';
    case 'print_vendor':
      return 'Print';
    case 'direct_mail_vendor':
      return 'Direct Mail';
    default:
      return 'Other';
  }
}

/**
 * Get the default data source type for a provider
 */
export function getDefaultDataSourceForProvider(provider: MediaProvider): MediaDataSourceType {
  switch (provider) {
    case 'google_ads':
    case 'meta_ads':
    case 'microsoft_ads':
    case 'tiktok_ads':
    case 'youtube_ads':
    case 'dv360':
    case 'lsa':
    case 'gbp':
      return 'platform_api';
    case 'ga4':
      return 'analytics_api';
    case 'radio_vendor':
    case 'tv_vendor':
    case 'ooh_vendor':
    case 'streaming_audio_vendor':
      return 'vendor_feed';
    case 'print_vendor':
    case 'direct_mail_vendor':
      return 'manual_import';
    default:
      return 'manual_import';
  }
}

/**
 * Get the default attribution model for a provider/channel combination
 */
export function getDefaultAttributionModel(provider: MediaProvider, channel?: MediaChannel): AttributionModel {
  // Traditional channels typically use lift-based attribution
  if (
    channel === 'Radio' ||
    channel === 'TV' ||
    channel === 'Out of Home' ||
    channel === 'Streaming Audio' ||
    channel === 'Print' ||
    channel === 'Direct Mail' ||
    provider === 'radio_vendor' ||
    provider === 'tv_vendor' ||
    provider === 'ooh_vendor' ||
    provider === 'streaming_audio_vendor' ||
    provider === 'print_vendor' ||
    provider === 'direct_mail_vendor'
  ) {
    return 'lift';
  }

  // Analytics-only providers are typically blended
  if (provider === 'ga4') {
    return 'blended';
  }

  // Digital ad platforms default to direct attribution
  return 'direct';
}

/**
 * Get provider display info
 */
export function getProviderInfo(provider: MediaProvider): { label: string; color: string } {
  return MEDIA_PROVIDER_CONFIG[provider] || MEDIA_PROVIDER_CONFIG.other;
}

/**
 * Get data source display info
 */
export function getDataSourceInfo(dataSource: MediaDataSourceType): { label: string; color: string } {
  return MEDIA_DATASOURCE_CONFIG[dataSource] || MEDIA_DATASOURCE_CONFIG.manual_import;
}

/**
 * Get attribution model display info
 */
export function getAttributionInfo(attribution: AttributionModel): { label: string; color: string; description: string } {
  return ATTRIBUTION_MODEL_CONFIG[attribution] || ATTRIBUTION_MODEL_CONFIG.unknown;
}

/**
 * Check if a channel is traditional (offline) media
 */
export function isTraditionalChannel(channel: MediaChannel): boolean {
  return ['Radio', 'TV', 'Streaming Audio', 'Out of Home', 'Print', 'Direct Mail'].includes(channel);
}

/**
 * Check if a channel is digital media
 */
export function isDigitalChannel(channel: MediaChannel): boolean {
  return ['Search', 'Social', 'Video', 'Display', 'Retargeting', 'LSAs', 'Maps', 'Email', 'Affiliate'].includes(channel);
}

/**
 * Get available metrics for a channel (traditional channels have fewer metrics)
 */
export function getAvailableMetricsForChannel(channel: MediaChannel): MetricName[] {
  const baseMetrics: MetricName[] = ['Spend'];

  if (isTraditionalChannel(channel)) {
    // Traditional channels typically only have spend and lift-based conversions
    return [...baseMetrics, 'Calls', 'Installs', 'Leads'];
  }

  // Digital channels have full metric set
  return [
    ...baseMetrics,
    'Impressions',
    'Clicks',
    'CTR',
    'CPC',
    'Calls',
    'Installs',
    'Leads',
    'Conversion Rate',
    'Cost Per Lead',
  ];
}
