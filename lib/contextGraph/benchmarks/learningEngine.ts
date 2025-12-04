// lib/contextGraph/benchmarks/learningEngine.ts
// Cross-company pattern learning
//
// Phase 4: Learn patterns from successful companies

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type {
  LearnedPattern,
  LearningBasedRecommendation,
} from './types';
import {
  findSimilarCompanies,
  getCompanyClassification,
  getAllEmbeddings,
} from './embeddingEngine';

// ============================================================================
// Pattern Storage (In-memory for now, replace with DB)
// ============================================================================

/** Store of learned patterns */
const patternStore = new Map<string, LearnedPattern>();

/** Store of company graphs for pattern analysis */
const graphStore = new Map<string, CompanyContextGraph>();

// ============================================================================
// Pattern Discovery
// ============================================================================

/**
 * Register a company graph for pattern learning
 */
export function registerCompanyGraph(
  companyId: string,
  graph: CompanyContextGraph
): void {
  graphStore.set(companyId, graph);
}

/**
 * Discover patterns across all companies
 */
export async function discoverPatterns(): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  // Correlation patterns
  const correlations = await discoverCorrelationPatterns();
  patterns.push(...correlations);

  // Cluster patterns
  const clusters = discoverClusterPatterns();
  patterns.push(...clusters);

  // Store patterns
  for (const pattern of patterns) {
    patternStore.set(pattern.id, pattern);
  }

  return patterns;
}

/**
 * Discover correlation patterns between fields
 */
async function discoverCorrelationPatterns(): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  // Define field pairs to check for correlations
  const fieldPairs: Array<{
    field1: { domain: DomainName; path: string };
    field2: { domain: DomainName; path: string };
  }> = [
    {
      field1: { domain: 'performanceMedia', path: 'channels' },
      field2: { domain: 'budgetOps', path: 'monthlyBudget' },
    },
    {
      field1: { domain: 'audience', path: 'primaryAudience' },
      field2: { domain: 'performanceMedia', path: 'bestChannels' },
    },
    {
      field1: { domain: 'content', path: 'contentPillars' },
      field2: { domain: 'seo', path: 'primaryKeywords' },
    },
  ];

  for (const pair of fieldPairs) {
    const correlation = calculateFieldCorrelation(pair.field1, pair.field2);
    if (Math.abs(correlation.coefficient) > 0.6) {
      patterns.push({
        id: `pattern_corr_${randomUUID().slice(0, 8)}`,
        name: `${pair.field1.path} correlates with ${pair.field2.path}`,
        description: `Companies with strong ${pair.field1.path} tend to have ${
          correlation.coefficient > 0 ? 'higher' : 'lower'
        } ${pair.field2.path}`,
        type: 'correlation',
        confidence: Math.abs(correlation.coefficient),
        support: correlation.sampleSize,
        conditions: [{
          domain: pair.field1.domain,
          path: pair.field1.path,
          operator: 'greater',
          value: correlation.threshold,
        }],
        outcome: {
          domain: pair.field2.domain,
          path: pair.field2.path,
          effect: correlation.coefficient > 0 ? 'positive' : 'negative',
          magnitude: Math.abs(correlation.coefficient),
        },
        exemplars: correlation.exemplars,
        discoveredAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
      });
    }
  }

  return patterns;
}

function calculateFieldCorrelation(
  field1: { domain: DomainName; path: string },
  field2: { domain: DomainName; path: string }
): {
  coefficient: number;
  sampleSize: number;
  threshold: number;
  exemplars: string[];
} {
  const values1: number[] = [];
  const values2: number[] = [];
  const exemplars: string[] = [];

  for (const [companyId, graph] of graphStore) {
    const domain1 = graph[field1.domain];
    const domain2 = graph[field2.domain];
    if (!domain1 || !domain2) continue;

    const fieldData1 = (domain1 as Record<string, unknown>)[field1.path];
    const fieldData2 = (domain2 as Record<string, unknown>)[field2.path];

    const v1 = extractNumericValue(fieldData1);
    const v2 = extractNumericValue(fieldData2);

    if (v1 !== null && v2 !== null) {
      values1.push(v1);
      values2.push(v2);
      exemplars.push(companyId);
    }
  }

  if (values1.length < 5) {
    return { coefficient: 0, sampleSize: 0, threshold: 0, exemplars: [] };
  }

  // Calculate Pearson correlation
  const n = values1.length;
  const sum1 = values1.reduce((a, b) => a + b, 0);
  const sum2 = values2.reduce((a, b) => a + b, 0);
  const sum1Sq = values1.reduce((a, b) => a + b * b, 0);
  const sum2Sq = values2.reduce((a, b) => a + b * b, 0);
  const pSum = values1.reduce((a, b, i) => a + b * values2[i], 0);

  const num = pSum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

  const coefficient = den === 0 ? 0 : num / den;
  const threshold = values1.sort((a, b) => a - b)[Math.floor(n * 0.5)];

  return {
    coefficient,
    sampleSize: n,
    threshold,
    exemplars: exemplars.slice(0, 5),
  };
}

