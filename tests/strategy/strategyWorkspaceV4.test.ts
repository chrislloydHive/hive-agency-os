// tests/strategy/strategyWorkspaceV4.test.ts
// Tests for Strategy Workspace V4 behavior
//
// Validates:
// 1. Multiple artifacts coexist
// 2. Promoting creates new canonical (not overwrite)
// 3. Active canonical not mutated by artifact edits
// 4. Guardrails prevent invalid operations

import { describe, it, expect } from 'vitest';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';
import type { CompanyStrategy } from '@/lib/types/strategy';
import {
  canEditArtifact,
  canPromoteArtifact,
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_TYPE_LABELS,
} from '@/lib/types/strategyArtifact';
import {
  canEditArtifact as guardrailCanEdit,
  canPromoteArtifact as guardrailCanPromote,
  assertCanEditArtifact,
  assertCanPromoteArtifact,
  isCanonicalStrategy,
  canDirectlyEditStrategy,
  shouldCreateNewDraftOnRegenerate,
  validatePromotion,
  StrategyGuardrailError,
} from '@/lib/os/strategy/guardrails';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockArtifact(overrides: Partial<StrategyArtifact> = {}): StrategyArtifact {
  return {
    id: `art_test_${Date.now()}`,
    companyId: 'test-company-id',
    type: 'draft_strategy',
    title: 'Test Artifact',
    content: 'Test content for the artifact',
    status: 'draft',
    source: 'human',
    linkedArtifactIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockStrategy(overrides: Partial<CompanyStrategy> = {}): CompanyStrategy {
  return {
    id: `strat_test_${Date.now()}`,
    companyId: 'test-company-id',
    title: 'Test Strategy',
    summary: 'Test strategy summary',
    objectives: ['Objective 1', 'Objective 2'],
    pillars: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Part 1: Multiple Artifacts Coexist
// ============================================================================

describe('Strategy Workspace V4 - Multiple Artifacts', () => {
  it('allows multiple artifacts with different types', () => {
    const artifacts: StrategyArtifact[] = [
      createMockArtifact({ type: 'draft_strategy', title: 'Strategy Draft' }),
      createMockArtifact({ type: 'growth_option', title: 'Growth Option A' }),
      createMockArtifact({ type: 'channel_plan', title: 'SEO Channel Plan' }),
      createMockArtifact({ type: 'assumptions', title: 'Key Assumptions' }),
    ];

    // All artifacts can coexist
    expect(artifacts.length).toBe(4);

    // Each has a valid type
    artifacts.forEach(a => {
      expect(ARTIFACT_TYPE_LABELS[a.type]).toBeDefined();
    });
  });

  it('allows multiple artifacts with same status', () => {
    const drafts = [
      createMockArtifact({ status: 'draft', title: 'Draft 1' }),
      createMockArtifact({ status: 'draft', title: 'Draft 2' }),
      createMockArtifact({ status: 'draft', title: 'Draft 3' }),
    ];

    // All can be drafts simultaneously
    drafts.forEach(a => {
      expect(a.status).toBe('draft');
      expect(canEditArtifact(a)).toBe(true);
    });
  });

  it('allows mixed status artifacts', () => {
    const artifacts = [
      createMockArtifact({ status: 'draft' }),
      createMockArtifact({ status: 'explored' }),
      createMockArtifact({ status: 'candidate' }),
      createMockArtifact({ status: 'promoted' }),
      createMockArtifact({ status: 'discarded' }),
    ];

    // Each status is valid
    artifacts.forEach(a => {
      expect(ARTIFACT_STATUS_LABELS[a.status]).toBeDefined();
    });

    // Count promotable artifacts
    const promotable = artifacts.filter(a => canPromoteArtifact(a));
    expect(promotable.length).toBe(3); // draft, explored, candidate
  });

  it('supports artifact linking', () => {
    const parentArtifact = createMockArtifact({ id: 'parent-1', title: 'Parent' });
    const childArtifact = createMockArtifact({
      id: 'child-1',
      title: 'Child',
      linkedArtifactIds: ['parent-1'],
    });

    expect(childArtifact.linkedArtifactIds).toContain(parentArtifact.id);
  });
});

// ============================================================================
// Part 2: Promotion Creates New Canonical
// ============================================================================

describe('Strategy Workspace V4 - Promotion Creates New Canonical', () => {
  it('validates that promotion always creates new draft', () => {
    const existingStrategy = createMockStrategy({ status: 'finalized' });

    // Regeneration should always create new draft
    expect(shouldCreateNewDraftOnRegenerate(existingStrategy)).toBe(true);
    expect(shouldCreateNewDraftOnRegenerate(null)).toBe(true);
  });

  it('validates promotion with single artifact', () => {
    const artifact = createMockArtifact({ status: 'candidate' });
    const result = validatePromotion([artifact], null);

    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('validates promotion with multiple artifacts', () => {
    const artifacts = [
      createMockArtifact({ status: 'draft', title: 'Draft 1' }),
      createMockArtifact({ status: 'candidate', title: 'Candidate 1' }),
    ];
    const result = validatePromotion(artifacts, null);

    expect(result.valid).toBe(true);
  });

  it('rejects promotion of already-promoted artifact', () => {
    const artifact = createMockArtifact({
      status: 'promoted',
      title: 'Already Promoted',
    });
    const result = validatePromotion([artifact], null);

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('already been promoted'))).toBe(true);
  });

  it('rejects promotion of discarded artifact', () => {
    const artifact = createMockArtifact({
      status: 'discarded',
      title: 'Discarded',
    });
    const result = validatePromotion([artifact], null);

    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('cannot be promoted'))).toBe(true);
  });

  it('warns when creating alongside finalized strategy', () => {
    const artifact = createMockArtifact({ status: 'candidate' });
    const existingStrategy = createMockStrategy({ status: 'finalized' });
    const result = validatePromotion([artifact], existingStrategy);

    // Still valid, but warns
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.includes('finalized'))).toBe(true);
  });

  it('tracks sourceArtifactIds on promoted strategy', () => {
    const strategy = createMockStrategy({
      sourceArtifactIds: ['art_1', 'art_2'],
      promotedFromArtifacts: true,
    });

    expect(strategy.sourceArtifactIds).toContain('art_1');
    expect(strategy.sourceArtifactIds).toContain('art_2');
    expect(strategy.promotedFromArtifacts).toBe(true);
  });
});

