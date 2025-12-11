// lib/os/detection/index.ts
// Detection module exports

// Types
export * from './types';

// Core detection functions
export { detectGBP, isValidGBPUrl, getGBPSearchQuery } from './detectGBP';
export { detectSocial, extractUsername, getSocialSearchQuery, validateSocialUrl } from './detectSocial';
export {
  extractJsonLdBlocks,
  extractSameAsUrls,
  parseSchemaSignals,
  getSocialFromSameAs,
  getGBPFromSameAs,
  extractLocalBusinessData,
  classifyUrl,
} from './detectSchemaSameAs';
export { discoverPages, analyzeHomepageLinks } from './discoverPages';

// Confidence engine
export {
  computeSourceConfidence,
  computeGBPConfidence,
  computeSocialConfidence,
  computeSchemaConfidence,
  computeDiscoveryConfidence,
  computeGlobalConfidence,
  checkConsistency,
  getConfidenceLevel,
  explainConfidence,
} from './computeConfidence';

// Unified entry point
export {
  detectAllSignals,
  summarizeDetection,
  assessDigitalPresence,
} from './unifySignals';

// GAP integration
export {
  runGapDetection,
  detectionToDataSources,
  getDetectionSummaryText,
  type GapDetectionResult,
} from './gapIntegration';
