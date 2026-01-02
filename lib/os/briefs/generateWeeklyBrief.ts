// lib/os/briefs/generateWeeklyBrief.ts
// Weekly Brief Generation - Auto-generates Monday morning summaries
//
// Generates deterministic briefs grounded in OS data:
// - This Week: deliverables due (grouped by domain)
// - Overdue: deliverables overdue (grouped by domain)
// - Program Health: health badges + top 3 at-risk reasons
// - Runbook: completion % last week + top incomplete domains
// - Approvals Pending: count + list
// - Scope Drift: top blocked actions last 30 days
// - Recent Changes: intensity/status changes last 7 days
// - Recommended Actions: top 5 based on drift + overdue + approvals

import type { PlanningProgram, PlanningDeliverable } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import type { ProgramDomain } from '@/lib/types/programTemplate';
import {
  type WeeklyBrief,
  type WeeklyBriefContent,
  type WeeklyBriefSourceSummary,
  type DeliverablesByDomain,
  type ProgramHealthSummary,
  type RunbookLastWeekSummary,
  type ApprovalPending,
  type ScopeDriftSummary,
  type RecentChange,
  type RecommendedAction,
  getWeekKey,
  getPreviousWeekKey,
} from '@/lib/types/weeklyBrief';
import { calculateProgramHealth, type ProgramHealthSnapshot, type HealthStatus } from '@/lib/os/programs/programHealth';
import { getCompanyChanges, type GovernanceChangeRecord } from '@/lib/os/programs/governanceLog';
import {
  calculateRunbookSummary,
  getRunbookForIntensity,
  type RunbookSummary,
} from '@/lib/os/programs/runbook';
import { generateDebugId } from '@/lib/types/operationalEvent';

// ============================================================================
// Constants
// ============================================================================

const DOMAIN_ORDER: ProgramDomain[] = [
  'Strategy',
  'Media',
  'Creative',
  'LocalVisibility',
  'Analytics',
  'Operations',
];

// ============================================================================
// Brief ID Generation
// ============================================================================

export function generateBriefId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `brief_${timestamp}_${random}`;
}

// ============================================================================
// Content Generation Helpers
// ============================================================================

/**
 * Group deliverables by domain for a specific date range
 */
function groupDeliverablesByDomain(
  programs: PlanningProgram[],
  filter: (d: PlanningDeliverable, program: PlanningProgram) => boolean
): DeliverablesByDomain[] {
  const byDomain: Record<ProgramDomain, DeliverablesByDomain> = {} as Record<ProgramDomain, DeliverablesByDomain>;

  for (const domain of DOMAIN_ORDER) {
    byDomain[domain] = { domain, count: 0, items: [] };
  }

  for (const program of programs) {
    const domain = program.domain;
    if (!domain) continue;

    const deliverables = program.scope?.deliverables || [];
    for (const d of deliverables) {
      if (filter(d, program)) {
        byDomain[domain].count++;
        byDomain[domain].items.push({
          id: d.id,
          title: d.title,
          dueDate: d.dueDate || '',
          programTitle: program.title,
        });
      }
    }
  }

  // Return only domains with items
  return DOMAIN_ORDER
    .filter(d => byDomain[d].count > 0)
    .map(d => byDomain[d]);
}

/**
 * Get deliverables due this week
 */
function getThisWeekDeliverables(
  programs: PlanningProgram[],
  weekStart: Date,
  weekEnd: Date
): DeliverablesByDomain[] {
  return groupDeliverablesByDomain(programs, (d) => {
    if (!d.dueDate || d.status === 'completed') return false;
    const due = new Date(d.dueDate);
    return due >= weekStart && due <= weekEnd;
  });
}

/**
 * Get overdue deliverables
 */
function getOverdueDeliverables(
  programs: PlanningProgram[],
  asOf: Date
): DeliverablesByDomain[] {
  return groupDeliverablesByDomain(programs, (d) => {
    if (!d.dueDate || d.status === 'completed') return false;
    const due = new Date(d.dueDate);
    return due < asOf;
  });
}

