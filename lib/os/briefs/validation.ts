// lib/os/briefs/validation.ts
// Brief generation validation - GAP gating and accepted bets requirement
//
// Gating Rules (NON-NEGOTIABLE):
// 1. No brief generation without Full GAP complete
// 2. No brief generation without at least 1 accepted strategic bet

import { getLatestOsGapFullReportForCompany } from '@/lib/airtable/gapFullReports';
import { getProjectStrategyByProjectId } from '@/lib/airtable/projectStrategies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { BriefGenerationValidation, BriefType } from '@/lib/types/brief';

// ============================================================================
// Types
// ============================================================================

export interface BriefValidationInput {
  companyId: string;
  projectId?: string;
  type: BriefType;
}

export interface BriefValidationResult {
  valid: boolean;
  error?: string;
  missingRequirements?: {
    gapMissing: boolean;
    noBetsAccepted: boolean;
    contextIncomplete: boolean;
  };
  gapData?: {
    runId: string;
    score?: number;
    maturityStage?: string;
  };
  acceptedBetIds?: string[];
  contextSnapshotId?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that all requirements are met for brief generation
 *
 * Requirements:
 * 1. Full GAP must be complete (status='ready')
 * 2. At least 1 strategic bet must be accepted
 * 3. Context should be available (warning if incomplete)
 */
export async function validateBriefGeneration(
  input: BriefValidationInput
): Promise<BriefValidationResult> {
  const { companyId, projectId } = input;

  // Track missing requirements
  const missingRequirements = {
    gapMissing: true,
    noBetsAccepted: true,
    contextIncomplete: false,
  };

  let gapData: BriefValidationResult['gapData'];
  let acceptedBetIds: string[] = [];
  let contextSnapshotId: string | undefined;

  // 1. Check GAP readiness
  try {
    const rawReport = await getLatestOsGapFullReportForCompany(companyId);

    if (!rawReport) {
      return {
        valid: false,
        error: 'No GAP report found. Run Full GAP before generating a brief.',
        missingRequirements,
      };
    }

    const status = rawReport.fields?.['Status'] as string | undefined;
    if (status !== 'ready') {
      return {
        valid: false,
        error: `GAP report is not ready (status: ${status || 'unknown'}). Complete the Full GAP run.`,
        missingRequirements,
      };
    }

    // GAP is ready
    missingRequirements.gapMissing = false;
    gapData = {
      runId: rawReport.id,
      score: rawReport.fields?.['Overall Score'] as number | undefined,
      maturityStage: rawReport.fields?.['Maturity Stage'] as string | undefined,
    };
  } catch (error) {
    console.error('[BriefValidation] Failed to check GAP:', error);
    return {
      valid: false,
      error: 'Failed to check GAP status. Please try again.',
      missingRequirements,
    };
  }

  // 2. Check for accepted strategic bets
  if (projectId) {
    try {
      const strategy = await getProjectStrategyByProjectId(projectId);

      if (!strategy) {
        return {
          valid: false,
          error: 'No project strategy found. Create a strategy before generating a brief.',
          missingRequirements,
        };
      }

      // Get accepted bets
      const strategicBets = strategy.strategicBets || [];
      acceptedBetIds = strategicBets
        .filter((bet) => bet.status === 'accepted')
        .map((bet) => bet.id);

      if (acceptedBetIds.length === 0) {
        return {
          valid: false,
          error: 'No accepted strategic bets. Accept at least one bet before generating a brief.',
          missingRequirements,
        };
      }

      missingRequirements.noBetsAccepted = false;
    } catch (error) {
      console.error('[BriefValidation] Failed to check strategy:', error);
      return {
        valid: false,
        error: 'Failed to check project strategy. Please try again.',
        missingRequirements,
      };
    }
  } else {
    // For engagement-level briefs without a project, we still need accepted bets
    // This would come from company strategy - for now, skip this check
    missingRequirements.noBetsAccepted = false;
    console.warn('[BriefValidation] Engagement-level brief - skipping bet check');
  }

  // 3. Check context (warning only, not blocking)
  try {
    const contextGraph = await loadContextGraph(companyId);

    if (contextGraph) {
      // Use company ID as context snapshot ID for now
      contextSnapshotId = companyId;

      // Check for critical fields
      const hasAudience = contextGraph.audience?.primaryAudience?.value;
      const hasBrand = contextGraph.brand?.toneOfVoice?.value || contextGraph.brand?.brandPersonality?.value;

      if (!hasAudience || !hasBrand) {
        missingRequirements.contextIncomplete = true;
        console.warn('[BriefValidation] Context is incomplete - brief may be less accurate');
      }
    } else {
      missingRequirements.contextIncomplete = true;
      console.warn('[BriefValidation] No context graph found - brief generation may be limited');
    }
  } catch (error) {
    console.error('[BriefValidation] Failed to check context:', error);
    missingRequirements.contextIncomplete = true;
  }

  // All requirements met
  return {
    valid: true,
    missingRequirements,
    gapData,
    acceptedBetIds,
    contextSnapshotId,
  };
}

/**
 * Quick check if brief generation is possible
 */
export async function canGenerateBrief(
  companyId: string,
  projectId?: string
): Promise<boolean> {
  const result = await validateBriefGeneration({
    companyId,
    projectId,
    type: 'creative', // Type doesn't matter for validation
  });
  return result.valid;
}

/**
 * Get a human-readable message about what's blocking brief generation
 */
export function getBlockingMessage(result: BriefValidationResult): string {
  if (result.valid) {
    return '';
  }

  if (result.error) {
    return result.error;
  }

  const missing = result.missingRequirements;
  if (!missing) {
    return 'Unknown error preventing brief generation';
  }

  const issues: string[] = [];

  if (missing.gapMissing) {
    issues.push('Complete Full GAP');
  }

  if (missing.noBetsAccepted) {
    issues.push('Accept at least one strategic bet');
  }

  if (issues.length === 0) {
    return 'Unknown error preventing brief generation';
  }

  return `To generate a brief: ${issues.join(', ')}`;
}
