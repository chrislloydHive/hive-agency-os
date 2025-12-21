// lib/contextGraph/fieldStoreV4.ts
// Context Graph V4: Field Store with Merge Rules
//
// This module provides storage and manipulation for V4 ContextFields.
// V4 uses a "facts-first + review queue" workflow where:
// - Labs/GAP propose fields (status: proposed)
// - Users confirm/reject/edit fields
// - Confirmed fields materialize to the existing Context Graph

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  ContextFieldV4,
  ContextFieldStoreV4,
  ContextFieldSourceV4,
  ContextFieldStatusV4,
  ContextFieldEvidenceV4,
  ContextFieldAlternativeV4,
  isContextV4Enabled,
  isHigherPrioritySource,
  getSourcePriority,
} from '@/lib/types/contextField';

const CONTEXT_FIELDS_TABLE = AIRTABLE_TABLES.CONTEXT_FIELDS_V4;

// ============================================================================
// Error Types for V4 Store
// ============================================================================

export type V4StoreErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

export interface V4StoreLoadResult {
  store: ContextFieldStoreV4 | null;
  error: V4StoreErrorCode | null;
  errorMessage: string | null;
}

/**
 * Get debug info about V4 store configuration (dev only)
 */
export function getV4StoreDebugInfo(): {
  baseId: string | undefined;
  tableName: string;
  tokenEnvVar: string;
} {
  return {
    baseId: process.env.AIRTABLE_BASE_ID,
    tableName: CONTEXT_FIELDS_TABLE,
    tokenEnvVar: process.env.AIRTABLE_ACCESS_TOKEN ? 'AIRTABLE_ACCESS_TOKEN' :
                 process.env.AIRTABLE_API_KEY ? 'AIRTABLE_API_KEY' : 'NONE',
  };
}

// ============================================================================
// Merge Rules
// ============================================================================

/**
 * Result of canPropose check with extended metadata for conflict handling
 */
export interface CanProposeResult {
  /** Whether the proposal can be written */
  canPropose: boolean;
  /** Reason code for the decision */
  reason: CanProposeReason;
  /** Whether this should be added as an alternative instead of replacing */
  addAsAlternative?: boolean;
  /** Whether this conflicts with a confirmed field (for UI display) */
  conflictsWithConfirmed?: boolean;
  /** Preview of confirmed value (if conflicting) */
  confirmedValuePreview?: string;
}

export type CanProposeReason =
  | 'no_existing'
  | 'existing_confirmed'
  | 'existing_confirmed_higher_priority'
  | 'existing_rejected_same_source'
  | 'existing_rejected_different_source'
  | 'higher_confidence'
  | 'higher_priority_source'
  | 'same_priority_newer'
  | 'lower_priority'
  | 'lower_or_equal_confidence'
  | 'add_alternative'
  | 'human_override'
  | 'human_confirmed'
  | 'low_confidence'
  | 'empty_value'
  | 'default';

/**
 * Check if a new proposed field can overwrite an existing field.
 *
 * Merge rules (with source priority):
 * 1. No existing field → can propose
 * 2. Existing confirmed:
 *    - Default: cannot overwrite
 *    - Higher priority source with different value: can propose as alternative (conflicts)
 * 3. Existing rejected with same sourceId → blocked (same evidence already rejected)
 * 4. Existing rejected with different sourceId → can propose (new evidence)
 * 5. Existing proposed:
 *    - Higher priority source → can replace
 *    - Same priority, higher confidence → can replace
 *    - Same priority, lower confidence → add as alternative
 *    - Lower priority → add as alternative
 */
