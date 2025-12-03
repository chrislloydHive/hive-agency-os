// lib/media/assumptions.ts
// Growth Assumptions Engine - Data Model and Validation
//
// This module defines the assumptions that power the media forecasting engine.
// Assumptions are editable per-company and stored in Airtable.
//
// Categories:
// - Search (Google Ads): CTR, CPC, Conversion Rate, Assisted Conversions
// - Social (Meta): CPM, CTR, CPC, Conversion Rate, Creative Fatigue
// - LSAs (Local Services Ads): Cost Per Lead, Lead Quality, Dispute Rate
// - Maps/GBP: Actions-per-Impression, Photo Impact, Rating Multiplier
// - Seasonality: Remote Start, Holiday, CarPlay, Summer Audio
// - Store Modifiers: Market Type, Competition, Cost/Conversion adjustments

import { z } from 'zod';

// ============================================================================
// Enums and Constants
// ============================================================================

export const MarketType = z.enum(['urban', 'suburban', 'rural']);
export type MarketType = z.infer<typeof MarketType>;

export const CompetitionLevel = z.enum(['low', 'medium', 'high', 'very_high']);
export type CompetitionLevel = z.infer<typeof CompetitionLevel>;

export const SeasonKey = z.enum([
  'remote_start',  // Oct-Feb
  'holiday',       // Nov-Dec
  'carplay_season', // Apr-Aug
  'summer_audio',  // Jun-Aug
]);
export type SeasonKey = z.infer<typeof SeasonKey>;

// Season configuration with default date ranges
export const SEASON_CONFIG: Record<SeasonKey, {
  label: string;
  months: string;
  description: string;
  defaultLiftPercent: number;
}> = {
  remote_start: {
    label: 'Remote Start Season',
    months: 'Oct-Feb',
    description: 'Peak season for remote start installations',
    defaultLiftPercent: 50,
  },
  holiday: {
    label: 'Holiday Season',
    months: 'Nov-Dec',
    description: 'Gift-giving and year-end installs',
    defaultLiftPercent: 25,
  },
  carplay_season: {
    label: 'CarPlay Season',
    months: 'Apr-Aug',
    description: 'Spring/summer push for CarPlay retrofits',
    defaultLiftPercent: 30,
  },
  summer_audio: {
    label: 'Summer Audio',
    months: 'Jun-Aug',
    description: 'Peak season for audio upgrades',
    defaultLiftPercent: 35,
  },
};

// ============================================================================
// Search Assumptions (Google Ads)
// ============================================================================

export const SearchAssumptionsSchema = z.object({
  ctr: z.number().min(0).max(1).describe('Click-through rate (0-1)'),
  cpc: z.number().min(0).describe('Average cost per click'),
  conversionRate: z.number().min(0).max(1).describe('Conversion rate from click to lead (0-1)'),
  assistedConversions: z.number().min(0).max(1).describe('Portion of conversions with assist (0-1)'),
  impressionShare: z.number().min(0).max(1).optional().describe('Target impression share (0-1)'),
  qualityScoreAvg: z.number().min(1).max(10).optional().describe('Average quality score (1-10)'),
});

export type SearchAssumptions = z.infer<typeof SearchAssumptionsSchema>;

export const DEFAULT_SEARCH_ASSUMPTIONS: SearchAssumptions = {
  ctr: 0.045, // 4.5% CTR
  cpc: 3.50,  // $3.50 CPC
  conversionRate: 0.06, // 6% conversion
  assistedConversions: 0.15, // 15% assisted
  impressionShare: 0.70, // 70% impression share target
  qualityScoreAvg: 7,
};

// ============================================================================
// Social Assumptions (Meta/Facebook/Instagram)
// ============================================================================

export const SocialAssumptionsSchema = z.object({
  cpm: z.number().min(0).describe('Cost per 1000 impressions'),
  ctr: z.number().min(0).max(1).describe('Click-through rate (0-1)'),
  cpc: z.number().min(0).describe('Average cost per click'),
  conversionRate: z.number().min(0).max(1).describe('Conversion rate from click to lead (0-1)'),
  creativeFatigueModifier: z.number().min(0).max(1).describe('Creative fatigue discount (0-1, lower = more fatigue)'),
  engagementRate: z.number().min(0).max(1).optional().describe('Post engagement rate (0-1)'),
  frequencyCap: z.number().min(1).optional().describe('Max impressions per user per week'),
});

