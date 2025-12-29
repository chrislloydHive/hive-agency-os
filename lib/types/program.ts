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

// ============================================================================
// PLANNING PROGRAMS (Strategy → Deliver → Work)
// ============================================================================
// These are the new Program types for the Strategy→Deliver→Work flow
// Programs translate Strategy Tactics into executable Work Items

import { z } from 'zod';

// ============================================================================
// Planning Program Status & Lifecycle
// ============================================================================

export const PlanningProgramStatusSchema = z.enum([
  'draft',      // Initial state, being designed
  'ready',      // Passed readiness checks, can be committed
  'committed',  // Work items have been created
  'paused',     // Temporarily suspended
  'archived',   // Soft deleted
]);

export type PlanningProgramStatus = z.infer<typeof PlanningProgramStatusSchema>;

export const PLANNING_PROGRAM_STATUS_LABELS: Record<PlanningProgramStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  committed: 'Committed',
  paused: 'Paused',
  archived: 'Archived',
};

export const PLANNING_PROGRAM_STATUS_COLORS: Record<PlanningProgramStatus, string> = {
  draft: 'gray',
  ready: 'blue',
  committed: 'green',
  paused: 'amber',
  archived: 'slate',
};

// ============================================================================
// Workstream Types (maps to TacticChannel but for Programs)
// ============================================================================

export const WorkstreamTypeSchema = z.enum([
  'content',
  'website',
  'seo',
  'email',
  'partnerships',
  'paid_media',
  'social',
  'brand',
  'analytics',
  'conversion',
  'ops',
  'other',
]);

export type WorkstreamType = z.infer<typeof WorkstreamTypeSchema>;

export const WORKSTREAM_LABELS: Record<WorkstreamType, string> = {
  content: 'Content',
  website: 'Website',
  seo: 'SEO',
  email: 'Email',
  partnerships: 'Partnerships',
  paid_media: 'Paid Media',
  social: 'Social',
  brand: 'Brand',
  analytics: 'Analytics',
  conversion: 'CRO',
  ops: 'Operations',
  other: 'Other',
};

// ============================================================================
// Planning Program Origin (links to Strategy)
// ============================================================================

export const PlanningProgramOriginSchema = z.object({
  strategyId: z.string(),
  objectiveId: z.string().optional(),
  betId: z.string().optional(),
  tacticId: z.string().optional(),
  tacticTitle: z.string().optional(), // Snapshot at creation time
});

export type PlanningProgramOrigin = z.infer<typeof PlanningProgramOriginSchema>;

// ============================================================================
// Deliverable (within a Planning Program)
// ============================================================================

export const PlanningDeliverableStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'blocked',
  'cancelled',
]);

export type PlanningDeliverableStatus = z.infer<typeof PlanningDeliverableStatusSchema>;

export const PlanningDeliverableTypeSchema = z.enum([
  'document',
  'asset',
  'campaign',
  'integration',
  'process',
  'other',
]);

export type PlanningDeliverableType = z.infer<typeof PlanningDeliverableTypeSchema>;

export const PlanningDeliverableSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: PlanningDeliverableTypeSchema.default('other'),
  description: z.string().optional(),
  status: PlanningDeliverableStatusSchema.default('planned'),
  workstreamType: WorkstreamTypeSchema.optional(),
  dueDate: z.string().optional(),
});

export type PlanningDeliverable = z.infer<typeof PlanningDeliverableSchema>;

// ============================================================================
// Planning Program Scope
// ============================================================================

export const PlanningProgramScopeSchema = z.object({
  summary: z.string(),
  deliverables: z.array(PlanningDeliverableSchema).default([]),
  workstreams: z.array(WorkstreamTypeSchema).default([]),
  channels: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
});

export type PlanningProgramScope = z.infer<typeof PlanningProgramScopeSchema>;

// ============================================================================
// KPI & Success Metrics
// ============================================================================

export const PlanningProgramKPISchema = z.object({
  key: z.string(),
  label: z.string(),
  target: z.string().optional(),
  timeframe: z.string().optional(),
});

export type PlanningProgramKPI = z.infer<typeof PlanningProgramKPISchema>;

export const PlanningProgramSuccessSchema = z.object({
  primaryConversionAction: z.string().optional(),
  kpis: z.array(PlanningProgramKPISchema).default([]),
  measurementNotes: z.string().optional(),
});

