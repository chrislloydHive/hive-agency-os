// lib/media/forecastEngine.ts
// Media Lab Forecast Engine - Complete Implementation
//
// This module transforms assumptions + budgets into forecasted results:
// - Channel-level forecasts with impressions, clicks, leads, calls, installs
// - Store-level breakdowns with performance scores
// - Seasonality adjustments
// - Guard rails for missing/invalid data
//
// Usage:
//   const forecast = forecastMediaPlan({ assumptions, budget, stores });

import type { MediaAssumptions, StoreModifier } from './assumptions';
import {
  type MediaChannel,
  type SeasonKey,
  type StoreInfo,
  type StoreId,
  type MediaBudgetInput,
  type ChannelForecast,
  type StoreForecast,
  type MediaForecastSummary,
  type MediaForecastResult,
  type ForecastWarning,
  CHANNEL_LABELS,
  getSeasonLabel,
  normalizeChannelSplits,
} from './types';

// ============================================================================
// Forecast Engine Parameters
// ============================================================================

export interface ForecastParams {
  assumptions: MediaAssumptions;
  budget: MediaBudgetInput;
  stores: StoreInfo[];
}

// ============================================================================
// Channel-Specific Forecast Logic
// ============================================================================

interface ChannelMetrics {
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  installs: number;
  cpc: number;
  cpm: number;
}

/**
 * Calculate metrics for Search channel (Google Ads)
 * Uses CPC-based model: clicks = budget / cpc
 */
