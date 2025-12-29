// lib/evolution/patternDiscovery.ts
// Phase 6: Pattern Discovery Engine
//
// Discovers patterns across companies by analyzing:
// - Successful experiments
// - Performance correlations
// - Strategy-outcome relationships

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { ExperimentPlan, Hypothesis } from '../autopilot/types';
import type {
  Pattern,
  PatternType,
  Learning,
  LearningType,
} from './types';

// ============================================================================
// AI Client
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// In-Memory Stores
// ============================================================================

const patterns = new Map<string, Pattern>();
const learnings = new Map<string, Learning[]>();

// ============================================================================
// Pattern Discovery
// ============================================================================

/**
 * Discover patterns from a collection of company data
 */
export async function discoverPatterns(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    experiments: ExperimentPlan[];
    hypotheses: Hypothesis[];
    performance: {
      cpa: number;
      roas: number;
      conversions: number;
      spend: number;
    };
  }>,
  options: {
    minSampleSize?: number;
    minConfidence?: number;
    patternTypes?: PatternType[];
  } = {}
): Promise<Pattern[]> {
  const {
    minSampleSize = 5,
    minConfidence = 0.7,
    patternTypes = ['budget_allocation', 'channel_mix', 'creative_strategy', 'audience_targeting'],
  } = options;

  const discoveredPatterns: Pattern[] = [];

  // Group companies by attributes for pattern detection
  // Note: these groupings are computed but pattern discovery uses inline grouping
  const _industryGroups = groupByAttribute(companyData, 'industry');
  const _budgetGroups = groupByBudgetRange(companyData);
  const _channelGroups = groupByChannelMix(companyData);

  // Discover budget allocation patterns
  if (patternTypes.includes('budget_allocation')) {
    const budgetPatterns = await discoverBudgetPatterns(companyData, minSampleSize, minConfidence);
    discoveredPatterns.push(...budgetPatterns);
  }

  // Discover channel mix patterns
  if (patternTypes.includes('channel_mix')) {
    // Group by industry with proper types
    const properIndustryGroups = new Map<string, typeof companyData>();
    for (const item of companyData) {
      const industry = item.graph.identity?.industry?.value as string || 'unknown';
      const group = properIndustryGroups.get(industry) || [];
      group.push(item);
      properIndustryGroups.set(industry, group);
    }
    const channelPatterns = await discoverChannelMixPatterns(properIndustryGroups, minSampleSize, minConfidence);
    discoveredPatterns.push(...channelPatterns);
  }

  // Discover creative strategy patterns
  if (patternTypes.includes('creative_strategy')) {
    const creativePatterns = await discoverCreativePatterns(companyData, minSampleSize, minConfidence);
    discoveredPatterns.push(...creativePatterns);
  }

  // Discover audience targeting patterns
  if (patternTypes.includes('audience_targeting')) {
    const audiencePatterns = await discoverAudiencePatterns(companyData, minSampleSize, minConfidence);
    discoveredPatterns.push(...audiencePatterns);
  }

  // Store discovered patterns
  for (const pattern of discoveredPatterns) {
    patterns.set(pattern.id, pattern);
  }

  return discoveredPatterns;
}

// ============================================================================
// Budget Pattern Discovery
// ============================================================================

async function discoverBudgetPatterns(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: { cpa: number; roas: number; conversions: number; spend: number };
  }>,
  minSampleSize: number,
  minConfidence: number
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];

  // Analyze correlation between budget allocation and performance
  const highPerformers = companyData
    .filter(c => c.performance.roas > 3)
    .map(c => ({
      ...c,
      allocation: extractBudgetAllocation(c.graph),
    }));

  if (highPerformers.length < minSampleSize) {
    return patterns;
  }

  // Find common allocation patterns among high performers
  const avgAllocation = calculateAverageAllocation(highPerformers.map(h => h.allocation));

  // Check if pattern is significant
  const lowPerformers = companyData
    .filter(c => c.performance.roas < 2)
    .map(c => ({
      ...c,
      allocation: extractBudgetAllocation(c.graph),
    }));

  if (lowPerformers.length > 0) {
    const lowAvgAllocation = calculateAverageAllocation(lowPerformers.map(l => l.allocation));

    // Find significant differences
    for (const [channel, highPct] of Object.entries(avgAllocation)) {
      const lowPct = lowAvgAllocation[channel] || 0;
      const diff = highPct - lowPct;

      if (Math.abs(diff) > 10) {
        patterns.push({
          id: `pattern_budget_${channel}_${Date.now()}`,
          type: 'budget_allocation',
          name: `${channel} allocation correlation with ROAS`,
          description: `Companies with ${diff > 0 ? 'higher' : 'lower'} ${channel} allocation (${highPct.toFixed(0)}% vs ${lowPct.toFixed(0)}%) tend to have higher ROAS`,
          conditions: [
            {
              field: `budget.${channel}`,
              operator: diff > 0 ? 'greater_than' : 'less_than',
              value: (highPct + lowPct) / 2,
              weight: 1,
            },
          ],
          outcomes: [
            {
              metric: 'roas',
              expectedChange: diff > 0 ? 0.5 : -0.5,
              actualChange: 0,
              confidence: minConfidence,
            },
          ],
          confidence: minConfidence,
          sampleSize: highPerformers.length + lowPerformers.length,
          statisticalSignificance: 0.05,
          effect: {
            metric: 'roas',
            improvement: Math.abs(diff) * 0.02,
            direction: diff > 0 ? 'increase' : 'decrease',
          },
          applicableIndustries: [],
          applicableBusinessModels: [],
          applicableBudgetRanges: [],
          applicableSeasons: [],
          discoveredAt: new Date().toISOString(),
          lastValidatedAt: new Date().toISOString(),
          validationCount: 1,
          successRate: highPerformers.length / (highPerformers.length + lowPerformers.length),
          status: 'emerging',
        });
      }
    }
  }

  return patterns;
}

