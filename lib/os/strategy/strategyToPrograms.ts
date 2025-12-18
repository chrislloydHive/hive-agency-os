// lib/os/strategy/strategyToPrograms.ts
// Strategy → Programs → Work Handoff Mapping Contract
//
// WHY: Defines the stable contract for converting Strategy into executable Programs and Work.
// Programs are the "how" layer between Strategy ("what") and Work ("do it").
//
// FLOW: Strategy → StrategyProgramProposal (draft) → Apply → Programs + Work Items
//
// KEY INVARIANT: All downstream objects (Programs, Initiatives, Work) maintain
// bidirectional linkage back to their upstream sources (Strategy, Objectives, Priorities, Tactics).

import type { ProgramType, ProgramPriority, ProgramPhase, ProgramReadinessGate } from '@/lib/types/program';
import type { WorkEffort, WorkPriority, WorkCategory } from '@/lib/types/work';

// ============================================================================
// Stable Key Generation
// ============================================================================

/**
 * Generate stable key for deduplication.
 * Normalizes titles by lowercasing, trimming, and replacing spaces with hyphens.
 */
function normalizeForKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50); // Limit length for sanity
}

/**
 * Stable key for a Program: companyId + strategyId + programType
 */
export function generateProgramKey(
  companyId: string,
  strategyId: string,
  programType: ProgramType | ExtendedProgramType
): string {
  return `${companyId}::${strategyId}::${programType}`;
}

/**
 * Stable key for an Initiative: programKey + normalizedTitle
 */
export function generateInitiativeKey(
  programKey: string,
  title: string
): string {
  return `${programKey}::${normalizeForKey(title)}`;
}

/**
 * Stable key for a Work Item: initiativeKey + normalizedTitle
 */
export function generateWorkKey(
  initiativeKey: string,
  workTitle: string
): string {
  return `${initiativeKey}::${normalizeForKey(workTitle)}`;
}

// ============================================================================
// Extended Program Types (beyond current website/content)
// ============================================================================

/**
 * Extended program types for Strategy handoff
 * Superset of ProgramType - includes future program types
 */
export type ExtendedProgramType =
  | 'website'
  | 'content'
  | 'seo'
  | 'media'
  | 'brand'
  | 'analytics'
  | 'demand';

/**
 * Map program type to work category
 */
export const PROGRAM_TYPE_TO_CATEGORY: Record<ExtendedProgramType, WorkCategory> = {
  website: 'website',
  content: 'content',
  seo: 'seo',
  media: 'demand',
  brand: 'brand',
  analytics: 'analytics',
  demand: 'demand',
};

// ============================================================================
// Initiative Types
// ============================================================================

/**
 * Effort sizing for initiatives
 */
export type InitiativeEffort = 'S' | 'M' | 'L';

/**
 * Sequencing for initiatives (Now/Next/Later)
 */
export type InitiativeSequence = 'now' | 'next' | 'later';

/**
 * A proposed work item within an initiative (draft)
 */
export interface ProposedWorkItem {
  /** Stable key for deduplication */
  workKey: string;
  /** Short, actionable title (6-10 words) */
  title: string;
  /** What needs to be done (2-3 sentences) */
  description: string;
  /** Step-by-step implementation guide */
  howToImplement?: string;
  /** Acceptance criteria for completion */
  acceptanceCriteria: string[];
  /** Effort estimate */
  effort: WorkEffort;
  /** Expected impact */
  impact: 'high' | 'medium' | 'low';
  /** Suggested priority */
  suggestedPriority: WorkPriority;
  /** Work category/area */
  category: WorkCategory;
  /** Tags for filtering */
  tags: string[];
  /** Why this matters - references objective + strategy rationale */
  whyItMatters: string;
  /** Owner placeholder */
  ownerPlaceholder?: string;
  /** Due date placeholder (relative, e.g., "Week 1", "Sprint 2") */
  dueDatePlaceholder?: string;
}

/**
 * A proposed initiative within a program (draft)
 */
export interface ProposedInitiative {
  /** Stable key for deduplication */
  initiativeKey: string;
  /** Initiative title */
  title: string;
  /** Description of what this initiative achieves */
  description: string;
  /** Expected impact description */
  expectedImpact: string;
  /** Impact level */
  impactLevel: 'high' | 'medium' | 'low';
  /** Dependencies (other initiative titles or external) */
  dependencies: string[];
  /** KPIs to measure success */
  kpis: string[];
  /** Effort estimate */
  effort: InitiativeEffort;
  /** Sequencing (Now/Next/Later) */
  sequence: InitiativeSequence;
  /** Rationale - why this initiative matters */
  rationale: string;
  /** Draft work items for this initiative */
  workItems: ProposedWorkItem[];
  /** Linked objective IDs */
  objectiveIds: string[];
  /** Linked priority IDs */
  priorityIds: string[];
  /** Linked tactic IDs */
  tacticIds: string[];
}

/**
 * A proposed program (draft)
 */
