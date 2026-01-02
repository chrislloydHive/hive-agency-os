// lib/os/programs/cadenceDrift.ts
// Cadence Drift Detection - Tracks deliverable completion health per program
//
// Detects when programs are falling behind on their expected cadence:
// - Overdue deliverables
// - Stale cadences (no completions for 2+ cycles)
// - Low completion rates
//
// Integrates with Program Health to provide drift-aware status

import type { PlanningProgram, PlanningDeliverable } from '@/lib/types/program';
import type { CadenceType } from '@/lib/types/programTemplate';
import { parseRecurringDeliverableKey, getPeriodKey } from './recurringDeliverables';

// ============================================================================
// Types
// ============================================================================

export type DriftStatus = 'healthy' | 'attention' | 'at_risk';

export interface CadenceDriftMetrics {
  programId: string;
  programTitle: string;
  domain: string | null;

  // Overdue counts
  overdueWeekly: number;
  overdueMonthly: number;
  overdueQuarterly: number;
  totalOverdue: number;

  // Staleness (cycles since last completion)
  weeksSinceLastWeeklyCompletion: number | null;
  monthsSinceLastMonthlyCompletion: number | null;
  quartersSinceLastQuarterlyCompletion: number | null;

  // Completion rates (last 30 days)
  completionRate30Days: number;
  completedLast30Days: number;
  totalLast30Days: number;

  // Drift status
  driftStatus: DriftStatus;
  driftReasons: string[];
}

export interface CompanyDriftSummary {
  companyId: string;
  totalPrograms: number;
  healthyPrograms: number;
  attentionPrograms: number;
  atRiskPrograms: number;
  topDriftedPrograms: CadenceDriftMetrics[];
}

// ============================================================================
// Constants / Thresholds
// ============================================================================

export const DRIFT_THRESHOLDS = {
  // Overdue thresholds
  OVERDUE_ATTENTION: 1, // 1+ overdue = attention
  OVERDUE_AT_RISK: 3,   // 3+ overdue = at risk

  // Staleness thresholds (cycles without completion)
  STALE_WEEKLY_ATTENTION: 1,  // 1 week without completion
  STALE_WEEKLY_AT_RISK: 2,    // 2+ weeks without completion
  STALE_MONTHLY_ATTENTION: 1, // 1 month without completion
  STALE_MONTHLY_AT_RISK: 2,   // 2+ months without completion
  STALE_QUARTERLY_ATTENTION: 1, // 1 quarter without completion
  STALE_QUARTERLY_AT_RISK: 2,   // 2+ quarters without completion

  // Completion rate thresholds
  COMPLETION_RATE_HEALTHY: 80,    // 80%+ = healthy
  COMPLETION_RATE_ATTENTION: 60,  // 60-79% = attention
  // Below 60% = at risk
};

// ============================================================================
// Period Calculations
// ============================================================================

/**
 * Get the number of periods between two dates
 */
function getPeriodsBetween(
  startDate: Date,
  endDate: Date,
  cadence: CadenceType
): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const daysDiff = diffMs / (1000 * 60 * 60 * 24);

  switch (cadence) {
    case 'weekly':
      return Math.floor(daysDiff / 7);
    case 'monthly':
      return Math.floor(daysDiff / 30);
    case 'quarterly':
      return Math.floor(daysDiff / 90);
  }
}

/**
 * Get the due date from a deliverable
 */
function getDeliverableDueDate(d: PlanningDeliverable): Date | null {
  if (!d.dueDate) return null;
  return new Date(d.dueDate);
}

/**
 * Parse cadence from recurring deliverable description
 */
function getCadenceFromDeliverable(d: PlanningDeliverable): CadenceType | null {
  if (!d.description) return null;
  const parsed = parseRecurringDeliverableKey(d.description);
  if (!parsed) return null;

  const periodKey = parsed.periodKey;
  if (periodKey.startsWith('weekly-')) return 'weekly';
  if (periodKey.startsWith('monthly-')) return 'monthly';
  if (periodKey.startsWith('quarterly-')) return 'quarterly';

  return null;
}

