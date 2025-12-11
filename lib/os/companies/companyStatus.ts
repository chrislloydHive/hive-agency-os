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
  let summary: CompanyStatusSummary = {
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
