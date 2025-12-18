// lib/types/strategyComparison.ts
// Strategy Comparison Data Model
//
// Enables side-by-side comparison of 2-4 strategies with:
// - Structured pros/cons
// - Tradeoffs (optimizes for / sacrifices)
// - Objective coverage scoring
// - Risk assessment
// - Predicted KPI impact ranges
// - AI-generated recommendations (conditional)

import type { ConfidenceLevel } from './strategy';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Severity levels for risk assessment
 */
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Dimensions used in the decision matrix
 */
export type ComparisonDimension =
  | 'alignment'      // How well does this align with stated objectives?
  | 'feasibility'    // Can this be executed with current resources?
  | 'differentiation' // How distinctive is this vs. competitors?
  | 'speed'          // How quickly can this deliver results?
  | 'risk'           // What's the risk profile? (inverted: lower is better)
  | 'cost'           // Resource/budget requirements (inverted: lower is better)
  | 'confidence';    // How confident are we in this strategy?

/**
 * Hash references for staleness detection
 */
export interface ComparisonBasedOnHashes {
  contextHash: string;
  objectivesHash: string;
  strategyHashes: Record<string, string>; // strategyId -> hash
}

/**
 * Sources used for generating the comparison
 */
export interface ComparisonSourcesUsed {
  contextFields: string[];        // Which context fields were referenced
  objectiveIds: string[];         // Which objectives were considered
  strategyFields: string[];       // Which strategy fields were analyzed
  externalSources?: string[];     // Any external references (rare)
}

// ============================================================================
// Comparison Components
// ============================================================================

/**
 * Objective coverage analysis per strategy
 */
export interface ObjectiveCoverageItem {
  objectiveId: string;
  objectiveText: string;
  perStrategyScore: Record<string, number>; // strategyId -> 0-1 score
  notes: string; // Explanation of scoring differences
}

/**
 * Decision matrix row - scoring across a dimension
 */
export interface DecisionMatrixRow {
  dimension: ComparisonDimension;
  weight: number; // 0-1, defaults to equal weighting
  perStrategyScore: Record<string, number>; // strategyId -> 0-1 score
  explanation: string; // Why these scores?
}

/**
 * Pro/Con item with citation
 */
export interface ProConItem {
  text: string;
  citation?: string; // Reference to strategy text or objective
  significance: 'minor' | 'moderate' | 'major';
}

/**
 * Pros and cons for a single strategy
 */
export interface StrategyProsCons {
  pros: ProConItem[];
  cons: ProConItem[];
}

/**
 * Risk item with mitigation
 */
export interface RiskItem {
  risk: string;
  severity: RiskSeverity;
  likelihood: 'unlikely' | 'possible' | 'likely';
  mitigation: string;
  affectedObjectives?: string[]; // objectiveIds that could be impacted
}

/**
 * Tradeoffs for a single strategy
 */
export interface StrategyTradeoffs {
  optimizesFor: string[];
  sacrifices: string[];
  assumptions: string[]; // What must be true for this to work?
}

/**
 * KPI impact prediction (lightweight, not a forecasting engine)
 */
export interface KPIImpactPrediction {
  kpiName: string;
  currentValue?: string; // "15%" or "unknown"
  predictedRange: {
    low: string;
    high: string;
  };
  timeframe: string; // "3 months", "6 months", etc.
  confidence: ConfidenceLevel;
  rationale: string;
}

/**
 * Conditional recommendation
 */
export interface ComparisonRecommendation {
  recommendedStrategyId: string;
  rationale: string[]; // Multiple supporting reasons
  ifThenNotes: string[]; // "If X is your priority, then Y..."
  caveats: string[]; // Important considerations
  alternativeFor: Record<string, string>; // "If priority is X, consider strategy Y"
}

// ============================================================================
// Main Comparison Type
// ============================================================================

/**
 * Complete strategy comparison artifact
 */
export interface StrategyComparison {
  id: string;
  companyId: string;

  // Strategies being compared (2-4)
  strategyIds: string[];
  strategyTitles: Record<string, string>; // For display without fetching

  // Analysis components
  objectiveCoverage: ObjectiveCoverageItem[];
  decisionMatrix: DecisionMatrixRow[];
  prosCons: Record<string, StrategyProsCons>; // strategyId -> pros/cons
  tradeoffs: Record<string, StrategyTradeoffs>; // strategyId -> tradeoffs
  risks: Record<string, RiskItem[]>; // strategyId -> risks
  kpiImpacts?: Record<string, KPIImpactPrediction[]>; // strategyId -> impacts

  // Recommendation
  recommendation: ComparisonRecommendation;

  // Provenance
  basedOnHashes: ComparisonBasedOnHashes;
  sourcesUsed: ComparisonSourcesUsed;
  createdAt: string;
  updatedAt: string;

  // AI metadata
  generatedByAI: boolean;
  aiModel?: string;
  confidence: ConfidenceLevel;

  // Status
  status: 'draft' | 'applied' | 'archived';
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request to generate a comparison
 */
export interface GenerateComparisonRequest {
  strategyIds: string[]; // 2-4 strategy IDs
  focusObjectives?: string[]; // Optional: prioritize these objectives
  weightOverrides?: Partial<Record<ComparisonDimension, number>>; // Custom weights
}

/**
 * Response from comparison check endpoint
 */
export interface ComparisonCheckResponse {
  mode: 'found' | 'needs_generation' | 'stale';
  comparison?: StrategyComparison;
  currentHashes?: ComparisonBasedOnHashes;
  staleReason?: string;
}

/**
 * Response from generate endpoint
 */
export interface GenerateComparisonResponse {
  success: boolean;
  comparison?: StrategyComparison;
  error?: string;
  inputHashes: ComparisonBasedOnHashes;
}

/**
 * Response from apply endpoint
 */
export interface ApplyComparisonResponse {
  success: boolean;
  comparisonId?: string;
  error?: string;
}

// ============================================================================
// UI View Model
// ============================================================================

/**
 * Aggregated scores for quick comparison
 */
export interface StrategyAggregateScores {
  strategyId: string;
  strategyTitle: string;
  overallScore: number; // Weighted average of decision matrix
  objectiveCoverageScore: number; // Average of objective scores
  riskScore: number; // Inverted: higher = more risky
  prosCount: number;
  consCount: number;
  majorProsCount: number;
  majorConsCount: number;
}

/**
 * View model for comparison UI
 */
export interface StrategyComparisonViewModel {
  comparison: StrategyComparison;
  aggregateScores: StrategyAggregateScores[];
  sortedByOverall: string[]; // Strategy IDs sorted by overall score
  isStale: boolean;
  staleReason: string | null;
  activeStrategyId: string | null;
}

// ============================================================================
// Airtable Record Type
// ============================================================================

/**
 * Airtable record shape for STRATEGY_COMPARISONS table
 */
export interface StrategyComparisonRecord {
  id: string;
  fields: {
    CompanyId: string;
    StrategyIds: string; // JSON array
    StrategyTitles: string; // JSON Record
    ObjectiveCoverage: string; // JSON array
    DecisionMatrix: string; // JSON array
    ProsCons: string; // JSON Record
    Tradeoffs: string; // JSON Record
    Risks: string; // JSON Record
    KPIImpacts?: string; // JSON Record (optional)
    Recommendation: string; // JSON object
    BasedOnHashes: string; // JSON object
    SourcesUsed: string; // JSON object
    GeneratedByAI: boolean;
    AIModel?: string;
    Confidence: string;
    Status: 'draft' | 'applied' | 'archived';
    CreatedAt: string;
    UpdatedAt: string;
  };
}
