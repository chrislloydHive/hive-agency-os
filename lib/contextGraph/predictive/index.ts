// lib/contextGraph/predictive/index.ts
// Predictive inference exports

// Types
export type {
  FieldPrediction,
  PredictionMethod,
  PredictionSource,
  PredictionOptions,
  PredictionResult,
  FutureValuePrediction,
  ProbabilisticRange,
  EvolutionPattern,
  SimilarCompany,
} from './types';

// Engine functions
export {
  generatePredictions,
  predictFieldValue,
  predictFutureChanges,
  detectEvolutionPatterns,
} from './engine';