/**
 * Calculate program health summaries
 */
function getProgramHealthSummaries(
  programs: PlanningProgram[],
  workItems: WorkItemRecord[]
): {
  summary: { healthy: number; attention: number; atRisk: number };
  atRiskPrograms: ProgramHealthSummary[];
  snapshots: ProgramHealthSnapshot[];
} {
  const snapshots: ProgramHealthSnapshot[] = [];
  const atRiskPrograms: ProgramHealthSummary[] = [];
  let healthy = 0;
  let attention = 0;
  let atRisk = 0;

  for (const program of programs) {
    const snapshot = calculateProgramHealth(program, workItems);
    snapshots.push(snapshot);

    if (snapshot.status === 'Healthy') healthy++;
    else if (snapshot.status === 'Attention') attention++;
    else atRisk++;

    if (snapshot.status === 'At Risk') {
      atRiskPrograms.push({
        programId: program.id,
        programTitle: program.title,
        domain: program.domain || null,
        status: snapshot.status,
        topIssues: snapshot.issues.slice(0, 3),
      });
    }
  }

  // Limit to top 3 at-risk programs
  return {
    summary: { healthy, attention, atRisk },
    atRiskPrograms: atRiskPrograms.slice(0, 3),
    snapshots,
  };
}

/**
 * Get runbook summary from last week
 */
function getRunbookLastWeek(
  companyId: string,
  lastWeekKey: string
): RunbookLastWeekSummary | null {
  // Get standard runbook items for calculation
  const items = getRunbookForIntensity('Standard');
  const summary = calculateRunbookSummary(companyId, items, lastWeekKey);

  if (summary.totalItems === 0) {
    return null;
  }

  const incompleteByDomain: Array<{ domain: ProgramDomain; pendingCount: number }> = [];
  for (const domain of DOMAIN_ORDER) {
    const domainStats = summary.byDomain[domain];
    if (domainStats.pending > 0) {
      incompleteByDomain.push({ domain, pendingCount: domainStats.pending });
    }
  }

  // Sort by pending count descending
  incompleteByDomain.sort((a, b) => b.pendingCount - a.pendingCount);

  return {
    weekKey: lastWeekKey,
    completionPercentage: summary.completionPercentage,
    completedItems: summary.completedItems,
    totalItems: summary.totalItems,
    incompleteByDomain: incompleteByDomain.slice(0, 3),
  };
}

/**
 * Get pending approvals (work items awaiting review)
 * Note: Using 'Planned' status as a proxy for items needing attention/approval
 */
function getPendingApprovals(workItems: WorkItemRecord[]): {
  count: number;
  items: ApprovalPending[];
} {
  // Filter to items that need attention (Planned = needs approval to start)
  const pendingReview = workItems.filter(
    (w) => w.status === 'Planned'
  );

  const items: ApprovalPending[] = pendingReview
    .slice(0, 10)
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: w.area || 'work',
      createdAt: w.createdAt || new Date().toISOString(),
    }));

  return { count: pendingReview.length, items };
}

/**
 * Get scope drift summary from last 30 days
 * Note: In production, this would query operational events for scope violations
 */
function getScopeDriftSummary(
  _companyId: string,
  _since: Date
): ScopeDriftSummary {
  // For now, return empty - in production would query operational events
  return {
    totalBlocked: 0,
    blockedActions: [],
    recommendedActions: [],
  };
}

/**
 * Get recent governance changes from last 7 days
 */
