// lib/media/types.ts
// Shared types for the Media Lab Forecast Engine
//
// These types are used across the forecasting system:
// - Budget inputs and channel splits
// - Forecast outputs by channel and store
// - Store information and modifiers
//
// EXTENDED: Now supports traditional/offline channels in addition to digital

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Media channels supported by the forecast engine
 * Extended to support more digital channels and traditional/offline channels
 */
export type MediaChannel =
  // Digital channels (core)
  | 'search'
  | 'social'
  | 'lsa'
  | 'display'
  | 'maps'
  // Additional digital channels
  | 'youtube'
  | 'microsoft_search'
  | 'tiktok'
  | 'email'
  | 'affiliate'
  // Traditional/offline channels
  | 'radio'
  | 'tv'
  | 'streaming_audio'
  | 'out_of_home'
  | 'print'
  | 'direct_mail';

/**
 * Map from our simplified channel keys to the MediaChannelKey used elsewhere
 */
export const CHANNEL_KEY_MAP: Record<MediaChannel, string> = {
  // Digital core
  search: 'google_search',
  social: 'paid_social_meta',
  lsa: 'google_lsas',
  display: 'display_retarg',
  maps: 'google_maps_gbp',
  // Additional digital
  youtube: 'google_youtube',
  microsoft_search: 'microsoft_search',
  tiktok: 'tiktok_social',
  email: 'email_marketing',
  affiliate: 'affiliate',
  // Traditional/offline
  radio: 'radio',
  tv: 'tv',
  streaming_audio: 'streaming_audio',
  out_of_home: 'out_of_home',
  print: 'print',
  direct_mail: 'direct_mail',
};

/**
 * Channel display labels
 */
export const CHANNEL_LABELS: Record<MediaChannel, string> = {
  // Digital core
  search: 'Google Search',
  social: 'Paid Social (Meta)',
  lsa: 'Local Services Ads',
  display: 'Display / Retargeting',
  maps: 'Google Maps / GBP',
  // Additional digital
  youtube: 'YouTube Ads',
  microsoft_search: 'Microsoft/Bing Search',
  tiktok: 'TikTok Ads',
  email: 'Email Marketing',
  affiliate: 'Affiliate',
  // Traditional/offline
  radio: 'Radio',
  tv: 'Television',
  streaming_audio: 'Streaming Audio',
  out_of_home: 'Out-of-Home (OOH)',
  print: 'Print',
  direct_mail: 'Direct Mail',
};

/**
 * Channel colors for UI
 */
