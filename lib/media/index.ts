// lib/media/index.ts
// Media module barrel export

export * from './sync';
export * from './analytics';
export * from './work';

// Growth Assumptions Engine - assumptions module
// Note: Use direct imports from ./assumptions to avoid SeasonKey conflict with ./types
export {
  // Zod schemas (const values)
  SearchAssumptionsSchema,
  SocialAssumptionsSchema,
  LSAAssumptionsSchema,
  MapsAssumptionsSchema,
  DisplayAssumptionsSchema,
  SeasonalityModifierSchema,
  StoreModifierSchema,
  MediaAssumptionsSchema,
  // Default values (const)
  DEFAULT_SEARCH_ASSUMPTIONS,
  DEFAULT_SOCIAL_ASSUMPTIONS,
  DEFAULT_LSA_ASSUMPTIONS,
  DEFAULT_MAPS_ASSUMPTIONS,
  DEFAULT_DISPLAY_ASSUMPTIONS,
  // Functions
  createDefaultAssumptions,
  validateAssumptions,
  mergeWithDefaults,
  serializeAssumptions,
  deserializeAssumptions,
  // Constants
  CAR_AUDIO_BENCHMARKS,
  LOCAL_SERVICES_BENCHMARKS,
  SEASON_CONFIG,
} from './assumptions';

// Types from assumptions module
export type {
  SearchAssumptions,
  SocialAssumptions,
  LSAAssumptions,
  MapsAssumptions,
  DisplayAssumptions,
  SeasonalityModifier,
  StoreModifier,
  MediaAssumptions,
  MediaAssumptionsRecord,
} from './assumptions';

// Forecast Engine - types from types.ts
export type {
  MediaChannel,
  SeasonKey,
  StoreInfo,
  StoreId,
  MediaBudgetInput,
  ChannelForecast,
  StoreForecast,
  MediaForecastSummary,
  MediaForecastResult,
  ForecastWarning,
} from './types';

// Forecast Engine - types and functions
export type { ForecastParams } from './forecastEngine';

export {
  // Functions
  forecastMediaPlan,
  // Constants
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  SEASON_OPTIONS,
  DEFAULT_CHANNEL_SPLITS,
  getSeasonLabel,
  normalizeChannelSplits,
  formatCurrency,
  formatCompact,
  formatPercent,
} from './forecastEngine';
