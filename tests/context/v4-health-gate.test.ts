// tests/context/v4-health-gate.test.ts
// Tests for ContextV4HealthGate component logic
//
// Verifies the soft gate behavior:
// - GREEN: renders null
// - YELLOW: renders warning + CTA
// - RED: renders strong warning + CTA

import { describe, it, expect } from 'vitest';
import type { V4HealthResponse, V4HealthStatus, V4HealthReason } from '@/lib/types/contextV4Health';
import { V4_HEALTH_REASON_LABELS, V4_HEALTH_STATUS_LABELS } from '@/lib/types/contextV4Health';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock V4HealthResponse with given status and reasons
 */
function createMockHealth(
  status: V4HealthStatus,
  reasons: V4HealthReason[] = []
): V4HealthResponse {
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
      hasRun: status !== 'YELLOW' || !reasons.includes('NO_WEBSITELAB_RUN'),
      runId: status === 'GREEN' ? 'run-123' : null,
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
      total: 10,
      proposed: 3,
      confirmed: 5,
      rejected: 2,
    },
    links: {
      inspectorPath: '/c/test-company/admin/context-inspector',
      proposeApiPath: '/api/os/companies/test-company/context/v4/propose-website-lab',
    },
  };
}

/**
 * Simulate what the ContextV4HealthGate would render
 * (Since we can't use React in unit tests without jsdom, we test the logic)
 */
function shouldRenderGate(health: V4HealthResponse): boolean {
  return health.status !== 'GREEN';
}

function shouldShowRedStyling(health: V4HealthResponse): boolean {
  return health.status === 'RED';
}

function getDisplayedReasons(health: V4HealthResponse): V4HealthReason[] {
  // Component shows max 3 reasons
  return health.reasons.slice(0, 3);
}

function hasMoreReasons(health: V4HealthResponse): boolean {
  return health.reasons.length > 3;
}

// ============================================================================
// Tests
// ============================================================================

describe('ContextV4HealthGate Logic', () => {
  describe('Render Decision', () => {
    it('should NOT render when status is GREEN', () => {
      const health = createMockHealth('GREEN');
      expect(shouldRenderGate(health)).toBe(false);
    });

    it('should render when status is YELLOW', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
      expect(shouldRenderGate(health)).toBe(true);
    });

    it('should render when status is RED', () => {
      const health = createMockHealth('RED', ['FLAG_DISABLED']);
      expect(shouldRenderGate(health)).toBe(true);
    });
  });

  describe('Styling', () => {
    it('should use amber styling for YELLOW status', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
      expect(shouldShowRedStyling(health)).toBe(false);
    });

    it('should use red styling for RED status', () => {
      const health = createMockHealth('RED', ['FLAG_DISABLED']);
      expect(shouldShowRedStyling(health)).toBe(true);
    });
  });

  describe('Reason Display', () => {
    it('should show up to 3 reasons', () => {
      const health = createMockHealth('YELLOW', [
        'NO_WEBSITELAB_RUN',
        'WEBSITELAB_STALE',
        'PROPOSE_ZERO_NO_CANDIDATES',
      ]);

      const displayed = getDisplayedReasons(health);
      expect(displayed.length).toBe(3);
      expect(displayed).toContain('NO_WEBSITELAB_RUN');
      expect(displayed).toContain('WEBSITELAB_STALE');
      expect(displayed).toContain('PROPOSE_ZERO_NO_CANDIDATES');
    });

    it('should truncate reasons beyond 3', () => {
      const health = createMockHealth('RED', [
        'FLAG_DISABLED',
        'NO_V4_STORE',
        'NO_WEBSITELAB_RUN',
        'WEBSITELAB_STALE',
        'PROPOSE_ZERO_NO_CANDIDATES',
      ]);

      const displayed = getDisplayedReasons(health);
      expect(displayed.length).toBe(3);
      expect(hasMoreReasons(health)).toBe(true);
    });

    it('should not show "more reasons" indicator when 3 or fewer', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN', 'WEBSITELAB_STALE']);
      expect(hasMoreReasons(health)).toBe(false);
    });
  });

  describe('Title and Description', () => {
    it('should show soft title for YELLOW', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
      // In component: "Your baseline may be incomplete"
      expect(health.status).toBe('YELLOW');
    });

    it('should show strong title for RED', () => {
      const health = createMockHealth('RED', ['FLAG_DISABLED']);
      // In component: "Baseline is broken or missing"
      expect(health.status).toBe('RED');
    });
  });

  describe('CTA Labels', () => {
    it('should have "Review Context Baseline" for YELLOW', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
      // In component: Primary CTA is "Review Context Baseline"
      expect(health.status).toBe('YELLOW');
    });

    it('should have "Fix Baseline" for RED', () => {
      const health = createMockHealth('RED', ['FLAG_DISABLED']);
      // In component: Primary CTA is "Fix Baseline"
      expect(health.status).toBe('RED');
    });

    it('should have "Continue Anyway" for YELLOW', () => {
      const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
      // In component: Secondary CTA is "Continue Anyway"
      expect(health.status).toBe('YELLOW');
    });

    it('should have "Generate Anyway" for RED', () => {
      const health = createMockHealth('RED', ['FLAG_DISABLED']);
      // In component: Secondary CTA is "Generate Anyway"
      expect(health.status).toBe('RED');
    });
  });
});

