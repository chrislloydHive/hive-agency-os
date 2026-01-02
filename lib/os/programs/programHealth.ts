// lib/os/programs/programHealth.ts
// Program Health Computation
//
// Calculates health status for programs based on:
// - Deliverables due next 7 days
// - Overdue deliverables
// - Work in progress count
// - Completed work this period
// - Cadence drift (staleness, completion rate)
//
// Health Status:
// - Healthy: On track, no overdue items, on-cadence
// - Attention: Some overdue or approaching due dates, minor drift
// - At Risk: Multiple overdue, capacity issues, stalled, or significant drift

import type { PlanningProgram } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import { calculateCadenceDrift, type CadenceDriftMetrics, type DriftStatus } from './cadenceDrift';

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = 'Healthy' | 'Attention' | 'At Risk';

export interface ProgramHealthSnapshot {
  programId: string;
  programTitle: string;
  status: HealthStatus;
  metrics: {
    dueNext7Days: number;
    overdueCount: number;
    workInProgress: number;
    completedThisPeriod: number;
    totalDeliverables: number;
    totalWorkItems: number;
  };
  issues: string[];
  lastUpdated: string;
  // Drift metrics (optional for backwards compatibility)
  drift?: {
    status: DriftStatus;
    reasons: string[];
    completionRate30Days: number;
  };
}

export interface CapacityHint {
  programId: string;
  intensity: 'Core' | 'Standard' | 'Aggressive' | undefined;
  estimatedWeeklyLoad: 'low' | 'medium' | 'high';
  loadScore: number; // 1-10 scale
  recommendation?: string;
}

export interface CompanyCapacitySummary {
  totalPrograms: number;
  estimatedWeeklyLoad: 'low' | 'medium' | 'high';
  totalLoadScore: number;
  warningThreshold: boolean;
  recommendation?: string;
  programHints: CapacityHint[];
}

// ============================================================================
// Health Status Calculation
// ============================================================================

/**
 * Calculate health snapshot for a program
 */
export function calculateProgramHealth(
  program: PlanningProgram,
  workItems: WorkItemRecord[]
): ProgramHealthSnapshot {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deliverables = program.scope?.deliverables || [];
  const linkedWorkIds = new Set(program.commitment?.workItemIds || []);
  const linkedWork = workItems.filter((w) => linkedWorkIds.has(w.id));

  // Calculate deliverable metrics
  let dueNext7Days = 0;
  let overdueCount = 0;

  for (const deliverable of deliverables) {
    if (!deliverable.dueDate) continue;
    const dueDate = new Date(deliverable.dueDate);

    if (dueDate < now && deliverable.status !== 'completed') {
      overdueCount++;
    } else if (dueDate <= sevenDaysFromNow && deliverable.status !== 'completed') {
      dueNext7Days++;
    }
  }

  // Calculate work item metrics
  const workInProgress = linkedWork.filter(
    (w) => w.status === 'In Progress'
  ).length;

  const completedThisPeriod = linkedWork.filter((w) => {
    if (w.status !== 'Done') return false;
    // Note: Would need completedAt field for accurate tracking
    return true; // For now, count all done items
  }).length;

  // Determine health status
  const issues: string[] = [];
  let status: HealthStatus = 'Healthy';

  if (overdueCount >= 3) {
    status = 'At Risk';
    issues.push(`${overdueCount} deliverables are overdue`);
  } else if (overdueCount >= 1) {
    status = 'Attention';
    issues.push(`${overdueCount} deliverable${overdueCount > 1 ? 's' : ''} overdue`);
  }

  if (dueNext7Days >= 5) {
    if (status !== 'At Risk') status = 'Attention';
    issues.push(`${dueNext7Days} deliverables due this week`);
  }

  // Check for stalled work (no progress in 2+ weeks)
  if (workInProgress === 0 && linkedWork.length > 0 && completedThisPeriod === 0) {
    if (status !== 'At Risk') status = 'Attention';
    issues.push('No work in progress');
  }

  // Check capacity if scope enforced
  if (program.scopeEnforced && program.maxConcurrentWork) {
    const utilizationPercent = (workInProgress / program.maxConcurrentWork) * 100;
    if (utilizationPercent >= 100) {
      status = 'At Risk';
      issues.push('Capacity limit reached');
    } else if (utilizationPercent >= 80) {
      if (status !== 'At Risk') status = 'Attention';
      issues.push('Approaching capacity limit');
    }
  }

  // Calculate drift metrics
  const driftMetrics = calculateCadenceDrift(program, now);

  // Integrate drift into health status
  if (driftMetrics.driftStatus === 'at_risk') {
    status = 'At Risk';
    issues.push(...driftMetrics.driftReasons);
  } else if (driftMetrics.driftStatus === 'attention') {
    if (status !== 'At Risk') status = 'Attention';
    issues.push(...driftMetrics.driftReasons);
  }

  return {
    programId: program.id,
    programTitle: program.title,
    status,
    metrics: {
      dueNext7Days,
      overdueCount,
      workInProgress,
      completedThisPeriod,
      totalDeliverables: deliverables.length,
      totalWorkItems: linkedWork.length,
    },
    issues,
    lastUpdated: now.toISOString(),
    drift: {
      status: driftMetrics.driftStatus,
      reasons: driftMetrics.driftReasons,
      completionRate30Days: driftMetrics.completionRate30Days,
    },
  };
}