export type PlanningProgramSuccess = z.infer<typeof PlanningProgramSuccessSchema>;

// ============================================================================
// Milestones & Planning
// ============================================================================

export const PlanningMilestoneStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'missed',
]);

export type PlanningMilestoneStatus = z.infer<typeof PlanningMilestoneStatusSchema>;

export const PlanningMilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: z.string().optional(),
  status: PlanningMilestoneStatusSchema.default('pending'),
});

export type PlanningMilestone = z.infer<typeof PlanningMilestoneSchema>;

export const PlanningProgramPlanSchema = z.object({
  horizonDays: z.number().default(30), // 30/60/90 day programs
  milestones: z.array(PlanningMilestoneSchema).default([]),
  sequencingNotes: z.string().optional(),
  owner: z.string().optional(),
});

export type PlanningProgramPlanDetails = z.infer<typeof PlanningProgramPlanSchema>;

// ============================================================================
// Canonical Artifact Relation Type
// ============================================================================
// Canonical vocabulary for artifact relations across the system:
// - 'produces': The entity creates/generates this artifact as output
// - 'requires': The entity needs this artifact as input
// - 'reference': The entity references this artifact without dependency
//
// WHY: Consistent vocabulary across Programs and Work Items enables
// proper propagation and reduces confusion. UI labels can differ
// (e.g., "Output" vs "Produces") but storage is canonical.

export const CanonicalArtifactRelationSchema = z.enum(['produces', 'requires', 'reference']);
export type CanonicalArtifactRelation = z.infer<typeof CanonicalArtifactRelationSchema>;

// ============================================================================
// Program Artifact Links
// ============================================================================
// Links programs to artifacts they produce or reference
//
// Note: ProgramArtifactLinkType uses 'output'|'input'|'reference' for backwards
// compatibility with existing data. Use mapProgramLinkToCanonical() to convert.

export const ProgramArtifactLinkTypeSchema = z.enum(['output', 'input', 'reference']);
export type ProgramArtifactLinkType = z.infer<typeof ProgramArtifactLinkTypeSchema>;

/**
 * Map program artifact link type to canonical relation
 *
 * Program UI shows: Output / Input / Reference
 * Canonical stores: produces / requires / reference
 */
export function mapProgramLinkToCanonical(linkType: ProgramArtifactLinkType): CanonicalArtifactRelation {
  const mapping: Record<ProgramArtifactLinkType, CanonicalArtifactRelation> = {
    output: 'produces',
    input: 'requires',
    reference: 'reference',
  };
  return mapping[linkType];
}

/**
 * Map canonical relation to program artifact link type (for display)
 */
export function mapCanonicalToProgramLink(relation: CanonicalArtifactRelation): ProgramArtifactLinkType {
  const mapping: Record<CanonicalArtifactRelation, ProgramArtifactLinkType> = {
    produces: 'output',
    requires: 'input',
    reference: 'reference',
  };
  return mapping[relation];
}

/**
 * Get UI label for program artifact link type
 * UI always shows user-friendly labels regardless of storage format
 */
export function getProgramLinkTypeLabel(linkType: ProgramArtifactLinkType): string {
  const labels: Record<ProgramArtifactLinkType, string> = {
    output: 'Output',
    input: 'Input',
    reference: 'Reference',
  };
  return labels[linkType];
}

export const ProgramArtifactLinkSchema = z.object({
  artifactId: z.string(),
  artifactTitle: z.string(), // Snapshot at link time
  artifactType: z.string(),  // e.g., 'media_brief', 'content_brief'
  artifactStatus: z.enum(['draft', 'final', 'archived']),
  linkType: ProgramArtifactLinkTypeSchema.default('output'),
  linkedAt: z.string(), // ISO timestamp
  linkedBy: z.string().optional(),
});

export type ProgramArtifactLink = z.infer<typeof ProgramArtifactLinkSchema>;

/**
 * Create a program artifact link snapshot
 */
export function createProgramArtifactLink(
  artifactId: string,
  artifactTitle: string,
  artifactType: string,
  artifactStatus: 'draft' | 'final' | 'archived',
  linkType: ProgramArtifactLinkType = 'output',
  linkedBy?: string
): ProgramArtifactLink {
  return {
    artifactId,
    artifactTitle,
    artifactType,
    artifactStatus,
    linkType,
    linkedAt: new Date().toISOString(),
    linkedBy,
  };
}

