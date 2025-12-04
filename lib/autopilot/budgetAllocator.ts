// lib/autopilot/budgetAllocator.ts
// Phase 5: AI Media Mix Budget Allocator
//
// Reads projected outcomes vs actuals, reallocates budget toward
// best-performing channels, detects diminishing returns

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { BudgetAllocation } from './types';

// ============================================================================
// Types
// ============================================================================

interface ChannelMetrics {
  channel: string;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AllocationInput {
  companyId: string;
  graph: CompanyContextGraph;
  performanceData?: ChannelMetrics[];
  totalBudget?: number;
  objectives?: {
    primaryMetric: 'roas' | 'cpa' | 'conversions' | 'revenue';
    targetValue?: number;
  };
  constraints?: {
    minChannelSpend?: Record<string, number>;
    maxChannelSpend?: Record<string, number>;
    lockedChannels?: string[];
  };
}

interface DiminishingReturnsResult {
  channel: string;
  currentSpend: number;
  optimalSpend: number;
  marginalRoas: number;
  saturationPoint: number; // 0-1, how close to saturation
  recommendation: 'increase' | 'decrease' | 'maintain';
}

// ============================================================================
// Budget Allocation Engine
// ============================================================================

/**
 * Generate optimal budget allocation
 */
export async function generateBudgetAllocation(
  companyId: string,
  graph: CompanyContextGraph,
  options: {
    performanceData?: ChannelMetrics[];
    totalBudget?: number;
    period?: 'monthly' | 'quarterly';
  } = {}
): Promise<BudgetAllocation> {
  const { period = 'monthly' } = options;
  const now = new Date().toISOString();

  // Get current allocation from graph
  const currentAllocation = extractCurrentAllocation(graph);
  const totalBudget = options.totalBudget ||
    (graph.budgetOps?.totalMarketingBudget?.value as number) ||
    currentAllocation.total;

  // Get performance data
  const performanceData = options.performanceData || extractPerformanceData(graph);

  // Calculate channel scores
  const channelScores = calculateChannelScores(performanceData);

  // Detect diminishing returns
  const diminishingReturns = analyzeDisminishingReturns(performanceData);

  // Generate optimal allocation
  const optimalAllocation = calculateOptimalAllocation(
    channelScores,
    diminishingReturns,
    totalBudget,
    currentAllocation
  );

  // Calculate predictions
  const predictions = predictOutcomes(optimalAllocation, performanceData);

  // Generate rationale
  const rationale = generateAllocationRationale(
    optimalAllocation,
    currentAllocation,
    channelScores,
    diminishingReturns
  );

  // Compare to current
  const vsCurrentAllocation = compareAllocations(currentAllocation, optimalAllocation);

  return {
    companyId,
    period,
    totalBudget,
    channels: optimalAllocation,
    rationale,
    predictions,
    confidence: calculateAllocationConfidence(performanceData),
    vsCurrentAllocation,
    generatedAt: now,
  };
}

// ============================================================================
// Allocation Calculation
// ============================================================================

function extractCurrentAllocation(graph: CompanyContextGraph): {
  total: number;
  search: number;
  social: number;
  display: number;
  video: number;
  lsa: number;
  audio: number;
  ooh: number;
  affiliate: number;
  email: number;
  other: number;
} {
  const allocation = {
    total: 0,
    search: 0,
    social: 0,
    display: 0,
    video: 0,
    lsa: 0,
    audio: 0,
    ooh: 0,
    affiliate: 0,
    email: 0,
    other: 0,
  };

  // Try to get from budget allocation
  const currentAlloc = graph.budgetOps?.currentAllocation?.value as Array<{
    channel: string;
    amount: number;
  }> | undefined;

  if (currentAlloc) {
    for (const item of currentAlloc) {
      const channel = mapChannelToCategory(item.channel);
      if (channel in allocation) {
        (allocation as Record<string, number>)[channel] += item.amount;
      }
      allocation.total += item.amount;
    }
  }

  // Fallback to total marketing budget
  if (allocation.total === 0) {
    allocation.total = (graph.budgetOps?.totalMarketingBudget?.value as number) || 10000;
    // Default split if no data
    allocation.search = allocation.total * 0.4;
    allocation.social = allocation.total * 0.3;
    allocation.display = allocation.total * 0.15;
    allocation.video = allocation.total * 0.1;
    allocation.other = allocation.total * 0.05;
  }

  return allocation;
}

function mapChannelToCategory(channel: string): string {
  const lowerChannel = channel.toLowerCase();

  if (lowerChannel.includes('google') || lowerChannel.includes('search') || lowerChannel.includes('bing')) {
    return 'search';
  }
  if (lowerChannel.includes('meta') || lowerChannel.includes('facebook') || lowerChannel.includes('instagram') ||
      lowerChannel.includes('tiktok') || lowerChannel.includes('linkedin') || lowerChannel.includes('twitter')) {
    return 'social';
  }
  if (lowerChannel.includes('display') || lowerChannel.includes('programmatic') || lowerChannel.includes('gdn')) {
    return 'display';
  }
  if (lowerChannel.includes('youtube') || lowerChannel.includes('video') || lowerChannel.includes('ctv')) {
    return 'video';
  }
  if (lowerChannel.includes('lsa') || lowerChannel.includes('local')) {
    return 'lsa';
  }
  if (lowerChannel.includes('audio') || lowerChannel.includes('spotify') || lowerChannel.includes('podcast')) {
    return 'audio';
  }
  if (lowerChannel.includes('ooh') || lowerChannel.includes('outdoor') || lowerChannel.includes('billboard')) {
    return 'ooh';
  }
  if (lowerChannel.includes('affiliate') || lowerChannel.includes('partner')) {
    return 'affiliate';
  }
  if (lowerChannel.includes('email')) {
    return 'email';
  }

  return 'other';
}

function extractPerformanceData(graph: CompanyContextGraph): ChannelMetrics[] {
  const channelPerf = graph.performanceMedia?.channelPerformance?.value as Array<{
    channel: string;
    monthlySpend?: number;
    conversions?: number;
    roas?: number;
    cpa?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
  }> | undefined;

  if (!channelPerf) {
    return [];
  }

  return channelPerf.map(cp => ({
    channel: cp.channel,
    spend: cp.monthlySpend || 0,
    conversions: cp.conversions || 0,
    revenue: (cp.monthlySpend || 0) * (cp.roas || 0),
    roas: cp.roas || 0,
    cpa: cp.cpa || 0,
    impressions: cp.impressions || 0,
    clicks: cp.clicks || 0,
    ctr: cp.ctr || 0,
  }));
}

function calculateChannelScores(performanceData: ChannelMetrics[]): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const channel of performanceData) {
    // Score based on ROAS (40%), CPA efficiency (30%), volume (20%), CTR (10%)
    const roasScore = Math.min(channel.roas / 5, 1) * 40; // Normalize to max 5x ROAS
    const cpaScore = channel.cpa > 0 ? Math.max(0, (1 - channel.cpa / 200)) * 30 : 15; // Lower CPA = higher score
    const volumeScore = Math.min(channel.conversions / 100, 1) * 20; // Volume contribution
    const ctrScore = Math.min(channel.ctr / 5, 1) * 10; // CTR contribution

    const category = mapChannelToCategory(channel.channel);
    const totalScore = roasScore + cpaScore + volumeScore + ctrScore;

    if (!scores[category] || totalScore > scores[category]) {
      scores[category] = totalScore;
    }
  }

  return scores;
}

