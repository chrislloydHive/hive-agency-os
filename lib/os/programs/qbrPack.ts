// lib/os/programs/qbrPack.ts
// QBR Pack Generator for Programs
//
// Synthesizes program status into a structured QBR pack for executive review.
// Aggregates:
// - Program health across all domains
// - Deliverables completed vs planned
// - Key wins and challenges
// - Next quarter priorities
// - AI-generated narrative

import type { PlanningProgram, PlanningDeliverable } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import type { ProgramDomain, IntensityLevel, CadenceType } from '@/lib/types/programTemplate';
import {
  calculateProgramHealth,
  calculateCompanyCapacity,
  type HealthStatus,
  type ProgramHealthSnapshot,
} from './programHealth';
import { getDeliverableCadenceSummary } from './recurringDeliverables';
import { PROGRAM_DOMAIN_LABELS } from '@/lib/types/programTemplate';

// ============================================================================
// Types
// ============================================================================

export interface QBRPackSection {
  id: string;
  title: string;
  type: 'summary' | 'health' | 'deliverables' | 'wins' | 'challenges' | 'priorities' | 'capacity';
  content: string;
  bullets?: string[];
  metrics?: Array<{
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'flat';
    status?: 'good' | 'warning' | 'critical';
  }>;
  order: number;
}

export interface QBRPackProgramSummary {
  programId: string;
  programTitle: string;
  domain: ProgramDomain;
  intensity: IntensityLevel;
  health: HealthStatus;
  deliverables: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  workItems: {
    total: number;
    done: number;
    inProgress: number;
  };
  issues: string[];
}

export interface QBRPackData {
  companyId: string;
  companyName?: string;
  quarter: string;
  year: number;
  generatedAt: string;

  // Overall metrics
  overallHealth: HealthStatus;
  programsCount: number;
  totalDeliverables: number;
  completedDeliverables: number;
  overdueDeliverables: number;
  totalWorkItems: number;
  completedWorkItems: number;

  // Capacity
  capacityLoad: 'low' | 'medium' | 'high';
  capacityWarning: boolean;

  // Program breakdown
  programs: QBRPackProgramSummary[];

  // Sections
  sections: QBRPackSection[];
}

export interface QBRPackOptions {
  /** Override the quarter (defaults to current) */
  quarter?: number;
  /** Override the year (defaults to current) */
  year?: number;
  /** Include AI-generated narrative (requires API call) */
  includeNarrative?: boolean;
  /** Company name for the pack */
  companyName?: string;
}

// ============================================================================
// Quarter Helpers
// ============================================================================

export function getCurrentQuarter(): { quarter: number; year: number } {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { quarter, year: now.getFullYear() };
}

export function formatQuarterLabel(quarter: number, year: number): string {
  return `Q${quarter} ${year}`;
}

// ============================================================================
// QBR Pack Generation
// ============================================================================

/**
 * Generate a QBR Pack for a company's programs
 */
export function generateQBRPack(
  programs: PlanningProgram[],
  workItems: WorkItemRecord[],
  options: QBRPackOptions = {}
): QBRPackData {
  const { quarter: qtr, year: yr } = options.quarter && options.year
    ? { quarter: options.quarter, year: options.year }
    : getCurrentQuarter();

  const now = new Date();
  const activePrograms = programs.filter((p) => p.status !== 'archived');

  // Calculate health for each program
  const healthSnapshots = activePrograms.map((p) =>
    calculateProgramHealth(p, workItems)
  );

  // Calculate capacity
  const capacity = calculateCompanyCapacity(activePrograms);

  // Aggregate metrics
  let totalDeliverables = 0;
  let completedDeliverables = 0;
  let overdueDeliverables = 0;
  let inProgressDeliverables = 0;

  for (const program of activePrograms) {
    const deliverables = program.scope?.deliverables || [];
    for (const d of deliverables) {
      totalDeliverables++;
      if (d.status === 'completed') completedDeliverables++;
      if (d.status === 'in_progress') inProgressDeliverables++;
      if (d.dueDate && new Date(d.dueDate) < now && d.status !== 'completed') {
        overdueDeliverables++;
      }
    }
  }

  // Work item metrics
  const totalWorkItems = workItems.length;
  const completedWorkItems = workItems.filter((w) => w.status === 'Done').length;
  const inProgressWorkItems = workItems.filter((w) => w.status === 'In Progress').length;

  // Determine overall health
  const healthCounts: Record<HealthStatus, number> = {
    Healthy: 0,
    Attention: 0,
    'At Risk': 0,
  };
  for (const snapshot of healthSnapshots) {
    healthCounts[snapshot.status]++;
  }
  const overallHealth: HealthStatus =
    healthCounts['At Risk'] > 0
      ? 'At Risk'
      : healthCounts['Attention'] > 0
      ? 'Attention'
      : 'Healthy';

  // Build program summaries
  const programSummaries: QBRPackProgramSummary[] = activePrograms.map((p) => {
    const snapshot = healthSnapshots.find((h) => h.programId === p.id)!;
    const deliverables = p.scope?.deliverables || [];
    const linkedWorkIds = new Set(p.commitment?.workItemIds || []);
    const linkedWork = workItems.filter((w) => linkedWorkIds.has(w.id));

    let completed = 0;
    let inProgress = 0;
    let overdue = 0;

    for (const d of deliverables) {
      if (d.status === 'completed') completed++;
      if (d.status === 'in_progress') inProgress++;
      if (d.dueDate && new Date(d.dueDate) < now && d.status !== 'completed') {
        overdue++;
      }
    }

    return {
      programId: p.id,
      programTitle: p.title,
      domain: p.domain || 'Strategy',
      intensity: p.intensity || 'Standard',
      health: snapshot.status,
      deliverables: {
        total: deliverables.length,
        completed,
        inProgress,
        overdue,
      },
      workItems: {
        total: linkedWork.length,
        done: linkedWork.filter((w) => w.status === 'Done').length,
        inProgress: linkedWork.filter((w) => w.status === 'In Progress').length,
      },
      issues: snapshot.issues,
    };
  });

  // Build sections
  const sections = buildQBRSections({
    programs: activePrograms,
    programSummaries,
    healthSnapshots,
    capacity,
    overallHealth,
    totalDeliverables,
    completedDeliverables,
    overdueDeliverables,
    totalWorkItems,
    completedWorkItems,
    quarter: qtr,
    year: yr,
  });

  // Compile the pack
  const pack: QBRPackData = {
    companyId: programs[0]?.companyId || '',
    companyName: options.companyName,
    quarter: formatQuarterLabel(qtr, yr),
    year: yr,
    generatedAt: now.toISOString(),
    overallHealth,
    programsCount: activePrograms.length,
    totalDeliverables,
    completedDeliverables,
    overdueDeliverables,
    totalWorkItems,
    completedWorkItems,
    capacityLoad: capacity.estimatedWeeklyLoad,
    capacityWarning: capacity.warningThreshold,
    programs: programSummaries,
    sections,
  };

  return pack;
}

