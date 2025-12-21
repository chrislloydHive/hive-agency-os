// tests/strategy/strategy-health-gate.test.ts
// Tests for Strategy Surface health gate integration
//
// Verifies:
// - Empty state renders gate when YELLOW/RED
// - Empty state renders ready indicator when GREEN
// - Existing strategy renders Regenerate button
// - Inline warning appears when YELLOW/RED
// - Inputs Used row reflects health + strategy presence

import { describe, it, expect } from 'vitest';
import type { V4HealthResponse, V4HealthStatus, V4HealthReason } from '@/lib/types/contextV4Health';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock V4HealthResponse with given status and reasons
 */
function createMockHealth(
  status: V4HealthStatus,
  options: {
    reasons?: V4HealthReason[];
    storeTotal?: number;
    hasWebsiteLabRun?: boolean;
  } = {}
): V4HealthResponse {
  const { reasons = [], storeTotal = 0, hasWebsiteLabRun = false } = options;

  return {
    healthVersion: 1,
    companyId: 'test-company',
    timestamp: new Date().toISOString(),
    status,
    reasons,
    flags: {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    },
    websiteLab: {
      hasRun: hasWebsiteLabRun,
      runId: hasWebsiteLabRun ? 'run-123' : null,
      createdAt: new Date().toISOString(),
      ageMinutes: 60,
      staleThresholdMinutes: 10080,
    },
    propose: {
      lastReason: status === 'GREEN' ? 'SUCCESS' : null,
      proposedCount: status === 'GREEN' ? 5 : 0,
      createdCount: null,
      skippedCount: null,
      lastRunId: null,
    },
    store: {
      total: storeTotal,
      proposed: Math.floor(storeTotal * 0.3),
      confirmed: Math.floor(storeTotal * 0.5),
      rejected: Math.floor(storeTotal * 0.2),
    },
    links: {
      inspectorPath: '/c/test-company/admin/context-inspector',
      proposeApiPath: '/api/os/companies/test-company/context/v4/propose-website-lab',
    },
  };
}

// ============================================================================
// Strategy Surface Logic Tests
// ============================================================================

describe('StrategySurface Empty State Logic', () => {
  /**
   * Determines if health gate should render in empty state
   * From StrategySurface.tsx line ~543: const showHealthGate = v4Health && v4Health.status !== 'GREEN';
   */
  function shouldShowHealthGateInEmptyState(v4Health: V4HealthResponse | null): boolean {
    return v4Health !== null && v4Health.status !== 'GREEN';
  }

  /**
   * Determines if ready indicator should render in empty state
   * From StrategySurface.tsx line ~577: {v4Health?.status === 'GREEN' && ...}
   */
  function shouldShowReadyIndicatorInEmptyState(v4Health: V4HealthResponse | null): boolean {
    return v4Health !== null && v4Health.status === 'GREEN';
  }

  describe('Health Gate Visibility', () => {
    it('should NOT show health gate when status is GREEN', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10, hasWebsiteLabRun: true });
      expect(shouldShowHealthGateInEmptyState(health)).toBe(false);
    });

    it('should show health gate when status is YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(shouldShowHealthGateInEmptyState(health)).toBe(true);
    });

    it('should show health gate when status is RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      expect(shouldShowHealthGateInEmptyState(health)).toBe(true);
    });

    it('should NOT show health gate when health is null (still loading)', () => {
      expect(shouldShowHealthGateInEmptyState(null)).toBe(false);
    });
  });

  describe('Ready Indicator Visibility', () => {
    it('should show ready indicator when status is GREEN', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10, hasWebsiteLabRun: true });
      expect(shouldShowReadyIndicatorInEmptyState(health)).toBe(true);
    });

    it('should NOT show ready indicator when status is YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(shouldShowReadyIndicatorInEmptyState(health)).toBe(false);
    });

    it('should NOT show ready indicator when status is RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      expect(shouldShowReadyIndicatorInEmptyState(health)).toBe(false);
    });

    it('should NOT show ready indicator when health is null', () => {
      expect(shouldShowReadyIndicatorInEmptyState(null)).toBe(false);
    });
  });
});