function analyzeDisminishingReturns(performanceData: ChannelMetrics[]): DiminishingReturnsResult[] {
  return performanceData.map(channel => {
    // Simplified diminishing returns model
    // In production, this would use historical data and ML models
    const category = mapChannelToCategory(channel.channel);

    // Estimate saturation based on efficiency metrics
    const efficiencyRatio = channel.roas > 0 ? channel.roas : 1;
    const saturationPoint = Math.min(0.9, Math.max(0.1, 1 - (1 / efficiencyRatio)));

    // Estimate optimal spend adjustment
    let optimalSpend = channel.spend;
    let recommendation: 'increase' | 'decrease' | 'maintain' = 'maintain';

    if (saturationPoint < 0.5 && channel.roas > 2) {
      optimalSpend = channel.spend * 1.25;
      recommendation = 'increase';
    } else if (saturationPoint > 0.7 || channel.roas < 1) {
      optimalSpend = channel.spend * 0.8;
      recommendation = 'decrease';
    }

    return {
      channel: category,
      currentSpend: channel.spend,
      optimalSpend,
      marginalRoas: channel.roas * (1 - saturationPoint),
      saturationPoint,
      recommendation,
    };
  });
}

function calculateOptimalAllocation(
  channelScores: Record<string, number>,
  diminishingReturns: DiminishingReturnsResult[],
  totalBudget: number,
  currentAllocation: Record<string, number>
): BudgetAllocation['channels'] {
  // Start with score-based allocation
  const totalScore = Object.values(channelScores).reduce((a, b) => a + b, 0) || 1;

  const allocation: BudgetAllocation['channels'] = {
    search: 0,
    social: 0,
    display: 0,
    video: 0,
    lsa: 0,
    audio: 0,
    ooh: 0,
    affiliate: 0,
    email: 0,
    other: 0,
  };

  // Allocate based on scores
  for (const [channel, score] of Object.entries(channelScores)) {
    if (channel in allocation) {
      (allocation as Record<string, number>)[channel] = (score / totalScore) * totalBudget;
    }
  }

  // Adjust for diminishing returns
  for (const dr of diminishingReturns) {
    if (dr.channel in allocation) {
      const currentValue = (allocation as Record<string, number>)[dr.channel];
      if (dr.recommendation === 'increase') {
        (allocation as Record<string, number>)[dr.channel] = currentValue * 1.15;
      } else if (dr.recommendation === 'decrease') {
        (allocation as Record<string, number>)[dr.channel] = currentValue * 0.85;
      }
    }
  }

  // Normalize to total budget
  const allocatedTotal = Object.values(allocation).reduce((a, b) => a + b, 0);
  if (allocatedTotal > 0) {
    const ratio = totalBudget / allocatedTotal;
    for (const key of Object.keys(allocation)) {
      (allocation as Record<string, number>)[key] *= ratio;
    }
  }

  // Round values
  for (const key of Object.keys(allocation)) {
    (allocation as Record<string, number>)[key] = Math.round((allocation as Record<string, number>)[key]);
  }

  return allocation;
}

