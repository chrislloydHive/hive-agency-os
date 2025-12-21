// tests/flowReadiness/contextV4HealthAdapter.test.ts
// Tests for Context V4 Health Adapter
//
// Tests:
// - Status to severity mapping
// - Reason mapping with labels
// - CTA generation
// - Metadata building
// - needsAttention helper

import { describe, it, expect } from 'vitest';
import {
  contextV4HealthToSignal,
  needsAttention,
  CONTEXT_V4_SIGNAL_ID,
  CONTEXT_V4_SIGNAL_LABEL,
} from '@/lib/flowReadiness/adapters/contextV4HealthAdapter';
import type { V4HealthResponse, V4HealthStatus } from '@/lib/types/contextV4Health';

// ============================================================================
// Test Fixtures
// ============================================================================

function createHealthResponse(
  overrides: Partial<V4HealthResponse> = {}
): V4HealthResponse {
  return {
    healthVersion: 1,
    companyId: 'test-company-123',
    timestamp: '2024-01-15T10:00:00.000Z',
    status: 'GREEN',
    reasons: [],
    flags: {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    },
    websiteLab: {
      hasRun: true,
      runId: 'run-123',
      createdAt: '2024-01-15T09:00:00.000Z',
      ageMinutes: 60,
      staleThresholdMinutes: 10080,
    },
    propose: {
      lastReason: null,
      proposedCount: 5,
      createdCount: 5,
      skippedCount: 0,
      lastRunId: 'run-123',
    },
    store: {
      total: 10,
      proposed: 5,
      confirmed: 5,
      rejected: 0,
    },
    links: {
      inspectorPath: '/api/os/companies/test-company-123/context/v4/inspect',
      proposeApiPath: '/api/os/companies/test-company-123/context/v4/propose',
    },
    ...overrides,
  };
}

// ============================================================================
// Constants
// ============================================================================

describe('constants', () => {
  it('exports correct signal ID', () => {
    expect(CONTEXT_V4_SIGNAL_ID).toBe('context-v4');
  });

  it('exports correct signal label', () => {
    expect(CONTEXT_V4_SIGNAL_LABEL).toBe('Context Baseline');
  });
});

// ============================================================================
// contextV4HealthToSignal
// ============================================================================

