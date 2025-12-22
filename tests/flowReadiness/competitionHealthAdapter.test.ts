// tests/flowReadiness/competitionHealthAdapter.test.ts
// Tests for Competition Health → FlowReadinessSignal adapter
//
// IMPORTANT: Competition is NEVER a blocking signal.
// These tests verify:
// - Competition never produces FAIL severity
// - LOW_CONFIDENCE_CONTEXT produces WARN
// - Missing competition produces WARN (not FAIL)
// - Strategy readiness is NOT blocked by missing competition

import { describe, it, expect } from 'vitest';
import {
  competitionHealthToSignal,
  computeCompetitionHealth,
  competitionNeedsAttention,
  getCompetitionConfidence,
  hasLowConfidenceError,
  COMPETITION_SIGNAL_ID,
  COMPETITION_SIGNAL_LABEL,
} from '@/lib/flowReadiness/adapters/competitionHealthAdapter';
import type { CompetitionRunV3Payload } from '@/lib/competition-v3/store';

// ============================================================================
// Test Fixtures
// ============================================================================

function createCompetitionRun(
  overrides: Partial<CompetitionRunV3Payload> = {}
): CompetitionRunV3Payload {
  return {
    runId: 'run-123',
    companyId: 'company-123',
    status: 'completed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    competitors: [
      { domain: 'competitor1.com', name: 'Competitor 1', type: 'direct' } as any,
      { domain: 'competitor2.com', name: 'Competitor 2', type: 'partial' } as any,
    ],
    insights: [],
    recommendations: [],
    summary: {
      totalCandidates: 10,
      totalCompetitors: 2,
      byType: { direct: 1, partial: 1, fractional: 0, platform: 0, internal: 0 },
      avgThreatScore: 65,
      quadrantDistribution: {},
    },
    error: null,
    errorInfo: null,
    ...overrides,
  };
}

function createLowConfidenceRun(): CompetitionRunV3Payload {
  return createCompetitionRun({
    competitors: [],
    error: 'LOW_CONFIDENCE_CONTEXT',
    errorInfo: {
      type: 'LOW_CONFIDENCE_CONTEXT',
      message: 'Insufficient context to identify business type',
      debug: {
        confidence: 0.3,
        inferredCategory: 'unknown',
        missingFields: ['industry', 'businessModel'],
        warnings: ['No industry detected'],
      },
    },
  });
}

function createStaleRun(): CompetitionRunV3Payload {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 60); // 60 days ago
  return createCompetitionRun({
    createdAt: staleDate.toISOString(),
  });
}

// ============================================================================
// computeCompetitionHealth
// ============================================================================

describe('computeCompetitionHealth', () => {
  it('returns unknown status when no run exists', () => {
    const health = computeCompetitionHealth({
      latestRun: null,
      companyId: 'test',
    });

    expect(health.hasRun).toBe(false);
    expect(health.status).toBe('unknown');
    expect(health.confidence).toBe('missing');
    expect(health.runId).toBeNull();
  });

  it('returns healthy status with high confidence for valid run', () => {
    const run = createCompetitionRun();
    const health = computeCompetitionHealth({
      latestRun: run,
      companyId: 'test',
    });

    expect(health.hasRun).toBe(true);
    expect(health.status).toBe('healthy');
    expect(health.confidence).toBe('high');
    expect(health.competitorCount).toBe(2);
  });

  it('returns warning status for LOW_CONFIDENCE_CONTEXT error', () => {
    const run = createLowConfidenceRun();
    const health = computeCompetitionHealth({
      latestRun: run,
      companyId: 'test',
    });

    expect(health.hasRun).toBe(true);
    expect(health.status).toBe('warning');
    expect(health.confidence).toBe('low');
    expect(health.hasLowConfidenceError).toBe(true);
  });

  it('returns warning status for stale runs (>30 days)', () => {
    const run = createStaleRun();
    const health = computeCompetitionHealth({
      latestRun: run,
      companyId: 'test',
    });

    expect(health.hasRun).toBe(true);
    expect(health.status).toBe('warning');
    expect(health.confidence).toBe('low');
    expect(health.ageDays).toBeGreaterThan(30);
  });

  it('returns warning status for empty competitor list', () => {
    const run = createCompetitionRun({ competitors: [] });
    const health = computeCompetitionHealth({
      latestRun: run,
      companyId: 'test',
    });

    expect(health.hasRun).toBe(true);
    expect(health.status).toBe('warning');
    expect(health.confidence).toBe('low');
    expect(health.competitorCount).toBe(0);
  });
});

