// lib/flowReadiness/index.ts
// Flow Readiness Module
//
// Exports the resolver and adapters for multi-signal flow readiness.

export { resolveFlowReadiness, hasActionableIssues, getWorstSignal, getAllCtas } from './resolveFlowReadiness';
export { contextV4HealthToSignal, CONTEXT_V4_SIGNAL_ID, CONTEXT_V4_SIGNAL_LABEL, needsAttention } from './adapters/contextV4HealthAdapter';
export { strategyPresenceToSignal, STRATEGY_SIGNAL_ID, STRATEGY_SIGNAL_LABEL } from './adapters/strategyPresenceAdapter';
export type { StrategyPresenceInfo } from './adapters/strategyPresenceAdapter';

// Re-export types
export type {
  FlowReadinessSignal,
  FlowReadinessResolved,
  FlowReadinessStatus,
  ReadinessSeverity,
  RankedReason,
  RecommendedAction,
} from '@/lib/types/flowReadiness';

export {
  SEVERITY_TO_STATUS,
  STATUS_PRIORITY,
  SEVERITY_PRIORITY,
  SEVERITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/types/flowReadiness';
