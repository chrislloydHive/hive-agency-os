// lib/meta/index.ts
// Phase 6: Emergent Intelligence - Module Exports
//
// Central export point for all meta-learning and emergent intelligence functionality

// Types
export * from './types';

// Global Embedding Engine
export {
  generateGlobalEmbedding,
  findSimilarCompaniesGlobal,
  findClusters,
  calculateCompanyOutlierScore,
} from './globalEmbeddingEngine';

// Pattern Discovery
export {
  discoverPatterns,
  discoverVerticalPatterns,
  validatePattern,
  type PatternCandidate,
  type DiscoveryOptions,
  type MediaMixPattern,
  type CreativePattern,
  type PersonaCluster,
  type SeasonalityFingerprint,
  type KPIBreakpoint,
} from './patternDiscovery';

// Vertical Models
export {
  buildVerticalModel,
  listVerticalModels,
  getVerticalRecommendations,
  compareToVertical,
  type VerticalDataPoint,
  type VerticalStats,
} from './verticalModels';

// Global Benchmarking
export {
  generateGlobalBenchmarks,
  compareToGlobalBenchmarks,
  getChannelBenchmarks,
  getBenchmarkPercentile,
  type CompanyMetrics,
  type BenchmarkFilters,
  type BenchmarkComparison,
} from './globalBenchmarking';

// Schema Evolution
export {
  analyzeSchemaUsage,
  generateEvolutionProposals,
  createMigrationPlan,
  applyProposal,
  validateProposal,
  type FieldUsageStats,
  type NamingPattern,
  type ProposalOptions,
} from './schemaEvolution';

// Meta Memory
export {
  storeMemory,
  storePatternMemory,
  storeAnomalyMemory,
  storeInsightMemory,
  storeSchemaMemory,
  storeLearning,
  storeBestPractice,
  recallMemories,
  queryMemories,
  getMemory,
  useMemory,
  validateMemory,
  deprecateMemory,
  findSimilarMemories,
  getMemoryStats,
  cleanupMemories,
  exportMemories,
  importMemories,
  type MemoryQuery,
  type MemoryRecallResult,
  type LearningRecord,
} from './metaMemory';

// Anomaly Patterns
export {
  detectGlobalAnomalies,
  detectVerticalAnomalies,
  detectChannelSpecificAnomalies,
  checkCompanyForAnomalies,
  getAnomalyHistory,
  type CompanyMetricSnapshot,
  type AnomalyThresholds,
  type DetectionOptions,
  type MetricBaseline,
} from './anomalyPatterns';