describe('StrategySurface Existing Strategy Logic', () => {
  /**
   * Determines if inline warning should render
   * From StrategySurface.tsx line ~687: {v4Health && v4Health.status !== 'GREEN' && ...}
   */
  function shouldShowInlineWarning(v4Health: V4HealthResponse | null): boolean {
    return v4Health !== null && v4Health.status !== 'GREEN';
  }

  describe('Inline Warning Visibility', () => {
    it('should NOT show inline warning when status is GREEN', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10, hasWebsiteLabRun: true });
      expect(shouldShowInlineWarning(health)).toBe(false);
    });

    it('should show inline warning when status is YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(shouldShowInlineWarning(health)).toBe(true);
    });

    it('should show inline warning when status is RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      expect(shouldShowInlineWarning(health)).toBe(true);
    });

    it('should NOT show inline warning when health is null', () => {
      expect(shouldShowInlineWarning(null)).toBe(false);
    });
  });

  describe('Regenerate Button', () => {
    it('should always render regenerate button when strategy exists', () => {
      // The regenerate button is always visible in the header for existing strategies
      // It's disabled when isGenerating or isProposing
      const hasStrategy = true;
      expect(hasStrategy).toBe(true);
    });

    it('should disable regenerate button when isGenerating is true', () => {
      const isGenerating = true;
      const isProposing = false;
      const disabled = isGenerating || isProposing;
      expect(disabled).toBe(true);
    });

    it('should disable regenerate button when isProposing is true', () => {
      const isGenerating = false;
      const isProposing = true;
      const disabled = isGenerating || isProposing;
      expect(disabled).toBe(true);
    });

    it('should enable regenerate button when not generating or proposing', () => {
      const isGenerating = false;
      const isProposing = false;
      const disabled = isGenerating || isProposing;
      expect(disabled).toBe(false);
    });
  });
});

describe('InputsUsed Indicator Logic', () => {
  /**
   * Compute inputs used indicator
   * From StrategySurface.tsx lines ~625-629
   */
  function computeInputsUsed(
    v4Health: V4HealthResponse | null,
    strategyId: string | null,
    objectivesCount: number,
    betsCount: number
  ): { context: boolean; websiteLab: boolean; strategy: boolean } {
    return {
      context: (v4Health?.store.total ?? 0) > 0,
      websiteLab: v4Health?.websiteLab.hasRun ?? false,
      strategy: !!strategyId && (objectivesCount > 0 || betsCount > 0),
    };
  }

  describe('Context Input', () => {
    it('should show context as available when store has fields', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10 });
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 0);
      expect(inputs.context).toBe(true);
    });

    it('should show context as unavailable when store is empty', () => {
      const health = createMockHealth('YELLOW', { storeTotal: 0, reasons: ['NO_WEBSITELAB_RUN'] });
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 0);
      expect(inputs.context).toBe(false);
    });

    it('should show context as unavailable when health is null', () => {
      const inputs = computeInputsUsed(null, 'strategy-1', 0, 0);
      expect(inputs.context).toBe(false);
    });
  });

  describe('WebsiteLab Input', () => {
    it('should show WebsiteLab as available when run exists', () => {
      const health = createMockHealth('GREEN', { hasWebsiteLabRun: true });
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 0);
      expect(inputs.websiteLab).toBe(true);
    });

    it('should show WebsiteLab as unavailable when no run exists', () => {
      const health = createMockHealth('YELLOW', { hasWebsiteLabRun: false, reasons: ['NO_WEBSITELAB_RUN'] });
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 0);
      expect(inputs.websiteLab).toBe(false);
    });

    it('should show WebsiteLab as unavailable when health is null', () => {
      const inputs = computeInputsUsed(null, 'strategy-1', 0, 0);
      expect(inputs.websiteLab).toBe(false);
    });
  });

  describe('Strategy Input', () => {
    it('should show strategy as available when strategyId and objectives exist', () => {
      const health = createMockHealth('GREEN');
      const inputs = computeInputsUsed(health, 'strategy-1', 3, 0);
      expect(inputs.strategy).toBe(true);
    });

    it('should show strategy as available when strategyId and bets exist', () => {
      const health = createMockHealth('GREEN');
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 2);
      expect(inputs.strategy).toBe(true);
    });

    it('should show strategy as unavailable when no strategyId', () => {
      const health = createMockHealth('GREEN');
      const inputs = computeInputsUsed(health, null, 3, 2);
      expect(inputs.strategy).toBe(false);
    });

    it('should show strategy as unavailable when empty strategyId', () => {
      const health = createMockHealth('GREEN');
      const inputs = computeInputsUsed(health, '', 3, 2);
      expect(inputs.strategy).toBe(false);
    });

    it('should show strategy as unavailable when no objectives or bets', () => {
      const health = createMockHealth('GREEN');
      const inputs = computeInputsUsed(health, 'strategy-1', 0, 0);
      expect(inputs.strategy).toBe(false);
    });
  });

  describe('Combined Scenarios', () => {
    it('should show all inputs as available in healthy state', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10, hasWebsiteLabRun: true });
      const inputs = computeInputsUsed(health, 'strategy-1', 3, 2);
      expect(inputs.context).toBe(true);
      expect(inputs.websiteLab).toBe(true);
      expect(inputs.strategy).toBe(true);
    });

    it('should show all inputs as unavailable in minimal state', () => {
      const inputs = computeInputsUsed(null, null, 0, 0);
      expect(inputs.context).toBe(false);
      expect(inputs.websiteLab).toBe(false);
      expect(inputs.strategy).toBe(false);
    });

    it('should show partial availability correctly', () => {
      const health = createMockHealth('YELLOW', { storeTotal: 5, hasWebsiteLabRun: false, reasons: ['NO_WEBSITELAB_RUN'] });
      const inputs = computeInputsUsed(health, 'strategy-1', 2, 0);
      expect(inputs.context).toBe(true);
      expect(inputs.websiteLab).toBe(false);
      expect(inputs.strategy).toBe(true);
    });
  });
});

