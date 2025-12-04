// lib/contextGraph/benchmarks/index.ts
// Cross-company learning and benchmarking exports

// Types
export type {
  CompanyEmbedding,
  EmbeddingDimensions,
  SimilarityMatch,
  SimilaritySearchOptions,
  BenchmarkMetric,
  BenchmarkPosition,
  BenchmarkReport,
  LearnedPattern,
  LearningBasedRecommendation,
  IndustryCategory,
  ScaleCategory,
  CompanyClassification,
} from './types';

// Embedding engine
export {
  generateCompanyEmbedding,
  findSimilarCompanies,
  generateAllEmbeddings,
  getCompanyEmbedding,
  getCompanyClassification,
  getAllEmbeddings,
  getEmbeddingStats,
} from './embeddingEngine';

// Benchmark engine
export {
  recordCompanyValues,
  computeBenchmarks,
  getBenchmarkPosition,
  generateBenchmarkReport,
  compareCompanies,
  getAllBenchmarks,
  getBenchmark,
  getBenchmarkStats,
} from './benchmarkEngine';

// Learning engine
export {
  registerCompanyGraph,
  discoverPatterns,
  generateRecommendations,
  getAllPatterns,
  getPattern,
  getLearningStats,
} from './learningEngine';