function forecastSearchChannel(
  budget: number,
  assumptions: MediaAssumptions,
  seasonMultiplier: number
): ChannelMetrics {
  const { search } = assumptions;

  // Guard: if CPC is 0 or missing, return zeros
  if (!search.cpc || search.cpc <= 0) {
    return { impressions: 0, clicks: 0, leads: 0, calls: 0, installs: 0, cpc: 0, cpm: 0 };
  }

  // Base calculations
  let clicks = budget / search.cpc;
  let impressions = search.ctr > 0 ? clicks / search.ctr : clicks * 20; // fallback
  let leads = clicks * search.conversionRate;

  // Add assisted conversions
  const assistedLeads = leads * search.assistedConversions;
  leads += assistedLeads;

  // Apply seasonality
  impressions *= seasonMultiplier;
  clicks *= seasonMultiplier;
  leads *= seasonMultiplier;

  // Estimate calls (assume 30% of leads come via phone)
  const calls = leads * 0.3;

  // Estimate installs (lead-to-install rate ~40%)
  const installs = leads * 0.4;

  // Derived metrics
  const cpm = impressions > 0 ? (budget / impressions) * 1000 : 0;

  return {
    impressions: Math.floor(impressions),
    clicks: Math.floor(clicks),
    leads: Math.floor(leads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc: search.cpc,
    cpm,
  };
}

/**
 * Calculate metrics for Social channel (Meta)
 * Uses CPM-based model: impressions = (budget / cpm) * 1000
 */
function forecastSocialChannel(
  budget: number,
  assumptions: MediaAssumptions,
  seasonMultiplier: number
): ChannelMetrics {
  const { social } = assumptions;

  // Guard: if CPM is 0 or missing, return zeros
  if (!social.cpm || social.cpm <= 0) {
    return { impressions: 0, clicks: 0, leads: 0, calls: 0, installs: 0, cpc: 0, cpm: 0 };
  }

  // Base calculations
  let impressions = (budget / social.cpm) * 1000;
  let clicks = impressions * social.ctr;
  let leads = clicks * social.conversionRate;

  // Apply creative fatigue modifier
  leads *= social.creativeFatigueModifier;

  // Apply seasonality
  impressions *= seasonMultiplier;
  clicks *= seasonMultiplier;
  leads *= seasonMultiplier;

  // Social typically has fewer direct calls
  const calls = leads * 0.15;

  // Lower install rate for social
  const installs = leads * 0.3;

  const cpc = clicks > 0 ? budget / clicks : 0;

  return {
    impressions: Math.floor(impressions),
    clicks: Math.floor(clicks),
    leads: Math.floor(leads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc,
    cpm: social.cpm,
  };
}

/**
 * Calculate metrics for LSA channel (Local Services Ads)
 * Uses pay-per-lead model: leads = budget / costPerLead
 */
function forecastLSAChannel(
  budget: number,
  assumptions: MediaAssumptions,
  seasonMultiplier: number
): ChannelMetrics {
  const { lsa } = assumptions;

  // Guard: if cost per lead is 0 or missing, return zeros
  if (!lsa.costPerLead || lsa.costPerLead <= 0) {
    return { impressions: 0, clicks: 0, leads: 0, calls: 0, installs: 0, cpc: 0, cpm: 0 };
  }

  // Base calculations (pay-per-lead)
  const grossLeads = budget / lsa.costPerLead;

  // Adjust for disputed leads
  const netLeads = grossLeads * (1 - lsa.disputeRate);

  // Adjust for lead quality
  let qualifiedLeads = netLeads * (lsa.leadQualityScore / 100);

  // Apply seasonality
  qualifiedLeads *= seasonMultiplier;

  // LSAs are high-intent, mostly phone calls
  const calls = qualifiedLeads * 0.7;

  // Higher install rate for LSAs
  const bookingRate = lsa.bookingRate ?? 0.5;
  const installs = qualifiedLeads * bookingRate;

  // Estimate impressions/clicks (LSAs don't report these traditionally)
  const impressions = grossLeads * 50;
  const clicks = grossLeads * 3;

  return {
    impressions: Math.floor(impressions * seasonMultiplier),
    clicks: Math.floor(clicks * seasonMultiplier),
    leads: Math.floor(qualifiedLeads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc: lsa.costPerLead / 3,
    cpm: 0, // Not applicable for LSAs
  };
}

/**
 * Calculate metrics for Display/Retargeting channel
 * Uses CPM-based model with view-through conversions
 */
function forecastDisplayChannel(
  budget: number,
  assumptions: MediaAssumptions,
  seasonMultiplier: number
): ChannelMetrics {
  const display = assumptions.display;

  // Guard: if display assumptions missing or CPM is 0, return zeros
  if (!display || !display.cpm || display.cpm <= 0) {
    return { impressions: 0, clicks: 0, leads: 0, calls: 0, installs: 0, cpc: 0, cpm: 0 };
  }

  // Base calculations
  let impressions = (budget / display.cpm) * 1000;
  let clicks = impressions * display.ctr;

  // Click-through conversions
  const clickLeads = clicks * display.conversionRate;

  // View-through conversions
  const viewThroughLeads = impressions * display.viewThroughRate;

  let leads = clickLeads + viewThroughLeads;

  // Apply seasonality
  impressions *= seasonMultiplier;
  clicks *= seasonMultiplier;
  leads *= seasonMultiplier;

  // Display has lower direct response
  const calls = leads * 0.1;
  const installs = leads * 0.25;

  const cpc = clicks > 0 ? budget / clicks : 0;

  return {
    impressions: Math.floor(impressions),
    clicks: Math.floor(clicks),
    leads: Math.floor(leads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc,
    cpm: display.cpm,
  };
}

/**
 * Calculate metrics for Maps/GBP channel
 * Uses impression-to-action model
 */
function forecastMapsChannel(
  budget: number,
  assumptions: MediaAssumptions,
  seasonMultiplier: number
): ChannelMetrics {
  const { maps } = assumptions;

  // Maps/GBP is mostly organic, but budget can boost visibility
  // Assume $8 CPM for promoted pins/local ads
  const effectiveCPM = 8;

  let impressions = (budget / effectiveCPM) * 1000;

  // Apply photo and rating multipliers to action rate
  const adjustedActionRate =
    maps.actionsPerImpression *
    maps.photoImpactMultiplier *
    maps.ratingMultiplier;

  let actions = impressions * adjustedActionRate;

  // Apply seasonality
  impressions *= seasonMultiplier;
  actions *= seasonMultiplier;

  // Actions are split between calls, directions, and website clicks
  const calls = actions * 0.4;
  const leads = actions * 0.6; // directions + website

  // Direction requests have lower install rate
  const installs = leads * 0.35;

  // "Clicks" in GBP context = actions
  const clicks = actions;

  return {
    impressions: Math.floor(impressions),
    clicks: Math.floor(clicks),
    leads: Math.floor(leads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc: clicks > 0 ? budget / clicks : 0,
    cpm: effectiveCPM,
  };
}

// ============================================================================
// Generic Channel Forecasting (for channels without specific assumptions)
// ============================================================================

/**
 * Default benchmarks for channels without specific assumptions
 * Values are industry estimates for car audio / local services verticals
 */
const GENERIC_CHANNEL_BENCHMARKS: Record<MediaChannel, {
  cpm: number;
  ctr: number;
  conversionRate: number;
  callRate: number;
  installRate: number;
}> = {
  // Core digital (have specific forecast functions, but included for completeness)
  search: { cpm: 25, ctr: 0.05, conversionRate: 0.05, callRate: 0.3, installRate: 0.4 },
  social: { cpm: 12, ctr: 0.012, conversionRate: 0.025, callRate: 0.2, installRate: 0.3 },
  lsa: { cpm: 80, ctr: 0.08, conversionRate: 0.15, callRate: 0.8, installRate: 0.5 },
  display: { cpm: 4, ctr: 0.005, conversionRate: 0.01, callRate: 0.1, installRate: 0.25 },
  maps: { cpm: 8, ctr: 0.02, conversionRate: 0.03, callRate: 0.4, installRate: 0.35 },
  // Additional digital
  youtube: { cpm: 10, ctr: 0.015, conversionRate: 0.02, callRate: 0.15, installRate: 0.25 },
  microsoft_search: { cpm: 20, ctr: 0.04, conversionRate: 0.05, callRate: 0.3, installRate: 0.38 },
  tiktok: { cpm: 8, ctr: 0.015, conversionRate: 0.02, callRate: 0.1, installRate: 0.25 },
  email: { cpm: 2, ctr: 0.03, conversionRate: 0.04, callRate: 0.2, installRate: 0.35 },
  affiliate: { cpm: 15, ctr: 0.02, conversionRate: 0.08, callRate: 0.25, installRate: 0.4 },
  // Traditional/offline - lower direct response metrics
  radio: { cpm: 3, ctr: 0.002, conversionRate: 0.005, callRate: 0.6, installRate: 0.2 },
  tv: { cpm: 15, ctr: 0.001, conversionRate: 0.003, callRate: 0.5, installRate: 0.15 },
  streaming_audio: { cpm: 6, ctr: 0.003, conversionRate: 0.008, callRate: 0.4, installRate: 0.2 },
  out_of_home: { cpm: 5, ctr: 0.001, conversionRate: 0.002, callRate: 0.3, installRate: 0.15 },
  print: { cpm: 10, ctr: 0.002, conversionRate: 0.005, callRate: 0.5, installRate: 0.18 },
  direct_mail: { cpm: 250, ctr: 0.04, conversionRate: 0.1, callRate: 0.4, installRate: 0.35 },
};

/**
 * Calculate metrics for channels using generic benchmarks
 * Uses CPM-based model: impressions = (budget / cpm) * 1000
 */
function forecastGenericChannel(
  channel: MediaChannel,
  budget: number,
  seasonMultiplier: number
): ChannelMetrics {
  const benchmarks = GENERIC_CHANNEL_BENCHMARKS[channel];

  if (!benchmarks || benchmarks.cpm <= 0) {
    return { impressions: 0, clicks: 0, leads: 0, calls: 0, installs: 0, cpc: 0, cpm: 0 };
  }

  // Base calculations
  let impressions = (budget / benchmarks.cpm) * 1000;
  let clicks = impressions * benchmarks.ctr;
  let leads = clicks * benchmarks.conversionRate;

  // Apply seasonality
  impressions *= seasonMultiplier;
  clicks *= seasonMultiplier;
  leads *= seasonMultiplier;

  // Derive calls and installs
  const calls = leads * benchmarks.callRate;
  const installs = leads * benchmarks.installRate;

  const cpc = clicks > 0 ? budget / clicks : 0;

  return {
    impressions: Math.floor(impressions),
    clicks: Math.floor(clicks),
    leads: Math.floor(leads),
    calls: Math.floor(calls),
    installs: Math.floor(installs),
    cpc,
    cpm: benchmarks.cpm,
  };
}

// ============================================================================
// Seasonality Multiplier
// ============================================================================

/**
 * Get the seasonality multiplier for a given season
 * Returns a multiplier > 1 for peak seasons, 1 for baseline
 */
function getSeasonalityMultiplier(
  season: SeasonKey,
  assumptions: MediaAssumptions
): number {
  if (season === 'baseline') return 1.0;

  const seasonalityMap: Record<string, keyof MediaAssumptions['seasonality']> = {
    remote_start: 'remoteStart',
    holiday: 'holiday',
    carplay_season: 'carplaySeason',
    summer_audio: 'summerAudio',
  };

  const seasonKey = seasonalityMap[season];
  if (!seasonKey) return 1.0;

  const modifier = assumptions.seasonality[seasonKey];
  if (!modifier || !modifier.enabled) return 1.0;

  // Convert spend lift and conversion lift into a combined multiplier
  const spendMult = 1 + (modifier.spendLiftPercent / 100);
  const convMult = 1 + (modifier.conversionLiftPercent / 100);

  // Blend: more spend + better conversion = more results
  return (spendMult + convMult) / 2;
}

// ============================================================================
// Store-Level Allocation
// ============================================================================

/**
 * Allocate forecast metrics across stores
 */
function allocateToStores(
  channelForecasts: ChannelForecast[],
  stores: StoreInfo[],
  budget: MediaBudgetInput,
  assumptions: MediaAssumptions
): StoreForecast[] {
  if (stores.length === 0) {
    // Create a single "All Stores" entry
    const totals = channelForecasts.reduce(
      (acc, cf) => ({
        budget: acc.budget + cf.budget,
        leads: acc.leads + cf.leads,
        calls: acc.calls + cf.calls,
        installs: acc.installs + cf.installs,
      }),
      { budget: 0, leads: 0, calls: 0, installs: 0 }
    );

    return [{
      storeId: 'all',
      storeName: 'All Locations',
      market: 'All Markets',
      marketType: 'suburban',
      totalBudget: totals.budget,
      budgetPercent: 100,
      totalLeads: totals.leads,
      totalCalls: totals.calls,
      totalInstalls: totals.installs,
      effectiveCPL: totals.leads > 0 ? totals.budget / totals.leads : null,
      visibilityScore: 75,
      demandScore: 75,
      conversionScore: 75,
      performanceIndicator: 'average',
    }];
  }

  // Get total metrics for percentage calculations
  const totalMetrics = channelForecasts.reduce(
    (acc, cf) => ({
      budget: acc.budget + cf.budget,
      impressions: acc.impressions + cf.impressions,
      leads: acc.leads + cf.leads,
      calls: acc.calls + cf.calls,
      installs: acc.installs + cf.installs,
    }),
    { budget: 0, impressions: 0, leads: 0, calls: 0, installs: 0 }
  );

  // Calculate store weights based on modifiers or even distribution
  const storeWeights: Record<StoreId, number> = {};
  let totalWeight = 0;

  for (const store of stores) {
    if (!store.isActive) continue;

    // Check if we have explicit splits
    if (budget.storeSplits && budget.storeSplits[store.id] !== undefined) {
      storeWeights[store.id] = budget.storeSplits[store.id];
    } else {
      // Use store modifiers to calculate weight
      const modifier = assumptions.storeModifiers.find(m => m.storeId === store.id);

      if (modifier) {
        // Higher conversion modifier = more weight
        // Lower cost modifier = more efficient
        storeWeights[store.id] = modifier.conversionModifier / modifier.costModifier;
      } else {
        // Default weight based on market type
        const marketWeights: Record<string, number> = {
          urban: 1.2,
          suburban: 1.0,
          rural: 0.8,
        };
        storeWeights[store.id] = marketWeights[store.marketType] ?? 1.0;
      }
    }

    totalWeight += storeWeights[store.id];
  }

  // Normalize weights
  if (totalWeight === 0) totalWeight = 1;

  // Build store forecasts
  const storeForecasts: StoreForecast[] = [];
  let maxImpressions = 0;
  let maxLeads = 0;
  let maxInstalls = 0;

  for (const store of stores) {
    if (!store.isActive) continue;

    const weight = (storeWeights[store.id] ?? 0) / totalWeight;

    const storeBudget = totalMetrics.budget * weight;
    const storeImpressions = totalMetrics.impressions * weight;
    const storeLeads = totalMetrics.leads * weight;
    const storeCalls = totalMetrics.calls * weight;
    const storeInstalls = totalMetrics.installs * weight;

    // Track max values for score calculation
    maxImpressions = Math.max(maxImpressions, storeImpressions);
    maxLeads = Math.max(maxLeads, storeLeads);
    maxInstalls = Math.max(maxInstalls, storeInstalls);

    storeForecasts.push({
      storeId: store.id,
      storeName: store.name,
      market: store.market,
      marketType: store.marketType,
      totalBudget: Math.floor(storeBudget),
      budgetPercent: weight * 100,
      totalLeads: Math.floor(storeLeads),
      totalCalls: Math.floor(storeCalls),
      totalInstalls: Math.floor(storeInstalls),
      effectiveCPL: storeLeads > 0 ? storeBudget / storeLeads : null,
      visibilityScore: 0, // Calculate below
      demandScore: 0,
      conversionScore: 0,
      performanceIndicator: 'average',
    });
  }

  // Calculate scores (0-100 percentile-ish)
  for (const sf of storeForecasts) {
    // Visibility = impressions relative to max
    const storeImpressions = (totalMetrics.impressions * sf.budgetPercent) / 100;
    sf.visibilityScore = maxImpressions > 0
      ? Math.round((storeImpressions / maxImpressions) * 100)
      : 50;

    // Demand = leads + calls relative to max
    sf.demandScore = maxLeads > 0
      ? Math.round(((sf.totalLeads + sf.totalCalls) / (maxLeads + maxLeads * 0.3)) * 100)
      : 50;

    // Conversion = installs / leads ratio
    const conversionRate = sf.totalLeads > 0 ? sf.totalInstalls / sf.totalLeads : 0;
    sf.conversionScore = Math.min(100, Math.round(conversionRate * 250)); // 40% = 100

    // Performance indicator based on demand vs budget
    const demandPerBudget = sf.totalBudget > 0
      ? (sf.totalLeads + sf.totalCalls) / sf.totalBudget
      : 0;

    const avgDemandPerBudget = totalMetrics.budget > 0
      ? (totalMetrics.leads + totalMetrics.calls) / totalMetrics.budget
      : 0;

    if (demandPerBudget > avgDemandPerBudget * 1.15) {
      sf.performanceIndicator = 'overperforming';
    } else if (demandPerBudget < avgDemandPerBudget * 0.85) {
      sf.performanceIndicator = 'underperforming';
    } else {
      sf.performanceIndicator = 'average';
    }
  }

  return storeForecasts;
}

// ============================================================================
// Main Forecast Function
// ============================================================================

/**
 * Generate a complete media forecast based on assumptions, budget, and stores
 *
 * @param params - Forecast parameters including assumptions, budget input, and store list
 * @returns Complete forecast result with channel and store breakdowns
 *
 * @example
 * ```ts
 * const forecast = forecastMediaPlan({
 *   assumptions: mediaAssumptions,
 *   budget: {
 *     totalMonthlyBudget: 10000,
 *     season: 'remote_start',
 *     channelSplits: { search: 0.4, social: 0.2, lsa: 0.2, display: 0.1, maps: 0.1 },
 *   },
 *   stores: [{ id: '1', name: 'Seattle', market: 'Seattle', marketType: 'urban', isActive: true }],
 * });
 * ```
 */
export function forecastMediaPlan(params: ForecastParams): MediaForecastResult {
  const { assumptions, budget, stores } = params;
  const warnings: ForecastWarning[] = [];

  // Handle zero budget
  if (budget.totalMonthlyBudget <= 0) {
    return createEmptyForecast(budget.season, [
      { message: 'Set a budget to see forecasts', severity: 'info' },
    ]);
  }

  // Normalize channel splits
  const normalizedSplits = normalizeChannelSplits(budget.channelSplits);

  // Check for all-zero splits
  const hasNonZeroSplit = Object.values(normalizedSplits).some(v => v > 0);
  if (!hasNonZeroSplit) {
    return createEmptyForecast(budget.season, [
      { message: 'Allocate budget to at least one channel', severity: 'warning' },
    ]);
  }

  // Get seasonality multiplier
  const seasonMultiplier = getSeasonalityMultiplier(budget.season, assumptions);

  // Forecast each channel
  const channelForecasts: ChannelForecast[] = [];

  // All supported channels (from types.ts)
  const allChannels: MediaChannel[] = [
    // Core digital
    'search', 'social', 'lsa', 'display', 'maps',
    // Additional digital
    'youtube', 'microsoft_search', 'tiktok', 'email', 'affiliate',
    // Traditional/offline
    'radio', 'tv', 'streaming_audio', 'out_of_home', 'print', 'direct_mail',
  ];

  for (const channel of allChannels) {
    const channelBudget = budget.totalMonthlyBudget * (normalizedSplits[channel] || 0);

    if (channelBudget <= 0) continue;

    let metrics: ChannelMetrics;

    // Use specific forecast functions for channels with detailed assumptions
    // Fall back to generic benchmark-based forecasts for others
    switch (channel) {
      case 'search':
        metrics = forecastSearchChannel(channelBudget, assumptions, seasonMultiplier);
        break;
      case 'social':
        metrics = forecastSocialChannel(channelBudget, assumptions, seasonMultiplier);
        break;
      case 'lsa':
        metrics = forecastLSAChannel(channelBudget, assumptions, seasonMultiplier);
        break;
      case 'display':
        metrics = forecastDisplayChannel(channelBudget, assumptions, seasonMultiplier);
        if (metrics.impressions === 0 && channelBudget > 0) {
          warnings.push({
            channel,
            message: `Missing assumptions for ${CHANNEL_LABELS[channel]}; not included in forecast`,
            severity: 'warning',
          });
        }
        break;
      case 'maps':
        metrics = forecastMapsChannel(channelBudget, assumptions, seasonMultiplier);
        break;
      default:
        // Use generic forecast for all other channels
        metrics = forecastGenericChannel(channel, channelBudget, seasonMultiplier);
        break;
    }

    // Check for zero output despite budget
    if (metrics.leads === 0 && metrics.impressions === 0 && channelBudget > 0) {
      warnings.push({
        channel,
        message: `Missing or invalid assumptions for ${CHANNEL_LABELS[channel]}`,
        severity: 'warning',
      });
      continue;
    }

    channelForecasts.push({
      channel,
      channelLabel: CHANNEL_LABELS[channel],
      budget: Math.floor(channelBudget),
      budgetPercent: normalizedSplits[channel] * 100,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      leads: metrics.leads,
      calls: metrics.calls,
      installs: metrics.installs,
      cpc: metrics.cpc,
      cpm: metrics.cpm,
      cpl: metrics.leads > 0 ? channelBudget / metrics.leads : null,
      convRate: metrics.clicks > 0 ? metrics.leads / metrics.clicks : 0,
      leadShare: 0, // Calculate after totals
    });
  }

  // Calculate lead share for each channel
  const totalLeads = channelForecasts.reduce((sum, cf) => sum + cf.leads, 0);
  for (const cf of channelForecasts) {
    cf.leadShare = totalLeads > 0 ? (cf.leads / totalLeads) * 100 : 0;
  }

  // Aggregate summary
  const summary: MediaForecastSummary = {
    totalBudget: budget.totalMonthlyBudget,
    totalImpressions: channelForecasts.reduce((sum, cf) => sum + cf.impressions, 0),
    totalClicks: channelForecasts.reduce((sum, cf) => sum + cf.clicks, 0),
    totalLeads,
    totalCalls: channelForecasts.reduce((sum, cf) => sum + cf.calls, 0),
    totalInstalls: channelForecasts.reduce((sum, cf) => sum + cf.installs, 0),
    blendedCPC: 0,
    blendedCPL: null,
    blendedCPI: null,
    blendedConvRate: 0,
  };

  // Calculate blended metrics
  summary.blendedCPC = summary.totalClicks > 0
    ? budget.totalMonthlyBudget / summary.totalClicks
    : 0;
  summary.blendedCPL = summary.totalLeads > 0
    ? budget.totalMonthlyBudget / summary.totalLeads
    : null;
  summary.blendedCPI = summary.totalInstalls > 0
    ? budget.totalMonthlyBudget / summary.totalInstalls
    : null;
  summary.blendedConvRate = summary.totalClicks > 0
    ? summary.totalLeads / summary.totalClicks
    : 0;

  // Allocate to stores
  const storeForecasts = allocateToStores(channelForecasts, stores, budget, assumptions);

  return {
    generatedAt: new Date().toISOString(),
    season: budget.season,
    seasonLabel: getSeasonLabel(budget.season),
    summary,
    byChannel: channelForecasts,
    byStore: storeForecasts,
    warnings,
  };
}

/**
 * Create an empty forecast result (for zero budget or invalid input)
 */
function createEmptyForecast(
  season: SeasonKey,
  warnings: ForecastWarning[]
): MediaForecastResult {
  return {
    generatedAt: new Date().toISOString(),
    season,
    seasonLabel: getSeasonLabel(season),
    summary: {
      totalBudget: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLeads: 0,
      totalCalls: 0,
      totalInstalls: 0,
      blendedCPC: 0,
      blendedCPL: null,
      blendedCPI: null,
      blendedConvRate: 0,
    },
    byChannel: [],
    byStore: [],
    warnings,
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

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

export {
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  SEASON_OPTIONS,
  DEFAULT_CHANNEL_SPLITS,
  getSeasonLabel,
  normalizeChannelSplits,
  formatCurrency,
  formatCompact,
  formatPercent,
} from './types';