function getRecentChanges(
  companyId: string,
  since: Date
): RecentChange[] {
  const changes = getCompanyChanges(companyId, {
    since: since.toISOString(),
    limit: 10,
  });

  return changes.map((c): RecentChange => {
    if (c.changeType === 'intensity_changed') {
      const payload = c.payload as { fromIntensity: string; toIntensity: string };
      return {
        type: 'intensity_changed',
        programId: c.programId,
        programTitle: c.programTitle,
        description: `Intensity changed from ${payload.fromIntensity} to ${payload.toIntensity}`,
        timestamp: c.timestamp,
      };
    } else {
      const payload = c.payload as { fromStatus: string; toStatus: string };
      return {
        type: 'status_changed',
        programId: c.programId,
        programTitle: c.programTitle,
        description: `Status changed from ${payload.fromStatus} to ${payload.toStatus}`,
        timestamp: c.timestamp,
      };
    }
  });
}

/**
 * Generate recommended actions based on all signals
 */
function generateRecommendedActions(
  content: Partial<WeeklyBriefContent>,
  healthSnapshots: ProgramHealthSnapshot[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  let priority = 1;

  // Add actions for overdue deliverables
  if (content.overdue && content.overdue.length > 0) {
    const totalOverdue = content.overdue.reduce((sum, d) => sum + d.count, 0);
    actions.push({
      id: 'overdue-review',
      priority: priority++,
      category: 'overdue',
      action: `Review and address ${totalOverdue} overdue deliverable${totalOverdue > 1 ? 's' : ''}`,
      context: content.overdue.map(d => `${d.domain}: ${d.count}`).join(', '),
    });
  }

  // Add actions for at-risk programs
  if (content.programHealth?.atRiskPrograms.length) {
    for (const program of content.programHealth.atRiskPrograms.slice(0, 2)) {
      actions.push({
        id: `health-${program.programId}`,
        priority: priority++,
        category: 'health',
        action: `Address health issues in ${program.programTitle}`,
        context: program.topIssues.join('; '),
      });
    }
  }

  // Add actions for pending approvals
  if (content.approvalsPending && content.approvalsPending.count > 0) {
    actions.push({
      id: 'approvals-clear',
      priority: priority++,
      category: 'approvals',
      action: `Clear ${content.approvalsPending.count} pending approval${content.approvalsPending.count > 1 ? 's' : ''}`,
    });
  }

  // Add actions for runbook completion
  if (content.runbook && content.runbook.completionPercentage < 80) {
    actions.push({
      id: 'runbook-complete',
      priority: priority++,
      category: 'runbook',
      action: `Improve runbook completion (${content.runbook.completionPercentage}% last week)`,
      context: content.runbook.incompleteByDomain
        .map(d => d.domain)
        .slice(0, 2)
        .join(', '),
    });
  }

  // Add actions for scope drift
  if (content.scopeDrift && content.scopeDrift.totalBlocked > 0) {
    actions.push({
      id: 'drift-review',
      priority: priority++,
      category: 'drift',
      action: `Review ${content.scopeDrift.totalBlocked} blocked scope action${content.scopeDrift.totalBlocked > 1 ? 's' : ''}`,
    });
  }

  // Add drift-based actions from health snapshots
  for (const snapshot of healthSnapshots) {
    if (snapshot.drift?.status === 'at_risk' || snapshot.drift?.status === 'attention') {
      actions.push({
        id: `drift-${snapshot.programId}`,
        priority: priority++,
        category: 'drift',
        action: `Address cadence drift in ${snapshot.programTitle}`,
        context: snapshot.drift.reasons.join('; '),
      });
    }
  }

  // Return top 5 actions sorted by priority
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// ============================================================================
// Markdown Generation
// ============================================================================

function domainLabel(domain: ProgramDomain): string {
  const labels: Record<ProgramDomain, string> = {
    Strategy: 'Strategy',
    Creative: 'Creative',
    Media: 'Media',
    LocalVisibility: 'Local Visibility',
    Analytics: 'Analytics',
    Operations: 'Operations',
  };
  return labels[domain] || domain;
}

/**
 * Generate markdown content for the brief
 */
function generateMarkdown(content: WeeklyBriefContent, weekKey: string): string {
  const lines: string[] = [];

  lines.push(`# Weekly Brief — ${weekKey}`);
  lines.push('');

  // This Week
  lines.push('## This Week');
  if (content.thisWeek.length === 0) {
    lines.push('No deliverables due this week.');
  } else {
    for (const domain of content.thisWeek) {
      lines.push(`### ${domainLabel(domain.domain)} (${domain.count})`);
      for (const item of domain.items.slice(0, 5)) {
        lines.push(`- ${item.title} — ${item.programTitle} (due ${item.dueDate})`);
      }
      if (domain.items.length > 5) {
        lines.push(`- ... and ${domain.items.length - 5} more`);
      }
    }
  }
  lines.push('');

  // Overdue
  lines.push('## Overdue');
  if (content.overdue.length === 0) {
    lines.push('No overdue deliverables.');
  } else {
    for (const domain of content.overdue) {
      lines.push(`### ${domainLabel(domain.domain)} (${domain.count})`);
      for (const item of domain.items.slice(0, 5)) {
        lines.push(`- ⚠️ ${item.title} — ${item.programTitle} (was due ${item.dueDate})`);
      }
      if (domain.items.length > 5) {
        lines.push(`- ... and ${domain.items.length - 5} more`);
      }
    }
  }
  lines.push('');

  // Program Health
  lines.push('## Program Health');
  const { summary, atRiskPrograms } = content.programHealth;
  lines.push(`- ✅ Healthy: ${summary.healthy}`);
  lines.push(`- ⚡ Attention: ${summary.attention}`);
  lines.push(`- 🔴 At Risk: ${summary.atRisk}`);
  if (atRiskPrograms.length > 0) {
    lines.push('');
    lines.push('### At-Risk Programs');
    for (const program of atRiskPrograms) {
      lines.push(`**${program.programTitle}** (${program.domain || 'No domain'})`);
      for (const issue of program.topIssues) {
        lines.push(`- ${issue}`);
      }
    }
  }
  lines.push('');

  // Runbook
  lines.push('## Runbook');
  if (content.runbook) {
    lines.push(`Last week completion: **${content.runbook.completionPercentage}%** (${content.runbook.completedItems}/${content.runbook.totalItems})`);
    if (content.runbook.incompleteByDomain.length > 0) {
      lines.push('');
      lines.push('Top incomplete domains:');
      for (const d of content.runbook.incompleteByDomain) {
        lines.push(`- ${domainLabel(d.domain)}: ${d.pendingCount} pending`);
      }
    }
  } else {
    lines.push('No runbook data for last week.');
  }
  lines.push('');

  // Approvals Pending
  lines.push('## Approvals Pending');
  if (content.approvalsPending.count === 0) {
    lines.push('No pending approvals.');
  } else {
    lines.push(`**${content.approvalsPending.count}** items awaiting review:`);
    for (const item of content.approvalsPending.items.slice(0, 5)) {
      lines.push(`- ${item.title} (${item.type})`);
    }
    if (content.approvalsPending.count > 5) {
      lines.push(`- ... and ${content.approvalsPending.count - 5} more`);
    }
  }
  lines.push('');

  // Scope Drift
  lines.push('## Scope Drift (Last 30 Days)');
  if (content.scopeDrift.totalBlocked === 0) {
    lines.push('No scope violations in the last 30 days.');
  } else {
    lines.push(`**${content.scopeDrift.totalBlocked}** blocked actions:`);
    for (const action of content.scopeDrift.blockedActions) {
      lines.push(`- ${action.description} (${action.count}x)`);
    }
    if (content.scopeDrift.recommendedActions.length > 0) {
      lines.push('');
      lines.push('Recommended:');
      for (const rec of content.scopeDrift.recommendedActions) {
        lines.push(`- ${rec}`);
      }
    }
  }
  lines.push('');

  // Recent Changes
  lines.push('## Recent Changes (Last 7 Days)');
  if (content.recentChanges.length === 0) {
    lines.push('No governance changes in the last 7 days.');
  } else {
    for (const change of content.recentChanges) {
      const date = new Date(change.timestamp).toLocaleDateString();
      lines.push(`- **${change.programTitle}**: ${change.description} (${date})`);
    }
  }
  lines.push('');

  // Recommended Actions
  lines.push('## Recommended Actions');
  if (content.recommendedActions.length === 0) {
    lines.push('No recommended actions at this time.');
  } else {
    for (let i = 0; i < content.recommendedActions.length; i++) {
      const action = content.recommendedActions[i];
      const context = action.context ? ` — ${action.context}` : '';
      lines.push(`${i + 1}. ${action.action}${context}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Main Generation Function
// ============================================================================

export interface GenerateWeeklyBriefInput {
  companyId: string;
  programs: PlanningProgram[];
  workItems: WorkItemRecord[];
  weekKey?: string;
  createdBy?: string;
  debugId?: string;
}

export interface GenerateWeeklyBriefResult {
  brief: WeeklyBrief;
  debugId: string;
}

/**
 * Generate a weekly brief for a company
 */
export function generateWeeklyBrief(
  input: GenerateWeeklyBriefInput
): GenerateWeeklyBriefResult {
  const {
    companyId,
    programs,
    workItems,
    weekKey = getWeekKey(),
    createdBy = 'system',
    debugId = generateDebugId(),
  } = input;

  const now = new Date();
  const lastWeekKey = getPreviousWeekKey(now);

  // Calculate week date range
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);

  // 30 days ago for scope drift
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 7 days ago for recent changes
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filter to active programs only
  const activePrograms = programs.filter(
    p => p.status !== 'archived' && p.status !== 'draft'
  );

  // Generate content sections
  const thisWeek = getThisWeekDeliverables(activePrograms, weekStart, weekEnd);
  const overdue = getOverdueDeliverables(activePrograms, now);
  const { summary, atRiskPrograms, snapshots } = getProgramHealthSummaries(activePrograms, workItems);
  const runbook = getRunbookLastWeek(companyId, lastWeekKey);
  const approvalsPending = getPendingApprovals(workItems);
  const scopeDrift = getScopeDriftSummary(companyId, thirtyDaysAgo);
  const recentChanges = getRecentChanges(companyId, sevenDaysAgo);

  // Build content object
  const partialContent: Partial<WeeklyBriefContent> = {
    thisWeek,
    overdue,
    programHealth: { summary, atRiskPrograms },
    runbook,
    approvalsPending,
    scopeDrift,
    recentChanges,
  };

  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(partialContent, snapshots);

  const content: WeeklyBriefContent = {
    ...partialContent as WeeklyBriefContent,
    recommendedActions,
  };

  // Generate markdown
  const contentMarkdown = generateMarkdown(content, weekKey);

  // Calculate source summary
  const deliverablesThisWeek = thisWeek.reduce((sum, d) => sum + d.count, 0);
  const deliverablesOverdue = overdue.reduce((sum, d) => sum + d.count, 0);
  const workItemsInProgress = workItems.filter(
    w => w.status === 'In Progress'
  ).length;

  const sourceSummary: WeeklyBriefSourceSummary = {
    programsCount: activePrograms.length,
    deliverablesThisWeek,
    deliverablesOverdue,
    workItemsInProgress,
    approvalsCount: approvalsPending.count,
    scopeViolationsLast30Days: scopeDrift.totalBlocked,
    recentChangesCount: recentChanges.length,
  };

  // Build final brief
  const brief: WeeklyBrief = {
    id: generateBriefId(),
    companyId,
    weekKey,
    createdAt: now.toISOString(),
    createdBy,
    contentMarkdown,
    content,
    sourceSummary,
    debugId,
  };

  return { brief, debugId };
}
