// lib/autopilot/hypothesisEngine.ts
// Phase 5: Hypothesis Generation Engine
//
// Generates strategic hypotheses from context graph, performance data,
// benchmarks, seasonality, and competitive signals

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  Hypothesis,
  HypothesisCategory,
  ExperimentPlan,
  ExperimentType,
} from './types';

// ============================================================================
// Hypothesis Generation
// ============================================================================

interface HypothesisGenerationInput {
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  performanceData?: PerformanceSnapshot;
  benchmarks?: BenchmarkData;
  seasonality?: SeasonalityData;
  competitiveSignals?: CompetitiveSignal[];
}

interface PerformanceSnapshot {
  period: string;
  channels: Record<string, ChannelPerformance>;
  overall: {
    spend: number;
    conversions: number;
    revenue: number;
    roas: number;
    cpa: number;
  };
  trends: {
    metric: string;
    direction: 'up' | 'down' | 'flat';
    change: number;
  }[];
}

interface ChannelPerformance {
  spend: number;
  conversions: number;
  cpa: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface BenchmarkData {
  industry: string;
  metrics: Record<string, { value: number; percentile: number }>;
}

interface SeasonalityData {
  currentSeason: string;
  upcomingEvents: string[];
  historicalPatterns: { period: string; indexVsAverage: number }[];
}

interface CompetitiveSignal {
  competitor: string;
  signal: string;
  implication: string;
}

/**
 * Generate hypotheses for strategic improvements
 */
export async function generateHypotheses(
  input: HypothesisGenerationInput,
  options: {
    maxHypotheses?: number;
    focusDomains?: string[];
    minConfidence?: number;
  } = {}
): Promise<Hypothesis[]> {
  const { maxHypotheses = 10, focusDomains, minConfidence = 0.4 } = options;

  // First, generate rule-based hypotheses
  const ruleBasedHypotheses = generateRuleBasedHypotheses(input);

  // Then, generate AI-powered hypotheses
  const aiHypotheses = await generateAIHypotheses(input, maxHypotheses);

  // Combine and deduplicate
  const allHypotheses = [...ruleBasedHypotheses, ...aiHypotheses];

  // Filter by focus domains if specified
  let filtered = focusDomains
    ? allHypotheses.filter(h => focusDomains.includes(h.domain))
    : allHypotheses;

  // Filter by minimum confidence
  filtered = filtered.filter(h => h.confidence >= minConfidence);

  // Score and rank hypotheses
  const scored = filtered.map(h => ({
    ...h,
    score: calculateHypothesisScore(h, input),
  }));

  // Sort by score and limit
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxHypotheses);
}

// ============================================================================
// Rule-Based Hypothesis Generation
// ============================================================================

