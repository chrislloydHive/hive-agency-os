/**
 * @fileoverview Tests for Canonical Strategy behavior
 *
 * Validates that:
 * - Canonical strategies track artifact lineage
 * - Source artifact IDs are preserved
 * - Strategy pillars can reference source artifacts
 * - Promotion metadata is maintained
 */

import { describe, expect, it } from 'vitest';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import { generateStrategyItemId } from '@/lib/types/strategy';

// Helper to create a test strategy with artifact lineage
function createStrategyWithArtifacts(
  sourceArtifactIds: string[] = [],
  promotedFromArtifacts = true
): CompanyStrategy {
  return {
    id: 'strat_test_123',
    companyId: 'comp_123',
    title: 'Test Strategy',
    summary: 'Strategy created from artifacts',
    objectives: ['Objective 1'],
    pillars: [],
    status: 'draft',
    version: 1,
    sourceArtifactIds,
    promotedFromArtifacts,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

// Helper to create a pillar with artifact source
function createPillarWithSource(
  title: string,
  sourceArtifactId?: string
): StrategyPillar {
  return {
    id: generateStrategyItemId(),
    title,
    description: `Description for ${title}`,
    priority: 'medium',
    sourceArtifactId,
  };
}

describe('Canonical Strategy Artifact Lineage', () => {
  it('should track source artifact IDs', () => {
    const artifactIds = ['art_1', 'art_2', 'art_3'];
    const strategy = createStrategyWithArtifacts(artifactIds);

    expect(strategy.sourceArtifactIds).toEqual(artifactIds);
    expect(strategy.sourceArtifactIds?.length).toBe(3);
  });

  it('should indicate if promoted from artifacts', () => {
    const strategy = createStrategyWithArtifacts(['art_1']);

    expect(strategy.promotedFromArtifacts).toBe(true);
  });

  it('should support empty artifact lineage for non-promoted strategies', () => {
    const strategy = createStrategyWithArtifacts([], false);

    expect(strategy.sourceArtifactIds).toEqual([]);
    expect(strategy.promotedFromArtifacts).toBe(false);
  });
});

describe('Strategy Pillar Artifact References', () => {
  it('should allow pillar to reference source artifact', () => {
    const pillar = createPillarWithSource('SEO Focus', 'art_seo_123');

    expect(pillar.sourceArtifactId).toBe('art_seo_123');
  });

  it('should allow pillar without artifact reference', () => {
    const pillar = createPillarWithSource('Manual Pillar');

    expect(pillar.sourceArtifactId).toBeUndefined();
  });

  it('should support mixed pillars in strategy', () => {
    const strategy = createStrategyWithArtifacts(['art_1', 'art_2']);
    strategy.pillars = [
      createPillarWithSource('From Artifact 1', 'art_1'),
      createPillarWithSource('From Artifact 2', 'art_2'),
      createPillarWithSource('Manual Addition'),
    ];

    const withSource = strategy.pillars.filter(p => p.sourceArtifactId);
    const withoutSource = strategy.pillars.filter(p => !p.sourceArtifactId);

    expect(withSource.length).toBe(2);
    expect(withoutSource.length).toBe(1);
  });
});

describe('Strategy Version Metadata', () => {
  it('should preserve context revision ID', () => {
    const strategy: CompanyStrategy = {
      ...createStrategyWithArtifacts(['art_1']),
      baseContextRevisionId: 'ctx_rev_abc123',
    };

    expect(strategy.baseContextRevisionId).toBe('ctx_rev_abc123');
  });

  it('should preserve competition source', () => {
    const strategy: CompanyStrategy = {
      ...createStrategyWithArtifacts(['art_1']),
      competitionSourceUsed: 'v4',
    };

    expect(strategy.competitionSourceUsed).toBe('v4');
  });

  it('should track all traceability metadata', () => {
    const strategy: CompanyStrategy = {
      ...createStrategyWithArtifacts(['art_1', 'art_2']),
      baseContextRevisionId: 'ctx_rev_abc',
      hiveBrainRevisionId: 'hb_rev_def',
      competitionSourceUsed: 'v4',
      generatedWithIncompleteContext: false,
      missingSrmFields: [],
    };

    expect(strategy.baseContextRevisionId).toBeDefined();
    expect(strategy.hiveBrainRevisionId).toBeDefined();
    expect(strategy.competitionSourceUsed).toBeDefined();
    expect(strategy.generatedWithIncompleteContext).toBe(false);
    expect(strategy.missingSrmFields).toEqual([]);
  });
});

describe('Strategy Item ID Generation', () => {
  it('should generate unique IDs', () => {
    const id1 = generateStrategyItemId();
    const id2 = generateStrategyItemId();

    expect(id1).not.toBe(id2);
  });

  it('should start with si_ prefix', () => {
    const id = generateStrategyItemId();

    expect(id.startsWith('si_')).toBe(true);
  });
});

describe('Promoted Strategy Characteristics', () => {
  it('should be identifiable as promoted', () => {
    const promoted = createStrategyWithArtifacts(['art_1'], true);
    const notPromoted = createStrategyWithArtifacts([], false);

    expect(promoted.promotedFromArtifacts).toBe(true);
    expect(notPromoted.promotedFromArtifacts).toBe(false);
  });

  it('should maintain artifact count', () => {
    const single = createStrategyWithArtifacts(['art_1']);
    const multiple = createStrategyWithArtifacts(['art_1', 'art_2', 'art_3']);

    expect(single.sourceArtifactIds?.length).toBe(1);
    expect(multiple.sourceArtifactIds?.length).toBe(3);
  });
});

describe('Strategy Status Transitions', () => {
  it('should start as draft when promoted', () => {
    const strategy = createStrategyWithArtifacts(['art_1']);

    expect(strategy.status).toBe('draft');
  });

  it('should support finalization', () => {
    const strategy = createStrategyWithArtifacts(['art_1']);
    strategy.status = 'finalized';
    strategy.finalizedAt = new Date().toISOString();

    expect(strategy.status).toBe('finalized');
    expect(strategy.finalizedAt).toBeDefined();
  });

  it('should support archiving', () => {
    const strategy = createStrategyWithArtifacts(['art_1']);
    strategy.status = 'archived';

    expect(strategy.status).toBe('archived');
  });
});