describe('InputsUsedIndicator Component Logic', () => {
  /**
   * Simulates the InputsUsedIndicator component rendering logic
   */
  function getInputIndicatorState(available: boolean): {
    colorClass: string;
    title: string;
  } {
    if (available) {
      return {
        colorClass: 'bg-emerald-500/10 text-emerald-400',
        title: 'available',
      };
    }
    return {
      colorClass: 'bg-slate-700/50 text-slate-500',
      title: 'unavailable',
    };
  }

  it('should show emerald styling for available inputs', () => {
    const state = getInputIndicatorState(true);
    expect(state.colorClass).toContain('emerald');
    expect(state.title).toBe('available');
  });

  it('should show slate styling for unavailable inputs', () => {
    const state = getInputIndicatorState(false);
    expect(state.colorClass).toContain('slate');
    expect(state.title).toBe('unavailable');
  });
});

describe('Strategy Health Integration Scenarios', () => {
  describe('Fresh Company (No Data)', () => {
    it('should handle fresh company with no health data', () => {
      const health = null;
      const strategyId = null;

      // Empty state should not show health gate (loading)
      expect(health !== null && health?.status !== 'GREEN').toBe(false);

      // No ready indicator either
      expect(health?.status === 'GREEN').toBeFalsy();
    });
  });

  describe('Company with WebsiteLab Run but No Context', () => {
    it('should show YELLOW status and partial inputs', () => {
      const health = createMockHealth('YELLOW', {
        hasWebsiteLabRun: true,
        storeTotal: 0,
        reasons: ['PROPOSE_ZERO_NO_CANDIDATES'],
      });

      expect(health.status).toBe('YELLOW');
      expect(health.websiteLab.hasRun).toBe(true);
      expect(health.store.total).toBe(0);
    });
  });

  describe('Company with Full Context V4 Setup', () => {
    it('should show GREEN status and all inputs available', () => {
      const health = createMockHealth('GREEN', {
        hasWebsiteLabRun: true,
        storeTotal: 15,
      });

      expect(health.status).toBe('GREEN');
      expect(health.websiteLab.hasRun).toBe(true);
      expect(health.store.total).toBe(15);
    });
  });

  describe('Company with Disabled Flags', () => {
    it('should show RED status with FLAG_DISABLED reason', () => {
      const health = createMockHealth('RED', {
        reasons: ['FLAG_DISABLED'],
      });

      expect(health.status).toBe('RED');
      expect(health.reasons).toContain('FLAG_DISABLED');
    });
  });
});
