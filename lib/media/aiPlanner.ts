// lib/media/aiPlanner.ts
// AI Media Planner Orchestrator
//
// This module orchestrates the AI-powered media planning flow:
// 1. Takes business goals + constraints as input
// 2. Loads company MediaProfile for benchmarks and seasonality
// 3. Generates 3 plan options (Conservative, Balanced, Aggressive)
// 4. Uses the forecastEngine with profile data to project outcomes
// 5. Returns structured plan options for user selection
//
// V2: Integrated with MediaProfile system for company-specific benchmarks

import { forecastMediaPlan, type ForecastParams } from './forecastEngine';
import { createDefaultAssumptions, type MediaAssumptions } from './assumptions';
import {
  getMediaProfile,
  getAvailableChannels,
  getChannelCpa,
  getSeasonalityMultiplier,
  type MediaProfile,
} from './mediaProfile';
import { applySeasonality, getMonthName, analyzeSeasonality } from './seasonality';
import {
  getChannelBenchmarks,
  getRecommendedChannels,
  calculateChannelEfficiencyScore,
} from './channelBenchmarks';
import type {
  MediaChannel,
  MediaForecastResult,
  MediaBudgetInput,
  StoreInfo,
  SeasonKey,
  MarketTypeValue,
} from './types';

// ============================================================================
// Types
// ============================================================================

export type PlanObjective = 'max_installs' | 'max_calls' | 'store_traffic' | 'blended';

export type PlanTimeframe = 'next_30_days' | 'next_90_days' | 'quarter' | 'custom';

export interface MediaPlannerInput {
  companyId: string;
  objective: PlanObjective;
  timeframe: {
    type: PlanTimeframe;
    start: string;  // ISO date
    end: string;    // ISO date
  };
  monthlyBudget: number;
  guardrails: {
    maxCpa?: number;
    maxCpl?: number;
    requiredChannels?: MediaChannel[];
    excludedChannels?: MediaChannel[];
  };
  storeCount?: number;
}

export type PlanOptionLabel = 'Conservative' | 'Balanced' | 'Aggressive';

export interface ChannelAllocation {
  channel: MediaChannel;
  budget: number;
  percentage: number;
  isRequired: boolean;
}

export interface PlanExpectedOutcomes {
  installs: number;
  calls: number;
  leads: number;
  impressions: number;
  clicks: number;
  spend: number;
  cpa: number;
  cpl: number;
}

export interface MediaPlanOption {
  id: string;
  label: PlanOptionLabel;
  channels: ChannelAllocation[];
  expected: PlanExpectedOutcomes;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number; // 0-100
}

export interface AIPlannerResult {
  success: true;
  options: MediaPlanOption[];
  input: MediaPlannerInput;
  profile: MediaProfile;
  seasonalityInsights?: {
    peakMonths: string[];
    lowMonths: string[];
    recommendation: string;
  };
  generatedAt: string;
}

export interface AIPlannerError {
  success: false;
  error: string;
}

// ============================================================================
// Channel Mix Templates by Objective
// ============================================================================

interface ChannelMixTemplate {
  channel: MediaChannel;
  weight: number;  // 0-1, represents percentage
}

// Conservative templates favor proven, lower-risk channels
const CONSERVATIVE_MIXES: Record<PlanObjective, ChannelMixTemplate[]> = {
  max_installs: [
    { channel: 'search', weight: 0.50 },
    { channel: 'lsa', weight: 0.30 },
    { channel: 'maps', weight: 0.15 },
    { channel: 'social', weight: 0.05 },
  ],
  max_calls: [
    { channel: 'lsa', weight: 0.45 },
    { channel: 'search', weight: 0.35 },
    { channel: 'maps', weight: 0.15 },
    { channel: 'social', weight: 0.05 },
  ],
  store_traffic: [
    { channel: 'maps', weight: 0.40 },
    { channel: 'search', weight: 0.30 },
    { channel: 'social', weight: 0.20 },
    { channel: 'lsa', weight: 0.10 },
  ],
  blended: [
    { channel: 'search', weight: 0.40 },
    { channel: 'lsa', weight: 0.25 },
    { channel: 'maps', weight: 0.20 },
    { channel: 'social', weight: 0.15 },
  ],
};

