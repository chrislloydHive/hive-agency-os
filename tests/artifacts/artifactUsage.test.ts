// tests/artifacts/artifactUsage.test.ts
// Tests for artifact usage tracking logic
//
// Verifies:
// - Usage increment/decrement logic
// - Usage never goes negative
// - Feedback submission validation
// - Feedback append behavior
// - Analysis helpers correctness

import { describe, it, expect } from 'vitest';
import {
  incrementAttachedWorkCount,
  decrementAttachedWorkCount,
  incrementCompletedWorkCount,
  createWorkReference,
  isArtifactUsed,
  isHighImpactArtifact,
  getUsageSummary,
} from '@/lib/os/artifacts/usage';
import {
  analyzeArtifacts,
  getUnusedStrategyArtifacts,
  getCompletedWorkArtifacts,
  calculateFeedbackSummary,
} from '@/lib/os/artifacts/analysis';
import type { ArtifactUsage, Artifact, ArtifactFeedbackEntry } from '@/lib/types/artifact';
import { createDefaultUsage } from '@/lib/types/artifact';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestUsage(overrides: Partial<ArtifactUsage> = {}): ArtifactUsage {
  return {
    ...createDefaultUsage(),
    ...overrides,
  };
}

function createTestArtifact(
  id: string,
  overrides: Partial<Artifact> = {}
): Artifact {
  return {
    id,
    companyId: 'company-123',
    title: `Test Artifact ${id}`,
    type: 'strategy_doc',
    status: 'draft',
    source: 'manual',
    googleFileId: null,
    googleFileType: null,
    googleFileUrl: null,
    googleFolderId: null,
    googleModifiedAt: null,
    sourceStrategyId: null,
    sourceQbrStoryId: null,
    sourceBriefId: null,
    sourceMediaPlanId: null,
    sourceContentPlanId: null,
    engagementId: null,
    projectId: null,
    contextVersionAtCreation: null,
    strategyVersionAtCreation: null,
    snapshotId: null,
    isStale: false,
    stalenessReason: null,
    stalenessCheckedAt: null,
    lastSyncedAt: null,
    generatedContent: null,
    generatedMarkdown: null,
    generatedFormat: null,
    inputsUsedHash: null,
    includedTacticIds: null,
    finalizedAt: null,
    finalizedBy: null,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    lastEditedAt: null,
    lastEditedBy: null,
    description: null,
    tags: [],
    usage: createDefaultUsage(),
    lastViewedAt: null,
    lastReferencedBy: null,
    feedback: [],
    ...overrides,
  };
}

// ============================================================================
// incrementAttachedWorkCount Tests
// ============================================================================

describe('incrementAttachedWorkCount', () => {
  it('increments count from zero', () => {
    const usage = createTestUsage();
    const now = '2024-01-15T10:00:00Z';

    const result = incrementAttachedWorkCount(usage, now);

    expect(result.attachedWorkCount).toBe(1);
    expect(result.firstAttachedAt).toBe(now);
    expect(result.lastAttachedAt).toBe(now);
  });

  it('increments count from existing value', () => {
    const usage = createTestUsage({
      attachedWorkCount: 5,
      firstAttachedAt: '2024-01-01T00:00:00Z',
      lastAttachedAt: '2024-01-10T00:00:00Z',
    });
    const now = '2024-01-15T10:00:00Z';

    const result = incrementAttachedWorkCount(usage, now);

    expect(result.attachedWorkCount).toBe(6);
  });

  it('preserves firstAttachedAt on subsequent attachments', () => {
    const originalFirst = '2024-01-01T00:00:00Z';
    const usage = createTestUsage({
      attachedWorkCount: 1,
      firstAttachedAt: originalFirst,
      lastAttachedAt: '2024-01-05T00:00:00Z',
    });
    const now = '2024-01-15T10:00:00Z';

    const result = incrementAttachedWorkCount(usage, now);

    expect(result.firstAttachedAt).toBe(originalFirst);
    expect(result.lastAttachedAt).toBe(now);
  });

  it('does not mutate original usage', () => {
    const original = createTestUsage({ attachedWorkCount: 3 });
    const originalCopy = { ...original };

    incrementAttachedWorkCount(original, '2024-01-15T10:00:00Z');

    expect(original).toEqual(originalCopy);
  });
});

// ============================================================================
// decrementAttachedWorkCount Tests
// ============================================================================

