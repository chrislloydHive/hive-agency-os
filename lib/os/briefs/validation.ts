// lib/os/briefs/validation.ts
// Brief generation validation - Frame completeness and accepted bets requirement
//
// Gating Rules (Decide-driven flow):
// 1. Strategy must exist
// 2. Strategic Frame must be complete (audience, valueProp, positioning, constraints)
// 3. At least 1 strategic bet must be accepted
//
// NOTE: Full GAP is NOT required. The new flow is Decide-driven.

import { getProjectStrategyByProjectId } from '@/lib/airtable/projectStrategies';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeFrameCompleteness } from '@/lib/os/strategy/frameValidation';
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
    noStrategy: boolean;
    frameIncomplete: boolean;
    noBetsAccepted: boolean;
    contextIncomplete: boolean;
  };
  strategyData?: {
    strategyId: string;
    frameComplete: boolean;
    missingFrameFields?: string[];
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
 * Requirements (Decide-driven flow):
 * 1. Strategy must exist
 * 2. Strategic Frame must be complete (audience, valueProp, positioning, constraints)
 * 3. At least 1 strategic bet must be accepted
 * 4. Context should be available (warning if incomplete, not blocking)
 */
export async function validateBriefGeneration(
  input: BriefValidationInput
): Promise<BriefValidationResult> {
  const { companyId, projectId } = input;

  // Track missing requirements
  const missingRequirements = {
    noStrategy: true,
    frameIncomplete: true,
    noBetsAccepted: true,
    contextIncomplete: false,
  };

  let strategyData: BriefValidationResult['strategyData'];
  let acceptedBetIds: string[] = [];
  let contextSnapshotId: string | undefined;

  // 1. Check for strategy and frame completeness
  try {
    // Try project strategy first, then company strategy
    let strategy: { id: string; strategyFrame?: Record<string, unknown>; pillars?: Array<{ id: string; status?: string }> } | null = null;

    if (projectId) {
      const projectStrategy = await getProjectStrategyByProjectId(projectId);
      if (projectStrategy) {
        // Map ProjectStrategicFrame to standard frame format for validation
        const projectFrame = projectStrategy.strategicFrame;
        strategy = {
          id: projectStrategy.id,
          strategyFrame: projectFrame ? {
            audience: projectFrame.targetAudience,
            valueProp: projectFrame.coreMessage,
            positioning: projectFrame.tone, // Best mapping available
            constraints: projectFrame.constraints,
          } : undefined,
          pillars: projectStrategy.strategicBets?.map(b => ({ id: b.id, status: b.status })),
        };
      }
    }

    // Fall back to company strategy if no project strategy
    if (!strategy) {
      const companyStrategy = await getActiveStrategy(companyId);
      if (companyStrategy) {
        strategy = {
          id: companyStrategy.id,
          strategyFrame: companyStrategy.strategyFrame as Record<string, unknown> | undefined,
          pillars: companyStrategy.pillars?.map(p => ({ id: p.id, status: (p as { status?: string }).status })),
        };
      }
    }

    if (!strategy) {
      return {
        valid: false,
        error: 'No strategy found. Create a strategy before generating a brief.',
        missingRequirements,
      };
    }

    missingRequirements.noStrategy = false;

    // Check frame completeness
    const frameCompleteness = computeFrameCompleteness(strategy.strategyFrame);

    if (!frameCompleteness.isComplete) {
      return {
        valid: false,
        error: `Strategic Frame is incomplete. Missing: ${frameCompleteness.missingLabels.join(', ')}`,
        missingRequirements: {
          ...missingRequirements,
          frameIncomplete: true,
        },
        strategyData: {
          strategyId: strategy.id,
          frameComplete: false,
          missingFrameFields: frameCompleteness.missingFields,
        },
      };
    }

    missingRequirements.frameIncomplete = false;

    strategyData = {
      strategyId: strategy.id,
      frameComplete: true,
    };

    // 2. Check for accepted strategic bets
    // Note: In the DB, 'accepted' bets are stored as 'active' pillars
    // (see strategicBetToPillar in lib/types/strategy.ts)
    const pillars = strategy.pillars || [];
    acceptedBetIds = pillars
      .filter((p) => p.status === 'accepted' || p.status === 'active')
      .map((p) => p.id);

    if (acceptedBetIds.length === 0) {
      return {
        valid: false,
        error: 'No accepted strategic bets. Accept at least one bet before generating a brief.',
        missingRequirements: {
          ...missingRequirements,
          noBetsAccepted: true,
        },
        strategyData,
      };
    }

    missingRequirements.noBetsAccepted = false;
  } catch (error) {
    console.error('[BriefValidation] Failed to check strategy:', error);
    return {
      valid: false,
      error: 'Failed to check strategy. Please try again.',
      missingRequirements,
    };
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
    strategyData,
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

  if (missing.noStrategy) {
    issues.push('Create a strategy');
  }

  if (missing.frameIncomplete) {
    const missingFields = result.strategyData?.missingFrameFields;
    if (missingFields && missingFields.length > 0) {
      issues.push(`Complete Strategic Frame (missing: ${missingFields.join(', ')})`);
    } else {
      issues.push('Complete Strategic Frame');
    }
  }

  if (missing.noBetsAccepted) {
    issues.push('Accept at least one strategic bet');
  }

  if (issues.length === 0) {
    return 'Unknown error preventing brief generation';
  }

  return `To generate a brief: ${issues.join(', ')}`;
}