function predictOutcomes(
  allocation: BudgetAllocation['channels'],
  performanceData: ChannelMetrics[]
): BudgetAllocation['predictions'] {
  // Build efficiency map from performance data
  const efficiencyMap: Record<string, { roas: number; cpa: number }> = {};

  for (const channel of performanceData) {
    const category = mapChannelToCategory(channel.channel);
    if (!efficiencyMap[category] || channel.spend > 0) {
      efficiencyMap[category] = {
        roas: channel.roas || 1,
        cpa: channel.cpa || 100,
      };
    }
  }

  // Calculate predictions
  let totalConversions = 0;
  let totalRevenue = 0;
  let totalSpend = 0;

  for (const [channel, spend] of Object.entries(allocation)) {
    if (spend > 0) {
      const efficiency = efficiencyMap[channel] || { roas: 1, cpa: 100 };
      totalSpend += spend;
      totalRevenue += spend * efficiency.roas;
      totalConversions += efficiency.cpa > 0 ? spend / efficiency.cpa : 0;
    }
  }

  return {
    expectedConversions: Math.round(totalConversions),
    expectedRevenue: Math.round(totalRevenue),
    expectedRoas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
    expectedCpa: totalConversions > 0 ? Math.round(totalSpend / totalConversions) : 0,
  };
}

function generateAllocationRationale(
  optimal: BudgetAllocation['channels'],
  current: Record<string, number>,
  scores: Record<string, number>,
  diminishingReturns: DiminishingReturnsResult[]
): Record<string, string> {
  const rationale: Record<string, string> = {};

  for (const [channel, amount] of Object.entries(optimal)) {
    const currentAmount = (current as Record<string, number>)[channel] || 0;
    const score = scores[channel] || 0;
    const dr = diminishingReturns.find(d => d.channel === channel);

    if (amount > currentAmount * 1.1) {
      rationale[channel] = `Increasing by ${Math.round((amount / currentAmount - 1) * 100)}% - strong performance score (${score.toFixed(0)})`;
      if (dr?.recommendation === 'increase') {
        rationale[channel] += ', room for growth before diminishing returns';
      }
    } else if (amount < currentAmount * 0.9) {
      rationale[channel] = `Decreasing by ${Math.round((1 - amount / currentAmount) * 100)}%`;
      if (dr?.recommendation === 'decrease') {
        rationale[channel] += ' - approaching diminishing returns';
      } else {
        rationale[channel] += ' - reallocating to higher-performing channels';
      }
    } else if (amount > 0) {
      rationale[channel] = 'Maintaining current allocation - stable performance';
    }
  }

  return rationale;
}

