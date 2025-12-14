// lib/types/program.ts
// Program types for the Programs system
//
// Programs sit between Strategy and Planners:
// - Strategy defines the "what" and "why"
// - Programs define the "how" with priorities, sequencing, and readiness gates
// - Planners execute the program with specific work items
//
// Supported: Website Program, Content Program
// Future: Media Program

// ============================================================================
// Core Types
// ============================================================================

/**
 * Available program types
 */
export type ProgramType = 'website' | 'content';

/**
 * Program lifecycle status
 */
export type ProgramStatus = 'draft' | 'active' | 'archived';

// ============================================================================
// Plan Structure Types
// ============================================================================

/**
 * A priority item in the program
 */
export interface ProgramPriority {
  label: string;
  rationale?: string;
}

/**
 * A phase in the sequencing plan
 */
export interface ProgramPhase {
  phase: string;
  items: string[];
}

/**
 * A readiness gate with criteria
 */
export interface ProgramReadinessGate {
  gate: string;
  criteria: string[];
}

/**
 * Explicit exclusion from the program
 */
export interface ProgramExclusion {
  item: string;
  reason: string;
}

/**
 * Snapshot of inputs used when creating/updating the program
 * Used for traceability and detecting when inputs have changed
 */
export interface ProgramInputsSnapshot {
  companyId: string;
  contextRevisionId?: string;
  strategyId?: string;
  // Website-specific
  websiteLabRunId?: string;
  websiteLabSummary?: string;
  // Content-specific
  contentLabRunId?: string;
  contentLabSummary?: string;
  // Shared
  constraints?: {
    minBudget?: number;
    maxBudget?: number;
    timeline?: string;
  };
  capturedAt: string;
}

// ============================================================================
// Website Program Plan
// ============================================================================

/**
 * The plan content for a Website Program
 */
export interface WebsiteProgramPlan {
  title: string;
  summary: string;
  priorities: ProgramPriority[];
  sequencing: ProgramPhase[];
  readinessGates: ProgramReadinessGate[];
  inputsSnapshot: ProgramInputsSnapshot;

  // AI-generated fields (optional for backwards compatibility)
  objectiveFraming?: string;
  currentStateSummary?: string;
  exclusions?: ProgramExclusion[];

  // AI transparency metadata (optional)
  assumptions?: string[];
  unknowns?: string[];
  dependencies?: string[];
}

// ============================================================================
// Content Program Plan
// ============================================================================

/**
 * The plan content for a Content Program
 * Mirrors WebsiteProgramPlan structure for consistency
 */
export interface ContentProgramPlan {
  title: string;
  summary: string;
  priorities: ProgramPriority[];
  sequencing: ProgramPhase[];
  readinessGates: ProgramReadinessGate[];
  inputsSnapshot: ProgramInputsSnapshot;

  // AI-generated fields (optional for backwards compatibility)
  objectiveFraming?: string;
  currentStateSummary?: string;
  exclusions?: ProgramExclusion[];

  // AI transparency metadata (optional)
  assumptions?: string[];
  unknowns?: string[];
  dependencies?: string[];
}

/**
 * Union type for all program plans
 */
export type ProgramPlan = WebsiteProgramPlan | ContentProgramPlan;

// ============================================================================
// Program Record
// ============================================================================

/**
 * A program record as stored/returned
 */
export interface ProgramRecord {
  id: string;
  companyId: string;
  type: ProgramType;
  status: ProgramStatus;
  plan: ProgramPlan;
  createdAt: string;
  updatedAt: string;
}

/**
 * Partial plan for updates (all fields optional except what's being changed)
 */
export interface ProgramPlanUpdate {
  title?: string;
  summary?: string;
  priorities?: ProgramPriority[];
  sequencing?: ProgramPhase[];
  readinessGates?: ProgramReadinessGate[];
}

/** @deprecated Use ProgramPlanUpdate instead */
export type WebsiteProgramPlanUpdate = ProgramPlanUpdate;

// ============================================================================
// API Types
// ============================================================================

/**
 * Response for listing programs
 */
export interface ListProgramsResponse {
  programs: ProgramRecord[];
  total: number;
}

/**
 * Request body for creating a program
 */
export interface CreateProgramRequest {
  type: ProgramType;
  // Plan is auto-generated on create, but can be overridden
  plan?: Partial<ProgramPlan>;
}

// ============================================================================
// AI-Generated Program Types
// ============================================================================

/**
 * AI generation mode
 */
export type ProgramGenerationMode = 'create' | 'refresh';

/**
 * Request body for AI program generation
 */
export interface GenerateProgramRequest {
  mode: ProgramGenerationMode;
  programType: ProgramType;
  existingProgramId?: string; // Required if mode is 'refresh'
}

/**
 * AI-generated program draft with metadata
 */
export interface AIProgramDraft {
  // Core plan fields
  title: string;
  summary: string;
  objectiveFraming: string;
  currentStateSummary: string;
  priorities: ProgramPriority[];
  sequencing: ProgramPhase[];
  exclusions: ProgramExclusion[];
  readinessGates: ProgramReadinessGate[];

  // AI transparency metadata
  assumptions: string[];
  unknowns: string[];
  dependencies: string[];

  // Inputs snapshot
  inputsSnapshot: ProgramInputsSnapshot;
}

/**
 * Response from AI program generation
 */
export interface GenerateProgramResponse {
  draft: AIProgramDraft;
  reasoning: string;
  programType: ProgramType;
  inputsUsed: {
    hasContext: boolean;
    hasStrategy: boolean;
    hasWebsiteLab: boolean;
    hasContentLab: boolean;
  };
}

/**
 * Request body for updating a program plan
 */
export interface UpdateProgramRequest {
  plan: ProgramPlanUpdate;
}

/**
 * Response for program operations
 */
export interface ProgramOperationResponse {
  success: boolean;
  program?: ProgramRecord;
  error?: string;
}
