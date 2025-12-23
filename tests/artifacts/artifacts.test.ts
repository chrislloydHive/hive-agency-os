// tests/artifacts/artifacts.test.ts
// Tests for Workspace Artifacts system
//
// Verifies:
// - Artifact types and helpers
// - Staleness detection logic
// - Google Drive client types

import { describe, it, expect } from 'vitest';
import {
  getGoogleFileTypeForArtifact,
  getArtifactTypeLabel,
  getArtifactStatusLabel,
  getArtifactSourceLabel,
  createEmptyArtifact,
} from '@/lib/types/artifact';
import type {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactSource,
  GoogleFileType,
} from '@/lib/types/artifact';
import {
  checkArtifactStaleness,
  getStalenessActions,
} from '@/lib/artifacts/stalenessDetection';
import type { StalenessContext } from '@/lib/artifacts/stalenessDetection';

// ============================================================================
// Type Helpers
// ============================================================================

describe('Artifact Type Helpers', () => {
  describe('getGoogleFileTypeForArtifact', () => {
    it('returns document for strategy_doc', () => {
      expect(getGoogleFileTypeForArtifact('strategy_doc')).toBe('document');
    });

    it('returns document for brief_doc', () => {
      expect(getGoogleFileTypeForArtifact('brief_doc')).toBe('document');
    });

    it('returns presentation for qbr_slides', () => {
      expect(getGoogleFileTypeForArtifact('qbr_slides')).toBe('presentation');
    });

    it('returns spreadsheet for media_plan', () => {
      expect(getGoogleFileTypeForArtifact('media_plan')).toBe('spreadsheet');
    });

    it('returns document for custom', () => {
      expect(getGoogleFileTypeForArtifact('custom')).toBe('document');
    });
  });

  describe('getArtifactTypeLabel', () => {
    it('returns human-readable labels', () => {
      expect(getArtifactTypeLabel('strategy_doc')).toBe('Strategy Document');
      expect(getArtifactTypeLabel('qbr_slides')).toBe('QBR Slides');
      expect(getArtifactTypeLabel('brief_doc')).toBe('Brief Document');
      expect(getArtifactTypeLabel('media_plan')).toBe('Media Plan');
      expect(getArtifactTypeLabel('custom')).toBe('Custom Document');
    });
  });

  describe('getArtifactStatusLabel', () => {
    it('returns human-readable labels', () => {
      expect(getArtifactStatusLabel('draft')).toBe('Draft');
      expect(getArtifactStatusLabel('published')).toBe('Published');
      expect(getArtifactStatusLabel('archived')).toBe('Archived');
    });
  });

  describe('getArtifactSourceLabel', () => {
    it('returns human-readable labels', () => {
      expect(getArtifactSourceLabel('strategy_handoff')).toBe('Strategy Handoff');
      expect(getArtifactSourceLabel('qbr_export')).toBe('QBR Export');
      expect(getArtifactSourceLabel('brief_export')).toBe('Brief Export');
      expect(getArtifactSourceLabel('media_plan_export')).toBe('Media Plan Export');
      expect(getArtifactSourceLabel('manual')).toBe('Manual Creation');
    });
  });

  describe('createEmptyArtifact', () => {
    it('creates artifact with correct defaults', () => {
      const artifact = createEmptyArtifact('company-123', 'strategy_doc');

      expect(artifact.companyId).toBe('company-123');
      expect(artifact.type).toBe('strategy_doc');
      expect(artifact.status).toBe('draft');
      expect(artifact.source).toBe('manual');
      expect(artifact.isStale).toBe(false);
      expect(artifact.tags).toEqual([]);
    });
  });
});

// ============================================================================
// Staleness Detection
// ============================================================================

describe('Staleness Detection', () => {
  function createTestArtifact(overrides: Partial<Artifact> = {}): Artifact {
    const now = new Date();
    return {
      id: 'artifact-123',
      companyId: 'company-123',
      title: 'Test Artifact',
      type: 'strategy_doc',
      status: 'draft',
      source: 'strategy_handoff',
      googleFileId: null,
      googleFileType: null,
      googleFileUrl: null,
      googleFolderId: null,
      googleModifiedAt: null,
      sourceStrategyId: 'strategy-123',
      sourceQbrStoryId: null,
      sourceBriefId: null,
      sourceMediaPlanId: null,
      engagementId: null,
      projectId: null,
      contextVersionAtCreation: null,
      strategyVersionAtCreation: 1,
      isStale: false,
      stalenessReason: null,
      stalenessCheckedAt: null,
      createdBy: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      updatedBy: null,
      description: null,
      tags: [],
      ...overrides,
    };
  }

  describe('checkArtifactStaleness', () => {
    it('returns fresh for new artifact with current strategy version', () => {
      const artifact = createTestArtifact({
        strategyVersionAtCreation: 2,
      });

      const context: StalenessContext = {
        strategyVersion: 2,
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('returns stale when strategy version increased', () => {
      const artifact = createTestArtifact({
        strategyVersionAtCreation: 1,
      });

      const context: StalenessContext = {
        strategyVersion: 3,
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('Strategy has been updated');
      expect(result.reason).toContain('v1 → v3');
    });

    it('returns stale for old artifacts (>30 days)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);

      const artifact = createTestArtifact({
        createdAt: oldDate.toISOString(),
        strategyVersionAtCreation: null, // No version tracking
      });

      const result = checkArtifactStaleness(artifact, {});

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('45 days old');
    });

    it('returns stale when strategy updated after artifact creation', () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 5);

      const updatedAt = new Date();
      updatedAt.setDate(updatedAt.getDate() - 2);

      const artifact = createTestArtifact({
        type: 'strategy_doc',
        createdAt: createdAt.toISOString(),
        strategyVersionAtCreation: null,
      });

      const context: StalenessContext = {
        strategyUpdatedAt: updatedAt.toISOString(),
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('Strategy was updated after');
    });

    it('handles non-strategy artifacts without version tracking', () => {
      const artifact = createTestArtifact({
        type: 'qbr_slides',
        strategyVersionAtCreation: null,
      });

      const context: StalenessContext = {
        strategyVersion: 5,
      };

      const result = checkArtifactStaleness(artifact, context);

      // Should be fresh (no strategy version check for QBR slides)
      expect(result.isStale).toBe(false);
    });
  });

  describe('getStalenessActions', () => {
    it('returns regenerate action for strategy_doc', () => {
      const artifact = createTestArtifact({ type: 'strategy_doc' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'regenerate')).toBe(true);
      expect(actions.some(a => a.label.includes('Strategy'))).toBe(true);
    });

    it('returns regenerate action for qbr_slides', () => {
      const artifact = createTestArtifact({ type: 'qbr_slides' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'regenerate')).toBe(true);
      expect(actions.some(a => a.label.includes('QBR'))).toBe(true);
    });

    it('returns regenerate action for brief_doc', () => {
      const artifact = createTestArtifact({ type: 'brief_doc' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'regenerate')).toBe(true);
      expect(actions.some(a => a.label.includes('Brief'))).toBe(true);
    });

    it('always includes dismiss action', () => {
      const artifact = createTestArtifact({ type: 'custom' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'dismiss')).toBe(true);
      expect(actions.some(a => a.label.includes('Mark as Current'))).toBe(true);
    });
  });
});

// ============================================================================
// Feature Flag Checking (types only)
// ============================================================================

import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

describe('Feature Flags', () => {
  it('has ARTIFACTS_ENABLED flag defined', () => {
    expect(typeof FEATURE_FLAGS.ARTIFACTS_ENABLED).toBe('boolean');
    expect(typeof FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED).toBe('boolean');
  });
});
