// lib/flowReadiness/adapters/competitionHealthAdapter.ts
// Adapter: Competition Health → FlowReadinessSignal
//
// Converts competition run status into the generic FlowReadinessSignal format.
// Competition is NEVER a blocking signal (no FAIL severity).

import type { FlowReadinessSignal, ReadinessSeverity } from '@/lib/types/flowReadiness';
import type {
  V4CompetitionHealthInfo,
  CompetitionConfidence,
  CompetitionHealthStatus,
} from '@/lib/types/contextV4Health';
import {
  COMPETITION_HEALTH_REASON_LABELS,
  COMPETITION_STALE_THRESHOLD_DAYS,
} from '@/lib/types/contextV4Health';
import type { CompetitionRunV3Payload, CompetitionV3ErrorType } from '@/lib/competition-v3/store';

// ============================================================================
// Constants
// ============================================================================

/** Signal ID for Competition Health */
export const COMPETITION_SIGNAL_ID = 'competition';

/** Signal label for Competition Health */
export const COMPETITION_SIGNAL_LABEL = 'Competitive Analysis';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for computing competition health
 */
export interface CompetitionHealthInput {
  /** Latest competition run if available */
  latestRun: CompetitionRunV3Payload | null;
  /** Company ID for CTAs */
  companyId: string;
}

/**
 * Competition reason codes
 */
export type CompetitionReasonCode =
  | 'COMPETITION_MISSING'
  | 'COMPETITION_LOW_CONFIDENCE'
  | 'COMPETITION_STALE'
  | 'COMPETITION_EMPTY';

// ============================================================================
// Health Computation
// ============================================================================

/**
 * Compute competition health info from a run
 */