// ============================================================================
// Drift Calculation
// ============================================================================

/**
 * Calculate cadence drift metrics for a single program
 */
export function calculateCadenceDrift(
  program: PlanningProgram,
  asOf: Date = new Date()
): CadenceDriftMetrics {
  const deliverables = program.scope?.deliverables || [];
  const now = asOf;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Initialize counters
  let overdueWeekly = 0;
  let overdueMonthly = 0;
  let overdueQuarterly = 0;

  let lastWeeklyCompletion: Date | null = null;
  let lastMonthlyCompletion: Date | null = null;
  let lastQuarterlyCompletion: Date | null = null;

  let completedLast30Days = 0;
  let totalLast30Days = 0;

  // Process each deliverable
  for (const d of deliverables) {
    const dueDate = getDeliverableDueDate(d);
    const cadence = getCadenceFromDeliverable(d);

    // Count overdue by cadence
    if (dueDate && dueDate < now && d.status !== 'completed') {
      if (cadence === 'weekly') overdueWeekly++;
      else if (cadence === 'monthly') overdueMonthly++;
      else if (cadence === 'quarterly') overdueQuarterly++;
    }

    // Track last completion by cadence
    if (d.status === 'completed') {
      // Use dueDate as proxy for completion period
      const completionDate = dueDate || now;

      if (cadence === 'weekly') {
        if (!lastWeeklyCompletion || completionDate > lastWeeklyCompletion) {
          lastWeeklyCompletion = completionDate;
        }
      } else if (cadence === 'monthly') {
        if (!lastMonthlyCompletion || completionDate > lastMonthlyCompletion) {
          lastMonthlyCompletion = completionDate;
        }
      } else if (cadence === 'quarterly') {
        if (!lastQuarterlyCompletion || completionDate > lastQuarterlyCompletion) {
          lastQuarterlyCompletion = completionDate;
        }
      }
    }

    // Count 30-day completion rate
    if (dueDate && dueDate >= thirtyDaysAgo && dueDate <= now) {
      totalLast30Days++;
      if (d.status === 'completed') {
        completedLast30Days++;
      }
    }
  }

  // Calculate staleness
  const weeksSinceLastWeeklyCompletion = lastWeeklyCompletion
    ? getPeriodsBetween(lastWeeklyCompletion, now, 'weekly')
    : null;
  const monthsSinceLastMonthlyCompletion = lastMonthlyCompletion
    ? getPeriodsBetween(lastMonthlyCompletion, now, 'monthly')
    : null;
  const quartersSinceLastQuarterlyCompletion = lastQuarterlyCompletion
    ? getPeriodsBetween(lastQuarterlyCompletion, now, 'quarterly')
    : null;

  // Calculate completion rate
  const completionRate30Days = totalLast30Days > 0
    ? Math.round((completedLast30Days / totalLast30Days) * 100)
    : 100; // If no deliverables due, assume healthy

  const totalOverdue = overdueWeekly + overdueMonthly + overdueQuarterly;

  // Determine drift status and reasons
  const { driftStatus, driftReasons } = calculateDriftStatus({
    totalOverdue,
    overdueWeekly,
    overdueMonthly,
    overdueQuarterly,
    weeksSinceLastWeeklyCompletion,
    monthsSinceLastMonthlyCompletion,
    quartersSinceLastQuarterlyCompletion,
    completionRate30Days,
  });

  return {
    programId: program.id,
    programTitle: program.title,
    domain: program.domain || null,
    overdueWeekly,
    overdueMonthly,
    overdueQuarterly,
    totalOverdue,
    weeksSinceLastWeeklyCompletion,
    monthsSinceLastMonthlyCompletion,
    quartersSinceLastQuarterlyCompletion,
    completionRate30Days,
    completedLast30Days,
    totalLast30Days,
    driftStatus,
    driftReasons,
  };
}

/**
 * Calculate drift status and reasons from metrics
 */
