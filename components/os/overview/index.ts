// components/os/overview/index.ts
// Overview V3 Components Barrel Export
// Reimagined: Decision & Direction Hub

// Main container
export { CompanyOverviewV3, type CompanyOverviewV3Props } from './CompanyOverviewV3';

// New V3 Reimagined Components
export {
  CompanySnapshotHeader,
  deriveCompanyLifecycle,
  type CompanySnapshotHeaderProps,
  type CompanyLifecycle,
} from './CompanySnapshotHeader';

export {
  BusinessNeedSelector,
  useBusinessNeed,
  DEFAULT_BUSINESS_NEEDS,
  type BusinessNeed,
  type ActiveBusinessNeed,
  type BusinessNeedSelectorProps,
} from './BusinessNeedSelector';

export {
  BestPathForward,
  deriveStrategyState,
  type BestPathForwardProps,
  type PathRecommendation,
  type StrategyState,
} from './BestPathForward';

export {
  CurrentDirectionCard,
  type CurrentDirectionCardProps,
} from './CurrentDirectionCard';

export {
  KeySignals,
  extractKeySignals,
  type KeySignal,
  type KeySignalsProps,
} from './KeySignals';

export {
  StrategyAwareActions,
  type StrategyAwareActionsProps,
  type StrategyAction,
} from './StrategyAwareActions';

// Legacy components (kept for backwards compatibility)
export { StrategySnapshotCard, type StrategySnapshotCardProps } from './StrategySnapshotCard';
export { ActivePlaysList, type ActivePlaysListProps } from './ActivePlaysList';
export { AINextActionCard, type AINextActionCardProps, type RecommendedAction } from './AINextActionCard';
export { SupportingSignals, type SupportingSignalsProps } from './SupportingSignals';
