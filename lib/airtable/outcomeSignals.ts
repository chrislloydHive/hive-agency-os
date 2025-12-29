// lib/airtable/outcomeSignals.ts
// Airtable CRUD for OutcomeSignals table

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  OutcomeSignal,
  OutcomeSignalSource,
  OutcomeSignalType,
  OutcomeSignalConfidence,
} from '@/lib/types/outcomeSignal';

// ============================================================================
// Types
// ============================================================================

export interface OutcomeSignalRecord extends OutcomeSignal {
  companyId: string;
  demoTag?: string;
  seedRunId?: string;
}

export interface CreateOutcomeSignalInput {
  id?: string; // Optional deterministic ID
  companyId: string;
  strategyId: string;
  source: OutcomeSignalSource;
  sourceId: string;
  signalType: OutcomeSignalType;
  confidence: OutcomeSignalConfidence;
  summary: string;
  evidence?: string[];
  tacticIds?: string[];
  objectiveIds?: string[];
  createdAt: string;
  demoTag?: string;
  seedRunId?: string;
}

export interface ListOutcomeSignalsOptions {
  companyId?: string;
  strategyId?: string;
  demoTag?: string;
  since?: string;
  limit?: number;
}

// ============================================================================
// Record Mapper
// ============================================================================

function parseJsonArray<T = string>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      // Maybe it's a comma-separated string
      return value.split(',').map(s => s.trim()).filter(Boolean) as T[];
    }
  }
  return [];
}

function recordToOutcomeSignal(record: {
  id: string;
  get: (field: string) => unknown;
}): OutcomeSignalRecord {
  return {
    id: record.id,
    companyId: (record.get('Company ID') as string) || '',
    source: (record.get('Source') as OutcomeSignalSource) || 'manual',
    sourceId: (record.get('Source ID') as string) || '',
    signalType: (record.get('Signal Type') as OutcomeSignalType) || 'learning',
    confidence: (record.get('Confidence') as OutcomeSignalConfidence) || 'medium',
    summary: (record.get('Summary') as string) || '',
    evidence: parseJsonArray<string>(record.get('Evidence')),
    createdAt: (record.get('Created At') as string) || new Date().toISOString(),
    strategyId: (record.get('Strategy ID') as string) || undefined,
    tacticIds: parseJsonArray<string>(record.get('Tactic IDs')),
    objectiveIds: parseJsonArray<string>(record.get('Objective IDs')),
    demoTag: (record.get('Demo Tag') as string) || undefined,
    seedRunId: (record.get('Seed Run ID') as string) || undefined,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * List outcome signals with optional filters
 */
export async function listOutcomeSignals(
  options?: ListOutcomeSignalsOptions
): Promise<OutcomeSignalRecord[]> {
  try {
    const base = getAirtableBase();
    const filterParts: string[] = [];

    if (options?.companyId) {
      filterParts.push(`{Company ID} = '${options.companyId}'`);
    }
    if (options?.strategyId) {
      filterParts.push(`{Strategy ID} = '${options.strategyId}'`);
    }
    if (options?.demoTag) {
      filterParts.push(`{Demo Tag} = '${options.demoTag}'`);
    }
    if (options?.since) {
      filterParts.push(`IS_AFTER({Created At}, '${options.since}')`);
    }

    const filterFormula =
      filterParts.length > 0
        ? filterParts.length === 1
          ? filterParts[0]
          : `AND(${filterParts.join(', ')})`
        : '';

    const records = await base(AIRTABLE_TABLES.OUTCOME_SIGNALS)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: options?.limit || 100,
      })
      .all();

    return records.map(recordToOutcomeSignal);
  } catch (error) {
    console.error('[outcomeSignals] Failed to list signals:', error);
    return [];
  }
}

/**
 * Get a single outcome signal by ID
 */
export async function getOutcomeSignal(id: string): Promise<OutcomeSignalRecord | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.OUTCOME_SIGNALS).find(id);
    return recordToOutcomeSignal(record);
  } catch (error) {
    console.error('[outcomeSignals] Failed to get signal:', error);
    return null;
  }
}

/**
 * Create a single outcome signal
 */