// ============================================================================
// Part 3: Canonical Not Mutated by Artifact Edits
// ============================================================================

describe('Strategy Workspace V4 - Canonical Isolation', () => {
  it('promoted artifacts are immutable', () => {
    const promotedArtifact = createMockArtifact({ status: 'promoted' });

    expect(canEditArtifact(promotedArtifact)).toBe(false);
    expect(guardrailCanEdit(promotedArtifact)).toBe(false);
  });

  it('throws when trying to edit promoted artifact', () => {
    const promotedArtifact = createMockArtifact({ status: 'promoted' });

    expect(() => assertCanEditArtifact(promotedArtifact)).toThrow(StrategyGuardrailError);
  });

  it('throws PROMOTED_ARTIFACT_EDIT code', () => {
    const promotedArtifact = createMockArtifact({ status: 'promoted' });

    try {
      assertCanEditArtifact(promotedArtifact);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StrategyGuardrailError);
      expect((e as StrategyGuardrailError).code).toBe('PROMOTED_ARTIFACT_EDIT');
    }
  });

  it('draft artifacts remain editable', () => {
    const draftArtifact = createMockArtifact({ status: 'draft' });

    expect(canEditArtifact(draftArtifact)).toBe(true);
    expect(() => assertCanEditArtifact(draftArtifact)).not.toThrow();
  });

  it('explored artifacts remain editable', () => {
    const exploredArtifact = createMockArtifact({ status: 'explored' });

    expect(canEditArtifact(exploredArtifact)).toBe(true);
  });

  it('candidate artifacts remain editable', () => {
    const candidateArtifact = createMockArtifact({ status: 'candidate' });

    expect(canEditArtifact(candidateArtifact)).toBe(true);
  });

  it('discarded artifacts remain editable (for restoration)', () => {
    const discardedArtifact = createMockArtifact({ status: 'discarded' });

    expect(canEditArtifact(discardedArtifact)).toBe(true);
  });
});

// ============================================================================
// Part 4: Strategy Guardrails
// ============================================================================