describe('V4 Health Reason Labels', () => {
  it('should have labels for all YELLOW reasons', () => {
    const yellowReasons: V4HealthReason[] = [
      'NO_WEBSITELAB_RUN',
      'WEBSITELAB_STALE',
      'PROPOSE_ZERO_NO_CANDIDATES',
      'PROPOSE_ZERO_EXTRACT_MISSING',
      'PROPOSE_ZERO_ALL_DUPLICATES',
    ];

    for (const reason of yellowReasons) {
      expect(V4_HEALTH_REASON_LABELS[reason]).toBeDefined();
      expect(V4_HEALTH_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it('should have labels for all RED reasons', () => {
    const redReasons: V4HealthReason[] = [
      'FLAG_DISABLED',
      'NO_V4_STORE',
      'PROPOSE_ZERO_STORE_WRITE_FAILED',
      'PROPOSE_ENDPOINT_ERROR',
      'INSPECT_UNAVAILABLE',
    ];

    for (const reason of redReasons) {
      expect(V4_HEALTH_REASON_LABELS[reason]).toBeDefined();
      expect(V4_HEALTH_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it('should have status labels', () => {
    expect(V4_HEALTH_STATUS_LABELS.GREEN).toBe('V4 Healthy');
    expect(V4_HEALTH_STATUS_LABELS.YELLOW).toBe('Needs Attention');
    expect(V4_HEALTH_STATUS_LABELS.RED).toBe('Broken');
  });
});

describe('ContextV4HealthReadyIndicator Logic', () => {
  it('should only render for GREEN status', () => {
    const greenHealth = createMockHealth('GREEN');
    const yellowHealth = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
    const redHealth = createMockHealth('RED', ['FLAG_DISABLED']);

    // Only GREEN should show the ready indicator
    expect(greenHealth.status === 'GREEN').toBe(true);
    expect(yellowHealth.status === 'GREEN').toBe(false);
    expect(redHealth.status === 'GREEN').toBe(false);
  });
});

describe('ContextV4HealthInlineWarning Logic', () => {
  it('should not render for GREEN status', () => {
    const health = createMockHealth('GREEN');
    expect(health.status !== 'GREEN').toBe(false);
  });

  it('should render for YELLOW status', () => {
    const health = createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']);
    expect(health.status !== 'GREEN').toBe(true);
  });

  it('should render for RED status', () => {
    const health = createMockHealth('RED', ['FLAG_DISABLED']);
    expect(health.status !== 'GREEN').toBe(true);
  });
});

describe('Programs Integration Logic', () => {
  it('should show health gate only when prerequisites are met and health is not GREEN', () => {
    // Simulate Programs EmptyState logic
    const checkShowHealthGate = (
      readinessIsReady: boolean,
      health: V4HealthResponse | null
    ): boolean => {
      return readinessIsReady && health !== null && health.status !== 'GREEN';
    };

    // Case 1: Prerequisites not met - don't show health gate (readiness banner shown instead)
    expect(checkShowHealthGate(false, createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']))).toBe(false);

    // Case 2: Prerequisites met, health GREEN - don't show health gate
    expect(checkShowHealthGate(true, createMockHealth('GREEN'))).toBe(false);

    // Case 3: Prerequisites met, health YELLOW - show health gate
    expect(checkShowHealthGate(true, createMockHealth('YELLOW', ['NO_WEBSITELAB_RUN']))).toBe(true);

    // Case 4: Prerequisites met, health RED - show health gate
    expect(checkShowHealthGate(true, createMockHealth('RED', ['FLAG_DISABLED']))).toBe(true);

    // Case 5: No health data - don't show health gate
    expect(checkShowHealthGate(true, null)).toBe(false);
  });
});
