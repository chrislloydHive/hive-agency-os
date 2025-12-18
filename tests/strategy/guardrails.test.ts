/**
 * @fileoverview Tests for Strategy Workspace V4 guardrails
 *
 * Validates that:
 * - Canonical strategies are protected from direct mutation
 * - Promoted artifacts are immutable
 * - Promotion validation works correctly
 * - Regeneration always creates new drafts
 */

import { describe, expect, it } from 'vitest';
import {
  isCanonicalStrategy,
  canDirectlyEditStrategy,
  assertCanEditStrategy,
  assertCanEditArtifact,
  assertCanPromoteArtifact,
  validatePromotion,
  shouldCreateNewDraftOnRegenerate,
  getRegenerationAction,
  StrategyGuardrailError,
} from '@/lib/os/strategy/guardrails';
import type { CompanyStrategy } from '@/lib/types/strategy';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

// Helper to create a test strategy
function createTestStrategy(
  overrides: Partial<CompanyStrategy> = {}
): CompanyStrategy {
  return {
    id: 'strat_test_123',
    companyId: 'comp_123',
    title: 'Test Strategy',
    summary: 'Test summary',
    objectives: ['Objective 1'],
    pillars: [],
    status: 'draft',
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create a test artifact
function createTestArtifact(
  overrides: Partial<StrategyArtifact> = {}
): StrategyArtifact {
  return {
    id: 'art_test_123',
    companyId: 'comp_123',
    type: 'draft_strategy',
    title: 'Test Artifact',
    content: 'Test content',
    status: 'draft',
    source: 'human',
    linkedArtifactIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Canonical Strategy Detection', () => {
  it('should identify finalized strategies as canonical', () => {
    const strategy = createTestStrategy({ status: 'finalized' });
    expect(isCanonicalStrategy(strategy)).toBe(true);
  });

  it('should identify promoted-from-artifacts strategies as canonical', () => {
    const strategy = createTestStrategy({
      status: 'draft',
      promotedFromArtifacts: true,
    });
    expect(isCanonicalStrategy(strategy)).toBe(true);
  });

  it('should NOT identify regular drafts as canonical', () => {
    const strategy = createTestStrategy({ status: 'draft' });
    expect(isCanonicalStrategy(strategy)).toBe(false);
  });
});

describe('Strategy Edit Permissions', () => {
  it('should allow editing regular drafts', () => {
    const strategy = createTestStrategy({ status: 'draft' });
    expect(canDirectlyEditStrategy(strategy)).toBe(true);
  });

  it('should NOT allow editing finalized strategies', () => {
    const strategy = createTestStrategy({ status: 'finalized' });
    expect(canDirectlyEditStrategy(strategy)).toBe(false);
  });

  it('should NOT allow editing archived strategies', () => {
    const strategy = createTestStrategy({ status: 'archived' });
    expect(canDirectlyEditStrategy(strategy)).toBe(false);
  });
});

describe('Strategy Edit Assertions', () => {
  it('should not throw for editable strategies', () => {
    const strategy = createTestStrategy({ status: 'draft' });
    expect(() => assertCanEditStrategy(strategy)).not.toThrow();
  });

  it('should throw for finalized strategies', () => {
    const strategy = createTestStrategy({ status: 'finalized' });
    expect(() => assertCanEditStrategy(strategy)).toThrow(StrategyGuardrailError);
    expect(() => assertCanEditStrategy(strategy)).toThrow(/Finalized strategies cannot be edited/);
  });

  it('should include error code in thrown error', () => {
    const strategy = createTestStrategy({ status: 'finalized' });
    try {
      assertCanEditStrategy(strategy);
    } catch (error) {
      expect(error).toBeInstanceOf(StrategyGuardrailError);
      expect((error as StrategyGuardrailError).code).toBe('FINALIZED_STRATEGY_EDIT');
    }
  });
});

describe('Artifact Edit Assertions', () => {
  it('should not throw for draft artifacts', () => {
    const artifact = createTestArtifact({ status: 'draft' });
    expect(() => assertCanEditArtifact(artifact)).not.toThrow();
  });

  it('should throw for promoted artifacts', () => {
    const artifact = createTestArtifact({ status: 'promoted' });
    expect(() => assertCanEditArtifact(artifact)).toThrow(StrategyGuardrailError);
    expect(() => assertCanEditArtifact(artifact)).toThrow(/Promoted artifacts cannot be edited/);
  });

  it('should include error code in thrown error', () => {
    const artifact = createTestArtifact({ status: 'promoted' });
    try {
      assertCanEditArtifact(artifact);
    } catch (error) {
      expect(error).toBeInstanceOf(StrategyGuardrailError);
      expect((error as StrategyGuardrailError).code).toBe('PROMOTED_ARTIFACT_EDIT');
    }
  });
});

describe('Artifact Promote Assertions', () => {
  it('should not throw for draft artifacts', () => {
    const artifact = createTestArtifact({ status: 'draft' });
    expect(() => assertCanPromoteArtifact(artifact)).not.toThrow();
  });

  it('should not throw for candidate artifacts', () => {
    const artifact = createTestArtifact({ status: 'candidate' });
    expect(() => assertCanPromoteArtifact(artifact)).not.toThrow();
  });

  it('should throw for already promoted artifacts', () => {
    const artifact = createTestArtifact({ status: 'promoted' });
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(StrategyGuardrailError);
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(/already been promoted/);
  });

  it('should throw for discarded artifacts', () => {
    const artifact = createTestArtifact({ status: 'discarded' });
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(StrategyGuardrailError);
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(/cannot be promoted/);
  });

  it('should have correct error codes', () => {
    const promoted = createTestArtifact({ status: 'promoted' });
    const discarded = createTestArtifact({ status: 'discarded' });

    try {
      assertCanPromoteArtifact(promoted);
    } catch (error) {
      expect((error as StrategyGuardrailError).code).toBe('ALREADY_PROMOTED');
    }

    try {
      assertCanPromoteArtifact(discarded);
    } catch (error) {
      expect((error as StrategyGuardrailError).code).toBe('DISCARDED_ARTIFACT_PROMOTE');
    }
  });
});

describe('Promotion Validation', () => {
  it('should validate promotable artifacts', () => {
    const artifacts = [
      createTestArtifact({ id: 'art_1', status: 'draft' }),
      createTestArtifact({ id: 'art_2', status: 'candidate' }),
    ];

    const result = validatePromotion(artifacts, null);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should reject already promoted artifacts', () => {
    const artifacts = [
      createTestArtifact({ id: 'art_1', status: 'promoted', title: 'Promoted One' }),
    ];

    const result = validatePromotion(artifacts, null);

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('already been promoted'))).toBe(true);
  });

  it('should reject discarded artifacts', () => {
    const artifacts = [
      createTestArtifact({ id: 'art_1', status: 'discarded', title: 'Discarded One' }),
    ];

    const result = validatePromotion(artifacts, null);

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('cannot be promoted'))).toBe(true);
  });

  it('should warn when replacing finalized strategy', () => {
    const artifacts = [createTestArtifact({ status: 'draft' })];
    const existingStrategy = createTestStrategy({ status: 'finalized' });

    const result = validatePromotion(artifacts, existingStrategy);

    // Should be valid but with warning
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.includes('finalized strategy'))).toBe(true);
  });
});

