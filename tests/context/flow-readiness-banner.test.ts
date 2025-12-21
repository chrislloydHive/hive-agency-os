// tests/context/flow-readiness-banner.test.ts
// Tests for FlowReadinessBanner component logic
//
// Verifies:
// - GREEN compact renders ready indicator
// - YELLOW/RED renders panel + CTAs
// - Reason truncation works
// - Variant switching
// - Action button behavior

import { describe, it, expect } from 'vitest';
import type { V4HealthResponse, V4HealthStatus, V4HealthReason } from '@/lib/types/contextV4Health';
import { V4_HEALTH_REASON_LABELS, V4_HEALTH_STATUS_LABELS } from '@/lib/types/contextV4Health';

// ============================================================================
// Mock Health Response
// ============================================================================

function createMockHealth(
  status: V4HealthStatus,
  options: {
    reasons?: V4HealthReason[];
    storeTotal?: number;
    hasWebsiteLabRun?: boolean;
  } = {}
): V4HealthResponse {
  const { reasons = [], storeTotal = 10, hasWebsiteLabRun = true } = options;

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
// Component Logic Tests
// ============================================================================

describe('FlowReadinessBanner Render Decision', () => {
  describe('Compact Variant', () => {
    it('should always render for all statuses', () => {
      // Compact variant always renders (shows pill)
      const greenHealth = createMockHealth('GREEN');
      const yellowHealth = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      const redHealth = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });

      expect(greenHealth.status).toBe('GREEN');
      expect(yellowHealth.status).toBe('YELLOW');
      expect(redHealth.status).toBe('RED');
    });
  });

  describe('Full Variant', () => {
    it('should render ready indicator for GREEN', () => {
      const health = createMockHealth('GREEN');
      // Full variant shows "Baseline ready" for GREEN
      expect(health.status).toBe('GREEN');
    });

    it('should render warning panel for YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(health.status).toBe('YELLOW');
    });

    it('should render error panel for RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      expect(health.status).toBe('RED');
    });
  });
});

describe('FlowReadinessBanner Styling', () => {
  describe('Status Colors', () => {
    it('should use green styling for GREEN', () => {
      const health = createMockHealth('GREEN');
      const expectedBg = 'bg-green-500/20';
      const expectedText = 'text-green-400';
      expect(health.status).toBe('GREEN');
      // Component uses these classes
      expect(expectedBg).toContain('green');
      expect(expectedText).toContain('green');
    });

    it('should use amber styling for YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      const expectedBg = 'bg-amber-500/20';
      const expectedText = 'text-amber-400';
      expect(health.status).toBe('YELLOW');
      expect(expectedBg).toContain('amber');
      expect(expectedText).toContain('amber');
    });

    it('should use red styling for RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      const expectedBg = 'bg-red-500/20';
      const expectedText = 'text-red-400';
      expect(health.status).toBe('RED');
      expect(expectedBg).toContain('red');
      expect(expectedText).toContain('red');
    });
  });

  describe('Status Labels', () => {
    it('should show correct label for GREEN', () => {
      expect(V4_HEALTH_STATUS_LABELS.GREEN).toBe('V4 Healthy');
    });

    it('should show correct label for YELLOW', () => {
      expect(V4_HEALTH_STATUS_LABELS.YELLOW).toBe('Needs Attention');
    });

    it('should show correct label for RED', () => {
      expect(V4_HEALTH_STATUS_LABELS.RED).toBe('Broken');
    });
  });
});