describe('decrementAttachedWorkCount', () => {
  it('decrements count from positive value', () => {
    const usage = createTestUsage({ attachedWorkCount: 5 });

    const result = decrementAttachedWorkCount(usage);

    expect(result.attachedWorkCount).toBe(4);
  });

  it('never goes below zero', () => {
    const usage = createTestUsage({ attachedWorkCount: 0 });

    const result = decrementAttachedWorkCount(usage);

    expect(result.attachedWorkCount).toBe(0);
  });

  it('stops at zero when decrementing from 1', () => {
    const usage = createTestUsage({ attachedWorkCount: 1 });

    const result = decrementAttachedWorkCount(usage);

    expect(result.attachedWorkCount).toBe(0);
  });

  it('does not mutate original usage', () => {
    const original = createTestUsage({ attachedWorkCount: 3 });
    const originalCopy = { ...original };

    decrementAttachedWorkCount(original);

    expect(original).toEqual(originalCopy);
  });

  it('preserves other fields', () => {
    const usage = createTestUsage({
      attachedWorkCount: 5,
      firstAttachedAt: '2024-01-01T00:00:00Z',
      lastAttachedAt: '2024-01-10T00:00:00Z',
      completedWorkCount: 2,
    });

    const result = decrementAttachedWorkCount(usage);

    expect(result.firstAttachedAt).toBe('2024-01-01T00:00:00Z');
    expect(result.lastAttachedAt).toBe('2024-01-10T00:00:00Z');
    expect(result.completedWorkCount).toBe(2);
  });
});

// ============================================================================
// incrementCompletedWorkCount Tests
// ============================================================================

describe('incrementCompletedWorkCount', () => {
  it('increments from zero', () => {
    const usage = createTestUsage();

    const result = incrementCompletedWorkCount(usage);

    expect(result.completedWorkCount).toBe(1);
  });

  it('increments from existing value', () => {
    const usage = createTestUsage({ completedWorkCount: 3 });

    const result = incrementCompletedWorkCount(usage);

    expect(result.completedWorkCount).toBe(4);
  });

  it('preserves other fields', () => {
    const usage = createTestUsage({
      attachedWorkCount: 5,
      firstAttachedAt: '2024-01-01T00:00:00Z',
      completedWorkCount: 2,
    });

    const result = incrementCompletedWorkCount(usage);

    expect(result.attachedWorkCount).toBe(5);
    expect(result.firstAttachedAt).toBe('2024-01-01T00:00:00Z');
    expect(result.completedWorkCount).toBe(3);
  });
});

// ============================================================================
// createWorkReference Tests
// ============================================================================

describe('createWorkReference', () => {
  it('creates reference with correct structure', () => {
    const ref = createWorkReference('work-123', '2024-01-15T10:00:00Z');

    expect(ref.type).toBe('work');
    expect(ref.id).toBe('work-123');
    expect(ref.at).toBe('2024-01-15T10:00:00Z');
  });
});

// ============================================================================
// isArtifactUsed Tests
// ============================================================================

describe('isArtifactUsed', () => {
  it('returns false for unused artifact', () => {
    const artifact = createTestArtifact('art-1');

    expect(isArtifactUsed(artifact)).toBe(false);
  });

  it('returns true when attachedWorkCount > 0', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({ attachedWorkCount: 1 }),
    });

    expect(isArtifactUsed(artifact)).toBe(true);
  });

  it('returns true when firstAttachedAt is set', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({
        attachedWorkCount: 0, // Was detached
        firstAttachedAt: '2024-01-01T00:00:00Z',
      }),
    });

    expect(isArtifactUsed(artifact)).toBe(true);
  });
});

// ============================================================================
// isHighImpactArtifact Tests
// ============================================================================

describe('isHighImpactArtifact', () => {
  it('returns false for unused artifact', () => {
    const artifact = createTestArtifact('art-1');

    expect(isHighImpactArtifact(artifact)).toBe(false);
  });

  it('returns true when completedWorkCount > 0', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({ completedWorkCount: 1 }),
    });

    expect(isHighImpactArtifact(artifact)).toBe(true);
  });

  it('returns true when attachedWorkCount >= threshold', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({ attachedWorkCount: 3 }),
    });

    expect(isHighImpactArtifact(artifact, 3)).toBe(true);
  });

  it('returns false when below threshold', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({ attachedWorkCount: 2 }),
    });

    expect(isHighImpactArtifact(artifact, 3)).toBe(false);
  });
});

// ============================================================================
// getUsageSummary Tests
// ============================================================================

describe('getUsageSummary', () => {
  it('returns "Not used yet" for unused artifact', () => {
    const artifact = createTestArtifact('art-1');

    const summary = getUsageSummary(artifact);

    expect(summary.label).toBe('Not used yet');
    expect(summary.isUsed).toBe(false);
    expect(summary.isHighImpact).toBe(false);
  });

  it('returns work item count for used artifact', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({ attachedWorkCount: 3, firstAttachedAt: '2024-01-01T00:00:00Z' }),
    });

    const summary = getUsageSummary(artifact);

    expect(summary.label).toBe('Used in 3 work items');
    expect(summary.isUsed).toBe(true);
  });

  it('includes completed count for high impact', () => {
    const artifact = createTestArtifact('art-1', {
      usage: createTestUsage({
        attachedWorkCount: 5,
        completedWorkCount: 2,
        firstAttachedAt: '2024-01-01T00:00:00Z',
      }),
    });

    const summary = getUsageSummary(artifact);

    expect(summary.label).toBe('Used in 5 work items, 2 completed');
    expect(summary.isHighImpact).toBe(true);
  });
});

