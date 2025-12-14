/**
 * @fileoverview Tests for Strategy Artifact lifecycle
 *
 * Validates that:
 * - Artifacts can coexist with canonical strategy
 * - Artifact status transitions work correctly
 * - Promoted artifacts become immutable
 */

import { describe, expect, it } from 'vitest';
import {
  toArtifactSummary,
  canPromoteArtifact,
  canEditArtifact,
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_STATUS_LABELS,
} from '@/lib/types/strategyArtifact';
import type {
  StrategyArtifact,
  StrategyArtifactType,
  StrategyArtifactStatus,
} from '@/lib/types/strategyArtifact';

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

describe('Artifact Type Labels', () => {
  it('should have labels for all artifact types', () => {
    const types: StrategyArtifactType[] = [
      'draft_strategy',
      'growth_option',
      'channel_plan',
      'assumptions',
      'risk_analysis',
      'synthesis',
    ];

    for (const type of types) {
      expect(ARTIFACT_TYPE_LABELS[type]).toBeDefined();
      expect(typeof ARTIFACT_TYPE_LABELS[type]).toBe('string');
      expect(ARTIFACT_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe('Artifact Status Labels', () => {
  it('should have labels for all artifact statuses', () => {
    const statuses: StrategyArtifactStatus[] = [
      'draft',
      'explored',
      'discarded',
      'candidate',
      'promoted',
    ];

    for (const status of statuses) {
      expect(ARTIFACT_STATUS_LABELS[status]).toBeDefined();
      expect(typeof ARTIFACT_STATUS_LABELS[status]).toBe('string');
    }
  });
});

describe('Artifact Summary', () => {
  it('should create summary from full artifact', () => {
    const artifact = createTestArtifact({
      linkedArtifactIds: ['art_1', 'art_2'],
    });

    const summary = toArtifactSummary(artifact);

    expect(summary.id).toBe(artifact.id);
    expect(summary.type).toBe(artifact.type);
    expect(summary.title).toBe(artifact.title);
    expect(summary.status).toBe(artifact.status);
    expect(summary.source).toBe(artifact.source);
    expect(summary.linkedArtifactCount).toBe(2);
  });

  it('should handle empty linked artifacts', () => {
    const artifact = createTestArtifact({
      linkedArtifactIds: [],
    });

    const summary = toArtifactSummary(artifact);

    expect(summary.linkedArtifactCount).toBe(0);
  });
});

describe('Artifact Editability', () => {
  it('should allow editing draft artifacts', () => {
    const artifact = createTestArtifact({ status: 'draft' });
    expect(canEditArtifact(artifact)).toBe(true);
  });

  it('should allow editing explored artifacts', () => {
    const artifact = createTestArtifact({ status: 'explored' });
    expect(canEditArtifact(artifact)).toBe(true);
  });

  it('should allow editing candidate artifacts', () => {
    const artifact = createTestArtifact({ status: 'candidate' });
    expect(canEditArtifact(artifact)).toBe(true);
  });

  it('should allow editing discarded artifacts', () => {
    const artifact = createTestArtifact({ status: 'discarded' });
    expect(canEditArtifact(artifact)).toBe(true);
  });

  it('should NOT allow editing promoted artifacts', () => {
    const artifact = createTestArtifact({ status: 'promoted' });
    expect(canEditArtifact(artifact)).toBe(false);
  });
});

describe('Artifact Promotability', () => {
  it('should allow promoting draft artifacts', () => {
    const artifact = createTestArtifact({ status: 'draft' });
    expect(canPromoteArtifact(artifact)).toBe(true);
  });

  it('should allow promoting explored artifacts', () => {
    const artifact = createTestArtifact({ status: 'explored' });
    expect(canPromoteArtifact(artifact)).toBe(true);
  });

  it('should allow promoting candidate artifacts', () => {
    const artifact = createTestArtifact({ status: 'candidate' });
    expect(canPromoteArtifact(artifact)).toBe(true);
  });

  it('should NOT allow promoting discarded artifacts', () => {
    const artifact = createTestArtifact({ status: 'discarded' });
    expect(canPromoteArtifact(artifact)).toBe(false);
  });

  it('should NOT allow promoting already promoted artifacts', () => {
    const artifact = createTestArtifact({ status: 'promoted' });
    expect(canPromoteArtifact(artifact)).toBe(false);
  });
});

describe('Artifact Coexistence', () => {
  it('should support multiple artifact types', () => {
    const types: StrategyArtifactType[] = [
      'draft_strategy',
      'growth_option',
      'channel_plan',
      'assumptions',
      'risk_analysis',
      'synthesis',
    ];

    // Create artifacts of each type
    const artifacts = types.map((type, i) =>
      createTestArtifact({
        id: `art_${i}`,
        type,
        title: `${ARTIFACT_TYPE_LABELS[type]} Artifact`,
      })
    );

    // All should be valid
    expect(artifacts.length).toBe(6);
    artifacts.forEach(artifact => {
      expect(artifact.type).toBeDefined();
      expect(ARTIFACT_TYPE_LABELS[artifact.type]).toBeDefined();
    });
  });

  it('should support linking artifacts together', () => {
    const baseArtifact = createTestArtifact({
      id: 'art_base',
      type: 'draft_strategy',
    });

    const linkedArtifact = createTestArtifact({
      id: 'art_linked',
      type: 'assumptions',
      linkedArtifactIds: [baseArtifact.id],
    });

    expect(linkedArtifact.linkedArtifactIds).toContain(baseArtifact.id);
  });
});