// ============================================================================
// Channel Mix Pattern Discovery
// ============================================================================

async function discoverChannelMixPatterns(
  industryGroups: Map<string, Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: { cpa: number; roas: number; conversions: number; spend: number };
  }>>,
  minSampleSize: number,
  minConfidence: number
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];

  for (const [industry, companies] of industryGroups) {
    if (companies.length < minSampleSize) continue;

    // Find optimal channel mix for industry
    const topPerformers = companies
      .sort((a, b) => b.performance.roas - a.performance.roas)
      .slice(0, Math.ceil(companies.length * 0.3));

    if (topPerformers.length < 3) continue;

    const channelMixes = topPerformers.map(c => {
      const channels = c.graph.performanceMedia?.activeChannels?.value as string[] || [];
      return new Set(channels);
    });

    // Find common channels
    const commonChannels = findCommonElements(channelMixes);

    if (commonChannels.length > 0) {
      patterns.push({
        id: `pattern_channel_${industry}_${Date.now()}`,
        type: 'channel_mix',
        name: `Optimal channel mix for ${industry}`,
        description: `Top performers in ${industry} commonly use: ${commonChannels.join(', ')}`,
        conditions: [
          {
            field: 'industry',
            operator: 'equals',
            value: industry,
            weight: 1,
          },
        ],
        outcomes: [
          {
            metric: 'roas',
            expectedChange: 0.3,
            actualChange: 0,
            confidence: minConfidence,
          },
        ],
        confidence: minConfidence,
        sampleSize: topPerformers.length,
        statisticalSignificance: 0.1,
        effect: {
          metric: 'roas',
          improvement: 0.3,
          direction: 'increase',
        },
        applicableIndustries: [industry],
        applicableBusinessModels: [],
        applicableBudgetRanges: [],
        applicableSeasons: [],
        discoveredAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        validationCount: 1,
        successRate: 0.8,
        status: 'emerging',
      });
    }
  }

  return patterns;
}

// ============================================================================
// Creative Pattern Discovery
// ============================================================================

async function discoverCreativePatterns(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    experiments: ExperimentPlan[];
    performance: { cpa: number; roas: number; conversions: number; spend: number };
  }>,
  minSampleSize: number,
  minConfidence: number
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];

  // Analyze successful creative experiments
  const creativeExperiments = companyData
    .flatMap(c => c.experiments.filter(e =>
      e.type === 'creative_test' &&
      e.status === 'completed' &&
      e.results?.winner === 'treatment'
    ));

  if (creativeExperiments.length < minSampleSize) {
    return patterns;
  }

  // Group by creative angle
  const angleSuccesses = new Map<string, number>();
  for (const exp of creativeExperiments) {
    const testCell = exp.creativeTestCells?.find(c => c.variant === 'test');
    if (testCell?.creative.angle) {
      const count = angleSuccesses.get(testCell.creative.angle) || 0;
      angleSuccesses.set(testCell.creative.angle, count + 1);
    }
  }

  // Find most successful angles
  const sortedAngles = Array.from(angleSuccesses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  for (const [angle, count] of sortedAngles) {
    if (count >= 3) {
      patterns.push({
        id: `pattern_creative_${angle.replace(/\s+/g, '_')}_${Date.now()}`,
        type: 'creative_strategy',
        name: `${angle} creative angle success`,
        description: `Creative with "${angle}" messaging angle has shown ${count} successful tests`,
        conditions: [
          {
            field: 'creative.angle',
            operator: 'contains',
            value: angle,
            weight: 1,
          },
        ],
        outcomes: [
          {
            metric: 'ctr',
            expectedChange: 0.15,
            actualChange: 0,
            confidence: minConfidence,
          },
        ],
        confidence: Math.min(0.9, minConfidence + (count * 0.05)),
        sampleSize: count,
        statisticalSignificance: 0.1,
        effect: {
          metric: 'ctr',
          improvement: 0.15,
          direction: 'increase',
        },
        applicableIndustries: [],
        applicableBusinessModels: [],
        applicableBudgetRanges: [],
        applicableSeasons: [],
        discoveredAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        validationCount: count,
        successRate: count / creativeExperiments.length,
        status: 'emerging',
      });
    }
  }

  return patterns;
}

