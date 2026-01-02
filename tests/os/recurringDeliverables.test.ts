// tests/os/recurringDeliverables.test.ts
// Tests for the Recurring Deliverables Engine

import { describe, it, expect } from 'vitest';
import {
  getPeriodKey,
  getPeriodDueDate,
  getUpcomingPeriods,
  generateRecurringDeliverableKey,
  parseRecurringDeliverableKey,
  ensureUpcomingDeliverables,
  formatPeriodLabel,
  getDeliverableCadenceSummary,
  summarizeDeliverableResults,
  getPeriodStartISO,
  generateIdempotencyKey,
  DEFAULT_TIMEZONE,
} from '@/lib/os/programs/recurringDeliverables';
import type { PlanningProgram } from '@/lib/types/program';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog-test-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    title: 'Test Program',
    status: 'committed',
    stableKey: 'test-stable-key',
    origin: { strategyId: 'strategy-1' },
    scope: {
      summary: 'Test program scope',
      deliverables: [],
      workstreams: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: { kpis: [] },
    planDetails: { horizonDays: 90, milestones: [] },
    commitment: { workItemIds: [] },
    linkedArtifacts: [],
    workPlanVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopeEnforced: false,
    domain: 'Strategy',
    intensity: 'Standard',
    ...overrides,
  } as PlanningProgram;
}

// ============================================================================
// Period Key Tests
// ============================================================================

describe('getPeriodKey', () => {
  describe('weekly cadence', () => {
    it('generates correct weekly period key', () => {
      const date = new Date('2025-01-15'); // Week 3 of 2025
      const key = getPeriodKey(date, 'weekly');
      expect(key).toMatch(/^weekly-2025-W\d{2}$/);
    });

    it('handles year boundary correctly', () => {
      const date = new Date('2025-01-01');
      const key = getPeriodKey(date, 'weekly');
      expect(key).toMatch(/^weekly-\d{4}-W\d{2}$/);
    });
  });

  describe('monthly cadence', () => {
    it('generates correct monthly period key', () => {
      const date = new Date('2025-03-15');
      const key = getPeriodKey(date, 'monthly');
      expect(key).toBe('monthly-2025-03');
    });

    it('pads single-digit months', () => {
      const date = new Date('2025-01-15');
      const key = getPeriodKey(date, 'monthly');
      expect(key).toBe('monthly-2025-01');
    });
  });

  describe('quarterly cadence', () => {
    it('generates correct Q1 key', () => {
      const date = new Date('2025-02-15');
      const key = getPeriodKey(date, 'quarterly');
      expect(key).toBe('quarterly-2025-Q1');
    });

    it('generates correct Q2 key', () => {
      const date = new Date('2025-05-15');
      const key = getPeriodKey(date, 'quarterly');
      expect(key).toBe('quarterly-2025-Q2');
    });

    it('generates correct Q3 key', () => {
      const date = new Date('2025-08-15');
      const key = getPeriodKey(date, 'quarterly');
      expect(key).toBe('quarterly-2025-Q3');
    });

    it('generates correct Q4 key', () => {
      const date = new Date('2025-11-15');
      const key = getPeriodKey(date, 'quarterly');
      expect(key).toBe('quarterly-2025-Q4');
    });
  });
});

describe('getPeriodDueDate', () => {
  it('returns last day of month for monthly', () => {
    const dueDate = getPeriodDueDate('monthly-2025-01', 'monthly');
    expect(dueDate.getFullYear()).toBe(2025);
    expect(dueDate.getMonth()).toBe(0); // January
    expect(dueDate.getDate()).toBe(31); // Last day of January
  });

  it('handles February correctly', () => {
    const dueDate = getPeriodDueDate('monthly-2025-02', 'monthly');
    expect(dueDate.getDate()).toBe(28); // 2025 is not a leap year
  });

  it('returns end of quarter for quarterly', () => {
    const dueDate = getPeriodDueDate('quarterly-2025-Q1', 'quarterly');
    expect(dueDate.getFullYear()).toBe(2025);
    expect(dueDate.getMonth()).toBe(2); // March
    expect(dueDate.getDate()).toBe(31); // Last day of March
  });
});