function extractNumericValue(field: unknown): number | null {
  if (!field || typeof field !== 'object') return null;
  if (!('value' in field)) return null;

  const value = (field as { value: unknown }).value;

  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.length;

  return null;
}

/**
 * Discover cluster patterns
 */
function discoverClusterPatterns(): LearnedPattern[] {
  const patterns: LearnedPattern[] = [];

  // Group companies by industry and find common characteristics
  const byIndustry = new Map<string, string[]>();

  for (const [companyId] of graphStore) {
    const classification = getCompanyClassification(companyId);
    if (!classification) continue;

    const industry = classification.industry;
    if (!byIndustry.has(industry)) {
      byIndustry.set(industry, []);
    }
    byIndustry.get(industry)!.push(companyId);
  }

  for (const [industry, companyIds] of byIndustry) {
    if (companyIds.length < 3) continue;

    // Find common channel preferences
    const channelCounts = new Map<string, number>();
    for (const companyId of companyIds) {
      const graph = graphStore.get(companyId);
      const channels = (graph?.performanceMedia?.activeChannels as { value?: string[] })?.value || [];
      for (const channel of channels) {
        channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
      }
    }

    // Find channels used by >50% of industry
    const commonChannels: string[] = [];
    for (const [channel, count] of channelCounts) {
      if (count / companyIds.length > 0.5) {
        commonChannels.push(channel);
      }
    }

    if (commonChannels.length > 0) {
      patterns.push({
        id: `pattern_cluster_${industry}_${randomUUID().slice(0, 8)}`,
        name: `${industry} industry channel preferences`,
        description: `${industry} companies commonly use: ${commonChannels.join(', ')}`,
        type: 'cluster',
        confidence: 0.7,
        support: companyIds.length,
        conditions: [{
          domain: 'identity',
          path: 'industry',
          operator: 'contains',
          value: industry,
        }],
        outcome: {
          domain: 'performanceMedia',
          path: 'channels',
          effect: 'positive',
          magnitude: 0.6,
        },
        exemplars: companyIds.slice(0, 5),
        discoveredAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
      });
    }
  }

  return patterns;
}

// ============================================================================
// Recommendations
// ============================================================================

/**
 * Generate recommendations for a company based on learned patterns
 */
