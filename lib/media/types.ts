// lib/media/types.ts
// Shared types for the Media Lab Forecast Engine
//
// These types are used across the forecasting system:
// - Budget inputs and channel splits
// - Forecast outputs by channel and store
// - Store information and modifiers

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Media channels supported by the forecast engine
 */
export type MediaChannel = 'search' | 'social' | 'lsa' | 'display' | 'maps';

/**
 * Map from our simplified channel keys to the MediaChannelKey used elsewhere
 */
export const CHANNEL_KEY_MAP: Record<MediaChannel, string> = {
  search: 'google_search',
  social: 'paid_social_meta',
  lsa: 'google_lsas',
  display: 'display_retarg',
  maps: 'google_maps_gbp',
};

/**
 * Channel display labels
 */
export const CHANNEL_LABELS: Record<MediaChannel, string> = {
  search: 'Google Search',
  social: 'Paid Social (Meta)',
  lsa: 'Local Services Ads',
  display: 'Display / Retargeting',
  maps: 'Google Maps / GBP',
};

/**
 * Channel colors for UI
 */
export const CHANNEL_COLORS: Record<MediaChannel, { text: string; bg: string; border: string }> = {
  search: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  social: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  lsa: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  display: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  maps: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};

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
 * Default channel splits (recommended mix)
 */
export const DEFAULT_CHANNEL_SPLITS: Record<MediaChannel, number> = {
  search: 0.40,  // 40%
  lsa: 0.20,     // 20%
  social: 0.20,  // 20%
  maps: 0.10,    // 10%
  display: 0.10, // 10%
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