// ============================================================================
// Audience Pattern Discovery
// ============================================================================

async function discoverAudiencePatterns(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    experiments: ExperimentPlan[];
    performance: { cpa: number; roas: number; conversions: number; spend: number };
  }>,
  minSampleSize: number,
  minConfidence: number
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];

  // Analyze successful audience experiments
  const audienceExperiments = companyData
    .flatMap(c => c.experiments.filter(e =>
      e.type === 'audience_test' &&
      e.status === 'completed' &&
      e.results
    ));

  if (audienceExperiments.length < minSampleSize) {
    return patterns;
  }

  // Analyze audience expansion success
  const expansionSuccess = audienceExperiments.filter(e =>
    e.results?.winner === 'treatment' && e.targetingChange?.type === 'add'
  );

  if (expansionSuccess.length >= 3) {
    patterns.push({
      id: `pattern_audience_expansion_${Date.now()}`,
      type: 'audience_targeting',
      name: 'Audience expansion success',
      description: `Audience expansion tests show ${((expansionSuccess.length / audienceExperiments.length) * 100).toFixed(0)}% success rate`,
      conditions: [
        {
          field: 'audience.size',
          operator: 'less_than',
          value: 'saturated',
          weight: 1,
        },
      ],
      outcomes: [
        {
          metric: 'conversions',
          expectedChange: 0.2,
          actualChange: 0,
          confidence: minConfidence,
        },
      ],
      confidence: minConfidence,
      sampleSize: audienceExperiments.length,
      statisticalSignificance: 0.1,
      effect: {
        metric: 'conversions',
        improvement: 0.2,
        direction: 'increase',
      },
      applicableIndustries: [],
      applicableBusinessModels: [],
      applicableBudgetRanges: [],
      applicableSeasons: [],
      discoveredAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString(),
      validationCount: expansionSuccess.length,
      successRate: expansionSuccess.length / audienceExperiments.length,
      status: 'emerging',
    });
  }

  return patterns;
}

// ============================================================================
// Learning Capture
// ============================================================================

/**
 * Capture a learning from an experiment or observation
 */
export function captureLearning(
  companyId: string,
  learning: Omit<Learning, 'id' | 'capturedAt' | 'status'>
): Learning {
  const entry: Learning = {
    ...learning,
    id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    capturedAt: new Date().toISOString(),
    status: 'new',
  };

  const companyLearnings = learnings.get(companyId) || [];
  companyLearnings.push(entry);
  learnings.set(companyId, companyLearnings);

  return entry;
}

/**
 * Get learnings for a company
 */
export function getLearnings(
  companyId: string,
  options?: {
    type?: LearningType;
    domain?: string;
    limit?: number;
  }
): Learning[] {
  let results = learnings.get(companyId) || [];

  if (options?.type) {
    results = results.filter(l => l.type === options.type);
  }

  if (options?.domain) {
    results = results.filter(l => l.domain === options.domain);
  }

  if (options?.limit) {
    results = results.slice(-options.limit);
  }

  return results;
}

/**
 * Get all learnings across companies (for pattern discovery)
 */
export function getAllLearnings(): Learning[] {
  const all: Learning[] = [];
  for (const companyLearnings of learnings.values()) {
    all.push(...companyLearnings);
  }
  return all;
}

// ============================================================================
// Pattern Management
// ============================================================================

/**
 * Get all patterns
 */
export function getPatterns(options?: {
  type?: PatternType;
  status?: Pattern['status'];
  minConfidence?: number;
}): Pattern[] {
  let results = Array.from(patterns.values());

  if (options?.type) {
    results = results.filter(p => p.type === options.type);
  }

  if (options?.status) {
    results = results.filter(p => p.status === options.status);
  }

  if (options?.minConfidence !== undefined) {
    const minConf = options.minConfidence;
    results = results.filter(p => p.confidence >= minConf);
  }

  return results;
}

/**
 * Get a specific pattern
 */