describe('getUpcomingPeriods', () => {
  it('returns correct number of weekly periods', () => {
    const date = new Date('2025-01-15');
    const periods = getUpcomingPeriods(date, 'weekly', 4);
    expect(periods).toHaveLength(4);
    periods.forEach((p) => expect(p).toMatch(/^weekly-\d{4}-W\d{2}$/));
  });

  it('returns correct number of monthly periods', () => {
    const date = new Date('2025-01-15');
    const periods = getUpcomingPeriods(date, 'monthly', 3);
    expect(periods).toHaveLength(3);
    expect(periods[0]).toBe('monthly-2025-01');
    expect(periods[1]).toBe('monthly-2025-02');
    expect(periods[2]).toBe('monthly-2025-03');
  });

  it('returns correct number of quarterly periods', () => {
    const date = new Date('2025-01-15');
    const periods = getUpcomingPeriods(date, 'quarterly', 2);
    expect(periods).toHaveLength(2);
    expect(periods[0]).toBe('quarterly-2025-Q1');
    expect(periods[1]).toBe('quarterly-2025-Q2');
  });
});

// ============================================================================
// Stable Key Tests
// ============================================================================

describe('generateRecurringDeliverableKey', () => {
  it('generates consistent stable key', () => {
    const key = generateRecurringDeliverableKey('strategy-qbr-narrative', 'quarterly-2025-Q1');
    expect(key).toBe('recurring::strategy-qbr-narrative::quarterly-2025-Q1');
  });

  it('produces unique keys for different periods', () => {
    const key1 = generateRecurringDeliverableKey('output-1', 'monthly-2025-01');
    const key2 = generateRecurringDeliverableKey('output-1', 'monthly-2025-02');
    expect(key1).not.toBe(key2);
  });
});

describe('parseRecurringDeliverableKey', () => {
  it('parses valid recurring key', () => {
    const parsed = parseRecurringDeliverableKey('recurring::strategy-qbr::quarterly-2025-Q1');
    expect(parsed).toEqual({
      outputId: 'strategy-qbr',
      periodKey: 'quarterly-2025-Q1',
    });
  });

  it('returns null for non-recurring key', () => {
    const parsed = parseRecurringDeliverableKey('pdel_abc123');
    expect(parsed).toBeNull();
  });

  it('returns null for invalid format', () => {
    const parsed = parseRecurringDeliverableKey('recurring::only-one-part');
    expect(parsed).toBeNull();
  });
});

// ============================================================================
// Format Tests
// ============================================================================

describe('formatPeriodLabel', () => {
  it('formats weekly period', () => {
    const label = formatPeriodLabel('weekly-2025-W03', 'weekly');
    expect(label).toBe('Week 03 2025');
  });

  it('formats monthly period', () => {
    const label = formatPeriodLabel('monthly-2025-03', 'monthly');
    expect(label).toBe('Mar 2025');
  });

  it('formats quarterly period', () => {
    const label = formatPeriodLabel('quarterly-2025-Q2', 'quarterly');
    expect(label).toBe('Q2 2025');
  });
});

// ============================================================================
// Main Engine Tests
// ============================================================================

