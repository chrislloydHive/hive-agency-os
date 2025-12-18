// components/flows/index.ts
// Flow system UI components
//
// These components provide readiness gating and low-confidence warnings
// for AI-powered generation flows.

// Domain coverage strip
export { CoverageStrip, CoverageStripCompact } from './CoverageStrip';

// Readiness gate modal (blocks until user acknowledges)
export { ReadinessGateModal } from './ReadinessGateModal';

// Low confidence badge (for outputs generated with missing context)
export {
  LowConfidenceBadge,
  LowConfidenceBadgeInline,
  type GenerationContext,
} from './LowConfidenceBadge';

// Readiness-gated button wrapper
export { ReadinessGatedButton, useReadinessGate } from './ReadinessGatedButton';
