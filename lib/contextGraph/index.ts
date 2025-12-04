// lib/contextGraph/index.ts
// Context Graph Main Export

// Types
export {
  type ProvenanceTag,
  WithMeta,
  WithMetaArray,
  type WithMetaType,
  type WithMetaArrayType,
  emptyMeta,
  emptyMetaArray,
  createProvenance as createProvenanceTag, // Renamed to avoid conflict
  getHighestConfidence,
  getMostRecent,
} from './types';

// Enums
export * from './enums';

// Domains
export * from './domains';

// Root Schema
export * from './companyContextGraph';

// Storage
export * from './storage';

// Mutation utilities
export {
  type ProvenanceSource,
  createProvenance,
  setField,
  mergeField,
  setDomainFields,
  batchUpdate,
  getMostConfidentValue,
  hasValueFromSource,
  getLatestProvenance,
  clearField,
  markFusionComplete,
} from './mutate';

// Fusion pipeline
export * from './fusion';

// Prefill utilities
export * from './prefill';