function generateRuleBasedHypotheses(input: HypothesisGenerationInput): Hypothesis[] {
  const hypotheses: Hypothesis[] = [];
  const { companyId, graph, performanceData, benchmarks } = input;
  const now = new Date().toISOString();

  // Rule 1: Budget reallocation from underperforming channels
  if (performanceData?.channels) {
    const channels = Object.entries(performanceData.channels);
    const avgRoas = performanceData.overall.roas;

    for (const [channel, perf] of channels) {
      // Underperforming channel
      if (perf.roas < avgRoas * 0.7 && perf.spend > 1000) {
        hypotheses.push({
          id: `hyp_${randomUUID()}`,
          companyId,
          hypothesis: `Reduce ${channel} spend by 20% and reallocate to higher-performing channels`,
          domain: 'media',
          category: 'budget_reallocation',
          requiredData: ['performanceMedia.channelPerformance', 'budgetOps.currentAllocation'],
          missingData: [],
          dataCompleteness: 0.9,
          expectedImpact: 0.15,
          confidence: 0.7,
          reasoning: `${channel} ROAS (${perf.roas.toFixed(2)}) is ${((1 - perf.roas / avgRoas) * 100).toFixed(0)}% below average`,
          supportingEvidence: [`Current ${channel} ROAS: ${perf.roas.toFixed(2)}`, `Average ROAS: ${avgRoas.toFixed(2)}`],
          risks: ['May reduce reach in specific segments', 'Seasonal factors may be temporary'],
          status: 'pending',
          generatedAt: now,
        });
      }

      // Outperforming channel with room to grow
      if (perf.roas > avgRoas * 1.3 && perf.spend < 10000) {
        hypotheses.push({
          id: `hyp_${randomUUID()}`,
          companyId,
          hypothesis: `Increase ${channel} spend by 25% to capitalize on strong performance`,
          domain: 'media',
          category: 'channel_expansion',
          requiredData: ['performanceMedia.channelPerformance', 'budgetOps.totalMarketingBudget'],
          missingData: [],
          dataCompleteness: 0.9,
          expectedImpact: 0.2,
          confidence: 0.75,
          reasoning: `${channel} ROAS (${perf.roas.toFixed(2)}) is ${((perf.roas / avgRoas - 1) * 100).toFixed(0)}% above average`,
          supportingEvidence: [`Current ${channel} ROAS: ${perf.roas.toFixed(2)}`, `Room for spend increase before diminishing returns`],
          risks: ['Diminishing returns at higher spend levels', 'Audience saturation'],
          status: 'pending',
          generatedAt: now,
        });
      }
    }
  }

  // Rule 2: Creative refresh based on performance
  const creativeWearout = graph.performanceMedia?.creativeWearout?.value;
  if (creativeWearout && typeof creativeWearout === 'string' && creativeWearout.toLowerCase().includes('high')) {
    hypotheses.push({
      id: `hyp_${randomUUID()}`,
      companyId,
      hypothesis: 'Refresh creative assets to combat fatigue and improve CTR',
      domain: 'creative',
      category: 'creative_refresh',
      requiredData: ['performanceMedia.creativeWearout', 'creative.creativeAngles'],
      missingData: [],
      dataCompleteness: 0.85,
      expectedImpact: 0.25,
      confidence: 0.8,
      reasoning: 'High creative wearout detected - audience is fatigued with current assets',
      supportingEvidence: ['Creative wearout status: high', 'CTR declining trends'],
      risks: ['New creative may underperform initially', 'Production costs'],
      status: 'pending',
      generatedAt: now,
    });
  }

  // Rule 3: Audience expansion based on benchmark comparison
  if (benchmarks?.metrics.audience_penetration) {
    const penetration = benchmarks.metrics.audience_penetration;
    if (penetration.percentile < 50) {
      hypotheses.push({
        id: `hyp_${randomUUID()}`,
        companyId,
        hypothesis: 'Expand audience targeting to increase market penetration',
        domain: 'audience',
        category: 'audience_refinement',
        requiredData: ['audience.coreSegments', 'audience.demographis'],
        missingData: [],
        dataCompleteness: 0.8,
        expectedImpact: 0.2,
        confidence: 0.65,
        reasoning: `Audience penetration at ${penetration.percentile}th percentile vs industry`,
        supportingEvidence: [`Industry benchmark: ${penetration.value}`, `Current penetration below median`],
        risks: ['May dilute conversion rates', 'Higher CPAs in new audiences'],
        status: 'pending',
        generatedAt: now,
      });
    }
  }

  // Rule 4: Geo optimization
  const primaryMarkets = graph.audience?.primaryMarkets?.value as string[] | undefined;
  const excludedGeos = graph.audience?.excludedGeos?.value as string[] | undefined;
  if (primaryMarkets && primaryMarkets.length > 0 && (!excludedGeos || excludedGeos.length === 0)) {
    hypotheses.push({
      id: `hyp_${randomUUID()}`,
      companyId,
      hypothesis: 'Implement geo-based bid adjustments to optimize spend by location',
      domain: 'media',
      category: 'geo_targeting',
      requiredData: ['audience.primaryMarkets', 'performanceMedia.channelPerformance'],
      missingData: [],
      dataCompleteness: 0.75,
      expectedImpact: 0.15,
      confidence: 0.7,
      reasoning: 'No geo exclusions set - likely opportunity to reduce waste in low-performing areas',
      supportingEvidence: [`${primaryMarkets.length} primary markets defined`, 'No geo exclusions currently active'],
      risks: ['May reduce reach', 'Data lag in geo performance'],
      status: 'pending',
      generatedAt: now,
    });
  }

  // Rule 5: Brand alignment check
  const positioning = graph.brand?.positioning?.value;
  const differentiators = graph.brand?.differentiators?.value as string[] | undefined;
  if (positioning && (!differentiators || differentiators.length === 0)) {
    hypotheses.push({
      id: `hyp_${randomUUID()}`,
      companyId,
      hypothesis: 'Define brand differentiators to strengthen messaging and creative',
      domain: 'brand',
      category: 'brand_alignment',
      requiredData: ['brand.positioning', 'brand.differentiators'],
      missingData: ['brand.differentiators'],
      dataCompleteness: 0.5,
      expectedImpact: 0.3,
      confidence: 0.6,
      reasoning: 'Brand positioning exists but differentiators are not defined',
      supportingEvidence: ['Positioning defined', 'Differentiators missing'],
      risks: ['Requires brand workshop', 'May require creative overhaul'],
      status: 'pending',
      generatedAt: now,
    });
  }

  return hypotheses;
}

