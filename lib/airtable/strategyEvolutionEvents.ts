// lib/airtable/strategyEvolutionEvents.ts
// Airtable CRUD for Strategy Evolution Events
//
// Stores append-only evolution history for strategy changes.
// Each event captures the before/after state and diff summary.
// Events are never deleted - rollbacks create new events.

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  StrategyEvolutionEvent,
  DiffSummary,
} from '@/lib/types/strategyEvolution';
import type { StrategyRevisionChange, RevisionConfidence, StrategyRevisionTarget } from '@/lib/types/strategyRevision';
import {
  generateDeterministicEventId,
  generateDeterministicRollbackEventId,
} from '@/lib/types/strategyEvolution';

// ============================================================================
// Types
// ============================================================================

export interface CreateEventInput {
  companyId: string;
  strategyId: string;
  proposalId?: string;
  title: string;
  target: StrategyRevisionTarget;
  changes: StrategyRevisionChange[];
  confidenceAtApply: RevisionConfidence;
  evidenceSignalIds: string[];
  evidenceSnippets: string[];
  versionFrom: number;
  versionTo: number;
  snapshotHashBefore: string;
  snapshotHashAfter: string;
  diffSummary: DiffSummary;
  rollbackOfEventId?: string;
  createdBy?: string;
}

export interface CreateRollbackEventInput {
  companyId: string;
  strategyId: string;
  rollbackOfEventId: string;
  versionFrom: number;
  versionTo: number;
  snapshotHashBefore: string;
  snapshotHashAfter: string;
  diffSummary: DiffSummary;
  createdBy?: string;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * List evolution events for a strategy
 */
export async function listEvolutionEvents(
  strategyId: string,
  options?: { limit?: number; includeRolledBack?: boolean }
): Promise<StrategyEvolutionEvent[]> {
  try {
    const base = getAirtableBase();

    let filterFormula = `{strategyId} = '${strategyId}'`;
    if (!options?.includeRolledBack) {
      filterFormula = `AND(${filterFormula}, OR({rolledBack} = FALSE(), {rolledBack} = BLANK()))`;
    }

    const records = await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: options?.limit || 50,
      })
      .all();

    return records.map(recordToEvent);
  } catch (error) {
    console.error('[strategyEvolutionEvents] Failed to list events:', error);
    return [];
  }
}

/**
 * Get a single evolution event by ID
 */
