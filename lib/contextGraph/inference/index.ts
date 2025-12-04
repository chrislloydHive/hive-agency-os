// lib/contextGraph/inference/index.ts
// AI Inference Layer Exports

export {
  generateSuggestions,
  suggestFieldValue,
  getPendingSuggestions,
  type AISuggestion,
  type SuggestOptions,
  type SuggestResult,
} from './aiSuggest';

export {
  generateHealingReport,
  needsHealing,
  getRecommendedDiagnostics,
  type HealingFix,
  type HealingReport,
  type HealingOptions,
} from './aiHeal';
