// lib/evolution/insightGenerator.ts
// Phase 6: Insight Generator
//
// Generates actionable insights from patterns, benchmarks, and cross-company analysis

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  CrossCompanyInsight,
  InsightType,
  Pattern,
  IndustryBenchmark,
  PatternRecommendation,
} from './types';
import { getPatterns } from './patternDiscovery';
import { getBenchmark, compareCompanyToBenchmarks } from './benchmarkEngine';

// ============================================================================
// AI Client
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// In-Memory Store
// ============================================================================

const insights = new Map<string, CrossCompanyInsight>();
const recommendations = new Map<string, PatternRecommendation[]>();

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Generate insights from cross-company analysis
 */
export async function generateInsights(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: {
      cpa: number;
      roas: number;
      ctr: number;
      conversions: number;
    };
  }>,
  options: {
    types?: InsightType[];
    minConfidence?: number;
    useAI?: boolean;
  } = {}
): Promise<CrossCompanyInsight[]> {
  const {
    types = ['performance_trend', 'channel_opportunity', 'efficiency_opportunity'],
    minConfidence = 0.7,
    useAI = true,
  } = options;

  const generatedInsights: CrossCompanyInsight[] = [];

  // Performance trend insights
  if (types.includes('performance_trend')) {
    generatedInsights.push(...detectPerformanceTrends(companyData, minConfidence));
  }

  // Channel opportunity insights
  if (types.includes('channel_opportunity')) {
    generatedInsights.push(...detectChannelOpportunities(companyData, minConfidence));
  }

  // Efficiency opportunity insights
  if (types.includes('efficiency_opportunity')) {
    generatedInsights.push(...detectEfficiencyOpportunities(companyData, minConfidence));
  }

  // Risk warnings
  if (types.includes('risk_warning')) {
    generatedInsights.push(...detectRiskWarnings(companyData, minConfidence));
  }

  // Use AI to enhance insights
  if (useAI && generatedInsights.length > 0) {
    const enhanced = await enhanceInsightsWithAI(generatedInsights);
    generatedInsights.length = 0;
    generatedInsights.push(...enhanced);
  }

  // Store insights
  for (const insight of generatedInsights) {
    insights.set(insight.id, insight);
  }

  return generatedInsights;
}

// ============================================================================
// Trend Detection
// ============================================================================

function detectPerformanceTrends(
  companyData: Array<{
    companyId: string;
    performance: { cpa: number; roas: number; ctr: number };
  }>,
  minConfidence: number
): CrossCompanyInsight[] {
  const insights: CrossCompanyInsight[] = [];

  // Calculate averages
  const avgCPA = calculateAverage(companyData.map(c => c.performance.cpa));
  const avgROAS = calculateAverage(companyData.map(c => c.performance.roas));
  const avgCTR = calculateAverage(companyData.map(c => c.performance.ctr));

  // Detect high CPA trend
  const highCPACompanies = companyData.filter(c => c.performance.cpa > avgCPA * 1.3);
  if (highCPACompanies.length >= companyData.length * 0.3) {
    insights.push({
      id: `insight_cpa_trend_${Date.now()}`,
      type: 'performance_trend',
      title: 'Rising CPA Trend Detected',
      description: `${highCPACompanies.length} companies (${((highCPACompanies.length / companyData.length) * 100).toFixed(0)}%) showing elevated CPA`,
      finding: 'CPA is trending above average across a significant portion of companies',
      evidence: [
        {
          companyCount: highCPACompanies.length,
          timeRange: 'Current period',
          metric: 'CPA',
          observation: `Average CPA is $${avgCPA.toFixed(2)}, ${highCPACompanies.length} companies above threshold`,
          statisticalMethod: 'Threshold analysis',
        },
      ],
      actionable: true,
      suggestedAction: 'Review audience targeting and bid strategies across campaigns',
      expectedImpact: 0.15,
      applicableTo: {
        companyStages: ['growth', 'mature'],
      },
      confidence: minConfidence,
      sampleSize: companyData.length,
      discoveredAt: new Date().toISOString(),
      status: 'new',
    });
  }

  // Detect CTR improvement opportunity
  const lowCTRCompanies = companyData.filter(c => c.performance.ctr < avgCTR * 0.7);
  if (lowCTRCompanies.length >= 5) {
    insights.push({
      id: `insight_ctr_opportunity_${Date.now()}`,
      type: 'performance_trend',
      title: 'CTR Improvement Opportunity',
      description: `${lowCTRCompanies.length} companies have below-average CTR`,
      finding: 'Companies with low CTR may benefit from creative refresh or ad copy optimization',
      evidence: [
        {
          companyCount: lowCTRCompanies.length,
          timeRange: 'Current period',
          metric: 'CTR',
          observation: `Average CTR is ${(avgCTR * 100).toFixed(2)}%, ${lowCTRCompanies.length} companies below 70% of average`,
          statisticalMethod: 'Threshold analysis',
        },
      ],
      actionable: true,
      suggestedAction: 'Implement creative testing program focusing on headlines and CTAs',
      expectedImpact: 0.2,
      applicableTo: {},
      confidence: minConfidence,
      sampleSize: companyData.length,
      discoveredAt: new Date().toISOString(),
      status: 'new',
    });
  }

  return insights;
}

