// lib/os/projects/gapGating.ts
// GAP readiness validation for project brief generation
//
// Full GAP must be completed before project strategy and brief generation.
// This is a hard requirement - no exceptions.

import { getLatestOsGapFullReportForCompany } from '@/lib/airtable/gapFullReports';
import type { GapFullReportRecord } from '@/lib/airtable/gapFullReports';

// ============================================================================
// Types
// ============================================================================

export interface GapReadinessResult {
  ready: boolean;
  gapReportId?: string;
  gapScore?: number;
  maturityStage?: string;
  blockedReason?: string;
}

// ============================================================================
// GAP Readiness Validation
// ============================================================================

/**
 * Validate that Full GAP is complete for a company
 * Returns readiness status with GAP report details
 */
export async function validateGapReadiness(
  companyId: string
): Promise<GapReadinessResult> {
  try {
    // Get the latest GAP Full Report for this company
    const rawReport = await getLatestOsGapFullReportForCompany(companyId);

    if (!rawReport) {
      return {
        ready: false,
        blockedReason: 'No GAP report found. Run Full GAP before generating a brief.',
      };
    }

    // Extract fields from raw report
    const reportId = rawReport.id;
    const status = rawReport.fields?.['Status'] as GapFullReportRecord['status'] | undefined;
    const overallScore = rawReport.fields?.['Overall Score'] as number | undefined;
    const maturityStage = rawReport.fields?.['Maturity Stage'] as string | undefined;

    // Check status - must be 'ready'
    if (status !== 'ready') {
      const statusMessages: Record<string, string> = {
        draft: 'GAP report is in draft. Complete the Full GAP run.',
        processing: 'GAP report is still processing. Please wait.',
        archived: 'GAP report is archived. Run a new Full GAP.',
        error: 'GAP report encountered an error. Run a new Full GAP.',
      };

      return {
        ready: false,
        gapReportId: reportId,
        blockedReason: status ? statusMessages[status] : 'GAP report is not ready.',
      };
    }

    // GAP is ready
    return {
      ready: true,
      gapReportId: reportId,
      gapScore: overallScore,
      maturityStage,
    };
  } catch (error) {
    console.error('[GapGating] Failed to validate GAP readiness:', error);
    return {
      ready: false,
      blockedReason: 'Failed to check GAP status. Please try again.',
    };
  }
}

/**
 * Check if GAP is ready for a company (simple boolean)
 */
export async function isGapReady(companyId: string): Promise<boolean> {
  const result = await validateGapReadiness(companyId);
  return result.ready;
}

/**
 * Get GAP report ID for a company (if ready)
 */
export async function getReadyGapReportId(companyId: string): Promise<string | null> {
  const result = await validateGapReadiness(companyId);
  return result.ready ? (result.gapReportId || null) : null;
}
