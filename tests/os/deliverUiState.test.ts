// tests/os/deliverUiState.test.ts
// Unit tests for Deliver UI state selector

import { describe, it, expect } from 'vitest';
import {
  deriveDeliverState,
  getDeliverUIState,
  type DeliverDataInput,
} from '@/lib/os/ui/deliverUiState';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeHealth(overrides: Partial<{
  hasRun: boolean;
  confirmed: number;
  proposed: number;
}>): V4HealthResponse {
  return {
    healthVersion: 1,
    companyId: 'test-company',
    timestamp: new Date().toISOString(),
    status: 'GREEN',
    reasons: [],
    flags: {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    },
    websiteLab: {
      hasRun: overrides.hasRun ?? false,
      runId: null,
      createdAt: null,
      ageMinutes: null,
      staleThresholdMinutes: 10080,
    },
    propose: {
      lastReason: null,
      proposedCount: null,
      createdCount: null,
      skippedCount: null,
      lastRunId: null,
    },
    store: {
      total: (overrides.confirmed ?? 0) + (overrides.proposed ?? 0),
      proposed: overrides.proposed ?? 0,
      confirmed: overrides.confirmed ?? 0,
      rejected: 0,
    },
    links: {
      inspectorPath: '/test',
      proposeApiPath: '/test',
    },
  };
}

function makeArtifact(overrides: Partial<Artifact>): Artifact {
  return {
    id: 'artifact-1',
    companyId: 'test-company',
    title: 'Test Artifact',
    type: 'strategy_doc',
    status: 'final',
    source: 'strategy_handoff',
    googleFileId: 'gfile-123',
    googleFileType: 'document',
    googleFileUrl: 'https://docs.google.com/document/d/abc',
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
    ...overrides,
  };
}

// ============================================================================
// State Derivation Tests
// ============================================================================

describe('deriveDeliverState', () => {
  it('returns blocked_no_labs when labs have not run', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    expect(deriveDeliverState(input)).toBe('blocked_no_labs');
  });

  it('returns blocked_not_decided when labs run but no strategy', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: null,
      artifacts: [],
    };
    expect(deriveDeliverState(input)).toBe('blocked_not_decided');
  });

  it('returns blocked_not_decided when labs run but not enough confirmed', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 2 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    expect(deriveDeliverState(input)).toBe('blocked_not_decided');
  });

  it('returns ready_no_deliverables when Decide complete but no artifacts', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    expect(deriveDeliverState(input)).toBe('ready_no_deliverables');
  });

  it('returns ready_up_to_date when has deliverables and none stale', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc', isStale: false }),
      ],
    };
    expect(deriveDeliverState(input)).toBe('ready_up_to_date');
  });

  it('returns ready_updates_available when has stale deliverables', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc', isStale: true }),
      ],
    };
    expect(deriveDeliverState(input)).toBe('ready_updates_available');
  });

  it('ignores archived artifacts when determining state', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc', status: 'archived', isStale: true }),
      ],
    };
    // Archived artifact should be ignored, so no deliverables
    expect(deriveDeliverState(input)).toBe('ready_no_deliverables');
  });

  it('handles null contextHealth as blocked', () => {
    const input: DeliverDataInput = {
      contextHealth: null,
      strategyId: 'strategy-123',
      artifacts: [],
    };
    expect(deriveDeliverState(input)).toBe('blocked_no_labs');
  });
});

// ============================================================================
// Banner Tests
// ============================================================================

describe('getDeliverUIState banner', () => {
  it('shows blocked banner when no labs', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.banner.tone).toBe('blocked');
    expect(state.banner.title).toBe('Run labs first');
  });

  it('shows ready banner when ready to create', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.banner.tone).toBe('ready');
    expect(state.banner.title).toBe('Ready to create deliverables');
  });

  it('shows status banner when up to date', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc', isStale: false })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.banner.tone).toBe('status');
    expect(state.banner.title).toBe('Deliverables up to date');
  });

  it('shows warning banner when updates available', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc', isStale: true })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.banner.tone).toBe('warning');
    expect(state.banner.title).toBe('Updates available');
  });
});

// ============================================================================
// CTA Tests
// ============================================================================

