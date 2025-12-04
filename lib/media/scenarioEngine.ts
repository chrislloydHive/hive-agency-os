// lib/media/scenarioEngine.ts
// Scenario Engine - Refinement and Reforecasting for Media Plans
//
// This module handles:
// 1. User refinements to AI-generated plans
// 2. Reforecasting after budget/channel adjustments
// 3. Scenario comparisons and what-if analysis
// 4. Saving and loading scenario variants

import { forecastMediaPlan, type ForecastParams } from './forecastEngine';
import { createDefaultAssumptions } from './assumptions';
import {
  getMediaProfile,
  getChannelCpa,
  getSeasonalityMultiplier,
  type MediaProfile,
} from './mediaProfile';
import { getMonthName, applySeasonalityToYear } from './seasonality';
import { getChannelBenchmarks, calculateChannelEfficiencyScore } from './channelBenchmarks';
import type {
  MediaChannel,
  MediaBudgetInput,
  StoreInfo,
  MarketTypeValue,
} from './types';
import type {
  MediaPlanOption,
  ChannelAllocation,
  PlanExpectedOutcomes,
} from './aiPlanner';

// ============================================================================
// Types
// ============================================================================

export interface ScenarioAdjustment {
  type: 'budget_change' | 'channel_add' | 'channel_remove' | 'channel_rebalance';
  channel?: MediaChannel;
  oldValue?: number;
  newValue?: number;
  description: string;
}