function calculateDriftStatus(metrics: {
  totalOverdue: number;
  overdueWeekly: number;
  overdueMonthly: number;
  overdueQuarterly: number;
  weeksSinceLastWeeklyCompletion: number | null;
  monthsSinceLastMonthlyCompletion: number | null;
  quartersSinceLastQuarterlyCompletion: number | null;
  completionRate30Days: number;
}): { driftStatus: DriftStatus; driftReasons: string[] } {
  const reasons: string[] = [];
  let isAtRisk = false;
  let isAttention = false;

  // Helper to escalate status
  const setAtRisk = (reason: string) => {
    isAtRisk = true;
    reasons.push(reason);
  };

  const setAttention = (reason: string) => {
    if (!isAtRisk) isAttention = true;
    reasons.push(reason);
  };

  // Check overdue
  if (metrics.totalOverdue >= DRIFT_THRESHOLDS.OVERDUE_AT_RISK) {
    setAtRisk(`${metrics.totalOverdue} overdue deliverables`);
  } else if (metrics.totalOverdue >= DRIFT_THRESHOLDS.OVERDUE_ATTENTION) {
    setAttention(`${metrics.totalOverdue} overdue deliverable${metrics.totalOverdue > 1 ? 's' : ''}`);
  }

  // Check weekly staleness
  if (metrics.weeksSinceLastWeeklyCompletion !== null) {
    if (metrics.weeksSinceLastWeeklyCompletion >= DRIFT_THRESHOLDS.STALE_WEEKLY_AT_RISK) {
      setAtRisk(`${metrics.weeksSinceLastWeeklyCompletion} weeks without weekly completion`);
    } else if (metrics.weeksSinceLastWeeklyCompletion >= DRIFT_THRESHOLDS.STALE_WEEKLY_ATTENTION) {
      setAttention(`${metrics.weeksSinceLastWeeklyCompletion} week without weekly completion`);
    }
  }

  // Check monthly staleness
  if (metrics.monthsSinceLastMonthlyCompletion !== null) {
    if (metrics.monthsSinceLastMonthlyCompletion >= DRIFT_THRESHOLDS.STALE_MONTHLY_AT_RISK) {
      setAtRisk(`${metrics.monthsSinceLastMonthlyCompletion} months without monthly completion`);
    } else if (metrics.monthsSinceLastMonthlyCompletion >= DRIFT_THRESHOLDS.STALE_MONTHLY_ATTENTION) {
      setAttention(`${metrics.monthsSinceLastMonthlyCompletion} month without monthly completion`);
    }
  }

  // Check quarterly staleness
  if (metrics.quartersSinceLastQuarterlyCompletion !== null) {
    if (metrics.quartersSinceLastQuarterlyCompletion >= DRIFT_THRESHOLDS.STALE_QUARTERLY_AT_RISK) {
      setAtRisk(`${metrics.quartersSinceLastQuarterlyCompletion} quarters without quarterly completion`);
    } else if (metrics.quartersSinceLastQuarterlyCompletion >= DRIFT_THRESHOLDS.STALE_QUARTERLY_ATTENTION) {
      setAttention(`${metrics.quartersSinceLastQuarterlyCompletion} quarter without quarterly completion`);
    }
  }

  // Check completion rate
  if (metrics.completionRate30Days < DRIFT_THRESHOLDS.COMPLETION_RATE_ATTENTION) {
    setAtRisk(`Low completion rate: ${metrics.completionRate30Days}%`);
  } else if (metrics.completionRate30Days < DRIFT_THRESHOLDS.COMPLETION_RATE_HEALTHY) {
    setAttention(`Completion rate: ${metrics.completionRate30Days}%`);
  }

  // Determine final status
  const status: DriftStatus = isAtRisk ? 'at_risk' : isAttention ? 'attention' : 'healthy';

  return { driftStatus: status, driftReasons: reasons };
}

/**
 * Calculate drift for multiple programs and get company summary
 */