export async function getEvolutionEvent(
  eventId: string
): Promise<StrategyEvolutionEvent | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS)
      .select({
        filterByFormula: `{eventId} = '${eventId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToEvent(records[0]);
  } catch (error) {
    console.error('[strategyEvolutionEvents] Failed to get event:', error);
    return null;
  }
}

/**
 * Create a new evolution event (idempotent by deterministic ID)
 *
 * Uses a deterministic event ID based on:
 * hash(strategyId + proposalId + snapshotHashBefore + snapshotHashAfter)
 *
 * If an event with this ID already exists, returns the existing event.
 */
export async function createEvolutionEvent(
  input: CreateEventInput
): Promise<StrategyEvolutionEvent> {
  // Generate deterministic event ID for idempotency
  const eventId = generateDeterministicEventId(
    input.strategyId,
    input.proposalId,
    input.snapshotHashBefore,
    input.snapshotHashAfter
  );

  // Check if event already exists (idempotency)
  const existing = await getEvolutionEvent(eventId);
  if (existing) {
    console.log(`[strategyEvolutionEvents] Event ${eventId} already exists, returning existing`);
    return existing;
  }

  const base = getAirtableBase();
  const now = new Date().toISOString();

  await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS).create([
    {
      fields: {
        eventId,
        companyId: input.companyId,
        strategyId: input.strategyId,
        proposalId: input.proposalId || undefined,
        title: input.title,
        target: input.target,
        changes: JSON.stringify(input.changes),
        confidenceAtApply: input.confidenceAtApply,
        evidenceSignalIds: JSON.stringify(input.evidenceSignalIds),
        evidenceSnippets: JSON.stringify(input.evidenceSnippets),
        versionFrom: input.versionFrom,
        versionTo: input.versionTo,
        snapshotHashBefore: input.snapshotHashBefore,
        snapshotHashAfter: input.snapshotHashAfter,
        diffSummary: JSON.stringify(input.diffSummary),
        rollbackOfEventId: input.rollbackOfEventId || undefined,
        rolledBack: false,
        createdAt: now,
        createdBy: input.createdBy || undefined,
      },
    },
  ] as any);

  return {
    id: eventId,
    companyId: input.companyId,
    strategyId: input.strategyId,
    proposalId: input.proposalId,
    title: input.title,
    target: input.target,
    changes: input.changes,
    confidenceAtApply: input.confidenceAtApply,
    evidenceSignalIds: input.evidenceSignalIds,
    evidenceSnippets: input.evidenceSnippets,
    versionFrom: input.versionFrom,
    versionTo: input.versionTo,
    snapshotHashBefore: input.snapshotHashBefore,
    snapshotHashAfter: input.snapshotHashAfter,
    diffSummary: input.diffSummary,
    rollbackOfEventId: input.rollbackOfEventId,
    rolledBack: false,
    createdAt: now,
    createdBy: input.createdBy,
  };
}

/**
 * Create a rollback event (idempotent by deterministic ID)
 * Also marks the original event as rolled back
 *
 * Uses a deterministic event ID based on:
 * hash("rollback" + strategyId + rollbackOfEventId + snapshotHashBefore + snapshotHashAfter)
 */
export async function createRollbackEvent(
  input: CreateRollbackEventInput
): Promise<StrategyEvolutionEvent> {
  // Generate deterministic rollback event ID for idempotency
  const eventId = generateDeterministicRollbackEventId(
    input.strategyId,
    input.rollbackOfEventId,
    input.snapshotHashBefore,
    input.snapshotHashAfter
  );

  // Check if rollback event already exists (idempotency)
  const existing = await getEvolutionEvent(eventId);
  if (existing) {
    console.log(`[strategyEvolutionEvents] Rollback event ${eventId} already exists, returning existing`);
    return existing;
  }

  // Get the original event
  const originalEvent = await getEvolutionEvent(input.rollbackOfEventId);
  if (!originalEvent) {
    throw new Error(`Original event ${input.rollbackOfEventId} not found`);
  }

  const base = getAirtableBase();
  const now = new Date().toISOString();

  // Create the rollback event with "Restore" wording
  const title = `Restore to v${originalEvent.versionFrom}: ${originalEvent.title}`;

  await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS).create([
    {
      fields: {
        eventId,
        companyId: input.companyId,
        strategyId: input.strategyId,
        title,
        target: originalEvent.target,
        changes: JSON.stringify([]), // Restore doesn't have changes, it restores
        confidenceAtApply: 'high', // Restores are confident (user decided)
        evidenceSignalIds: JSON.stringify([]),
        evidenceSnippets: JSON.stringify(['User requested restore to previous version']),
        versionFrom: input.versionFrom,
        versionTo: input.versionTo,
        snapshotHashBefore: input.snapshotHashBefore,
        snapshotHashAfter: input.snapshotHashAfter,
        diffSummary: JSON.stringify(input.diffSummary),
        rollbackOfEventId: input.rollbackOfEventId,
        rolledBack: false,
        createdAt: now,
        createdBy: input.createdBy || undefined,
      },
    },
  ] as any);

  // Mark original event as rolled back
  await markEventAsRolledBack(input.rollbackOfEventId, eventId);

  return {
    id: eventId,
    companyId: input.companyId,
    strategyId: input.strategyId,
    title,
    target: originalEvent.target,
    changes: [],
    confidenceAtApply: 'high',
    evidenceSignalIds: [],
    evidenceSnippets: ['User requested restore to previous version'],
    versionFrom: input.versionFrom,
    versionTo: input.versionTo,
    snapshotHashBefore: input.snapshotHashBefore,
    snapshotHashAfter: input.snapshotHashAfter,
    diffSummary: input.diffSummary,
    rollbackOfEventId: input.rollbackOfEventId,
    rolledBack: false,
    createdAt: now,
    createdBy: input.createdBy,
  };
}

/**
 * Mark an event as rolled back
 */
async function markEventAsRolledBack(
  eventId: string,
  rolledBackByEventId: string
): Promise<void> {
  try {
    const base = getAirtableBase();

    // Find the record
    const records = await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS)
      .select({
        filterByFormula: `{eventId} = '${eventId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return;

    // Update it
    await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS).update([
      {
        id: records[0].id,
        fields: {
          rolledBack: true,
          rolledBackByEventId,
        },
      },
    ] as any);
  } catch (error) {
    console.error('[strategyEvolutionEvents] Failed to mark event as rolled back:', error);
  }
}

/**
 * Get events count for a strategy
 */
export async function getEventsCount(strategyId: string): Promise<number> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_EVOLUTION_EVENTS)
      .select({
        filterByFormula: `{strategyId} = '${strategyId}'`,
        fields: ['eventId'],
      })
      .all();

    return records.length;
  } catch (error) {
    console.error('[strategyEvolutionEvents] Failed to get events count:', error);
    return 0;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert Airtable record to StrategyEvolutionEvent
 */
function recordToEvent(record: {
  id: string;
  get: (field: string) => unknown;
}): StrategyEvolutionEvent {
  return {
    id: (record.get('eventId') as string) || record.id,
    companyId: (record.get('companyId') as string) || '',
    strategyId: (record.get('strategyId') as string) || '',
    proposalId: record.get('proposalId') as string | undefined,
    title: (record.get('title') as string) || '',
    target: (record.get('target') as StrategyRevisionTarget) || 'tactics',
    changes: parseJsonArray<StrategyRevisionChange>(record.get('changes')),
    confidenceAtApply: (record.get('confidenceAtApply') as RevisionConfidence) || 'medium',
    evidenceSignalIds: parseJsonArray<string>(record.get('evidenceSignalIds')),
    evidenceSnippets: parseJsonArray<string>(record.get('evidenceSnippets')),
    versionFrom: (record.get('versionFrom') as number) || 0,
    versionTo: (record.get('versionTo') as number) || 0,
    snapshotHashBefore: (record.get('snapshotHashBefore') as string) || '',
    snapshotHashAfter: (record.get('snapshotHashAfter') as string) || '',
    diffSummary: parseJsonObject<DiffSummary>(record.get('diffSummary')) || {
      added: 0,
      removed: 0,
      modified: 0,
      summary: '',
      changes: [],
      impactScore: 0,
      riskFlags: [],
    },
    rollbackOfEventId: record.get('rollbackOfEventId') as string | undefined,
    rolledBack: Boolean(record.get('rolledBack')),
    rolledBackByEventId: record.get('rolledBackByEventId') as string | undefined,
    createdAt: (record.get('createdAt') as string) || new Date().toISOString(),
    createdBy: record.get('createdBy') as string | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse JSON object from Airtable field
 */
function parseJsonObject<T = unknown>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}