// Balanced templates spread across channels more evenly
const BALANCED_MIXES: Record<PlanObjective, ChannelMixTemplate[]> = {
  max_installs: [
    { channel: 'search', weight: 0.40 },
    { channel: 'lsa', weight: 0.25 },
    { channel: 'maps', weight: 0.15 },
    { channel: 'social', weight: 0.15 },
    { channel: 'radio', weight: 0.05 },
  ],
  max_calls: [
    { channel: 'lsa', weight: 0.35 },
    { channel: 'search', weight: 0.30 },
    { channel: 'maps', weight: 0.15 },
    { channel: 'social', weight: 0.10 },
    { channel: 'radio', weight: 0.10 },
  ],
  store_traffic: [
    { channel: 'maps', weight: 0.30 },
    { channel: 'social', weight: 0.25 },
    { channel: 'search', weight: 0.25 },
    { channel: 'lsa', weight: 0.10 },
    { channel: 'radio', weight: 0.10 },
  ],
  blended: [
    { channel: 'search', weight: 0.30 },
    { channel: 'lsa', weight: 0.20 },
    { channel: 'maps', weight: 0.20 },
    { channel: 'social', weight: 0.20 },
    { channel: 'radio', weight: 0.10 },
  ],
};

// Aggressive templates push more budget to high-volume channels
const AGGRESSIVE_MIXES: Record<PlanObjective, ChannelMixTemplate[]> = {
  max_installs: [
    { channel: 'search', weight: 0.35 },
    { channel: 'social', weight: 0.25 },
    { channel: 'lsa', weight: 0.20 },
    { channel: 'maps', weight: 0.10 },
    { channel: 'radio', weight: 0.10 },
  ],
  max_calls: [
    { channel: 'lsa', weight: 0.30 },
    { channel: 'search', weight: 0.25 },
    { channel: 'social', weight: 0.20 },
    { channel: 'radio', weight: 0.15 },
    { channel: 'maps', weight: 0.10 },
  ],
  store_traffic: [
    { channel: 'social', weight: 0.30 },
    { channel: 'maps', weight: 0.25 },
    { channel: 'search', weight: 0.20 },
    { channel: 'radio', weight: 0.15 },
    { channel: 'lsa', weight: 0.10 },
  ],
  blended: [
    { channel: 'search', weight: 0.25 },
    { channel: 'social', weight: 0.25 },
    { channel: 'lsa', weight: 0.20 },
    { channel: 'maps', weight: 0.15 },
    { channel: 'radio', weight: 0.15 },
  ],
};

// ============================================================================
// Reasoning Templates
// ============================================================================