export function canPropose(
  existing: ContextFieldV4 | undefined,
  incoming: Omit<ContextFieldV4, 'status'>,
  options?: { allowConflictWithConfirmed?: boolean }
): CanProposeResult {
  // Rule 1: No existing field
  if (!existing) {
    return { canPropose: true, reason: 'no_existing' };
  }

  // Rule 2: Confirmed field handling
  if (existing.status === 'confirmed') {
    // Check if incoming has higher priority (e.g., user edit or GAP overriding lab)
    if (isHigherPrioritySource(incoming.source, existing.source)) {
      // Higher priority can propose as an alternative/conflict
      const valueStr = typeof existing.value === 'string' ? existing.value : JSON.stringify(existing.value);
      return {
        canPropose: options?.allowConflictWithConfirmed ?? false,
        reason: 'existing_confirmed_higher_priority',
        addAsAlternative: true,
        conflictsWithConfirmed: true,
        confirmedValuePreview: valueStr?.slice(0, 100),
      };
    }
    // Human-confirmed fields cannot be overwritten by AI
    if (existing.lockedBy) {
      return { canPropose: false, reason: 'human_confirmed' };
    }
    return { canPropose: false, reason: 'existing_confirmed' };
  }

  // Rule 3 & 4: Rejected blocks same source, allows different source
  if (existing.status === 'rejected') {
    if (existing.rejectedSourceId === incoming.sourceId) {
      return { canPropose: false, reason: 'existing_rejected_same_source' };
    }
    return { canPropose: true, reason: 'existing_rejected_different_source' };
  }

  // Rule 5: Proposed field handling with source priority
  if (existing.status === 'proposed') {
    const incomingPriority = getSourcePriority(incoming.source);
    const existingPriority = getSourcePriority(existing.source);

    // Higher priority source always wins
    if (incomingPriority > existingPriority) {
      return { canPropose: true, reason: 'higher_priority_source' };
    }

    // Lower priority source adds as alternative
    if (incomingPriority < existingPriority) {
      return { canPropose: true, reason: 'lower_priority', addAsAlternative: true };
    }

    // Same priority: use confidence as tiebreaker
    if (incoming.confidence > existing.confidence) {
      return { canPropose: true, reason: 'higher_confidence' };
    }

    // Same or lower confidence from same priority: add as alternative
    if (incoming.confidence < existing.confidence) {
      return { canPropose: true, reason: 'low_confidence', addAsAlternative: true };
    }

    // Equal confidence and priority - check timestamp
    const incomingTime = new Date(incoming.updatedAt).getTime();
    const existingTime = new Date(existing.updatedAt).getTime();
    if (incomingTime > existingTime) {
      return { canPropose: true, reason: 'same_priority_newer', addAsAlternative: true };
    }

    return { canPropose: false, reason: 'lower_or_equal_confidence' };
  }

  // Default: allow (shouldn't reach here)
  return { canPropose: true, reason: 'default' };
}

/**
 * Helper to truncate a value for preview
 */
export function truncateValueForPreview(value: unknown, maxLen = 100): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// ============================================================================
// Storage Layer
// ============================================================================

/**
 * Load all context fields for a company (with error details)
 */
export async function loadContextFieldsV4WithError(
  companyId: string
): Promise<V4StoreLoadResult> {
  if (!isContextV4Enabled()) {
    return { store: null, error: null, errorMessage: 'V4 not enabled' };
  }

  // Log debug info in development
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CONTEXT_V4) {
    const debugInfo = getV4StoreDebugInfo();
    console.log(`[FieldStoreV4] Debug info:`, {
      baseId: debugInfo.baseId,
      tableName: debugInfo.tableName,
      tokenEnvVar: debugInfo.tokenEnvVar,
    });
  }

  try {
    const base = getBase();
    const records = await base(CONTEXT_FIELDS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return { store: null, error: null, errorMessage: null };
    }

    const fieldsJson = records[0].fields['Fields JSON'] as string;
    if (!fieldsJson) {
      return { store: null, error: null, errorMessage: null };
    }

    const store = JSON.parse(fieldsJson) as ContextFieldStoreV4;
    return { store, error: null, errorMessage: null };
  } catch (error: any) {
    // Categorize the error
    if (error?.statusCode === 401 || error?.statusCode === 403 ||
        error?.error === 'NOT_AUTHORIZED' || error?.error === 'AUTHENTICATION_REQUIRED' ||
        error?.message?.includes('not authorized')) {
      console.error(`[FieldStoreV4] Authorization error for ${companyId}:`, error?.message || error);
      return {
        store: null,
        error: 'UNAUTHORIZED',
        errorMessage: error?.message || 'Not authorized to access V4 store',
      };
    }

    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.warn(`[FieldStoreV4] Table "${CONTEXT_FIELDS_TABLE}" not found`);
      return {
        store: null,
        error: 'NOT_FOUND',
        errorMessage: `Table "${CONTEXT_FIELDS_TABLE}" not found`,
      };
    }

    if (error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
      console.error(`[FieldStoreV4] Network error for ${companyId}:`, error?.message || error);
      return {
        store: null,
        error: 'NETWORK_ERROR',
        errorMessage: error?.message || 'Network error accessing Airtable',
      };
    }

    if (error instanceof SyntaxError) {
      console.error(`[FieldStoreV4] Parse error for ${companyId}:`, error?.message || error);
      return {
        store: null,
        error: 'PARSE_ERROR',
        errorMessage: error?.message || 'Failed to parse fields JSON',
      };
    }

    console.error(`[FieldStoreV4] Unknown error for ${companyId}:`, error);
    return {
      store: null,
      error: 'UNKNOWN',
      errorMessage: error?.message || 'Unknown error',
    };
  }
}

