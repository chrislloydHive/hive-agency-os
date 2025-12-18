// lib/os/strategy/drafts.ts
// Server-side draft storage for Strategy AI improvements
//
// WHY: AI-generated content must NEVER auto-write to canonical records.
// Drafts are the holding area where AI suggestions wait for user approval.
// This ensures humans stay in control of strategy decisions.
//
// Drafts persist across page refresh and require explicit user action to apply/discard.
// Schema:
//   companyId, strategyId, scopeType (objective|frame|priority|tactic),
//   fieldKey, entityId?, draftValue, rationale, confidence, sourcesUsed,
//   basedOnHashes, createdAt, updatedAt

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

// ============================================================================
// Types
// ============================================================================

export type DraftScopeType = 'objective' | 'frame' | 'priority' | 'tactic' | 'strategy';

export interface StrategyDraft {
  id: string;
  companyId: string;
  strategyId: string;
  scopeType: DraftScopeType;
  fieldKey: string;           // e.g., 'title', 'description', 'audience'
  entityId?: string;          // ID of the objective/priority/tactic if applicable
  draftValue: string;
  originalValue?: string;
  rationale: string[];
  confidence: 'high' | 'medium' | 'low';
  sourcesUsed: string[];
  // Provenance tracking
  basedOnHashes?: {
    contextHash?: string;
    objectivesHash?: string;
    strategyHash?: string;
    tacticsHash?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftRequest {
  companyId: string;
  strategyId: string;
  scopeType: DraftScopeType;
  fieldKey: string;
  entityId?: string;
  draftValue: string;
  originalValue?: string;
  rationale: string[];
  confidence: 'high' | 'medium' | 'low';
  sourcesUsed: string[];
  basedOnHashes?: StrategyDraft['basedOnHashes'];
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all drafts for a strategy
 */
export async function getDraftsForStrategy(
  companyId: string,
  strategyId: string
): Promise<StrategyDraft[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_DRAFTS)
      .select({
        filterByFormula: `AND({companyId} = '${companyId}', {strategyId} = '${strategyId}')`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToDraft);
  } catch (error) {
    console.error('[getDraftsForStrategy] Error:', error);
    // Return empty array if table doesn't exist yet
    if (String(error).includes('NOT_FOUND') || String(error).includes('Could not find table')) {
      console.warn('[getDraftsForStrategy] Table not found, returning empty array');
      return [];
    }
    return [];
  }
}

/**
 * Get a specific draft by its key
 */
export async function getDraft(
  companyId: string,
  strategyId: string,
  scopeType: DraftScopeType,
  fieldKey: string,
  entityId?: string
): Promise<StrategyDraft | null> {
  try {
    const base = getBase();
    const filterParts = [
      `{companyId} = '${companyId}'`,
      `{strategyId} = '${strategyId}'`,
      `{scopeType} = '${scopeType}'`,
      `{fieldKey} = '${fieldKey}'`,
    ];

    if (entityId) {
      filterParts.push(`{entityId} = '${entityId}'`);
    } else {
      filterParts.push(`OR({entityId} = '', {entityId} = BLANK())`);
    }

    const records = await base(AIRTABLE_TABLES.STRATEGY_DRAFTS)
      .select({
        filterByFormula: `AND(${filterParts.join(', ')})`,
        maxRecords: 1,
      })
      .firstPage();

    return records.length > 0 ? mapRecordToDraft(records[0]) : null;
  } catch (error) {
    console.error('[getDraft] Error:', error);
    return null;
  }
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create or update a draft
 * Upserts based on companyId+strategyId+scopeType+fieldKey+entityId
 */
export async function saveDraft(request: CreateDraftRequest): Promise<StrategyDraft> {
  const { companyId, strategyId, scopeType, fieldKey, entityId } = request;

  // Check if draft already exists
  const existing = await getDraft(companyId, strategyId, scopeType, fieldKey, entityId);

  const base = getBase();
  const now = new Date().toISOString();

  const fields = {
    companyId,
    strategyId,
    scopeType,
    fieldKey,
    entityId: entityId || '',
    draftValue: request.draftValue,
    originalValue: request.originalValue || '',
    rationale: JSON.stringify(request.rationale),
    confidence: request.confidence,
    sourcesUsed: JSON.stringify(request.sourcesUsed),
    basedOnHashes: request.basedOnHashes ? JSON.stringify(request.basedOnHashes) : '',
    updatedAt: now,
  };

  if (existing) {
    // Update existing draft
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(AIRTABLE_TABLES.STRATEGY_DRAFTS) as any).update([
      { id: existing.id, fields },
    ]);
    return mapRecordToDraft(results[0]);
  } else {
    // Create new draft
    const record = await base(AIRTABLE_TABLES.STRATEGY_DRAFTS).create({
      ...fields,
      createdAt: now,
    });
    return mapRecordToDraft(record);
  }
}

/**
 * Delete a specific draft
 */
export async function deleteDraft(draftId: string): Promise<void> {
  try {
    const base = getBase();
    await base(AIRTABLE_TABLES.STRATEGY_DRAFTS).destroy(draftId);
  } catch (error) {
    console.error('[deleteDraft] Error:', error);
    throw new Error(`Failed to delete draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a draft by key
 */
export async function deleteDraftByKey(
  companyId: string,
  strategyId: string,
  scopeType: DraftScopeType,
  fieldKey: string,
  entityId?: string
): Promise<void> {
  const draft = await getDraft(companyId, strategyId, scopeType, fieldKey, entityId);
  if (draft) {
    await deleteDraft(draft.id);
  }
}

/**
 * Delete all drafts for a strategy
 */
export async function deleteAllDraftsForStrategy(
  companyId: string,
  strategyId: string
): Promise<void> {
  try {
    const drafts = await getDraftsForStrategy(companyId, strategyId);
    if (drafts.length === 0) return;

    const base = getBase();
    // Airtable allows max 10 records per batch delete
    const chunks = [];
    for (let i = 0; i < drafts.length; i += 10) {
      chunks.push(drafts.slice(i, i + 10).map(d => d.id));
    }

    for (const chunk of chunks) {
      await base(AIRTABLE_TABLES.STRATEGY_DRAFTS).destroy(chunk);
    }
  } catch (error) {
    console.error('[deleteAllDraftsForStrategy] Error:', error);
    throw new Error(`Failed to delete drafts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to StrategyDraft
 */
function mapRecordToDraft(record: {
  id: string;
  fields: Record<string, unknown>;
}): StrategyDraft {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.companyId as string,
    strategyId: fields.strategyId as string,
    scopeType: fields.scopeType as DraftScopeType,
    fieldKey: fields.fieldKey as string,
    entityId: fields.entityId as string | undefined,
    draftValue: fields.draftValue as string,
    originalValue: fields.originalValue as string | undefined,
    rationale: parseJsonArray(fields.rationale),
    confidence: (fields.confidence as StrategyDraft['confidence']) || 'medium',
    sourcesUsed: parseJsonArray(fields.sourcesUsed),
    basedOnHashes: parseJsonObject(fields.basedOnHashes),
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
  };
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
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
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Convert drafts array to a record keyed by fieldKey for easier UI consumption
 */
export function draftsToRecord(drafts: StrategyDraft[]): Record<string, StrategyDraft> {
  const record: Record<string, StrategyDraft> = {};
  for (const draft of drafts) {
    // Key format: scopeType.entityId.fieldKey or scopeType.fieldKey
    const key = draft.entityId
      ? `${draft.scopeType}.${draft.entityId}.${draft.fieldKey}`
      : `${draft.scopeType}.${draft.fieldKey}`;
    record[key] = draft;
  }
  return record;
}
