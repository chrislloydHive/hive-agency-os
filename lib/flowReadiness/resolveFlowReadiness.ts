// lib/flowReadiness/resolveFlowReadiness.ts
// Flow Readiness Resolver
//
// Composes multiple signals into a single resolved readiness outcome.
// Determines overall status, ranks reasons, and selects recommended action.

import type {
  FlowReadinessSignal,
  FlowReadinessResolved,
  FlowReadinessStatus,
  RankedReason,
  RecommendedAction,
  ReadinessSeverity,
} from '@/lib/types/flowReadiness';
import {
  SEVERITY_PRIORITY,
  STATUS_PRIORITY,
  SEVERITY_TO_STATUS,
} from '@/lib/types/flowReadiness';

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve multiple readiness signals into a single outcome.
 *
 * Rules:
 * - If any signal has FAIL → overall RED
 * - Else if any signal has WARN → overall YELLOW
 * - Else → GREEN
 *
 * rankedReasons:
 * - FAIL reasons first, then WARN, then PASS
 * - Preserve original signal order within same severity
 *
 * recommendedAction:
 * - Prefer first FAIL signal with a primary CTA
 * - Else first WARN signal with a primary CTA
 * - Else undefined
 */
export function resolveFlowReadiness(
  signals: FlowReadinessSignal[]
): FlowReadinessResolved {
  // Determine overall status (worst wins)
  const status = computeOverallStatus(signals);

  // Rank all reasons by severity
  const rankedReasons = rankReasons(signals);

  // Find recommended action
  const recommendedAction = findRecommendedAction(signals);

  return {
    version: 1,
    status,
    signals,
    rankedReasons,
    recommendedAction,
  };
}

// ============================================================================
// Status Computation
// ============================================================================

/**
 * Compute overall status from signals.
 * Worst severity wins: FAIL → RED, WARN → YELLOW, PASS → GREEN
 */
function computeOverallStatus(signals: FlowReadinessSignal[]): FlowReadinessStatus {
  if (signals.length === 0) {
    return 'GREEN';
  }

  // Find worst severity
  let worstPriority = 0;
  for (const signal of signals) {
    const priority = SEVERITY_PRIORITY[signal.severity];
    if (priority > worstPriority) {
      worstPriority = priority;
    }
  }

  // Map priority back to status
  if (worstPriority >= SEVERITY_PRIORITY.FAIL) {
    return 'RED';
  }
  if (worstPriority >= SEVERITY_PRIORITY.WARN) {
    return 'YELLOW';
  }
  return 'GREEN';
}

// ============================================================================
// Reason Ranking
// ============================================================================

/**
 * Rank all reasons from all signals by severity.
 * FAIL reasons first, then WARN, then PASS.
 * Within same severity, preserve signal order.
 */
function rankReasons(signals: FlowReadinessSignal[]): RankedReason[] {
  const allReasons: RankedReason[] = [];

  // Collect all reasons with their signal info
  for (const signal of signals) {
    for (const reason of signal.reasons) {
      allReasons.push({
        signalId: signal.id,
        code: reason.code,
        label: reason.label,
        severity: signal.severity,
      });
    }
  }

  // Sort by severity priority (FAIL first, then WARN, then PASS)
  // Stable sort preserves original order within same severity
  return allReasons.sort((a, b) => {
    return SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity];
  });
}

// ============================================================================
// Recommended Action
// ============================================================================

/**
 * Find the recommended action to take first.
 * Priority:
 * 1. First FAIL signal with a primary CTA
 * 2. First WARN signal with a primary CTA
 * 3. undefined
 */
function findRecommendedAction(
  signals: FlowReadinessSignal[]
): RecommendedAction | undefined {
  // Sort signals by severity (FAIL first)
  const sortedSignals = [...signals].sort((a, b) => {
    return SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity];
  });

  // Find first signal with a primary CTA
  for (const signal of sortedSignals) {
    // Skip PASS signals - they don't need action
    if (signal.severity === 'PASS') {
      continue;
    }

    const primaryCta = signal.ctas?.find((cta) => cta.priority === 'primary');
    if (primaryCta) {
      return {
        label: primaryCta.label,
        signalId: signal.id,
        onClickId: primaryCta.onClickId,
        href: primaryCta.href,
      };
    }

    // If no primary CTA, try first available CTA
    const firstCta = signal.ctas?.[0];
    if (firstCta) {
      return {
        label: firstCta.label,
        signalId: signal.id,
        onClickId: firstCta.onClickId,
        href: firstCta.href,
      };
    }
  }

  return undefined;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a resolved readiness has any actionable issues.
 */
export function hasActionableIssues(resolved: FlowReadinessResolved): boolean {
  return resolved.status !== 'GREEN';
}

/**
 * Get the worst signal from a resolved readiness.
 */
export function getWorstSignal(
  resolved: FlowReadinessResolved
): FlowReadinessSignal | undefined {
  return resolved.signals.find(
    (s) => SEVERITY_TO_STATUS[s.severity] === resolved.status
  );
}

/**
 * Get all CTAs from all signals, deduplicated by label.
 */
export function getAllCtas(
  resolved: FlowReadinessResolved
): Array<{ label: string; href?: string; onClickId?: string; signalId: string }> {
  const seen = new Set<string>();
  const ctas: Array<{ label: string; href?: string; onClickId?: string; signalId: string }> = [];

  for (const signal of resolved.signals) {
    // Skip PASS signals
    if (signal.severity === 'PASS') continue;

    for (const cta of signal.ctas || []) {
      if (!seen.has(cta.label)) {
        seen.add(cta.label);
        ctas.push({
          label: cta.label,
          href: cta.href,
          onClickId: cta.onClickId,
          signalId: signal.id,
        });
      }
    }
  }

  return ctas;
}

export default resolveFlowReadiness;