// ============================================================================
// Capacity Hints
// ============================================================================

/**
 * Calculate capacity hint for a program based on intensity
 */
export function calculateCapacityHint(program: PlanningProgram): CapacityHint {
  const intensity = program.intensity;

  // Base load by intensity
  let loadScore: number;
  let estimatedWeeklyLoad: 'low' | 'medium' | 'high';

  switch (intensity) {
    case 'Core':
      loadScore = 2;
      estimatedWeeklyLoad = 'low';
      break;
    case 'Standard':
      loadScore = 5;
      estimatedWeeklyLoad = 'medium';
      break;
    case 'Aggressive':
      loadScore = 8;
      estimatedWeeklyLoad = 'high';
      break;
    default:
      loadScore = 3;
      estimatedWeeklyLoad = 'low';
  }

  // Adjust based on deliverable count
  const deliverables = program.scope?.deliverables || [];
  const weeklyDeliverables = deliverables.filter((d) => {
    // Estimate weekly cadence based on workstream type
    return d.workstreamType === 'content' || d.workstreamType === 'social';
  }).length;

  if (weeklyDeliverables > 3) {
    loadScore = Math.min(10, loadScore + 2);
  }

  // Re-evaluate load level based on final score
  if (loadScore >= 7) {
    estimatedWeeklyLoad = 'high';
  } else if (loadScore >= 4) {
    estimatedWeeklyLoad = 'medium';
  }

  let recommendation: string | undefined;
  if (loadScore >= 8) {
    recommendation = 'Consider reducing scope or adding capacity';
  }

  return {
    programId: program.id,
    intensity,
    estimatedWeeklyLoad,
    loadScore,
    recommendation,
  };
}

/**
 * Calculate company-wide capacity summary
 */
export function calculateCompanyCapacity(
  programs: PlanningProgram[]
): CompanyCapacitySummary {
  const programHints = programs.map(calculateCapacityHint);

  const totalLoadScore = programHints.reduce((sum, h) => sum + h.loadScore, 0);
  const avgLoadScore = programs.length > 0 ? totalLoadScore / programs.length : 0;

  // Determine overall load level
  let estimatedWeeklyLoad: 'low' | 'medium' | 'high';
  if (totalLoadScore >= 30 || avgLoadScore >= 7) {
    estimatedWeeklyLoad = 'high';
  } else if (totalLoadScore >= 15 || avgLoadScore >= 4) {
    estimatedWeeklyLoad = 'medium';
  } else {
    estimatedWeeklyLoad = 'low';
  }

  // Warning threshold
  const warningThreshold = totalLoadScore >= 40 || avgLoadScore >= 8;

  let recommendation: string | undefined;
  if (warningThreshold) {
    recommendation = 'Total program load is high. Consider prioritizing or phasing rollouts.';
  }

  return {
    totalPrograms: programs.length,
    estimatedWeeklyLoad,
    totalLoadScore,
    warningThreshold,
    recommendation,
    programHints,
  };
}

// ============================================================================
// Health Badge Helper
// ============================================================================

/**
 * Get badge styling for health status
 */
export function getHealthBadgeStyle(status: HealthStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'Healthy':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'Attention':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'At Risk':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Get load badge styling
 */
export function getLoadBadgeStyle(load: 'low' | 'medium' | 'high'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (load) {
    case 'low':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'high':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
  }
}
