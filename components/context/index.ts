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

// Existing components
export { CompetitorEditor } from './CompetitorEditor';
export { DiagnosticsDebugDrawer } from './DiagnosticsDebugDrawer';