// ============================================================================
// analyzeArtifacts Tests
// ============================================================================

describe('analyzeArtifacts', () => {
  it('returns empty analysis for empty array', () => {
    const result = analyzeArtifacts([]);

    expect(result.totalArtifacts).toBe(0);
    expect(result.neverAttached).toHaveLength(0);
    expect(result.impactScore).toBe(0);
  });

  it('categorizes unused artifacts correctly', () => {
    const artifacts = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
    ];

    const result = analyzeArtifacts(artifacts);

    expect(result.neverAttached).toHaveLength(2);
    expect(result.attachedNotCompleted).toHaveLength(0);
    expect(result.withCompletedWork).toHaveLength(0);
  });

  it('categorizes attached artifacts correctly', () => {
    const artifacts = [
      createTestArtifact('art-1', {
        usage: createTestUsage({ attachedWorkCount: 1, firstAttachedAt: '2024-01-01T00:00:00Z' }),
      }),
      createTestArtifact('art-2', {
        usage: createTestUsage({ attachedWorkCount: 2, completedWorkCount: 1, firstAttachedAt: '2024-01-01T00:00:00Z' }),
      }),
    ];

    const result = analyzeArtifacts(artifacts);

    expect(result.neverAttached).toHaveLength(0);
    expect(result.attachedNotCompleted).toHaveLength(1);
    expect(result.withCompletedWork).toHaveLength(1);
  });

  it('calculates type breakdown', () => {
    const artifacts = [
      createTestArtifact('art-1', { type: 'strategy_doc' }),
      createTestArtifact('art-2', { type: 'strategy_doc' }),
      createTestArtifact('art-3', { type: 'brief_doc' }),
    ];

    const result = analyzeArtifacts(artifacts);

    expect(result.byType).toHaveLength(2);
    const strategyType = result.byType.find(t => t.type === 'strategy_doc');
    expect(strategyType?.total).toBe(2);
  });
});

// ============================================================================
// getUnusedStrategyArtifacts Tests
// ============================================================================

describe('getUnusedStrategyArtifacts', () => {
  it('returns only unused artifacts from the strategy', () => {
    const artifacts = [
      createTestArtifact('art-1', { sourceStrategyId: 'strat-1' }),
      createTestArtifact('art-2', {
        sourceStrategyId: 'strat-1',
        usage: createTestUsage({ attachedWorkCount: 1, firstAttachedAt: '2024-01-01T00:00:00Z' }),
      }),
      createTestArtifact('art-3', { sourceStrategyId: 'strat-2' }),
    ];

    const result = getUnusedStrategyArtifacts('strat-1', artifacts);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('art-1');
  });
});

// ============================================================================
// getCompletedWorkArtifacts Tests
// ============================================================================

describe('getCompletedWorkArtifacts', () => {
  it('returns only artifacts with completed work', () => {
    const artifacts = [
      createTestArtifact('art-1', {
        usage: createTestUsage({ completedWorkCount: 1 }),
      }),
      createTestArtifact('art-2', {
        usage: createTestUsage({ attachedWorkCount: 1 }),
      }),
      createTestArtifact('art-3'),
    ];

    const result = getCompletedWorkArtifacts(artifacts);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('art-1');
  });
});

// ============================================================================
// calculateFeedbackSummary Tests
// ============================================================================

describe('calculateFeedbackSummary', () => {
  it('returns zeros for empty feedback', () => {
    const artifacts = [createTestArtifact('art-1')];

    const result = calculateFeedbackSummary(artifacts);

    expect(result.totalFeedback).toBe(0);
    expect(result.helpfulCount).toBe(0);
    expect(result.helpfulRate).toBe(0);
  });

  it('counts feedback correctly', () => {
    const artifacts = [
      createTestArtifact('art-1', {
        feedback: [
          { rating: 'helpful', submittedAt: '2024-01-01T00:00:00Z' },
          { rating: 'helpful', submittedAt: '2024-01-02T00:00:00Z' },
        ],
      }),
      createTestArtifact('art-2', {
        feedback: [
          { rating: 'neutral', submittedAt: '2024-01-01T00:00:00Z' },
          { rating: 'not_helpful', submittedAt: '2024-01-02T00:00:00Z' },
        ],
      }),
    ];

    const result = calculateFeedbackSummary(artifacts);

    expect(result.totalFeedback).toBe(4);
    expect(result.helpfulCount).toBe(2);
    expect(result.neutralCount).toBe(1);
    expect(result.notHelpfulCount).toBe(1);
    expect(result.helpfulRate).toBe(0.5);
  });
});
