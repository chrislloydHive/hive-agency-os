// lib/os/draft/types.ts
// Generic Draftable Resource Framework Types
//
// Provides a unified model for AI-generated drafts across Context, Strategy,
// Creative Strategy, and Work Plan resources.

import type { CompanyContext, CompetitionSummary, Competitor } from '@/lib/types/context';
import type { BaselineSignals } from '@/lib/os/context';

// ============================================================================
// Resource Kinds
// ============================================================================

/**
 * All draftable resource kinds in the system.
 * Add new resources here as they're implemented.
 */
export type DraftableResourceKind =
  | 'context'
  | 'strategy'
  | 'creative_strategy'
  | 'work_plan';

// ============================================================================
// Draft Source
// ============================================================================

/**
 * Source of the data currently loaded in a resource editor.
 */
export type DraftSource =
  | 'user_saved'      // Loaded from canonical saved resource
  | 'ai_draft'        // AI-generated draft (not yet saved)
  | 'system_default'; // Empty/default state

// ============================================================================
// Draftable State
// ============================================================================

/**
 * Generic state container for any draftable resource.
 * Used by the useDraftableResource hook and page loaders.
 */
export interface DraftableState<T> {
  /** The canonical saved resource (null if none exists) */
  saved: T | null;
  /** The current draft (null if none exists or editing saved) */
  draft: T | null;
  /** Source of the currently displayed data */
  source: DraftSource;
  /** Whether prerequisites for draft generation are ready */
  prereqsReady: boolean;
}

// ============================================================================
// Signals Bundle
// ============================================================================

/**
 * Diagnostics summary extracted from various sources.
 * Used for AI context generation.
 */
export interface DiagnosticsSummary {
  website?: string;
  seo?: string;
  content?: string;
  brand?: string;
}

/**
 * Competition snapshot - raw data from Competition V3 run
 */
export interface CompetitionSnapshot {
  /** Run ID from Competition V3 */
  runId: string;
  /** When the run completed */
  completedAt: string;
  /** Number of competitors found */
  competitorCount: number;
  /** Raw competitor domains for reference */
  competitorDomains: string[];
}

/**
 * Competition V4 snapshot - data from Competition V4 run
 */
export interface CompetitionV4Snapshot {
  /** Run ID from Competition V4 */
  runId: string;
  /** When the run completed */
  completedAt: string;
  /** Category name from V4 classification */
  categoryName: string;
  /** Category description */
  categoryDescription: string;
  /** Number of validated competitors */
  validatedCount: number;
  /** Number of removed competitors */
  removedCount: number;
  /** Validated competitor domains */
  competitorDomains: string[];
}

/**
 * Unified signals bundle containing all data needed for draft generation.
 * This is the single source of truth passed to all draft generators.
 */
export interface SignalsBundle {
  /** Baseline signals (lab runs, GAP, etc.) */
  baselineSignals: BaselineSignals;
  /** Summarized diagnostics by area */
  diagnosticsSummary: DiagnosticsSummary;
  /** Inferred company category from name/domain */
  inferredCategory: string | null;
  /** Inferred industry */
  inferredIndustry: string | null;
  /** Inferred audience hints */
  inferredAudienceHints: string[];
  /** Inferred business model hints */
  inferredBusinessModelHints: string[];
  /** Competition V3 snapshot metadata */
  competitionSnapshot: CompetitionSnapshot | null;
  /** Competition V4 snapshot metadata (if V4 enabled) */
  competitionV4Snapshot: CompetitionV4Snapshot | null;
  /** Summarized competition data for AI prompts */
  competitionSummary: CompetitionSummary | null;
  /** Structured competitors array (ready for Context) */
  competitors: Competitor[];
  /** Source of competitor data: 'v3' | 'v4' */
  competitorSource: 'v3' | 'v4';
}

// ============================================================================
// Draft Result Types
// ============================================================================

/**
 * Result from generating a draft.
 */
export interface DraftResult<T> {
  /** Whether generation succeeded */
  success: boolean;
  /** The generated draft (null if failed) */
  draft: T | null;
  /** Human-readable summary of what was generated */
  summary: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Result from ensuring prerequisites are ready.
 */
export interface EnsurePrereqsResult {
  /** Whether all prereqs are now ready */
  ready: boolean;
  /** The signals bundle (even if incomplete) */
  signals: SignalsBundle;
  /** What was run/fetched to prepare prereqs */
  actions: string[];
  /** Error if prereqs couldn't be ensured */
  error?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request body for POST /api/os/draft/run
 */
export interface DraftRunRequest {
  companyId: string;
  kind: DraftableResourceKind;
  /** If true, skip running diagnostics if not present (just generate from what exists) */
  skipDiagnostics?: boolean;
  /** If true, force a fresh Competition V3 run even if results already exist */
  forceCompetition?: boolean;
}

/**
 * Response from POST /api/os/draft/run
 */
export interface DraftRunResponse<T = unknown> {
  success: boolean;
  /** The generated draft */
  draft: T | null;
  /** Whether prerequisites were ready before this call */
  prereqsWereReady: boolean;
  /** Whether prerequisites are ready now */
  prereqsReady: boolean;
  /** Summary of what happened */
  message: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error if failed */
  error?: string;
}

/**
 * Request body for POST /api/os/draft/regenerate
 */
export interface DraftRegenerateRequest {
  companyId: string;
  kind: DraftableResourceKind;
  /** If true, force a fresh Competition V3 run before regenerating */
  forceCompetition?: boolean;
}

/**
 * Response from POST /api/os/draft/regenerate
 */
export interface DraftRegenerateResponse<T = unknown> {
  success: boolean;
  /** The regenerated draft */
  draft: T | null;
  /** Summary of what happened */
  message: string;
  /** Error if failed */
  error?: string;
}

// ============================================================================
// Resource-Specific Draft Types
// ============================================================================

/**
 * Context draft structure (extends CompanyContext with draft metadata)
 */
export interface ContextDraftData {
  context: CompanyContext;
  source: 'ai/baseline-v1' | 'ai/assist' | 'user/edit';
  createdAt: string;
  summary?: string;
}

/**
 * Strategy draft structure (placeholder for future implementation)
 */
export interface StrategyDraftData {
  // TODO: Define when Strategy resource is implemented
  companyId: string;
  strategyJson: unknown;
  source: string;
  createdAt: string;
}

/**
 * Creative Strategy draft structure (placeholder for future implementation)
 */
export interface CreativeStrategyDraftData {
  // TODO: Define when Creative Strategy resource is implemented
  companyId: string;
  creativeStrategyJson: unknown;
  source: string;
  createdAt: string;
}

/**
 * Work Plan draft structure (placeholder for future implementation)
 */
export interface WorkPlanDraftData {
  // TODO: Define when Work Plan resource is implemented
  companyId: string;
  workPlanJson: unknown;
  source: string;
  createdAt: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid DraftableResourceKind
 */
export function isDraftableResourceKind(value: string): value is DraftableResourceKind {
  return ['context', 'strategy', 'creative_strategy', 'work_plan'].includes(value);
}

/**
 * Check if prerequisites are ready based on signals
 */
export function arePrereqsReady(signals: SignalsBundle): boolean {
  const { baselineSignals } = signals;
  return (
    baselineSignals.hasLabRuns ||
    baselineSignals.hasFullGap ||
    baselineSignals.hasCompetition ||
    baselineSignals.hasWebsiteMetadata
  );
}