// ============================================================================
// Section Builders
// ============================================================================

interface SectionContext {
  programs: PlanningProgram[];
  programSummaries: QBRPackProgramSummary[];
  healthSnapshots: ProgramHealthSnapshot[];
  capacity: ReturnType<typeof calculateCompanyCapacity>;
  overallHealth: HealthStatus;
  totalDeliverables: number;
  completedDeliverables: number;
  overdueDeliverables: number;
  totalWorkItems: number;
  completedWorkItems: number;
  quarter: number;
  year: number;
}

function buildQBRSections(ctx: SectionContext): QBRPackSection[] {
  const sections: QBRPackSection[] = [];
  let order = 0;

  // Executive Summary
  sections.push({
    id: 'executive-summary',
    title: 'Executive Summary',
    type: 'summary',
    content: buildExecutiveSummary(ctx),
    metrics: [
      {
        label: 'Programs',
        value: ctx.programs.length,
        status: ctx.overallHealth === 'Healthy' ? 'good' : ctx.overallHealth === 'Attention' ? 'warning' : 'critical',
      },
      {
        label: 'Deliverables',
        value: `${ctx.completedDeliverables}/${ctx.totalDeliverables}`,
        status: ctx.overdueDeliverables > 0 ? 'warning' : 'good',
      },
      {
        label: 'Completion Rate',
        value: ctx.totalDeliverables > 0
          ? `${Math.round((ctx.completedDeliverables / ctx.totalDeliverables) * 100)}%`
          : 'N/A',
        status: 'good',
      },
    ],
    order: order++,
  });

  // Program Health Overview
  sections.push({
    id: 'program-health',
    title: 'Program Health',
    type: 'health',
    content: buildHealthOverview(ctx),
    bullets: ctx.programSummaries
      .filter((p) => p.health !== 'Healthy')
      .map((p) => `${p.programTitle}: ${p.issues.join(', ')}`),
    order: order++,
  });

  // Deliverables Status
  sections.push({
    id: 'deliverables',
    title: 'Deliverables Status',
    type: 'deliverables',
    content: buildDeliverablesStatus(ctx),
    metrics: [
      { label: 'Completed', value: ctx.completedDeliverables, status: 'good' },
      { label: 'In Progress', value: ctx.totalDeliverables - ctx.completedDeliverables - ctx.overdueDeliverables },
      { label: 'Overdue', value: ctx.overdueDeliverables, status: ctx.overdueDeliverables > 0 ? 'critical' : 'good' },
    ],
    order: order++,
  });

  // Key Wins
  const wins = identifyWins(ctx);
  if (wins.length > 0) {
    sections.push({
      id: 'wins',
      title: 'Key Wins',
      type: 'wins',
      content: 'Notable achievements this quarter:',
      bullets: wins,
      order: order++,
    });
  }

  // Challenges
  const challenges = identifyChallenges(ctx);
  if (challenges.length > 0) {
    sections.push({
      id: 'challenges',
      title: 'Challenges',
      type: 'challenges',
      content: 'Areas requiring attention:',
      bullets: challenges,
      order: order++,
    });
  }

  // Capacity
  sections.push({
    id: 'capacity',
    title: 'Capacity & Load',
    type: 'capacity',
    content: buildCapacitySection(ctx),
    metrics: [
      { label: 'Load Score', value: ctx.capacity.totalLoadScore },
      { label: 'Load Level', value: ctx.capacity.estimatedWeeklyLoad },
    ],
    order: order++,
  });

  // Next Quarter Priorities
  sections.push({
    id: 'priorities',
    title: 'Next Quarter Priorities',
    type: 'priorities',
    content: `Focus areas for Q${ctx.quarter === 4 ? 1 : ctx.quarter + 1} ${ctx.quarter === 4 ? ctx.year + 1 : ctx.year}:`,
    bullets: buildPriorities(ctx),
    order: order++,
  });

  return sections;
}

