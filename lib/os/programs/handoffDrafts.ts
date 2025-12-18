// lib/os/programs/handoffDrafts.ts
// CRUD operations for Program Handoff Drafts
//
// Manages the ProgramHandoffDrafts Airtable table for storing
// AI-generated program drafts awaiting user approval.

import { base } from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  ProgramHandoffDraft,
  CreateHandoffDraftRequest,
  generateDraftKey,
} from '@/lib/types/programHandoff';

const TABLE_NAME = AIRTABLE_TABLES.PROGRAM_HANDOFF_DRAFTS;

// ============================================================================
// Field Names (matching Airtable schema)
// ============================================================================

const FIELDS = {
  COMPANY_ID: 'companyId',
  STRATEGY_ID: 'strategyId',
  STRATEGY_TITLE: 'strategyTitle',
  DRAFT_KEY: 'draftKey',
  TACTIC_IDS: 'tacticIds',
  PROGRAMS: 'programs',
  REASONING: 'reasoning',
  WARNINGS: 'warnings',
  BASED_ON_HASHES: 'basedOnHashes',
  LINKED_OBJECTIVE_IDS: 'linkedObjectiveIds',
  LINKED_PRIORITY_IDS: 'linkedPriorityIds',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

// ============================================================================
// JSON Parsing Helpers
// ============================================================================

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T>(value: unknown): T | undefined {
  if (typeof value === 'object' && value !== null) return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ============================================================================
// Record Mapping
// ============================================================================

function mapRecordToDraft(record: any): ProgramHandoffDraft {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields[FIELDS.COMPANY_ID] || '',
    strategyId: fields[FIELDS.STRATEGY_ID] || '',
    strategyTitle: fields[FIELDS.STRATEGY_TITLE] || '',
    draftKey: fields[FIELDS.DRAFT_KEY] || '',
    tacticIds: parseJsonArray<string>(fields[FIELDS.TACTIC_IDS]),
    programs: parseJsonArray(fields[FIELDS.PROGRAMS]),
    reasoning: fields[FIELDS.REASONING] || '',
    warnings: parseJsonArray<string>(fields[FIELDS.WARNINGS]),
    basedOnHashes: parseJsonObject(fields[FIELDS.BASED_ON_HASHES]) || {},
    linkedObjectiveIds: parseJsonArray<string>(fields[FIELDS.LINKED_OBJECTIVE_IDS]),
    linkedPriorityIds: parseJsonArray<string>(fields[FIELDS.LINKED_PRIORITY_IDS]),
    createdAt: fields[FIELDS.CREATED_AT] || new Date().toISOString(),
    updatedAt: fields[FIELDS.UPDATED_AT] || new Date().toISOString(),
  };
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all handoff drafts for a company
 */
export async function getHandoffDraftsForCompany(
  companyId: string
): Promise<ProgramHandoffDraft[]> {
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `{${FIELDS.COMPANY_ID}} = '${companyId}'`,
        sort: [{ field: FIELDS.CREATED_AT, direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToDraft);
  } catch (error) {
    console.error('[handoffDrafts] Error fetching drafts for company:', error);
    return [];
  }
}

/**
 * Get a specific handoff draft by ID
 */
export async function getHandoffDraftById(
  draftId: string
): Promise<ProgramHandoffDraft | null> {
  try {
    const record = await base(TABLE_NAME).find(draftId);
    return mapRecordToDraft(record);
  } catch (error) {
    console.error('[handoffDrafts] Error fetching draft by ID:', error);
    return null;
  }
}

/**
 * Get handoff draft by company and strategy (using draft key)
 */
export async function getHandoffDraftByKey(
  companyId: string,
  strategyId: string
): Promise<ProgramHandoffDraft | null> {
  const draftKey = `${companyId}:${strategyId}`;
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `{${FIELDS.DRAFT_KEY}} = '${draftKey}'`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) return null;
    return mapRecordToDraft(records[0]);
  } catch (error) {
    console.error('[handoffDrafts] Error fetching draft by key:', error);
    return null;
  }
}

/**
 * Get all handoff drafts for a strategy
 */
