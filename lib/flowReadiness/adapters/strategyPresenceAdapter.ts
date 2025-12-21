// lib/flowReadiness/adapters/strategyPresenceAdapter.ts
// Adapter: Strategy Presence → FlowReadinessSignal
//
// Creates a signal based on whether a strategy exists and has content.

import type { FlowReadinessSignal, ReadinessSeverity } from '@/lib/types/flowReadiness';

// ============================================================================
// Constants
// ============================================================================

/** Signal ID for Strategy Presence */
export const STRATEGY_SIGNAL_ID = 'strategy';

/** Signal label for Strategy Presence */
export const STRATEGY_SIGNAL_LABEL = 'Strategy';

// ============================================================================
// Types
// ============================================================================

export interface StrategyPresenceInfo {
  /** Whether a strategy record exists */
  hasStrategy: boolean;
  /** Whether the strategy has objectives defined */
  hasObjectives?: boolean;
  /** Whether the strategy has bets defined */
  hasBets?: boolean;
  /** Company ID for CTA links */
  companyId: string;
}

// ============================================================================
// Adapter
// ============================================================================

/**
 * Convert strategy presence info to FlowReadinessSignal.
 *
 * Mapping:
 * - hasStrategy && (hasObjectives || hasBets) → PASS
 * - !hasStrategy → WARN (strategy missing)
 */
export function strategyPresenceToSignal(
  info: StrategyPresenceInfo
): FlowReadinessSignal {
  const hasContent = info.hasObjectives || info.hasBets;
  const severity: ReadinessSeverity = info.hasStrategy && hasContent ? 'PASS' : 'WARN';

  const reasons: FlowReadinessSignal['reasons'] = [];

  if (!info.hasStrategy) {
    reasons.push({
      code: 'NO_STRATEGY',
      label: 'No strategy has been created yet',
    });
  } else if (!hasContent) {
    reasons.push({
      code: 'STRATEGY_EMPTY',
      label: 'Strategy exists but has no objectives or bets',
    });
  }

  const ctas: FlowReadinessSignal['ctas'] = severity !== 'PASS' ? [
    {
      label: 'Create Strategy',
      href: `/c/${info.companyId}/strategy`,
      priority: 'primary',
    },
  ] : undefined;

  return {
    id: STRATEGY_SIGNAL_ID,
    label: STRATEGY_SIGNAL_LABEL,
    severity,
    reasons,
    ctas,
    meta: {
      companyId: info.companyId,
      hasStrategy: info.hasStrategy,
      hasObjectives: info.hasObjectives,
      hasBets: info.hasBets,
    },
  };
}

export default strategyPresenceToSignal;
