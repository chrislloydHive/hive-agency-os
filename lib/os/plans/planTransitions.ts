// lib/os/plans/planTransitions.ts
// Plan lifecycle state machine and transition validation
//
// Plan Lifecycle:
//   draft → in_review → approved → archived
//          ↑         ↓
//          └─────────┘ (via proposal apply)
//
// Valid transitions:
// - draft → in_review (submit for review)
// - draft → archived (discard)
// - in_review → approved (approve)
// - in_review → draft (reject/request changes)
// - in_review → archived (discard)
// - approved → draft (via proposal apply - requires re-approval)
// - approved → archived (archive)

import type {
  PlanStatus,
  Plan,
  MediaPlan,
  ContentPlan,
  MediaPlanSections,
  ContentPlanSections,
} from '@/lib/types/plan';

// ============================================================================
// Transition Rules
// ============================================================================

/**
 * Valid transitions from each status
 */
const VALID_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['approved', 'draft', 'archived'],
  approved: ['draft', 'archived'], // draft only via proposal apply
  archived: [], // Terminal state
};

/**
 * Check if a transition from one status to another is valid
 */
export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get allowed transitions from a status
 */
export function getAllowedTransitions(from: PlanStatus): PlanStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

// ============================================================================
// Transition Validation
// ============================================================================

/**
 * Validation result for plan transitions
 */
export interface TransitionValidation {
  valid: boolean;
  issues: string[];
}

/**
 * Validate that a plan can be submitted for review
 * Requirements:
 * - Plan must have a goal statement OR executive summary
 * - Plan must have at least one defined item (channel, campaign, pillar, etc.)
 */
export function validatePlanForSubmit(plan: Plan): TransitionValidation {
  const issues: string[] = [];

  if (plan.status !== 'draft') {
    issues.push(`Cannot submit plan in ${plan.status} status (must be draft)`);
    return { valid: false, issues };
  }

  // Check for Media Plan specific requirements
  if ('channelMix' in plan.sections) {
    const sections = plan.sections as MediaPlanSections;

    // Must have summary content
    if (!sections.summary.goalStatement && !sections.summary.executiveSummary) {
      issues.push('Plan must have a goal statement or executive summary');
    }

    // Must have at least one channel or campaign
    if (sections.channelMix.length === 0 && sections.campaigns.length === 0) {
      issues.push('Plan must have at least one channel allocation or campaign');
    }
  }

  // Check for Content Plan specific requirements
  if ('pillars' in plan.sections) {
    const sections = plan.sections as ContentPlanSections;

    // Must have summary content
    if (!sections.summary.goalStatement && !sections.summary.editorialThesis) {
      issues.push('Plan must have a goal statement or editorial thesis');
    }

    // Must have at least one pillar or calendar item
    if (sections.pillars.length === 0 && sections.calendar.length === 0) {
      issues.push('Plan must have at least one content pillar or calendar item');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate that a plan can be approved
 * Requirements:
 * - Plan must be in 'in_review' status
 * - Plan must pass submission requirements
 * - Approval checklist should be mostly complete (warning, not blocking)
 */
export function validatePlanForApproval(plan: Plan): TransitionValidation {
  const issues: string[] = [];

  if (plan.status !== 'in_review') {
    issues.push(`Cannot approve plan in ${plan.status} status (must be in_review)`);
    return { valid: false, issues };
  }

  // Run submission validation first
  const submitValidation = validatePlanForSubmit({
    ...plan,
    status: 'draft', // Temporarily set to draft to run submission checks
  });

  if (!submitValidation.valid) {
    issues.push(...submitValidation.issues);
  }

  // Check approval checklist (warning, not blocking)
  const approvals = plan.sections.approvals;
  if (approvals.checklist.length > 0) {
    const checkedCount = approvals.checklist.filter(item => item.checked).length;
    const totalCount = approvals.checklist.length;
    if (checkedCount < totalCount) {
      // This is a warning, not a blocking issue
      // We could add a separate warnings array if needed
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate a status transition
 */
export function validateTransition(
  plan: Plan,
  targetStatus: PlanStatus
): TransitionValidation {
  const issues: string[] = [];

  // Check if transition is allowed
  if (!canTransition(plan.status, targetStatus)) {
    issues.push(
      `Cannot transition from ${plan.status} to ${targetStatus}`
    );
    return { valid: false, issues };
  }

  // Additional validation based on target status
  switch (targetStatus) {
    case 'in_review':
      return validatePlanForSubmit(plan);
    case 'approved':
      return validatePlanForApproval(plan);
    case 'draft':
      // Returning to draft is always allowed (from in_review or via proposal)
      return { valid: true, issues: [] };
    case 'archived':
      // Archiving is always allowed
      return { valid: true, issues: [] };
    default:
      return { valid: true, issues: [] };
  }
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Check if a plan is editable (can modify sections)
 */
export function isPlanEditable(status: PlanStatus): boolean {
  return status === 'draft';
}

/**
 * Check if a plan is locked (approved or archived)
 */
export function isPlanLocked(status: PlanStatus): boolean {
  return status === 'approved' || status === 'archived';
}

/**
 * Check if a plan is archived (terminal state)
 */
export function isArchived(status: PlanStatus): boolean {
  return status === 'archived';
}

/**
 * Check if a plan can receive proposals
 */
export function canReceiveProposals(status: PlanStatus): boolean {
  return status === 'approved';
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: PlanStatus): string {
  const labels: Record<PlanStatus, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    approved: 'Approved',
    archived: 'Archived',
  };
  return labels[status] ?? status;
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: PlanStatus): string {
  const colors: Record<PlanStatus, string> = {
    draft: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    in_review: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    archived: 'text-slate-500 bg-slate-600/10 border-slate-600/30',
  };
  return colors[status] ?? 'text-slate-400 bg-slate-500/10';
}