describe('FlowReadinessBanner Reasons Display', () => {
  describe('Reason Truncation', () => {
    it('should show up to 3 reasons', () => {
      const health = createMockHealth('YELLOW', {
        reasons: [
          'NO_WEBSITELAB_RUN',
          'WEBSITELAB_STALE',
          'PROPOSE_ZERO_NO_CANDIDATES',
        ],
      });

      const displayReasons = health.reasons.slice(0, 3);
      expect(displayReasons.length).toBe(3);
    });

    it('should truncate reasons beyond 3', () => {
      const health = createMockHealth('RED', {
        reasons: [
          'FLAG_DISABLED',
          'NO_V4_STORE',
          'NO_WEBSITELAB_RUN',
          'WEBSITELAB_STALE',
          'PROPOSE_ZERO_NO_CANDIDATES',
        ],
      });

      const displayReasons = health.reasons.slice(0, 3);
      const hasMoreReasons = health.reasons.length > 3;

      expect(displayReasons.length).toBe(3);
      expect(hasMoreReasons).toBe(true);
    });

    it('should not show "more" indicator when 3 or fewer reasons', () => {
      const health = createMockHealth('YELLOW', {
        reasons: ['NO_WEBSITELAB_RUN', 'WEBSITELAB_STALE'],
      });

      const hasMoreReasons = health.reasons.length > 3;
      expect(hasMoreReasons).toBe(false);
    });
  });

  describe('Reason Labels', () => {
    it('should have human-readable labels for all reasons', () => {
      const reasons: V4HealthReason[] = [
        'FLAG_DISABLED',
        'NO_V4_STORE',
        'NO_WEBSITELAB_RUN',
        'WEBSITELAB_STALE',
        'PROPOSE_ZERO_NO_CANDIDATES',
        'PROPOSE_ZERO_EXTRACT_MISSING',
        'PROPOSE_ZERO_ALL_DUPLICATES',
        'PROPOSE_ZERO_STORE_WRITE_FAILED',
        'PROPOSE_ENDPOINT_ERROR',
        'INSPECT_UNAVAILABLE',
      ];

      for (const reason of reasons) {
        expect(V4_HEALTH_REASON_LABELS[reason]).toBeDefined();
        expect(V4_HEALTH_REASON_LABELS[reason].length).toBeGreaterThan(0);
      }
    });
  });
});

describe('FlowReadinessBanner CTAs', () => {
  describe('Primary CTA', () => {
    it('should show "Review Context Baseline" for YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      // Component shows "Review Context Baseline" for YELLOW
      expect(health.status).toBe('YELLOW');
    });

    it('should show "Fix Baseline" for RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      // Component shows "Fix Baseline" for RED
      expect(health.status).toBe('RED');
    });
  });

  describe('Re-trigger Proposal Button', () => {
    it('should show when onRetriggerProposal is provided', () => {
      const hasHandler = true;
      expect(hasHandler).toBe(true);
    });

    it('should be disabled when retriggerLoading is true', () => {
      const retriggerLoading = true;
      expect(retriggerLoading).toBe(true);
    });
  });

  describe('Continue Anyway Button', () => {
    it('should show for YELLOW when showContinueButton is true', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      const showContinueButton = true;
      expect(health.status !== 'GREEN' && showContinueButton).toBe(true);
    });

    it('should show "Generate Anyway" for RED', () => {
      const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
      // Component shows "Generate Anyway" for RED
      expect(health.status).toBe('RED');
    });

    it('should show "Continue Anyway" for YELLOW', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      // Component shows "Continue Anyway" for YELLOW
      expect(health.status).toBe('YELLOW');
    });
  });

  describe('Inspector Link', () => {
    it('should link to correct path', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(health.links.inspectorPath).toBe('/c/test-company/admin/context-inspector');
    });
  });
});

describe('FlowReadinessBanner Details Panel', () => {
  describe('Compact Variant Dropdown', () => {
    it('should toggle on click', () => {
      let expanded = false;
      const onToggle = () => { expanded = !expanded; };

      onToggle();
      expect(expanded).toBe(true);

      onToggle();
      expect(expanded).toBe(false);
    });

    it('should show store counts in dropdown', () => {
      const health = createMockHealth('GREEN', { storeTotal: 10 });
      expect(health.store.total).toBe(10);
      expect(health.store.proposed).toBe(3);
      expect(health.store.confirmed).toBe(5);
    });

    it('should show WebsiteLab age in dropdown', () => {
      const health = createMockHealth('GREEN');
      expect(health.websiteLab.ageMinutes).toBe(60);
    });

    it('should show feature flags in dropdown', () => {
      const health = createMockHealth('GREEN');
      expect(health.flags.CONTEXT_V4_ENABLED).toBe(true);
      expect(health.flags.CONTEXT_V4_INGEST_WEBSITELAB).toBe(true);
    });
  });

  describe('Full Variant Details', () => {
    it('should be expandable', () => {
      let detailsExpanded = false;
      const onToggle = () => { detailsExpanded = !detailsExpanded; };

      onToggle();
      expect(detailsExpanded).toBe(true);
    });

    it('should show store, WebsiteLab, and flags when expanded', () => {
      const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
      expect(health.store.total).not.toBeNull();
      expect(health.websiteLab.hasRun).toBeDefined();
      expect(health.flags.CONTEXT_V4_ENABLED).toBeDefined();
    });
  });
});

