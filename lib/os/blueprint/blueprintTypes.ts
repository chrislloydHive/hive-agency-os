// lib/os/blueprint/blueprintTypes.ts
// Types for the Blueprint v2 Strategic Layer
// Provides completion tracking, drift detection, and industry benchmarking

// ============================================================================
// Core Blueprint Types
// ============================================================================

export type BlueprintPhase =
  | 'foundation'     // Getting basics right
  | 'optimization'   // Improving performance
  | 'growth'         // Scaling and expanding
  | 'excellence';    // Industry-leading

export type BlueprintStatus =
  | 'not_started'
  | 'in_progress'
  | 'on_track'
  | 'at_risk'
  | 'completed'
  | 'regressed';

export type DriftDirection = 'positive' | 'negative' | 'neutral';

export type DriftSeverity = 'critical' | 'warning' | 'minor' | 'none';

// ============================================================================
// Blueprint Definition
// ============================================================================

export interface Blueprint {
  /** Company ID */
  companyId: string;
  /** Blueprint version */
  version: string;
  /** Created date */
  createdAt: string;
  /** Last updated */
  updatedAt: string;
  /** Current phase */
  currentPhase: BlueprintPhase;
  /** Overall status */
  status: BlueprintStatus;
  /** Overall completion percentage */
  completionPercent: number;
  /** Target completion date */
  targetDate?: string;
  /** Dimensions/pillars of the blueprint */
  dimensions: BlueprintDimension[];
  /** Milestones */
  milestones: BlueprintMilestone[];
  /** Active goals */
  goals: BlueprintGoal[];
}

export interface BlueprintDimension {
  /** Dimension ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Related lab slug */
  labSlug?: string;
  /** Current score */
  currentScore: number | null;
  /** Target score */
  targetScore: number;
  /** Completion percentage */
  completionPercent: number;
  /** Status */
  status: BlueprintStatus;
  /** Weight in overall calculation */
  weight: number;
  /** Tasks/items in this dimension */
  items: BlueprintItem[];
}

export interface BlueprintItem {
  /** Item ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Is completed */
  completed: boolean;
  /** Completion date */
  completedAt?: string;
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Associated finding ID if any */
  findingId?: string;
  /** Effort level */
  effort: 'quick' | 'moderate' | 'significant';
}

export interface BlueprintMilestone {
  /** Milestone ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Target date */
  targetDate: string;
  /** Is achieved */
  achieved: boolean;
  /** Achievement date */
  achievedAt?: string;
  /** Required score threshold */
  scoreThreshold?: number;
  /** Required phase */
  requiredPhase?: BlueprintPhase;
}

export interface BlueprintGoal {
  /** Goal ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Dimension this goal relates to */
  dimensionId: string;
  /** Target metric */
  targetMetric: string;
  /** Current value */
  currentValue: number | null;
  /** Target value */
  targetValue: number;
  /** Progress percentage */
  progress: number;
  /** Deadline */
  deadline?: string;
}

// ============================================================================
// Drift Detection Types
// ============================================================================

export interface DriftAnalysis {
  /** Company ID */
  companyId: string;
  /** Analysis timestamp */
  analyzedAt: string;
  /** Overall drift severity */
  overallSeverity: DriftSeverity;
  /** Has significant drift */
  hasSignificantDrift: boolean;
  /** Dimension drifts */
  dimensionDrifts: DimensionDrift[];
  /** Recommended corrective actions */
  correctiveActions: CorrectiveAction[];
  /** Time since last check */
  daysSinceLastCheck: number;
}

export interface DimensionDrift {
  /** Dimension ID */
  dimensionId: string;
  /** Dimension name */
  dimensionName: string;
  /** Drift direction */
  direction: DriftDirection;
  /** Drift severity */
  severity: DriftSeverity;
  /** Score change */
  scoreChange: number;
  /** Percentage change */
  percentChange: number;
  /** Previous score */
  previousScore: number;
  /** Current score */
  currentScore: number;
  /** Contributing factors */
  factors: string[];
}

export interface CorrectiveAction {
  /** Action ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Related dimension */
  dimensionId: string;
  /** Priority */
  priority: 'immediate' | 'soon' | 'when_possible';
  /** Expected impact */
  expectedImpact: string;
  /** Link to take action */
  actionLink?: string;
}

// ============================================================================
// Industry Benchmark Types
// ============================================================================

export interface IndustryBenchmark {
  /** Industry identifier */
  industryId: string;
  /** Industry name */
  industryName: string;
  /** Number of companies in benchmark */
  sampleSize: number;
  /** Last updated */
  updatedAt: string;
  /** Benchmark data by dimension */
  dimensions: DimensionBenchmark[];
  /** Percentile thresholds */
  percentiles: PercentileThresholds;
}

