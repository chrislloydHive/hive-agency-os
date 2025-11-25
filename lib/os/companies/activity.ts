// lib/os/companies/activity.ts
// Build activity snapshots from company-related data sources

import type { WorkItemRecord } from '@/lib/airtable/workItems';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { CompanyActivitySnapshot } from './health';
import { getMaxDate } from './health';

// ============================================================================
// Types
// ============================================================================

interface ActivityInputs {
  gapIaRuns: any[]; // GapIaRun[]
  gapPlanRuns: any[]; // GapPlanRun[]
  diagnosticRuns: DiagnosticRun[];
  workItems: WorkItemRecord[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build a CompanyActivitySnapshot from various data sources
 *
 * Extracts the most recent activity dates from:
 * - GAP IA runs (assessments)
 * - GAP Plan runs
 * - Diagnostic runs
 * - Work items (created and completed)
 *
 * @param inputs - Data from various sources
 * @returns CompanyActivitySnapshot with last activity dates
 */
export function buildCompanyActivitySnapshot(
  inputs: ActivityInputs
): CompanyActivitySnapshot {
  const { gapIaRuns, gapPlanRuns, diagnosticRuns, workItems } = inputs;

  // Get last GAP assessment date
  // Assuming runs are sorted desc by createdAt, take the first one
  // If not sorted, compute the max
  const gapIaDates = gapIaRuns
    .filter((run) => run.createdAt)
    .map((run) => run.createdAt as string);
  const lastGapAssessmentAt = gapIaDates.length > 0 ? getMaxDate(...gapIaDates) : null;

  // Get last GAP plan date
  const gapPlanDates = gapPlanRuns
    .filter((run) => run.createdAt)
    .map((run) => run.createdAt as string);
  const lastGapPlanAt = gapPlanDates.length > 0 ? getMaxDate(...gapPlanDates) : null;

  // Get last diagnostic date
  const diagnosticDates = diagnosticRuns
    .filter((run) => run.createdAt)
    .map((run) => run.createdAt);
  const lastDiagnosticAt = diagnosticDates.length > 0 ? getMaxDate(...diagnosticDates) : null;

  // Get last work item activity (created or updated/completed)
  const workDates: string[] = [];
  for (const item of workItems) {
    if (item.createdAt) {
      workDates.push(item.createdAt);
    }
    if (item.updatedAt) {
      workDates.push(item.updatedAt);
    }
    // If there's a completedAt field, include it
    // (WorkItemRecord may not have this, but we handle it gracefully)
    const completedAt = (item as any).completedAt;
    if (completedAt) {
      workDates.push(completedAt);
    }
  }
  const lastWorkActivityAt = workDates.length > 0 ? getMaxDate(...workDates) : null;

  // Compute the overall last activity
  const lastAnyActivityAt = getMaxDate(
    lastGapAssessmentAt,
    lastGapPlanAt,
    lastDiagnosticAt,
    lastWorkActivityAt
  );

  return {
    lastGapAssessmentAt,
    lastGapPlanAt,
    lastDiagnosticAt,
    lastWorkActivityAt,
    lastAnyActivityAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if there are overdue work items
 * (Work items with status not "Done" and dueDate in the past)
 */
export function hasOverdueWorkItems(workItems: WorkItemRecord[]): boolean {
  const now = new Date();
  return workItems.some((item) => {
    if (item.status === 'Done') return false;
    if (!item.dueDate) return false;
    try {
      const dueDate = new Date(item.dueDate);
      return dueDate < now;
    } catch {
      return false;
    }
  });
}

/**
 * Check if there are stale backlog items
 * (Work items with status "Backlog" that haven't been touched recently)
 */
export function hasStaleBacklogItems(
  workItems: WorkItemRecord[],
  staleDaysThreshold: number = 30
): boolean {
  const now = new Date();
  const thresholdMs = staleDaysThreshold * 24 * 60 * 60 * 1000;

  return workItems.some((item) => {
    if (item.status !== 'Backlog') return false;

    const lastTouched = item.updatedAt || item.createdAt;
    if (!lastTouched) return true; // No date = assume stale

    try {
      const touchedDate = new Date(lastTouched);
      return now.getTime() - touchedDate.getTime() > thresholdMs;
    } catch {
      return true;
    }
  });
}

/**
 * Get counts of work items by status
 */
export function getWorkItemStatusCounts(
  workItems: WorkItemRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {
    Backlog: 0,
    Planned: 0,
    'In Progress': 0,
    Done: 0,
  };

  for (const item of workItems) {
    const status = item.status || 'Backlog';
    counts[status] = (counts[status] || 0) + 1;
  }

  return counts;
}

/**
 * Format last activity date for display
 */
export function formatLastActivityLabel(lastActivityAt: string | null | undefined): string {
  if (!lastActivityAt) return 'No activity';

  try {
    const date = new Date(lastActivityAt);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}
