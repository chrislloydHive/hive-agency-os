// tests/jobs/jobNumbering.test.ts
// Tests for job numbering and concurrency safety

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Airtable
vi.mock('@/lib/airtable', () => ({
  getBase: vi.fn(() => mockBase),
}));

// Mock Airtable base
let mockCounterValue = 116;
let mockRecords: any[] = [];
let updateCallCount = 0;

const mockBase = vi.fn((tableName: string) => {
  if (tableName === 'Counters') {
    return {
      select: vi.fn(() => ({
        firstPage: vi.fn(async () => {
          if (mockRecords.length === 0) {
            return [];
          }
          return [
            {
              id: 'counter-rec-id',
              fields: {
                Name: 'jobNumber',
                Value: mockCounterValue,
              },
            },
          ];
        }),
      })),
      create: vi.fn(async (records: any[]) => {
        mockRecords.push(records[0]);
        mockCounterValue = records[0].fields.Value;
        return records.map((r, i) => ({
          id: `new-rec-${i}`,
          fields: r.fields,
        }));
      }),
      update: vi.fn(async (id: string, fields: any) => {
        updateCallCount++;
        // Simulate successful update
        mockCounterValue = fields.Value;
        return { id, fields };
      }),
    };
  }
  return {
    find: vi.fn(),
    select: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
});

describe('Job Number Reservation', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCounterValue = 116;
    mockRecords = [{ fields: { Name: 'jobNumber', Value: 116 } }];
    updateCallCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reserves next job number correctly', async () => {
    const { reserveNextJobNumber } = await import('@/lib/airtable/counters');

    const jobNumber = await reserveNextJobNumber();

    expect(jobNumber).toBe(117);
  });

  it('increments counter sequentially', async () => {
    const { reserveNextJobNumber } = await import('@/lib/airtable/counters');

    const first = await reserveNextJobNumber();
    const second = await reserveNextJobNumber();

    expect(first).toBe(117);
    expect(second).toBe(118);
  });

  it('initializes counter if not exists', async () => {
    mockRecords = []; // No existing counter

    const { initializeCounter, COUNTER_NAMES } = await import('@/lib/airtable/counters');

    const result = await initializeCounter(COUNTER_NAMES.JOB_NUMBER, 116);

    expect(result).toBe(true);
    expect(mockRecords.length).toBe(1);
  });

  it('does not reinitialize existing counter', async () => {
    const { initializeCounter, COUNTER_NAMES } = await import('@/lib/airtable/counters');

    const result = await initializeCounter(COUNTER_NAMES.JOB_NUMBER, 200);

    expect(result).toBe(true);
    // Value should still be 116, not 200
    expect(mockCounterValue).toBe(116);
  });
});

describe('Job Number Uniqueness', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCounterValue = 116;
    mockRecords = [{ fields: { Name: 'jobNumber', Value: 116 } }];
    updateCallCount = 0;
  });

  it('generates unique job numbers', async () => {
    const { reserveNextJobNumber } = await import('@/lib/airtable/counters');

    const numbers = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const num = await reserveNextJobNumber();
      if (num !== null) {
        expect(numbers.has(num)).toBe(false);
        numbers.add(num);
      }
    }

    expect(numbers.size).toBe(10);
  });

  it('job codes are unique when using unique numbers', async () => {
    const { generateJobCode } = await import('@/lib/types/job');

    const codes = new Set<string>();
    const clientCode = 'CAR';

    for (let jobNumber = 117; jobNumber < 127; jobNumber++) {
      const code = generateJobCode(jobNumber, clientCode);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }

    expect(codes.size).toBe(10);
  });
});

describe('Counter Edge Cases', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRecords = [{ fields: { Name: 'jobNumber', Value: 116 } }];
  });

  it('handles large job numbers', async () => {
    mockCounterValue = 99999;
    mockRecords = [{ fields: { Name: 'jobNumber', Value: 99999 } }];

    const { reserveNextJobNumber } = await import('@/lib/airtable/counters');

    const num = await reserveNextJobNumber();
    expect(num).toBe(100000);
  });

  it('counter starts at 116 when auto-initialized', async () => {
    mockRecords = []; // No existing counter

    const { reserveNextJobNumber, getCounter, COUNTER_NAMES } = await import(
      '@/lib/airtable/counters'
    );

    // First call should initialize at 116, then increment to 117
    const num = await reserveNextJobNumber();

    // Check that counter was created
    expect(mockRecords.length).toBe(1);
    expect(mockRecords[0].fields.Value).toBe(116);
  });
});

describe('Concurrent Access Simulation', () => {
  it('handles rapid sequential calls', async () => {
    vi.resetModules();
    mockCounterValue = 116;
    mockRecords = [{ fields: { Name: 'jobNumber', Value: 116 } }];
    updateCallCount = 0;

    const { reserveNextJobNumber } = await import('@/lib/airtable/counters');

    // Simulate rapid sequential calls
    const results: (number | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const num = await reserveNextJobNumber();
      results.push(num);
    }

    // All should be unique and sequential
    expect(results).toEqual([117, 118, 119, 120, 121]);

    // Should have called update for each reservation
    expect(updateCallCount).toBe(5);
  });
});
