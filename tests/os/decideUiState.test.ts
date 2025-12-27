// tests/os/decideUiState.test.ts
// Unit tests for Decide UI state selector

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
// State Derivation Tests
// ============================================================================

describe('deriveDecideState', () => {
  it('returns blocked_no_labs when labs have not run', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    expect(deriveDecideState(input)).toBe('blocked_no_labs');
  });

  it('returns context_proposed when labs run but 0 confirmed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    expect(deriveDecideState(input)).toBe('context_proposed');
  });

  it('returns context_confirming when some confirmed but < 3', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 2, proposed: 3 }),
      strategyExists: false,
    };
    expect(deriveDecideState(input)).toBe('context_confirming');
  });

  it('returns inputs_confirmed when >= 3 confirmed and no strategy', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: false,
    };
    expect(deriveDecideState(input)).toBe('inputs_confirmed');
  });

  it('returns strategy_framing when strategy exists but not locked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: false,
    };
    expect(deriveDecideState(input)).toBe('strategy_framing');
  });

  it('returns strategy_locked when strategy is locked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: true,
    };
    expect(deriveDecideState(input)).toBe('strategy_locked');
  });

  it('handles null contextHealth as blocked', () => {
    const input: DecideDataInput = {
      contextHealth: null,
      strategyExists: false,
    };
    expect(deriveDecideState(input)).toBe('blocked_no_labs');
  });
});

// ============================================================================
// Tab Visibility Tests (Authoritative Matrix)
// ============================================================================

describe('getDecideUIState tabs', () => {
  it('hides all tabs when blocked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs).toHaveLength(0);
  });

  it('shows table and fields when context_proposed, default table', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toEqual(['table', 'fields']);
    expect(state.defaultTab).toBe('table');
  });

  it('shows map, table, fields when context_confirming, default fields', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 2, proposed: 3 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toEqual(['map', 'table', 'fields']);
    expect(state.defaultTab).toBe('fields');
  });

  it('shows only review when inputs_confirmed, default review', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toEqual(['review']);
    expect(state.defaultTab).toBe('review');
  });

  it('shows only review when strategy_framing, default review', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toEqual(['review']);
    expect(state.defaultTab).toBe('review');
  });

  it('shows only review (readonly) when strategy_locked, default review', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: true,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.visibleTabs.map(t => t.id)).toEqual(['review']);
    expect(state.visibleTabs[0].visibility).toBe('readonly');
    expect(state.defaultTab).toBe('review');
  });

  it('map only appears in context_confirming as secondary', () => {
    // context_proposed: no map
    const proposed: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    expect(getDecideUIState(proposed, 'c').visibleTabs.map(t => t.id)).not.toContain('map');

    // context_confirming: map is secondary
    const confirming: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 1, proposed: 5 }),
      strategyExists: false,
    };
    const confirmingState = getDecideUIState(confirming, 'c');
    const mapTab = confirmingState.tabs.find(t => t.id === 'map');
    expect(mapTab?.visibility).toBe('secondary');

    // inputs_confirmed: no map
    const confirmed: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: false,
    };
    expect(getDecideUIState(confirmed, 'c').visibleTabs.map(t => t.id)).not.toContain('map');
  });
});

// ============================================================================
// CTA Tests (Authoritative CTAs)
// ============================================================================

describe('getDecideUIState primaryCTA', () => {
  it('returns "Go to Discover" when blocked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Go to Discover');
    expect(state.primaryCTA?.href).toBe('/c/test-company/diagnostics');
  });

  it('returns "Confirm Inputs" when context_proposed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Confirm Inputs');
    expect(state.primaryCTA?.href).toBe('/c/test-company/context');
  });

  it('returns "Confirm Remaining Inputs" when context_confirming', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 1, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Confirm Remaining Inputs');
    expect(state.primaryCTA?.href).toBe('/c/test-company/context');
  });

  it('returns "Save Strategy Framing" when inputs_confirmed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Save Strategy Framing');
    expect(state.primaryCTA?.href).toBe('/c/test-company/strategy');
  });

  it('returns "Finalize Strategy" when strategy_framing', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Finalize Strategy');
    expect(state.primaryCTA?.href).toBe('/c/test-company/strategy');
  });

  it('returns "Go to Deliver" when strategy_locked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: true,
      strategyLocked: true,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.primaryCTA?.label).toBe('Go to Deliver');
    expect(state.primaryCTA?.href).toBe('/c/test-company/deliver');
  });
});