describe('getDeliverUIState primaryCTA', () => {
  it('returns "Go to Discover" when blocked_no_labs', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Go to Discover');
    expect(state.primaryCTA.href).toBe('/c/test-company/diagnostics');
  });

  it('returns "Go to Decide" when blocked_not_decided', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 2 }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Go to Decide');
    expect(state.primaryCTA.href).toBe('/c/test-company/decide');
  });

  it('returns "View Artifacts" when ready_no_deliverables', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('View Artifacts');
    expect(state.primaryCTA.href).toBe('/c/test-company/deliver/artifacts');
  });

  it('returns "Create a Plan" as secondary CTA when ready_no_deliverables', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.secondaryCTA).not.toBeNull();
    expect(state.secondaryCTA?.label).toBe('Create a Plan');
    expect(state.secondaryCTA?.href).toBe('#plans');
  });

  it('returns "Open Primary Deliverable" when ready_up_to_date with artifact', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc', googleFileUrl: 'https://docs.google.com/test' })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Open Primary Deliverable');
    expect(state.primaryCTA.href).toBe('https://docs.google.com/test');
  });

  it('returns "Insert Updates" when stale updatable doc exists', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ id: 'rfp-1', type: 'rfp_response_doc', isStale: true }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Insert Updates');
    expect(state.primaryCTA.href).toContain('/rfp/rfp-1/update');
  });

  it('falls back to View Deliverables when stale but no primary doc type', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({
          type: 'proposal_slides',
          isStale: true,
          googleFileUrl: 'https://docs.google.com/slides',
        }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    // proposal_slides is not a primary type (rfp/strategy), so falls back to View
    expect(state.primaryCTA.label).toBe('View Deliverables');
  });

  it('falls back to Open Primary when stale strategy_doc but not updatable type stale', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({
          type: 'strategy_doc',
          isStale: false,
          googleFileUrl: 'https://docs.google.com/doc/123',
        }),
        makeArtifact({
          type: 'proposal_slides',
          isStale: true,
        }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    // Has primary doc (strategy_doc) that's not stale, but proposal_slides is stale
    // Still shows warning but CTA is Open since updatable doc isn't stale
    expect(state.primaryCTA.label).toBe('Open Primary Deliverable');
  });
});

// ============================================================================
// Preferred Primary Tests
// ============================================================================

describe('getDeliverUIState preferredPrimary', () => {
  it('prefers rfp_response_doc over strategy_doc', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc' }),
        makeArtifact({ type: 'rfp_response_doc' }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.preferredPrimary).toBe('rfp_response_doc');
  });

  it('returns strategy_doc when no rfp exists', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc' })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.preferredPrimary).toBe('strategy_doc');
  });

  it('returns null when no deliverables', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.preferredPrimary).toBeNull();
  });

  it('ignores archived artifacts', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'rfp_response_doc', status: 'archived' }),
        makeArtifact({ type: 'strategy_doc', status: 'final' }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    // RFP is archived, so strategy_doc should be preferred
    expect(state.preferredPrimary).toBe('strategy_doc');
  });
});

// ============================================================================
// Staleness Summary Tests
// ============================================================================

describe('getDeliverUIState staleSummary', () => {
  it('reports no stale when all current', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc', isStale: false }),
        makeArtifact({ type: 'rfp_response_doc', isStale: false }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.staleSummary.hasAnyStale).toBe(false);
    expect(state.staleSummary.staleCount).toBe(0);
  });

  it('reports stale count correctly', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'strategy_doc', isStale: true }),
        makeArtifact({ type: 'rfp_response_doc', isStale: true }),
        makeArtifact({ type: 'proposal_slides', isStale: false }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.staleSummary.hasAnyStale).toBe(true);
    expect(state.staleSummary.staleCount).toBe(2);
  });

  it('identifies stale updatable doc', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ id: 'stale-rfp', type: 'rfp_response_doc', isStale: true }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.staleSummary.hasStaleUpdatableDoc).toBe(true);
    expect(state.staleSummary.staleUpdatableArtifact?.id).toBe('stale-rfp');
  });

  it('returns false for hasStaleUpdatableDoc when only non-updatable types are stale', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [
        makeArtifact({ type: 'proposal_slides', isStale: true }),
        makeArtifact({ type: 'pricing_sheet', isStale: true }),
      ],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.staleSummary.hasAnyStale).toBe(true);
    expect(state.staleSummary.hasStaleUpdatableDoc).toBe(false);
  });
});

// ============================================================================
// Visibility Tests
// ============================================================================