const REASONING_TEMPLATES: Record<PlanOptionLabel, Record<PlanObjective, string>> = {
  Conservative: {
    max_installs: 'Focuses heavily on Search and LSA for predictable, high-intent leads that convert to installs. Lower risk with proven channels.',
    max_calls: 'Prioritizes LSA for direct call generation with Search as backup. Minimal spend on awareness channels.',
    store_traffic: 'Maps-first approach for local visibility. Search and Social support discovery. Low-risk, location-focused.',
    blended: 'Balanced across proven channels with Search as the foundation. Predictable results with room to optimize.',
  },
  Balanced: {
    max_installs: 'Spreads budget across Search, LSA, Maps, and Social for diversified lead generation. Good balance of volume and quality.',
    max_calls: 'LSA leads with Search and Radio for call volume. Social for brand awareness that supports phone inquiries.',
    store_traffic: 'Multi-channel approach to drive foot traffic. Maps and Social for local awareness, Search for intent capture.',
    blended: 'Even distribution maximizes reach across customer journey. Each channel supports the others.',
  },
  Aggressive: {
    max_installs: 'Higher Social spend for volume, with Search and LSA for conversion. Radio adds reach. Higher risk, higher potential reward.',
    max_calls: 'Pushes LSA and Radio for maximum call volume. Social builds awareness funnel. Accepts higher CPA for volume.',
    store_traffic: 'Social-heavy for awareness, supported by Maps and Radio for local reach. Trades efficiency for maximum visibility.',
    blended: 'Maximum channel diversity for broad reach. Higher spend on awareness channels with conversion support.',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Apply guardrails to a channel mix
 */
function applyGuardrails(
  mix: ChannelMixTemplate[],
  guardrails: MediaPlannerInput['guardrails']
): ChannelMixTemplate[] {
  let adjustedMix = [...mix];

  // Add required channels if not present
  if (guardrails.requiredChannels?.length) {
    for (const required of guardrails.requiredChannels) {
      if (!adjustedMix.some(m => m.channel === required)) {
        adjustedMix.push({ channel: required, weight: 0.1 });
      }
    }
  }

  // Remove excluded channels
  if (guardrails.excludedChannels?.length) {
    adjustedMix = adjustedMix.filter(m => !guardrails.excludedChannels!.includes(m.channel));
  }

  // Renormalize weights to sum to 1
  const totalWeight = adjustedMix.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight > 0) {
    adjustedMix = adjustedMix.map(m => ({
      ...m,
      weight: m.weight / totalWeight,
    }));
  }

  return adjustedMix;
}

/**
 * Convert channel mix to budget allocations
 */
function mixToAllocations(
  mix: ChannelMixTemplate[],
  totalBudget: number,
  requiredChannels?: MediaChannel[]
): ChannelAllocation[] {
  return mix.map(m => ({
    channel: m.channel,
    budget: Math.round(totalBudget * m.weight),
    percentage: Math.round(m.weight * 100),
    isRequired: requiredChannels?.includes(m.channel) || false,
  }));
}

/**
 * Convert channel allocations to budget input format for forecast engine
 */
function allocationsToBudgetInput(
  allocations: ChannelAllocation[],
  totalBudget: number,
  season: SeasonKey = 'baseline'
): MediaBudgetInput {
  const channelSplits: Partial<Record<MediaChannel, number>> = {};

  for (const alloc of allocations) {
    channelSplits[alloc.channel] = alloc.percentage / 100;
  }

  return {
    totalMonthlyBudget: totalBudget,
    season,
    channelSplits: channelSplits as Record<MediaChannel, number>,
  };
}

/**
 * Calculate expected outcomes from forecast result
 */
function forecastToExpected(
  forecast: MediaForecastResult,
  budget: number
): PlanExpectedOutcomes {
  const { summary } = forecast;

  const totalLeads = summary.totalLeads || 0;
  const totalInstalls = summary.totalInstalls || 0;

  return {
    installs: totalInstalls,
    calls: summary.totalCalls || 0,
    leads: totalLeads,
    impressions: summary.totalImpressions || 0,
    clicks: summary.totalClicks || 0,
    spend: budget,
    cpa: totalInstalls > 0 ? Math.round(budget / totalInstalls) : 0,
    cpl: totalLeads > 0 ? Math.round(budget / totalLeads) : 0,
  };
}

/**
 * Generate mock stores for forecasting when no real store data available
 */
function generateMockStores(count: number = 5): StoreInfo[] {
  const marketTypes: MarketTypeValue[] = ['urban', 'suburban', 'rural'];
  const stores: StoreInfo[] = [];
  for (let i = 1; i <= count; i++) {
    stores.push({
      id: `store_${i}`,
      name: `Store ${i}`,
      market: 'Primary Market',
      marketType: marketTypes[i % 3],
      isActive: true,
    });
  }
  return stores;
}

// ============================================================================
// Main Planner Function
// ============================================================================

/**
 * Build channel mix using MediaProfile preferences
 */
function buildProfileAwareMix(
  baseMix: ChannelMixTemplate[],
  profile: MediaProfile,
  monthlyBudget: number
): ChannelMixTemplate[] {
  const availableChannels = getAvailableChannels(profile);
  let mix: ChannelMixTemplate[] = [];

  // First, add required channels from profile with minimum allocation
  for (const channel of profile.requiredChannels) {
    if (!baseMix.some(m => m.channel === channel)) {
      mix.push({ channel, weight: 0.1 });
    }
  }

  // Add base mix channels (if available in profile)
  for (const template of baseMix) {
    if (availableChannels.includes(template.channel)) {
      const existing = mix.find(m => m.channel === template.channel);
      if (existing) {
        existing.weight = Math.max(existing.weight, template.weight);
      } else {
        mix.push({ ...template });
      }
    }
  }

  // Apply efficiency scoring to adjust weights
  for (const item of mix) {
    const efficiency = calculateChannelEfficiencyScore(
      item.channel,
      monthlyBudget * item.weight,
      profile
    );
    // Boost high-efficiency channels, dampen low-efficiency
    if (efficiency.costEfficiency === 'high') {
      item.weight *= 1.15;
    } else if (efficiency.costEfficiency === 'low') {
      item.weight *= 0.85;
    }
  }

  // Normalize weights
  const totalWeight = mix.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight > 0) {
    mix = mix.map(m => ({ ...m, weight: m.weight / totalWeight }));
  }

  return mix;
}