describe('ensureUpcomingDeliverables', () => {
  describe('Domain Requirements', () => {
    it('errors if program has no domain', () => {
      const program = createMockProgram({ domain: undefined });
      const result = ensureUpcomingDeliverables(program);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('no domain');
    });

    it('works with valid domain', () => {
      const program = createMockProgram({ domain: 'Strategy' });
      const result = ensureUpcomingDeliverables(program);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Intensity Filtering', () => {
    it('respects Core intensity cadence', () => {
      const program = createMockProgram({
        domain: 'Strategy',
        intensity: 'Core',
      });
      const result = ensureUpcomingDeliverables(program, {
        asOf: new Date('2025-01-15'),
      });

      // Core only has quarterly cadence
      const createdCadences = result.created.map((c) => c.period.split('-')[0]);
      const hasDailyOrWeekly = createdCadences.some((c) => c === 'weekly' || c === 'daily');
      expect(hasDailyOrWeekly).toBe(false);
    });
  });

  describe('Idempotency', () => {
    it('skips existing deliverables by description', () => {
      const program = createMockProgram({
        domain: 'Strategy',
        scope: {
          summary: 'Test',
          deliverables: [
            {
              id: 'pdel_existing',
              title: 'Existing QBR',
              type: 'document',
              status: 'planned',
              description: 'recurring::strategy-qbr-narrative::quarterly-2025-Q1',
            },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const result = ensureUpcomingDeliverables(program, {
        asOf: new Date('2025-01-15'),
        periodsAhead: 1,
        cadences: ['quarterly'],
      });

      // Should skip the existing Q1 deliverable
      const skippedQ1 = result.skipped.some((s) => s.period === 'quarterly-2025-Q1');
      expect(skippedQ1).toBe(true);
    });
  });

  describe('Deliverable Creation', () => {
    it('creates deliverables with correct structure', () => {
      const program = createMockProgram({ domain: 'Strategy' });
      const result = ensureUpcomingDeliverables(program, {
        asOf: new Date('2025-01-15'),
        periodsAhead: 1,
        cadences: ['quarterly'],
      });

      if (result.created.length > 0) {
        const first = result.created[0];
        expect(first.deliverable.id).toMatch(/^pdel_/);
        expect(first.deliverable.title).toBeTruthy();
        expect(first.deliverable.dueDate).toBeTruthy();
        expect(first.deliverable.status).toBe('planned');
      }
    });

    it('sets due date based on period', () => {
      const program = createMockProgram({ domain: 'Strategy' });
      const result = ensureUpcomingDeliverables(program, {
        asOf: new Date('2025-01-15'),
        periodsAhead: 1,
        cadences: ['quarterly'],
      });

      const q1Deliverable = result.created.find((c) => c.period === 'quarterly-2025-Q1');
      if (q1Deliverable) {
        expect(q1Deliverable.deliverable.dueDate).toBe('2025-03-31');
      }
    });
  });
});

describe('getDeliverableCadenceSummary', () => {
  it('counts deliverables by cadence', () => {
    const program = createMockProgram({
      scope: {
        summary: 'Test',
        deliverables: [
          {
            id: 'pdel_1',
            title: 'Weekly 1',
            type: 'document',
            status: 'completed',
            description: 'recurring::output-1::weekly-2025-W01',
          },
          {
            id: 'pdel_2',
            title: 'Monthly 1',
            type: 'document',
            status: 'planned',
            description: 'recurring::output-2::monthly-2025-01',
          },
        ],
        workstreams: [],
        channels: [],
        constraints: [],
        assumptions: [],
        unknowns: [],
        dependencies: [],
      },
    });

    const summary = getDeliverableCadenceSummary(program);

    expect(summary.weekly.total).toBe(1);
    expect(summary.weekly.completed).toBe(1);
    expect(summary.monthly.total).toBe(1);
    expect(summary.monthly.completed).toBe(0);
  });
});

describe('summarizeDeliverableResults', () => {
  it('summarizes multiple results', () => {
    const results = [
      {
        programId: 'p1',
        programTitle: 'Program 1',
        created: [{ deliverable: {} as any, outputId: 'o1', period: 'q1', idempotencyKey: 'p1:o1:2025-01-01' }],
        skipped: [],
        errors: [],
      },
      {
        programId: 'p2',
        programTitle: 'Program 2',
        created: [
          { deliverable: {} as any, outputId: 'o2', period: 'q1', idempotencyKey: 'p2:o2:2025-01-01' },
          { deliverable: {} as any, outputId: 'o3', period: 'q1', idempotencyKey: 'p2:o3:2025-01-01' },
        ],
        skipped: [{ outputId: 'o4', reason: 'exists', period: 'q1', idempotencyKey: 'p2:o4:2025-01-01' }],
        errors: [],
      },
    ];

    const summary = summarizeDeliverableResults(results);

    expect(summary.totalCreated).toBe(3);
    expect(summary.totalSkipped).toBe(1);
    expect(summary.totalErrors).toBe(0);
    expect(summary.programsProcessed).toBe(2);
  });
});

// ============================================================================
// Timezone-Aware Period Math Tests
// ============================================================================

describe('DEFAULT_TIMEZONE', () => {
  it('is set to America/Los_Angeles', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Los_Angeles');
  });
});

describe('getPeriodStartISO', () => {
  describe('weekly', () => {
    it('returns Monday of the week for a Wednesday', () => {
      // Wednesday Jan 15, 2025
      const date = new Date(2025, 0, 15);
      const result = getPeriodStartISO(date, 'weekly');
      expect(result).toBe('2025-01-13'); // Monday
    });

    it('returns same day for a Monday', () => {
      // Monday Jan 13, 2025
      const date = new Date(2025, 0, 13);
      const result = getPeriodStartISO(date, 'weekly');
      expect(result).toBe('2025-01-13');
    });

    it('returns previous Monday for a Sunday', () => {
      // Sunday Jan 19, 2025
      const date = new Date(2025, 0, 19);
      const result = getPeriodStartISO(date, 'weekly');
      expect(result).toBe('2025-01-13');
    });
  });

  describe('monthly', () => {
    it('returns first of month', () => {
      const date = new Date(2025, 6, 15); // July 15
      const result = getPeriodStartISO(date, 'monthly');
      expect(result).toBe('2025-07-01');
    });

    it('pads single-digit months', () => {
      const date = new Date(2025, 0, 31); // Jan 31
      const result = getPeriodStartISO(date, 'monthly');
      expect(result).toBe('2025-01-01');
    });
  });

  describe('quarterly', () => {
    it('returns first of Q1', () => {
      const date = new Date(2025, 1, 15); // Feb 15
      const result = getPeriodStartISO(date, 'quarterly');
      expect(result).toBe('2025-01-01');
    });

    it('returns first of Q2', () => {
      const date = new Date(2025, 4, 15); // May 15
      const result = getPeriodStartISO(date, 'quarterly');
      expect(result).toBe('2025-04-01');
    });

    it('returns first of Q3', () => {
      const date = new Date(2025, 7, 15); // Aug 15
      const result = getPeriodStartISO(date, 'quarterly');
      expect(result).toBe('2025-07-01');
    });

    it('returns first of Q4', () => {
      const date = new Date(2025, 10, 15); // Nov 15
      const result = getPeriodStartISO(date, 'quarterly');
      expect(result).toBe('2025-10-01');
    });
  });
});

describe('generateIdempotencyKey', () => {
  it('generates key in expected format', () => {
    const date = new Date(2025, 0, 15); // Jan 15
    const key = generateIdempotencyKey('prog-123', 'content-batch', date, 'weekly');
    expect(key).toBe('prog-123:content-batch:2025-01-13');
  });

  it('produces consistent keys for same program/output/period', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 0, 17);

    // Both dates are in the same week (Jan 13-19)
    const key1 = generateIdempotencyKey('prog-123', 'report', date1, 'weekly');
    const key2 = generateIdempotencyKey('prog-123', 'report', date2, 'weekly');

    expect(key1).toBe(key2);
  });

  it('produces different keys for different periods', () => {
    const date1 = new Date(2025, 0, 15); // Week of Jan 13
    const date2 = new Date(2025, 0, 22); // Week of Jan 20

    const key1 = generateIdempotencyKey('prog-123', 'report', date1, 'weekly');
    const key2 = generateIdempotencyKey('prog-123', 'report', date2, 'weekly');

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different programs', () => {
    const date = new Date(2025, 0, 15);

    const key1 = generateIdempotencyKey('prog-123', 'report', date, 'weekly');
    const key2 = generateIdempotencyKey('prog-456', 'report', date, 'weekly');

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different outputs', () => {
    const date = new Date(2025, 0, 15);

    const key1 = generateIdempotencyKey('prog-123', 'report-a', date, 'weekly');
    const key2 = generateIdempotencyKey('prog-123', 'report-b', date, 'weekly');

    expect(key1).not.toBe(key2);
  });
});