/**
 * Load all context fields for a company
 */
export async function loadContextFieldsV4(
  companyId: string
): Promise<ContextFieldStoreV4 | null> {
  const result = await loadContextFieldsV4WithError(companyId);
  return result.store;
}

/**
 * Save context fields for a company
 */
export async function saveContextFieldsV4(
  companyId: string,
  store: ContextFieldStoreV4
): Promise<void> {
  if (!isContextV4Enabled()) {
    console.warn('[FieldStoreV4] V4 not enabled, skipping save');
    return;
  }

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Update metadata
    store.meta.lastUpdated = now;

    const fieldsJson = JSON.stringify(store);

    // Check if record exists
    const existing = await base(CONTEXT_FIELDS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    const airtableFields = {
      'Company ID': companyId,
      'Fields JSON': fieldsJson,
      'Updated At': now,
      'Field Count': Object.keys(store.fields).length,
      'Proposed Count': Object.values(store.fields).filter(f => f.status === 'proposed').length,
      'Confirmed Count': Object.values(store.fields).filter(f => f.status === 'confirmed').length,
    };

    if (existing.length > 0) {
      await base(CONTEXT_FIELDS_TABLE).update(existing[0].id, airtableFields);
      console.log(`[FieldStoreV4] Updated fields for ${companyId}`);
    } else {
      await base(CONTEXT_FIELDS_TABLE).create([
        { fields: { ...airtableFields, 'Created At': now } },
      ]);
      console.log(`[FieldStoreV4] Created fields for ${companyId}`);
    }
  } catch (error) {
    console.error(`[FieldStoreV4] Failed to save fields for ${companyId}:`, error);
    throw error;
  }
}

/**
 * Get or create an empty field store for a company (in-memory only)
 * @deprecated Use ensureContextFieldsV4Store for persisted stores
 */
export async function getOrCreateFieldStoreV4(
  companyId: string
): Promise<ContextFieldStoreV4> {
  const existing = await loadContextFieldsV4(companyId);
  if (existing) {
    return existing;
  }

  return {
    companyId,
    fields: {},
    meta: {
      lastUpdated: new Date().toISOString(),
      version: 1,
    },
  };
}

/**
 * Result of ensureContextFieldsV4Store operation
 */
export interface EnsureStoreResult {
  store: ContextFieldStoreV4 | null;
  created: boolean;
  error: V4StoreErrorCode | null;
  errorMessage: string | null;
}

/**
 * Ensure a V4 store exists for a company, creating it if necessary.
 *
 * This function:
 * 1. Attempts to load existing store
 * 2. If not found, creates a new empty store in Airtable
 * 3. Returns the store with error info if unauthorized
 *
 * Use this before any mutation operations to ensure the store exists.
 */
