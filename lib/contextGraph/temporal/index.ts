// lib/contextGraph/temporal/index.ts
// Temporal storage exports

// Types
export type {
  FieldHistoryEntry,
  FieldHistory,
  FieldHistoryStats,
  ChangeVelocity,
  StalenessTrend,
  DomainHistorySummary,
  HistoryQueryOptions,
  HistoryQueryResult,
  NarrativePeriod,
  StrategicNarrative,
  TemporalSnapshot,
  TemporalComparison,
} from './types';

// Engine functions
export {
  recordFieldChange,
  getFieldHistory,
  getDomainHistory,
  queryHistory,
  getChangeVelocity,
  getStalenessTrend,
  recordBatchChanges,
  getCompanyChangeSummary,
} from './engine';

// Strategic narratives
export {
  generateStrategicNarrative,
  generateQuickInsight,
  getOrGenerateNarrative,
  getCachedNarratives,
} from './strategicNarratives';
