// lib/assistant/index.ts
// Company Context Assistant exports

export * from './types';
export { loadAssistantContext, formatContextForPrompt } from './contextLoader';
export {
  getAssistantSystemPrompt,
  buildTaskPrompt,
  generateQuickActions,
  getQuickActionsForPage,
  getPageContextHint,
  type QuickAction,
  type PageQuickActionContext,
} from './prompts';
export { storeProposedChanges, getStoredChanges, removeStoredChanges } from './changeStore';
