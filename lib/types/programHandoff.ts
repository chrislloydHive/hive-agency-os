// lib/types/programHandoff.ts
// Types for Strategy → Programs → Work Handoff
//
// This module defines the draft structure for promoting Tactics to Programs to Work.
// Key principles:
// - AI-first: AI generates, humans approve
// - Non-duplicative: Stable keys prevent duplicates on re-run
// - Traceable: Full provenance chain from Strategy to Work

// ============================================================================
// Program Types (Extended)
// ============================================================================

/**
 * Extended program types beyond the core website/content
 * Maps to channels from tactics
 */
export type ExtendedProgramType =
  | 'content'
  | 'website'
  | 'seo'
  | 'media'
  | 'brand'
  | 'analytics'
  | 'demand';

// ============================================================================
// Draft Structures
// ============================================================================

/**
 * A draft work item generated from a tactic
 */
export interface DraftWorkItem {
  /** Stable key for deduplication: initiativeKey + normalize(title) */
  workKey: string;
  title: string;
  description: string;
  effort: 'S' | 'M' | 'L';
  category: string;
}

/**
 * A draft initiative generated from a tactic
 */
export interface DraftInitiative {
  /** Stable key for deduplication: programKey + normalize(title) */
  initiativeKey: string;
  title: string;
  description: string;
  expectedImpact: string;
  impactLevel: 'high' | 'medium' | 'low';
  effort: 'S' | 'M' | 'L';
  sequence: 'now' | 'next' | 'later';
  workItems: DraftWorkItem[];
}

/**
 * A draft program generated from tactics
 */
export interface DraftProgram {
  /** Stable key for deduplication: companyId + strategyId + programType */
  programKey: string;
  programType: ExtendedProgramType;
  title: string;
  summary: string;
  objectiveFraming: string;
  initiatives: DraftInitiative[];
  /** Tactic IDs that were used to generate this program */
  tacticIds: string[];
}

// ============================================================================
// Handoff Draft Record
// ============================================================================

/**
 * Hashes for staleness detection
 */
export interface HandoffHashes {
  strategyHash?: string;
  objectivesHash?: string;
  tacticsHash?: string;
  prioritiesHash?: string;
}

/**
 * A program handoff draft as stored in Airtable
 */
export interface ProgramHandoffDraft {
  /** Airtable record ID */
  id: string;
  /** Company this draft belongs to */
  companyId: string;
  /** Strategy this draft was generated from */
  strategyId: string;
  /** Strategy title for display */
  strategyTitle: string;
  /** Unique draft key for upsert: companyId + strategyId */
  draftKey: string;
  /** Tactic IDs that were promoted */
  tacticIds: string[];
  /** Generated programs with initiatives and work items */
  programs: DraftProgram[];
  /** AI reasoning for the generation */
  reasoning: string;
  /** Any warnings from generation */
  warnings: string[];
  /** Hashes for staleness detection */
  basedOnHashes: HandoffHashes;
  /** Linked objective IDs from the strategy */
  linkedObjectiveIds: string[];
  /** Linked priority IDs from the strategy */
  linkedPriorityIds: string[];
  /** Generation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Request to create/update a handoff draft
 */
export interface CreateHandoffDraftRequest {
  companyId: string;
  strategyId: string;
  strategyTitle: string;
  tacticIds: string[];
  programs: DraftProgram[];
  reasoning: string;
  warnings: string[];
  basedOnHashes: HandoffHashes;
  linkedObjectiveIds: string[];
  linkedPriorityIds: string[];
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Response from generating a handoff draft
 */
export interface GenerateHandoffResponse {
  success: boolean;
  /** Draft ID for applying/discarding */
  draftId: string;
  /** Draft key for lookup */
  draftKey: string;
  /** Generated programs (for preview) */
  programs: DraftProgram[];
  reasoning: string;
  warnings: string[];
  /** Summary stats */
  stats: {
    programCount: number;
    initiativeCount: number;
    workItemCount: number;
  };
}

/**
 * Response from applying a handoff draft
 */
export interface ApplyHandoffResponse {
  success: boolean;
  /** Created/updated program IDs */
  programIds: string[];
  /** Created work item IDs */
  workItemIds: string[];
  /** Skipped work items (already existed) */
  skippedCount: number;
  /** Any errors during apply */
  errors: string[];
}

/**
 * Response from discarding a handoff draft
 */
export interface DiscardHandoffResponse {
  success: boolean;
  draftId: string;
}

/**
 * Response from listing handoff drafts
 */
export interface ListHandoffDraftsResponse {
  drafts: ProgramHandoffDraft[];
  total: number;
}

// ============================================================================
// Stable Key Generation
// ============================================================================

/**
 * Normalize a string for use in stable keys
 * - Lowercase
 * - Remove special characters
 * - Replace spaces with underscores
 * - Truncate to 50 chars
 */
export function normalizeForKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

/**
 * Generate a program key for deduplication
 */
export function generateProgramKey(
  companyId: string,
  strategyId: string,
  programType: ExtendedProgramType
): string {
  return `${companyId}:${strategyId}:${programType}`;
}

/**
 * Generate an initiative key for deduplication
 */
export function generateInitiativeKey(
  programKey: string,
  title: string
): string {
  return `${programKey}:${normalizeForKey(title)}`;
}

/**
 * Generate a work item key for deduplication
 */
export function generateWorkKey(
  initiativeKey: string,
  title: string
): string {
  return `${initiativeKey}:${normalizeForKey(title)}`;
}

/**
 * Generate the draft key for upsert
 */
export function generateDraftKey(companyId: string, strategyId: string): string {
  return `${companyId}:${strategyId}`;
}
