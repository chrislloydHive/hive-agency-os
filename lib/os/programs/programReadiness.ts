// lib/os/programs/programReadiness.ts
// Deterministic Program Readiness Gate
//
// Computes readiness score and status from program fields alone.
// No AI/LLM calls - purely deterministic based on field presence and quality.
//
// Status levels:
// - 'not_ready': Missing critical fields (title, summary)
// - 'needs_structure': Has basics but no deliverables/milestones
// - 'ready': Has all required structure to commit

import type { PlanningProgram } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

export type ReadinessStatus = 'not_ready' | 'needs_structure' | 'ready';

export interface ProgramReadiness {
  /** Score from 0-100 */
  score: number;
  /** Overall status */
  status: ReadinessStatus;
  /** Human-readable reasons for the current status */
  reasons: string[];
  /** Specific missing items that can be filled */
  missing: string[];
}

// ============================================================================
// Scoring Weights
// ============================================================================

const WEIGHTS = {
  // Critical (missing = not_ready)
  title: 5,
  summary: 5,

  // Structure (missing = needs_structure)
  deliverables: 20,
  milestones: 15,

  // Important but not blocking
  kpis: 10,
  owner: 10,
  dates: 10,
  constraints: 5,
  assumptions: 5,
  dependencies: 5,
  workstreams: 5,
  executionPlan: 5,
} as const;

// Total possible = 100
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);

// Thresholds
const READY_THRESHOLD = 65;
const NEEDS_STRUCTURE_THRESHOLD = 30;

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute readiness score and status for a Planning Program
 *
 * Deterministic - uses only program fields, no external calls.
 */