export const CHANNEL_COLORS: Record<MediaChannel, { text: string; bg: string; border: string }> = {
  // Digital core
  search: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  social: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  lsa: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  display: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  maps: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  // Additional digital
  youtube: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  microsoft_search: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  tiktok: { text: 'text-slate-100', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  email: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  affiliate: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
  // Traditional/offline
  radio: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  tv: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  streaming_audio: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  out_of_home: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  print: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  direct_mail: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

/**
 * Digital channels for quick filtering
 */
export const DIGITAL_CHANNELS: MediaChannel[] = [
  'search', 'social', 'lsa', 'display', 'maps',
  'youtube', 'microsoft_search', 'tiktok', 'email', 'affiliate',
];

/**
 * Traditional/offline channels for quick filtering
 */
export const TRADITIONAL_CHANNELS: MediaChannel[] = [
  'radio', 'tv', 'streaming_audio', 'out_of_home', 'print', 'direct_mail',
];

// ============================================================================
// Season Types
// ============================================================================

/**
 * Season keys for seasonal adjustments
 */
export type SeasonKey = 'baseline' | 'remote_start' | 'holiday' | 'carplay_season' | 'summer_audio';

/**
 * Season configuration
 */
export const SEASON_OPTIONS: Array<{ key: SeasonKey; label: string; months: string }> = [
  { key: 'baseline', label: 'Baseline (No Season)', months: 'Year-round' },
  { key: 'remote_start', label: 'Remote Start Season', months: 'Oct-Feb' },
  { key: 'holiday', label: 'Holiday Season', months: 'Nov-Dec' },
  { key: 'carplay_season', label: 'CarPlay Season', months: 'Apr-Aug' },
  { key: 'summer_audio', label: 'Summer Audio', months: 'Jun-Aug' },
];

// ============================================================================
// Store Types
// ============================================================================

export type StoreId = string;
export type MarketTypeValue = 'urban' | 'suburban' | 'rural';

/**
 * Store information for forecasting
 */
export interface StoreInfo {
  id: StoreId;
  name: string;
  market: string; // e.g., "Seattle", "Denver"
  marketType: MarketTypeValue;
  isActive: boolean;
}

// ============================================================================
// Budget Input Types
// ============================================================================

/**
 * Budget input for the forecast engine
 */
export interface MediaBudgetInput {
  totalMonthlyBudget: number;
  season: SeasonKey;
  channelSplits: Record<MediaChannel, number>; // 0-1, should sum to ~1
  storeSplits?: Record<StoreId, number>; // Optional override per store
}

/**
 * Default channel splits (recommended mix for digital-focused plans)
 * Note: For plans including traditional channels, manually adjust splits
 */
export const DEFAULT_CHANNEL_SPLITS: Record<MediaChannel, number> = {
  // Digital core (90% of default)
  search: 0.35,        // 35%
  lsa: 0.15,           // 15%
  social: 0.15,        // 15%
  maps: 0.10,          // 10%
  display: 0.10,       // 10%
  youtube: 0.05,       // 5%
  // Additional digital (0% by default)
  microsoft_search: 0,
  tiktok: 0,
  email: 0,
  affiliate: 0,
  // Traditional/offline (0% by default)
  radio: 0.10,         // 10% for traditional component
  tv: 0,
  streaming_audio: 0,
  out_of_home: 0,
  print: 0,
  direct_mail: 0,
};

/**
 * All digital default splits (no traditional)
 */
export const ALL_DIGITAL_SPLITS: Record<MediaChannel, number> = {
  search: 0.40,
  lsa: 0.20,
  social: 0.20,
  maps: 0.10,
  display: 0.05,
  youtube: 0.05,
  microsoft_search: 0,
  tiktok: 0,
  email: 0,
  affiliate: 0,
  radio: 0,
  tv: 0,
  streaming_audio: 0,
  out_of_home: 0,
  print: 0,
  direct_mail: 0,
};

// ============================================================================
// Channel Forecast Types
// ============================================================================

/**
 * Forecast result for a single channel
 */
export interface ChannelForecast {
  channel: MediaChannel;
  channelLabel: string;
  budget: number;
  budgetPercent: number;
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  installs: number;
  cpc: number;
  cpm: number;
  cpl: number | null;
  convRate: number;
  // For comparison visualization
  leadShare: number; // Percentage of total leads from this channel
}

// ============================================================================
// Store Forecast Types
// ============================================================================

/**
 * Forecast result for a single store
 */
export interface StoreForecast {
  storeId: StoreId;
  storeName: string;
  market: string;
  marketType: MarketTypeValue;
  totalBudget: number;
  budgetPercent: number;
  totalLeads: number;
  totalCalls: number;
  totalInstalls: number;
  effectiveCPL: number | null;
  visibilityScore: number; // 0-100
  demandScore: number;     // 0-100
  conversionScore: number; // 0-100
  performanceIndicator: 'overperforming' | 'average' | 'underperforming';
}

// ============================================================================
// Summary Types
// ============================================================================

/**
 * Aggregate summary of the forecast
 */
export interface MediaForecastSummary {
  totalBudget: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  totalCalls: number;
  totalInstalls: number;
  blendedCPC: number;
  blendedCPL: number | null;
  blendedCPI: number | null;
  blendedConvRate: number;
}

// ============================================================================
// Complete Forecast Result
// ============================================================================

/**
 * Complete forecast result with all breakdowns
 */
export interface MediaForecastResult {
  // Metadata
  generatedAt: string;
  season: SeasonKey;
  seasonLabel: string;

  // Summary
  summary: MediaForecastSummary;

  // Breakdowns
  byChannel: ChannelForecast[];
  byStore: StoreForecast[];

  // Warnings
  warnings: ForecastWarning[];
}

/**
 * Warning about missing or problematic assumptions
 */
export interface ForecastWarning {
  channel?: MediaChannel;
  storeId?: StoreId;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the label for a season
 */
export function getSeasonLabel(season: SeasonKey): string {
  return SEASON_OPTIONS.find(s => s.key === season)?.label ?? 'Unknown';
}

/**
 * Normalize channel splits to sum to 1
 */
export function normalizeChannelSplits(
  splits: Record<MediaChannel, number>
): Record<MediaChannel, number> {
  const total = Object.values(splits).reduce((sum, v) => sum + v, 0);
  if (total === 0) return { ...DEFAULT_CHANNEL_SPLITS };

  const normalized: Record<MediaChannel, number> = {} as Record<MediaChannel, number>;
  for (const [channel, value] of Object.entries(splits)) {
    normalized[channel as MediaChannel] = value / total;
  }
  return normalized;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format number with compact notation
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================================================
// Scenario Planning Types
// ============================================================================

export type MediaScenarioId = string;

/**
 * Goal type for scenario planning
 */
export type MediaScenarioGoalType =
  | 'maximize_installs'
  | 'maximize_leads'
  | 'hit_target_cpa'
  | 'hit_target_volume'
  | 'custom'
  | 'none';

/**
 * Goal configuration for a scenario
 */
export interface MediaScenarioGoal {
  type: MediaScenarioGoalType;
  targetValue?: number;
  metric?: 'installs' | 'leads' | 'cpa' | 'revenue';
  notes?: string;
}

/**
 * Time horizon for scenario planning
 */
export type MediaScenarioTimeHorizon = 'month' | 'quarter' | 'year';

/**
 * Channel allocation within a scenario
 */
export interface MediaScenarioChannelAllocation {
  id: string;
  channel: MediaChannel;
  provider?: string; // 'google' | 'meta' | 'radio' | etc.
  label: string;
  plannedSpend: number;
  isLocked?: boolean;
}

/**
 * Cached forecast summary for a scenario
 */
export interface MediaScenarioForecastSummary {
  expectedInstalls?: number;
  expectedLeads?: number;
  expectedCalls?: number;
  expectedCPA?: number;
  expectedCPL?: number;
  expectedImpressions?: number;
  expectedClicks?: number;
  notes?: string;
  generatedAt?: string;
}

/**
 * Media scenario for planning
 */
export interface MediaScenario {
  id: MediaScenarioId;
  companyId: string;
  name: string;
  description?: string;
  timeHorizon: MediaScenarioTimeHorizon;
  periodLabel?: string;
  totalBudget: number;
  allocations: MediaScenarioChannelAllocation[];
  goal?: MediaScenarioGoal;
  isRecommended?: boolean;
  createdAt: string;
  updatedAt: string;
  forecastSummary?: MediaScenarioForecastSummary;
}

/**
 * Input for creating a new scenario
 */
export interface CreateMediaScenarioInput {
  companyId: string;
  name: string;
  description?: string;
  timeHorizon: MediaScenarioTimeHorizon;
  periodLabel?: string;
  totalBudget: number;
  allocations?: MediaScenarioChannelAllocation[];
  goal?: MediaScenarioGoal;
}

/**
 * Input for updating a scenario
 */
export interface UpdateMediaScenarioInput {
  name?: string;
  description?: string;
  timeHorizon?: MediaScenarioTimeHorizon;
  periodLabel?: string;
  totalBudget?: number;
  allocations?: MediaScenarioChannelAllocation[];
  goal?: MediaScenarioGoal;
  isRecommended?: boolean;
  forecastSummary?: MediaScenarioForecastSummary;
}

/**
 * Time horizon display options
 */
export const TIME_HORIZON_OPTIONS: Array<{ value: MediaScenarioTimeHorizon; label: string }> = [
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Annual' },
];

/**
 * Goal type display options
 */
export const GOAL_TYPE_OPTIONS: Array<{ value: MediaScenarioGoalType; label: string; description: string }> = [
  { value: 'none', label: 'No Specific Goal', description: 'General planning scenario' },
  { value: 'maximize_installs', label: 'Maximize Installs', description: 'Optimize for install volume' },
  { value: 'maximize_leads', label: 'Maximize Leads', description: 'Optimize for lead generation' },
  { value: 'hit_target_cpa', label: 'Hit Target CPA', description: 'Achieve a specific cost per acquisition' },
  { value: 'hit_target_volume', label: 'Hit Target Volume', description: 'Reach a specific install/lead count' },
  { value: 'custom', label: 'Custom Goal', description: 'Define your own success criteria' },
];

/**
 * Provider options for channel allocations
 */
export const SCENARIO_PROVIDER_OPTIONS: Array<{ value: string; label: string; defaultChannel: MediaChannel }> = [
  { value: 'google', label: 'Google', defaultChannel: 'search' },
  { value: 'meta', label: 'Meta', defaultChannel: 'social' },
  { value: 'microsoft', label: 'Microsoft/Bing', defaultChannel: 'microsoft_search' },
  { value: 'youtube', label: 'YouTube', defaultChannel: 'youtube' },
  { value: 'tiktok', label: 'TikTok', defaultChannel: 'tiktok' },
  { value: 'radio', label: 'Radio', defaultChannel: 'radio' },
  { value: 'tv', label: 'Television', defaultChannel: 'tv' },
  { value: 'streaming_audio', label: 'Streaming Audio', defaultChannel: 'streaming_audio' },
  { value: 'ooh', label: 'Out-of-Home', defaultChannel: 'out_of_home' },
  { value: 'print', label: 'Print', defaultChannel: 'print' },
  { value: 'direct_mail', label: 'Direct Mail', defaultChannel: 'direct_mail' },
];

/**
 * Generate a unique ID for scenario allocations
 */
export function generateAllocationId(): string {
  return `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a default allocation for a channel
 */
export function createDefaultAllocation(
  channel: MediaChannel,
  provider?: string
): MediaScenarioChannelAllocation {
  return {
    id: generateAllocationId(),
    channel,
    provider,
    label: CHANNEL_LABELS[channel] || channel,
    plannedSpend: 0,
    isLocked: false,
  };
}

/**
 * Get default allocations for a new scenario
 */
export function getDefaultScenarioAllocations(): MediaScenarioChannelAllocation[] {
  return [
    {
      id: generateAllocationId(),
      channel: 'search',
      provider: 'google',
      label: 'Google Search',
      plannedSpend: 0,
      isLocked: false,
    },
    {
      id: generateAllocationId(),
      channel: 'social',
      provider: 'meta',
      label: 'Meta Social',
      plannedSpend: 0,
      isLocked: false,
    },
  ];
}