export function calculateCompanyDrift(
  companyId: string,
  programs: PlanningProgram[],
  asOf: Date = new Date()
): CompanyDriftSummary {
  const activePrograms = programs.filter(p => p.status !== 'archived');
  const driftMetrics = activePrograms.map(p => calculateCadenceDrift(p, asOf));

  let healthy = 0;
  let attention = 0;
  let atRisk = 0;

  for (const m of driftMetrics) {
    switch (m.driftStatus) {
      case 'healthy':
        healthy++;
        break;
      case 'attention':
        attention++;
        break;
      case 'at_risk':
        atRisk++;
        break;
    }
  }

  // Get top drifted programs (sorted by severity)
  const topDrifted = driftMetrics
    .filter(m => m.driftStatus !== 'healthy')
    .sort((a, b) => {
      // Sort by status severity first
      const severityOrder: Record<DriftStatus, number> = { at_risk: 0, attention: 1, healthy: 2 };
      const severityDiff = severityOrder[a.driftStatus] - severityOrder[b.driftStatus];
      if (severityDiff !== 0) return severityDiff;
      // Then by total overdue
      return b.totalOverdue - a.totalOverdue;
    })
    .slice(0, 5);

  return {
    companyId,
    totalPrograms: activePrograms.length,
    healthyPrograms: healthy,
    attentionPrograms: attention,
    atRiskPrograms: atRisk,
    topDriftedPrograms: topDrifted,
  };
}

// ============================================================================
// Integration with Program Health
// ============================================================================

/**
 * Get drift-enhanced health status
 * Combines existing health with drift metrics
 */
export function getDriftEnhancedHealthStatus(
  existingStatus: 'Healthy' | 'Attention' | 'At Risk',
  driftMetrics: CadenceDriftMetrics
): {
  status: 'Healthy' | 'Attention' | 'At Risk';
  issues: string[];
} {
  const issues: string[] = [...driftMetrics.driftReasons];

  // Map drift status to health status
  let driftHealth: 'Healthy' | 'Attention' | 'At Risk';
  switch (driftMetrics.driftStatus) {
    case 'at_risk':
      driftHealth = 'At Risk';
      break;
    case 'attention':
      driftHealth = 'Attention';
      break;
    default:
      driftHealth = 'Healthy';
  }

  // Take the worse of the two statuses
  const statusOrder: Record<string, number> = { 'At Risk': 0, 'Attention': 1, 'Healthy': 2 };
  const finalStatus = statusOrder[existingStatus] < statusOrder[driftHealth]
    ? existingStatus
    : driftHealth;

  return {
    status: finalStatus as 'Healthy' | 'Attention' | 'At Risk',
    issues,
  };
}

// ============================================================================
// QBR Integration
// ============================================================================

/**
 * Generate drift summary for QBR
 */
export function generateDriftSummaryForQBR(
  programs: PlanningProgram[]
): {
  hasSignificantDrift: boolean;
  riskSummary: string;
  affectedPrograms: string[];
  recommendations: string[];
} {
  const driftMetrics = programs
    .filter(p => p.status !== 'archived')
    .map(p => calculateCadenceDrift(p));

  const atRiskPrograms = driftMetrics.filter(m => m.driftStatus === 'at_risk');
  const attentionPrograms = driftMetrics.filter(m => m.driftStatus === 'attention');

  const hasSignificantDrift = atRiskPrograms.length > 0;

  let riskSummary = '';
  if (atRiskPrograms.length > 0) {
    riskSummary = `${atRiskPrograms.length} program${atRiskPrograms.length > 1 ? 's' : ''} at risk due to cadence drift`;
  } else if (attentionPrograms.length > 0) {
    riskSummary = `${attentionPrograms.length} program${attentionPrograms.length > 1 ? 's' : ''} need attention for cadence compliance`;
  } else {
    riskSummary = 'All programs on track with expected cadence';
  }

  const affectedPrograms = [...atRiskPrograms, ...attentionPrograms]
    .map(m => m.programTitle)
    .slice(0, 5);

  const recommendations: string[] = [];
  if (atRiskPrograms.length > 0) {
    recommendations.push('Review and catch up on overdue deliverables');
    recommendations.push('Consider adjusting intensity or scope for drifting programs');
  }
  if (attentionPrograms.length > 0) {
    recommendations.push('Monitor completion rates closely next quarter');
  }

  return {
    hasSignificantDrift,
    riskSummary,
    affectedPrograms,
    recommendations,
  };
}