export type SocialAssumptions = z.infer<typeof SocialAssumptionsSchema>;

export const DEFAULT_SOCIAL_ASSUMPTIONS: SocialAssumptions = {
  cpm: 12.00, // $12 CPM
  ctr: 0.012, // 1.2% CTR
  cpc: 1.80,  // $1.80 CPC
  conversionRate: 0.025, // 2.5% conversion
  creativeFatigueModifier: 0.85, // 15% fatigue discount after 4 weeks
  engagementRate: 0.03, // 3% engagement
  frequencyCap: 7,
};

// ============================================================================
// LSA Assumptions (Local Services Ads)
// ============================================================================

export const LSAAssumptionsSchema = z.object({
  costPerLead: z.number().min(0).describe('Cost per lead (Google charges per lead)'),
  leadQualityScore: z.number().min(0).max(100).describe('Lead quality score (0-100)'),
  disputeRate: z.number().min(0).max(1).describe('Rate of leads disputed/refunded (0-1)'),
  responseTimeMinutes: z.number().min(0).optional().describe('Average response time in minutes'),
  bookingRate: z.number().min(0).max(1).optional().describe('Rate of leads that book (0-1)'),
});

export type LSAAssumptions = z.infer<typeof LSAAssumptionsSchema>;

export const DEFAULT_LSA_ASSUMPTIONS: LSAAssumptions = {
  costPerLead: 25.00, // $25 per lead
  leadQualityScore: 70, // 70/100 quality
  disputeRate: 0.10, // 10% disputed
  responseTimeMinutes: 15,
  bookingRate: 0.50, // 50% book
};

// ============================================================================
// Maps/GBP Assumptions (Google Business Profile)
// ============================================================================

export const MapsAssumptionsSchema = z.object({
  actionsPerImpression: z.number().min(0).max(1).describe('Actions (calls/directions) per impression (0-1)'),
  photoImpactMultiplier: z.number().min(0).max(3).describe('Impact of photos on engagement (1 = neutral)'),
  ratingMultiplier: z.number().min(0).max(3).describe('Impact of rating on conversions (1 = neutral)'),
  reviewResponseRate: z.number().min(0).max(1).optional().describe('Rate of reviews responded to (0-1)'),
  postEngagementLift: z.number().min(0).optional().describe('Lift from regular GBP posts (0-1)'),
});

export type MapsAssumptions = z.infer<typeof MapsAssumptionsSchema>;

export const DEFAULT_MAPS_ASSUMPTIONS: MapsAssumptions = {
  actionsPerImpression: 0.025, // 2.5% action rate
  photoImpactMultiplier: 1.20, // 20% lift from good photos
  ratingMultiplier: 1.15, // 15% lift from good rating
  reviewResponseRate: 0.80, // 80% response rate
  postEngagementLift: 0.10, // 10% lift from posts
};

// ============================================================================
// Display/Retargeting Assumptions
// ============================================================================

export const DisplayAssumptionsSchema = z.object({
  cpm: z.number().min(0).describe('Cost per 1000 impressions'),
  ctr: z.number().min(0).max(1).describe('Click-through rate (0-1)'),
  viewThroughRate: z.number().min(0).max(1).describe('View-through conversion rate (0-1)'),
  conversionRate: z.number().min(0).max(1).describe('Click conversion rate (0-1)'),
  frequencyCap: z.number().min(1).optional().describe('Max impressions per user'),
});

export type DisplayAssumptions = z.infer<typeof DisplayAssumptionsSchema>;

export const DEFAULT_DISPLAY_ASSUMPTIONS: DisplayAssumptions = {
  cpm: 5.00, // $5 CPM
  ctr: 0.008, // 0.8% CTR
  viewThroughRate: 0.002, // 0.2% view-through
  conversionRate: 0.015, // 1.5% click conversion
  frequencyCap: 10,
};

// ============================================================================
// Seasonality Modifiers
// ============================================================================

export const SeasonalityModifierSchema = z.object({
  season: SeasonKey,
  enabled: z.boolean(),
  spendLiftPercent: z.number().min(-50).max(200).describe('Percent change in spend (+/-)'),
  conversionLiftPercent: z.number().min(-50).max(100).describe('Percent change in conversion rate'),
  cpcChangePercent: z.number().min(-30).max(100).describe('Percent change in CPC due to competition'),
});

