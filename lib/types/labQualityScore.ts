// lib/types/labQualityScore.ts
// Lab Quality Score (LQS) Types
//
// Quantifies the quality of lab outputs using objective criteria.
// Used for diagnostics and observability only - does NOT affect
// pricing, scope, or facts logic.

import type { LabKey } from './labSummary';

// ============================================================================
// Quality Band Classification
// ============================================================================

/**
 * Quality band based on composite score
 */
export type QualityBand = 'Excellent' | 'Good' | 'Weak' | 'Poor';

/**
 * Quality band thresholds
 */
export const QUALITY_BAND_THRESHOLDS = {
  Excellent: 85,
  Good: 70,
  Weak: 50,
  Poor: 0,
} as const;

/**
 * Get quality band from score
 */
export function getQualityBand(score: number): QualityBand {
  if (score >= QUALITY_BAND_THRESHOLDS.Excellent) return 'Excellent';
  if (score >= QUALITY_BAND_THRESHOLDS.Good) return 'Good';
  if (score >= QUALITY_BAND_THRESHOLDS.Weak) return 'Weak';
  return 'Poor';
}

// ============================================================================
// Individual Metric Types
// ============================================================================

/**
 * Result of a single metric calculation
 */
export interface MetricResult {
  /** Metric identifier */
  metricId: string;

  /** Human-readable metric name */
  name: string;

  /** Score from 0-100 */
  score: number;

  /** Whether metric passes its threshold */
  passed: boolean;

  /** The threshold used for pass/fail */
  threshold: number;

  /** Detailed breakdown */
  details: {
    /** Numerator for ratio-based metrics */
    numerator?: number;
    /** Denominator for ratio-based metrics */
    denominator?: number;
    /** Specific issues found */
    issues?: string[];
    /** Additional context */
    context?: string;
  };
}

/**
 * Metric identifiers
 */
export type MetricId =
  | 'evidenceAnchoring'
  | 'specificity'
  | 'deduplicatedSignalDensity'
  | 'personaDiagnosticQuality'
  | 'recommendationTraceability';

// ============================================================================
// Metric Thresholds & Weights
// ============================================================================

/**
 * Default thresholds for each metric (pass/fail boundary)
 */
export const METRIC_THRESHOLDS: Record<MetricId, number> = {
  evidenceAnchoring: 80,
  specificity: 70,
  deduplicatedSignalDensity: 70,
  personaDiagnosticQuality: 75,
  recommendationTraceability: 70,
};

/**
 * Default weights for composite score calculation
 * Total must sum to 100
 */
export const DEFAULT_METRIC_WEIGHTS: Record<MetricId, number> = {
  evidenceAnchoring: 30,
  specificity: 25,
  deduplicatedSignalDensity: 15,
  personaDiagnosticQuality: 20,
  recommendationTraceability: 10,
};

/**
 * Weights when persona diagnostics is not applicable (non-Website Lab)
 * Redistributes personaDiagnosticQuality weight to other metrics
 */
export const NON_WEBSITE_LAB_WEIGHTS: Record<Exclude<MetricId, 'personaDiagnosticQuality'>, number> = {
  evidenceAnchoring: 37.5, // 30 + (20 * 0.375)
  specificity: 31.25,      // 25 + (20 * 0.3125)
  deduplicatedSignalDensity: 18.75, // 15 + (20 * 0.1875)
  recommendationTraceability: 12.5, // 10 + (20 * 0.125)
};

// ============================================================================
// Generic Phrase Detection
// ============================================================================

/**
 * Banned generic phrases that reduce specificity score
 * These indicate low-quality, non-actionable findings
 */
export const GENERIC_PHRASES = [
  'improve ux',
  'improve user experience',
  'strengthen funnel',
  'strengthen the funnel',
  'clarify value proposition',
  'clarify the value proposition',
  'improve conversion',
  'increase conversions',
  'better messaging',
  'improve messaging',
  'optimize for mobile',
  'improve mobile experience',
  'add social proof',
  'more social proof',
  'clearer cta',
  'improve cta',
  'better call to action',
  'reduce friction',
  'simplify the process',
  'make it easier',
  'more engaging',
  'be more specific',
  'add more detail',
  'improve clarity',
  'enhance credibility',
  'build trust',
  'improve trust',
  'better design',
  'update design',
  'modernize design',
  'refresh branding',
  'improve branding',
  'optimize performance',
  'improve performance',
  'speed up',
  'make faster',
  'improve seo',
  'better seo',
  'optimize for search',
  'improve rankings',
  'increase visibility',
  'reach more customers',
  'grow audience',
  'expand reach',
] as const;

// ============================================================================
// Lab Quality Score (Composite)
// ============================================================================

/**
 * Complete Lab Quality Score for a single lab run
 */
export interface LabQualityScore {
  /** Unique score ID */
  id: string;

  /** Company this score belongs to */
  companyId: string;

  /** Lab type */
  labKey: LabKey;

  /** Run ID from diagnostic runs table */
  runId: string;

  /** When this score was computed */
  computedAt: string;

  /** Composite score (0-100) */
  score: number;

  /** Quality band classification */
  qualityBand: QualityBand;

  /** Individual metric results */
  metrics: {
    evidenceAnchoring: MetricResult;
    specificity: MetricResult;
    deduplicatedSignalDensity: MetricResult;
    personaDiagnosticQuality?: MetricResult; // Only for websiteLab
    recommendationTraceability: MetricResult;
  };

  /** Weights used for this calculation */
  weights: Partial<Record<MetricId, number>>;

