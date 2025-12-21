// lib/flowReadiness/adapters/contextV4HealthAdapter.ts
// Adapter: Context V4 Health → FlowReadinessSignal
//
// Converts V4HealthResponse into the generic FlowReadinessSignal format.

import type { V4HealthResponse, V4HealthStatus, V4HealthReason } from '@/lib/types/contextV4Health';
import { V4_HEALTH_REASON_LABELS } from '@/lib/types/contextV4Health';
import type { FlowReadinessSignal, ReadinessSeverity } from '@/lib/types/flowReadiness';

// ============================================================================
// Constants
// ============================================================================

/** Signal ID for Context V4 Health */
export const CONTEXT_V4_SIGNAL_ID = 'context-v4';

/** Signal label for Context V4 Health */
export const CONTEXT_V4_SIGNAL_LABEL = 'Context Baseline';

// ============================================================================
// Adapter
// ============================================================================

/**
 * Convert V4HealthResponse to FlowReadinessSignal.
 *
 * Mapping:
 * - health.status === "GREEN" → severity PASS
 * - health.status === "YELLOW" → severity WARN
 * - health.status === "RED" → severity FAIL
 *
 * CTAs (for YELLOW/RED):
 * - Review Context Baseline (primary)
 * - Re-trigger Proposal (secondary, onClickId="retrigger-proposal")
 * - Inspector (secondary)
 */
export function contextV4HealthToSignal(
  health: V4HealthResponse
): FlowReadinessSignal {
  const severity = mapStatusToSeverity(health.status);
  const reasons = mapReasons(health.reasons);
  const ctas = buildCtas(health);
  const meta = buildMeta(health);

  return {
    id: CONTEXT_V4_SIGNAL_ID,
    label: CONTEXT_V4_SIGNAL_LABEL,
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
 * Map V4HealthStatus to ReadinessSeverity.
 */
function mapStatusToSeverity(status: V4HealthStatus): ReadinessSeverity {
  switch (status) {
    case 'GREEN':
      return 'PASS';
    case 'YELLOW':
      return 'WARN';
    case 'RED':
      return 'FAIL';
    default:
      return 'WARN';
  }
}

/**
 * Map V4HealthReason[] to signal reasons.
 */
function mapReasons(
  healthReasons: V4HealthReason[]
): FlowReadinessSignal['reasons'] {
  return healthReasons.map((reason) => ({
    code: reason,
    label: V4_HEALTH_REASON_LABELS[reason] || reason,
  }));
}

/**
 * Build CTAs based on health status.
 */
function buildCtas(health: V4HealthResponse): FlowReadinessSignal['ctas'] {
  // No CTAs for healthy state
  if (health.status === 'GREEN') {
    return undefined;
  }

  const reviewPath = `/context-v4/${health.companyId}/review`;
  const inspectorPath = health.links.inspectorPath.startsWith('/api')
    ? health.links.inspectorPath
    : `/api/os/companies/${health.companyId}/context/v4/inspect`;

  return [
    {
      label: health.status === 'RED' ? 'Fix Baseline' : 'Review Context Baseline',
      href: reviewPath,
      priority: 'primary',
    },
    {
      label: 'Re-trigger Proposal',
      onClickId: 'retrigger-proposal',
      priority: 'secondary',
    },
    {
      label: 'Inspector',
      href: inspectorPath,
      priority: 'secondary',
    },
  ];
}

/**
 * Build optional metadata for debugging/display.
 */
function buildMeta(health: V4HealthResponse): Record<string, unknown> {
  return {
    companyId: health.companyId,
    timestamp: health.timestamp,
    healthVersion: health.healthVersion,
    websiteLab: {
      hasRun: health.websiteLab.hasRun,
      ageMinutes: health.websiteLab.ageMinutes,
      staleThresholdMinutes: health.websiteLab.staleThresholdMinutes,
    },
    store: health.store,
    flags: health.flags,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a V4HealthResponse needs attention.
 */
export function needsAttention(health: V4HealthResponse): boolean {
  return health.status !== 'GREEN';
}

/**
 * Get the primary CTA label for a health status.
 */
export function getPrimaryCtaLabel(status: V4HealthStatus): string {
  return status === 'RED' ? 'Fix Baseline' : 'Review Context Baseline';
}

export default contextV4HealthToSignal;
