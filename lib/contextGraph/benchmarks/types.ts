// lib/contextGraph/benchmarks/types.ts
// Cross-company learning and benchmarking types
//
// Phase 4: Multi-company learning with embeddings and similarity

import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Company embedding for similarity matching
 */
export interface CompanyEmbedding {
  companyId: string;
  companyName: string;

  // The embedding vector
  embedding: number[];

  // Source data used for embedding
  sourceDomains: DomainName[];
  sourceFields: string[];

  // Metadata
  generatedAt: string;
  generatedBy: 'ai' | 'rule_based';
  version: string;

  // Embedding quality
  completeness: number;  // 0-1, how many fields were populated
  confidence: number;    // 0-1, quality of the embedding
}

/**
 * Dimensions captured in the embedding
 */
export interface EmbeddingDimensions {
  industry: number[];      // Industry classification
  scale: number[];         // Company size/budget
  maturity: number[];      // Digital maturity
  channels: number[];      // Channel preferences
  audience: number[];      // Target audience characteristics
  brand: number[];         // Brand positioning
  objectives: number[];    // Business goals
}

// ============================================================================
// Similarity Types
// ============================================================================

/**
 * Similarity match between companies
 */
export interface SimilarityMatch {
  companyId: string;
  companyName: string;

  // Overall similarity
  similarity: number;  // 0-1

  // Breakdown by dimension
  dimensionSimilarity: {
    industry: number;
    scale: number;
    maturity: number;
    channels: number;
    audience: number;
    brand: number;
    objectives: number;
  };

  // Specific matches
  matchingAspects: string[];
  differentiatingAspects: string[];
}

/**
 * Similarity search options
 */
export interface SimilaritySearchOptions {
  limit?: number;
  minSimilarity?: number;
  weightByDimension?: Partial<Record<keyof EmbeddingDimensions, number>>;
  excludeCompanyIds?: string[];
  filterByIndustry?: string;
}

// ============================================================================
// Benchmark Types
// ============================================================================

/**
 * A benchmark metric
 */
export interface BenchmarkMetric {
  id: string;
  name: string;
  description: string;

  // The field being benchmarked
  domain: DomainName;
  path: string;

  // Aggregation method
  aggregation: 'average' | 'median' | 'percentile' | 'distribution';

  // The computed values
  values: {
    overall?: number;
    byIndustry?: Record<string, number>;
    byScale?: Record<string, number>;
    percentiles?: Record<number, number>;  // p10, p25, p50, p75, p90
  };

  // Sample info
  sampleSize: number;
  lastUpdated: string;
}

/**
 * Company's position relative to benchmarks
 */
export interface BenchmarkPosition {
  companyId: string;
  metric: BenchmarkMetric;

  // Company's value
  value: number | null;

  // Position
  percentile: number;      // Where company falls (0-100)
  rank: number;            // Rank among similar companies
  totalInGroup: number;    // Total companies in comparison group

  // Comparison
  vsAverage: number;       // % difference from average
  vsMedian: number;        // % difference from median
  vsBest: number;          // % difference from top performer

  // Insights
  status: 'leading' | 'above_average' | 'average' | 'below_average' | 'lagging';
  insight: string;
}

/**
 * Full benchmark report for a company
 */
export interface BenchmarkReport {
  companyId: string;
  companyName: string;

  // Comparison group
  comparisonGroup: {
    type: 'industry' | 'scale' | 'similar' | 'all';
    name: string;
    size: number;
  };

  // Positions
  positions: BenchmarkPosition[];

  // Summary
  summary: {
    overallScore: number;      // 0-100
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
  };

  // Metadata
  generatedAt: string;
  dataFreshness: string;
}

// ============================================================================
// Learning Types
// ============================================================================

/**
 * A pattern learned from multiple companies
 */
export interface LearnedPattern {
  id: string;
  name: string;
  description: string;

  // Pattern definition
  type: 'correlation' | 'sequence' | 'cluster' | 'anomaly';
  confidence: number;
  support: number;  // Number of companies exhibiting pattern

  // The pattern
  conditions: Array<{
    domain: DomainName;
    path: string;
    operator: 'equals' | 'contains' | 'greater' | 'less' | 'range';
    value: unknown;
  }>;

  // Outcome
  outcome: {
    domain: DomainName;
    path: string;
    effect: 'positive' | 'negative' | 'neutral';
    magnitude: number;
  };

  // Example companies
  exemplars: string[];  // Company IDs

  // Metadata
  discoveredAt: string;
  lastValidated: string;
}

/**
 * Recommendation based on learned patterns
 */
export interface LearningBasedRecommendation {
  id: string;
  companyId: string;

  // The recommendation
  title: string;
  description: string;

  // Supporting evidence
  basedOnPattern: LearnedPattern;
  similarCompaniesUsingThis: number;
  successRate: number;

  // Implementation
  targetField: {
    domain: DomainName;
    path: string;
  };
  suggestedValue?: unknown;
  suggestedRange?: { min: unknown; max: unknown };

  // Priority
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  priority: number;  // 1-10

  // Metadata
  generatedAt: string;
}

// ============================================================================
// Industry Classification
// ============================================================================

/**
 * Industry categories for classification
 */
export type IndustryCategory =
  | 'technology'
  | 'ecommerce'
  | 'saas'
  | 'fintech'
  | 'healthcare'
  | 'education'
  | 'retail'
  | 'manufacturing'
  | 'professional_services'
  | 'media_entertainment'
  | 'travel_hospitality'
  | 'real_estate'
  | 'automotive'
  | 'food_beverage'
  | 'other';

/**
 * Scale categories for classification
 */
export type ScaleCategory =
  | 'startup'        // < $1M budget
  | 'small'          // $1M - $5M budget
  | 'medium'         // $5M - $25M budget
  | 'large'          // $25M - $100M budget
  | 'enterprise';    // > $100M budget

/**
 * Company classification
 */
export interface CompanyClassification {
  companyId: string;

  // Classifications
  industry: IndustryCategory;
  industryConfidence: number;
  subIndustry?: string;

  scale: ScaleCategory;
  scaleConfidence: number;

  // Additional tags
  tags: string[];

  // Metadata
  classifiedAt: string;
  classifiedBy: 'ai' | 'manual' | 'inferred';
}
