// lib/types/media.ts
// TypeScript types for the Media module
//
// Represents performance media data structures for clients like Car Toys:
// - Programs (strategic media initiatives)
// - Campaigns (individual channel executions)
// - Markets (geographic territories)
// - Stores (physical locations)
// - Performance (metrics fact table)

// ============================================================================
// Enums & Constants
// ============================================================================

export type MediaProgramStatus = 'Planned' | 'Active' | 'Paused' | 'Completed';

export type MediaObjective = 'Installs' | 'Calls' | 'Store Visits' | 'Leads' | 'Traffic';

export type MediaChannel = 'Search' | 'Maps' | 'LSAs' | 'Social' | 'Display' | 'Radio' | 'Other';

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
  Search: { color: 'text-blue-400', label: 'Search' },
  Maps: { color: 'text-emerald-400', label: 'Maps' },
  LSAs: { color: 'text-purple-400', label: 'LSAs' },
  Social: { color: 'text-pink-400', label: 'Social' },
  Display: { color: 'text-cyan-400', label: 'Display' },
  Radio: { color: 'text-orange-400', label: 'Radio' },
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
  marketId?: string;
  marketName?: string;
  storeIds: string[];
  storeNames?: string[];
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
  date: string;
  metricName: MetricName;
  metricValue: number;
  metricUnit: MetricUnit;
  sourceSystem: SourceSystem;
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
  channelBreakdown: Record<MediaChannel, number>;
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
  channelBreakdown: Record<MediaChannel, number>;
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
    case 'Duration':
      // Duration in seconds, format as mm:ss
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
