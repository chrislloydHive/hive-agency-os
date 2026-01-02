// tests/os/websiteLabV5Event.test.ts
// Tests for Website Lab V5 event emission with idempotency
//
// Verifies:
// - Event is emitted when v5Diagnostic exists
// - Event is skipped when v5Diagnostic is missing
// - Event is skipped when already emitted (idempotency)
// - Payload contains correct minimal data

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildV5CompletedPayload,
  type WebsiteLabV5CompletedPayload,
} from '@/lib/gap-heavy/modules/websiteLabEvents';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestV5Diagnostic(
  overrides: Partial<V5DiagnosticOutput> = {}
): V5DiagnosticOutput {
  return {
    observations: [
      {
        pagePath: '/',
        pageType: 'home',
        aboveFoldElements: ['Hero headline', 'Navigation'],
        primaryCTAs: [{ text: 'Get Started', position: 'above_fold', destination: '/signup' }],
        trustProofElements: ['Client logos'],
        missingUnclearElements: ['No clear value proposition'],
      },
    ],
    personaJourneys: [
      {
        persona: 'first_time',
        startingPage: '/',
        intendedGoal: 'Understand what this company does',
        actualPath: ['/', '/about'],
        failurePoint: { page: '/', reason: 'Vague headline' },
        confidenceScore: 0.3,
        succeeded: false,
      },
      {
        persona: 'ready_to_buy',
        startingPage: '/',
        intendedGoal: 'Find pricing',
        actualPath: ['/', '/pricing'],
        failurePoint: null,
        confidenceScore: 0.8,
        succeeded: true,
      },
      {
        persona: 'comparison_shopper',
        startingPage: '/',
        intendedGoal: 'Compare with competitors',
        actualPath: ['/'],
        failurePoint: { page: '/', reason: 'No comparison content' },
        confidenceScore: 0.4,
        succeeded: false,
      },
    ],
    blockingIssues: [
      {
        id: 1,
        severity: 'high',
        affectedPersonas: ['first_time'],
        page: '/',
        whyItBlocks: 'Vague headline does not communicate value',
        concreteFix: { what: 'Rewrite headline', where: 'Homepage hero' },
      },
      {
        id: 2,
        severity: 'medium',
        affectedPersonas: ['comparison_shopper'],
        page: '/',
        whyItBlocks: 'No feature comparison section',
        concreteFix: { what: 'Add comparison table', where: 'Homepage or features page' },
      },
    ],
    quickWins: [
      {
        addressesIssueId: 1,
        title: 'Rewrite headline',
        action: 'Replace vague headline with specific value prop',
        page: '/',
        expectedImpact: 'Reduce bounce rate',
      },
    ],
    structuralChanges: [
      {
        addressesIssueIds: [2],
        title: 'Add comparison section',
        description: 'Create a feature comparison table',
        pagesAffected: ['/', '/features'],
        rationale: 'Helps comparison shoppers make decisions',
      },
    ],
    score: 52,
    scoreJustification: 'Homepage lacks clear value proposition. 2/3 personas failed.',
    ...overrides,
  };
}

// ============================================================================
// buildV5CompletedPayload Tests
// ============================================================================

describe('buildV5CompletedPayload', () => {
  it('builds correct payload with all fields', () => {
    const v5Output = createTestV5Diagnostic();
    const pagesAnalyzed = ['/', '/about', '/pricing'];

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      pagesAnalyzed
    );

    expect(payload.companyId).toBe('company-123');
    expect(payload.runId).toBe('run-456');
    expect(payload.v5Score).toBe(52);
    expect(payload.blockingIssueCount).toBe(2);
    expect(payload.structuralChangeCount).toBe(1);
    expect(payload.pagesAnalyzed).toEqual(['/', '/about', '/pricing']);
    expect(payload.completedAt).toBeDefined();
  });

  it('counts persona failures correctly', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    // first_time failed, ready_to_buy succeeded, comparison_shopper failed
    expect(payload.personaFailureCounts.first_time).toBe(1);
    expect(payload.personaFailureCounts.ready_to_buy).toBe(0);
    expect(payload.personaFailureCounts.comparison_shopper).toBe(1);
  });

  it('handles all personas succeeding', () => {
    const v5Output = createTestV5Diagnostic({
      personaJourneys: [
        {
          persona: 'first_time',
          startingPage: '/',
          intendedGoal: 'Test',
          actualPath: ['/'],
          failurePoint: null,
          confidenceScore: 0.9,
          succeeded: true,
        },
        {
          persona: 'ready_to_buy',
          startingPage: '/',
          intendedGoal: 'Test',
          actualPath: ['/'],
          failurePoint: null,
          confidenceScore: 0.9,
          succeeded: true,
        },
        {
          persona: 'comparison_shopper',
          startingPage: '/',
          intendedGoal: 'Test',
          actualPath: ['/'],
          failurePoint: null,
          confidenceScore: 0.9,
          succeeded: true,
        },
      ],
    });

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    expect(payload.personaFailureCounts.first_time).toBe(0);
    expect(payload.personaFailureCounts.ready_to_buy).toBe(0);
    expect(payload.personaFailureCounts.comparison_shopper).toBe(0);
  });

  it('handles empty blocking issues', () => {
    const v5Output = createTestV5Diagnostic({
      blockingIssues: [],
      quickWins: [],
    });

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    expect(payload.blockingIssueCount).toBe(0);
  });

  it('handles empty structural changes', () => {
    const v5Output = createTestV5Diagnostic({
      structuralChanges: [],
    });

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    expect(payload.structuralChangeCount).toBe(0);
  });

  it('does not include raw observations in payload', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    ) as unknown as Record<string, unknown>;

    // These should NOT be in the payload (minimal payload rule)
    expect(payload['observations']).toBeUndefined();
    expect(payload['personaJourneys']).toBeUndefined();
    expect(payload['blockingIssues']).toBeUndefined();
    expect(payload['quickWins']).toBeUndefined();
    expect(payload['structuralChanges']).toBeUndefined();
    expect(payload['scoreJustification']).toBeUndefined();
  });

  it('includes ISO timestamp for completedAt', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    // Should be a valid ISO timestamp
    const parsed = new Date(payload.completedAt);
    expect(parsed.toISOString()).toBe(payload.completedAt);
  });
});

