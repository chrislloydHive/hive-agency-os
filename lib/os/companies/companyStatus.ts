// lib/os/companies/companyStatus.ts
// Company Status computation helper
//
// This module computes the CompanyStatusSummary for the Status View.
// It aggregates data from pipeline leads, diagnostic runs, and findings.

import type {
  CompanyStatusSummary,
  CompanyLifecycleStage,
  CompanyOverallStatus,
  WorkupChecklist,
} from '@/lib/types/companyStatus';
import type { PipelineLeadStage, InboundLeadItem } from '@/lib/types/pipeline';
import { getInboundLeadById, getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import {
  getLatestRunForCompanyAndTool,
  getRecentRunsForCompany,
  type DiagnosticRun,
} from '@/lib/os/diagnostics/runs';
import { getCompanyFindings, type FindingsSummary } from '@/lib/os/findings/companyFindings';

// ============================================================================
// Types
// ============================================================================

export interface GetCompanyStatusParams {
  companyId: string;
  leadId?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map pipeline stage to lifecycle stage
 */
function mapPipelineStageToLifecycle(
  pipelineStage: PipelineLeadStage | null | undefined
): CompanyLifecycleStage {
  if (!pipelineStage) return 'active_client';

  const mapping: Record<PipelineLeadStage, CompanyLifecycleStage> = {
    new: 'lead',
    qualified: 'qualified',
    meeting_scheduled: 'meeting_scheduled',
    proposal: 'proposal',
    won: 'active_client',
    lost: 'lost',
  };

  return mapping[pipelineStage] || 'active_client';
}

/**
 * Count completed checklist items
 */
function countChecklistCompleted(checklist: WorkupChecklist): number {
  let count = 0;
  if (checklist.qbrReviewed) count++;
  if (checklist.mediaLabReviewed) count++;
  if (checklist.seoLabReviewed) count++;
  if (checklist.competitionLabReviewed) count++;
  if (checklist.workPlanDrafted) count++;
  return count;
}

/**
 * Compute overall status and reason based on available data
 */
function computeOverallStatus(params: {
  gapScore?: number | null;
  highSeverityIssuesCount?: number;
  mediaProgramActive?: boolean;
  lifecycleStage: CompanyLifecycleStage;
}): { status: CompanyOverallStatus; reason: string } {
  const { gapScore, highSeverityIssuesCount, mediaProgramActive, lifecycleStage } = params;

  // Default to yellow
  let status: CompanyOverallStatus = 'yellow';
  const reasons: string[] = [];

  // Lost leads are red
  if (lifecycleStage === 'lost') {
    return { status: 'red', reason: 'Lead marked as lost.' };
  }

  // Check GAP score
  if (gapScore !== null && gapScore !== undefined) {
    if (gapScore < 60) {
      status = 'red';
      reasons.push(`Low GAP score (${gapScore})`);
    } else if (gapScore >= 80) {
      // Candidate for green
      status = 'green';
      reasons.push(`Strong GAP score (${gapScore})`);
    } else {
      // 60-79 is yellow
      reasons.push(`Moderate GAP score (${gapScore})`);
    }
  } else {
    reasons.push('No GAP score available');
  }

  // Check high severity issues
  if (highSeverityIssuesCount !== undefined && highSeverityIssuesCount >= 5) {
    status = 'red';
    reasons.push(`${highSeverityIssuesCount} high-severity issues`);
  } else if (highSeverityIssuesCount !== undefined && highSeverityIssuesCount >= 3) {
    // Downgrade from green to yellow if many issues
    if (status === 'green') {
      status = 'yellow';
    }
    reasons.push(`${highSeverityIssuesCount} high-severity issues`);
  } else if (highSeverityIssuesCount !== undefined && highSeverityIssuesCount <= 2) {
    // Few issues - keep current status or upgrade to green
    if (status === 'green') {
      reasons.push('Few critical issues');
    }
  }

  // Media program active is a positive signal
  if (mediaProgramActive) {
    reasons.push('Active media program');
  }

  // Build reason string
  const reason = reasons.length > 0 ? reasons.join('. ') + '.' : 'Status computed based on available data.';

  return { status, reason };
}

/**
 * Get GAP data from recent diagnostic runs
 */
async function getGapData(companyId: string): Promise<{
  gapScore?: number | null;
  gapMaturity?: string | null;
  lastGapRunAt?: string | null;
  lastGapRunId?: string | null;
}> {
  try {
    // Try to get the latest GAP-Plan run first
    let latestRun = await getLatestRunForCompanyAndTool(companyId, 'gapPlan');

    // Fall back to GAP Snapshot (GAP-IA)
    if (!latestRun || latestRun.status !== 'complete') {
      latestRun = await getLatestRunForCompanyAndTool(companyId, 'gapSnapshot');
    }

    if (!latestRun || latestRun.status !== 'complete') {
      return {};
    }

    // Extract maturity stage from rawJson if available
    let maturity: string | null = null;
    if (latestRun.rawJson && typeof latestRun.rawJson === 'object') {
      const raw = latestRun.rawJson as any;
      maturity = raw.summary?.maturityStage
        ?? raw.maturityStage
        ?? raw.initialAssessment?.summary?.maturityStage
        ?? null;
    }

    return {
      gapScore: latestRun.score,
      gapMaturity: maturity,
      lastGapRunAt: latestRun.updatedAt || latestRun.createdAt,
      lastGapRunId: latestRun.id,
    };
  } catch (error) {
    console.error('[companyStatus] Error fetching GAP data:', error);
    return {};
  }
}

/**
 * Get findings summary for a company
 */
async function getIssuesCounts(companyId: string): Promise<{
  highSeverityIssuesCount: number;
  totalIssuesCount: number;
}> {
  try {
    const findings = await getCompanyFindings(companyId);

    const highSeverity = findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;

    return {
      highSeverityIssuesCount: highSeverity,
      totalIssuesCount: findings.length,
    };
  } catch (error) {
    console.error('[companyStatus] Error fetching findings:', error);
    return {
      highSeverityIssuesCount: 0,
      totalIssuesCount: 0,
    };
  }
}

/**
 * Find the primary lead for a company (most recent DMA Full GAP lead)
 */
async function findPrimaryLeadForCompany(companyId: string): Promise<InboundLeadItem | null> {
  try {
    const allLeads = await getAllInboundLeads();

    // Filter leads for this company
    const companyLeads = allLeads.filter((lead) => lead.companyId === companyId);

    if (companyLeads.length === 0) {
      return null;
    }

    // Prefer DMA Full GAP leads
    const dmaLeads = companyLeads.filter((lead) => lead.leadSource === 'DMA Full GAP');
    if (dmaLeads.length > 0) {
      // Return most recent (already sorted by createdAt desc)
      return dmaLeads[0];
    }

    // Otherwise return the most recent lead
    return companyLeads[0];
  } catch (error) {
    console.error('[companyStatus] Error finding primary lead:', error);
    return null;
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Company Status Summary
 *
 * Computes a comprehensive status summary for a company including:
 * - Lifecycle/pipeline stage
 * - GAP score and maturity
 * - Issues count
 * - Overall status (red/yellow/green)
 *
 * @param params - companyId and optional leadId
 * @returns CompanyStatusSummary
 */
export async function getCompanyStatusSummary(
  params: GetCompanyStatusParams
): Promise<CompanyStatusSummary> {
  const { companyId, leadId } = params;

  console.log('[companyStatus] Computing status for company:', { companyId, leadId });

  // Initialize with defaults
  const now = new Date().toISOString();
  const summary: CompanyStatusSummary = {
    companyId,
    lifecycleStage: 'active_client',
    overallStatus: 'yellow',
    updatedAt: now,
  };

  try {
    // Fetch company data
    const company = await getCompanyById(companyId);
    if (!company) {
      console.warn('[companyStatus] Company not found:', companyId);
      return summary;
    }

    // Check media program status
    const mediaProgramActive = companyHasMediaProgram(company);
    summary.mediaProgramActive = mediaProgramActive;

    // Get lead data (from provided leadId or find primary lead)
    let lead: InboundLeadItem | null = null;
    if (leadId) {
      lead = await getInboundLeadById(leadId);
    }
    if (!lead) {
      lead = await findPrimaryLeadForCompany(companyId);
    }

    // Process lead data if available
    if (lead) {
      summary.leadId = lead.id;
      summary.leadSource = lead.leadSource;
      summary.ownerUserId = lead.assignee;
      summary.pipelineStage = lead.pipelineStage;
      summary.lifecycleStage = mapPipelineStageToLifecycle(lead.pipelineStage);

      // Use GAP data from lead if available
      if (lead.gapOverallScore !== null && lead.gapOverallScore !== undefined) {
        summary.gapScore = lead.gapOverallScore;
        summary.gapMaturity = lead.gapMaturityStage;
        summary.lastGapRunAt = lead.lastActivityAt || lead.createdAt;
        if (lead.gapPlanRunId) {
          summary.lastGapRunId = lead.gapPlanRunId;
        }
      }

      // Build checklist from lead
      const checklist: WorkupChecklist = {
        qbrReviewed: lead.qbrReviewed ?? false,
        mediaLabReviewed: lead.mediaLabReviewed ?? false,
        seoLabReviewed: lead.seoLabReviewed ?? false,
        competitionLabReviewed: lead.competitionLabReviewed ?? false,
        workPlanDrafted: lead.workPlanDrafted ?? false,
      };
      summary.checklist = checklist;
      summary.checklistCompleted = countChecklistCompleted(checklist);
      summary.checklistTotal = 5;
    }

    // If no GAP data from lead, get from diagnostic runs
    if (summary.gapScore === null || summary.gapScore === undefined) {
      const gapData = await getGapData(companyId);
      if (gapData.gapScore !== null && gapData.gapScore !== undefined) {
        summary.gapScore = gapData.gapScore;
        summary.gapMaturity = gapData.gapMaturity;
        summary.lastGapRunAt = gapData.lastGapRunAt;
        summary.lastGapRunId = gapData.lastGapRunId;
      }
    }

    // Get issues counts
    const issuesCounts = await getIssuesCounts(companyId);
    summary.highSeverityIssuesCount = issuesCounts.highSeverityIssuesCount;
    summary.totalIssuesCount = issuesCounts.totalIssuesCount;

    // Compute overall status
    const { status, reason } = computeOverallStatus({
      gapScore: summary.gapScore,
      highSeverityIssuesCount: summary.highSeverityIssuesCount,
      mediaProgramActive: summary.mediaProgramActive,
      lifecycleStage: summary.lifecycleStage,
    });
    summary.overallStatus = status;
    summary.overallStatusReason = reason;

    console.log('[companyStatus] Status computed:', {
      companyId,
      lifecycleStage: summary.lifecycleStage,
      overallStatus: summary.overallStatus,
      gapScore: summary.gapScore,
      highSeverityIssuesCount: summary.highSeverityIssuesCount,
    });

    return summary;
  } catch (error) {
    console.error('[companyStatus] Error computing status:', error);
    return summary;
  }
}

// ============================================================================
// COMPANY STATUS HEADER TYPES (for Overview page)
// ============================================================================

export type PerformanceState = 'good' | 'watch' | 'risk' | 'unknown';
export type WorkStatusState = 'on_track' | 'blocked' | 'none' | 'unknown' | 'watch';

export type NextActionKey =
  | 'run_diagnostics'
  | 'review_context'
  | 'create_strategy'
  | 'deliberate_bets'
  | 'generate_tactics'
  | 'generate_brief'
  | 'review_work'
  | 'view_reports';

export interface PerformanceMetric {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface PerformanceSnapshot {
  state: PerformanceState;
  primaryMetric?: PerformanceMetric;
  secondaryMetrics?: PerformanceMetric[];
  note?: string;
}

export interface WorkSnapshot {
  state: WorkStatusState;
  counts: {
    inProgress: number;
    blocked: number;
    dueSoon: number;
    total: number;
  };
  note?: string;
}

export interface NextBestActionStatus {
  key: NextActionKey;
  title: string;
  description?: string;
  href: string;
}

export interface CompanyStatusHeader {
  performance: PerformanceSnapshot;
  work: WorkSnapshot;
  nextAction: NextBestActionStatus;
  contextReadiness?: {
    ready: boolean;
    completenessPercent: number;
    missingCount: number;
  };
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const NEXT_ACTION_CONFIG: Record<NextActionKey, { title: string; description: string; pathSuffix: string }> = {
  run_diagnostics: {
    title: 'Run Diagnostics',
    description: 'Get baseline health scores and identify issues',
    pathSuffix: '/blueprint',
  },
  review_context: {
    title: 'Review Context',
    description: 'Fill missing context fields for better strategy',
    pathSuffix: '/context',
  },
  create_strategy: {
    title: 'Create Strategy',
    description: 'Define strategic frame and positioning',
    pathSuffix: '/strategy',
  },
  deliberate_bets: {
    title: 'Deliberate Bets',
    description: 'Review and accept strategic bets',
    pathSuffix: '/strategy',
  },
  generate_tactics: {
    title: 'Generate Tactics',
    description: 'Create tactical initiatives from accepted bets',
    pathSuffix: '/strategy',
  },
  generate_brief: {
    title: 'Generate Brief',
    description: 'Create creative brief for active project',
    pathSuffix: '/projects',
  },
  review_work: {
    title: 'Review Work',
    description: 'Manage and prioritize active work items',
    pathSuffix: '/work',
  },
  view_reports: {
    title: 'View Reports',
    description: 'Review performance and progress reports',
    pathSuffix: '/reports',
  },
};

// ============================================================================
// Status Header Helper Functions
// ============================================================================

function isWithinDays(dateStr: string | undefined | null, days: number): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return date <= cutoff;
  } catch {
    return false;
  }
}

function getTrend(change?: number | null): 'up' | 'down' | 'flat' {
  if (change === undefined || change === null) return 'flat';
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'flat';
}

function formatMetricNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

interface NextActionContext {
  companyId: string;
  hasDiagnostics: boolean;
  contextReadinessPercent?: number;
  hasStrategy: boolean;
  hasAcceptedBets: boolean;
  hasTactics: boolean;
  hasActiveProject: boolean;
  hasProjectBrief: boolean;
  workState: WorkStatusState;
}

function determineNextAction(ctx: NextActionContext): NextBestActionStatus {
  const buildAction = (key: NextActionKey): NextBestActionStatus => {
    const config = NEXT_ACTION_CONFIG[key];
    return {
      key,
      title: config.title,
      description: config.description,
      href: `/c/${ctx.companyId}${config.pathSuffix}`,
    };
  };

  // Priority 1: No diagnostics run - need baseline
  if (!ctx.hasDiagnostics) {
    return buildAction('run_diagnostics');
  }

  // Priority 2: Context not ready - missing required fields (less than 50%)
  if (ctx.contextReadinessPercent !== undefined && ctx.contextReadinessPercent < 50) {
    return buildAction('review_context');
  }

  // Priority 3: No strategy exists
  if (!ctx.hasStrategy) {
    return buildAction('create_strategy');
  }

  // Priority 4: Strategy exists but no accepted bets
  if (ctx.hasStrategy && !ctx.hasAcceptedBets) {
    return buildAction('deliberate_bets');
  }

  // Priority 5: Accepted bets but no tactics
  if (ctx.hasAcceptedBets && !ctx.hasTactics) {
    return buildAction('generate_tactics');
  }

  // Priority 6: Active project needs brief
  if (ctx.hasActiveProject && !ctx.hasProjectBrief) {
    return buildAction('generate_brief');
  }

  // Priority 7: Work needs attention
  if (ctx.workState === 'blocked' || ctx.workState === 'watch') {
    return buildAction('review_work');
  }

  // Default: View reports
  return buildAction('view_reports');
}

// ============================================================================
// Compute Status Header (Lightweight - from pre-fetched data)
// ============================================================================

export interface StatusHeaderInput {
  companyId: string;
  /** Performance pulse from GA4/GSC */
  performancePulse?: {
    hasGa4?: boolean;
    hasGsc?: boolean;
    currentSessions?: number | null;
    trafficChange7d?: number | null;
    currentConversions?: number | null;
    conversionsChange7d?: number | null;
    currentClicks?: number | null;
    seoVisibilityChange7d?: number | null;
    hasAnomalies?: boolean;
    anomalySummary?: string | null;
  } | null;
  /** Work item counts */
  workCounts?: { inProgress: number; blocked: number; dueSoon: number; total: number };
  /** Whether diagnostics have been run (GAP score exists) */
  hasDiagnostics?: boolean;
  /** Context readiness percentage (0-100) */
  contextReadinessPercent?: number;
  /** Whether a strategy exists */
  hasStrategy?: boolean;
  /** Whether strategy has accepted bets */
  hasAcceptedBets?: boolean;
  /** Whether strategy has tactics */
  hasTactics?: boolean;
  /** Whether there's an active project */
  hasActiveProject?: boolean;
  /** Whether active project has approved brief */
  hasProjectBrief?: boolean;
}

/**
 * Compute company status header from pre-fetched data
 * Use this when you already have the data from other queries
 */
export function computeStatusHeader(input: StatusHeaderInput): CompanyStatusHeader {
  const {
    companyId,
    performancePulse,
    workCounts,
    hasDiagnostics = false,
    contextReadinessPercent,
    hasStrategy = false,
    hasAcceptedBets = false,
    hasTactics = false,
    hasActiveProject = false,
    hasProjectBrief = false,
  } = input;

  // Compute performance snapshot
  let performanceSnapshot: PerformanceSnapshot;
  if (!performancePulse || (!performancePulse.hasGa4 && !performancePulse.hasGsc)) {
    performanceSnapshot = {
      state: 'unknown',
      note: 'No analytics connected',
    };
  } else {
    const metrics: PerformanceMetric[] = [];
    let negativeSignals = 0;
    let positiveSignals = 0;

    // Traffic metric
    if (performancePulse.hasGa4 && performancePulse.currentSessions !== undefined && performancePulse.currentSessions !== null) {
      const trafficTrend = getTrend(performancePulse.trafficChange7d);
      metrics.push({
        label: 'Sessions',
        value: formatMetricNumber(performancePulse.currentSessions),
        trend: trafficTrend,
      });
      if (trafficTrend === 'down') negativeSignals++;
      else if (trafficTrend === 'up') positiveSignals++;
    }

    // Conversions metric
    if (performancePulse.hasGa4 && performancePulse.currentConversions !== undefined && performancePulse.currentConversions !== null) {
      const conversionTrend = getTrend(performancePulse.conversionsChange7d);
      metrics.push({
        label: 'Conversions',
        value: formatMetricNumber(performancePulse.currentConversions),
        trend: conversionTrend,
      });
      if (conversionTrend === 'down') negativeSignals++;
      else if (conversionTrend === 'up') positiveSignals++;
    }

    // SEO clicks
    if (performancePulse.hasGsc && performancePulse.currentClicks !== undefined && performancePulse.currentClicks !== null) {
      const seoTrend = getTrend(performancePulse.seoVisibilityChange7d);
      metrics.push({
        label: 'SEO Clicks',
        value: formatMetricNumber(performancePulse.currentClicks),
        trend: seoTrend,
      });
      if (seoTrend === 'down') negativeSignals++;
      else if (seoTrend === 'up') positiveSignals++;
    }

    // Determine state
    let state: PerformanceState = 'good';
    if (negativeSignals >= 2) {
      state = 'risk';
    } else if (negativeSignals === 1) {
      state = 'watch';
    }

    performanceSnapshot = {
      state,
      primaryMetric: metrics[0],
      secondaryMetrics: metrics.slice(1).length > 0 ? metrics.slice(1) : undefined,
      note: performancePulse.hasAnomalies && performancePulse.anomalySummary
        ? performancePulse.anomalySummary
        : undefined,
    };
  }

  // Compute work snapshot
  let workSnapshot: WorkSnapshot;
  if (!workCounts || workCounts.total === 0) {
    workSnapshot = {
      state: 'none',
      counts: { inProgress: 0, blocked: 0, dueSoon: 0, total: 0 },
      note: 'No work items yet',
    };
  } else {
    let state: WorkStatusState = 'on_track';
    let note: string | undefined;

    if (workCounts.blocked > 0) {
      state = 'blocked';
      note = `${workCounts.blocked} item${workCounts.blocked > 1 ? 's' : ''} blocked`;
    } else if (workCounts.dueSoon > 0 && workCounts.inProgress === 0) {
      state = 'watch';
      note = `${workCounts.dueSoon} item${workCounts.dueSoon > 1 ? 's' : ''} due soon`;
    } else if (workCounts.inProgress > 0) {
      note = `${workCounts.inProgress} in progress`;
    }

    workSnapshot = { state, counts: workCounts, note };
  }

  // Determine next action
  const nextAction = determineNextAction({
    companyId,
    hasDiagnostics,
    contextReadinessPercent,
    hasStrategy,
    hasAcceptedBets,
    hasTactics,
    hasActiveProject,
    hasProjectBrief,
    workState: workSnapshot.state,
  });

  return {
    performance: performanceSnapshot,
    work: workSnapshot,
    nextAction,
    contextReadiness: contextReadinessPercent !== undefined
      ? {
          ready: contextReadinessPercent >= 80,
          completenessPercent: contextReadinessPercent,
          missingCount: Math.round((100 - contextReadinessPercent) / 12.5), // rough estimate (8 fields)
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };
}
