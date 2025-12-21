// tests/readiness/readiness-page.smoke.test.ts
// Smoke test for Company Readiness Page
//
// Minimal test coverage:
// - Readiness composition produces valid output
// - Signals list has expected entries
// - CTA mapping works

import { describe, it, expect } from 'vitest';
import {
  resolveFlowReadiness,
  contextV4HealthToSignal,
  strategyPresenceToSignal,
} from '@/lib/flowReadiness';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockHealth(status: 'GREEN' | 'YELLOW' | 'RED'): V4HealthResponse {
  return {
    healthVersion: 1,
    companyId: 'test-company',
    timestamp: new Date().toISOString(),
    status,
    reasons: status === 'GREEN' ? [] : ['NO_WEBSITELAB_RUN'],
    flags: {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    },
    websiteLab: {
      hasRun: status === 'GREEN',
      runId: status === 'GREEN' ? 'run-123' : null,
      createdAt: status === 'GREEN' ? new Date().toISOString() : null,
      ageMinutes: status === 'GREEN' ? 60 : null,
      staleThresholdMinutes: 10080,
    },
    propose: {
      lastReason: null,
      proposedCount: 0,
      createdCount: 0,
      skippedCount: 0,
      lastRunId: null,
    },
    store: {
      total: 10,
      proposed: 3,
      confirmed: 5,
      rejected: 2,
    },
    links: {
      inspectorPath: '/api/os/companies/test-company/context/v4/inspect',
      proposeApiPath: '/api/os/companies/test-company/context/v4/propose',
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Readiness Page Composition', () => {
  it('composes Context V4 + Strategy signals into resolved readiness', () => {
    const health = createMockHealth('GREEN');
    const strategyInfo = {
      hasStrategy: true,
      hasObjectives: true,
      hasBets: true,
      companyId: 'test-company',
    };

    const contextSignal = contextV4HealthToSignal(health);
    const strategySignal = strategyPresenceToSignal(strategyInfo);
    const resolved = resolveFlowReadiness([contextSignal, strategySignal]);

    // Should have 2 signals
    expect(resolved.signals).toHaveLength(2);
    expect(resolved.signals[0].id).toBe('context-v4');
    expect(resolved.signals[1].id).toBe('strategy');

    // Both PASS → overall GREEN
    expect(resolved.status).toBe('GREEN');
  });

  it('produces YELLOW when strategy is missing', () => {
    const health = createMockHealth('GREEN');
    const strategyInfo = {
      hasStrategy: false,
      hasObjectives: false,
      hasBets: false,
      companyId: 'test-company',
    };

    const contextSignal = contextV4HealthToSignal(health);
    const strategySignal = strategyPresenceToSignal(strategyInfo);
    const resolved = resolveFlowReadiness([contextSignal, strategySignal]);

    // Context GREEN + Strategy WARN → overall YELLOW
    expect(resolved.status).toBe('YELLOW');
    expect(resolved.rankedReasons.length).toBeGreaterThan(0);
    expect(resolved.rankedReasons[0].signalId).toBe('strategy');
  });

  it('produces RED when context health is broken', () => {
    const health = createMockHealth('RED');
    const strategyInfo = {
      hasStrategy: true,
      hasObjectives: true,
      hasBets: true,
      companyId: 'test-company',
    };

    const contextSignal = contextV4HealthToSignal(health);
    const strategySignal = strategyPresenceToSignal(strategyInfo);
    const resolved = resolveFlowReadiness([contextSignal, strategySignal]);

    // Context RED → overall RED
    expect(resolved.status).toBe('RED');
    expect(resolved.recommendedAction).toBeDefined();
    expect(resolved.recommendedAction?.signalId).toBe('context-v4');
  });

  it('includes CTAs from failing signals', () => {
    const health = createMockHealth('YELLOW');
    const strategyInfo = {
      hasStrategy: false,
      companyId: 'test-company',
    };

    const contextSignal = contextV4HealthToSignal(health);
    const strategySignal = strategyPresenceToSignal(strategyInfo);
    const resolved = resolveFlowReadiness([contextSignal, strategySignal]);

    // Should have CTAs from both failing signals
    const allCtas = resolved.signals.flatMap(s => s.ctas || []);
    expect(allCtas.length).toBeGreaterThan(0);

    // Context V4 CTA should have review path
    const contextCta = resolved.signals[0].ctas?.find(c => c.priority === 'primary');
    expect(contextCta?.href).toContain('/context-v4/');

    // Strategy CTA should have strategy path
    const strategyCta = resolved.signals[1].ctas?.find(c => c.priority === 'primary');
    expect(strategyCta?.href).toContain('/strategy');
  });
});
