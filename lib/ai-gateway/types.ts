/**
 * AI Memory System Types
 *
 * Types for the Company AI Context (Client Brain) system.
 * This enables AI interactions to be memory-aware, loading prior context
 * and logging new interactions for continuity.
 */

/**
 * Memory entry types - categorize different kinds of AI interactions
 */
export type MemoryEntryType =
  | 'GAP IA'              // GAP Initial Assessment results
  | 'GAP Full'            // Full GAP Plan results
  | 'Analytics Insight'   // Analytics-derived insights
  | 'Work Item'           // Work item updates/completions
  | 'Strategy'            // Strategic summaries/decisions
  | 'Diagnostic Summary'  // Diagnostic tool run summaries (for Brain)
  | 'Conversation'        // General AI conversation
  | 'System';             // System-generated entries

/**
 * Memory entry source - where the entry originated
 */
export type MemoryEntrySource = 'AI' | 'User' | 'System';

/**
 * Company AI Context entry (memory entry)
 */
export interface CompanyMemoryEntry {
  id: string;
  companyId: string;
  type: MemoryEntryType;
  source: MemoryEntrySource;
  content: string;
  tags?: string[];
  relatedEntityId?: string | null; // e.g., GAP run ID, work item ID
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for fetching company memory
 */
export interface GetCompanyMemoryOptions {
  /** Maximum number of entries to retrieve */
  limit?: number;
  /** Filter by entry types */
  types?: MemoryEntryType[];
  /** Filter by tags */
  tags?: string[];
  /** Only include entries after this date */
  since?: string;
}

/**
 * Options for adding a memory entry
 */
export interface AddMemoryEntryOptions {
  companyId: string;
  type: MemoryEntryType;
  source?: MemoryEntrySource;
  content: string;
  tags?: string[];
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Options for aiForCompany call
 */
export interface AiForCompanyOptions {
  /** Memory entry type for logging this interaction */
  type: MemoryEntryType;
  /** Tags for categorizing this interaction */
  tags?: string[];
  /** Related entity ID (e.g., GAP run ID) */
  relatedEntityId?: string | null;
  /** System prompt for the AI */
  systemPrompt: string;
  /** Task/user prompt */
  taskPrompt: string;
  /** OpenAI model to use */
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  /** Temperature for generation */
  temperature?: number;
  /** Memory retrieval options */
  memoryOptions?: GetCompanyMemoryOptions;
  /** Whether to use JSON response format */
  jsonMode?: boolean;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Result from aiForCompany call
 */
export interface AiForCompanyResult {
  /** The AI response content */
  content: string;
  /** The memory entry ID created for this interaction (may be undefined if logging failed) */
  memoryEntryId?: string;
  /** Memory entries that were loaded and injected */
  loadedMemoryCount: number;
}

/**
 * GapModelCaller abstraction
 *
 * A function type that accepts a prompt and returns the model's text output.
 * This allows GAP engines to be decoupled from the specific AI implementation.
 */
export type GapModelCaller = (prompt: string) => Promise<string>;