export function computeCompetitionHealth(
  input: CompetitionHealthInput
): V4CompetitionHealthInfo {
  const { latestRun } = input;

  // No run exists
  if (!latestRun) {
    return {
      hasRun: false,
      status: 'unknown',
      confidence: 'missing',
      runId: null,
      runDate: null,
      hasLowConfidenceError: false,
      competitorCount: null,
      ageDays: null,
    };
  }

  // Check for LOW_CONFIDENCE_CONTEXT error
  const hasLowConfidenceError = latestRun.errorInfo?.type === 'LOW_CONFIDENCE_CONTEXT';

  // Calculate age in days
  const runDate = latestRun.createdAt;
  const ageDays = runDate
    ? Math.floor((Date.now() - new Date(runDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Determine confidence
  let confidence: CompetitionConfidence = 'high';
  if (hasLowConfidenceError) {
    confidence = 'low';
  } else if (!latestRun.competitors || latestRun.competitors.length === 0) {
    confidence = 'low';
  } else if (ageDays !== null && ageDays > COMPETITION_STALE_THRESHOLD_DAYS) {
    confidence = 'low';
  }

  // Determine status
  // Competition is NEVER blocking, so status is either healthy or warning
  let status: CompetitionHealthStatus = 'healthy';
  if (confidence === 'low' || hasLowConfidenceError) {
    status = 'warning';
  }

  return {
    hasRun: true,
    status,
    confidence,
    runId: latestRun.runId,
    runDate,
    hasLowConfidenceError,
    competitorCount: latestRun.competitors?.length ?? null,
    ageDays,
  };
}

// ============================================================================
// Adapter
// ============================================================================

/**
 * Convert competition health to FlowReadinessSignal.
 *
 * IMPORTANT: Competition NEVER produces FAIL severity.
 * It only produces PASS or WARN to avoid blocking strategy/programs.
 *
 * Mapping:
 * - healthy + high confidence → PASS
 * - warning OR low/missing confidence → WARN (never FAIL)
 *
 * CTAs (for WARN):
 * - "Improve Competitive Context" (primary) - links to Competition section
 */
export function competitionHealthToSignal(
  input: CompetitionHealthInput
): FlowReadinessSignal {
  const health = computeCompetitionHealth(input);
  const severity = mapToSeverity(health);
  const reasons = buildReasons(health);
  const ctas = buildCtas(input.companyId, health);
  const meta = buildMeta(health, input.latestRun);

  return {
    id: COMPETITION_SIGNAL_ID,
    label: COMPETITION_SIGNAL_LABEL,
    severity,
    reasons,
    ctas,
    meta,
  };
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map competition health to severity.
 * NEVER returns FAIL - competition is advisory only.
 */
function mapToSeverity(health: V4CompetitionHealthInfo): ReadinessSeverity {
  if (health.status === 'healthy' && health.confidence === 'high') {
    return 'PASS';
  }
  // All other states are warnings, not failures
  return 'WARN';
}

/**
 * Build reasons based on health state.
 */
function buildReasons(
  health: V4CompetitionHealthInfo
): FlowReadinessSignal['reasons'] {
  const reasons: FlowReadinessSignal['reasons'] = [];

  if (!health.hasRun) {
    reasons.push({
      code: 'COMPETITION_MISSING',
      label: COMPETITION_HEALTH_REASON_LABELS.COMPETITION_MISSING,
    });
    return reasons;
  }

  if (health.hasLowConfidenceError) {
    reasons.push({
      code: 'COMPETITION_LOW_CONFIDENCE',
      label: COMPETITION_HEALTH_REASON_LABELS.COMPETITION_LOW_CONFIDENCE,
    });
  }

  if (health.competitorCount === 0) {
    reasons.push({
      code: 'COMPETITION_EMPTY',
      label: COMPETITION_HEALTH_REASON_LABELS.COMPETITION_EMPTY,
    });
  }

  if (health.ageDays !== null && health.ageDays > COMPETITION_STALE_THRESHOLD_DAYS) {
    reasons.push({
      code: 'COMPETITION_STALE',
      label: COMPETITION_HEALTH_REASON_LABELS.COMPETITION_STALE,
    });
  }

  return reasons;
}

/**
 * Build CTAs for competition health issues.
 */
function buildCtas(
  companyId: string,
  health: V4CompetitionHealthInfo
): FlowReadinessSignal['ctas'] {
  // No CTAs for healthy state
  if (health.status === 'healthy' && health.confidence === 'high') {
    return undefined;
  }

  const competitionPath = `/c/${companyId}/context#competitive`;

  return [
    {
      label: 'Improve Competitive Context',
      href: competitionPath,
      priority: 'primary',
    },
    {
      label: 'Run Competition Analysis',
      onClickId: 'run-competition',
      priority: 'secondary',
    },
  ];
}

/**
 * Build metadata for debugging/display.
 */
function buildMeta(
  health: V4CompetitionHealthInfo,
  run: CompetitionRunV3Payload | null
): Record<string, unknown> {
  return {
    hasRun: health.hasRun,
    confidence: health.confidence,
    status: health.status,
    runId: health.runId,
    runDate: health.runDate,
    competitorCount: health.competitorCount,
    ageDays: health.ageDays,
    hasLowConfidenceError: health.hasLowConfidenceError,
    errorType: run?.errorInfo?.type || null,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if competition needs attention (is WARN severity).
 */
export function competitionNeedsAttention(
  input: CompetitionHealthInput
): boolean {
  const health = computeCompetitionHealth(input);
  return health.status !== 'healthy' || health.confidence !== 'high';
}

/**
 * Get competition confidence from a run.
 */
export function getCompetitionConfidence(
  run: CompetitionRunV3Payload | null
): CompetitionConfidence {
  const health = computeCompetitionHealth({ latestRun: run, companyId: '' });
  return health.confidence;
}

/**
 * Check if a run has LOW_CONFIDENCE_CONTEXT error.
 */
export function hasLowConfidenceError(
  run: CompetitionRunV3Payload | null
): boolean {
  return run?.errorInfo?.type === 'LOW_CONFIDENCE_CONTEXT';
}

export default competitionHealthToSignal;
