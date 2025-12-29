// lib/airtable/strategyVersions.ts
// Airtable CRUD for Strategy Versions
//
// Stores versioned snapshots of strategy state for evolution history.
// Versions are immutable once created - new changes create new versions.

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  StrategyVersion,
  StrategySnapshot,
} from '@/lib/types/strategyEvolution';
import {
  generateVersionId,
  hashSnapshot,
} from '@/lib/types/strategyEvolution';

// ============================================================================
// Types
// ============================================================================

export interface CreateVersionInput {
  companyId: string;
  strategyId: string;
  snapshot: StrategySnapshot;
  trigger: StrategyVersion['trigger'];
  eventId?: string;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get the latest version for a strategy
 */
export async function getLatestStrategyVersion(
  strategyId: string
): Promise<StrategyVersion | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_VERSIONS)
      .select({
        filterByFormula: `{strategyId} = '${strategyId}'`,
        sort: [{ field: 'versionNumber', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToVersion(records[0]);
  } catch (error) {
    console.error('[strategyVersions] Failed to get latest version:', error);
    return null;
  }
}

/**
 * Get a specific version by ID
 */
export async function getStrategyVersion(
  versionId: string
): Promise<StrategyVersion | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_VERSIONS)
      .select({
        filterByFormula: `{versionId} = '${versionId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToVersion(records[0]);
  } catch (error) {
    console.error('[strategyVersions] Failed to get version:', error);
    return null;
  }
}

/**
 * Get a version by number
 */
export async function getStrategyVersionByNumber(
  strategyId: string,
  versionNumber: number
): Promise<StrategyVersion | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_VERSIONS)
      .select({
        filterByFormula: `AND({strategyId} = '${strategyId}', {versionNumber} = ${versionNumber})`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToVersion(records[0]);
  } catch (error) {
    console.error('[strategyVersions] Failed to get version by number:', error);
    return null;
  }
}

/**
 * List all versions for a strategy
 */
export async function listStrategyVersions(
  strategyId: string,
  options?: { limit?: number; offset?: number }
): Promise<StrategyVersion[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_VERSIONS)
      .select({
        filterByFormula: `{strategyId} = '${strategyId}'`,
        sort: [{ field: 'versionNumber', direction: 'desc' }],
        maxRecords: options?.limit || 100,
      })
      .all();

    const versions = records.map(recordToVersion);

    if (options?.offset) {
      return versions.slice(options.offset);
    }

    return versions;
  } catch (error) {
    console.error('[strategyVersions] Failed to list versions:', error);
    return [];
  }
}

/**
 * Create a new version
 * Idempotent by snapshot hash - won't create duplicate if same content exists
 */
export async function createStrategyVersion(
  input: CreateVersionInput
): Promise<StrategyVersion> {
  const snapshotHash = hashSnapshot(input.snapshot);

  // Check for existing version with same hash (idempotency)
  const existing = await getVersionByHash(input.strategyId, snapshotHash);
  if (existing) {
    console.log(`[strategyVersions] Version with hash ${snapshotHash} already exists, returning existing`);
    return existing;
  }

  // Get latest version number
  const latest = await getLatestStrategyVersion(input.strategyId);
  const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

  const base = getAirtableBase();
  const now = new Date().toISOString();
  const versionId = generateVersionId();

  await base(AIRTABLE_TABLES.STRATEGY_VERSIONS).create([
    {
      fields: {
        versionId,
        companyId: input.companyId,
        strategyId: input.strategyId,
        versionNumber: nextVersionNumber,
        snapshotHash,
        snapshot: JSON.stringify(input.snapshot),
        trigger: input.trigger,
        eventId: input.eventId || undefined,
        createdAt: now,
      },
    },
  ] as any);

  return {
    id: versionId,
    companyId: input.companyId,
    strategyId: input.strategyId,
    versionNumber: nextVersionNumber,
    snapshotHash,
    snapshot: input.snapshot,
    trigger: input.trigger,
    eventId: input.eventId,
    createdAt: now,
  };
}

/**
 * Get or create initial version (v1)
 * Creates baseline if no versions exist
 */
export async function getOrCreateInitialVersion(
  companyId: string,
  strategyId: string,
  snapshot: StrategySnapshot
): Promise<StrategyVersion> {
  const existing = await getLatestStrategyVersion(strategyId);
  if (existing) {
    return existing;
  }

  return createStrategyVersion({
    companyId,
    strategyId,
    snapshot,
    trigger: 'initial',
  });
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get version by snapshot hash (for idempotency)
 */
async function getVersionByHash(
  strategyId: string,
  snapshotHash: string
): Promise<StrategyVersion | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_VERSIONS)
      .select({
        filterByFormula: `AND({strategyId} = '${strategyId}', {snapshotHash} = '${snapshotHash}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToVersion(records[0]);
  } catch (error) {
    console.error('[strategyVersions] Failed to get version by hash:', error);
    return null;
  }
}

/**
 * Convert Airtable record to StrategyVersion
 */
function recordToVersion(record: {
  id: string;
  get: (field: string) => unknown;
}): StrategyVersion {
  let snapshot: StrategySnapshot;
  try {
    const snapshotStr = record.get('snapshot') as string;
    snapshot = JSON.parse(snapshotStr);
  } catch {
    snapshot = {
      strategyId: (record.get('strategyId') as string) || '',
      objectives: [],
      pillars: [],
      tactics: [],
      title: '',
      summary: '',
      status: 'draft',
    };
  }

  return {
    id: (record.get('versionId') as string) || record.id,
    companyId: (record.get('companyId') as string) || '',
    strategyId: (record.get('strategyId') as string) || '',
    versionNumber: (record.get('versionNumber') as number) || 1,
    snapshotHash: (record.get('snapshotHash') as string) || '',
    snapshot,
    trigger: (record.get('trigger') as StrategyVersion['trigger']) || 'manual',
    eventId: record.get('eventId') as string | undefined,
    createdAt: (record.get('createdAt') as string) || new Date().toISOString(),
  };
}