export async function createOutcomeSignal(
  input: CreateOutcomeSignalInput
): Promise<OutcomeSignalRecord> {
  const base = getAirtableBase();

  const fields: Record<string, unknown> = {
    'Company ID': input.companyId,
    'Strategy ID': input.strategyId,
    'Source': input.source,
    'Source ID': input.sourceId,
    'Signal Type': input.signalType,
    'Confidence': input.confidence,
    'Summary': input.summary,
    'Created At': input.createdAt,
  };

  if (input.evidence?.length) fields['Evidence'] = JSON.stringify(input.evidence);
  if (input.tacticIds?.length) fields['Tactic IDs'] = JSON.stringify(input.tacticIds);
  if (input.objectiveIds?.length) fields['Objective IDs'] = JSON.stringify(input.objectiveIds);
  if (input.demoTag) fields['Demo Tag'] = input.demoTag;
  if (input.seedRunId) fields['Seed Run ID'] = input.seedRunId;

  const records = await base(AIRTABLE_TABLES.OUTCOME_SIGNALS).create(
    [{ fields }] as any
  ) as unknown as Array<{ id: string; get: (field: string) => unknown }>;
  return recordToOutcomeSignal(records[0]);
}

/**
 * Create multiple outcome signals in batch
 */
export async function createOutcomeSignals(
  inputs: CreateOutcomeSignalInput[]
): Promise<OutcomeSignalRecord[]> {
  if (inputs.length === 0) return [];

  const base = getAirtableBase();
  const results: OutcomeSignalRecord[] = [];

  // Airtable batches max 10 records at a time
  const batches = [];
  for (let i = 0; i < inputs.length; i += 10) {
    batches.push(inputs.slice(i, i + 10));
  }

  for (const batch of batches) {
    const recordsToCreate = batch.map((input) => {
      const fields: Record<string, unknown> = {
        'Company ID': input.companyId,
        'Strategy ID': input.strategyId,
        'Source': input.source,
        'Source ID': input.sourceId,
        'Signal Type': input.signalType,
        'Confidence': input.confidence,
        'Summary': input.summary,
        'Created At': input.createdAt,
      };

      if (input.evidence?.length) fields['Evidence'] = JSON.stringify(input.evidence);
      if (input.tacticIds?.length) fields['Tactic IDs'] = JSON.stringify(input.tacticIds);
      if (input.objectiveIds?.length) fields['Objective IDs'] = JSON.stringify(input.objectiveIds);
      if (input.demoTag) fields['Demo Tag'] = input.demoTag;
      if (input.seedRunId) fields['Seed Run ID'] = input.seedRunId;

      return { fields };
    });

    const created = await base(AIRTABLE_TABLES.OUTCOME_SIGNALS).create(
      recordsToCreate as any
    ) as unknown as Array<{ id: string; get: (field: string) => unknown }>;
    results.push(...created.map(recordToOutcomeSignal));
  }

  return results;
}

/**
 * Delete outcome signals by IDs
 */
export async function deleteOutcomeSignals(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;

  try {
    const base = getAirtableBase();

    // Airtable batches max 10 records at a time
    const batches = [];
    for (let i = 0; i < ids.length; i += 10) {
      batches.push(ids.slice(i, i + 10));
    }

    for (const batch of batches) {
      await base(AIRTABLE_TABLES.OUTCOME_SIGNALS).destroy(batch);
    }

    return true;
  } catch (error) {
    console.error('[outcomeSignals] Failed to delete signals:', error);
    return false;
  }
}

/**
 * Delete demo-tagged signals for a specific strategy
 */
export async function deleteDemoSignals(
  companyId: string,
  strategyId: string,
  demoTag: string
): Promise<number> {
  try {
    const signals = await listOutcomeSignals({
      companyId,
      strategyId,
      demoTag,
      limit: 1000,
    });

    if (signals.length === 0) return 0;

    await deleteOutcomeSignals(signals.map((s) => s.id));
    return signals.length;
  } catch (error) {
    console.error('[outcomeSignals] Failed to delete demo signals:', error);
    return 0;
  }
}

/**
 * Get signals for strategy (used by proposal generation)
 */
export async function getSignalsForStrategy(
  companyId: string,
  strategyId: string,
  options?: { since?: string }
): Promise<OutcomeSignalRecord[]> {
  return listOutcomeSignals({
    companyId,
    strategyId,
    since: options?.since,
    limit: 100,
  });
}