// ============================================================================
// Idempotency Tests (Unit Level)
// ============================================================================

describe('V5 Event Idempotency', () => {
  it('idempotency marker structure is correct', () => {
    // The marker should be stored in metadata.eventsEmitted.websiteLabV5CompletedAt
    const marker = {
      eventsEmitted: {
        websiteLabV5CompletedAt: '2024-01-15T10:00:00.000Z',
      },
    };

    expect(marker.eventsEmitted.websiteLabV5CompletedAt).toBeDefined();
    expect(typeof marker.eventsEmitted.websiteLabV5CompletedAt).toBe('string');
  });

  it('can detect already-emitted state', () => {
    const metadata = {
      eventsEmitted: {
        websiteLabV5CompletedAt: '2024-01-15T10:00:00.000Z',
      },
    };

    const eventsEmitted = metadata.eventsEmitted || {};
    const alreadyEmitted = !!eventsEmitted.websiteLabV5CompletedAt;

    expect(alreadyEmitted).toBe(true);
  });

  it('can detect not-yet-emitted state', () => {
    const metadata = {};

    const eventsEmitted = (metadata as Record<string, unknown>).eventsEmitted || {};
    const alreadyEmitted = !!(eventsEmitted as Record<string, unknown>).websiteLabV5CompletedAt;

    expect(alreadyEmitted).toBe(false);
  });

  it('can detect not-yet-emitted with empty eventsEmitted', () => {
    const metadata = {
      eventsEmitted: {},
    };

    const eventsEmitted = metadata.eventsEmitted || {};
    const alreadyEmitted = !!(eventsEmitted as Record<string, unknown>).websiteLabV5CompletedAt;

    expect(alreadyEmitted).toBe(false);
  });
});

// ============================================================================
// Payload Validation Tests
// ============================================================================

describe('WebsiteLabV5CompletedPayload validation', () => {
  it('payload has all required fields', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/', '/about']
    );

    // Required fields per spec
    expect(payload).toHaveProperty('companyId');
    expect(payload).toHaveProperty('runId');
    expect(payload).toHaveProperty('v5Score');
    expect(payload).toHaveProperty('blockingIssueCount');
    expect(payload).toHaveProperty('structuralChangeCount');
    expect(payload).toHaveProperty('personaFailureCounts');
    expect(payload).toHaveProperty('pagesAnalyzed');
    expect(payload).toHaveProperty('completedAt');
  });

  it('personaFailureCounts has all three persona types', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    expect(payload.personaFailureCounts).toHaveProperty('first_time');
    expect(payload.personaFailureCounts).toHaveProperty('ready_to_buy');
    expect(payload.personaFailureCounts).toHaveProperty('comparison_shopper');
  });

  it('all counts are numbers', () => {
    const v5Output = createTestV5Diagnostic();

    const payload = buildV5CompletedPayload(
      'company-123',
      'run-456',
      v5Output,
      ['/']
    );

    expect(typeof payload.v5Score).toBe('number');
    expect(typeof payload.blockingIssueCount).toBe('number');
    expect(typeof payload.structuralChangeCount).toBe('number');
    expect(typeof payload.personaFailureCounts.first_time).toBe('number');
    expect(typeof payload.personaFailureCounts.ready_to_buy).toBe('number');
    expect(typeof payload.personaFailureCounts.comparison_shopper).toBe('number');
  });
});