// ============================================================================
// Commitment (Work creation)
// ============================================================================

export const PlanningProgramCommitmentSchema = z.object({
  committedAt: z.string().optional(),
  committedBy: z.string().optional(),
  commitmentNotes: z.string().optional(),
  workItemIds: z.array(z.string()).default([]),
});

export type PlanningProgramCommitment = z.infer<typeof PlanningProgramCommitmentSchema>;

// ============================================================================
// Planning Program (Main Entity)
// ============================================================================

export const PlanningProgramSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  strategyId: z.string(),
  title: z.string(),
  status: PlanningProgramStatusSchema.default('draft'),
  origin: PlanningProgramOriginSchema,
  scope: PlanningProgramScopeSchema,
  success: PlanningProgramSuccessSchema.default({ kpis: [] }),
  planDetails: PlanningProgramPlanSchema.default({ horizonDays: 30, milestones: [] }),
  commitment: PlanningProgramCommitmentSchema.default({ workItemIds: [] }),
  linkedArtifacts: z.array(ProgramArtifactLinkSchema).default([]), // Outputs/inputs/references
  stableKey: z.string().optional(), // For idempotent creation from tactics
  // Work plan materialization tracking
  /** JSON-encoded work plan (for change detection) */
  workPlanJson: z.string().nullable().optional(),
  /** Version number, incremented on each materialization */
  workPlanVersion: z.number().default(0),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type PlanningProgram = z.infer<typeof PlanningProgramSchema>;

export const PlanningProgramInputSchema = PlanningProgramSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlanningProgramInput = z.infer<typeof PlanningProgramInputSchema>;

export const PlanningProgramPatchSchema = PlanningProgramInputSchema.partial();

export type PlanningProgramPatch = z.infer<typeof PlanningProgramPatchSchema>;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique planning program ID
 */
