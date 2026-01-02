// lib/airtable/counters.ts
// Airtable helpers for Counters table (atomic sequence numbers)
//
// The Counters table stores global counters like job numbers.
// Uses optimistic locking with retries to ensure concurrency safety.

import { getBase } from '@/lib/airtable';

const COUNTERS_TABLE = 'Counters';

// ============================================================================
// Field Mappings
// ============================================================================

const COUNTERS_FIELDS = {
  NAME: 'Name', // Primary key
  VALUE: 'Value', // Number
  UPDATED_AT: 'Updated At', // For detecting concurrent updates
} as const;

// ============================================================================
// Counter Names
// ============================================================================

export const COUNTER_NAMES = {
  JOB_NUMBER: 'jobNumber',
} as const;

export type CounterName = (typeof COUNTER_NAMES)[keyof typeof COUNTER_NAMES];

// ============================================================================
// Counter Operations
// ============================================================================

/**
 * Get current value of a counter
 */
export async function getCounter(name: CounterName): Promise<number | null> {
  try {
    const base = getBase();
    const records = await base(COUNTERS_TABLE)
      .select({
        filterByFormula: `{${COUNTERS_FIELDS.NAME}} = "${name}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return records[0].fields[COUNTERS_FIELDS.VALUE] as number;
  } catch (error) {
    console.error(`[Counters] Failed to get counter ${name}:`, error);
    return null;
  }
}

/**
 * Initialize a counter if it doesn't exist
 */
export async function initializeCounter(name: CounterName, initialValue: number): Promise<boolean> {
  try {
    const base = getBase();

    // Check if exists
    const existing = await getCounter(name);
    if (existing !== null) {
      console.log(`[Counters] Counter ${name} already exists with value ${existing}`);
      return true;
    }

    // Create new counter
    await base(COUNTERS_TABLE).create([
      {
        fields: {
          [COUNTERS_FIELDS.NAME]: name,
          [COUNTERS_FIELDS.VALUE]: initialValue,
        } as any,
      },
    ]);

    console.log(`[Counters] Initialized counter ${name} with value ${initialValue}`);
    return true;
  } catch (error) {
    console.error(`[Counters] Failed to initialize counter ${name}:`, error);
    return false;
  }
}

/**
 * Reserve the next value for a counter (atomic increment)
 *
 * Uses optimistic locking with retries:
 * 1. Read current value and record timestamp
 * 2. Attempt to update with incremented value
 * 3. If conflict detected (value changed), retry
 *
 * @param name - Counter name
 * @param maxRetries - Maximum number of retries on conflict (default: 5)
 * @returns Reserved value, or null on failure
 */
export async function reserveNextValue(
  name: CounterName,
  maxRetries: number = 5
): Promise<number | null> {
  const base = getBase();
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;

    try {
      // 1. Get current record
      const records = await base(COUNTERS_TABLE)
        .select({
          filterByFormula: `{${COUNTERS_FIELDS.NAME}} = "${name}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length === 0) {
        console.error(`[Counters] Counter ${name} not found`);
        return null;
      }

      const record = records[0];
      const currentValue = record.fields[COUNTERS_FIELDS.VALUE] as number;
      const nextValue = currentValue + 1;

      // 2. Attempt optimistic update
      // Airtable doesn't have true atomic operations, so we use the record ID
      // and check for update success. If another process updated in between,
      // we'll catch the discrepancy on the next read.
      await base(COUNTERS_TABLE).update(record.id, {
        [COUNTERS_FIELDS.VALUE]: nextValue,
      } as any);

      // 3. Verify the update (read back)
      const verifyRecords = await base(COUNTERS_TABLE)
        .select({
          filterByFormula: `{${COUNTERS_FIELDS.NAME}} = "${name}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (verifyRecords.length === 0) {
        throw new Error('Counter record disappeared');
      }

      const verifiedValue = verifyRecords[0].fields[COUNTERS_FIELDS.VALUE] as number;

      // If our expected value matches, we won the race
      if (verifiedValue === nextValue) {
        console.log(`[Counters] Reserved ${name}: ${nextValue} (attempt ${attempts})`);
        return nextValue;
      }

      // Someone else updated - the value is higher than expected
      // We need to retry with the new base value
      console.warn(
        `[Counters] Conflict detected for ${name}: expected ${nextValue}, got ${verifiedValue}. Retrying...`
      );

      // Small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    } catch (error: any) {
      // Check for rate limit
      if (error?.statusCode === 429) {
        console.warn(`[Counters] Rate limited, retrying in 1s...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      console.error(`[Counters] Error reserving ${name} (attempt ${attempts}):`, error);

      if (attempts >= maxRetries) {
        throw error;
      }

      // Retry with backoff
      await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
    }
  }

  console.error(`[Counters] Failed to reserve ${name} after ${maxRetries} attempts`);
  return null;
}

/**
 * Reserve the next job number
 *
 * Convenience wrapper for reserveNextValue with the job number counter.
 * Will auto-initialize the counter starting at 116 if it doesn't exist.
 */
export async function reserveNextJobNumber(): Promise<number | null> {
  // Ensure counter exists (starting at 116 per the spec - next will be 117)
  const current = await getCounter(COUNTER_NAMES.JOB_NUMBER);
  if (current === null) {
    const initialized = await initializeCounter(COUNTER_NAMES.JOB_NUMBER, 116);
    if (!initialized) {
      console.error('[Counters] Failed to initialize job number counter');
      return null;
    }
  }

  return reserveNextValue(COUNTER_NAMES.JOB_NUMBER);
}