export interface Scenario {
  id: string;
  name: string;
  basePlanId: string;
  companyId: string;
  allocations: ChannelAllocation[];
  totalBudget: number;
  expected: PlanExpectedOutcomes;
  adjustments: ScenarioAdjustment[];
  comparison?: ScenarioComparison;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioComparison {
  vsBaseline: {
    installsDelta: number;
    installsDeltaPct: number;
    callsDelta: number;
    callsDeltaPct: number;
    cpaDelta: number;
    cpaDeltaPct: number;
    spendDelta: number;
    spendDeltaPct: number;
  };
  efficiency: 'better' | 'same' | 'worse';
  recommendation: string;
}

export interface ReforecastInput {
  companyId: string;
  allocations: ChannelAllocation[];
  totalBudget: number;
  storeCount?: number;
  startDate?: string;
}

export interface ReforecastResult {
  expected: PlanExpectedOutcomes;
  monthlyBreakdown?: MonthlyForecast[];
  channelMetrics: ChannelMetrics[];
}

export interface MonthlyForecast {
  month: string;
  installs: number;
  calls: number;
  spend: number;
  seasonalMultiplier: number;
}

export interface ChannelMetrics {
  channel: MediaChannel;
  budget: number;
  expectedLeads: number;
  expectedCpa: number;
  efficiency: 'high' | 'medium' | 'low';
}

// ============================================================================
// Scenario Generation
// ============================================================================

/**
 * Generate a unique scenario ID
 */
function generateScenarioId(): string {
  return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new scenario from a base plan option
 */
export function createScenarioFromPlan(
  plan: MediaPlanOption,
  companyId: string,
  name?: string
): Scenario {
  const now = new Date().toISOString();

  return {
    id: generateScenarioId(),
    name: name || `${plan.label} Scenario`,
    basePlanId: plan.id,
    companyId,
    allocations: [...plan.channels],
    totalBudget: plan.expected.spend,
    expected: { ...plan.expected },
    adjustments: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Refinement Operations
// ============================================================================

/**
 * Adjust a channel's budget and rebalance others proportionally
 */
export function adjustChannelBudget(
  scenario: Scenario,
  channel: MediaChannel,
  newBudget: number
): Scenario {
  const allocations = [...scenario.allocations];
  const targetIndex = allocations.findIndex(a => a.channel === channel);

  if (targetIndex === -1) {
    throw new Error(`Channel ${channel} not found in scenario`);
  }

  const oldBudget = allocations[targetIndex].budget;
  const budgetDelta = newBudget - oldBudget;

  // Update target channel
  allocations[targetIndex] = {
    ...allocations[targetIndex],
    budget: newBudget,
    percentage: Math.round((newBudget / scenario.totalBudget) * 100),
  };

  // Proportionally adjust other channels
  const otherChannels = allocations.filter((_, i) => i !== targetIndex);
  const otherTotal = otherChannels.reduce((sum, a) => sum + a.budget, 0);

  if (otherTotal > 0 && budgetDelta !== 0) {
    for (let i = 0; i < allocations.length; i++) {
      if (i !== targetIndex) {
        const ratio = allocations[i].budget / otherTotal;
        const adjustment = Math.round(budgetDelta * ratio);
        allocations[i] = {
          ...allocations[i],
          budget: Math.max(0, allocations[i].budget - adjustment),
          percentage: Math.round(
            ((allocations[i].budget - adjustment) / scenario.totalBudget) * 100
          ),
        };
      }
    }
  }

  const adjustment: ScenarioAdjustment = {
    type: 'channel_rebalance',
    channel,
    oldValue: oldBudget,
    newValue: newBudget,
    description: `Adjusted ${channel} from $${oldBudget.toLocaleString()} to $${newBudget.toLocaleString()}`,
  };

  return {
    ...scenario,
    allocations,
    adjustments: [...scenario.adjustments, adjustment],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add a new channel to the scenario
 */
export function addChannel(
  scenario: Scenario,
  channel: MediaChannel,
  budgetAmount: number
): Scenario {
  // Check if channel already exists
  if (scenario.allocations.some(a => a.channel === channel)) {
    throw new Error(`Channel ${channel} already exists in scenario`);
  }

  const allocations = [...scenario.allocations];

  // Reduce other channels proportionally
  const totalOtherBudget = scenario.totalBudget - budgetAmount;
  const currentTotal = allocations.reduce((sum, a) => sum + a.budget, 0);

  for (let i = 0; i < allocations.length; i++) {
    const ratio = allocations[i].budget / currentTotal;
    allocations[i] = {
      ...allocations[i],
      budget: Math.round(totalOtherBudget * ratio),
      percentage: Math.round((totalOtherBudget * ratio / scenario.totalBudget) * 100),
    };
  }

  // Add new channel
  allocations.push({
    channel,
    budget: budgetAmount,
    percentage: Math.round((budgetAmount / scenario.totalBudget) * 100),
    isRequired: false,
  });

  const adjustment: ScenarioAdjustment = {
    type: 'channel_add',
    channel,
    newValue: budgetAmount,
    description: `Added ${channel} with $${budgetAmount.toLocaleString()} budget`,
  };

  return {
    ...scenario,
    allocations,
    adjustments: [...scenario.adjustments, adjustment],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Remove a channel from the scenario
 */
export function removeChannel(
  scenario: Scenario,
  channel: MediaChannel
): Scenario {
  const channelToRemove = scenario.allocations.find(a => a.channel === channel);

  if (!channelToRemove) {
    throw new Error(`Channel ${channel} not found in scenario`);
  }

  if (channelToRemove.isRequired) {
    throw new Error(`Cannot remove required channel ${channel}`);
  }

  const removedBudget = channelToRemove.budget;
  const allocations = scenario.allocations.filter(a => a.channel !== channel);

  // Redistribute removed budget
  const remainingTotal = allocations.reduce((sum, a) => sum + a.budget, 0);

  for (let i = 0; i < allocations.length; i++) {
    const ratio = allocations[i].budget / remainingTotal;
    const additionalBudget = Math.round(removedBudget * ratio);
    allocations[i] = {
      ...allocations[i],
      budget: allocations[i].budget + additionalBudget,
      percentage: Math.round(
        ((allocations[i].budget + additionalBudget) / scenario.totalBudget) * 100
      ),
    };
  }

  const adjustment: ScenarioAdjustment = {
    type: 'channel_remove',
    channel,
    oldValue: removedBudget,
    description: `Removed ${channel} ($${removedBudget.toLocaleString()} redistributed)`,
  };

  return {
    ...scenario,
    allocations,
    adjustments: [...scenario.adjustments, adjustment],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Change total budget and scale all channels proportionally
 */
export function changeTotalBudget(
  scenario: Scenario,
  newTotalBudget: number
): Scenario {
  const scaleFactor = newTotalBudget / scenario.totalBudget;

  const allocations = scenario.allocations.map(a => ({
    ...a,
    budget: Math.round(a.budget * scaleFactor),
    // Percentages stay the same when scaling proportionally
  }));

  const adjustment: ScenarioAdjustment = {
    type: 'budget_change',
    oldValue: scenario.totalBudget,
    newValue: newTotalBudget,
    description: `Changed total budget from $${scenario.totalBudget.toLocaleString()} to $${newTotalBudget.toLocaleString()}`,
  };

  return {
    ...scenario,
    allocations,
    totalBudget: newTotalBudget,
    adjustments: [...scenario.adjustments, adjustment],
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Reforecasting
// ============================================================================

/**
 * Generate mock stores for forecasting
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

/**
 * Reforecast a scenario with current allocations
 */
export async function reforecastScenario(
  scenario: Scenario,
  storeCount?: number,
  startDate?: string
): Promise<ReforecastResult> {
  const profile = await getMediaProfile(scenario.companyId);

  // Get seasonality multiplier for start date
  const date = startDate ? new Date(startDate) : new Date();
  const currentMonth = getMonthName(date.getMonth());
  const seasonalMultiplier = getSeasonalityMultiplier(profile, currentMonth);

  // Build assumptions with profile data
  const assumptions = createDefaultAssumptions(scenario.companyId);

  // Build channel splits
  const channelSplits: Partial<Record<MediaChannel, number>> = {};
  for (const alloc of scenario.allocations) {
    channelSplits[alloc.channel] = alloc.percentage / 100;
    // Note: CPA is computed from channel assumptions (CTR, CPC, conversion rates)
    // The forecast engine handles the projection using these base assumptions
  }

  const budgetInput: MediaBudgetInput = {
    totalMonthlyBudget: Math.round(scenario.totalBudget * seasonalMultiplier),
    season: 'baseline',
    channelSplits: channelSplits as Record<MediaChannel, number>,
  };

  const stores = generateMockStores(storeCount || 5);

  const forecastParams: ForecastParams = {
    assumptions,
    budget: budgetInput,
    stores,
  };

  const forecast = forecastMediaPlan(forecastParams);
  const { summary } = forecast;

  const totalLeads = summary.totalLeads || 0;
  const totalInstalls = summary.totalInstalls || 0;

  const expected: PlanExpectedOutcomes = {
    installs: totalInstalls,
    calls: summary.totalCalls || 0,
    leads: totalLeads,
    impressions: summary.totalImpressions || 0,
    clicks: summary.totalClicks || 0,
    spend: scenario.totalBudget,
    cpa: totalInstalls > 0 ? Math.round(scenario.totalBudget / totalInstalls) : 0,
    cpl: totalLeads > 0 ? Math.round(scenario.totalBudget / totalLeads) : 0,
  };

  // Calculate channel-level metrics
  const channelMetrics: ChannelMetrics[] = scenario.allocations.map(alloc => {
    const benchmarks = getChannelBenchmarks(alloc.channel, profile);
    const efficiency = calculateChannelEfficiencyScore(alloc.channel, alloc.budget, profile);

    return {
      channel: alloc.channel,
      budget: alloc.budget,
      expectedLeads: Math.floor(alloc.budget / benchmarks.cpa),
      expectedCpa: benchmarks.cpa,
      efficiency: efficiency.costEfficiency,
    };
  });

  // Generate monthly breakdown
  const monthlyBreakdown = generateMonthlyBreakdown(
    expected,
    profile,
    date.getMonth()
  );

  return {
    expected,
    monthlyBreakdown,
    channelMetrics,
  };
}

/**
 * Generate 12-month breakdown with seasonality
 */
function generateMonthlyBreakdown(
  annualExpected: PlanExpectedOutcomes,
  profile: MediaProfile,
  startMonth: number
): MonthlyForecast[] {
  const months: MonthlyForecast[] = [];

  // Calculate base monthly values (flat distribution)
  const baseMonthlyInstalls = annualExpected.installs / 12;
  const baseMonthlyCalls = annualExpected.calls / 12;
  const baseMonthlySpend = annualExpected.spend / 12;

  for (let i = 0; i < 12; i++) {
    const monthIndex = (startMonth + i) % 12;
    const monthName = getMonthName(monthIndex);
    const multiplier = getSeasonalityMultiplier(profile, monthName);

    months.push({
      month: monthName,
      installs: Math.round(baseMonthlyInstalls * multiplier),
      calls: Math.round(baseMonthlyCalls * multiplier),
      spend: Math.round(baseMonthlySpend * multiplier),
      seasonalMultiplier: multiplier,
    });
  }

  return months;
}

// ============================================================================
// Scenario Comparison
// ============================================================================

/**
 * Compare a scenario to a baseline
 */
export function compareToBaseline(
  scenario: Scenario,
  baseline: PlanExpectedOutcomes
): ScenarioComparison {
  const vsBaseline = {
    installsDelta: scenario.expected.installs - baseline.installs,
    installsDeltaPct: baseline.installs > 0
      ? Math.round(((scenario.expected.installs - baseline.installs) / baseline.installs) * 100)
      : 0,
    callsDelta: scenario.expected.calls - baseline.calls,
    callsDeltaPct: baseline.calls > 0
      ? Math.round(((scenario.expected.calls - baseline.calls) / baseline.calls) * 100)
      : 0,
    cpaDelta: scenario.expected.cpa - baseline.cpa,
    cpaDeltaPct: baseline.cpa > 0
      ? Math.round(((scenario.expected.cpa - baseline.cpa) / baseline.cpa) * 100)
      : 0,
    spendDelta: scenario.expected.spend - baseline.spend,
    spendDeltaPct: baseline.spend > 0
      ? Math.round(((scenario.expected.spend - baseline.spend) / baseline.spend) * 100)
      : 0,
  };

  // Determine efficiency (lower CPA = better, more installs = better)
  let efficiency: 'better' | 'same' | 'worse';
  const cpaImprovement = vsBaseline.cpaDeltaPct < 0;
  const volumeIncrease = vsBaseline.installsDeltaPct > 0;

  if (cpaImprovement && volumeIncrease) {
    efficiency = 'better';
  } else if (!cpaImprovement && !volumeIncrease) {
    efficiency = 'worse';
  } else if (Math.abs(vsBaseline.cpaDeltaPct) < 5 && Math.abs(vsBaseline.installsDeltaPct) < 5) {
    efficiency = 'same';
  } else {
    // Trade-off: one metric better, one worse
    efficiency = cpaImprovement ? 'better' : 'same';
  }

  // Generate recommendation
  let recommendation: string;
  if (efficiency === 'better') {
    recommendation = `This scenario improves efficiency with ${vsBaseline.installsDeltaPct}% more installs at ${Math.abs(vsBaseline.cpaDeltaPct)}% lower CPA.`;
  } else if (efficiency === 'worse') {
    recommendation = `This scenario has lower performance. Consider reverting changes or adjusting channel mix.`;
  } else {
    recommendation = `This scenario shows similar performance to baseline with different channel distribution.`;
  }

  return {
    vsBaseline,
    efficiency,
    recommendation,
  };
}

/**
 * Update scenario with reforecast results and comparison
 */
export async function updateScenarioWithForecast(
  scenario: Scenario,
  baseline: PlanExpectedOutcomes,
  storeCount?: number,
  startDate?: string
): Promise<Scenario> {
  const reforecast = await reforecastScenario(scenario, storeCount, startDate);
  const comparison = compareToBaseline(
    { ...scenario, expected: reforecast.expected },
    baseline
  );

  return {
    ...scenario,
    expected: reforecast.expected,
    comparison,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// What-If Analysis
// ============================================================================

export interface WhatIfResult {
  scenario: string;
  expected: PlanExpectedOutcomes;
  delta: {
    installs: number;
    cpa: number;
  };
}

/**
 * Run quick what-if analysis for common adjustments
 */
export async function runWhatIfAnalysis(
  baseScenario: Scenario,
  storeCount?: number
): Promise<WhatIfResult[]> {
  const results: WhatIfResult[] = [];

  // What if we increase budget by 20%?
  const budgetUp = changeTotalBudget(baseScenario, Math.round(baseScenario.totalBudget * 1.2));
  const budgetUpForecast = await reforecastScenario(budgetUp, storeCount);
  results.push({
    scenario: '+20% Budget',
    expected: budgetUpForecast.expected,
    delta: {
      installs: budgetUpForecast.expected.installs - baseScenario.expected.installs,
      cpa: budgetUpForecast.expected.cpa - baseScenario.expected.cpa,
    },
  });

  // What if we decrease budget by 20%?
  const budgetDown = changeTotalBudget(baseScenario, Math.round(baseScenario.totalBudget * 0.8));
  const budgetDownForecast = await reforecastScenario(budgetDown, storeCount);
  results.push({
    scenario: '-20% Budget',
    expected: budgetDownForecast.expected,
    delta: {
      installs: budgetDownForecast.expected.installs - baseScenario.expected.installs,
      cpa: budgetDownForecast.expected.cpa - baseScenario.expected.cpa,
    },
  });

  // What if we shift 10% to search?
  if (baseScenario.allocations.some(a => a.channel === 'search')) {
    const searchAlloc = baseScenario.allocations.find(a => a.channel === 'search')!;
    const searchBoost = adjustChannelBudget(
      baseScenario,
      'search',
      Math.round(searchAlloc.budget * 1.1)
    );
    const searchBoostForecast = await reforecastScenario(searchBoost, storeCount);
    results.push({
      scenario: '+10% to Search',
      expected: searchBoostForecast.expected,
      delta: {
        installs: searchBoostForecast.expected.installs - baseScenario.expected.installs,
        cpa: searchBoostForecast.expected.cpa - baseScenario.expected.cpa,
      },
    });
  }

  return results;
}
