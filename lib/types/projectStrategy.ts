// lib/types/projectStrategy.ts
// Project-scoped strategy types
//
// ProjectStrategy is a narrower, project-focused strategy that:
// - Inherits context from the active CompanyStrategy at creation
// - Has project-specific objectives and strategic bets
// - Collapses into a CreativeBrief as the terminal artifact
// - Becomes locked after brief approval

import type {
  StrategyObjective,
  StrategicBet,
  StrategyPlay,
  FieldProvenance,
} from './strategy';

// ============================================================================
// Project Strategy Types
// ============================================================================

/**
 * Project Strategy status
 */
export type ProjectStrategyStatus =
  | 'draft'             // Initial state, being edited
  | 'ready_for_brief'   // Ready to generate brief (has accepted bets)
  | 'brief_generated'   // Brief has been generated
  | 'locked';           // Locked after brief approval

/**
 * Project-scoped strategic frame
 * Narrower than company frame - focused on project deliverable
 */
export interface ProjectStrategicFrame {
  // Project-specific frame fields
  projectObjective?: string;      // What this project aims to achieve
  targetAudience?: string;        // Audience for this specific deliverable
  coreMessage?: string;           // Key message/value prop for this project
  tone?: string;                  // Tone/voice for this deliverable
  constraints?: string;           // Project-specific constraints

  // Success criteria
  successMetrics?: string[];

  // Non-goals for this project
  nonGoals?: string[];

  // Provenance tracking
  provenance?: {
    [fieldKey: string]: FieldProvenance;
  };
}

/**
 * Snapshot of company strategy at project creation (for inheritance)
 */
export interface CompanyStrategySnapshot {
  companyStrategyId: string;
  snapshotAt: string;
  // Inherited frame fields
  audience?: string;
  offering?: string;
  valueProp?: string;
  positioning?: string;
  constraints?: string;
}

/**
 * Tactic for project strategy (lightweight)
 * Reuses StrategyPlay structure but simplified for project scope
 */
export type ProjectTactic = StrategyPlay;

/**
 * Project Strategy entity
 * Narrower scope than CompanyStrategy - focused on a single deliverable
 */
export interface ProjectStrategy {
  id: string;
  companyId: string;
  projectId: string;

  // Inherited from company strategy at creation
  inheritedSnapshot?: CompanyStrategySnapshot;

  // Project-specific frame (can override inherited values)
  strategicFrame: ProjectStrategicFrame;

  // Objectives (project-scoped success criteria)
  objectives: StrategyObjective[];

  // Strategic Bets (project-scoped decisions)
  // Uses same schema: draft/accepted/rejected with pros/cons/tradeoffs
  strategicBets: StrategicBet[];

  // Tactics (optional, lightweight execution items)
  tactics: ProjectTactic[];

  // Status
  status: ProjectStrategyStatus;

  // Lock state (locked when brief is approved)
  isLocked: boolean;
  lockedAt?: string;
  lockedReason?: string;          // e.g., "Brief approved"

  // Provenance
  provenance?: {
    generatedByAI: boolean;
    basedOnCompanyStrategy: boolean;
    basedOnHashes?: {
      companyContextHash?: string;
      companyStrategyHash?: string;
    };
    generatedAt?: string;
  };

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Create project strategy request
 */
export interface CreateProjectStrategyInput {
  companyId: string;
  projectId: string;
  inheritFromCompanyStrategy?: boolean;
}

/**
 * Update project strategy request
 */
export interface UpdateProjectStrategyInput {
  strategicFrame?: Partial<ProjectStrategicFrame>;
  objectives?: StrategyObjective[];
  strategicBets?: StrategicBet[];
  tactics?: ProjectTactic[];
  status?: ProjectStrategyStatus;
}

/**
 * AI propose project strategy request
 */
export interface AIProposeProjectStrategyRequest {
  companyId: string;
  projectId: string;
  projectType: string;
  action: 'propose_frame' | 'propose_objectives' | 'propose_bets' | 'propose_tactics';
  guidance?: string;
}

/**
 * AI propose project strategy response
 */
export interface AIProposeProjectStrategyResponse {
  proposal: {
    strategicFrame?: ProjectStrategicFrame;
    objectives?: Omit<StrategyObjective, 'id'>[];
    strategicBets?: Omit<StrategicBet, 'id'>[];
    tactics?: Omit<ProjectTactic, 'id'>[];
    reasoning: string;
  };
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  inputsUsed: {
    companyContext: boolean;
    companyStrategy: boolean;
    gapReport: boolean;
  };
  isDraft: true;
  requiresApproval: true;
}

// ============================================================================
// Display Constants
// ============================================================================

export const PROJECT_STRATEGY_STATUS_LABELS: Record<ProjectStrategyStatus, string> = {
  draft: 'Draft',
  ready_for_brief: 'Ready for Brief',
  brief_generated: 'Brief Generated',
  locked: 'Locked',
};

export const PROJECT_STRATEGY_STATUS_COLORS: Record<ProjectStrategyStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  ready_for_brief: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  brief_generated: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  locked: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if project strategy has at least one accepted bet
 */
export function hasAcceptedBets(strategy: ProjectStrategy): boolean {
  return strategy.strategicBets.some((bet) => bet.status === 'accepted');
}

/**
 * Count accepted bets in strategy
 */
export function countAcceptedBets(strategy: ProjectStrategy): number {
  return strategy.strategicBets.filter((bet) => bet.status === 'accepted').length;
}

/**
 * Get accepted bets from strategy
 */
export function getAcceptedBets(strategy: ProjectStrategy): StrategicBet[] {
  return strategy.strategicBets.filter((bet) => bet.status === 'accepted');
}

/**
 * Check if frame has minimum completeness for brief generation
 */
export function isFrameComplete(frame: ProjectStrategicFrame): boolean {
  return Boolean(
    frame.projectObjective &&
    frame.targetAudience &&
    frame.coreMessage
  );
}

/**
 * Calculate project strategy readiness for brief generation
 */
export function calculateStrategyReadiness(strategy: ProjectStrategy): {
  ready: boolean;
  frameComplete: boolean;
  hasObjectives: boolean;
  hasAcceptedBets: boolean;
  blockedReason?: string;
} {
  const frameComplete = isFrameComplete(strategy.strategicFrame);
  const hasObjectivesFlag = strategy.objectives.length > 0;
  const hasAcceptedBetsFlag = hasAcceptedBets(strategy);

  const ready = frameComplete && hasObjectivesFlag && hasAcceptedBetsFlag;

  let blockedReason: string | undefined;
  if (!frameComplete) {
    blockedReason = 'Complete the strategic frame (objective, audience, message)';
  } else if (!hasObjectivesFlag) {
    blockedReason = 'Add at least one objective';
  } else if (!hasAcceptedBetsFlag) {
    blockedReason = 'Accept at least one strategic bet';
  }

  return {
    ready,
    frameComplete,
    hasObjectives: hasObjectivesFlag,
    hasAcceptedBets: hasAcceptedBetsFlag,
    blockedReason,
  };
}
