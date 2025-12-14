// components/context/index.ts
// Context Component Exports

// Core UI Primitives (reusable across Context, Strategy, Labs, QBR)
export { ContextSection } from './ContextSection';
export type { ContextSectionProps } from './ContextSection';
export { ContextField } from './ContextField';
export type { ContextFieldProps } from './ContextField';
export { ConfidenceTooltip } from './ConfidenceTooltip';
export type { ConfidenceTooltipProps } from './ConfidenceTooltip';

// V2 UI Components (TEMP DISABLED - depend on WIP contextV2 modules)
export { ContextV2StatusBadge } from './ContextV2StatusBadge';
export { ContextV2SectionHeader } from './ContextV2SectionHeader';
export { ContextV2FieldMeta } from './ContextV2FieldMeta';
export { ContextQualityBanner } from './ContextQualityBanner';

// Strategy Readiness Banners
export { StrategyReadinessBanner } from './StrategyReadinessBanner';
export { StrategyInputsReadinessBanner } from './StrategyInputsReadinessBanner';

// Dev Tools
export { StrategyBindingsDebugPanel } from './StrategyBindingsDebugPanel';

// TRUST: Unsaved Changes Modal (prevents clobbering user edits)
export { UnsavedChangesModal } from './UnsavedChangesModal';
export type { UnsavedChangesModalProps } from './UnsavedChangesModal';

// Existing components
export { CompetitorEditor } from './CompetitorEditor';
export { DiagnosticsDebugDrawer } from './DiagnosticsDebugDrawer';

// AI Proposal Components (AI-First Context)
export { ProposalBadge } from './ProposalBadge';
export { ProposalCard } from './ProposalCard';
export { ProposalSummaryBanner } from './ProposalSummaryBanner';
export { ProposalReviewBanner } from './ProposalReviewBanner';