export function getPattern(patternId: string): Pattern | null {
  return patterns.get(patternId) || null;
}

/**
 * Update pattern status
 */
export function updatePatternStatus(
  patternId: string,
  status: Pattern['status'],
  validationResult?: { successRate: number; confidence: number }
): Pattern | null {
  const pattern = patterns.get(patternId);
  if (!pattern) return null;

  const updated: Pattern = {
    ...pattern,
    status,
    lastValidatedAt: new Date().toISOString(),
    validationCount: pattern.validationCount + 1,
  };

  if (validationResult) {
    updated.successRate = validationResult.successRate;
    updated.confidence = validationResult.confidence;
  }

  patterns.set(patternId, updated);
  return updated;
}

// ============================================================================
// Helper Functions
// ============================================================================

function groupByAttribute(
  data: Array<{ graph: CompanyContextGraph; [key: string]: unknown }>,
  _attribute: string
): Map<string, Array<{ graph: CompanyContextGraph; [key: string]: unknown }>> {
  const groups = new Map<string, Array<{ graph: CompanyContextGraph; [key: string]: unknown }>>();

  for (const item of data) {
    const value = item.graph.identity?.industry?.value as string || 'unknown';
    const group = groups.get(value) || [];
    group.push(item);
    groups.set(value, group);
  }

  return groups;
}

function groupByBudgetRange(
  data: Array<{ graph: CompanyContextGraph; performance: { spend: number } }>
): Map<string, typeof data> {
  const groups = new Map<string, typeof data>();

  for (const item of data) {
    const spend = item.performance.spend;
    let range = '200k+';
    if (spend < 10000) range = '0-10k';
    else if (spend < 50000) range = '10k-50k';
    else if (spend < 200000) range = '50k-200k';

    const group = groups.get(range) || [];
    group.push(item);
    groups.set(range, group);
  }

  return groups;
}

function groupByChannelMix(
  data: Array<{ graph: CompanyContextGraph; [key: string]: unknown }>
): Map<string, typeof data> {
  const groups = new Map<string, typeof data>();

  for (const item of data) {
    const channels = item.graph.performanceMedia?.activeChannels?.value as string[] || [];
    const key = channels.sort().join(',');
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function extractBudgetAllocation(graph: CompanyContextGraph): Record<string, number> {
  const allocation: Record<string, number> = {};
  const channels = graph.performanceMedia?.activeChannels?.value as string[] || [];
  const budget = graph.budgetOps?.mediaSpendBudget?.value as number || graph.performanceMedia?.totalMonthlySpend?.value as number || 0;

  // Simple even distribution for now
  const perChannel = budget / (channels.length || 1);
  for (const channel of channels) {
    allocation[channel] = budget > 0 ? (perChannel / budget) * 100 : 0;
  }

  return allocation;
}

function calculateAverageAllocation(
  allocations: Record<string, number>[]
): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const alloc of allocations) {
    for (const [channel, pct] of Object.entries(alloc)) {
      sums[channel] = (sums[channel] || 0) + pct;
      counts[channel] = (counts[channel] || 0) + 1;
    }
  }

  const averages: Record<string, number> = {};
  for (const [channel, sum] of Object.entries(sums)) {
    averages[channel] = sum / counts[channel];
  }

  return averages;
}

function findCommonElements(sets: Set<string>[]): string[] {
  if (sets.length === 0) return [];

  const first = sets[0];
  const common: string[] = [];

  for (const element of first) {
    if (sets.every(s => s.has(element))) {
      common.push(element);
    }
  }

  return common;
}

// ============================================================================
// AI-Powered Pattern Analysis
// ============================================================================

/**
 * Use AI to analyze patterns and generate insights
 */
export async function analyzePatternsTrends(
  patternList: Pattern[]
): Promise<{
  trends: string[];
  recommendations: string[];
  warnings: string[];
}> {
  if (patternList.length === 0) {
    return { trends: [], recommendations: [], warnings: [] };
  }

  const patternSummary = patternList.map(p => ({
    type: p.type,
    name: p.name,
    confidence: p.confidence,
    successRate: p.successRate,
    status: p.status,
  }));

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analyze these discovered patterns and identify trends, recommendations, and warnings:

${JSON.stringify(patternSummary, null, 2)}

Provide:
1. 3 key trends you see
2. 3 actionable recommendations
3. Any warnings or concerns

Respond in JSON format:
{
  "trends": ["trend1", "trend2", "trend3"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "warnings": ["warning1"] // if any
}`,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error analyzing patterns:', error);
  }

  return {
    trends: ['Pattern discovery in progress'],
    recommendations: ['Continue collecting data for more robust patterns'],
    warnings: [],
  };
}