export async function generateRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  limit: number = 5
): Promise<LearningBasedRecommendation[]> {
  const recommendations: LearningBasedRecommendation[] = [];

  // Get similar companies
  const similar = findSimilarCompanies(companyId, { limit: 10 });

  // Check each pattern
  for (const pattern of patternStore.values()) {
    const recommendation = checkPatternApplicability(companyId, graph, pattern, similar);
    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  // Generate AI-based recommendations for gaps
  const aiRecommendations = await generateAIRecommendations(companyId, graph, similar);
  recommendations.push(...aiRecommendations);

  // Sort by priority and limit
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function checkPatternApplicability(
  companyId: string,
  graph: CompanyContextGraph,
  pattern: LearnedPattern,
  similar: Array<{ companyId: string; companyName: string }>
): LearningBasedRecommendation | null {
  // Check if pattern conditions apply
  const meetsConditions = pattern.conditions.every(condition => {
    const domain = graph[condition.domain];
    if (!domain) return false;

    const field = (domain as Record<string, unknown>)[condition.path];
    if (!field || typeof field !== 'object' || !('value' in field)) return false;

    const value = (field as { value: unknown }).value;
    return checkCondition(value, condition.operator, condition.value);
  });

  if (!meetsConditions) return null;

  // Check if outcome field is empty (opportunity to apply pattern)
  const outcomeDomain = graph[pattern.outcome.domain];
  const outcomeField = outcomeDomain
    ? (outcomeDomain as Record<string, unknown>)[pattern.outcome.path]
    : null;

  const hasOutcome = outcomeField &&
    typeof outcomeField === 'object' &&
    'value' in outcomeField &&
    (outcomeField as { value: unknown }).value !== null;

  if (hasOutcome) return null;

  // Count similar companies using this pattern
  const similarUsingPattern = similar.filter(s => {
    const similarGraph = graphStore.get(s.companyId);
    if (!similarGraph) return false;

    const similarOutcome = similarGraph[pattern.outcome.domain];
    return similarOutcome &&
      typeof (similarOutcome as Record<string, unknown>)[pattern.outcome.path] === 'object' &&
      'value' in ((similarOutcome as Record<string, unknown>)[pattern.outcome.path] as object);
  }).length;

  return {
    id: `rec_${randomUUID().slice(0, 8)}`,
    companyId,
    title: `Apply ${pattern.name}`,
    description: pattern.description,
    basedOnPattern: pattern,
    similarCompaniesUsingThis: similarUsingPattern,
    successRate: pattern.confidence,
    targetField: {
      domain: pattern.outcome.domain,
      path: pattern.outcome.path,
    },
    impact: pattern.confidence > 0.8 ? 'high' : pattern.confidence > 0.6 ? 'medium' : 'low',
    effort: 'medium',
    priority: Math.round(pattern.confidence * pattern.support / 10),
    generatedAt: new Date().toISOString(),
  };
}

function checkCondition(
  value: unknown,
  operator: string,
  target: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return value === target;
    case 'contains':
      if (typeof value === 'string') return value.includes(String(target));
      if (Array.isArray(value)) return value.includes(target);
      return false;
    case 'greater':
      return typeof value === 'number' && typeof target === 'number' && value > target;
    case 'less':
      return typeof value === 'number' && typeof target === 'number' && value < target;
    case 'range':
      if (typeof value !== 'number' || !Array.isArray(target)) return false;
      return value >= target[0] && value <= target[1];
    default:
      return false;
  }
}

async function generateAIRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  similar: Array<{ companyId: string; companyName: string }>
): Promise<LearningBasedRecommendation[]> {
  if (similar.length === 0) return [];

  // Get successful patterns from similar companies
  const similarPatterns: string[] = [];
  for (const s of similar.slice(0, 3)) {
    const similarGraph = graphStore.get(s.companyId);
    if (!similarGraph) continue;

    // Check what they have that we don't
    const channels = (similarGraph.performanceMedia?.activeChannels as { value?: string[] })?.value || [];
    const ourChannels = (graph.performanceMedia?.activeChannels as { value?: string[] })?.value || [];
    const missingChannels = channels.filter(c => !ourChannels.includes(c));

    if (missingChannels.length > 0) {
      similarPatterns.push(`${s.companyName} uses ${missingChannels.join(', ')}`);
    }
  }

  if (similarPatterns.length === 0) return [];

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Based on these patterns from similar successful companies:
${similarPatterns.join('\n')}

Generate 1-2 specific recommendations. Return JSON array:
[{
  "title": "short title",
  "description": "why this matters",
  "domain": "performanceMedia",
  "path": "channels",
  "impact": "high|medium|low"
}]

Return ONLY the JSON array.`,
      }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') return [];

    const parsed = JSON.parse(textContent.text.trim());
    if (!Array.isArray(parsed)) return [];

    return parsed.map((rec: any) => ({
      id: `rec_ai_${randomUUID().slice(0, 8)}`,
      companyId,
      title: rec.title,
      description: rec.description,
      basedOnPattern: {
        id: 'ai_generated',
        name: 'AI-identified pattern',
        description: 'Pattern identified by AI from similar companies',
        type: 'cluster' as const,
        confidence: 0.7,
        support: similar.length,
        conditions: [],
        outcome: {
          domain: rec.domain as DomainName,
          path: rec.path,
          effect: 'positive' as const,
          magnitude: 0.6,
        },
        exemplars: similar.map(s => s.companyId),
        discoveredAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
      },
      similarCompaniesUsingThis: similar.length,
      successRate: 0.7,
      targetField: {
        domain: rec.domain as DomainName,
        path: rec.path,
      },
      impact: rec.impact as 'high' | 'medium' | 'low',
      effort: 'medium' as const,
      priority: rec.impact === 'high' ? 8 : rec.impact === 'medium' ? 5 : 3,
      generatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[learning] AI recommendation generation failed:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all learned patterns
 */
export function getAllPatterns(): LearnedPattern[] {
  return Array.from(patternStore.values());
}

/**
 * Get pattern by ID
 */
export function getPattern(patternId: string): LearnedPattern | undefined {
  return patternStore.get(patternId);
}

/**
 * Get learning stats
 */
export function getLearningStats(): {
  totalPatterns: number;
  patternsByType: Record<string, number>;
  totalCompanies: number;
  averageSupport: number;
} {
  const patterns = getAllPatterns();
  const patternsByType: Record<string, number> = {};

  for (const pattern of patterns) {
    patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
  }

  return {
    totalPatterns: patterns.length,
    patternsByType,
    totalCompanies: graphStore.size,
    averageSupport: patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.support, 0) / patterns.length
      : 0,
  };
}