export type SeasonalityModifier = z.infer<typeof SeasonalityModifierSchema>;

export const SeasonalityAssumptionsSchema = z.object({
  remoteStart: SeasonalityModifierSchema.optional(),
  holiday: SeasonalityModifierSchema.optional(),
  carplaySeason: SeasonalityModifierSchema.optional(),
  summerAudio: SeasonalityModifierSchema.optional(),
});

export type SeasonalityAssumptions = z.infer<typeof SeasonalityAssumptionsSchema>;

export const DEFAULT_SEASONALITY_ASSUMPTIONS: SeasonalityAssumptions = {
  remoteStart: {
    season: 'remote_start',
    enabled: true,
    spendLiftPercent: 50,
    conversionLiftPercent: 20,
    cpcChangePercent: 15, // More competition
  },
  holiday: {
    season: 'holiday',
    enabled: true,
    spendLiftPercent: 25,
    conversionLiftPercent: 10,
    cpcChangePercent: 20, // Peak competition
  },
  carplaySeason: {
    season: 'carplay_season',
    enabled: true,
    spendLiftPercent: 30,
    conversionLiftPercent: 15,
    cpcChangePercent: 10,
  },
  summerAudio: {
    season: 'summer_audio',
    enabled: true,
    spendLiftPercent: 35,
    conversionLiftPercent: 15,
    cpcChangePercent: 5,
  },
};

// ============================================================================
// Store-Level Modifiers
// ============================================================================

export const StoreModifierSchema = z.object({
  storeId: z.string(),
  storeName: z.string(),
  marketType: MarketType,
  competitionLevel: CompetitionLevel,
  costModifier: z.number().min(0.5).max(2.0).describe('Multiplier for costs (1.0 = no change)'),
  conversionModifier: z.number().min(0.5).max(2.0).describe('Multiplier for conversions (1.0 = no change)'),
  notes: z.string().optional(),
});

export type StoreModifier = z.infer<typeof StoreModifierSchema>;

export const StoreModifiersSchema = z.array(StoreModifierSchema);
export type StoreModifiers = z.infer<typeof StoreModifiersSchema>;

// Market type impact on modifiers
export const MARKET_TYPE_DEFAULTS: Record<MarketType, { costMod: number; convMod: number }> = {
  urban: { costMod: 1.25, convMod: 1.10 },     // Higher costs, better conversion
  suburban: { costMod: 1.00, convMod: 1.00 },  // Baseline
  rural: { costMod: 0.80, convMod: 0.85 },     // Lower costs, lower conversion
};

// Competition level impact on costs
export const COMPETITION_LEVEL_DEFAULTS: Record<CompetitionLevel, { costMod: number }> = {
  low: { costMod: 0.85 },
  medium: { costMod: 1.00 },
  high: { costMod: 1.20 },
  very_high: { costMod: 1.40 },
};

// ============================================================================
// Full Media Assumptions Type
// ============================================================================