// ============================================================================
// competitionHealthToSignal - CRITICAL: Never FAIL
// ============================================================================

describe('competitionHealthToSignal', () => {
  describe('signal metadata', () => {
    it('has correct signal ID and label', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun(),
        companyId: 'test',
      });

      expect(signal.id).toBe(COMPETITION_SIGNAL_ID);
      expect(signal.label).toBe(COMPETITION_SIGNAL_LABEL);
    });
  });

  describe('severity mapping - NEVER FAIL', () => {
    it('returns PASS for healthy competition with high confidence', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun(),
        companyId: 'test',
      });

      expect(signal.severity).toBe('PASS');
    });

    it('returns WARN (not FAIL) for LOW_CONFIDENCE_CONTEXT', () => {
      const signal = competitionHealthToSignal({
        latestRun: createLowConfidenceRun(),
        companyId: 'test',
      });

      // CRITICAL: Must be WARN, not FAIL
      expect(signal.severity).toBe('WARN');
      expect(signal.severity).not.toBe('FAIL');
    });

    it('returns WARN (not FAIL) for missing competition', () => {
      const signal = competitionHealthToSignal({
        latestRun: null,
        companyId: 'test',
      });

      // CRITICAL: Must be WARN, not FAIL
      expect(signal.severity).toBe('WARN');
      expect(signal.severity).not.toBe('FAIL');
    });

    it('returns WARN (not FAIL) for stale competition', () => {
      const signal = competitionHealthToSignal({
        latestRun: createStaleRun(),
        companyId: 'test',
      });

      // CRITICAL: Must be WARN, not FAIL
      expect(signal.severity).toBe('WARN');
      expect(signal.severity).not.toBe('FAIL');
    });

    it('returns WARN (not FAIL) for empty competitors', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun({ competitors: [] }),
        companyId: 'test',
      });

      // CRITICAL: Must be WARN, not FAIL
      expect(signal.severity).toBe('WARN');
      expect(signal.severity).not.toBe('FAIL');
    });
  });

  describe('reasons', () => {
    it('has no reasons for healthy state', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun(),
        companyId: 'test',
      });

      expect(signal.reasons).toHaveLength(0);
    });

    it('includes COMPETITION_MISSING reason when no run', () => {
      const signal = competitionHealthToSignal({
        latestRun: null,
        companyId: 'test',
      });

      expect(signal.reasons).toContainEqual(
        expect.objectContaining({ code: 'COMPETITION_MISSING' })
      );
    });

    it('includes COMPETITION_LOW_CONFIDENCE reason for low confidence', () => {
      const signal = competitionHealthToSignal({
        latestRun: createLowConfidenceRun(),
        companyId: 'test',
      });

      expect(signal.reasons).toContainEqual(
        expect.objectContaining({ code: 'COMPETITION_LOW_CONFIDENCE' })
      );
    });

    it('includes COMPETITION_STALE reason for old runs', () => {
      const signal = competitionHealthToSignal({
        latestRun: createStaleRun(),
        companyId: 'test',
      });

      expect(signal.reasons).toContainEqual(
        expect.objectContaining({ code: 'COMPETITION_STALE' })
      );
    });

    it('includes COMPETITION_EMPTY reason for no competitors', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun({ competitors: [] }),
        companyId: 'test',
      });

      expect(signal.reasons).toContainEqual(
        expect.objectContaining({ code: 'COMPETITION_EMPTY' })
      );
    });
  });

  describe('CTAs', () => {
    it('has no CTAs for healthy state', () => {
      const signal = competitionHealthToSignal({
        latestRun: createCompetitionRun(),
        companyId: 'test-company',
      });

      expect(signal.ctas).toBeUndefined();
    });

    it('has "Improve Competitive Context" CTA for low confidence', () => {
      const signal = competitionHealthToSignal({
        latestRun: createLowConfidenceRun(),
        companyId: 'test-company',
      });

      expect(signal.ctas).toBeDefined();
      expect(signal.ctas).toContainEqual(
        expect.objectContaining({
          label: 'Improve Competitive Context',
          priority: 'primary',
        })
      );
    });

    it('has "Run Competition Analysis" CTA for missing', () => {
      const signal = competitionHealthToSignal({
        latestRun: null,
        companyId: 'test-company',
      });

      expect(signal.ctas).toBeDefined();
      expect(signal.ctas).toContainEqual(
        expect.objectContaining({
          label: 'Run Competition Analysis',
          onClickId: 'run-competition',
        })
      );
    });
  });

  describe('metadata', () => {
    it('includes competition info in meta', () => {
      const run = createCompetitionRun();
      const signal = competitionHealthToSignal({
        latestRun: run,
        companyId: 'test',
      });

      expect(signal.meta).toMatchObject({
        hasRun: true,
        confidence: 'high',
        competitorCount: 2,
      });
    });

    it('includes low confidence error type in meta', () => {
      const signal = competitionHealthToSignal({
        latestRun: createLowConfidenceRun(),
        companyId: 'test',
      });

      expect(signal.meta).toMatchObject({
        hasLowConfidenceError: true,
        errorType: 'LOW_CONFIDENCE_CONTEXT',
      });
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

describe('competitionNeedsAttention', () => {
  it('returns false for healthy competition', () => {
    const result = competitionNeedsAttention({
      latestRun: createCompetitionRun(),
      companyId: 'test',
    });
    expect(result).toBe(false);
  });

  it('returns true for missing competition', () => {
    const result = competitionNeedsAttention({
      latestRun: null,
      companyId: 'test',
    });
    expect(result).toBe(true);
  });

  it('returns true for low confidence', () => {
    const result = competitionNeedsAttention({
      latestRun: createLowConfidenceRun(),
      companyId: 'test',
    });
    expect(result).toBe(true);
  });
});

describe('getCompetitionConfidence', () => {
  it('returns high for valid run', () => {
    expect(getCompetitionConfidence(createCompetitionRun())).toBe('high');
  });

  it('returns low for low confidence run', () => {
    expect(getCompetitionConfidence(createLowConfidenceRun())).toBe('low');
  });

  it('returns missing for null run', () => {
    expect(getCompetitionConfidence(null)).toBe('missing');
  });
});

describe('hasLowConfidenceError', () => {
  it('returns true for LOW_CONFIDENCE_CONTEXT error', () => {
    expect(hasLowConfidenceError(createLowConfidenceRun())).toBe(true);
  });

  it('returns false for normal run', () => {
    expect(hasLowConfidenceError(createCompetitionRun())).toBe(false);
  });

  it('returns false for null run', () => {
    expect(hasLowConfidenceError(null)).toBe(false);
  });
});

// ============================================================================
// Integration: Strategy NOT blocked by competition
// ============================================================================

describe('Strategy readiness with competition', () => {
  it('strategy is ready even without competition', () => {
    const signal = competitionHealthToSignal({
      latestRun: null,
      companyId: 'test',
    });

    // Competition produces WARN, not FAIL
    // This means overall flow readiness can still be YELLOW, not RED
    expect(signal.severity).toBe('WARN');

    // If this were the only signal, status would be YELLOW (not RED)
    // which means strategy can still run with a warning
  });

  it('LOW_CONFIDENCE_CONTEXT does not block strategy', () => {
    const signal = competitionHealthToSignal({
      latestRun: createLowConfidenceRun(),
      companyId: 'test',
    });

    // Must be WARN, which is non-blocking
    expect(signal.severity).toBe('WARN');
  });
});
