// lib/types/strategyInsights.ts
// Strategy Insights Types - Deterministic insights from attribution + evolution data
//
// Design principle: No AI, no ML. All insights are rule-based and deterministic.
// Insights are grounded in evidence from evolution events and attribution scores.

import type { AttributionDirection } from './strategyAttribution';
import type { DiffRiskFlag } from './strategyEvolution';

// ============================================================================
// Insight Categories
// ============================================================================

/**
 * Categories of strategic insights
 */
export type InsightCategory = 'wins' | 'risks' | 'neutral' | 'drivers' | 'next_actions';

/**
 * Category labels for display
 */
export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  wins: 'Wins',
  risks: 'Risks',
  neutral: 'Observations',
  drivers: 'Top Drivers',
  next_actions: 'Next Actions',
};

/**
 * Category colors for UI
 */
export const INSIGHT_CATEGORY_COLORS: Record<InsightCategory, string> = {
  wins: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  risks: 'bg-red-500/10 text-red-400 border-red-500/30',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  drivers: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  next_actions: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

// ============================================================================
// Recommended Action Types
// ============================================================================

/**
 * Types of recommended actions
 */
export type ActionType =
  | 'expand_success_pattern'
  | 'reduce_scope_churn'
  | 'add_measurement_loop'
  | 'restore_or_replace_removed'
  | 'address_risk_flags'
  | 'consolidate_neutral_changes'
  | 'investigate_low_confidence';

/**
 * Action type labels
 */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  expand_success_pattern: 'Expand Success Pattern',
  reduce_scope_churn: 'Reduce Scope Churn',
  add_measurement_loop: 'Add Measurement Loop',
  restore_or_replace_removed: 'Restore or Replace Removed',
  address_risk_flags: 'Address Risk Flags',
  consolidate_neutral_changes: 'Consolidate Neutral Changes',
  investigate_low_confidence: 'Investigate Low Confidence',
};

/**
 * Expected impact levels
 */
export type ExpectedImpact = 'minor' | 'moderate' | 'significant';

/**
 * A recommended action based on insights
 */
export interface RecommendedAction {
  /** Type of action */
  actionType: ActionType;

  /** Target of the action (e.g., pillar name, tactic, objective) */
  target: string;

  /** Why this action is recommended */
  why: string;

  /** How to implement (bullet points) */
  how: string[];

  /** Guardrails and considerations */
  guardrails: string[];

  /** Expected impact level */
  expectedImpact: ExpectedImpact;

  /** Confidence in this recommendation (0-100) */
  confidence: number;

  /** Evidence supporting this action */
  evidence: {
    eventIds: string[];
    driverKeys?: string[];
    signalIds?: string[];
  };
}

// ============================================================================
// Strategy Insight
// ============================================================================

/**
 * Metrics associated with an insight
 */
export interface InsightMetrics {
  /** Average attribution score across relevant events */
  avgAttributionScore: number;

  /** Average confidence across relevant events */
  confidence: number;

  /** Average impact score from diff summaries */
  impactScoreAvg: number;

  /** Number of events/signals in sample */
  sampleSize: number;
}

/**
 * Evidence supporting an insight
 */
export interface InsightEvidence {
  /** Related evolution event IDs */
  eventIds: string[];

  /** Related driver keys (from TopDriver.label) */
  driverKeys?: string[];

  /** Related outcome signal IDs */
  signalIds?: string[];

  /** Risk flags from diff summaries */
  diffRiskFlags?: DiffRiskFlag[];
}

/**
 * A single strategic insight
 */
export interface StrategyInsight {
  /** Unique insight ID (deterministic) */
  id: string;

  /** Category of insight */
  category: InsightCategory;

  /** Short title */
  title: string;

  /** Summary description */
  summary: string;

  /** Evidence supporting this insight */
  evidence: InsightEvidence;

  /** Metrics for this insight */
  metrics: InsightMetrics;

  /** Optional recommended action */
  recommendedAction?: RecommendedAction;
}

// ============================================================================
// Driver Leaderboard
// ============================================================================

/**
 * Aggregated driver stats for leaderboard
 */
export interface DriverLeaderboardEntry {
  /** Driver label (e.g., "completed", "high-impact") */
  label: string;

  /** Type of driver */
  type: 'signalType' | 'source';

  /** Total contribution across all events */
  totalContribution: number;

  /** Average contribution per event */
  avgContribution: number;

  /** Number of events this driver appears in */
  eventCount: number;

  /** Predominant direction */
  predominantDirection: AttributionDirection;

  /** Event IDs where this driver appears */
  eventIds: string[];
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * A detected pattern across events
 */
export interface DetectedPattern {
  /** Pattern ID */
  id: string;

  /** Pattern type */
  type: 'repeating_driver' | 'risk_cluster' | 'direction_trend' | 'scope_churn';

  /** Description of the pattern */
  description: string;

  /** Strength of the pattern (0-100) */
  strength: number;