export async function getHandoffDraftsForStrategy(
  companyId: string,
  strategyId: string
): Promise<ProgramHandoffDraft[]> {
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `AND({${FIELDS.COMPANY_ID}} = '${companyId}', {${FIELDS.STRATEGY_ID}} = '${strategyId}')`,
        sort: [{ field: FIELDS.CREATED_AT, direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToDraft);
  } catch (error) {
    console.error('[handoffDrafts] Error fetching drafts for strategy:', error);
    return [];
  }
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Save a handoff draft (upsert by draftKey)
 */
export async function saveHandoffDraft(
  request: CreateHandoffDraftRequest
): Promise<ProgramHandoffDraft> {
  const draftKey = `${request.companyId}:${request.strategyId}`;
  const now = new Date().toISOString();

  // Check if draft already exists
  const existing = await getHandoffDraftByKey(request.companyId, request.strategyId);

  const fields = {
    [FIELDS.COMPANY_ID]: request.companyId,
    [FIELDS.STRATEGY_ID]: request.strategyId,
    [FIELDS.STRATEGY_TITLE]: request.strategyTitle,
    [FIELDS.DRAFT_KEY]: draftKey,
    [FIELDS.TACTIC_IDS]: JSON.stringify(request.tacticIds),
    [FIELDS.PROGRAMS]: JSON.stringify(request.programs),
    [FIELDS.REASONING]: request.reasoning,
    [FIELDS.WARNINGS]: JSON.stringify(request.warnings),
    [FIELDS.BASED_ON_HASHES]: JSON.stringify(request.basedOnHashes),
    [FIELDS.LINKED_OBJECTIVE_IDS]: JSON.stringify(request.linkedObjectiveIds),
    [FIELDS.LINKED_PRIORITY_IDS]: JSON.stringify(request.linkedPriorityIds),
    [FIELDS.UPDATED_AT]: now,
  };

  try {
    if (existing) {
      // Update existing draft
      const updated = await base(TABLE_NAME).update(existing.id, fields);
      console.log('[handoffDrafts] Updated existing draft:', existing.id);
      return mapRecordToDraft(updated);
    } else {
      // Create new draft
      const created = await base(TABLE_NAME).create({
        ...fields,
        [FIELDS.CREATED_AT]: now,
      });
      console.log('[handoffDrafts] Created new draft:', created.id);
      return mapRecordToDraft(created);
    }
  } catch (error) {
    console.error('[handoffDrafts] Error saving draft:', error);
    throw error;
  }
}

/**
 * Delete a handoff draft by ID
 */
export async function deleteHandoffDraft(draftId: string): Promise<boolean> {
  try {
    await base(TABLE_NAME).destroy(draftId);
    console.log('[handoffDrafts] Deleted draft:', draftId);
    return true;
  } catch (error) {
    console.error('[handoffDrafts] Error deleting draft:', error);
    return false;
  }
}

/**
 * Delete all handoff drafts for a strategy
 */
export async function deleteHandoffDraftsForStrategy(
  companyId: string,
  strategyId: string
): Promise<number> {
  try {
    const drafts = await getHandoffDraftsForStrategy(companyId, strategyId);
    if (drafts.length === 0) return 0;

    // Delete in batches of 10 (Airtable limit)
    let deletedCount = 0;
    for (let i = 0; i < drafts.length; i += 10) {
      const batch = drafts.slice(i, i + 10).map(d => d.id);
      await base(TABLE_NAME).destroy(batch);
      deletedCount += batch.length;
    }

    console.log('[handoffDrafts] Deleted drafts for strategy:', deletedCount);
    return deletedCount;
  } catch (error) {
    console.error('[handoffDrafts] Error deleting drafts for strategy:', error);
    return 0;
  }
}

// ============================================================================
// Summary Stats
// ============================================================================

/**
 * Get summary stats for a handoff draft
 */
export function getHandoffDraftStats(draft: ProgramHandoffDraft): {
  programCount: number;
  initiativeCount: number;
  workItemCount: number;
} {
  let initiativeCount = 0;
  let workItemCount = 0;

  for (const program of draft.programs) {
    initiativeCount += program.initiatives.length;
    for (const initiative of program.initiatives) {
      workItemCount += initiative.workItems.length;
    }
  }

  return {
    programCount: draft.programs.length,
    initiativeCount,
    workItemCount,
  };
}