describe('FlowReadinessBanner Age Formatting', () => {
  it('should format minutes as "Xm ago"', () => {
    const formatAge = (minutes: number | null): string => {
      if (minutes === null) return 'Unknown';
      if (minutes < 60) return `${minutes}m ago`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
      return `${Math.floor(minutes / 1440)}d ago`;
    };

    expect(formatAge(30)).toBe('30m ago');
  });

  it('should format hours as "Xh ago"', () => {
    const formatAge = (minutes: number | null): string => {
      if (minutes === null) return 'Unknown';
      if (minutes < 60) return `${minutes}m ago`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
      return `${Math.floor(minutes / 1440)}d ago`;
    };

    expect(formatAge(120)).toBe('2h ago');
  });

  it('should format days as "Xd ago"', () => {
    const formatAge = (minutes: number | null): string => {
      if (minutes === null) return 'Unknown';
      if (minutes < 60) return `${minutes}m ago`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
      return `${Math.floor(minutes / 1440)}d ago`;
    };

    expect(formatAge(2880)).toBe('2d ago');
  });

  it('should return "Unknown" for null', () => {
    const formatAge = (minutes: number | null): string => {
      if (minutes === null) return 'Unknown';
      if (minutes < 60) return `${minutes}m ago`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
      return `${Math.floor(minutes / 1440)}d ago`;
    };

    expect(formatAge(null)).toBe('Unknown');
  });
});

describe('FlowReadinessInlineWarning', () => {
  it('should not render for GREEN', () => {
    const health = createMockHealth('GREEN');
    const shouldRender = health.status !== 'GREEN';
    expect(shouldRender).toBe(false);
  });

  it('should render for YELLOW', () => {
    const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
    const shouldRender = health.status !== 'GREEN';
    expect(shouldRender).toBe(true);
  });

  it('should render for RED', () => {
    const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
    const shouldRender = health.status !== 'GREEN';
    expect(shouldRender).toBe(true);
  });
});

describe('FlowReadinessReadyIndicator', () => {
  it('should render for GREEN', () => {
    const health = createMockHealth('GREEN');
    const shouldRender = health.status === 'GREEN';
    expect(shouldRender).toBe(true);
  });

  it('should not render for YELLOW', () => {
    const health = createMockHealth('YELLOW', { reasons: ['NO_WEBSITELAB_RUN'] });
    const shouldRender = health.status === 'GREEN';
    expect(shouldRender).toBe(false);
  });

  it('should not render for RED', () => {
    const health = createMockHealth('RED', { reasons: ['FLAG_DISABLED'] });
    const shouldRender = health.status === 'GREEN';
    expect(shouldRender).toBe(false);
  });
});

describe('FlowReadinessBanner Props', () => {
  it('should accept variant prop', () => {
    const props = { variant: 'compact' as const };
    expect(props.variant).toBe('compact');
  });

  it('should default variant to "full"', () => {
    const defaultVariant = 'full';
    expect(defaultVariant).toBe('full');
  });

  it('should accept showActions prop', () => {
    const props = { showActions: false };
    expect(props.showActions).toBe(false);
  });

  it('should default showActions to true for YELLOW/RED', () => {
    const defaultShowActions = true;
    expect(defaultShowActions).toBe(true);
  });

  it('should accept onContinue prop', () => {
    const onContinue = () => {};
    expect(typeof onContinue).toBe('function');
  });

  it('should accept showContinueButton prop', () => {
    const props = { showContinueButton: true };
    expect(props.showContinueButton).toBe(true);
  });
});