function detectChannelOpportunities(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: { roas: number };
  }>,
  minConfidence: number
): CrossCompanyInsight[] {
  const insights: CrossCompanyInsight[] = [];

  // Analyze channel adoption vs performance
  const channelPerformance = new Map<string, { companies: number; totalRoas: number }>();

  for (const company of companyData) {
    const channels = company.graph.performanceMedia?.activeChannels?.value as string[] || [];
    for (const channel of channels) {
      const data = channelPerformance.get(channel) || { companies: 0, totalRoas: 0 };
      data.companies++;
      data.totalRoas += company.performance.roas;
      channelPerformance.set(channel, data);
    }
  }

  // Find underutilized high-performing channels
  for (const [channel, data] of channelPerformance) {
    const avgRoas = data.totalRoas / data.companies;
    const adoptionRate = data.companies / companyData.length;

    if (avgRoas > 4 && adoptionRate < 0.3) {
      insights.push({
        id: `insight_channel_${channel}_${Date.now()}`,
        type: 'channel_opportunity',
        title: `Underutilized Channel: ${channel}`,
        description: `${channel} shows strong ROAS (${avgRoas.toFixed(1)}x) but only ${(adoptionRate * 100).toFixed(0)}% adoption`,
        finding: `Companies using ${channel} are seeing above-average returns, suggesting expansion opportunity`,
        evidence: [
          {
            companyCount: data.companies,
            timeRange: 'Current period',
            metric: 'ROAS',
            observation: `Average ROAS for ${channel} users: ${avgRoas.toFixed(1)}x`,
            statisticalMethod: 'Channel performance analysis',
          },
        ],
        actionable: true,
        suggestedAction: `Consider adding ${channel} to media mix`,
        expectedImpact: (avgRoas - 3) * 0.1,
        applicableTo: {},
        confidence: Math.min(0.9, minConfidence + (data.companies * 0.02)),
        sampleSize: data.companies,
        discoveredAt: new Date().toISOString(),
        status: 'new',
      });
    }
  }

  return insights;
}

function detectEfficiencyOpportunities(
  companyData: Array<{
    companyId: string;
    performance: { cpa: number; roas: number; conversions: number };
  }>,
  minConfidence: number
): CrossCompanyInsight[] {
  const insights: CrossCompanyInsight[] = [];

  // Find companies with high spend but low efficiency
  const avgROAS = calculateAverage(companyData.map(c => c.performance.roas));

  // Identify companies with significantly better efficiency
  const topPerformers = companyData.filter(c => c.performance.roas > avgROAS * 1.5);
  const underperformers = companyData.filter(c => c.performance.roas < avgROAS * 0.7);

  if (topPerformers.length >= 3 && underperformers.length >= 3) {
    insights.push({
      id: `insight_efficiency_gap_${Date.now()}`,
      type: 'efficiency_opportunity',
      title: 'Performance Gap Opportunity',
      description: `${topPerformers.length} companies achieving 50%+ higher ROAS than average`,
      finding: 'Significant performance gap exists between top performers and underperformers',
      evidence: [
        {
          companyCount: topPerformers.length + underperformers.length,
          timeRange: 'Current period',
          metric: 'ROAS',
          observation: `Top performers: ${calculateAverage(topPerformers.map(c => c.performance.roas)).toFixed(1)}x vs Underperformers: ${calculateAverage(underperformers.map(c => c.performance.roas)).toFixed(1)}x`,
          statisticalMethod: 'Cohort analysis',
        },
      ],
      actionable: true,
      suggestedAction: 'Analyze top performer strategies for replicable tactics',
      expectedImpact: 0.25,
      applicableTo: {},
      confidence: minConfidence,
      sampleSize: companyData.length,
      discoveredAt: new Date().toISOString(),
      status: 'new',
    });
  }

  return insights;
}

