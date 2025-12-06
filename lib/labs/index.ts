// lib/labs/index.ts
// Labs module - Brain-first Lab infrastructure
//
// This module provides:
// - Shared refinement types for Labs
// - Brain-first context loading
// - Non-destructive context writing

// Refinement types
export * from './refinementTypes';

// Context loading
export {
  getRefinementLabContext,
  buildRefinementPromptContext,
  buildRefinementResponseFormat,
  getLabContext,
  buildLabPromptContext,
  checkLabReadiness,
  getLabContextSummary,
  type RefinementLabContext,
} from './context';

// Refinement writing
export {
  applyLabRefinements,
  formatApplyResultSummary,
  createApplyDiagnostics,
} from './refinementWriter';