  /** Event IDs exhibiting this pattern */
  eventIds: string[];
}

// ============================================================================
// Insights Result
// ============================================================================

/**
 * Coverage statistics for insight generation
 */
export interface InsightsCoverage {
  /** Total evolution events analyzed */
  totalEvents: number;

  /** Events with attribution data */
  eventsWithAttribution: number;

  /** Events contributing to insights */
  eventsInInsights: number;

  /** Percentage of events covered */
  coveragePercent: number;
}

/**
 * Rollup summaries
 */
export interface InsightsRollups {
  /** Driver leaderboard sorted by contribution */
  driverLeaderboard: DriverLeaderboardEntry[];

  /** Detected patterns */
  patterns: DetectedPattern[];

  /** Recommended actions */
  recommendedActions: RecommendedAction[];

  /** Coverage statistics */
  coverage: InsightsCoverage;
}

/**
 * Complete insights result
 */
export interface StrategyInsightsResult {
  /** Individual insights */
  insights: StrategyInsight[];

  /** Rollup summaries */
  rollups: InsightsRollups;

  /** Attribution window used */
  window: {
    preDays: number;
    postDays: number;
  };

  /** When insights were generated */
  generatedAt: string;
}

// ============================================================================
// Thresholds & Constants
// ============================================================================

/**
 * Thresholds for insight categorization
 */
export const INSIGHT_THRESHOLDS = {
  /** Minimum attribution score for a "win" */
  WIN_MIN_SCORE: 65,

  /** Maximum attribution score for a "risk" */
  RISK_MAX_SCORE: 35,

  /** Minimum confidence for win/risk classification */
  MIN_CONFIDENCE: 60,

  /** Minimum sample size for pattern detection */
  MIN_PATTERN_SAMPLE: 2,

  /** Minimum driver appearances for leaderboard */
  MIN_DRIVER_APPEARANCES: 1,

  /** Minimum pattern strength to report */
  MIN_PATTERN_STRENGTH: 40,
};

/**
 * Sorting weights for insight priority
 */
export const INSIGHT_PRIORITY_WEIGHTS = {
  wins: 100,
  risks: 90,
  next_actions: 80,
  drivers: 60,
  neutral: 40,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a deterministic insight ID from inputs
 */
export function generateInsightId(
  category: InsightCategory,
  ...keys: string[]
): string {
  const combined = [category, ...keys].join('|');
  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `insight_${category}_${Math.abs(hash).toString(36)}`;
}

/**
 * Sort insights by priority (category weight + metrics)
 */
export function sortInsightsByPriority(insights: StrategyInsight[]): StrategyInsight[] {
  return [...insights].sort((a, b) => {
    // First by category priority
    const categoryDiff =
      INSIGHT_PRIORITY_WEIGHTS[b.category] - INSIGHT_PRIORITY_WEIGHTS[a.category];
    if (categoryDiff !== 0) return categoryDiff;

    // Then by attribution score (higher first)
    const scoreDiff = b.metrics.avgAttributionScore - a.metrics.avgAttributionScore;
    if (Math.abs(scoreDiff) > 5) return scoreDiff;

    // Then by confidence
    const confidenceDiff = b.metrics.confidence - a.metrics.confidence;
    if (Math.abs(confidenceDiff) > 5) return confidenceDiff;

    // Then by sample size
    const sampleDiff = b.metrics.sampleSize - a.metrics.sampleSize;
    if (sampleDiff !== 0) return sampleDiff;

    // Finally by ID for stability
    return a.id.localeCompare(b.id);
  });
}

/**
 * Get color class for insight category
 */
export function getInsightCategoryColorClass(category: InsightCategory): string {
  return INSIGHT_CATEGORY_COLORS[category];
}

/**
 * Get label for insight category
 */
export function getInsightCategoryLabel(category: InsightCategory): string {
  return INSIGHT_CATEGORY_LABELS[category];
}

/**
 * Get label for action type
 */
export function getActionTypeLabel(actionType: ActionType): string {
  return ACTION_TYPE_LABELS[actionType];
}

/**
 * Get color class for expected impact
 */
export function getExpectedImpactColorClass(impact: ExpectedImpact): string {
  const colors: Record<ExpectedImpact, string> = {
    minor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    moderate: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    significant: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };
  return colors[impact];
}

/**
 * Get label for expected impact
 */
export function getExpectedImpactLabel(impact: ExpectedImpact): string {
  const labels: Record<ExpectedImpact, string> = {
    minor: 'Minor Impact',
    moderate: 'Moderate Impact',
    significant: 'Significant Impact',
  };
  return labels[impact];
}

/**
 * Format confidence for display
 */
export function formatInsightConfidence(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 60) return 'Medium';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
}

/**
 * Get color class for confidence
 */
export function getInsightConfidenceColorClass(confidence: number): string {
  if (confidence >= 80) return 'text-emerald-400';
  if (confidence >= 60) return 'text-blue-400';
  if (confidence >= 40) return 'text-amber-400';
  return 'text-slate-500';
}