// ============================================================================
// AI-Powered Hypothesis Generation
// ============================================================================

async function generateAIHypotheses(
  input: HypothesisGenerationInput,
  maxHypotheses: number
): Promise<Hypothesis[]> {
  const client = new Anthropic();
  const { companyId, companyName, graph, performanceData, benchmarks, seasonality, competitiveSignals } = input;

  const prompt = `You are a senior marketing strategist analyzing a company's performance to generate improvement hypotheses.

## Company: ${companyName}

## Current Context
${JSON.stringify({
  brand: {
    positioning: graph.brand?.positioning?.value,
    differentiators: graph.brand?.differentiators?.value,
    tone: graph.brand?.toneOfVoice?.value,
  },
  audience: {
    segments: graph.audience?.coreSegments?.value,
    demographics: graph.audience?.demographics?.value,
    markets: graph.audience?.primaryMarkets?.value,
  },
  objectives: {
    primary: graph.objectives?.primaryObjective?.value,
    kpiLabels: graph.objectives?.kpiLabels?.value,
  },
  media: {
    channels: graph.performanceMedia?.activeChannels?.value,
    spend: graph.performanceMedia?.totalMonthlySpend?.value,
    roas: graph.performanceMedia?.blendedRoas?.value,
  },
}, null, 2)}

## Performance Data
${performanceData ? JSON.stringify(performanceData, null, 2) : 'Not available'}

## Benchmarks
${benchmarks ? JSON.stringify(benchmarks, null, 2) : 'Not available'}

## Seasonality
${seasonality ? JSON.stringify(seasonality, null, 2) : 'Not available'}

## Competitive Signals
${competitiveSignals ? JSON.stringify(competitiveSignals, null, 2) : 'Not available'}

Generate ${maxHypotheses} strategic hypotheses for improving performance. Each hypothesis should be:
1. Specific and actionable
2. Based on the data provided
3. Have clear expected impact

Return JSON array:
[
  {
    "hypothesis": "Clear hypothesis statement",
    "domain": "media|creative|audience|seo|content|brand",
    "category": "budget_reallocation|channel_expansion|channel_reduction|creative_refresh|audience_refinement|geo_targeting|seasonal_adjustment|competitive_response|performance_optimization|brand_alignment|funnel_optimization",
    "expectedImpact": 0.0-1.0,
    "confidence": 0.0-1.0,
    "reasoning": "Why this hypothesis makes sense",
    "supportingEvidence": ["evidence1", "evidence2"],
    "risks": ["risk1", "risk2"],
    "requiredData": ["field.path1", "field.path2"]
  }
]`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return [];
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      hypothesis: string;
      domain: string;
      category: string;
      expectedImpact: number;
      confidence: number;
      reasoning: string;
      supportingEvidence: string[];
      risks: string[];
      requiredData: string[];
    }>;

    const now = new Date().toISOString();

    return parsed.map(h => ({
      id: `hyp_${randomUUID()}`,
      companyId,
      hypothesis: h.hypothesis,
      domain: h.domain as Hypothesis['domain'],
      category: h.category as HypothesisCategory,
      requiredData: h.requiredData || [],
      missingData: [], // Will be filled by data completeness check
      dataCompleteness: 0.8, // Default, should be calculated
      expectedImpact: Math.max(0, Math.min(1, h.expectedImpact || 0.5)),
      confidence: Math.max(0, Math.min(1, h.confidence || 0.5)),
      reasoning: h.reasoning,
      supportingEvidence: h.supportingEvidence || [],
      risks: h.risks || [],
      status: 'pending' as const,
      generatedAt: now,
    }));
  } catch (error) {
    console.error('[hypothesisEngine] AI generation error:', error);
    return [];
  }
}

// ============================================================================
// Hypothesis Scoring
// ============================================================================

