// lib/types/flowReadiness.ts
// Multi-signal Flow Readiness Types
//
// Generic readiness model that supports multiple signals combined into
// a single GREEN/YELLOW/RED outcome with ranked reasons and clear next actions.
//
// Initially wired with Context V4 Health, extensible to:
// - GAP IA readiness
// - BrandLab readiness
// - Strategy freshness
// - ContentLab readiness

// ============================================================================
// Severity
// ============================================================================

/**
 * Severity level for a readiness signal.
 * - PASS: No issues, contributes to GREEN
 * - WARN: Issues that don't block, contributes to YELLOW
 * - FAIL: Blocking issues, contributes to RED
 */
export type ReadinessSeverity = 'PASS' | 'WARN' | 'FAIL';

// ============================================================================
// Signal
// ============================================================================

/**
 * A single readiness signal from a specific source.
 */
export interface FlowReadinessSignal {
  /** Stable identifier, e.g. "context-v4", "gap-ia", "strategy" */
  id: string;
  /** Human-readable label, e.g. "Context Baseline" */
  label: string;
  /** Overall severity of this signal */
  severity: ReadinessSeverity;
  /** Specific reasons for this signal's severity */
  reasons: {
    /** Stable machine code, e.g. "NO_WEBSITELAB_RUN" */
    code: string;
    /** Human-readable label */
    label: string;
  }[];
  /** Optional CTAs for resolving issues */
  ctas?: {
    /** Button/link label */
    label: string;
    /** URL for link CTAs */
    href?: string;
    /** Handler ID for button CTAs, maps to UI handlers */
    onClickId?: string;
    /** Priority for ordering/styling */
    priority?: 'primary' | 'secondary';
  }[];
  /** Optional metadata for debugging/display */
  meta?: Record<string, unknown>;
}

// ============================================================================
// Resolved Status
// ============================================================================

/**
 * Overall flow readiness status (traffic light).
 */
export type FlowReadinessStatus = 'GREEN' | 'YELLOW' | 'RED';

/**
 * A ranked reason from a specific signal.
 */
export interface RankedReason {
  /** Which signal this reason came from */
  signalId: string;
  /** Stable machine code */
  code: string;
  /** Human-readable label */
  label: string;
  /** Severity of this specific reason */
  severity: ReadinessSeverity;
}

/**
 * Recommended action to resolve the most critical issue.
 */
export interface RecommendedAction {
  /** Button/link label */
  label: string;
  /** Which signal this action addresses */
  signalId: string;
  /** Handler ID for button CTAs */
  onClickId?: string;
  /** URL for link CTAs */
  href?: string;
}

/**
 * Competition awareness metadata for strategy
 */
export interface CompetitionAwareness {
  /** Whether strategy is informed by competition data */
  competitionInformed: boolean;
  /** Confidence level of competition data */
  competitionConfidence: 'high' | 'low' | 'missing';
  /** Human-readable summary of competition state */
  competitionSummary: string | null;
}

/**
 * Fully resolved flow readiness combining multiple signals.
 */
export interface FlowReadinessResolved {
  /** Schema version for forward compatibility */
  version: 1;
  /** Overall status (worst of all signals) */
  status: FlowReadinessStatus;
  /** All input signals */
  signals: FlowReadinessSignal[];
  /** All reasons ranked by severity (FAIL > WARN > PASS) */
  rankedReasons: RankedReason[];
  /** Best action to take first */
  recommendedAction?: RecommendedAction;
  /** Competition awareness for strategy (optional, for strategy flows) */
  competitionAwareness?: CompetitionAwareness;
}

// ============================================================================
// Helper Maps
// ============================================================================

/**
 * Severity to status mapping.
 */
export const SEVERITY_TO_STATUS: Record<ReadinessSeverity, FlowReadinessStatus> = {
  PASS: 'GREEN',
  WARN: 'YELLOW',
  FAIL: 'RED',
};

/**
 * Status priority for comparison (higher = worse).
 */
export const STATUS_PRIORITY: Record<FlowReadinessStatus, number> = {
  GREEN: 0,
  YELLOW: 1,
  RED: 2,
};

/**
 * Severity priority for sorting (higher = worse).
 */
export const SEVERITY_PRIORITY: Record<ReadinessSeverity, number> = {
  PASS: 0,
  WARN: 1,
  FAIL: 2,
};

/**
 * Severity to color class mapping (for UI).
 */
export const SEVERITY_COLORS: Record<ReadinessSeverity, {
  bg: string;
  border: string;
  text: string;
  dot: string;
}> = {
  PASS: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  WARN: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  FAIL: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
};

/**
 * Status to color class mapping (for UI).
 */
export const STATUS_COLORS: Record<FlowReadinessStatus, {
  bg: string;
  border: string;
  text: string;
  dot: string;
}> = {
  GREEN: SEVERITY_COLORS.PASS,
  YELLOW: SEVERITY_COLORS.WARN,
  RED: SEVERITY_COLORS.FAIL,
};

/**
 * Status labels for display.
 */
export const STATUS_LABELS: Record<FlowReadinessStatus, string> = {
  GREEN: 'Ready',
  YELLOW: 'Needs Attention',
  RED: 'Blocked',
};
