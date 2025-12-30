// tests/os/decideUiState.test.ts
// Unit tests for Decide UI state selector
//
// V11+: Labs are NEVER blocking. State is based on strategy existence only.

import { describe, it, expect } from 'vitest';
import {
  deriveDecideState,
  getDecideUIState,
  sanitizeActiveTab,
  sanitizeActiveSubView,
  type DecideDataInput,
  type DecideSubView,
} from '@/lib/os/ui/decideUiState';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

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

// ============================================================================
// State Derivation Tests (V11+ simplified states)
// ============================================================================

describe('deriveDecideState', () => {
  describe('V11+ simplified state machine', () => {
    it('returns no_strategy when no strategy exists (regardless of labs)', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      expect(deriveDecideState(input)).toBe('no_strategy');
    });

    it('returns no_strategy even when labs have run but no strategy', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 5 }),
        strategyExists: false,
      };
      expect(deriveDecideState(input)).toBe('no_strategy');
    });

    it('returns strategy_draft when strategy exists but not locked', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
        strategyLocked: false,
      };
      expect(deriveDecideState(input)).toBe('strategy_draft');
    });

    it('returns strategy_draft when strategy exists with labs (not locked)', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 10 }),
        strategyExists: true,
        strategyLocked: false,
      };
      expect(deriveDecideState(input)).toBe('strategy_draft');
    });

    it('returns strategy_locked when strategy is locked', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
        strategyExists: true,
        strategyLocked: true,
      };
      expect(deriveDecideState(input)).toBe('strategy_locked');
    });

    it('returns strategy_locked regardless of labs status', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
        strategyLocked: true,
      };
      expect(deriveDecideState(input)).toBe('strategy_locked');
    });

    it('handles null contextHealth without blocking', () => {
      const input: DecideDataInput = {
        contextHealth: null,
        strategyExists: false,
      };
      expect(deriveDecideState(input)).toBe('no_strategy');
    });

    it('handles null contextHealth with strategy', () => {
      const input: DecideDataInput = {
        contextHealth: null,
        strategyExists: true,
        strategyLocked: false,
      };
      expect(deriveDecideState(input)).toBe('strategy_draft');
    });
  });

  describe('imported strategy (V11+ no special bypass needed)', () => {
    it('returns strategy_draft for imported strategy (not locked)', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
        strategyOrigin: 'imported',
      };
      expect(deriveDecideState(input)).toBe('strategy_draft');
    });

    it('returns strategy_locked for imported strategy (locked)', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
        strategyLocked: true,
        strategyOrigin: 'imported',
      };
      expect(deriveDecideState(input)).toBe('strategy_locked');
    });
  });
});

// ============================================================================
// Tab Visibility Tests (V11+ all context tabs always visible)
// ============================================================================

describe('getDecideUIState tabs', () => {
  it('shows context tabs (map, table, fields) when no strategy', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    const visibleIds = state.visibleTabs.map(t => t.id);
    expect(visibleIds).toContain('map');
    expect(visibleIds).toContain('table');
    expect(visibleIds).toContain('fields');
    expect(visibleIds).not.toContain('review'); // No strategy yet
  });

  it('shows context tabs even without labs', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false, confirmed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.length).toBeGreaterThan(0);
    expect(state.visibleTabs.map(t => t.id)).toContain('fields');
  });

  it('shows review tab when strategy exists', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: true,
      strategyLocked: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toContain('review');
  });

  it('default tab is fields when no strategy', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.defaultTab).toBe('fields');
  });

  it('default tab is review when strategy exists', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyExists: true,
      strategyLocked: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.defaultTab).toBe('review');
  });

  it('review tab is readonly when strategy is locked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyExists: true,
      strategyLocked: true,
    };
    const state = getDecideUIState(input, 'test-company');
    const reviewTab = state.tabs.find(t => t.id === 'review');
    expect(reviewTab?.visibility).toBe('readonly');
  });
});

// ============================================================================
// CTA Tests (V11+ no blocking CTAs)
// ============================================================================

describe('getDecideUIState primaryCTA', () => {
  it('returns "Create Strategy" when no strategy exists', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Create Strategy');
    expect(state.primaryCTA?.href).toBe('/c/test-company/strategy');
  });

  it('returns "Review & Finalize" when strategy is draft', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyExists: true,
      strategyLocked: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Review & Finalize');
  });

  it('returns "Go to Deliver" when strategy is locked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
      strategyExists: true,
      strategyLocked: true,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Go to Deliver');
    expect(state.primaryCTA?.href).toBe('/c/test-company/deliver');
  });

  it('no blocking CTA even without labs', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    // Should have a CTA, not be blocked
    expect(state.primaryCTA).not.toBeNull();
    expect(state.primaryCTA?.label).not.toBe('Go to Discover');
  });
});

// ============================================================================
// UI Flags Tests (V11+ always available)
// ============================================================================