describe('Strategy Workspace V4 - Strategy Guardrails', () => {
  it('identifies canonical strategies', () => {
    const finalizedStrategy = createMockStrategy({ status: 'finalized' });
    const promotedStrategy = createMockStrategy({
      status: 'draft',
      promotedFromArtifacts: true,
    });
    const regularDraft = createMockStrategy({ status: 'draft' });

    expect(isCanonicalStrategy(finalizedStrategy)).toBe(true);
    expect(isCanonicalStrategy(promotedStrategy)).toBe(true);
    expect(isCanonicalStrategy(regularDraft)).toBe(false);
  });

  it('prevents direct edits to finalized strategies', () => {
    const finalizedStrategy = createMockStrategy({ status: 'finalized' });

    expect(canDirectlyEditStrategy(finalizedStrategy)).toBe(false);
  });

  it('prevents direct edits to archived strategies', () => {
    const archivedStrategy = createMockStrategy({ status: 'archived' });

    expect(canDirectlyEditStrategy(archivedStrategy)).toBe(false);
  });

  it('allows edits to draft strategies', () => {
    const draftStrategy = createMockStrategy({ status: 'draft' });

    expect(canDirectlyEditStrategy(draftStrategy)).toBe(true);
  });
});

// ============================================================================
// Part 5: Artifact Promotion Guards
// ============================================================================

describe('Strategy Workspace V4 - Artifact Promotion Guards', () => {
  it('allows promotion of draft artifacts', () => {
    const artifact = createMockArtifact({ status: 'draft' });

    expect(canPromoteArtifact(artifact)).toBe(true);
    expect(guardrailCanPromote(artifact)).toBe(true);
    expect(() => assertCanPromoteArtifact(artifact)).not.toThrow();
  });

  it('allows promotion of explored artifacts', () => {
    const artifact = createMockArtifact({ status: 'explored' });

    expect(canPromoteArtifact(artifact)).toBe(true);
  });

  it('allows promotion of candidate artifacts', () => {
    const artifact = createMockArtifact({ status: 'candidate' });

    expect(canPromoteArtifact(artifact)).toBe(true);
  });

  it('prevents promotion of already-promoted artifacts', () => {
    const artifact = createMockArtifact({ status: 'promoted' });

    expect(canPromoteArtifact(artifact)).toBe(false);
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(StrategyGuardrailError);
  });

  it('throws ALREADY_PROMOTED code for promoted artifacts', () => {
    const artifact = createMockArtifact({ status: 'promoted' });

    try {
      assertCanPromoteArtifact(artifact);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StrategyGuardrailError);
      expect((e as StrategyGuardrailError).code).toBe('ALREADY_PROMOTED');
    }
  });

  it('prevents promotion of discarded artifacts', () => {
    const artifact = createMockArtifact({ status: 'discarded' });

    expect(canPromoteArtifact(artifact)).toBe(false);
    expect(() => assertCanPromoteArtifact(artifact)).toThrow(StrategyGuardrailError);
  });

  it('throws DISCARDED_ARTIFACT_PROMOTE code for discarded artifacts', () => {
    const artifact = createMockArtifact({ status: 'discarded' });

    try {
      assertCanPromoteArtifact(artifact);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StrategyGuardrailError);
      expect((e as StrategyGuardrailError).code).toBe('DISCARDED_ARTIFACT_PROMOTE');
    }
  });
});

// ============================================================================
// Part 6: Type Definitions
// ============================================================================

describe('Strategy Workspace V4 - Type Definitions', () => {
  it('has all artifact type labels defined', () => {
    const types = [
      'draft_strategy',
      'growth_option',
      'channel_plan',
      'assumptions',
      'risk_analysis',
      'synthesis',
    ] as const;

    types.forEach(type => {
      expect(ARTIFACT_TYPE_LABELS[type]).toBeDefined();
      expect(typeof ARTIFACT_TYPE_LABELS[type]).toBe('string');
    });
  });

  it('has all artifact status labels defined', () => {
    const statuses = [
      'draft',
      'explored',
      'discarded',
      'candidate',
      'promoted',
    ] as const;

    statuses.forEach(status => {
      expect(ARTIFACT_STATUS_LABELS[status]).toBeDefined();
      expect(typeof ARTIFACT_STATUS_LABELS[status]).toBe('string');
    });
  });

  it('CompanyStrategy has artifact lineage fields', () => {
    const strategy = createMockStrategy({
      sourceArtifactIds: ['art_1'],
      promotedFromArtifacts: true,
      baseContextRevisionId: 'rev_123',
      hiveBrainRevisionId: 'hb_456',
      competitionSourceUsed: 'v4',
    });

    expect(strategy.sourceArtifactIds).toBeDefined();
    expect(strategy.promotedFromArtifacts).toBe(true);
    expect(strategy.baseContextRevisionId).toBe('rev_123');
    expect(strategy.hiveBrainRevisionId).toBe('hb_456');
    expect(strategy.competitionSourceUsed).toBe('v4');
  });
});
