/**
 * AI Gateway Module Exports
 *
 * Central export point for the AI memory system.
 */

// Types
export type {
  MemoryEntryType,
  MemoryEntrySource,
  CompanyMemoryEntry,
  GetCompanyMemoryOptions,
  AddMemoryEntryOptions,
  AiForCompanyOptions,
  AiForCompanyResult,
  GapModelCaller,
} from './types';

// AI Gateway
export { aiForCompany, createGapModelCaller, aiSimple, suggestTagsFromContent } from './aiClient';

// Memory Functions
export {
  getCompanyMemory,
  getCompanyMemoryForPrompt,
  addCompanyMemoryEntry,
  extractGapSummaryForMemory,
} from './companyMemory';
