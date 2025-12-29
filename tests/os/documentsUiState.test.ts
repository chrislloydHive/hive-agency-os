// tests/os/documentsUiState.test.ts
// Unit tests for Documents UI state selector

import { describe, it, expect } from 'vitest';
import {
  deriveDocumentsState,
  getDocumentsUIState,
  getUpdateRouteForArtifact,
  isUpdatableType,
  UPDATABLE_TYPES,
  type DocumentsDataInput,
} from '@/lib/os/ui/documentsUiState';
import { createArtifact, type Artifact } from '@/tests/helpers/factories';

// ============================================================================
// Test Helpers
// ============================================================================

/** Alias to createArtifact for use in this test file */
function makeArtifact(overrides: Parameters<typeof createArtifact>[0] = {}) {
  return createArtifact(overrides);
}

function makeInput(artifacts: Artifact[] = []): DocumentsDataInput {
  return { artifacts };
}

// ============================================================================
// State Derivation Tests
// ============================================================================

describe('deriveDocumentsState', () => {
  it('returns empty when no artifacts', () => {
    const input = makeInput([]);
    expect(deriveDocumentsState(input)).toBe('empty');
  });

  it('returns empty when only archived artifacts', () => {
    const input = makeInput([
      makeArtifact({ status: 'archived' }),
      makeArtifact({ status: 'archived' }),
    ]);
    expect(deriveDocumentsState(input)).toBe('empty');
  });

  it('returns has_docs_up_to_date when all artifacts are fresh', () => {
    const input = makeInput([
      makeArtifact({ isStale: false }),
      makeArtifact({ isStale: false }),
    ]);
    expect(deriveDocumentsState(input)).toBe('has_docs_up_to_date');
  });

  it('returns has_docs_updates_available when any artifact is stale', () => {
    const input = makeInput([
      makeArtifact({ isStale: false }),
      makeArtifact({ isStale: true }),
    ]);
    expect(deriveDocumentsState(input)).toBe('has_docs_updates_available');
  });

  it('ignores archived artifacts for staleness check', () => {
    const input = makeInput([
      makeArtifact({ isStale: false }),
      makeArtifact({ isStale: true, status: 'archived' }),
    ]);
    expect(deriveDocumentsState(input)).toBe('has_docs_up_to_date');
  });
});

// ============================================================================
// Primary Preference Tests
// ============================================================================

