// tests/artifacts/findExistingArtifact.test.ts
// Tests for findExistingArtifact helper
//
// Verifies:
// - Existing artifact routes directly to viewer
// - Archived artifacts are ignored
// - Deterministic selection when multiple artifacts exist
// - Source type matching (strategy, plan:media, plan:content)

import { describe, it, expect } from 'vitest';
import {
  findExistingArtifact,
  hasExistingArtifact,
  findAllMatchingArtifacts,
} from '@/lib/os/artifacts/findExistingArtifact';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestArtifact(
  id: string,
  overrides: Partial<Artifact> = {}
): Artifact {
  return {
    id,
    companyId: 'company-123',
    title: `Test Artifact ${id}`,
    type: 'strategy_summary',
    status: 'draft',
    source: 'ai_generated',
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    updatedBy: null,
    lastEditedAt: null,
    lastEditedBy: null,
    description: null,
    tags: [],
    usage: {
      attachedWorkCount: 0,
      firstAttachedAt: null,
      lastAttachedAt: null,
      completedWorkCount: 0,
    },
    lastViewedAt: null,
    lastReferencedBy: null,
    feedback: [],
    ...overrides,
  };
}

// ============================================================================
// findExistingArtifact Tests
// ============================================================================

describe('findExistingArtifact', () => {
  describe('basic matching', () => {
    it('returns null when no artifacts exist', () => {
      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [],
      });

      expect(result.artifact).toBeNull();
      expect(result.hasMultiple).toBe(false);
      expect(result.matchCount).toBe(0);
    });

    it('returns matching artifact for strategy source', () => {
      const artifact = createTestArtifact('art-1', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [artifact],
      });

      expect(result.artifact?.id).toBe('art-1');
      expect(result.hasMultiple).toBe(false);
      expect(result.matchCount).toBe(1);
    });

    it('returns matching artifact for media plan source', () => {
      const artifact = createTestArtifact('art-1', {
        type: 'media_brief',
        sourceMediaPlanId: 'plan-123',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'media_brief',
        sourceType: 'plan:media',
        sourceId: 'plan-123',
        artifacts: [artifact],
      });

      expect(result.artifact?.id).toBe('art-1');
    });

    it('returns matching artifact for content plan source', () => {
      const artifact = createTestArtifact('art-1', {
        type: 'content_brief',
        sourceContentPlanId: 'plan-456',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'content_brief',
        sourceType: 'plan:content',
        sourceId: 'plan-456',
        artifacts: [artifact],
      });

      expect(result.artifact?.id).toBe('art-1');
    });
  });

  describe('type filtering', () => {
    it('does not match artifacts of different type', () => {
      const artifact = createTestArtifact('art-1', {
        type: 'creative_brief',
        sourceStrategyId: 'strat-123',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [artifact],
      });

      expect(result.artifact).toBeNull();
    });
  });

  describe('source filtering', () => {
    it('does not match artifacts from different source', () => {
      const artifact = createTestArtifact('art-1', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-456', // Different strategy
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [artifact],
      });

      expect(result.artifact).toBeNull();
    });
  });

  describe('archived artifacts', () => {
    it('ignores archived artifacts', () => {
      const archived = createTestArtifact('art-1', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'archived',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [archived],
      });

      expect(result.artifact).toBeNull();
    });

    it('returns non-archived when both exist', () => {
      const archived = createTestArtifact('art-archived', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'archived',
        updatedAt: '2024-01-15T00:00:00Z', // More recent
      });
      const active = createTestArtifact('art-active', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [archived, active],
      });

      expect(result.artifact?.id).toBe('art-active');
      expect(result.matchCount).toBe(1); // Archived not counted
    });
  });

  describe('multiple artifacts', () => {
    it('prefers draft over final', () => {
      const final = createTestArtifact('art-final', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'final',
        updatedAt: '2024-01-15T00:00:00Z', // More recent
      });
      const draft = createTestArtifact('art-draft', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [final, draft],
      });

      expect(result.artifact?.id).toBe('art-draft');
      expect(result.hasMultiple).toBe(true);
      expect(result.matchCount).toBe(2);
    });

    it('prefers most recently updated when same status', () => {
      const older = createTestArtifact('art-older', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      const newer = createTestArtifact('art-newer', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-15T00:00:00Z',
      });

      const result = findExistingArtifact({
        artifactTypeId: 'strategy_summary',
        sourceType: 'strategy',
        sourceId: 'strat-123',
        artifacts: [older, newer],
      });

      expect(result.artifact?.id).toBe('art-newer');
    });

    it('is deterministic with same timestamps', () => {
      const artifact1 = createTestArtifact('art-1', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      const artifact2 = createTestArtifact('art-2', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      // Run multiple times to ensure consistency
      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = findExistingArtifact({
          artifactTypeId: 'strategy_summary',
          sourceType: 'strategy',
          sourceId: 'strat-123',
          artifacts: [artifact1, artifact2],
        });
        results.add(result.artifact?.id ?? '');
      }

      // Should always return the same artifact
      expect(results.size).toBe(1);
    });
  });
});

// ============================================================================
// hasExistingArtifact Tests
// ============================================================================

describe('hasExistingArtifact', () => {
  it('returns true when artifact exists', () => {
    const artifact = createTestArtifact('art-1', {
      type: 'strategy_summary',
      sourceStrategyId: 'strat-123',
    });

    const result = hasExistingArtifact({
      artifactTypeId: 'strategy_summary',
      sourceType: 'strategy',
      sourceId: 'strat-123',
      artifacts: [artifact],
    });

    expect(result).toBe(true);
  });

  it('returns false when artifact does not exist', () => {
    const result = hasExistingArtifact({
      artifactTypeId: 'strategy_summary',
      sourceType: 'strategy',
      sourceId: 'strat-123',
      artifacts: [],
    });

    expect(result).toBe(false);
  });
});

// ============================================================================
// findAllMatchingArtifacts Tests
// ============================================================================

describe('findAllMatchingArtifacts', () => {
  it('returns all matching non-archived artifacts', () => {
    const artifacts = [
      createTestArtifact('art-1', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'draft',
      }),
      createTestArtifact('art-2', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'final',
      }),
      createTestArtifact('art-3', {
        type: 'strategy_summary',
        sourceStrategyId: 'strat-123',
        status: 'archived',
      }),
      createTestArtifact('art-4', {
        type: 'creative_brief', // Different type
        sourceStrategyId: 'strat-123',
      }),
    ];

    const result = findAllMatchingArtifacts({
      artifactTypeId: 'strategy_summary',
      sourceType: 'strategy',
      sourceId: 'strat-123',
      artifacts,
    });

    expect(result).toHaveLength(2);
    expect(result.map(a => a.id).sort()).toEqual(['art-1', 'art-2']);
  });
});
