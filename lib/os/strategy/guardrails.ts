// lib/os/strategy/guardrails.ts
// Guardrails for Strategy Workspace V4
//
// Enforces rules to maintain canonical strategy integrity:
// 1. Canonical strategy is only modified via explicit promotion
// 2. Promoted artifacts are immutable
// 3. Regeneration always creates new drafts, never overwrites

import type { CompanyStrategy } from '@/lib/types/strategy';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

// ============================================================================
// Guardrail Error Types
// ============================================================================

export class StrategyGuardrailError extends Error {
  constructor(
    message: string,
    public readonly code: StrategyGuardrailCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StrategyGuardrailError';
  }
}

export type StrategyGuardrailCode =
  | 'CANONICAL_DIRECT_MUTATION'
  | 'PROMOTED_ARTIFACT_EDIT'
  | 'DISCARDED_ARTIFACT_PROMOTE'
  | 'ALREADY_PROMOTED'
  | 'FINALIZED_STRATEGY_EDIT';

// ============================================================================
// Canonical Strategy Guardrails
// ============================================================================

/**
 * Check if a strategy is canonical (finalized or active draft)
 *
 * A strategy is canonical if it's the active strategy for a company.
 * Canonical strategies should only be modified via promotion from artifacts.
 */
export function isCanonicalStrategy(strategy: CompanyStrategy): boolean {
  // Finalized strategies are always canonical
  if (strategy.status === 'finalized') return true;

  // Draft strategies created via promotion are canonical
  if (strategy.promotedFromArtifacts) return true;

  return false;
}

/**
 * Check if a strategy can be directly edited
 *
 * GUARDRAIL: Canonical strategies should not be directly edited.
 * Use promotion to make changes.
 */
export function canDirectlyEditStrategy(strategy: CompanyStrategy): boolean {
  // Finalized strategies cannot be edited
  if (strategy.status === 'finalized') return false;

  // Archived strategies cannot be edited
  if (strategy.status === 'archived') return false;

  // Non-canonical drafts can be edited
  return true;
}

/**
 * Assert that a strategy can be edited, throw if not
 */
export function assertCanEditStrategy(strategy: CompanyStrategy): void {
  if (strategy.status === 'finalized') {
    throw new StrategyGuardrailError(
      'Finalized strategies cannot be edited. Create a new draft or archive first.',
      'FINALIZED_STRATEGY_EDIT',
      { strategyId: strategy.id, status: strategy.status }
    );
  }

  if (strategy.promotedFromArtifacts && strategy.status !== 'draft') {
    throw new StrategyGuardrailError(
      'Canonical strategies should be modified via artifact promotion.',
      'CANONICAL_DIRECT_MUTATION',
      { strategyId: strategy.id, promotedFromArtifacts: true }
    );
  }
}

// ============================================================================
// Artifact Guardrails
// ============================================================================

/**
 * Check if an artifact can be edited
 *
 * GUARDRAIL: Promoted artifacts are immutable.
 */
export function canEditArtifact(artifact: StrategyArtifact): boolean {
  return artifact.status !== 'promoted';
}

/**
 * Check if an artifact can be promoted
 *
 * GUARDRAIL: Only draft, explored, or candidate artifacts can be promoted.
 */
export function canPromoteArtifact(artifact: StrategyArtifact): boolean {
  return (
    artifact.status !== 'promoted' &&
    artifact.status !== 'discarded'
  );
}

/**
 * Assert that an artifact can be edited, throw if not
 */
export function assertCanEditArtifact(artifact: StrategyArtifact): void {
  if (artifact.status === 'promoted') {
    throw new StrategyGuardrailError(
      'Promoted artifacts cannot be edited. They are part of the canonical strategy history.',
      'PROMOTED_ARTIFACT_EDIT',
      { artifactId: artifact.id, status: artifact.status }
    );
  }
}

/**
 * Assert that an artifact can be promoted, throw if not
 */
export function assertCanPromoteArtifact(artifact: StrategyArtifact): void {
  if (artifact.status === 'promoted') {
    throw new StrategyGuardrailError(
      'This artifact has already been promoted.',
      'ALREADY_PROMOTED',
      { artifactId: artifact.id, promotedToStrategyId: artifact.promotedToStrategyId }
    );
  }

  if (artifact.status === 'discarded') {
    throw new StrategyGuardrailError(
      'Discarded artifacts cannot be promoted. Restore it first.',
      'DISCARDED_ARTIFACT_PROMOTE',
      { artifactId: artifact.id }
    );
  }
}

// ============================================================================
// Promotion Guardrails
// ============================================================================

/**
 * Validate that promotion can proceed
 *
 * Returns validation result with any issues found.
 */
export function validatePromotion(
  artifacts: StrategyArtifact[],
  existingStrategy: CompanyStrategy | null
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check that all artifacts can be promoted
  let hasBlockingIssue = false;
  for (const artifact of artifacts) {
    if (artifact.status === 'promoted') {
      issues.push(`Artifact "${artifact.title}" has already been promoted`);
      hasBlockingIssue = true;
    }
    if (artifact.status === 'discarded') {
      issues.push(`Artifact "${artifact.title}" is discarded and cannot be promoted`);
      hasBlockingIssue = true;
    }
  }

  // Warn if replacing a finalized strategy (not a blocking issue)
  if (existingStrategy?.status === 'finalized') {
    issues.push(
      'This will create a new draft alongside the finalized strategy. ' +
        'The finalized strategy will remain unchanged.'
    );
  }

  return {
    valid: !hasBlockingIssue,
    issues,
  };
}

// ============================================================================
// Regeneration Guardrails
// ============================================================================

/**
 * Check if regeneration should create a new draft
 *
 * GUARDRAIL: Regeneration ALWAYS creates a new draft.
 * It never overwrites an existing active strategy.
 */
export function shouldCreateNewDraftOnRegenerate(
  existingStrategy: CompanyStrategy | null
): boolean {
  // Always create a new draft, regardless of existing strategy
  return true;
}

/**
 * Get the recommended action for regeneration
 */
export function getRegenerationAction(
  existingStrategy: CompanyStrategy | null
): 'create_first' | 'create_alongside' | 'create_after_archive' {
  if (!existingStrategy) {
    return 'create_first';
  }

  if (existingStrategy.status === 'archived') {
    return 'create_first';
  }

  if (existingStrategy.status === 'finalized') {
    // Finalized strategy stays, new draft is created alongside
    return 'create_alongside';
  }

  // Existing draft - recommend archiving first
  return 'create_after_archive';
}