function detectRiskWarnings(
  companyData: Array<{
    companyId: string;
    performance: { cpa: number; roas: number };
  }>,
  minConfidence: number
): CrossCompanyInsight[] {
  const insights: CrossCompanyInsight[] = [];

  // Detect widespread negative ROI
  const negativeROICompanies = companyData.filter(c => c.performance.roas < 1);
  if (negativeROICompanies.length >= companyData.length * 0.2) {
    insights.push({
      id: `insight_roi_warning_${Date.now()}`,
      type: 'risk_warning',
      title: 'Negative ROI Warning',
      description: `${negativeROICompanies.length} companies (${((negativeROICompanies.length / companyData.length) * 100).toFixed(0)}%) showing negative ROI`,
      finding: 'Significant portion of companies operating below break-even',
      evidence: [
        {
          companyCount: negativeROICompanies.length,
          timeRange: 'Current period',
          metric: 'ROAS',
          observation: `${negativeROICompanies.length} companies with ROAS below 1.0`,
          statisticalMethod: 'Threshold analysis',
        },
      ],
      actionable: true,
      suggestedAction: 'Immediate review of campaign efficiency and budget allocation',
      expectedImpact: 0.3,
      applicableTo: {},
      confidence: 0.95,
      sampleSize: companyData.length,
      discoveredAt: new Date().toISOString(),
      status: 'new',
    });
  }

  return insights;
}

// ============================================================================
// Pattern-Based Recommendations
// ============================================================================

/**
 * Generate recommendations for a company based on patterns
 */
export function generatePatternRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  performance: {
    cpa: number;
    roas: number;
    ctr: number;
    conversionRate: number;
  }
): PatternRecommendation[] {
  const companyRecommendations: PatternRecommendation[] = [];
  const patterns = getPatterns({ status: 'validated', minConfidence: 0.7 });

  const industry = graph.identity?.industry?.value as string || '';
  const businessModel = graph.identity?.businessModel?.value as string || '';

  for (const pattern of patterns) {
    // Check pattern applicability
    const matchScore = calculatePatternMatch(pattern, graph, industry, businessModel);

    if (matchScore >= 0.6) {
      const recommendation = createRecommendationFromPattern(
        companyId,
        pattern,
        matchScore,
        graph,
        performance
      );

      if (recommendation) {
        companyRecommendations.push(recommendation);
      }
    }
  }

  // Store recommendations
  recommendations.set(companyId, companyRecommendations);

  return companyRecommendations.sort((a, b) => b.matchScore - a.matchScore);
}

function calculatePatternMatch(
  pattern: Pattern,
  graph: CompanyContextGraph,
  industry: string,
  businessModel: string
): number {
  let matchFactors = 0;
  let totalFactors = 0;

  // Industry match
  if (pattern.applicableIndustries.length > 0) {
    totalFactors++;
    if (pattern.applicableIndustries.includes(industry)) {
      matchFactors++;
    }
  }

  // Business model match
  if (pattern.applicableBusinessModels.length > 0) {
    totalFactors++;
    if (pattern.applicableBusinessModels.includes(businessModel)) {
      matchFactors++;
    }
  }

  // Budget range match
  if (pattern.applicableBudgetRanges.length > 0) {
    totalFactors++;
    const budget = graph.budgetOps?.mediaSpendBudget?.value as number || 0;
    for (const range of pattern.applicableBudgetRanges) {
      if (budget >= range.min && budget <= range.max) {
        matchFactors++;
        break;
      }
    }
  }

  // If no specific applicability defined, consider it broadly applicable
  if (totalFactors === 0) {
    return 0.7; // Default match for broadly applicable patterns
  }

  return matchFactors / totalFactors;
}