describe('Regeneration Guardrails', () => {
  it('should always create new draft on regenerate', () => {
    const existingStrategy = createTestStrategy({ status: 'draft' });
    expect(shouldCreateNewDraftOnRegenerate(existingStrategy)).toBe(true);
  });

  it('should create new draft even when no strategy exists', () => {
    expect(shouldCreateNewDraftOnRegenerate(null)).toBe(true);
  });

  it('CRITICAL: shouldCreateNewDraftOnRegenerate must ALWAYS return true for ALL states', () => {
    // This test ensures AI regeneration NEVER overwrites existing strategy
    // All possible states must return true

    // No existing strategy
    expect(shouldCreateNewDraftOnRegenerate(null)).toBe(true);

    // Draft
    expect(shouldCreateNewDraftOnRegenerate(createTestStrategy({ status: 'draft' }))).toBe(true);

    // Finalized
    expect(shouldCreateNewDraftOnRegenerate(createTestStrategy({ status: 'finalized' }))).toBe(true);

    // Archived
    expect(shouldCreateNewDraftOnRegenerate(createTestStrategy({ status: 'archived' }))).toBe(true);

    // Promoted from artifacts
    expect(
      shouldCreateNewDraftOnRegenerate(
        createTestStrategy({ status: 'draft', promotedFromArtifacts: true })
      )
    ).toBe(true);

    // Canonical with all flags
    expect(
      shouldCreateNewDraftOnRegenerate(
        createTestStrategy({
          status: 'finalized',
          promotedFromArtifacts: true,
          sourceArtifactIds: ['art_1', 'art_2'],
        })
      )
    ).toBe(true);
  });

  it('should recommend create_first when no strategy exists', () => {
    expect(getRegenerationAction(null)).toBe('create_first');
  });

  it('should recommend create_first for archived strategies', () => {
    const strategy = createTestStrategy({ status: 'archived' });
    expect(getRegenerationAction(strategy)).toBe('create_first');
  });

  it('should recommend create_alongside for finalized strategies', () => {
    const strategy = createTestStrategy({ status: 'finalized' });
    expect(getRegenerationAction(strategy)).toBe('create_alongside');
  });

  it('should recommend create_after_archive for draft strategies', () => {
    const strategy = createTestStrategy({ status: 'draft' });
    expect(getRegenerationAction(strategy)).toBe('create_after_archive');
  });
});

describe('StrategyGuardrailError', () => {
  it('should have correct error name', () => {
    const error = new StrategyGuardrailError(
      'Test error',
      'CANONICAL_DIRECT_MUTATION'
    );
    expect(error.name).toBe('StrategyGuardrailError');
  });

  it('should include details when provided', () => {
    const error = new StrategyGuardrailError(
      'Test error',
      'CANONICAL_DIRECT_MUTATION',
      { strategyId: 'strat_123' }
    );
    expect(error.details).toEqual({ strategyId: 'strat_123' });
  });

  it('should be instanceof Error', () => {
    const error = new StrategyGuardrailError(
      'Test error',
      'CANONICAL_DIRECT_MUTATION'
    );
    expect(error).toBeInstanceOf(Error);
  });
});
