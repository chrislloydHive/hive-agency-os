// lib/os/draft/index.ts
// Draftable Resource Framework - Public API
//
// Provides a unified pattern for AI-generated drafts across all OS resources.

// Types
export * from './types';

// Engine functions
export {
  buildSignalsBundle,
  ensurePrereqs,
  generateDraftForResource,
  type EnsurePrereqsOptions,
} from './engine';

// Resource-specific generators (for direct use if needed)
export { generateContextDraft } from './generators/context';