export async function ensureContextFieldsV4Store(
  companyId: string
): Promise<EnsureStoreResult> {
  if (!isContextV4Enabled()) {
    return {
      store: null,
      created: false,
      error: null,
      errorMessage: 'V4 not enabled',
    };
  }

  // Log debug info in development
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CONTEXT_V4) {
    const debugInfo = getV4StoreDebugInfo();
    console.log(`[FieldStoreV4] ensureStore debug:`, {
      companyId,
      baseId: debugInfo.baseId,
      tableName: debugInfo.tableName,
      tokenEnvVar: debugInfo.tokenEnvVar,
    });
  }

  // First try to load existing store
  const loadResult = await loadContextFieldsV4WithError(companyId);

  // If we got an error other than "not found", return it
  if (loadResult.error && loadResult.error !== 'NOT_FOUND') {
    return {
      store: null,
      created: false,
      error: loadResult.error,
      errorMessage: loadResult.errorMessage,
    };
  }

  // If store exists, return it
  if (loadResult.store) {
    return {
      store: loadResult.store,
      created: false,
      error: null,
      errorMessage: null,
    };
  }

  // Store doesn't exist - create it
  const now = new Date().toISOString();
  const newStore: ContextFieldStoreV4 = {
    companyId,
    fields: {},
    meta: {
      lastUpdated: now,
      version: 1,
    },
  };

  try {
    const base = getBase();
    const fieldsJson = JSON.stringify(newStore);

    const airtableFields = {
      'Company ID': companyId,
      'Fields JSON': fieldsJson,
      'Updated At': now,
      'Created At': now,
      'Field Count': 0,
      'Proposed Count': 0,
      'Confirmed Count': 0,
    };

    await base(CONTEXT_FIELDS_TABLE).create([{ fields: airtableFields as any }]);
    console.log(`[FieldStoreV4] Created store for ${companyId}`);

    return {
      store: newStore,
      created: true,
      error: null,
      errorMessage: null,
    };
  } catch (error: any) {
    // Categorize the error
    if (error?.statusCode === 401 || error?.statusCode === 403 ||
        error?.error === 'NOT_AUTHORIZED' || error?.error === 'AUTHENTICATION_REQUIRED' ||
        error?.message?.includes('not authorized')) {
      console.error(`[FieldStoreV4] Authorization error creating store for ${companyId}:`, error?.message || error);
      return {
        store: null,
        created: false,
        error: 'UNAUTHORIZED',
        errorMessage: error?.message || 'Not authorized to create V4 store',
      };
    }

    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.error(`[FieldStoreV4] Table not found when creating store for ${companyId}`);
      return {
        store: null,
        created: false,
        error: 'NOT_FOUND',
        errorMessage: `Table "${CONTEXT_FIELDS_TABLE}" not found`,
      };
    }

    if (error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
      console.error(`[FieldStoreV4] Network error creating store for ${companyId}:`, error?.message || error);
      return {
        store: null,
        created: false,
        error: 'NETWORK_ERROR',
        errorMessage: error?.message || 'Network error accessing Airtable',
      };
    }

    console.error(`[FieldStoreV4] Unknown error creating store for ${companyId}:`, error);
    return {
      store: null,
      created: false,
      error: 'UNKNOWN',
      errorMessage: error?.message || 'Unknown error',
    };
  }
}

// ============================================================================
// Field Operations
// ============================================================================

/**
 * Result type for field mutation operations
 */
export interface FieldMutationResult {
  success: boolean;
  reason: string;
  field?: ContextFieldV4;
  error?: V4StoreErrorCode;
  errorMessage?: string;
}

/**
 * Propose a new field value (from labs/GAP)
 *
 * Respects merge rules:
 * - Cannot overwrite confirmed fields
 * - Cannot re-propose to rejected fields with same source
 * - Can replace lower-confidence proposed fields
 *
 * Returns error if store is unauthorized.
 */
export async function proposeFieldV4(
  companyId: string,
  incoming: {
    key: string;
    value: unknown;
    source: ContextFieldSourceV4;
    sourceId?: string;
    confidence: number;
    evidence?: ContextFieldEvidenceV4;
  }
): Promise<FieldMutationResult> {
  // Ensure store exists first
  const ensureResult = await ensureContextFieldsV4Store(companyId);
  if (ensureResult.error) {
    return {
      success: false,
      reason: ensureResult.error === 'UNAUTHORIZED' ? 'store_unauthorized' : 'store_error',
      error: ensureResult.error,
      errorMessage: ensureResult.errorMessage || undefined,
    };
  }

  const store = ensureResult.store!;
  const existing = store.fields[incoming.key];

  // Check merge rules
  const check = canPropose(existing, {
    ...incoming,
    domain: incoming.key.split('.')[0],
    updatedAt: new Date().toISOString(),
  });

  if (!check.canPropose) {
    return { success: false, reason: check.reason };
  }

  const now = new Date().toISOString();
  const field: ContextFieldV4 = {
    key: incoming.key,
    domain: incoming.key.split('.')[0],
    value: incoming.value,
    status: 'proposed',
    source: incoming.source,
    sourceId: incoming.sourceId,
    confidence: incoming.confidence,
    updatedAt: now,
    evidence: incoming.evidence,
    previousValue: existing?.value,
    previousSource: existing?.source,
  };

  store.fields[incoming.key] = field;
  await saveContextFieldsV4(companyId, store);

  return { success: true, reason: check.reason, field };
}

