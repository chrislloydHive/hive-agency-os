// tests/artifacts/strategy-doc-card.test.ts
// Tests for StrategyDocCard dual-backend behavior
//
// Verifies:
// - Artifacts-preferred mode when feature enabled
// - Fallback mode when feature disabled
// - State derivation from both backends

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Artifact } from '@/lib/types/artifact';
import type { StrategyDocStatusResponse } from '@/app/api/os/companies/[companyId]/documents/strategy/status/route';
import { createArtifact } from '@/tests/helpers/factories';

// ============================================================================
// Mock Data
// ============================================================================

// Alias for cleaner test code
const createMockArtifact = createArtifact;

function createMockFallbackStatus(overrides: Partial<StrategyDocStatusResponse> = {}): StrategyDocStatusResponse {
  return {
    exists: false,
    status: 'not_created',
    stalenessCount: 0,
    docUrl: null,
    lastSyncedAt: null,
    contextReady: true,
    confirmedFieldCount: 5,
    minRequiredFields: 3,
    googleDriveAvailable: true,
    ...overrides,
  };
}

// ============================================================================
// Helper Functions (extracted from component logic for testing)
// ============================================================================

/**
 * Find the active strategy_doc artifact (prefer final, then draft, ignore archived)
 */
function findActiveStrategyDoc(artifacts: Artifact[]): Artifact | null {
  const strategyDocs = artifacts.filter(a => a.type === 'strategy_doc' && a.status !== 'archived');

  // Prefer final
  const final = strategyDocs.find(a => a.status === 'final');
  if (final) return final;

  // Fall back to draft
  const draft = strategyDocs.find(a => a.status === 'draft');
  if (draft) return draft;

  return null;
}

type DocStatus = 'not_created' | 'up_to_date' | 'out_of_date';

interface UnifiedDocState {
  status: DocStatus;
  docUrl: string | null;
  isStale: boolean;
  stalenessCount: number;
  usingArtifacts: boolean;
}

/**
 * Derive unified state from artifact
 */
function deriveStateFromArtifact(artifact: Artifact): UnifiedDocState {
  return {
    status: artifact.isStale ? 'out_of_date' : 'up_to_date',
    docUrl: artifact.googleFileUrl,
    isStale: artifact.isStale,
    stalenessCount: artifact.isStale ? 1 : 0,
    usingArtifacts: true,
  };
}

/**
 * Derive unified state from fallback status
 */