export function generatePlanningProgramId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pprg_${timestamp}_${random}`;
}

/**
 * Generate a stable key for idempotent program creation
 * Same strategyId + tacticId should always produce the same key
 */
export function stablePlanningProgramKey(strategyId: string, tacticId: string): string {
  return `${strategyId}::${tacticId}`;
}

/**
 * Generate a deliverable ID
 */
export function generatePlanningDeliverableId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `pdel_${timestamp}_${random}`;
}

/**
 * Generate a milestone ID
 */
export function generatePlanningMilestoneId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `pms_${timestamp}_${random}`;
}

// ============================================================================
// Readiness Checks
// ============================================================================

export interface PlanningProgramReadinessResult {
  isReady: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Deterministic check for program readiness
 * Program is ready when it has minimal required fields
 */
export function isPlanningProgramReady(program: PlanningProgram): PlanningProgramReadinessResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!program.title || program.title.trim().length === 0) {
    missing.push('Title is required');
  }

  if (!program.scope.summary || program.scope.summary.trim().length === 0) {
    missing.push('Summary is required');
  }

  // Must have at least 1 deliverable OR 1 milestone
  const hasDeliverables = program.scope.deliverables.length > 0;
  const hasMilestones = program.planDetails.milestones.length > 0;
  if (!hasDeliverables && !hasMilestones) {
    missing.push('At least one deliverable or milestone is required');
  }

  // Warnings (not blocking)
  if (!program.success.primaryConversionAction) {
    warnings.push('No primary conversion action defined');
  }

  if (program.scope.workstreams.length === 0) {
    warnings.push('No workstreams selected');
  }

  if (program.success.kpis.length === 0) {
    warnings.push('No KPIs defined');
  }

  return {
    isReady: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Check if a program can be committed (creates Work)
 */
export function canCommitPlanningProgram(program: PlanningProgram): { canCommit: boolean; reason?: string } {
  // Must be in ready status
  if (program.status !== 'ready') {
    return { canCommit: false, reason: 'Program must be in Ready status to commit' };
  }

  // Must pass readiness checks
  const readiness = isPlanningProgramReady(program);
  if (!readiness.isReady) {
    return { canCommit: false, reason: readiness.missing.join(', ') };
  }

  return { canCommit: true };
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Get display label for program status
 */
export function getPlanningProgramStatusLabel(status: PlanningProgramStatus): string {
  return PLANNING_PROGRAM_STATUS_LABELS[status] || status;
}

/**
 * Get color for program status badge
 */
export function getPlanningProgramStatusColor(status: PlanningProgramStatus): string {
  return PLANNING_PROGRAM_STATUS_COLORS[status] || 'gray';
}

/**
 * Get allowed status transitions
 */
export function getAllowedPlanningStatusTransitions(currentStatus: PlanningProgramStatus): PlanningProgramStatus[] {
  switch (currentStatus) {
    case 'draft':
      return ['ready', 'archived'];
    case 'ready':
      return ['draft', 'committed', 'paused', 'archived'];
    case 'committed':
      return ['paused', 'archived'];
    case 'paused':
      return ['ready', 'committed', 'archived'];
    case 'archived':
      return ['draft']; // Allow restoration
    default:
      return [];
  }
}

// ============================================================================
// Sorting & Filtering
// ============================================================================

const PLANNING_STATUS_PRIORITY: Record<PlanningProgramStatus, number> = {
  committed: 1,
  ready: 2,
  draft: 3,
  paused: 4,
  archived: 5,
};

/**
 * Sort programs by relevance (status priority, then updated date)
 */
export function sortPlanningProgramsByRelevance(programs: PlanningProgram[]): PlanningProgram[] {
  return [...programs].sort((a, b) => {
    // First by status priority
    const statusDiff = PLANNING_STATUS_PRIORITY[a.status] - PLANNING_STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by updated date (most recent first)
    const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bDate - aDate;
  });
}

/**
 * Group programs by status
 */
export function groupPlanningProgramsByStatus(programs: PlanningProgram[]): Record<PlanningProgramStatus, PlanningProgram[]> {
  const result: Record<PlanningProgramStatus, PlanningProgram[]> = {
    draft: [],
    ready: [],
    committed: [],
    paused: [],
    archived: [],
  };

  for (const program of programs) {
    result[program.status].push(program);
  }

  return result;
}

// ============================================================================
// Channel/Workstream Inference
// ============================================================================

const WORKSTREAM_KEYWORDS: Record<WorkstreamType, string[]> = {
  content: ['content', 'blog', 'article', 'thought leadership', 'whitepaper', 'ebook', 'guide'],
  website: ['website', 'web', 'landing page', 'ux', 'ui', 'design', 'user experience'],
  seo: ['seo', 'search', 'organic', 'ranking', 'keyword', 'serp'],
  email: ['email', 'newsletter', 'drip', 'automation', 'nurture'],
  partnerships: ['partner', 'affiliate', 'referral', 'co-marketing', 'alliance'],
  paid_media: ['paid', 'ppc', 'advertising', 'ads', 'media', 'spend', 'budget', 'campaign'],
  social: ['social', 'linkedin', 'twitter', 'facebook', 'instagram', 'tiktok'],
  brand: ['brand', 'identity', 'positioning', 'messaging', 'voice', 'tone'],
  analytics: ['analytics', 'tracking', 'measurement', 'reporting', 'dashboard', 'data'],
  conversion: ['conversion', 'cro', 'optimization', 'funnel', 'a/b test', 'experiment'],
  ops: ['operations', 'process', 'workflow', 'automation', 'integration', 'tool'],
  other: [],
};

/**
 * Infer workstreams from text content (deterministic, no LLM)
 */
export function inferWorkstreams(text: string): WorkstreamType[] {
  const lowerText = text.toLowerCase();
  const matched: WorkstreamType[] = [];

  for (const [workstream, keywords] of Object.entries(WORKSTREAM_KEYWORDS)) {
    if (workstream === 'other') continue;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matched.push(workstream as WorkstreamType);
        break; // Only add each workstream once
      }
    }
  }

  return matched.length > 0 ? matched : ['other'];
}

/**
 * Map TacticChannel to WorkstreamType
 */
export function tacticChannelToWorkstream(channel: string): WorkstreamType {
  const mapping: Record<string, WorkstreamType> = {
    seo: 'seo',
    content: 'content',
    website: 'website',
    media: 'paid_media',
    social: 'social',
    email: 'email',
    brand: 'brand',
    analytics: 'analytics',
    conversion: 'conversion',
    other: 'other',
  };
  return mapping[channel] || 'other';
}

// ============================================================================
// AI CO-PLANNER: Draft Proposals
// ============================================================================
// Proposals are AI-generated drafts that require explicit user approval
// before being applied to the program. This ensures human oversight.

export const ProposalStatusSchema = z.enum(['proposed', 'applied', 'rejected']);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ProposalTypeSchema = z.enum([
  'deliverables',
  'milestones',
  'kpis',
  'risks',
  'dependencies',
  'summary',
  'full_program',
]);
export type ProposalType = z.infer<typeof ProposalTypeSchema>;

// ============================================================================
// Proposal Payload Contracts (Strict JSON)
// ============================================================================

// Deliverable proposal item
export const ProposedDeliverableSchema = z.object({
  title: z.string(),
  description: z.string(),
  effort: z.enum(['S', 'M', 'L']),
  inputs: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  kpisLinked: z.array(z.string()).optional(),
});
export type ProposedDeliverable = z.infer<typeof ProposedDeliverableSchema>;

// Milestone proposal item
export const ProposedMilestoneSchema = z.object({
  title: z.string(),
  targetWeek: z.number().optional(),
  description: z.string(),
  deliverablesLinked: z.array(z.string()).optional(),
});
export type ProposedMilestone = z.infer<typeof ProposedMilestoneSchema>;

// KPI proposal item
export const ProposedKPISchema = z.object({
  name: z.string(),
  target: z.string(),
  measurementMethod: z.string(),
});
export type ProposedKPI = z.infer<typeof ProposedKPISchema>;

// Risk proposal item
export const ProposedRiskSchema = z.object({
  risk: z.string(),
  impact: z.enum(['low', 'med', 'high']),
  mitigation: z.string(),
});
export type ProposedRisk = z.infer<typeof ProposedRiskSchema>;

// Dependency proposal item
export const ProposedDependencySchema = z.object({
  dependency: z.string(),
  whyNeeded: z.string(),
  owner: z.string().optional(),
});
export type ProposedDependency = z.infer<typeof ProposedDependencySchema>;

// Summary proposal
export const ProposedSummarySchema = z.object({
  oneLiner: z.string(),
  outcomes: z.array(z.string()),
  scopeIn: z.array(z.string()),
  scopeOut: z.array(z.string()),
});
export type ProposedSummary = z.infer<typeof ProposedSummarySchema>;

// Outcome (for full program)
export const ProposedOutcomeSchema = z.object({
  name: z.string(),
  metric: z.string(),
  target: z.string(),
  timeframe: z.string().optional(),
});
export type ProposedOutcome = z.infer<typeof ProposedOutcomeSchema>;

// Execution phase (for full program)
export const ProposedPhaseSchema = z.object({
  phase: z.string(),
  goal: z.string(),
  deliverablesLinked: z.array(z.string()).optional(),
});
export type ProposedPhase = z.infer<typeof ProposedPhaseSchema>;

// Full Program Draft payload
export const FullProgramDraftPayloadSchema = z.object({
  summary: z.object({
    oneLiner: z.string(),
    rationale: z.string(),
    scopeIn: z.array(z.string()),
    scopeOut: z.array(z.string()),
  }),
  outcomes: z.array(ProposedOutcomeSchema).default([]),
  kpis: z.array(ProposedKPISchema).default([]),
  deliverables: z.array(ProposedDeliverableSchema).default([]),
  milestones: z.array(ProposedMilestoneSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  dependencies: z.array(ProposedDependencySchema).default([]),
  risks: z.array(ProposedRiskSchema).default([]),
  executionPlan: z.array(ProposedPhaseSchema).default([]),
});
export type FullProgramDraftPayload = z.infer<typeof FullProgramDraftPayloadSchema>;

// Individual payload schemas by type
export const DeliverablesPayloadSchema = z.array(ProposedDeliverableSchema);
export const MilestonesPayloadSchema = z.array(ProposedMilestoneSchema);
export const KpisPayloadSchema = z.array(ProposedKPISchema);
export const RisksPayloadSchema = z.array(ProposedRiskSchema);
export const DependenciesPayloadSchema = z.array(ProposedDependencySchema);

// Union payload type
export type ProposalPayload =
  | ProposedDeliverable[]
  | ProposedMilestone[]
  | ProposedKPI[]
  | ProposedRisk[]
  | ProposedDependency[]
  | ProposedSummary
  | FullProgramDraftPayload;

// ============================================================================
// Program Draft Proposal (Main Entity)
// ============================================================================

export const ProgramDraftProposalSchema = z.object({
  id: z.string(),
  programId: z.string(),
  type: ProposalTypeSchema,
  payload: z.unknown(), // Validated separately based on type
  instructions: z.string().optional(), // User-provided instructions
  createdAt: z.string(),
  status: ProposalStatusSchema.default('proposed'),
  appliedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
});
export type ProgramDraftProposal = z.infer<typeof ProgramDraftProposalSchema>;

/**
 * Generate a unique proposal ID
 */
export function generateProposalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `prop_${timestamp}_${random}`;
}

/**
 * Validate proposal payload based on type
 */
export function validateProposalPayload(
  type: ProposalType,
  payload: unknown
): { success: true; data: ProposalPayload } | { success: false; error: string } {
  try {
    switch (type) {
      case 'deliverables':
        return { success: true, data: DeliverablesPayloadSchema.parse(payload) };
      case 'milestones':
        return { success: true, data: MilestonesPayloadSchema.parse(payload) };
      case 'kpis':
        return { success: true, data: KpisPayloadSchema.parse(payload) };
      case 'risks':
        return { success: true, data: RisksPayloadSchema.parse(payload) };
      case 'dependencies':
        return { success: true, data: DependenciesPayloadSchema.parse(payload) };
      case 'summary':
        return { success: true, data: ProposedSummarySchema.parse(payload) };
      case 'full_program':
        return { success: true, data: FullProgramDraftPayloadSchema.parse(payload) };
      default:
        return { success: false, error: `Unknown proposal type: ${type}` };
    }
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      : 'Invalid payload';
    return { success: false, error: message };
  }
}

// ============================================================================
// Apply Options
// ============================================================================

export interface ApplyProposalOptions {
  // For full_program type: apply only selected sections
  sections?: ProposalType[];
  // Whether to overwrite existing content or merge
  mergeMode?: 'overwrite' | 'merge';
}

// ============================================================================
// Normalization & Dedupe Helpers
// ============================================================================

/**
 * Normalize a title for comparison (lowercase, trim, remove extra spaces/punctuation)
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if two titles are effectively the same
 */
export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

/**
 * Dedupe deliverables by normalized title, preferring existing items
 */
export function dedupeDeliverables(
  existing: PlanningDeliverable[],
  proposed: ProposedDeliverable[]
): { added: ProposedDeliverable[]; skipped: string[] } {
  const existingTitles = new Set(existing.map(d => normalizeTitle(d.title)));
  const added: ProposedDeliverable[] = [];
  const skipped: string[] = [];

  for (const prop of proposed) {
    const normalized = normalizeTitle(prop.title);
    if (existingTitles.has(normalized)) {
      skipped.push(prop.title);
    } else {
      added.push(prop);
      existingTitles.add(normalized); // Prevent duplicates within proposed
    }
  }

  return { added, skipped };
}

/**
 * Dedupe milestones by normalized title
 */
export function dedupeMilestones(
  existing: PlanningMilestone[],
  proposed: ProposedMilestone[]
): { added: ProposedMilestone[]; skipped: string[] } {
  const existingTitles = new Set(existing.map(m => normalizeTitle(m.title)));
  const added: ProposedMilestone[] = [];
  const skipped: string[] = [];

  for (const prop of proposed) {
    const normalized = normalizeTitle(prop.title);
    if (existingTitles.has(normalized)) {
      skipped.push(prop.title);
    } else {
      added.push(prop);
      existingTitles.add(normalized);
    }
  }

  return { added, skipped };
}

/**
 * Convert ProposedDeliverable to PlanningDeliverable
 */
export function proposedToDeliverable(proposed: ProposedDeliverable): PlanningDeliverable {
  return {
    id: generatePlanningDeliverableId(),
    title: proposed.title,
    description: proposed.description,
    type: 'other',
    status: 'planned',
  };
}

/**
 * Convert ProposedMilestone to PlanningMilestone
 */
export function proposedToMilestone(proposed: ProposedMilestone): PlanningMilestone {
  return {
    id: generatePlanningMilestoneId(),
    title: proposed.title,
    status: 'pending',
    // Convert targetWeek to a date string if provided
    dueDate: proposed.targetWeek
      ? new Date(Date.now() + proposed.targetWeek * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined,
  };
}

/**
 * Convert ProposedKPI to PlanningProgramKPI
 */
export function proposedToKPI(proposed: ProposedKPI): PlanningProgramKPI {
  return {
    key: proposed.name.toLowerCase().replace(/\s+/g, '_'),
    label: proposed.name,
    target: proposed.target,
  };
}
