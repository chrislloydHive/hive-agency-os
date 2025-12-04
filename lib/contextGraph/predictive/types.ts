// lib/contextGraph/predictive/types.ts
// Predictive inference types for Context Graph
//
// Phase 4: Probabilistic field prediction

import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Prediction Types
// ============================================================================

/**
 * A single prediction for a field value
 */
export interface FieldPrediction {
  id: string;
  path: string;
  domain: DomainName;
  fieldLabel: string;

  // Predicted value(s)
  predictedValue: unknown;
  alternativeValues?: unknown[];

  // Confidence and reasoning
  confidence: number;  // 0-1
  reasoning: string;

  // Source of prediction
  predictionMethod: PredictionMethod;
  basedOn: PredictionSource[];

  // Metadata
  generatedAt: string;
  expiresAt: string;  // When prediction becomes stale
}

/**
 * Method used for prediction
 */
export type PredictionMethod =
  | 'historical_pattern'    // Based on company's own history
  | 'similar_company'       // Based on similar companies
  | 'domain_prior'          // Based on industry/domain defaults
  | 'cross_field_inference' // Inferred from related fields
  | 'ai_synthesis';         // AI combined multiple sources

/**
 * Source that contributed to a prediction
 */
export interface PredictionSource {
  type: 'own_history' | 'similar_company' | 'domain_default' | 'related_field';
  description: string;
  weight: number;  // How much this source contributed
  reference?: string;  // ID or path to source data
}

// ============================================================================
// Prediction Request Types
// ============================================================================

/**
 * Options for generating predictions
 */
export interface PredictionOptions {
  companyId: string;

  // What to predict
  targetPaths?: string[];        // Specific fields to predict
  targetDomains?: DomainName[];  // Predict missing in these domains
  predictAll?: boolean;          // Predict all missing fields

  // Prediction settings
  minConfidence?: number;        // Only return predictions above this threshold
  maxPredictions?: number;       // Maximum predictions to return
  includeFuture?: boolean;       // Include future value predictions

  // Sources to use
  useSimilarCompanies?: boolean;
  useHistoricalPatterns?: boolean;
  useDomainPriors?: boolean;
  useCrossFieldInference?: boolean;
}

/**
 * Result of a prediction request
 */
export interface PredictionResult {
  predictions: FieldPrediction[];
  missingFieldsAnalyzed: number;
  predictionsGenerated: number;
  averageConfidence: number;
  generatedAt: string;
  options: PredictionOptions;
}

// ============================================================================
// Future Value Prediction Types
// ============================================================================

/**
 * Prediction of how a field value might change
 */
export interface FutureValuePrediction {
  path: string;
  domain: DomainName;
  currentValue: unknown;

  // Predicted future state
  predictedValue: unknown;
  predictedAt: string;  // When we expect this change
  confidence: number;

  // Reasoning
  trigger: string;  // What would cause this change
  reasoning: string;

  // Impact
  impact: 'high' | 'medium' | 'low';
  affectedFields?: string[];  // Other fields that would be affected
}

// ============================================================================
// Probabilistic Range Types
// ============================================================================

/**
 * Probabilistic range for numeric fields
 */
export interface ProbabilisticRange {
  path: string;
  domain: DomainName;

  // Range
  min: number;
  max: number;
  median: number;
  mean: number;

  // Confidence intervals
  p10: number;  // 10th percentile
  p25: number;  // 25th percentile
  p75: number;  // 75th percentile
  p90: number;  // 90th percentile

  // Distribution
  distribution: 'normal' | 'skewed_left' | 'skewed_right' | 'bimodal' | 'uniform';

  // Source
  sampleSize: number;
  basedOn: 'own_history' | 'similar_companies' | 'industry_benchmark';
}

// ============================================================================
// Pattern Detection Types
// ============================================================================

/**
 * A detected pattern in field evolution
 */
export interface EvolutionPattern {
  id: string;
  patternType: 'seasonal' | 'trend' | 'cyclical' | 'step_change' | 'convergence';
  description: string;

  // Affected fields
  fields: string[];
  domains: DomainName[];

  // Pattern details
  periodDays?: number;       // For seasonal/cyclical
  direction?: 'up' | 'down' | 'stable';  // For trends
  targetValue?: unknown;     // For convergence

  // Confidence and evidence
  confidence: number;
  evidenceCount: number;
  detectedAt: string;
}

// ============================================================================
// Similarity Types (for similar company predictions)
// ============================================================================

/**
 * Similar company match
 */
export interface SimilarCompany {
  companyId: string;
  companyName: string;
  similarityScore: number;  // 0-1

  // What makes them similar
  matchingDimensions: Array<{
    dimension: string;
    weight: number;
    match: string;
  }>;

  // What we can learn
  relevantFields: string[];
  potentialInsights: string[];
}