function compareAllocations(
  current: Record<string, number>,
  proposed: BudgetAllocation['channels']
): Record<string, { current: number; proposed: number; delta: number; reason: string }> {
  const comparison: Record<string, { current: number; proposed: number; delta: number; reason: string }> = {};

  for (const channel of Object.keys(proposed)) {
    const currentVal = (current as Record<string, number>)[channel] || 0;
    const proposedVal = (proposed as Record<string, number>)[channel] || 0;
    const delta = proposedVal - currentVal;

    if (Math.abs(delta) > 100) { // Only include significant changes
      comparison[channel] = {
        current: currentVal,
        proposed: proposedVal,
        delta,
        reason: delta > 0 ? 'Performance warrants increase' : 'Reallocating to better performers',
      };
    }
  }

  return comparison;
}

function calculateAllocationConfidence(performanceData: ChannelMetrics[]): number {
  if (performanceData.length === 0) return 0.3;

  // Confidence based on data quality
  let confidence = 0.5;

  // More channels = more confidence
  confidence += Math.min(performanceData.length * 0.05, 0.2);

  // More spend data = more confidence
  const totalSpend = performanceData.reduce((a, b) => a + b.spend, 0);
  if (totalSpend > 10000) confidence += 0.15;
  if (totalSpend > 50000) confidence += 0.1;

  // More conversions = more confidence
  const totalConversions = performanceData.reduce((a, b) => a + b.conversions, 0);
  if (totalConversions > 100) confidence += 0.1;

  return Math.min(0.95, confidence);
}

// ============================================================================
// AI-Enhanced Allocation
// ============================================================================

/**
 * Generate AI-enhanced budget allocation with reasoning
 */
export async function generateAIBudgetAllocation(
  companyId: string,
  graph: CompanyContextGraph
): Promise<BudgetAllocation & { aiReasoning: string }> {
  const client = new Anthropic();

  // Get base allocation
  const baseAllocation = await generateBudgetAllocation(companyId, graph);

  // Enhance with AI reasoning
  const prompt = `You are a media planning expert. Analyze this budget allocation and provide strategic reasoning.

## Company Context
- Industry: ${graph.identity?.industry?.value || 'Unknown'}
- Objectives: ${graph.objectives?.primaryObjective?.value || 'Growth'}
- Current ROAS: ${graph.performanceMedia?.blendedRoas?.value || 'Unknown'}

## Proposed Allocation
${JSON.stringify(baseAllocation.channels, null, 2)}

## Performance vs Current
${JSON.stringify(baseAllocation.vsCurrentAllocation, null, 2)}

Provide a brief (2-3 paragraph) strategic reasoning for this allocation, considering:
1. Channel mix optimization
2. Risk diversification
3. Growth opportunities
4. Potential concerns`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    const aiReasoning = content.type === 'text' ? content.text : '';

    return {
      ...baseAllocation,
      aiReasoning,
    };
  } catch (error) {
    console.error('[budgetAllocator] AI reasoning error:', error);
    return {
      ...baseAllocation,
      aiReasoning: 'AI reasoning unavailable',
    };
  }
}

// ============================================================================
// Seasonal Adjustments
// ============================================================================

/**
 * Apply seasonal adjustments to budget allocation
 */
export function applySeasonalAdjustments(
  allocation: BudgetAllocation,
  seasonalFactors: Record<string, number>
): BudgetAllocation {
  const adjusted = { ...allocation };
  const adjustedChannels = { ...allocation.channels };

  for (const [channel, factor] of Object.entries(seasonalFactors)) {
    if (channel in adjustedChannels) {
      (adjustedChannels as Record<string, number>)[channel] *= factor;
    }
  }

  // Normalize to maintain total budget
  const total = Object.values(adjustedChannels).reduce((a, b) => a + b, 0);
  const ratio = allocation.totalBudget / total;

  for (const key of Object.keys(adjustedChannels)) {
    (adjustedChannels as Record<string, number>)[key] = Math.round(
      (adjustedChannels as Record<string, number>)[key] * ratio
    );
  }

  return {
    ...adjusted,
    channels: adjustedChannels,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { ChannelMetrics, AllocationInput, DiminishingReturnsResult };