export interface ProposedProgram {
  /** Stable key for deduplication */
  programKey: string;
  /** Program type */
  programType: ExtendedProgramType;
  /** Program title */
  title: string;
  /** Summary of the program */
  summary: string;
  /** Objective framing - why this program exists */
  objectiveFraming: string;
  /** Current state summary - where we are now */
  currentState: string;
  /** Program priorities */
  priorities: ProgramPriority[];
  /** Sequencing phases (derived from initiatives) */
  sequencing: ProgramPhase[];
  /** Readiness gates */
  readinessGates: ProgramReadinessGate[];
  /** Proposed initiatives */
  initiatives: ProposedInitiative[];
  /** Linked objective IDs */
  objectiveIds: string[];
  /** Linked priority IDs */
  priorityIds: string[];
  /** Linked tactic IDs */
  tacticIds: string[];
}

// ============================================================================
// Strategy Program Proposal (Full Draft)
// ============================================================================

/**
 * Source linkage for handoff - tracks what strategy elements feed this proposal
 */
export interface HandoffSourceLinkage {
  strategyId: string;
  strategyTitle: string;
  objectiveIds: string[];
  priorityIds: string[];
  tacticIds: string[];
  /** Hashes for staleness detection */
  basedOnHashes: {
    contextHash: string;
    objectivesHash: string;
    strategyHash: string;
    tacticsHash: string;
  };
}

/**
 * The complete handoff proposal from Strategy → Programs
 */
export interface StrategyProgramProposal {
  /** Unique proposal ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Source linkage back to strategy */
  source: HandoffSourceLinkage;
  /** Proposed programs */
  programs: ProposedProgram[];
  /** AI reasoning for the proposal */
  reasoning: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Warnings or notes */
  warnings: string[];
  /** Created timestamp */
  createdAt: string;
  /** Status */
  status: 'draft' | 'applied' | 'discarded';
}

// ============================================================================
// Apply Result Types
// ============================================================================

/**
 * Result of applying the handoff proposal
 */
export interface HandoffApplyResult {
  success: boolean;
  /** Programs created/updated */
  programs: {
    created: string[];
    updated: string[];
    skipped: string[];
  };
  /** Initiatives created/updated */
  initiatives: {
    created: number;
    updated: number;
    skipped: number;
  };
  /** Work items created */
  workItems: {
    created: string[];
    skipped: string[];
  };
  /** Any errors encountered */
  errors: string[];
}

// ============================================================================
// Work Source for Strategy Handoff
// ============================================================================

/**
 * Extended WorkSource for strategy handoff
 * This extends the existing WorkSource union in work.ts
 */
export interface WorkSourceStrategyHandoff {
  sourceType: 'strategy_handoff';
  /** Strategy ID this work came from */
  strategyId: string;
  /** Strategy title for display */
  strategyTitle: string;
  /** Program ID if created through program */
  programId?: string;
  /** Program type */
  programType?: ExtendedProgramType;
  /** Initiative title */
  initiativeTitle?: string;
  /** Initiative key for deduplication */
  initiativeKey?: string;
  /** Linked objective IDs */
  linkedObjectiveIds: string[];
  /** Linked priority IDs */
  linkedPriorityIds: string[];
  /** Linked tactic IDs */
  linkedTacticIds: string[];
  /** Handoff timestamp */
  handoffAt: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine which program types are relevant for a strategy based on tactics
 */
export function inferProgramTypesFromTactics(
  tacticChannels: string[]
): ExtendedProgramType[] {
  const types = new Set<ExtendedProgramType>();

  for (const channel of tacticChannels) {
    const normalized = channel.toLowerCase();

    if (normalized.includes('website') || normalized.includes('ux') || normalized.includes('conversion')) {
      types.add('website');
    }
    if (normalized.includes('content') || normalized.includes('blog') || normalized.includes('article')) {
      types.add('content');
    }
    if (normalized.includes('seo') || normalized.includes('search')) {
      types.add('seo');
    }
    if (normalized.includes('media') || normalized.includes('paid') || normalized.includes('ads')) {
      types.add('media');
    }
    if (normalized.includes('brand') || normalized.includes('creative')) {
      types.add('brand');
    }
    if (normalized.includes('analytics') || normalized.includes('tracking') || normalized.includes('measurement')) {
      types.add('analytics');
    }
    if (normalized.includes('demand') || normalized.includes('lead') || normalized.includes('funnel')) {
      types.add('demand');
    }
  }

  // Default to website + content if no specific types inferred
  if (types.size === 0) {
    types.add('website');
    types.add('content');
  }

  return Array.from(types);
}

/**
 * Map sequence to phase name
 */
export function sequenceToPhase(sequence: InitiativeSequence): string {
  const mapping: Record<InitiativeSequence, string> = {
    now: 'Phase 1: Immediate',
    next: 'Phase 2: Near-term',
    later: 'Phase 3: Future',
  };
  return mapping[sequence];
}

/**
 * Map impact to work priority
 */
export function impactToPriority(impact: 'high' | 'medium' | 'low'): WorkPriority {
  const mapping: Record<string, WorkPriority> = {
    high: 'P1',
    medium: 'P2',
    low: 'P3',
  };
  return mapping[impact] || 'P2';
}

/**
 * Convert initiative effort to work effort
 */
export function initiativeEffortToWorkEffort(effort: InitiativeEffort): WorkEffort {
  return effort; // Same values: S, M, L
}