describe('getDeliverUIState visibility', () => {
  it('hides primary deliverables when blocked', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showPrimaryDeliverables).toBe(false);
  });

  it('shows primary deliverables when ready', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showPrimaryDeliverables).toBe(true);
  });

  it('always shows artifacts list', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showArtifactsList).toBe(true);
  });

  it('hides updates help when blocked_no_labs', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyId: null,
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showUpdatesHelp).toBe('hidden');
  });

  it('expands updates help when updates available', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc', isStale: true })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showUpdatesHelp).toBe('expanded');
  });

  it('collapses updates help when ready but no stale', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc', isStale: false })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.showUpdatesHelp).toBe('collapsed');
  });
});

// ============================================================================
// Debug Info Tests
// ============================================================================

describe('getDeliverUIState debug', () => {
  it('provides accurate debug info', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: 'strategy-123',
      artifacts: [makeArtifact({ type: 'strategy_doc' })],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.debug.hasLabs).toBe(true);
    expect(state.debug.inputsConfirmed).toBe(true);
    expect(state.debug.strategyFramed).toBe(true);
    expect(state.debug.decideComplete).toBe(true);
    expect(state.debug.hasAnyDeliverables).toBe(true);
  });
});

// ============================================================================
// Blocked State Invariant Tests
// Critical: inputsConfirmed=false should NEVER produce ready_* states
// ============================================================================

describe('blocked state invariant: inputsConfirmed=false prevents ready states', () => {
  const READY_STATES = ['ready_no_deliverables', 'ready_up_to_date', 'ready_updates_available'];

  it('never returns ready_no_deliverables when confirmed < 3', () => {
    // Test all confirmed values from 0 to 2
    for (let confirmed = 0; confirmed < 3; confirmed++) {
      const input: DeliverDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed }),
        strategyId: 'strategy-123', // Even with strategy, should be blocked
        artifacts: [],
      };
      const state = getDeliverUIState(input, 'test-company');
      expect(state.state).toBe('blocked_not_decided');
      expect(state.debug.inputsConfirmed).toBe(false);
      expect(READY_STATES).not.toContain(state.state);
    }
  });

  it('never returns ready_up_to_date when confirmed < 3', () => {
    for (let confirmed = 0; confirmed < 3; confirmed++) {
      const input: DeliverDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed }),
        strategyId: 'strategy-123',
        artifacts: [makeArtifact({ type: 'strategy_doc', isStale: false })],
      };
      const state = getDeliverUIState(input, 'test-company');
      expect(state.state).toBe('blocked_not_decided');
      expect(state.debug.inputsConfirmed).toBe(false);
    }
  });

  it('never returns ready_updates_available when confirmed < 3', () => {
    for (let confirmed = 0; confirmed < 3; confirmed++) {
      const input: DeliverDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed }),
        strategyId: 'strategy-123',
        artifacts: [makeArtifact({ type: 'strategy_doc', isStale: true })],
      };
      const state = getDeliverUIState(input, 'test-company');
      expect(state.state).toBe('blocked_not_decided');
      expect(state.debug.inputsConfirmed).toBe(false);
    }
  });

  it('never returns ready_no_deliverables when labs have not run', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: false, confirmed: 0 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.state).toBe('blocked_no_labs');
    expect(READY_STATES).not.toContain(state.state);
  });

  it('returns blocked_not_decided when strategyId is missing even with enough confirmed', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyId: null, // Missing strategy
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.state).toBe('blocked_not_decided');
    expect(state.debug.strategyFramed).toBe(false);
  });

  it('transitions to ready_no_deliverables ONLY when all conditions met', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }), // hasLabs + inputsConfirmed
      strategyId: 'strategy-123', // strategyFramed
      artifacts: [], // no deliverables
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.state).toBe('ready_no_deliverables');
    expect(state.debug.hasLabs).toBe(true);
    expect(state.debug.inputsConfirmed).toBe(true);
    expect(state.debug.strategyFramed).toBe(true);
    expect(state.debug.decideComplete).toBe(true);
  });

  it('showPrimaryDeliverables is false when blocked_not_decided', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 2 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.state).toBe('blocked_not_decided');
    expect(state.showPrimaryDeliverables).toBe(false);
  });

  it('provides correct blocked reason for confirmed count < 3', () => {
    const input: DeliverDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 1 }),
      strategyId: 'strategy-123',
      artifacts: [],
    };
    const state = getDeliverUIState(input, 'test-company');
    expect(state.banner.tone).toBe('blocked');
    // Banner title may be "Confirm more inputs" or "Complete Decide phase" depending on what's missing
    expect(['Confirm more inputs', 'Complete Decide phase']).toContain(state.banner.title);
    expect(state.primaryCTA.label).toBe('Go to Decide');
  });
});
