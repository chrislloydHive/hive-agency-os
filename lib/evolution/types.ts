// lib/evolution/types.ts
// Phase 6: Emergent Intelligence & Cross-Company Evolution
//
// Types for the learning system that evolves across companies

import type { DomainName } from '../contextGraph/companyContextGraph';

// ============================================================================
// Pattern Types
// ============================================================================

/**
 * A pattern discovered from cross-company analysis
 */
export interface Pattern {
  id: string;
  type: PatternType;
  name: string;
  description: string;

  // Pattern definition
  conditions: PatternCondition[];
  outcomes: PatternOutcome[];

  // Confidence and evidence
  confidence: number; // 0-1
  sampleSize: number;
  statisticalSignificance: number;
  effect: {
    metric: string;
    improvement: number;
    direction: 'increase' | 'decrease';
  };

  // Context applicability
  applicableIndustries: string[];
  applicableBusinessModels: string[];
  applicableBudgetRanges: { min: number; max: number }[];
  applicableSeasons: string[];

  // Evolution tracking
  discoveredAt: string;
  lastValidatedAt: string;
  validationCount: number;
  successRate: number;

  // Status
  status: 'emerging' | 'validated' | 'stable' | 'declining' | 'deprecated';
}

export type PatternType =
  | 'budget_allocation'
  | 'channel_mix'
  | 'creative_strategy'
  | 'audience_targeting'
  | 'seasonal_timing'
  | 'bidding_strategy'
  | 'geo_expansion'
  | 'funnel_optimization';

export interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range' | 'in_list';
  value: unknown;
  weight: number;
}

export interface PatternOutcome {
  metric: string;
  expectedChange: number;
  actualChange: number;
  confidence: number;
}

// ============================================================================
// Benchmark Types
// ============================================================================

/**
 * Industry benchmark data
 */
export interface IndustryBenchmark {
  id: string;
  industry: string;
  subIndustry?: string;
  businessModel: string;
  period: string; // e.g., "2025-Q1"

  // Performance benchmarks
  metrics: {
    cpa: BenchmarkMetric;
    ctr: BenchmarkMetric;
    conversionRate: BenchmarkMetric;
    roas: BenchmarkMetric;
    cpc: BenchmarkMetric;
    impressionShare: BenchmarkMetric;
  };

  // Channel benchmarks
  channelMix: Record<string, {
    avgAllocation: number;
    topPerformerAllocation: number;
    avgRoas: number;
  }>;

  // Creative benchmarks
  creativeBenchmarks: {
    avgCreativeLifespan: number;
    topFormats: string[];
    avgTestsPerMonth: number;
  };

  // Sample info
  sampleSize: number;
  dataQuality: 'high' | 'medium' | 'low';

  updatedAt: string;
}

export interface BenchmarkMetric {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// Insight Types
// ============================================================================

/**
 * A cross-company insight
 */
export interface CrossCompanyInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;

  // What we learned
  finding: string;
  evidence: InsightEvidence[];

  // Actionability
  actionable: boolean;
  suggestedAction?: string;
  expectedImpact?: number;

  // Applicability
  applicableTo: {
    industries?: string[];
    budgetRanges?: { min: number; max: number }[];
    businessModels?: string[];
    companyStages?: string[];
  };

  // Confidence
  confidence: number;
  sampleSize: number;

  // Timing
  discoveredAt: string;
  validUntil?: string;

  // Status
  status: 'new' | 'validated' | 'applied' | 'expired';
}

export type InsightType =
  | 'performance_trend'
  | 'channel_opportunity'
  | 'creative_insight'
  | 'audience_discovery'
  | 'competitive_intel'
  | 'seasonal_pattern'
  | 'efficiency_opportunity'
  | 'risk_warning';

export interface InsightEvidence {
  companyCount: number;
  timeRange: string;
  metric: string;
  observation: string;
  statisticalMethod: string;
}

// ============================================================================
// Learning Types
// ============================================================================