describe('contextV4HealthToSignal', () => {
  describe('status to severity mapping', () => {
    it('maps GREEN status to PASS severity', () => {
      const health = createHealthResponse({ status: 'GREEN' });
      const signal = contextV4HealthToSignal(health);
      expect(signal.severity).toBe('PASS');
    });

    it('maps YELLOW status to WARN severity', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.severity).toBe('WARN');
    });

    it('maps RED status to FAIL severity', () => {
      const health = createHealthResponse({
        status: 'RED',
        reasons: ['FLAG_DISABLED'],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.severity).toBe('FAIL');
    });
  });

  describe('signal structure', () => {
    it('sets correct signal ID', () => {
      const health = createHealthResponse();
      const signal = contextV4HealthToSignal(health);
      expect(signal.id).toBe('context-v4');
    });

    it('sets correct signal label', () => {
      const health = createHealthResponse();
      const signal = contextV4HealthToSignal(health);
      expect(signal.label).toBe('Context Baseline');
    });
  });

  describe('reason mapping', () => {
    it('maps reasons with human-readable labels', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['NO_WEBSITELAB_RUN', 'WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.reasons).toHaveLength(2);
      expect(signal.reasons[0]).toEqual({
        code: 'NO_WEBSITELAB_RUN',
        label: 'No WebsiteLab run found',
      });
      expect(signal.reasons[1]).toEqual({
        code: 'WEBSITELAB_STALE',
        label: 'WebsiteLab run is stale (>7 days old)',
      });
    });

    it('returns empty reasons array when none provided', () => {
      const health = createHealthResponse({ status: 'GREEN', reasons: [] });
      const signal = contextV4HealthToSignal(health);
      expect(signal.reasons).toEqual([]);
    });

    it('uses code as label for unknown reasons', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['UNKNOWN' as any],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.reasons[0].label).toBe('Unknown issue');
    });
  });

  describe('CTA generation', () => {
    it('returns no CTAs for GREEN status', () => {
      const health = createHealthResponse({ status: 'GREEN' });
      const signal = contextV4HealthToSignal(health);
      expect(signal.ctas).toBeUndefined();
    });

    it('returns CTAs for YELLOW status', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.ctas).toBeDefined();
      expect(signal.ctas!.length).toBeGreaterThan(0);
    });

    it('returns CTAs for RED status with "Fix Baseline" label', () => {
      const health = createHealthResponse({
        status: 'RED',
        reasons: ['FLAG_DISABLED'],
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.ctas).toBeDefined();
      const primaryCta = signal.ctas!.find(cta => cta.priority === 'primary');
      expect(primaryCta?.label).toBe('Fix Baseline');
    });

    it('includes review path CTA as primary', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      const primaryCta = signal.ctas!.find(cta => cta.priority === 'primary');
      expect(primaryCta?.label).toBe('Review Context Baseline');
      expect(primaryCta?.href).toBe('/context-v4/test-company-123/review');
    });

    it('includes retrigger proposal CTA as secondary', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      const retriggerCta = signal.ctas!.find(cta => cta.onClickId === 'retrigger-proposal');
      expect(retriggerCta).toBeDefined();
      expect(retriggerCta?.priority).toBe('secondary');
    });

    it('includes inspector CTA as secondary', () => {
      const health = createHealthResponse({
        status: 'YELLOW',
        reasons: ['WEBSITELAB_STALE'],
      });
      const signal = contextV4HealthToSignal(health);
      const inspectorCta = signal.ctas!.find(cta => cta.label === 'Inspector');
      expect(inspectorCta).toBeDefined();
      expect(inspectorCta?.priority).toBe('secondary');
    });
  });

  describe('metadata', () => {
    it('includes companyId in meta', () => {
      const health = createHealthResponse({ companyId: 'my-company' });
      const signal = contextV4HealthToSignal(health);
      expect(signal.meta?.companyId).toBe('my-company');
    });

    it('includes timestamp in meta', () => {
      const health = createHealthResponse({
        timestamp: '2024-01-15T10:00:00.000Z',
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.meta?.timestamp).toBe('2024-01-15T10:00:00.000Z');
    });

    it('includes websiteLab info in meta', () => {
      const health = createHealthResponse({
        websiteLab: {
          hasRun: true,
          runId: 'run-123',
          createdAt: '2024-01-15T09:00:00.000Z',
          ageMinutes: 60,
          staleThresholdMinutes: 10080,
        },
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.meta?.websiteLab).toEqual({
        hasRun: true,
        ageMinutes: 60,
        staleThresholdMinutes: 10080,
      });
    });

    it('includes store counts in meta', () => {
      const health = createHealthResponse({
        store: {
          total: 10,
          proposed: 5,
          confirmed: 5,
          rejected: 0,
        },
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.meta?.store).toEqual({
        total: 10,
        proposed: 5,
        confirmed: 5,
        rejected: 0,
      });
    });

    it('includes flags in meta', () => {
      const health = createHealthResponse({
        flags: {
          CONTEXT_V4_ENABLED: true,
          CONTEXT_V4_INGEST_WEBSITELAB: false,
        },
      });
      const signal = contextV4HealthToSignal(health);
      expect(signal.meta?.flags).toEqual({
        CONTEXT_V4_ENABLED: true,
        CONTEXT_V4_INGEST_WEBSITELAB: false,
      });
    });
  });
});

// ============================================================================
// needsAttention
// ============================================================================

describe('needsAttention', () => {
  it('returns false for GREEN status', () => {
    const health = createHealthResponse({ status: 'GREEN' });
    expect(needsAttention(health)).toBe(false);
  });

  it('returns true for YELLOW status', () => {
    const health = createHealthResponse({
      status: 'YELLOW',
      reasons: ['WEBSITELAB_STALE'],
    });
    expect(needsAttention(health)).toBe(true);
  });

  it('returns true for RED status', () => {
    const health = createHealthResponse({
      status: 'RED',
      reasons: ['FLAG_DISABLED'],
    });
    expect(needsAttention(health)).toBe(true);
  });
});

// ============================================================================
// Integration with resolver
// ============================================================================

describe('integration with resolver', () => {
  it('produces valid signal for resolver', async () => {
    const { resolveFlowReadiness } = await import('@/lib/flowReadiness/resolveFlowReadiness');

    const health = createHealthResponse({
      status: 'YELLOW',
      reasons: ['WEBSITELAB_STALE'],
    });
    const signal = contextV4HealthToSignal(health);

    // Should not throw when passed to resolver
    const resolved = resolveFlowReadiness([signal]);
    expect(resolved.status).toBe('YELLOW');
    expect(resolved.signals).toHaveLength(1);
    expect(resolved.rankedReasons).toHaveLength(1);
  });
});