export function computeProgramReadiness(program: PlanningProgram): ProgramReadiness {
  const missing: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  // -------------------------------------------------------------------------
  // Critical Fields (title, summary)
  // -------------------------------------------------------------------------

  const hasTitle = program.title && program.title.trim().length > 0;
  if (hasTitle) {
    score += WEIGHTS.title;
  } else {
    missing.push('title');
  }

  const hasSummary = program.scope.summary && program.scope.summary.trim().length > 0;
  if (hasSummary) {
    score += WEIGHTS.summary;
  } else {
    missing.push('summary');
  }

  // -------------------------------------------------------------------------
  // Structure Fields (deliverables, milestones)
  // -------------------------------------------------------------------------

  const deliverableCount = program.scope.deliverables.length;
  if (deliverableCount >= 3) {
    score += WEIGHTS.deliverables;
  } else if (deliverableCount >= 1) {
    score += Math.round(WEIGHTS.deliverables * 0.6);
    missing.push('deliverables'); // Need more
  } else {
    missing.push('deliverables');
  }

  const milestoneCount = program.planDetails.milestones.length;
  if (milestoneCount >= 2) {
    score += WEIGHTS.milestones;
  } else if (milestoneCount === 1) {
    score += Math.round(WEIGHTS.milestones * 0.5);
    missing.push('milestones');
  } else {
    missing.push('milestones');
  }

  // -------------------------------------------------------------------------
  // Important Fields
  // -------------------------------------------------------------------------

  const kpiCount = program.success.kpis.length;
  if (kpiCount >= 2) {
    score += WEIGHTS.kpis;
  } else if (kpiCount === 1) {
    score += Math.round(WEIGHTS.kpis * 0.5);
    missing.push('kpis');
  } else {
    missing.push('kpis');
  }

  const hasOwner = program.planDetails.owner && program.planDetails.owner.trim().length > 0;
  if (hasOwner) {
    score += WEIGHTS.owner;
  } else {
    missing.push('owner');
  }

  // Check for dates on deliverables or milestones
  const hasDeliverableDates = program.scope.deliverables.some((d) => d.dueDate);
  const hasMilestoneDates = program.planDetails.milestones.some((m) => m.dueDate);
  if (hasDeliverableDates || hasMilestoneDates) {
    score += WEIGHTS.dates;
  } else {
    missing.push('dates');
  }

  // -------------------------------------------------------------------------
  // Nice-to-have Fields
  // -------------------------------------------------------------------------

  if (program.scope.constraints.length > 0) {
    score += WEIGHTS.constraints;
  } else {
    missing.push('constraints');
  }

  if (program.scope.assumptions.length > 0) {
    score += WEIGHTS.assumptions;
  } else {
    missing.push('assumptions');
  }

  if (program.scope.dependencies.length > 0) {
    score += WEIGHTS.dependencies;
  } else {
    missing.push('dependencies');
  }

  if (program.scope.workstreams.length > 0) {
    score += WEIGHTS.workstreams;
  }

  // Check for execution plan phases (stored in planDetails.sequencingNotes or similar)
  // For now, check if there's sequencing notes or if milestones have structure
  const hasExecutionPlan =
    (program.planDetails.sequencingNotes && program.planDetails.sequencingNotes.trim().length > 20) ||
    milestoneCount >= 3;
  if (hasExecutionPlan) {
    score += WEIGHTS.executionPlan;
  }

  // -------------------------------------------------------------------------
  // Determine Status
  // -------------------------------------------------------------------------

  let status: ReadinessStatus;

  // Critical fields missing = not_ready
  if (!hasTitle || !hasSummary) {
    status = 'not_ready';
    if (!hasTitle) reasons.push('Missing program title');
    if (!hasSummary) reasons.push('Missing program summary');
  }
  // No structure = needs_structure
  else if (deliverableCount === 0 && milestoneCount === 0) {
    status = 'needs_structure';
    reasons.push('No deliverables or milestones defined');
  }
  // Score-based determination
  else if (score >= READY_THRESHOLD) {
    status = 'ready';
    if (missing.length > 0) {
      reasons.push(`Ready to commit (${missing.length} optional items could be added)`);
    } else {
      reasons.push('All recommended fields complete');
    }
  } else if (score >= NEEDS_STRUCTURE_THRESHOLD) {
    status = 'needs_structure';
    reasons.push(`Score ${score}/${TOTAL_WEIGHT} - needs more detail`);
    if (deliverableCount < 3) reasons.push('Add more deliverables');
    if (milestoneCount < 2) reasons.push('Add milestones');
    if (kpiCount < 2) reasons.push('Define KPIs');
  } else {
    status = 'not_ready';
    reasons.push(`Score ${score}/${TOTAL_WEIGHT} - missing critical content`);
  }

  // Normalize score to 0-100
  const normalizedScore = Math.round((score / TOTAL_WEIGHT) * 100);

  return {
    score: normalizedScore,
    status,
    reasons,
    missing,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable label for readiness status
 */
export function getReadinessStatusLabel(status: ReadinessStatus): string {
  const labels: Record<ReadinessStatus, string> = {
    not_ready: 'Not Ready',
    needs_structure: 'Needs Structure',
    ready: 'Ready',
  };
  return labels[status];
}

/**
 * Get color for readiness status (Tailwind classes)
 */
export function getReadinessStatusColor(status: ReadinessStatus): string {
  const colors: Record<ReadinessStatus, string> = {
    not_ready: 'red',
    needs_structure: 'amber',
    ready: 'emerald',
  };
  return colors[status];
}

/**
 * Get human-readable label for missing item
 */
export function getMissingItemLabel(item: string): string {
  const labels: Record<string, string> = {
    title: 'Program title',
    summary: 'Program summary',
    deliverables: 'Deliverables (3+ recommended)',
    milestones: 'Milestones (2+ recommended)',
    kpis: 'KPIs (2+ recommended)',
    owner: 'Program owner',
    dates: 'Due dates',
    constraints: 'Constraints',
    assumptions: 'Assumptions',
    dependencies: 'Dependencies',
  };
  return labels[item] || item;
}

/**
 * Get AI-fillable missing items (excludes owner, dates which are user-specific)
 */
export function getAIFillableMissing(missing: string[]): string[] {
  const aiFillable = new Set([
    'deliverables',
    'milestones',
    'kpis',
    'constraints',
    'assumptions',
    'dependencies',
  ]);
  return missing.filter((item) => aiFillable.has(item));
}

/**
 * Check if program can be committed based on readiness
 */
export function canCommitFromReadiness(readiness: ProgramReadiness): boolean {
  return readiness.status === 'ready';
}
