// lib/os/findings/index.ts
// Findings module exports

// Types
export * from './types';

// Standardization functions
export {
  standardizeFindings,
  standardizeMultipleLabFindings,
  filterFindings,
  groupFindings,
  getFindingsSummary,
} from './standardizeFindings';

// Integration with existing system
export {
  findingToAirtableInput,
  standardizeAndConvert,
  standardizeMultipleLabs,
  getStandardizedSummary,
  groupFindingsByTheme,
  migrateOldFinding,
} from './findingsIntegration';
