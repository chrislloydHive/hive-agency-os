// lib/os/strategy/promotion.ts
// Promotion operations for Strategy Workspace V4
//
// Handles the promotion of artifacts to canonical strategy.
// GUARDRAIL: Canonical strategy is only created/updated via promotion.

import {
  createDraftStrategy,
  getActiveStrategy,
  updateStrategy,
} from '../strategy';
import {
  getArtifactById,
  promoteArtifact,
} from './artifacts';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';
import { generateStrategyItemId } from '@/lib/types/strategy';

// ============================================================================
// Promotion Types
// ============================================================================

/**
 * Request to promote an artifact as a new canonical strategy
 */
export interface PromoteAsStrategyRequest {
  artifactId: string;
  companyId: string;
  title: string;
  summary: string;
  objectives?: string[];
  pillars?: Omit<StrategyPillar, 'id'>[];
}

/**
 * Request to promote an artifact as a pillar on existing strategy
 */
export interface PromoteAsPillarRequest {
  artifactId: string;
  strategyId: string;
  pillarData: Omit<StrategyPillar, 'id' | 'sourceArtifactId'>;
}

/**
 * Promotion result
 */
export interface PromotionResult {
  success: boolean;
  artifact: StrategyArtifact;
  strategy?: CompanyStrategy;
  error?: string;
}

// ============================================================================
// Promotion Operations
// ============================================================================

/**
 * Promote an artifact as a new canonical strategy
 *
 * GUARDRAIL: This is the primary way to create canonical strategies from
 * the workspace. It ensures traceability back to source artifacts.
 */
