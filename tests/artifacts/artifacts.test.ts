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
  isRfpArtifactType,
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

    it('returns RFP artifact labels', () => {
      expect(getArtifactTypeLabel('rfp_response_doc')).toBe('RFP Response');
      expect(getArtifactTypeLabel('proposal_slides')).toBe('Proposal Slides');
      expect(getArtifactTypeLabel('pricing_sheet')).toBe('Pricing Sheet');
    });
  });

  describe('getGoogleFileTypeForArtifact - RFP types', () => {
    it('returns document for rfp_response_doc', () => {
      expect(getGoogleFileTypeForArtifact('rfp_response_doc')).toBe('document');
    });

    it('returns presentation for proposal_slides', () => {
      expect(getGoogleFileTypeForArtifact('proposal_slides')).toBe('presentation');
    });

    it('returns spreadsheet for pricing_sheet', () => {
      expect(getGoogleFileTypeForArtifact('pricing_sheet')).toBe('spreadsheet');
    });
  });

  describe('getArtifactStatusLabel', () => {
    it('returns human-readable labels', () => {
      expect(getArtifactStatusLabel('draft')).toBe('Draft');
      expect(getArtifactStatusLabel('final')).toBe('Final');
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

    it('returns RFP export label', () => {
      expect(getArtifactSourceLabel('rfp_export')).toBe('RFP Export');
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
      snapshotId: null,
      isStale: false,
      stalenessReason: null,
      stalenessCheckedAt: null,
      lastSyncedAt: null,
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

    it('returns update action for rfp_response_doc', () => {
      const artifact = createTestArtifact({ type: 'rfp_response_doc' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'update')).toBe(true);
      expect(actions.some(a => a.label.includes('Insert Updates'))).toBe(true);
    });

    it('returns open action for proposal_slides', () => {
      const artifact = createTestArtifact({ type: 'proposal_slides' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'open')).toBe(true);
      expect(actions.some(a => a.label.includes('Open in Google'))).toBe(true);
    });

    it('returns open action for pricing_sheet', () => {
      const artifact = createTestArtifact({ type: 'pricing_sheet' });
      const actions = getStalenessActions(artifact);

      expect(actions.some(a => a.action === 'open')).toBe(true);
    });
  });

  describe('isRfpArtifactType', () => {
    it('returns true for RFP artifact types', () => {
      expect(isRfpArtifactType('rfp_response_doc')).toBe(true);
      expect(isRfpArtifactType('proposal_slides')).toBe(true);
      expect(isRfpArtifactType('pricing_sheet')).toBe(true);
    });

    it('returns false for non-RFP artifact types', () => {
      expect(isRfpArtifactType('strategy_doc')).toBe(false);
      expect(isRfpArtifactType('qbr_slides')).toBe(false);
      expect(isRfpArtifactType('brief_doc')).toBe(false);
      expect(isRfpArtifactType('media_plan')).toBe(false);
      expect(isRfpArtifactType('custom')).toBe(false);
    });
  });

  describe('RFP artifact staleness (snapshot-based)', () => {
    it('returns stale when snapshot mismatch for rfp_response_doc', () => {
      const artifact = createTestArtifact({
        type: 'rfp_response_doc',
        snapshotId: 'snapshot-old',
        lastSyncedAt: new Date().toISOString(),
      });

      const context: StalenessContext = {
        latestSnapshotId: 'snapshot-new',
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('Context has been updated');
    });

    it('returns fresh when snapshot matches for rfp_response_doc', () => {
      const artifact = createTestArtifact({
        type: 'rfp_response_doc',
        snapshotId: 'snapshot-123',
        lastSyncedAt: new Date().toISOString(),
      });

      const context: StalenessContext = {
        latestSnapshotId: 'snapshot-123',
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(false);
    });

    it('returns stale when newer snapshot created after lastSyncedAt', () => {
      const syncedAt = new Date();
      syncedAt.setHours(syncedAt.getHours() - 1);

      const snapshotCreatedAt = new Date();

      const artifact = createTestArtifact({
        type: 'proposal_slides',
        snapshotId: 'snapshot-123',
        lastSyncedAt: syncedAt.toISOString(),
      });

      const context: StalenessContext = {
        latestSnapshotId: 'snapshot-123', // Same ID but...
        latestSnapshotCreatedAt: snapshotCreatedAt.toISOString(), // created after sync
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('snapshot was created after');
    });

    it('returns fresh for pricing_sheet with no snapshot changes', () => {
      const now = new Date().toISOString();
      const artifact = createTestArtifact({
        type: 'pricing_sheet',
        snapshotId: 'snapshot-abc',
        lastSyncedAt: now,
      });

      const context: StalenessContext = {
        latestSnapshotId: 'snapshot-abc',
        latestSnapshotCreatedAt: now,
      };

      const result = checkArtifactStaleness(artifact, context);

      expect(result.isStale).toBe(false);
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