/**
 * Result type for batch field operations
 */
export interface BatchFieldResult {
  confirmed?: string[];
  rejected?: string[];
  failed: string[];
  error?: V4StoreErrorCode;
  errorMessage?: string;
}

/**
 * Confirm one or more proposed fields
 *
 * Sets status to confirmed and locks the field.
 * Returns error if store is unauthorized.
 */
export async function confirmFieldsV4(
  companyId: string,
  keys: string[],
  confirmedBy?: string
): Promise<BatchFieldResult> {
  // Ensure store exists first
  const ensureResult = await ensureContextFieldsV4Store(companyId);
  if (ensureResult.error) {
    return {
      confirmed: [],
      failed: keys,
      error: ensureResult.error,
      errorMessage: ensureResult.errorMessage || undefined,
    };
  }

  const store = ensureResult.store!;
  const now = new Date().toISOString();

  const confirmed: string[] = [];
  const failed: string[] = [];

  for (const key of keys) {
    const field = store.fields[key];

    if (!field) {
      failed.push(key);
      console.warn(`[FieldStoreV4] Cannot confirm ${key}: not found`);
      continue;
    }

    if (field.status !== 'proposed') {
      failed.push(key);
      console.warn(`[FieldStoreV4] Cannot confirm ${key}: status is ${field.status}`);
      continue;
    }

    // Update to confirmed
    field.status = 'confirmed';
    field.lockedAt = now;
    field.lockedBy = confirmedBy;
    field.updatedAt = now;

    confirmed.push(key);
  }

  if (confirmed.length > 0) {
    await saveContextFieldsV4(companyId, store);
  }

  return { confirmed, failed };
}

/**
 * Reject one or more proposed fields
 *
 * Sets status to rejected and records the source for blocking.
 * Returns error if store is unauthorized.
 */
export async function rejectFieldsV4(
  companyId: string,
  keys: string[],
  reason?: string
): Promise<BatchFieldResult> {
  // Ensure store exists first
  const ensureResult = await ensureContextFieldsV4Store(companyId);
  if (ensureResult.error) {
    return {
      rejected: [],
      failed: keys,
      error: ensureResult.error,
      errorMessage: ensureResult.errorMessage || undefined,
    };
  }

  const store = ensureResult.store!;
  const now = new Date().toISOString();

  const rejected: string[] = [];
  const failed: string[] = [];

  for (const key of keys) {
    const field = store.fields[key];

    if (!field) {
      failed.push(key);
      continue;
    }

    if (field.status !== 'proposed') {
      failed.push(key);
      continue;
    }

    // Update to rejected
    field.status = 'rejected';
    field.rejectedAt = now;
    field.rejectedReason = reason;
    field.rejectedSourceId = field.sourceId; // Block this source from re-proposing
    field.updatedAt = now;

    rejected.push(key);
  }

  if (rejected.length > 0) {
    await saveContextFieldsV4(companyId, store);
  }

  return { rejected, failed };
}

/**
 * User edit: create/update a field as confirmed + locked
 *
 * User edits always succeed and lock the field.
 * Returns error if store is unauthorized.
 */