// ============================================================================
// UI Flags Tests
// ============================================================================

describe('getDecideUIState flags', () => {
  it('hides strategy link when blocked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showStrategyLink).toBe(false);
  });

  it('hides strategy link when context_proposed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showStrategyLink).toBe(false);
  });

  it('shows strategy link when inputs_confirmed', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showStrategyLink).toBe(true);
  });

  it('hides checklist when blocked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: false }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showContextChecklist).toBe(false);
  });

  it('shows checklist when not blocked', () => {
    const input: DecideDataInput = {
      contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
      strategyExists: false,
    };
    const state = getDecideUIState(input, 'test-company');
    expect(state.showContextChecklist).toBe(true);
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
    expect(sanitizeActiveTab('map', visibleTabs)).toBe('table');
  });

  it('falls back to first visible if no primary', () => {
    const visibleTabs = [
      { id: 'table' as const, label: 'Table', visibility: 'secondary' as const },
      { id: 'fields' as const, label: 'Fields', visibility: 'secondary' as const },
    ];
    expect(sanitizeActiveTab('map', visibleTabs)).toBe('table');
  });

  it('handles review-only state', () => {
    const visibleTabs = [
      { id: 'review' as const, label: 'Review', visibility: 'primary' as const },
    ];
    expect(sanitizeActiveTab('table', visibleTabs)).toBe('review');
  });
});

// ============================================================================
// Sub-Navigation Tests
// ============================================================================

describe('getDecideUIState subNav', () => {
  describe('defaultSubView derivation', () => {
    it('returns context as default when blocked_no_labs', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('context');
    });

    it('returns context as default when context_proposed', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('context');
    });

    it('returns context as default when context_confirming', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 1, proposed: 5 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('context');
    });

    it('returns strategy as default when inputs_confirmed', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('strategy');
    });

    it('returns strategy as default when strategy_framing', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: true,
        strategyLocked: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('strategy');
    });

    it('returns review as default when strategy_locked', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: true,
        strategyLocked: true,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.default).toBe('review');
    });
  });

  describe('availability derivation', () => {
    it('only context available when blocked_no_labs', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: false }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: false,
        review: false,
      });
    });

    it('only context available when context_proposed', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 0, proposed: 5 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: false,
        review: false,
      });
    });

    it('only context available when context_confirming', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 1, proposed: 5 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: false,
        review: false,
      });
    });

    it('context and strategy available when inputs_confirmed', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: true,
        review: false,
      });
    });

    it('all sub-views available when strategy_framing', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: true,
        strategyLocked: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: true,
        review: true,
      });
    });

    it('all sub-views available when strategy_locked', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: true,
        strategyLocked: true,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.available).toEqual({
        context: true,
        strategy: true,
        review: true,
      });
    });
  });

  describe('reasonIfBlocked', () => {
    it('returns "Confirm inputs first" when strategy unavailable', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 1, proposed: 5 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.reasonIfBlocked).toBe('Confirm inputs first');
    });

    it('returns "Complete strategy framing first" when only review unavailable', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
        strategyExists: false,
      };
      const state = getDecideUIState(input, 'test-company');
      expect(state.subNav.reasonIfBlocked).toBe('Complete strategy framing first');
    });

    it('returns undefined when all sub-views available', () => {
      const input: DecideDataInput = {
        contextHealth: makeHealth({ hasRun: true, confirmed: 3, proposed: 0 }),
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
        available: { context: true, strategy: false, review: false },
      },
    };
    expect(sanitizeActiveSubView('strategy', uiState)).toBe('context');
  });

  it('falls back to default if review is unavailable', () => {
    const uiState = {
      subNav: {
        active: 'strategy' as DecideSubView,
        default: 'strategy' as DecideSubView,
        available: { context: true, strategy: true, review: false },
      },
    };
    expect(sanitizeActiveSubView('review', uiState)).toBe('strategy');
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