function createRecommendationFromPattern(
  companyId: string,
  pattern: Pattern,
  matchScore: number,
  graph: CompanyContextGraph,
  performance: { cpa: number; roas: number; ctr: number; conversionRate: number }
): PatternRecommendation | null {
  // Get current value for the pattern's effect metric
  const currentValue = performance[pattern.effect.metric as keyof typeof performance] || 0;
  const expectedImprovement = pattern.effect.improvement;
  const expectedValue = pattern.effect.direction === 'increase'
    ? currentValue * (1 + expectedImprovement)
    : currentValue * (1 - expectedImprovement);

  // Determine match and mismatch factors
  const matchFactors: string[] = [];
  const mismatchFactors: string[] = [];

  if (pattern.applicableIndustries.length > 0) {
    const patternIndustry = graph.identity?.industry?.value as string;
    if (pattern.applicableIndustries.includes(patternIndustry)) {
      matchFactors.push(`Industry: ${patternIndustry}`);
    } else {
      mismatchFactors.push(`Industry may not be optimal match`);
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    id: `rec_${pattern.id}_${companyId}_${Date.now()}`,
    companyId,
    patternId: pattern.id,
    patternName: pattern.name,
    title: `Apply: ${pattern.name}`,
    description: pattern.description,
    suggestedAction: generateActionFromPattern(pattern),
    expectedImpact: {
      metric: pattern.effect.metric,
      currentValue,
      expectedValue,
      improvement: expectedImprovement * 100,
    },
    confidence: pattern.confidence * matchScore,
    basedOnCompanies: pattern.sampleSize,
    matchScore,
    matchFactors,
    mismatchFactors,
    status: 'pending',
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function generateActionFromPattern(pattern: Pattern): string {
  switch (pattern.type) {
    case 'budget_allocation':
      return 'Adjust budget allocation according to pattern recommendations';
    case 'channel_mix':
      return 'Update channel mix to align with successful patterns';
    case 'creative_strategy':
      return 'Implement creative strategy based on proven approaches';
    case 'audience_targeting':
      return 'Refine audience targeting using validated patterns';
    case 'seasonal_timing':
      return 'Adjust strategy for seasonal patterns';
    case 'bidding_strategy':
      return 'Optimize bidding strategy based on pattern insights';
    default:
      return 'Apply pattern-based optimization';
  }
}

// ============================================================================
// AI Enhancement
// ============================================================================

async function enhanceInsightsWithAI(
  rawInsights: CrossCompanyInsight[]
): Promise<CrossCompanyInsight[]> {
  try {
    const insightSummaries = rawInsights.map(i => ({
      type: i.type,
      title: i.title,
      finding: i.finding,
      suggestedAction: i.suggestedAction,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Enhance these marketing insights with more specific and actionable recommendations:

${JSON.stringify(insightSummaries, null, 2)}

For each insight, provide:
1. A more compelling title (max 10 words)
2. A clearer finding statement (1 sentence)
3. A specific actionable recommendation (1-2 sentences)

Respond in JSON format:
[
  {
    "originalTitle": "...",
    "enhancedTitle": "...",
    "enhancedFinding": "...",
    "enhancedAction": "..."
  }
]`,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const enhancements = JSON.parse(jsonMatch[0]);

        // Apply enhancements
        for (const enhancement of enhancements) {
          const insight = rawInsights.find(i => i.title === enhancement.originalTitle);
          if (insight) {
            insight.title = enhancement.enhancedTitle || insight.title;
            insight.finding = enhancement.enhancedFinding || insight.finding;
            insight.suggestedAction = enhancement.enhancedAction || insight.suggestedAction;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error enhancing insights with AI:', error);
  }

  return rawInsights;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get insights
 */
export function getInsights(options?: {
  type?: InsightType;
  status?: CrossCompanyInsight['status'];
  limit?: number;
}): CrossCompanyInsight[] {
  let results = Array.from(insights.values());

  if (options?.type) {
    results = results.filter(i => i.type === options.type);
  }

  if (options?.status) {
    results = results.filter(i => i.status === options.status);
  }

  results.sort((a, b) => b.confidence - a.confidence);

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get recommendations for a company
 */
export function getRecommendations(companyId: string): PatternRecommendation[] {
  return recommendations.get(companyId) || [];
}

/**
 * Mark recommendation as applied
 */
export function markRecommendationApplied(
  companyId: string,
  recommendationId: string,
  actualImpact?: number
): PatternRecommendation | null {
  const recs = recommendations.get(companyId) || [];
  const recIndex = recs.findIndex(r => r.id === recommendationId);

  if (recIndex === -1) return null;

  recs[recIndex] = {
    ...recs[recIndex],
    status: 'applied',
    appliedAt: new Date().toISOString(),
    actualImpact,
  };

  recommendations.set(companyId, recs);
  return recs[recIndex];
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