export async function updateFieldV4(
  companyId: string,
  key: string,
  value: unknown,
  userId?: string
): Promise<FieldMutationResult> {
  // Ensure store exists first
  const ensureResult = await ensureContextFieldsV4Store(companyId);
  if (ensureResult.error) {
    return {
      success: false,
      reason: ensureResult.error === 'UNAUTHORIZED' ? 'store_unauthorized' : 'store_error',
      error: ensureResult.error,
      errorMessage: ensureResult.errorMessage || undefined,
    };
  }

  const store = ensureResult.store!;
  const existing = store.fields[key];
  const now = new Date().toISOString();

  const field: ContextFieldV4 = {
    key,
    domain: key.split('.')[0],
    value,
    status: 'confirmed',
    source: 'user',
    sourceId: userId,
    confidence: 1.0, // User input is highest confidence
    updatedAt: now,
    lockedAt: now,
    lockedBy: userId,
    previousValue: existing?.value,
    previousSource: existing?.source,
  };

  store.fields[key] = field;
  await saveContextFieldsV4(companyId, store);

  return { success: true, reason: 'user_edit', field };
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get all proposed fields (for review queue)
 */
export async function getProposedFieldsV4(
  companyId: string,
  filters?: { domain?: string; source?: ContextFieldSourceV4 }
): Promise<ContextFieldV4[]> {
  const store = await loadContextFieldsV4(companyId);
  if (!store) {
    return [];
  }

  let fields = Object.values(store.fields).filter(f => f.status === 'proposed');

  if (filters?.domain) {
    fields = fields.filter(f => f.domain === filters.domain);
  }

  if (filters?.source) {
    fields = fields.filter(f => f.source === filters.source);
  }

  // Sort by confidence descending, then by updatedAt descending
  fields.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return fields;
}

/**
 * Get all confirmed fields (for fact sheet)
 */
export async function getConfirmedFieldsV4(
  companyId: string,
  domain?: string
): Promise<ContextFieldV4[]> {
  const store = await loadContextFieldsV4(companyId);
  if (!store) {
    return [];
  }

  let fields = Object.values(store.fields).filter(f => f.status === 'confirmed');

  if (domain) {
    fields = fields.filter(f => f.domain === domain);
  }

  // Sort by domain, then by key
  fields.sort((a, b) => {
    if (a.domain !== b.domain) {
      return a.domain.localeCompare(b.domain);
    }
    return a.key.localeCompare(b.key);
  });

  return fields;
}

/**
 * Get field counts by status
 */
export async function getFieldCountsV4(
  companyId: string
): Promise<{ proposed: number; confirmed: number; rejected: number; total: number }> {
  const store = await loadContextFieldsV4(companyId);
  if (!store) {
    return { proposed: 0, confirmed: 0, rejected: 0, total: 0 };
  }

  const fields = Object.values(store.fields);
  return {
    proposed: fields.filter(f => f.status === 'proposed').length,
    confirmed: fields.filter(f => f.status === 'confirmed').length,
    rejected: fields.filter(f => f.status === 'rejected').length,
    total: fields.length,
  };
}

/**
 * Get a single field by key
 */
export async function getFieldV4(
  companyId: string,
  key: string
): Promise<ContextFieldV4 | null> {
  const store = await loadContextFieldsV4(companyId);
  return store?.fields[key] ?? null;
}

// ============================================================================
// Source Mapping
// ============================================================================

/**
 * Map granular context source to V4 source category
 */
export function mapToV4Source(source: string): ContextFieldSourceV4 {
  // User sources
  if (['user', 'manual', 'qbr', 'strategy'].includes(source)) {
    return 'user';
  }

  // Lab sources
  if (source.endsWith('_lab') || source === 'fcb') {
    return 'lab';
  }

  // GAP sources
  if (source.startsWith('gap_')) {
    return 'gap';
  }

  // AI sources
  if (['brain', 'inferred'].includes(source)) {
    return 'ai';
  }

  // CRM sources
  if (['airtable', 'crm'].includes(source)) {
    return 'crm';
  }

  // Default to import
  return 'import';
}

/**
 * Compute confidence based on source and evidence
 */
export function computeConfidence(
  source: ContextFieldSourceV4,
  evidence?: ContextFieldEvidenceV4
): number {
  const baseConfidence: Record<ContextFieldSourceV4, number> = {
    user: 1.0,
    crm: 0.9,
    lab: 0.8,
    gap: 0.7,
    ai: 0.6,
    import: 0.5,
  };

  let confidence = baseConfidence[source];

  // Boost if has strong evidence
  if (evidence?.snippet && evidence.snippet.length > 100) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }

  return confidence;
}