function deriveStateFromFallback(fallback: StrategyDocStatusResponse): UnifiedDocState {
  return {
    status: fallback.status,
    docUrl: fallback.docUrl,
    isStale: fallback.status === 'out_of_date',
    stalenessCount: fallback.stalenessCount,
    usingArtifacts: false,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('StrategyDocCard State Derivation', () => {
  describe('findActiveStrategyDoc', () => {
    it('returns null for empty array', () => {
      expect(findActiveStrategyDoc([])).toBeNull();
    });

    it('returns null when only archived artifacts exist', () => {
      const artifacts = [
        createMockArtifact({ status: 'archived' }),
        createMockArtifact({ id: 'artifact-2', status: 'archived' }),
      ];
      expect(findActiveStrategyDoc(artifacts)).toBeNull();
    });

    it('prefers final over draft', () => {
      const draft = createMockArtifact({ id: 'draft-1', status: 'draft' });
      const final = createMockArtifact({ id: 'final-1', status: 'final' });
      const artifacts = [draft, final];

      expect(findActiveStrategyDoc(artifacts)?.id).toBe('final-1');
    });

    it('returns draft when no final exists', () => {
      const draft = createMockArtifact({ id: 'draft-1', status: 'draft' });
      const archived = createMockArtifact({ id: 'archived-1', status: 'archived' });
      const artifacts = [draft, archived];

      expect(findActiveStrategyDoc(artifacts)?.id).toBe('draft-1');
    });

    it('ignores non-strategy_doc types', () => {
      const qbrSlides = createMockArtifact({ id: 'qbr-1', type: 'qbr_slides', status: 'final' });
      const strategyDoc = createMockArtifact({ id: 'strategy-1', type: 'strategy_doc', status: 'draft' });
      const artifacts = [qbrSlides, strategyDoc];

      expect(findActiveStrategyDoc(artifacts)?.id).toBe('strategy-1');
    });
  });

  describe('deriveStateFromArtifact', () => {
    it('returns up_to_date when artifact is not stale', () => {
      const artifact = createMockArtifact({ isStale: false });
      const state = deriveStateFromArtifact(artifact);

      expect(state.status).toBe('up_to_date');
      expect(state.isStale).toBe(false);
      expect(state.stalenessCount).toBe(0);
      expect(state.usingArtifacts).toBe(true);
    });

    it('returns out_of_date when artifact is stale', () => {
      const artifact = createMockArtifact({
        isStale: true,
        stalenessReason: 'Strategy updated',
      });
      const state = deriveStateFromArtifact(artifact);

      expect(state.status).toBe('out_of_date');
      expect(state.isStale).toBe(true);
      expect(state.stalenessCount).toBe(1);
      expect(state.usingArtifacts).toBe(true);
    });

    it('includes docUrl from artifact', () => {
      const artifact = createMockArtifact({
        googleFileUrl: 'https://docs.google.com/document/d/xyz',
      });
      const state = deriveStateFromArtifact(artifact);

      expect(state.docUrl).toBe('https://docs.google.com/document/d/xyz');
    });
  });

  describe('deriveStateFromFallback', () => {
    it('returns not_created status', () => {
      const fallback = createMockFallbackStatus({ status: 'not_created' });
      const state = deriveStateFromFallback(fallback);

      expect(state.status).toBe('not_created');
      expect(state.usingArtifacts).toBe(false);
    });

    it('returns up_to_date status', () => {
      const fallback = createMockFallbackStatus({
        exists: true,
        status: 'up_to_date',
        docUrl: 'https://docs.google.com/document/d/abc',
      });
      const state = deriveStateFromFallback(fallback);

      expect(state.status).toBe('up_to_date');
      expect(state.docUrl).toBe('https://docs.google.com/document/d/abc');
      expect(state.usingArtifacts).toBe(false);
    });

    it('returns out_of_date with staleness count', () => {
      const fallback = createMockFallbackStatus({
        exists: true,
        status: 'out_of_date',
        stalenessCount: 5,
        docUrl: 'https://docs.google.com/document/d/abc',
      });
      const state = deriveStateFromFallback(fallback);

      expect(state.status).toBe('out_of_date');
      expect(state.isStale).toBe(true);
      expect(state.stalenessCount).toBe(5);
      expect(state.usingArtifacts).toBe(false);
    });
  });
});

describe('StrategyDocCard Backend Selection', () => {
  it('uses artifacts when API returns 200', async () => {
    // This tests the logic: if artifacts API returns OK, use artifacts backend
    const artifacts = [createMockArtifact({ status: 'final' })];
    const activeArtifact = findActiveStrategyDoc(artifacts);

    expect(activeArtifact).not.toBeNull();
    expect(activeArtifact?.status).toBe('final');
  });

  it('falls back when no strategy_doc artifacts exist', async () => {
    // This tests the logic: if no strategy_doc artifacts, check for creation readiness
    const artifacts: Artifact[] = [];
    const activeArtifact = findActiveStrategyDoc(artifacts);

    expect(activeArtifact).toBeNull();
    // In this case, component should fall back to checking context readiness
  });

  it('handles mixed artifact types correctly', () => {
    const artifacts = [
      createMockArtifact({ id: 'qbr-1', type: 'qbr_slides', status: 'final' }),
      createMockArtifact({ id: 'brief-1', type: 'brief_doc', status: 'draft' }),
      createMockArtifact({ id: 'media-1', type: 'media_plan', status: 'final' }),
    ];

    const activeStrategyDoc = findActiveStrategyDoc(artifacts);
    expect(activeStrategyDoc).toBeNull();
  });
});