/**
 * Generate 3 media plan options based on input and company MediaProfile
 */
export async function generateMediaPlanOptions(
  input: MediaPlannerInput
): Promise<AIPlannerResult | AIPlannerError> {
  try {
    const { companyId, objective, monthlyBudget, guardrails, storeCount, timeframe } = input;

    // Fetch company MediaProfile (returns defaults if none exists)
    const profile = await getMediaProfile(companyId);

    // Get seasonality insights
    const seasonalityInsights = analyzeSeasonality(profile.seasonality);

    // Determine current season for forecast adjustments
    const startDate = new Date(timeframe.start);
    const currentMonth = getMonthName(startDate.getMonth());
    const seasonalMultiplier = getSeasonalityMultiplier(profile, currentMonth);

    // Merge guardrails with profile constraints
    const mergedGuardrails = {
      ...guardrails,
      requiredChannels: [
        ...new Set([
          ...(guardrails.requiredChannels || []),
          ...profile.requiredChannels,
        ]),
      ],
      excludedChannels: [
        ...new Set([
          ...(guardrails.excludedChannels || []),
          ...(profile.excludedChannels || []),
        ]),
      ],
      maxCpa: guardrails.maxCpa ?? profile.maxCpa,
    };

    // Get default assumptions for forecasting (will be enhanced with profile data)
    const assumptions = createDefaultAssumptions(companyId);

    // Enhance assumptions with profile benchmarks
    // Note: MediaAssumptions has channel-specific properties directly (search, social, lsa, maps, display)
    // We map from MediaChannel to the appropriate assumption property
    const channelAssumptionMap: Partial<Record<MediaChannel, 'search' | 'social' | 'lsa' | 'maps' | 'display'>> = {
      search: 'search',
      social: 'social',
      lsa: 'lsa',
      maps: 'maps',
      display: 'display',
    };
    for (const channel of getAvailableChannels(profile)) {
      const assumptionKey = channelAssumptionMap[channel];
      if (assumptionKey && assumptions[assumptionKey]) {
        // CPA is computed from the channel assumptions, not directly stored
        // The forecast engine uses CTR, CPC, conversion rates to compute CPA
      }
    }

    // Generate mock stores if count provided
    const stores = generateMockStores(storeCount || 5);

    // Generate 3 plan options
    const options: MediaPlanOption[] = [];

    const configs: Array<{
      label: PlanOptionLabel;
      mixes: Record<PlanObjective, ChannelMixTemplate[]>;
      riskLevel: 'low' | 'medium' | 'high';
      confidenceBase: number;
    }> = [
      { label: 'Conservative', mixes: CONSERVATIVE_MIXES, riskLevel: 'low', confidenceBase: 85 },
      { label: 'Balanced', mixes: BALANCED_MIXES, riskLevel: 'medium', confidenceBase: 75 },
      { label: 'Aggressive', mixes: AGGRESSIVE_MIXES, riskLevel: 'high', confidenceBase: 65 },
    ];

    for (const config of configs) {
      // Get base mix for objective
      const baseMix = config.mixes[objective] || config.mixes.blended;

      // Build profile-aware mix
      const profileAwareMix = buildProfileAwareMix(baseMix, profile, monthlyBudget);

      // Apply guardrails
      const adjustedMix = applyGuardrails(profileAwareMix, mergedGuardrails);

      // Convert to allocations
      const allocations = mixToAllocations(adjustedMix, monthlyBudget, mergedGuardrails.requiredChannels);

      // Run forecast with seasonal adjustment
      const seasonalBudget = Math.round(monthlyBudget * seasonalMultiplier);
      const budgetInput = allocationsToBudgetInput(allocations, seasonalBudget);
      const forecastParams: ForecastParams = {
        assumptions,
        budget: budgetInput,
        stores,
      };

      const forecast = forecastMediaPlan(forecastParams);
      const expected = forecastToExpected(forecast, monthlyBudget);

      // Check CPA guardrail
      let confidenceScore = config.confidenceBase;
      if (mergedGuardrails.maxCpa && expected.cpa > mergedGuardrails.maxCpa) {
        confidenceScore -= 15; // Penalize confidence if CPA exceeds target
      }

      // Adjust confidence based on seasonality
      if (seasonalMultiplier > 1.2) {
        confidenceScore += 5; // Peak season = more confidence
      } else if (seasonalMultiplier < 0.8) {
        confidenceScore -= 5; // Low season = less confidence
      }

      // Get reasoning
      const reasoning = REASONING_TEMPLATES[config.label][objective] ||
        REASONING_TEMPLATES[config.label].blended;

      options.push({
        id: generateId(),
        label: config.label,
        channels: allocations,
        expected,
        reasoning,
        riskLevel: config.riskLevel,
        confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      });
    }

    return {
      success: true,
      options,
      input,
      profile,
      seasonalityInsights: {
        peakMonths: seasonalityInsights.peakMonths,
        lowMonths: seasonalityInsights.lowMonths,
        recommendation: seasonalityInsights.recommendation,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AIPlanner] Failed to generate plan options:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate plan options',
    };
  }
}

