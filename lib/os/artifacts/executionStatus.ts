// lib/os/artifacts/executionStatus.ts
// Execution status derivation for artifacts
//
// Determines whether an artifact has been executed (converted to work items)
// and provides status labels for UI display.

import type { ArtifactUsage } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export type ExecutionState = 'not_started' | 'in_progress' | 'completed';

export interface ExecutionStatus {
  /** Current execution state */
  state: ExecutionState;
  /** Number of work items created from this artifact */
  workItemsCreated: number;
  /** Total expected work items (from last preview, if available) */
  totalExpected: number | null;
  /** Number of completed work items */
  completedWorkItems: number;
  /** Human-readable status label */
  label: string;
  /** Detailed description for UI */
  description: string;
  /** Whether more work items can be created */
  canCreateMore: boolean;
}

// ============================================================================
// Status Derivation
// ============================================================================

/**
 * Derive execution status from artifact usage and work item counts
 */
export function deriveExecutionStatus(
  usage: ArtifactUsage | null | undefined,
  totalExpected: number | null = null
): ExecutionStatus {
  const workItemsCreated = usage?.attachedWorkCount ?? 0;
  const completedWorkItems = usage?.completedWorkCount ?? 0;

  // No work items created yet
  if (workItemsCreated === 0) {
    return {
      state: 'not_started',
      workItemsCreated: 0,
      totalExpected,
      completedWorkItems: 0,
      label: 'Not started',
      description: 'No work has been created from this artifact yet.',
      canCreateMore: true,
    };
  }

  // Work items exist - check if we know the total expected
  if (totalExpected !== null && workItemsCreated >= totalExpected) {
    // All expected work items created
    const allComplete = completedWorkItems >= workItemsCreated;
    return {
      state: 'completed',
      workItemsCreated,
      totalExpected,
      completedWorkItems,
      label: allComplete ? 'Completed' : 'Fully executed',
      description: allComplete
        ? `All ${workItemsCreated} work items completed.`
        : `${workItemsCreated} work items created, ${completedWorkItems} completed.`,
      canCreateMore: false,
    };
  }

  // Partial execution or unknown total
  return {
    state: 'in_progress',
    workItemsCreated,
    totalExpected,
    completedWorkItems,
    label: 'In progress',
    description: totalExpected
      ? `${workItemsCreated} of ${totalExpected} work items created.`
      : `${workItemsCreated} work item${workItemsCreated !== 1 ? 's' : ''} created.`,
    canCreateMore: true,
  };
}

/**
 * Get status badge configuration for execution state
 */
export function getExecutionStatusBadge(state: ExecutionState): {
  label: string;
  className: string;
  icon: 'circle' | 'loader' | 'check';
} {
  switch (state) {
    case 'not_started':
      return {
        label: 'Not started',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        icon: 'circle',
      };
    case 'in_progress':
      return {
        label: 'In execution',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: 'loader',
      };
    case 'completed':
      return {
        label: 'Executed',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: 'check',
      };
  }
}

/**
 * Get CTA configuration based on execution state
 */
export function getExecutionCTA(
  state: ExecutionState,
  workItemsCreated: number
): {
  primary: { label: string; action: 'create' | 'view' | 'continue' };
  showSecondary: boolean;
  secondaryLabel?: string;
} {
  switch (state) {
    case 'not_started':
      return {
        primary: { label: 'Create work from artifact...', action: 'create' },
        showSecondary: true,
        secondaryLabel: 'Attach to existing work...',
      };
    case 'in_progress':
      return {
        primary: { label: 'Continue execution...', action: 'continue' },
        showSecondary: true,
        secondaryLabel: 'View related work',
      };
    case 'completed':
      return {
        primary: { label: 'View related work →', action: 'view' },
        showSecondary: false,
      };
  }
}

/**
 * Get descriptive text for execution status
 */
export function getExecutionDescription(status: ExecutionStatus): {
  title: string;
  subtitle: string;
} {
  switch (status.state) {
    case 'not_started':
      return {
        title: 'Not executed',
        subtitle: 'Turn this artifact into actionable work items',
      };
    case 'in_progress':
      return {
        title: 'Execution in progress',
        subtitle: `Some work has been created from this artifact. ${status.workItemsCreated} work item${status.workItemsCreated !== 1 ? 's' : ''} created${status.totalExpected ? `, ${status.totalExpected - status.workItemsCreated} remaining` : ''}.`,
      };
    case 'completed':
      return {
        title: 'Execution in progress',
        subtitle: `All ${status.workItemsCreated} work item${status.workItemsCreated !== 1 ? 's' : ''} created and linked to this artifact.`,
      };
  }
}
