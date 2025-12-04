// lib/media/aiPlanner.client.ts
// Client-safe exports from aiPlanner
//
// This file contains types, constants, and pure functions that can be safely
// imported into client components without pulling in server-side dependencies.
//
// For server-side functions like generateMediaPlanOptions, use the API route
// or import from aiPlanner.ts directly in server components.

import { forecastMediaPlan, type ForecastParams } from './forecastEngine';
import { createDefaultAssumptions } from './assumptions';
import type { MediaChannel, StoreInfo, MediaBudgetInput } from './types';

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

// Note: AIPlannerResult includes MediaProfile which has server dependencies
// Use the API response type instead in client components
export interface AIPlannerResultClient {
  success: true;
  options: MediaPlanOption[];
  input: MediaPlannerInput;
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
// Constants
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

// ============================================================================
// Pure Functions (no server dependencies)
// ============================================================================

/**
 * Get start and end dates for a timeframe preset
 */
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
        const adjustedBudget = Math.round(remaining * ratio);
        updated[i] = {
          ...updated[i],
          budget: adjustedBudget,
          percentage: Math.round((adjustedBudget / totalBudget) * 100),
        };
      }
    }
  }

  return updated;
}

/**
 * Re-forecast a plan after budget adjustments
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

// ============================================================================
// Internal Helpers
// ============================================================================

function generateMockStores(count: number): StoreInfo[] {
  const stores: StoreInfo[] = [];
  const markets = ['Dallas', 'Houston', 'Austin', 'San Antonio', 'Phoenix', 'Denver'];
  const marketTypes: Array<'urban' | 'suburban' | 'rural'> = ['urban', 'suburban', 'suburban', 'urban', 'urban', 'suburban'];

  for (let i = 0; i < count; i++) {
    stores.push({
      id: `store-${i + 1}`,
      name: `Store ${i + 1}`,
      market: markets[i % markets.length],
      marketType: marketTypes[i % marketTypes.length],
      isActive: true,
    });
  }

  return stores;
}

function allocationsToBudgetInput(
  allocations: ChannelAllocation[],
  totalBudget: number
): MediaBudgetInput {
  const channelSplits: Record<MediaChannel, number> = {
    search: 0,
    social: 0,
    lsa: 0,
    display: 0,
    maps: 0,
    youtube: 0,
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

  for (const alloc of allocations) {
    channelSplits[alloc.channel] = alloc.percentage / 100;
  }

  return {
    totalMonthlyBudget: totalBudget,
    season: 'baseline',
    channelSplits,
  };
}

function forecastToExpected(
  forecast: ReturnType<typeof forecastMediaPlan>,
  totalBudget: number
): PlanExpectedOutcomes {
  const summary = forecast.summary;
  const totalLeadCount = summary.totalCalls + summary.totalLeads;

  return {
    installs: Math.round(summary.totalInstalls),
    calls: Math.round(summary.totalCalls),
    leads: Math.round(totalLeadCount),
    impressions: Math.round(summary.totalImpressions),
    clicks: Math.round(summary.totalClicks),
    spend: totalBudget,
    cpa: summary.totalInstalls > 0 ? totalBudget / summary.totalInstalls : 0,
    cpl: totalLeadCount > 0 ? totalBudget / totalLeadCount : 0,
  };
}