// ============================================================================
// Refinement Functions
// ============================================================================

/**
 * Reforecast a plan with adjusted allocations
 */
export function reforecastPlan(
  allocations: ChannelAllocation[],
  totalBudget: number,
  storeCount: number = 5,
  companyId: string = 'default'
): PlanExpectedOutcomes {
  const assumptions = createDefaultAssumptions(companyId);
  const stores = generateMockStores(storeCount);

  const budgetInput = allocationsToBudgetInput(allocations, totalBudget);
  const forecastParams: ForecastParams = {
    assumptions,
    budget: budgetInput,
    stores,
  };

  const forecast = forecastMediaPlan(forecastParams);
  return forecastToExpected(forecast, totalBudget);
}

/**
 * Adjust a single channel's budget and renormalize others
 */
export function adjustChannelBudget(
  allocations: ChannelAllocation[],
  channelToAdjust: MediaChannel,
  newBudget: number,
  totalBudget: number
): ChannelAllocation[] {
  const updated = [...allocations];
  const targetIndex = updated.findIndex(a => a.channel === channelToAdjust);

  if (targetIndex === -1) return allocations;

  // Set new budget for target channel
  updated[targetIndex] = {
    ...updated[targetIndex],
    budget: newBudget,
    percentage: Math.round((newBudget / totalBudget) * 100),
  };

  // Calculate remaining budget
  const remaining = totalBudget - newBudget;
  const otherAllocations = updated.filter((_, i) => i !== targetIndex);
  const otherTotal = otherAllocations.reduce((sum, a) => sum + a.budget, 0);

  // Proportionally adjust other channels
  if (otherTotal > 0) {
    for (let i = 0; i < updated.length; i++) {
      if (i !== targetIndex) {
        const ratio = updated[i].budget / otherTotal;
        updated[i] = {
          ...updated[i],
          budget: Math.round(remaining * ratio),
          percentage: Math.round((remaining * ratio / totalBudget) * 100),
        };
      }
    }
  }

  return updated;
}

// ============================================================================
// Objective & Label Helpers
// ============================================================================

export const PLAN_OBJECTIVES: Array<{ value: PlanObjective; label: string; description: string }> = [
  {
    value: 'max_installs',
    label: 'Maximize Installs',
    description: 'Optimize for new customer acquisition',
  },
  {
    value: 'max_calls',
    label: 'Maximize Calls',
    description: 'Drive inbound phone leads',
  },
  {
    value: 'store_traffic',
    label: 'Store Traffic',
    description: 'Increase foot traffic and local visibility',
  },
  {
    value: 'blended',
    label: 'Blended Goals',
    description: 'Balanced approach across all metrics',
  },
];

export const PLAN_TIMEFRAMES: Array<{ value: PlanTimeframe; label: string; days: number }> = [
  { value: 'next_30_days', label: 'Next 30 Days', days: 30 },
  { value: 'next_90_days', label: 'Next 90 Days', days: 90 },
  { value: 'quarter', label: 'Full Quarter', days: 90 },
  { value: 'custom', label: 'Custom Range', days: 0 },
];

export function getTimeframeDates(
  timeframe: PlanTimeframe,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const now = new Date();

  if (timeframe === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }

  const tf = PLAN_TIMEFRAMES.find(t => t.value === timeframe) || PLAN_TIMEFRAMES[0];
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + tf.days);

  return {
    start: now.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}