function buildExecutiveSummary(ctx: SectionContext): string {
  const healthLabel = ctx.overallHealth === 'Healthy'
    ? 'on track'
    : ctx.overallHealth === 'Attention'
    ? 'requiring attention'
    : 'at risk';

  const completionRate = ctx.totalDeliverables > 0
    ? Math.round((ctx.completedDeliverables / ctx.totalDeliverables) * 100)
    : 0;

  return `This quarter, ${ctx.programs.length} programs are ${healthLabel} with a ${completionRate}% deliverable completion rate. ${ctx.completedWorkItems} work items completed out of ${ctx.totalWorkItems} total. ${ctx.capacity.warningThreshold ? 'Capacity is at warning threshold.' : 'Capacity levels are sustainable.'}`;
}

function buildHealthOverview(ctx: SectionContext): string {
  const healthy = ctx.programSummaries.filter((p) => p.health === 'Healthy').length;
  const attention = ctx.programSummaries.filter((p) => p.health === 'Attention').length;
  const atRisk = ctx.programSummaries.filter((p) => p.health === 'At Risk').length;

  return `${healthy} programs healthy, ${attention} need attention, ${atRisk} at risk.`;
}

function buildDeliverablesStatus(ctx: SectionContext): string {
  if (ctx.overdueDeliverables > 0) {
    return `${ctx.overdueDeliverables} deliverables are overdue. Focus on clearing blockers.`;
  }
  return `All deliverables are on track. ${ctx.completedDeliverables} completed this quarter.`;
}

function buildCapacitySection(ctx: SectionContext): string {
  if (ctx.capacity.warningThreshold) {
    return `${ctx.capacity.recommendation}`;
  }
  return `Current capacity load is ${ctx.capacity.estimatedWeeklyLoad}. Team is operating within sustainable limits.`;
}

function identifyWins(ctx: SectionContext): string[] {
  const wins: string[] = [];

  // Programs with high completion rate
  for (const p of ctx.programSummaries) {
    if (p.deliverables.total > 0) {
      const rate = p.deliverables.completed / p.deliverables.total;
      if (rate >= 0.8) {
        wins.push(`${p.programTitle}: ${Math.round(rate * 100)}% deliverables completed`);
      }
    }
  }

  // All programs healthy
  const allHealthy = ctx.programSummaries.every((p) => p.health === 'Healthy');
  if (allHealthy && ctx.programs.length > 0) {
    wins.push('All programs operating in healthy state');
  }

  // High work completion
  if (ctx.totalWorkItems > 0 && ctx.completedWorkItems / ctx.totalWorkItems > 0.7) {
    wins.push(`Strong execution: ${ctx.completedWorkItems} work items completed`);
  }

  return wins;
}

function identifyChallenges(ctx: SectionContext): string[] {
  const challenges: string[] = [];

  // Programs at risk
  for (const p of ctx.programSummaries) {
    if (p.health === 'At Risk') {
      challenges.push(`${p.programTitle}: ${p.issues[0] || 'Multiple issues'}`);
    }
  }

  // Overdue deliverables
  if (ctx.overdueDeliverables > 0) {
    challenges.push(`${ctx.overdueDeliverables} deliverables are past due date`);
  }

  // Capacity warning
  if (ctx.capacity.warningThreshold) {
    challenges.push('Capacity at warning threshold - consider load balancing');
  }

  return challenges;
}

function buildPriorities(ctx: SectionContext): string[] {
  const priorities: string[] = [];

  // Address at-risk programs
  const atRisk = ctx.programSummaries.filter((p) => p.health === 'At Risk');
  if (atRisk.length > 0) {
    priorities.push(`Stabilize at-risk programs: ${atRisk.map((p) => p.programTitle).join(', ')}`);
  }

  // Clear overdue items
  if (ctx.overdueDeliverables > 0) {
    priorities.push(`Clear ${ctx.overdueDeliverables} overdue deliverables`);
  }

  // Capacity management
  if (ctx.capacity.warningThreshold) {
    priorities.push('Rebalance workload across programs');
  }

  // Default priorities if nothing urgent
  if (priorities.length === 0) {
    priorities.push('Maintain program health');
    priorities.push('Focus on high-impact deliverables');
  }

  return priorities;
}

// ============================================================================
// Export for API
// ============================================================================

export type { ProgramHealthSnapshot };
