// lib/os/insights/insightTypes.ts
// Types for the OS Insight Engine
// Proactive intelligence that detects patterns, risks, and opportunities

// ============================================================================
// Core Insight Types
// ============================================================================

export type InsightType =
  | 'score_regression'      // Score dropped significantly
  | 'score_improvement'     // Score improved significantly
  | 'emerging_risk'         // Pattern indicates future problem
  | 'opportunity'           // Potential quick win or improvement
  | 'trend'                 // Notable trend across metrics
  | 'anomaly'               // Unusual data point
  | 'milestone'             // Achievement or threshold crossed
  | 'stale_data'            // Data hasn't been updated
  | 'competitive_shift'     // Competitor position changed
  | 'seasonal_pattern';     // Time-based recurring pattern

export type InsightTheme =
  | 'performance'           // Speed, technical metrics
  | 'visibility'            // SEO, search rankings
  | 'brand'                 // Brand consistency, reputation
  | 'content'               // Content quality, freshness
  | 'local'                 // GBP, local presence
  | 'social'                // Social media engagement
  | 'competition'           // Competitive positioning
  | 'overall';              // Cross-cutting insights

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export type InsightTimeframe = 'immediate' | 'this_week' | 'this_month' | 'this_quarter';

// ============================================================================
// Insight Object
// ============================================================================

export interface Insight {
  /** Unique identifier */
  id: string;
  /** Type of insight */
  type: InsightType;
  /** Theme/category */
  theme: InsightTheme;
  /** Severity level */
  severity: InsightSeverity;
  /** Human-readable title */
  title: string;
  /** Detailed message explaining the insight */
  message: string;
  /** Supporting evidence for this insight */
  evidence: InsightEvidence[];
  /** Recommended actions to take */
  recommendedActions: InsightAction[];
  /** When this insight was generated */
  generatedAt: string;
  /** Timeframe for action */
  timeframe: InsightTimeframe;
  /** Confidence score 0-100 */
  confidence: number;
  /** Related lab slugs */
  relatedLabs?: string[];
  /** Metadata for tracking */
  metadata?: Record<string, unknown>;
}

export interface InsightEvidence {
  /** Type of evidence */
  type: 'metric' | 'comparison' | 'trend' | 'external';
  /** Label for the evidence */
  label: string;
  /** Current value */
  currentValue: string | number;
  /** Previous value (for comparisons) */
  previousValue?: string | number;
  /** Change percentage */
  changePercent?: number;
  /** Timeframe of comparison */
  comparisonPeriod?: string;
  /** Source of the data */
  source?: string;
}

export interface InsightAction {
  /** Action title */
  title: string;
  /** Action description */
  description: string;
  /** Effort level */
  effort: 'quick' | 'moderate' | 'significant';
  /** Link to take action */
  linkPath?: string;
  /** Lab slug if action is lab-specific */
  labSlug?: string;
}

// ============================================================================
// Weekly Digest Types
// ============================================================================

export interface WeeklyInsightDigest {
  /** Company ID */
  companyId: string;
  /** Week start date (ISO string) */
  weekStart: string;
  /** Week end date (ISO string) */
  weekEnd: string;
  /** Generated timestamp */
  generatedAt: string;
  /** Executive summary */
  summary: DigestSummary;
  /** All insights for the week */
  insights: Insight[];
  /** Grouped by theme */
  byTheme: Record<InsightTheme, Insight[]>;
  /** Top priority insights */
  topPriority: Insight[];
  /** Quick wins identified */
  quickWins: Insight[];
  /** Health trend */
  healthTrend: HealthTrend;
}

export interface DigestSummary {
  /** One-line headline */
  headline: string;
  /** Key stats for the week */
  keyStats: DigestStat[];
  /** Overall sentiment */
  sentiment: 'positive' | 'neutral' | 'concerning';
  /** Number of critical insights */
  criticalCount: number;
  /** Number of opportunities */
  opportunityCount: number;
}

export interface DigestStat {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface HealthTrend {
  /** Current overall score */
  currentScore: number | null;
  /** Previous week's score */
  previousScore: number | null;
  /** Change in score */
  change: number | null;
  /** Direction of movement */
  direction: 'improving' | 'declining' | 'stable' | 'unknown';
  /** Individual dimension trends */
  dimensions: DimensionTrend[];
}

export interface DimensionTrend {
  dimension: string;
  currentScore: number | null;
  previousScore: number | null;
  change: number | null;
  direction: 'improving' | 'declining' | 'stable' | 'unknown';
}

// ============================================================================
// Pattern Detection Types
// ============================================================================

export interface PatternMatch {
  /** Pattern identifier */
  patternId: string;
  /** Pattern name */
  patternName: string;
  /** Confidence of match 0-100 */
  confidence: number;
  /** Data points that matched - can be any shape of data */
  matchedData: unknown[];
  /** Suggested insight to generate */
  suggestedInsight: Partial<Insight>;
}

export interface ScoreHistory {
  date: string;
  overallScore: number | null;
  dimensions: Record<string, number | null>;
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface InsightEngineConfig {
  /** Minimum confidence threshold for insights */
  minConfidence: number;
  /** Score change threshold for regression/improvement alerts */
  scoreChangeThreshold: number;
  /** Days to consider data "stale" */
  staleDaysThreshold: number;
  /** Maximum insights per digest */
  maxInsightsPerDigest: number;
  /** Enable/disable specific insight types */
  enabledTypes: InsightType[];
}

export const DEFAULT_ENGINE_CONFIG: InsightEngineConfig = {
  minConfidence: 60,
  scoreChangeThreshold: 10,
  staleDaysThreshold: 30,
  maxInsightsPerDigest: 20,
  enabledTypes: [
    'score_regression',
    'score_improvement',
    'emerging_risk',
    'opportunity',
    'trend',
    'milestone',
    'stale_data',
  ],
};

// Score History for tracking (also exported for extractors)
export interface ScoreHistory {
  date: string;
  overallScore: number | null;
  dimensions: Record<string, number | null>;
}