  /** Summary warnings for UI */
  warnings: QualityWarning[];

  /** Regression info vs previous run */
  regression?: RegressionInfo;
}

/**
 * Quality warning for display in UI
 */
export interface QualityWarning {
  /** Warning type */
  type: 'generic_findings' | 'low_evidence' | 'high_duplication' | 'weak_personas' | 'orphan_recommendations';

  /** Human-readable message */
  message: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Related metric */
  metricId: MetricId;
}

/**
 * Regression information
 */
export interface RegressionInfo {
  /** Whether this is a regression */
  isRegression: boolean;

  /** Point difference from previous score */
  pointDifference: number;

  /** Previous score */
  previousScore: number;

  /** Previous run ID */
  previousRunId: string;

  /** Previous run timestamp */
  previousRunAt: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from /api/os/companies/[companyId]/labs/quality
 */
export interface LabQualityResponse {
  ok: boolean;
  companyId: string;

  /** Current quality scores per lab */
  current: Record<LabKey, LabQualityScore | null>;

  /** Historical scores (most recent first, max 10 per lab) */
  history: Record<LabKey, LabQualityScore[]>;

  /** Any labs with regressions */
  regressions: LabKey[];

  /** Summary stats */
  summary: {
    averageScore: number;
    lowestLab: LabKey | null;
    highestLab: LabKey | null;
    labsWithWarnings: LabKey[];
  };

  /** Error if any */
  error?: string;
}

/**
 * Quality score inline in lab summary (abbreviated)
 */
export interface LabQualityInline {
  /** Composite score */
  score: number;

  /** Quality band */
  qualityBand: QualityBand;

  /** Whether there are warnings */
  hasWarnings: boolean;

  /** Warning count */
  warningCount: number;

  /** Regression indicator */
  regression?: {
    isRegression: boolean;
    pointDifference: number;
  };
}

// ============================================================================
// Computation Input Types
// ============================================================================

/**
 * Raw data needed to compute quality score for a lab run
 */
export interface LabQualityInput {
  /** Lab type */
  labKey: LabKey;

  /** Run ID */
  runId: string;

  /** Company ID */
  companyId: string;

  /** All findings from this run */
  findings: QualityFinding[];

  /** All recommendations from this run */
  recommendations: QualityRecommendation[];

  /** Persona journeys (Website Lab only) */
  personaJourneys?: PersonaJourney[];

  /** Previous quality score for regression detection */
  previousScore?: LabQualityScore;
}

/**
 * Finding data for quality scoring
 */
export interface QualityFinding {
  /** Finding ID */
  id: string;

  /** Finding text */
  text: string;

  /** Page URL if available */
  pageUrl?: string;

  /** Selector/location if available */
  selector?: string;

  /** Quoted text evidence if available */
  quotedText?: string;

  /** Specific page or competitor reference */
  specificReference?: string;

  /** Canonical hash for deduplication */
  canonicalHash: string;
}

/**
 * Recommendation data for quality scoring
 */
export interface QualityRecommendation {
  /** Recommendation ID */
  id: string;

  /** Recommendation text */
  text: string;

  /** Linked finding ID (for traceability) */
  linkedFindingId?: string;
}

/**
 * Persona journey data (Website Lab only)
 */
export interface PersonaJourney {
  /** Persona name */
  personaName: string;

  /** Journey goal (required for quality) */
  goal?: string;

  /** Explicit failure point page */
  failurePointPage?: string;

  /** Failure reason */
  failureReason?: string;

  /** Whether journey has clear goal */
  hasClearGoal: boolean;

  /** Whether journey has explicit failure point */
  hasExplicitFailurePoint: boolean;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Lab Quality Score record for persistence
 * Stored in Airtable or JSON file
 */
export interface LabQualityScoreRecord {
  /** Record ID (Airtable) */
  id?: string;

  /** Company ID */
  companyId: string;

  /** Lab key */
  labKey: LabKey;

  /** Run ID */
  runId: string;

  /** When computed (ISO timestamp) */
  computedAt: string;

  /** Composite score */
  score: number;

  /** Quality band */
  qualityBand: QualityBand;

  /** JSON-serialized metrics */
  metricsJson: string;

  /** JSON-serialized warnings */
  warningsJson: string;

  /** JSON-serialized weights */
  weightsJson: string;

  /** Regression point difference (null if no regression) */
  regressionDiff: number | null;

  /** Previous run ID (for regression tracking) */
  previousRunId: string | null;
}

// ============================================================================
// UI Helper Types
// ============================================================================

/**
 * Quality badge display configuration
 */
export interface QualityBadgeConfig {
  band: QualityBand;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'check' | 'alert' | 'warning' | 'error';
}

/**
 * Quality badge configurations by band
 */
export const QUALITY_BADGE_CONFIGS: Record<QualityBand, QualityBadgeConfig> = {
  Excellent: {
    band: 'Excellent',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check',
  },
  Good: {
    band: 'Good',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: 'check',
  },
  Weak: {
    band: 'Weak',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: 'warning',
  },
  Poor: {
    band: 'Poor',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'error',
  },
};

/**
 * Metric display names
 */
export const METRIC_DISPLAY_NAMES: Record<MetricId, string> = {
  evidenceAnchoring: 'Evidence Anchoring',
  specificity: 'Specificity',
  deduplicatedSignalDensity: 'Signal Density',
  personaDiagnosticQuality: 'Persona Diagnostics',
  recommendationTraceability: 'Recommendation Traceability',
};