/**
 * A learning captured from experiments or operations
 */
export interface Learning {
  id: string;
  companyId: string;
  type: LearningType;

  // What was learned
  hypothesis: string;
  outcome: 'confirmed' | 'rejected' | 'inconclusive';
  learning: string;

  // Context
  domain: DomainName;
  channels?: string[];
  audiences?: string[];

  // Evidence
  experimentId?: string;
  metrics: Record<string, {
    before: number;
    after: number;
    change: number;
  }>;

  // Generalizability
  generalizable: boolean;
  applicableConditions?: string[];

  // Timing
  capturedAt: string;
  validityPeriod?: number; // Days

  // Status
  status: 'new' | 'reviewed' | 'shared' | 'deprecated';
  sharedToPatterns?: string[];
}

export type LearningType =
  | 'experiment_result'
  | 'optimization_outcome'
  | 'signal_response'
  | 'seasonal_observation'
  | 'competitive_response'
  | 'creative_performance'
  | 'audience_behavior';

// ============================================================================
// Evolution Cycle Types
// ============================================================================

/**
 * Cross-company evolution cycle result
 */
export interface EvolutionCycleResult {
  id: string;
  runAt: string;
  duration: number;

  // Companies analyzed
  companiesAnalyzed: number;
  experimentsAnalyzed: number;
  learningsProcessed: number;

  // Outputs
  newPatterns: number;
  updatedPatterns: number;
  deprecatedPatterns: number;
  newInsights: number;
  benchmarksUpdated: number;

  // Quality
  dataQuality: number;
  confidenceLevel: number;

  // Details
  patternIds: string[];
  insightIds: string[];

  // Status
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

// ============================================================================
// Recommendation Types
// ============================================================================

/**
 * A pattern-based recommendation for a company
 */
export interface PatternRecommendation {
  id: string;
  companyId: string;
  patternId: string;
  patternName: string;

  // Recommendation
  title: string;
  description: string;
  suggestedAction: string;

  // Expected impact
  expectedImpact: {
    metric: string;
    currentValue: number;
    expectedValue: number;
    improvement: number;
  };

  // Confidence
  confidence: number;
  basedOnCompanies: number;

  // Context match
  matchScore: number;
  matchFactors: string[];
  mismatchFactors: string[];

  // Status
  status: 'pending' | 'applied' | 'rejected' | 'expired';
  appliedAt?: string;
  actualImpact?: number;

  generatedAt: string;
  expiresAt: string;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

/**
 * Aggregated knowledge entry
 */
export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  topic: string;
  title: string;

  // Content
  summary: string;
  details: string;
  keyPoints: string[];

  // Evidence
  sources: {
    type: 'pattern' | 'insight' | 'benchmark' | 'learning';
    id: string;
    contribution: string;
  }[];

  // Applicability
  applicableTo: string[];
  prerequisites?: string[];

  // Quality
  confidence: number;
  lastValidated: string;

  // Status
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
}

export type KnowledgeCategory =
  | 'best_practices'
  | 'common_pitfalls'
  | 'industry_trends'
  | 'channel_strategies'
  | 'creative_guidance'
  | 'audience_insights'
  | 'seasonal_strategies'
  | 'optimization_techniques';

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Evolution analytics summary
 */
export interface EvolutionAnalytics {
  totalPatterns: number;
  activePatterns: number;
  patternsByType: Record<PatternType, number>;
  patternSuccessRate: number;

  totalInsights: number;
  insightsByType: Record<InsightType, number>;
  actionableInsightsRate: number;

  totalLearnings: number;
  learningsByType: Record<LearningType, number>;
  learningsSharedRate: number;

  benchmarkCoverage: {
    industries: number;
    totalCompanies: number;
    lastUpdated: string;
  };

  evolutionHealth: number; // 0-100
  dataQuality: number; // 0-100

  lastCycleAt: string;
  nextCycleAt: string;
}