describe('getDocumentsUIState primary preference', () => {
  const companyId = 'test-company';

  it('returns null primaryArtifact when empty', () => {
    const input = makeInput([]);
    const state = getDocumentsUIState(input, companyId);
    expect(state.primaryArtifact).toBeNull();
  });

  it('prefers rfp_response_doc over strategy_doc', () => {
    const rfp = makeArtifact({
      id: 'rfp-1',
      type: 'rfp_response_doc',
      status: 'draft',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const strategy = makeArtifact({
      id: 'strategy-1',
      type: 'strategy_doc',
      status: 'draft',
      updatedAt: '2024-01-02T00:00:00Z', // newer
    });
    const input = makeInput([strategy, rfp]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.primaryArtifact?.id).toBe('rfp-1');
    expect(state.primaryArtifact?.type).toBe('rfp_response_doc');
  });

  it('prefers strategy_doc over other types', () => {
    const strategy = makeArtifact({
      id: 'strategy-1',
      type: 'strategy_doc',
      status: 'draft',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const slides = makeArtifact({
      id: 'slides-1',
      type: 'qbr_slides',
      status: 'final',
      updatedAt: '2024-01-02T00:00:00Z', // newer
    });
    const input = makeInput([slides, strategy]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.primaryArtifact?.id).toBe('strategy-1');
    expect(state.primaryArtifact?.type).toBe('strategy_doc');
  });

  it('prefers final over draft within same type', () => {
    const draftRfp = makeArtifact({
      id: 'rfp-draft',
      type: 'rfp_response_doc',
      status: 'draft',
      updatedAt: '2024-01-02T00:00:00Z', // newer
    });
    const finalRfp = makeArtifact({
      id: 'rfp-final',
      type: 'rfp_response_doc',
      status: 'final',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const input = makeInput([draftRfp, finalRfp]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.primaryArtifact?.id).toBe('rfp-final');
    expect(state.primaryArtifact?.status).toBe('final');
  });

  it('falls back to newest when no rfp or strategy', () => {
    const oldSlides = makeArtifact({
      id: 'slides-old',
      type: 'qbr_slides',
      status: 'draft',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const newSheet = makeArtifact({
      id: 'sheet-new',
      type: 'pricing_sheet',
      status: 'draft',
      updatedAt: '2024-01-02T00:00:00Z',
    });
    const input = makeInput([oldSlides, newSheet]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.primaryArtifact?.id).toBe('sheet-new');
  });

  it('ignores archived artifacts for primary selection', () => {
    const archivedRfp = makeArtifact({
      id: 'rfp-archived',
      type: 'rfp_response_doc',
      status: 'archived',
    });
    const strategy = makeArtifact({
      id: 'strategy-1',
      type: 'strategy_doc',
      status: 'draft',
    });
    const input = makeInput([archivedRfp, strategy]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.primaryArtifact?.id).toBe('strategy-1');
  });
});

// ============================================================================
// Grouping Tests
// ============================================================================

describe('getDocumentsUIState grouping', () => {
  const companyId = 'test-company';

  it('returns empty groups when no artifacts', () => {
    const input = makeInput([]);
    const state = getDocumentsUIState(input, companyId);
    expect(state.groups).toHaveLength(0);
  });

  it('groups strategy_doc into strategy group', () => {
    const input = makeInput([makeArtifact({ type: 'strategy_doc' })]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].key).toBe('strategy');
    expect(state.groups[0].label).toBe('Strategy Documents');
    expect(state.groups[0].count).toBe(1);
  });

  it('groups rfp_response_doc into rfp group', () => {
    const input = makeInput([makeArtifact({ type: 'rfp_response_doc' })]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].key).toBe('rfp');
    expect(state.groups[0].label).toBe('RFP Responses');
  });

  it('groups slides types together', () => {
    const input = makeInput([
      makeArtifact({ type: 'qbr_slides', id: 'qbr' }),
      makeArtifact({ type: 'proposal_slides', id: 'proposal' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    const slidesGroup = state.groups.find(g => g.key === 'slides');
    expect(slidesGroup).toBeDefined();
    expect(slidesGroup!.label).toBe('Presentations');
    expect(slidesGroup!.count).toBe(2);
  });

  it('groups sheets types together', () => {
    const input = makeInput([
      makeArtifact({ type: 'media_plan', id: 'media' }),
      makeArtifact({ type: 'pricing_sheet', id: 'pricing' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    const sheetsGroup = state.groups.find(g => g.key === 'sheets');
    expect(sheetsGroup).toBeDefined();
    expect(sheetsGroup!.label).toBe('Spreadsheets');
    expect(sheetsGroup!.count).toBe(2);
  });

  it('groups brief_doc and custom into other', () => {
    const input = makeInput([
      makeArtifact({ type: 'brief_doc', id: 'brief' }),
      makeArtifact({ type: 'custom', id: 'custom' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    const otherGroup = state.groups.find(g => g.key === 'other');
    expect(otherGroup).toBeDefined();
    expect(otherGroup!.label).toBe('Other Documents');
    expect(otherGroup!.count).toBe(2);
  });

  it('orders groups correctly', () => {
    const input = makeInput([
      makeArtifact({ type: 'custom', id: 'custom' }),
      makeArtifact({ type: 'pricing_sheet', id: 'pricing' }),
      makeArtifact({ type: 'qbr_slides', id: 'slides' }),
      makeArtifact({ type: 'rfp_response_doc', id: 'rfp' }),
      makeArtifact({ type: 'strategy_doc', id: 'strategy' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    const keys = state.groups.map(g => g.key);
    expect(keys).toEqual(['strategy', 'rfp', 'slides', 'sheets', 'other']);
  });

  it('excludes archived artifacts from groups', () => {
    const input = makeInput([
      makeArtifact({ type: 'strategy_doc', status: 'draft' }),
      makeArtifact({ type: 'strategy_doc', status: 'archived' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    const strategyGroup = state.groups.find(g => g.key === 'strategy');
    expect(strategyGroup!.count).toBe(1);
  });

  it('sorts within groups: final first, then by updatedAt', () => {
    const draft = makeArtifact({
      id: 'draft',
      type: 'strategy_doc',
      status: 'draft',
      updatedAt: '2024-01-03T00:00:00Z', // newest
    });
    const oldFinal = makeArtifact({
      id: 'old-final',
      type: 'strategy_doc',
      status: 'final',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const newFinal = makeArtifact({
      id: 'new-final',
      type: 'strategy_doc',
      status: 'final',
      updatedAt: '2024-01-02T00:00:00Z',
    });
    const input = makeInput([draft, oldFinal, newFinal]);
    const state = getDocumentsUIState(input, companyId);

    const strategyGroup = state.groups.find(g => g.key === 'strategy');
    const ids = strategyGroup!.artifacts.map(a => a.id);
    // new-final first (final + newer), then old-final, then draft
    expect(ids).toEqual(['new-final', 'old-final', 'draft']);
  });
});

// ============================================================================
// Staleness Tests
// ============================================================================

describe('getDocumentsUIState staleness', () => {
  const companyId = 'test-company';

  it('showStaleWarning is false when no stale artifacts', () => {
    const input = makeInput([makeArtifact({ isStale: false })]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.showStaleWarning).toBe(false);
    expect(state.staleCount).toBe(0);
  });

  it('showStaleWarning is true when any artifact is stale', () => {
    const input = makeInput([
      makeArtifact({ isStale: false }),
      makeArtifact({ isStale: true }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.showStaleWarning).toBe(true);
    expect(state.staleCount).toBe(1);
  });

  it('staleUpdatableArtifact is null when no stale updatable types', () => {
    const input = makeInput([
      makeArtifact({ type: 'qbr_slides', isStale: true }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.staleUpdatableArtifact).toBeNull();
  });

  it('staleUpdatableArtifact returns rfp_response_doc when stale', () => {
    const input = makeInput([
      makeArtifact({ id: 'rfp', type: 'rfp_response_doc', isStale: true }),
      makeArtifact({ id: 'strategy', type: 'strategy_doc', isStale: true }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.staleUpdatableArtifact?.id).toBe('rfp');
  });

  it('staleUpdatableArtifact returns strategy_doc when no stale rfp', () => {
    const input = makeInput([
      makeArtifact({ id: 'rfp', type: 'rfp_response_doc', isStale: false }),
      makeArtifact({ id: 'strategy', type: 'strategy_doc', isStale: true }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.staleUpdatableArtifact?.id).toBe('strategy');
  });
});

// ============================================================================
// CTA Tests
// ============================================================================

describe('getDocumentsUIState CTAs', () => {
  const companyId = 'test-company';

  describe('empty state', () => {
    it('returns "Go to Deliver" for empty state', () => {
      const input = makeInput([]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Go to Deliver');
      expect(state.primaryCTA.href).toBe('/c/test-company/deliver');
      expect(state.primaryCTA.variant).toBe('primary');
    });

    it('returns null secondary for empty state', () => {
      const input = makeInput([]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.secondaryCTA).toBeNull();
    });
  });

  describe('has_docs_up_to_date state', () => {
    it('returns "Open Primary Document" when has google url', () => {
      const input = makeInput([
        makeArtifact({
          type: 'strategy_doc',
          googleFileUrl: 'https://docs.google.com/document/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Open Primary Document');
      expect(state.primaryCTA.href).toBe('https://docs.google.com/document/d/123');
      expect(state.primaryCTA.external).toBe(true);
    });

    it('returns "Go to Deliver" when no google url', () => {
      const input = makeInput([
        makeArtifact({
          type: 'strategy_doc',
          googleFileUrl: null,
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Go to Deliver');
    });

    it('returns "Create New" secondary when has primary', () => {
      const input = makeInput([
        makeArtifact({
          type: 'strategy_doc',
          googleFileUrl: 'https://docs.google.com/document/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.secondaryCTA?.label).toBe('Create New');
      expect(state.secondaryCTA?.href).toBe('/c/test-company/deliver');
    });
  });

  describe('has_docs_updates_available state', () => {
    it('returns "Insert Updates" when stale updatable exists', () => {
      const input = makeInput([
        makeArtifact({
          id: 'strategy-1',
          type: 'strategy_doc',
          isStale: true,
          googleFileUrl: 'https://docs.google.com/document/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Insert Updates');
      expect(state.primaryCTA.href).toBe('/c/test-company/strategy/update');
    });

    it('returns rfp update route for rfp_response_doc', () => {
      const input = makeInput([
        makeArtifact({
          id: 'rfp-1',
          type: 'rfp_response_doc',
          isStale: true,
          googleFileUrl: 'https://docs.google.com/document/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Insert Updates');
      expect(state.primaryCTA.href).toBe('/c/test-company/rfp/rfp-1/update');
    });

    it('returns "Open Primary" secondary when Insert Updates is primary', () => {
      const input = makeInput([
        makeArtifact({
          id: 'strategy-1',
          type: 'strategy_doc',
          isStale: true,
          googleFileUrl: 'https://docs.google.com/document/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.secondaryCTA?.label).toBe('Open Primary');
      expect(state.secondaryCTA?.href).toBe('https://docs.google.com/document/d/123');
      expect(state.secondaryCTA?.external).toBe(true);
    });

    it('returns "Open Primary Document" when stale but not updatable type', () => {
      const input = makeInput([
        makeArtifact({
          type: 'qbr_slides',
          isStale: true,
          googleFileUrl: 'https://slides.google.com/presentation/d/123',
        }),
      ]);
      const state = getDocumentsUIState(input, companyId);

      expect(state.primaryCTA.label).toBe('Open Primary Document');
    });
  });
});

// ============================================================================
// Debug Info Tests
// ============================================================================

describe('getDocumentsUIState debug info', () => {
  const companyId = 'test-company';

  it('includes correct counts in debug', () => {
    const input = makeInput([
      makeArtifact({ isStale: false }),
      makeArtifact({ isStale: true }),
      makeArtifact({ status: 'archived' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.debug.totalCount).toBe(3);
    expect(state.debug.activeCount).toBe(2);
    expect(state.debug.staleCount).toBe(1);
    expect(state.debug.hasAnyStale).toBe(true);
  });

  it('includes primary artifact info in debug', () => {
    const input = makeInput([
      makeArtifact({ id: 'rfp-1', type: 'rfp_response_doc' }),
    ]);
    const state = getDocumentsUIState(input, companyId);

    expect(state.debug.preferredPrimaryId).toBe('rfp-1');
    expect(state.debug.preferredPrimaryType).toBe('rfp_response_doc');
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getUpdateRouteForArtifact', () => {
  const companyId = 'test-company';

  it('returns strategy update route for strategy_doc', () => {
    const artifact = makeArtifact({ id: 'strat-1', type: 'strategy_doc' });
    expect(getUpdateRouteForArtifact(artifact, companyId)).toBe(
      '/c/test-company/strategy/update'
    );
  });

  it('returns rfp update route for rfp_response_doc', () => {
    const artifact = makeArtifact({ id: 'rfp-1', type: 'rfp_response_doc' });
    expect(getUpdateRouteForArtifact(artifact, companyId)).toBe(
      '/c/test-company/rfp/rfp-1/update'
    );
  });

  it('returns null for non-updatable types', () => {
    const artifact = makeArtifact({ type: 'qbr_slides' });
    expect(getUpdateRouteForArtifact(artifact, companyId)).toBeNull();
  });
});

describe('isUpdatableType', () => {
  it('returns true for strategy_doc', () => {
    expect(isUpdatableType('strategy_doc')).toBe(true);
  });

  it('returns true for rfp_response_doc', () => {
    expect(isUpdatableType('rfp_response_doc')).toBe(true);
  });

  it('returns false for other types', () => {
    expect(isUpdatableType('qbr_slides')).toBe(false);
    expect(isUpdatableType('media_plan')).toBe(false);
    expect(isUpdatableType('custom')).toBe(false);
  });
});

describe('UPDATABLE_TYPES', () => {
  it('contains only strategy_doc and rfp_response_doc', () => {
    expect(UPDATABLE_TYPES).toContain('strategy_doc');
    expect(UPDATABLE_TYPES).toContain('rfp_response_doc');
    expect(UPDATABLE_TYPES).toHaveLength(2);
  });
});