export interface DimensionBenchmark {
  /** Dimension name */
  dimension: string;
  /** Average score */
  average: number;
  /** Median score */
  median: number;
  /** Top 10% threshold */
  top10Percent: number;
  /** Top 25% threshold */
  top25Percent: number;
  /** Bottom 25% threshold */
  bottom25Percent: number;
}

export interface PercentileThresholds {
  excellent: number;  // 90th percentile
  good: number;       // 75th percentile
  average: number;    // 50th percentile
  belowAverage: number; // 25th percentile
}

export interface CompanyBenchmarkPosition {
  /** Company ID */
  companyId: string;
  /** Industry being compared to */
  industryId: string;
  /** Overall percentile rank */
  overallPercentile: number;
  /** Position label */
  positionLabel: 'excellent' | 'good' | 'average' | 'below_average' | 'needs_improvement';
  /** Score vs industry average */
  vsAverage: number;
  /** By dimension */
  byDimension: DimensionPosition[];
  /** Comparison date */
  comparedAt: string;
}

export interface DimensionPosition {
  dimension: string;
  score: number | null;
  percentile: number;
  vsAverage: number;
  positionLabel: string;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

export interface ProgressSnapshot {
  /** Snapshot date */
  date: string;
  /** Overall completion */
  completionPercent: number;
  /** Overall score */
  overallScore: number | null;
  /** By dimension */
  dimensions: {
    id: string;
    completion: number;
    score: number | null;
  }[];
  /** Items completed this period */
  itemsCompleted: number;
  /** Milestones achieved */
  milestonesAchieved: string[];
}

export interface ProgressTrend {
  /** Period label */
  period: string;
  /** Data points */
  snapshots: ProgressSnapshot[];
  /** Velocity (items per week) */
  velocity: number;
  /** Projected completion date */
  projectedCompletion?: string;
  /** On track status */
  onTrack: boolean;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_DIMENSIONS: Omit<BlueprintDimension, 'currentScore' | 'completionPercent' | 'status' | 'items'>[] = [
  {
    id: 'technical',
    name: 'Technical Foundation',
    description: 'Website performance, security, and technical health',
    labSlug: 'website',
    targetScore: 80,
    weight: 0.2,
  },
  {
    id: 'visibility',
    name: 'Search Visibility',
    description: 'SEO, rankings, and organic search presence',
    labSlug: 'rankings',
    targetScore: 75,
    weight: 0.2,
  },
  {
    id: 'brand',
    name: 'Brand Consistency',
    description: 'Brand presence and consistency across channels',
    labSlug: 'brand',
    targetScore: 80,
    weight: 0.15,
  },
  {
    id: 'content',
    name: 'Content Quality',
    description: 'Website content effectiveness and engagement',
    labSlug: 'content',
    targetScore: 75,
    weight: 0.15,
  },
  {
    id: 'local',
    name: 'Local Presence',
    description: 'Google Business Profile and local search',
    labSlug: 'gbp',
    targetScore: 85,
    weight: 0.15,
  },
  {
    id: 'social',
    name: 'Social Engagement',
    description: 'Social media presence and engagement',
    labSlug: 'social',
    targetScore: 70,
    weight: 0.15,
  },
];

export const PHASE_THRESHOLDS: Record<BlueprintPhase, { min: number; max: number }> = {
  foundation: { min: 0, max: 40 },
  optimization: { min: 40, max: 65 },
  growth: { min: 65, max: 85 },
  excellence: { min: 85, max: 100 },
};

// Default industry benchmarks (generic)
export const DEFAULT_BENCHMARKS: IndustryBenchmark = {
  industryId: 'general',
  industryName: 'All Industries',
  sampleSize: 1000,
  updatedAt: new Date().toISOString(),
  dimensions: [
    { dimension: 'technical', average: 62, median: 60, top10Percent: 85, top25Percent: 75, bottom25Percent: 45 },
    { dimension: 'visibility', average: 55, median: 52, top10Percent: 80, top25Percent: 70, bottom25Percent: 38 },
    { dimension: 'brand', average: 58, median: 55, top10Percent: 82, top25Percent: 72, bottom25Percent: 42 },
    { dimension: 'content', average: 52, median: 50, top10Percent: 78, top25Percent: 68, bottom25Percent: 35 },
    { dimension: 'local', average: 60, median: 58, top10Percent: 88, top25Percent: 78, bottom25Percent: 40 },
    { dimension: 'social', average: 48, median: 45, top10Percent: 75, top25Percent: 65, bottom25Percent: 30 },
  ],
  percentiles: {
    excellent: 85,
    good: 70,
    average: 55,
    belowAverage: 40,
  },
};