export async function promoteArtifactAsStrategy(
  request: PromoteAsStrategyRequest
): Promise<PromotionResult> {
  const { artifactId, companyId, title, summary, objectives, pillars } = request;

  try {
    // 1. Verify artifact exists and is promotable
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      return { success: false, artifact: {} as StrategyArtifact, error: 'Artifact not found' };
    }
    if (artifact.status === 'promoted') {
      return { success: false, artifact, error: 'Artifact already promoted' };
    }
    if (artifact.status === 'discarded') {
      return { success: false, artifact, error: 'Cannot promote discarded artifact' };
    }

    // 2. Create new canonical strategy with artifact lineage
    const strategy = await createDraftStrategy({
      companyId,
      title,
      summary,
      objectives: objectives || [],
      pillars: pillars || [],
      // Inherit context traceability from artifact
      baseContextRevisionId: artifact.linkedContextRevisionId,
      competitionSourceUsed: artifact.linkedCompetitionSource,
      // Mark as promoted from artifacts
      sourceArtifactIds: [artifactId],
      promotedFromArtifacts: true,
    });

    // 3. Mark artifact as promoted
    const promotedArtifact = await promoteArtifact({
      artifactId,
      targetStrategyId: strategy.id,
    });

    console.log('[promoteArtifactAsStrategy] Promoted artifact to strategy:', {
      artifactId,
      strategyId: strategy.id,
    });

    return {
      success: true,
      artifact: promotedArtifact,
      strategy,
    };
  } catch (error) {
    console.error('[promoteArtifactAsStrategy] Error:', error);
    return {
      success: false,
      artifact: {} as StrategyArtifact,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Promote an artifact as a pillar on an existing strategy
 *
 * GUARDRAIL: Adds a pillar with traceability to its source artifact.
 */
export async function promoteArtifactAsPillar(
  request: PromoteAsPillarRequest
): Promise<PromotionResult> {
  const { artifactId, strategyId, pillarData } = request;

  try {
    // 1. Verify artifact exists and is promotable
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      return { success: false, artifact: {} as StrategyArtifact, error: 'Artifact not found' };
    }
    if (artifact.status === 'promoted') {
      return { success: false, artifact, error: 'Artifact already promoted' };
    }
    if (artifact.status === 'discarded') {
      return { success: false, artifact, error: 'Cannot promote discarded artifact' };
    }

    // 2. Get existing strategy
    const existingStrategy = await getActiveStrategy(artifact.companyId);
    if (!existingStrategy || existingStrategy.id !== strategyId) {
      // Try fetching by ID directly
      const targetStrategy = await getActiveStrategy(artifact.companyId);
      if (!targetStrategy) {
        return { success: false, artifact, error: 'Target strategy not found' };
      }
    }

    // 3. Create pillar with artifact source
    const newPillar: StrategyPillar = {
      ...pillarData,
      id: generateStrategyItemId(),
      sourceArtifactId: artifactId,
      order: existingStrategy?.pillars.length ?? 0,
    };

    // 4. Update strategy with new pillar and artifact lineage
    const currentArtifactIds = existingStrategy?.sourceArtifactIds || [];
    const strategy = await updateStrategy({
      strategyId,
      updates: {
        pillars: [...(existingStrategy?.pillars || []), newPillar],
        sourceArtifactIds: [...currentArtifactIds, artifactId],
        promotedFromArtifacts: true,
      },
    });

    // 5. Mark artifact as promoted
    const promotedArtifact = await promoteArtifact({
      artifactId,
      targetStrategyId: strategyId,
      targetPillarId: newPillar.id,
    });

    console.log('[promoteArtifactAsPillar] Promoted artifact as pillar:', {
      artifactId,
      strategyId,
      pillarId: newPillar.id,
    });

    return {
      success: true,
      artifact: promotedArtifact,
      strategy,
    };
  } catch (error) {
    console.error('[promoteArtifactAsPillar] Error:', error);
    return {
      success: false,
      artifact: {} as StrategyArtifact,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Promote multiple artifacts as a single strategy
 *
 * Useful when synthesizing multiple artifacts into one cohesive strategy.
 */
export async function promoteMultipleArtifacts(
  companyId: string,
  artifactIds: string[],
  strategyData: {
    title: string;
    summary: string;
    objectives?: string[];
    pillars?: Omit<StrategyPillar, 'id'>[];
  }
): Promise<PromotionResult> {
  try {
    // 1. Verify all artifacts exist and are promotable
    const artifacts: StrategyArtifact[] = [];
    for (const artifactId of artifactIds) {
      const artifact = await getArtifactById(artifactId);
      if (!artifact) {
        return {
          success: false,
          artifact: {} as StrategyArtifact,
          error: `Artifact ${artifactId} not found`,
        };
      }
      if (artifact.status === 'promoted' || artifact.status === 'discarded') {
        return {
          success: false,
          artifact,
          error: `Artifact ${artifactId} cannot be promoted (status: ${artifact.status})`,
        };
      }
      artifacts.push(artifact);
    }

    // 2. Merge context traceability from all artifacts
    const contextRevisionIds = artifacts
      .map(a => a.linkedContextRevisionId)
      .filter(Boolean);
    const competitionSources = artifacts
      .map(a => a.linkedCompetitionSource)
      .filter(Boolean);

    // 3. Create strategy
    const strategy = await createDraftStrategy({
      companyId,
      title: strategyData.title,
      summary: strategyData.summary,
      objectives: strategyData.objectives || [],
      pillars: strategyData.pillars || [],
      baseContextRevisionId: contextRevisionIds[0], // Use first, or could hash all
      competitionSourceUsed: competitionSources[0] as 'v3' | 'v4' | null,
      sourceArtifactIds: artifactIds,
      promotedFromArtifacts: true,
    });

    // 4. Mark all artifacts as promoted
    let lastPromotedArtifact: StrategyArtifact = artifacts[0];
    for (const artifactId of artifactIds) {
      lastPromotedArtifact = await promoteArtifact({
        artifactId,
        targetStrategyId: strategy.id,
      });
    }

    console.log('[promoteMultipleArtifacts] Promoted artifacts to strategy:', {
      artifactIds,
      strategyId: strategy.id,
    });

    return {
      success: true,
      artifact: lastPromotedArtifact,
      strategy,
    };
  } catch (error) {
    console.error('[promoteMultipleArtifacts] Error:', error);
    return {
      success: false,
      artifact: {} as StrategyArtifact,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