describe('getDecideUIState flags', () => {
  it('strategy link always shown', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showStrategyLink).toBe(true);
  });

  it('context checklist always shown', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showContextChecklist).toBe(true);
  });

  it('hasLabsRun is informational only', () => {
    const noLabs: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const withLabs: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true }),
      strategyExists: false,
    };

    const noLabsState = getDecideUIState(noLabs, 'test-company');
    const withLabsState = getDecideUIState(withLabs, 'test-company');

    expect(noLabsState.hasLabsRun).toBe(false);
    expect(withLabsState.hasLabsRun).toBe(true);

    // Both should have same state - labs don't affect state
    expect(noLabsState.state).toBe(withLabsState.state);
  });

  it('isImported flag is set correctly', () => {
    const imported: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: true,
      strategyOrigin: 'imported',
    };
    const generated: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true }),
      strategyExists: true,
      strategyOrigin: 'generated',
    };

    const importedState = getDecideUIState(imported, 'test-company');
    const generatedState = getDecideUIState(generated, 'test-company');

    expect(importedState.isImported).toBe(true);
    expect(generatedState.isImported).toBe(false);
  });
});

// ============================================================================
// Context Banner Tests (V11+ informational)
// ============================================================================

describe('getDecideUIState contextBanner', () => {
  it('shows info banner when no context and no labs', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false, confirmed: 0, proposed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.contextBanner?.type).toBe('info');
    expect(state.contextBanner?.showLabsCTA).toBe(true);
  });

  it('shows warning banner when proposals pending', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.contextBanner?.type).toBe('warning');
    expect(state.contextBanner?.message).toContain('5 AI proposals');
  });

  it('shows success banner when context confirmed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 5, proposed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.contextBanner?.type).toBe('success');
  });

  it('shows imported banner for imported strategies', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: true,
      strategyOrigin: 'imported',
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.contextBanner?.type).toBe('info');
    expect(state.contextBanner?.message).toContain('imported');
  });
});

// ============================================================================
// Tab Sanitization Tests
// ============================================================================

describe('sanitizeActiveTab', () => {
  it('keeps current tab if visible', () => {
    const visibleTabs = [
      { id: 'table' as const, label: 'Table', visibility: 'primary' as const },
      { id: 'fields' as const, label: 'Fields', visibility: 'secondary' as const },
    ];
    expect(sanitizeActiveTab('fields', visibleTabs)).toBe('fields');
  });

  it('falls back to primary tab if current is hidden', () => {
    const visibleTabs = [
      { id: 'table' as const, label: 'Table', visibility: 'primary' as const },
      { id: 'fields' as const, label: 'Fields', visibility: 'secondary' as const },
    ];
    expect(sanitizeActiveTab('review', visibleTabs)).toBe('table');
  });

  it('falls back to first visible if no primary', () => {
    const visibleTabs = [
      { id: 'table' as const, label: 'Table', visibility: 'secondary' as const },
      { id: 'fields' as const, label: 'Fields', visibility: 'secondary' as const },
    ];
    expect(sanitizeActiveTab('review', visibleTabs)).toBe('table');
  });
});

// ============================================================================
// Sub-Navigation Tests (V11+ simplified)
// ============================================================================

describe('getDecideUIState subNav', () => {
  describe('defaultSubView derivation', () => {
    it('returns context as default when no strategy', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('context');
    });

    it('returns review as default when strategy exists', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
        strategyLocked: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('review');
    });

    it('returns review as default when strategy locked', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
        strategyExists: true,
        strategyLocked: true,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('review');
    });
  });

  describe('availability derivation', () => {
    it('context and strategy always available', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available.context).toBe(true);
      expect(state.subNav.available.strategy).toBe(true);
    });

    it('review only available when strategy exists', () => {
      const noStrategy: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const withStrategy: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: true,
      };

      const noStrategyState = getDecideUIState(noStrategy, 'test-company');
      const withStrategyState = getDecideUIState(withStrategy, 'test-company');

      expect(noStrategyState.subNav.available.review).toBe(false);
      expect(withStrategyState.subNav.available.review).toBe(true);
    });
  });

  describe('reasonIfBlocked', () => {
    it('returns reason when review unavailable', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.reasonIfBlocked).toBe('Create a strategy first');
    });

    it('returns undefined when all available', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3 }),
        strategyExists: true,
        strategyLocked: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.reasonIfBlocked).toBeUndefined();
    });
  });
});

// ============================================================================
// Sub-View Sanitization Tests
// ============================================================================

describe('sanitizeActiveSubView', () => {
  it('keeps current sub-view if available', () => {
    const uiState = {
      subNav: {
        active: 'context' as DecideSubView,
        default: 'context' as DecideSubView,
        available: { context: true, strategy: true, review: true },
      },
    };
    expect(sanitizeActiveSubView('strategy', uiState)).toBe('strategy');
  });

  it('falls back to default if current is unavailable', () => {
    const uiState = {
      subNav: {
        active: 'context' as DecideSubView,
        default: 'context' as DecideSubView,
        available: { context: true, strategy: true, review: false },
      },
    };
    expect(sanitizeActiveSubView('review', uiState)).toBe('context');
  });

  it('keeps context when navigating back from strategy', () => {
    const uiState = {
      subNav: {
        active: 'strategy' as DecideSubView,
        default: 'strategy' as DecideSubView,
        available: { context: true, strategy: true, review: true },
      },
    };
    expect(sanitizeActiveSubView('context', uiState)).toBe('context');
  });
});
