// lib/contextGraph/views/index.ts
// Context API Views - Re-export all context views

// Media Planning Context
export {
  getMediaPlanningContext,
  buildMediaPlanningPromptContext,
  type MediaPlanningContext,
  type MediaHints,
  type KpiTargets,
} from './mediaContext';

// Creative Brief Context
export {
  getCreativeBriefContext,
  buildCreativePromptContext,
  type CreativeBriefContext,
} from './creativeContext';

// Executive Summary Context
export {
  getExecutiveSummaryContext,
  buildExecutiveBrief,
  type ExecutiveContext,
  type ExecutiveSummary,
} from './executiveContext';
