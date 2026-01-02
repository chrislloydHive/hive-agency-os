// components/website/v5/index.tsx
// V5 Website Lab UI Components

// Main panel
export { V5ResultsPanel } from './V5ResultsPanel';
export type { V5DiagnosticData } from './V5ResultsPanel';

// Sub-components
export { V5HeaderSummary } from './V5HeaderSummary';
export { V5BlockingIssues } from './V5BlockingIssues';
export { V5PersonaJourneys } from './V5PersonaJourneys';
export { V5PageObservations } from './V5PageObservations';
export { V5Recommendations } from './V5Recommendations';

// Re-export types from shared location
export type {
  V5DiagnosticOutput,
  V5PageObservation,
  V5PersonaJourney,
  V5BlockingIssue,
  V5QuickWin,
  V5StructuralChange,
  V5PersonaType,
  V5Verdict,
} from '@/lib/types/websiteLabV5';

export { deriveVerdict, VERDICT_CONFIG, PERSONA_LABELS } from '@/lib/types/websiteLabV5';