export const MediaAssumptionsSchema = z.object({
  id: z.string().optional(),
  companyId: z.string(),

  // Channel assumptions
  search: SearchAssumptionsSchema,
  social: SocialAssumptionsSchema,
  lsa: LSAAssumptionsSchema,
  maps: MapsAssumptionsSchema,
  display: DisplayAssumptionsSchema.optional(),

  // Seasonality
  seasonality: SeasonalityAssumptionsSchema,

  // Store modifiers
  storeModifiers: StoreModifiersSchema,

  // Metadata
  lastUpdated: z.string().optional(),
  updatedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type MediaAssumptions = z.infer<typeof MediaAssumptionsSchema>;

// ============================================================================
// Default Assumptions Factory
// ============================================================================

export function createDefaultAssumptions(companyId: string): MediaAssumptions {
  return {
    companyId,
    search: { ...DEFAULT_SEARCH_ASSUMPTIONS },
    social: { ...DEFAULT_SOCIAL_ASSUMPTIONS },
    lsa: { ...DEFAULT_LSA_ASSUMPTIONS },
    maps: { ...DEFAULT_MAPS_ASSUMPTIONS },
    display: { ...DEFAULT_DISPLAY_ASSUMPTIONS },
    seasonality: { ...DEFAULT_SEASONALITY_ASSUMPTIONS },
    storeModifiers: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateAssumptions(data: unknown): {
  success: boolean;
  data?: MediaAssumptions;
  errors?: z.ZodError
} {
  const result = MediaAssumptionsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function validatePartialAssumptions(data: unknown): {
  success: boolean;
  data?: Partial<MediaAssumptions>;
  errors?: z.ZodError;
} {
  const result = MediaAssumptionsSchema.partial().safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// ============================================================================
// Merge Helpers
// ============================================================================

/**
 * Merge partial assumptions with defaults
 */
export function mergeWithDefaults(
  partial: Partial<MediaAssumptions>,
  companyId: string
): MediaAssumptions {
  const defaults = createDefaultAssumptions(companyId);
  return {
    ...defaults,
    ...partial,
    search: { ...defaults.search, ...partial.search },
    social: { ...defaults.social, ...partial.social },
    lsa: { ...defaults.lsa, ...partial.lsa },
    maps: { ...defaults.maps, ...partial.maps },
    display: defaults.display && partial.display
      ? { ...defaults.display, ...partial.display }
      : defaults.display ?? partial.display,
    seasonality: { ...defaults.seasonality, ...partial.seasonality },
    storeModifiers: partial.storeModifiers ?? defaults.storeModifiers,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate effective store modifier based on market type and competition
 */
export function calculateStoreModifier(
  marketType: MarketType,
  competitionLevel: CompetitionLevel
): { costModifier: number; conversionModifier: number } {
  const marketDefaults = MARKET_TYPE_DEFAULTS[marketType];
  const competitionDefaults = COMPETITION_LEVEL_DEFAULTS[competitionLevel];

  return {
    costModifier: marketDefaults.costMod * competitionDefaults.costMod,
    conversionModifier: marketDefaults.convMod,
  };
}

// ============================================================================
// Industry Benchmark Suggestions
// ============================================================================

export interface IndustryBenchmark {
  industry: string;
  search: Partial<SearchAssumptions>;
  social: Partial<SocialAssumptions>;
  lsa: Partial<LSAAssumptions>;
  maps: Partial<MapsAssumptions>;
}

// 12V/Car Audio industry benchmarks
export const CAR_AUDIO_BENCHMARKS: IndustryBenchmark = {
  industry: '12V / Car Audio',
  search: {
    ctr: 0.048,
    cpc: 3.25,
    conversionRate: 0.065,
    assistedConversions: 0.18,
  },
  social: {
    cpm: 11.50,
    ctr: 0.014,
    cpc: 1.65,
    conversionRate: 0.028,
  },
  lsa: {
    costPerLead: 22.00,
    leadQualityScore: 72,
    disputeRate: 0.08,
  },
  maps: {
    actionsPerImpression: 0.028,
    photoImpactMultiplier: 1.25,
    ratingMultiplier: 1.18,
  },
};

// Generic local services benchmarks
export const LOCAL_SERVICES_BENCHMARKS: IndustryBenchmark = {
  industry: 'Local Services',
  search: {
    ctr: 0.042,
    cpc: 4.00,
    conversionRate: 0.055,
    assistedConversions: 0.12,
  },
  social: {
    cpm: 13.00,
    ctr: 0.010,
    cpc: 2.00,
    conversionRate: 0.020,
  },
  lsa: {
    costPerLead: 28.00,
    leadQualityScore: 68,
    disputeRate: 0.12,
  },
  maps: {
    actionsPerImpression: 0.022,
    photoImpactMultiplier: 1.15,
    ratingMultiplier: 1.12,
  },
};

export function getIndustryBenchmarks(industry?: string): IndustryBenchmark {
  if (industry?.toLowerCase().includes('audio') ||
      industry?.toLowerCase().includes('12v') ||
      industry?.toLowerCase().includes('car')) {
    return CAR_AUDIO_BENCHMARKS;
  }
  return LOCAL_SERVICES_BENCHMARKS;
}

// ============================================================================
// Types for API/Airtable Integration
// ============================================================================

export interface MediaAssumptionsRecord {
  id: string;
  companyId: string;
  assumptionsJson: string; // JSON stringified MediaAssumptions
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize assumptions for storage
 */
export function serializeAssumptions(assumptions: MediaAssumptions): string {
  return JSON.stringify(assumptions);
}

/**
 * Deserialize assumptions from storage
 */
export function deserializeAssumptions(json: string): MediaAssumptions | null {
  try {
    const parsed = JSON.parse(json);
    const result = MediaAssumptionsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