function calculateHypothesisScore(
  hypothesis: Hypothesis,
  input: HypothesisGenerationInput
): number {
  let score = 0;

  // Impact weight: 40%
  score += hypothesis.expectedImpact * 40;

  // Confidence weight: 30%
  score += hypothesis.confidence * 30;

  // Data completeness weight: 20%
  score += hypothesis.dataCompleteness * 20;

  // Risk penalty: -10% for high risk count
  const riskPenalty = Math.min(hypothesis.risks.length * 2, 10);
  score -= riskPenalty;

  // Bonus for alignment with objectives
  const primaryObjective = input.graph.objectives?.primaryObjective?.value as string | undefined;
  if (primaryObjective) {
    if (hypothesis.hypothesis.toLowerCase().includes(primaryObjective.toLowerCase())) {
      score += 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Experiment Plan Generation
// ============================================================================

/**
 * Convert a hypothesis into an experiment plan
 */
export function createExperimentPlan(
  hypothesis: Hypothesis,
  options: {
    duration?: number;
    budgetPercent?: number;
  } = {}
): ExperimentPlan {
  const { duration = 14, budgetPercent = 10 } = options;
  const now = new Date().toISOString();

  // Determine experiment type based on hypothesis category
  const typeMap: Record<HypothesisCategory, ExperimentType> = {
    budget_reallocation: 'budget_test',
    channel_expansion: 'channel_test',
    channel_reduction: 'channel_test',
    creative_refresh: 'creative_test',
    audience_refinement: 'audience_test',
    geo_targeting: 'geo_test',
    seasonal_adjustment: 'budget_test',
    competitive_response: 'creative_test',
    performance_optimization: 'bidding_test',
    brand_alignment: 'creative_test',
    funnel_optimization: 'landing_page_test',
  };

  const experimentType = typeMap[hypothesis.category] || 'budget_test';

  // Generate appropriate metrics
  const metricsMap: Record<ExperimentType, { primary: string; secondary: string[] }> = {
    budget_test: { primary: 'roas', secondary: ['cpa', 'conversions', 'revenue'] },
    channel_test: { primary: 'conversions', secondary: ['cpa', 'roas', 'ctr'] },
    creative_test: { primary: 'ctr', secondary: ['conversion_rate', 'engagement', 'cpa'] },
    audience_test: { primary: 'conversion_rate', secondary: ['cpa', 'reach', 'frequency'] },
    geo_test: { primary: 'cpa', secondary: ['conversions', 'roas', 'impression_share'] },
    bidding_test: { primary: 'cpa', secondary: ['conversions', 'impression_share', 'position'] },
    landing_page_test: { primary: 'conversion_rate', secondary: ['bounce_rate', 'time_on_page', 'cpa'] },
  };

  const metrics = metricsMap[experimentType];

  return {
    id: `exp_${randomUUID()}`,
    companyId: hypothesis.companyId,
    name: `Test: ${hypothesis.hypothesis.slice(0, 50)}...`,
    hypothesisId: hypothesis.id,
    type: experimentType,
    description: hypothesis.hypothesis,
    channels: [],
    expectedLift: hypothesis.expectedImpact * 100,
    minDetectableEffect: 5,
    statisticalPower: 0.8,
    duration,
    metrics: {
      primary: metrics.primary,
      secondary: metrics.secondary,
      guardrails: ['spend', 'cpa_cap'],
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Hypothesis Validation
// ============================================================================

/**
 * Validate a hypothesis against actual results
 */
export function validateHypothesis(
  hypothesis: Hypothesis,
  actualResults: {
    metric: string;
    baseline: number;
    actual: number;
    lift: number;
  }
): Hypothesis {
  const expectedLift = hypothesis.expectedImpact * 100;
  const actualLift = actualResults.lift;
  const variance = Math.abs(actualLift - expectedLift) / expectedLift;

  const validated = actualLift > 0 && variance < 0.5; // Within 50% of expected

  return {
    ...hypothesis,
    status: validated ? 'validated' : 'invalidated',
    validatedAt: new Date().toISOString(),
    validationResult: {
      validated,
      actualImpact: actualLift / 100,
      expectedImpact: hypothesis.expectedImpact,
      variance,
      learnings: [
        validated
          ? `Hypothesis validated with ${actualLift.toFixed(1)}% lift`
          : `Hypothesis invalidated - actual lift was ${actualLift.toFixed(1)}% vs expected ${expectedLift.toFixed(1)}%`,
      ],
      shouldContinue: validated && actualLift > 5,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  type HypothesisGenerationInput,
  type PerformanceSnapshot,
  type ChannelPerformance,
  type BenchmarkData,
  type SeasonalityData,
  type CompetitiveSignal,
};
