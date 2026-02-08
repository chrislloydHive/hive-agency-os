// lib/airtable/deliveryWriteBack.ts
// Field-alias aware Airtable write-back for delivery routes.
// Skips non-writable fields (formula/lookup/rollup), safe for single-select (only set existing choices).
// Logs which fields were found and written.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const READ_ONLY_FIELD_TYPES = new Set([
  'formula',
  'lookup',
  'rollup',
  'count',
  'multipleLookupValues',
  'autoNumber',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
]);

/** Logical delivery fields and their possible Airtable field names (aliases). Client PM OS / Creative Review Asset Status. */
export const DELIVERY_FIELD_ALIASES = {
  deliveryStatus: ['Delivery Status'],
  deliveryError: ['Delivery Error'],
  deliveredAt: ['Delivered At'],
  deliveredCheckbox: ['Delivered'],
  deliveredFolderId: ['Delivered Folder ID'],
  /** First alias wins if present; otherwise try second (Folder URL vs File URL). */
  deliveredFolderOrFileUrl: ['Delivered Folder URL', 'Delivered File URL'],
  deliverySummary: ['Delivery Summary'],
  /** Optional: clear webhook trigger on success. */
  readyToDeliverWebhook: ['Ready to Deliver (Webhook)'],
  /** Optional: CRAS-style counts (if field exists). */
  deliveryFilesCount: ['Delivery Files Count'],
  deliveryFoldersCount: ['Delivery Folders Count'],
  deliveryFailures: ['Delivery Failures'],
} as const;

export type DeliveryWritePayloadSuccess = {
  kind: 'success';
  deliveryStatus: 'Delivered';
  deliveredAt: string;
  deliveredCheckbox: true;
  deliveredFolderId: string;
  deliveredFolderUrl: string;
  deliverySummary: string;
  deliveryError?: string;
  /** Optional: set to false to clear webhook trigger. */
  readyToDeliverWebhook?: false;
  /** Optional: for CRAS when present. */
  deliveryFilesCount?: number;
  deliveryFoldersCount?: number;
  deliveryFailures?: string;
};

export type DeliveryWritePayloadError = {
  kind: 'error';
  deliveryStatus: 'Error';
  deliveryError: string;
};

export type DeliveryWritePayload = DeliveryWritePayloadSuccess | DeliveryWritePayloadError;

interface TableFieldMeta {
  name: string;
  type: string;
  options?: { choices?: Array<{ name: string }> };
}

const schemaCache = new Map<
  string,
  { fields: Map<string, TableFieldMeta>; writableNames: Set<string>; fetchedAt: number }
>();
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;

function getBaseId(): string {
  const id = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
  if (!id) throw new Error('AIRTABLE_OS_BASE_ID or AIRTABLE_BASE_ID required for delivery write-back');
  return id;
}

/** CRAS datetime field: when partner completed download. Alias-safe candidate names. */
export const CRAS_PARTNER_DOWNLOADED_AT_ALIASES = ['ID Partner Downloaded At', 'Partner Downloaded At'] as const;

/**
 * Fetch table schema (field names + types + singleSelect choices) via Airtable Meta API.
 */
export async function getTableSchema(
  baseId: string,
  tableName: string
): Promise<{ fields: Map<string, TableFieldMeta>; writableNames: Set<string> }> {
  const cacheKey = `${baseId}::${tableName}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return { fields: cached.fields, writableNames: cached.writableNames };
  }

  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  if (!token) throw new Error('AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN required for schema fetch');

  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable Meta API failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    tables?: Array<{
      name: string;
      fields?: Array<{ name: string; type: string; options?: { choices?: Array<{ name: string }> } }>;
    }>;
  };
  const table = json.tables?.find((t) => t.name === tableName);
  const fields = new Map<string, TableFieldMeta>();
  const writableNames = new Set<string>();

  for (const f of table?.fields ?? []) {
    const meta: TableFieldMeta = {
      name: f.name,
      type: f.type,
      options: f.options,
    };
    fields.set(f.name, meta);
    if (!READ_ONLY_FIELD_TYPES.has(f.type)) {
      writableNames.add(f.name);
    }
  }

  schemaCache.set(cacheKey, { fields, writableNames, fetchedAt: Date.now() });
  return { fields, writableNames };
}

/**
 * Resolve first alias that exists in the table and is writable. Returns the Airtable field name or null.
 */
export function resolveAlias(
  aliases: readonly string[],
  writableNames: Set<string>
): string | null {
  for (const name of aliases) {
    if (writableNames.has(name)) return name;
  }
  return null;
}

/**
 * For single-select: return true only if value is in the field's choices (or field is not singleSelect).
 */
function isAllowedSingleSelectValue(
  fieldName: string,
  value: string,
  fields: Map<string, TableFieldMeta>
): boolean {
  const meta = fields.get(fieldName);
  if (!meta || meta.type !== 'singleSelect') return true;
  const choices = meta.options?.choices ?? [];
  const choiceNames = new Set(choices.map((c) => c.name.trim()));
  return choiceNames.has(value.trim());
}

/**
 * Build the Airtable fields object for PATCH: alias-aware, writable-only, single-select safe.
 * Returns { fieldsToWrite, writtenLog, skippedLog }.
 */
function buildDeliveryUpdate(
  tableName: string,
  payload: DeliveryWritePayload,
  schema: { fields: Map<string, TableFieldMeta>; writableNames: Set<string> }
): {
  fieldsToWrite: Record<string, unknown>;
  written: string[];
  skipped: { field: string; reason: string }[];
} {
  const { fields: fieldMeta, writableNames } = schema;
  const written: string[] = [];
  const skipped: { field: string; reason: string }[] = [];
  const fieldsToWrite: Record<string, unknown> = {};

  if (payload.kind === 'success') {
    const statusAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryStatus, writableNames);
    if (statusAlias) {
      if (isAllowedSingleSelectValue(statusAlias, payload.deliveryStatus, fieldMeta)) {
        fieldsToWrite[statusAlias] = payload.deliveryStatus;
        written.push(statusAlias);
      } else {
        skipped.push({ field: statusAlias, reason: `singleSelect option "${payload.deliveryStatus}" not in choices` });
      }
    } else {
      skipped.push({ field: 'Delivery Status', reason: 'no writable alias found' });
    }

    const errorAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryError, writableNames);
    if (errorAlias) {
      fieldsToWrite[errorAlias] = payload.deliveryError ?? '';
      written.push(errorAlias);
    }

    const atAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredAt, writableNames);
    if (atAlias) {
      // Ensure deliveredAt is a string (ISO 8601 format)
      const deliveredAtIso = typeof payload.deliveredAt === 'string' 
        ? payload.deliveredAt 
        : new Date().toISOString();
      fieldsToWrite[atAlias] = deliveredAtIso;
      written.push(atAlias);
    }

    const checkboxAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredCheckbox, writableNames);
    if (checkboxAlias) {
      fieldsToWrite[checkboxAlias] = payload.deliveredCheckbox;
      written.push(checkboxAlias);
    }

    const folderIdAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredFolderId, writableNames);
    if (folderIdAlias) {
      fieldsToWrite[folderIdAlias] = payload.deliveredFolderId;
      written.push(folderIdAlias);
    }

    const urlAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredFolderOrFileUrl, writableNames);
    if (urlAlias) {
      fieldsToWrite[urlAlias] = payload.deliveredFolderUrl;
      written.push(urlAlias);
    }

    const summaryAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliverySummary, writableNames);
    if (summaryAlias) {
      fieldsToWrite[summaryAlias] = payload.deliverySummary;
      written.push(summaryAlias);
    }

    if (payload.readyToDeliverWebhook === false) {
      const webhookAlias = resolveAlias(DELIVERY_FIELD_ALIASES.readyToDeliverWebhook, writableNames);
      if (webhookAlias) {
        fieldsToWrite[webhookAlias] = false;
        written.push(webhookAlias);
      }
    }
    if (payload.deliveryFilesCount !== undefined) {
      const alias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryFilesCount, writableNames);
      if (alias) {
        fieldsToWrite[alias] = payload.deliveryFilesCount;
        written.push(alias);
      }
    }
    if (payload.deliveryFoldersCount !== undefined) {
      const alias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryFoldersCount, writableNames);
      if (alias) {
        fieldsToWrite[alias] = payload.deliveryFoldersCount;
        written.push(alias);
      }
    }
    if (payload.deliveryFailures !== undefined) {
      const alias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryFailures, writableNames);
      if (alias) {
        fieldsToWrite[alias] = payload.deliveryFailures;
        written.push(alias);
      }
    }
  } else {
    const statusAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryStatus, writableNames);
    if (statusAlias) {
      if (isAllowedSingleSelectValue(statusAlias, payload.deliveryStatus, fieldMeta)) {
        fieldsToWrite[statusAlias] = payload.deliveryStatus;
        written.push(statusAlias);
      } else {
        skipped.push({ field: statusAlias, reason: `singleSelect option "${payload.deliveryStatus}" not in choices` });
      }
    } else {
      skipped.push({ field: 'Delivery Status', reason: 'no writable alias found' });
    }

    const errorAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveryError, writableNames);
    if (errorAlias) {
      fieldsToWrite[errorAlias] = payload.deliveryError;
      written.push(errorAlias);
    }
  }

  return { fieldsToWrite, written, skipped };
}

/**
 * Build fields for direct REST update (fallback when schema fetch fails).
 * Uses known field names from DELIVERY_FIELD_ALIASES.
 */
function buildDeliveryUpdateFallback(
  payload: DeliveryWritePayload
): Record<string, unknown> {
  const fieldsToWrite: Record<string, unknown> = {};

  if (payload.kind === 'success') {
    // Try known field names directly (first alias from DELIVERY_FIELD_ALIASES)
    fieldsToWrite['Delivery Status'] = payload.deliveryStatus;
    if (payload.deliveryError) {
      fieldsToWrite['Delivery Error'] = payload.deliveryError;
    }
    // Ensure deliveredAt is a string (ISO 8601 format)
    const deliveredAtIso = typeof payload.deliveredAt === 'string' 
      ? payload.deliveredAt 
      : new Date().toISOString();
    fieldsToWrite['Delivered At'] = deliveredAtIso;
    fieldsToWrite['Delivered'] = payload.deliveredCheckbox;
    fieldsToWrite['Delivered Folder ID'] = payload.deliveredFolderId;
    fieldsToWrite['Delivered Folder URL'] = payload.deliveredFolderUrl;
    fieldsToWrite['Delivery Summary'] = payload.deliverySummary;
    if (payload.readyToDeliverWebhook === false) {
      fieldsToWrite['Ready to Deliver (Webhook)'] = false;
    }
    if (payload.deliveryFilesCount !== undefined) {
      fieldsToWrite['Delivery Files Count'] = payload.deliveryFilesCount;
    }
    if (payload.deliveryFoldersCount !== undefined) {
      fieldsToWrite['Delivery Folders Count'] = payload.deliveryFoldersCount;
    }
    if (payload.deliveryFailures !== undefined) {
      fieldsToWrite['Delivery Failures'] = payload.deliveryFailures;
    }
  } else {
    fieldsToWrite['Delivery Status'] = payload.deliveryStatus;
    fieldsToWrite['Delivery Error'] = payload.deliveryError;
  }

  return fieldsToWrite;
}

export interface WriteDeliveryResult {
  ok: boolean;
  written: string[];
  skipped: { field: string; reason: string }[];
  error?: string;
}

/**
 * Write delivery result to an Airtable record. Field-alias aware, skips non-writable and invalid single-select.
 * Always logs which fields were found and written.
 */
export async function writeDeliveryToRecord(
  tableName: string,
  recordId: string,
  payload: DeliveryWritePayload
): Promise<WriteDeliveryResult> {
  const baseId = getBaseId();
  let schema: { fields: Map<string, TableFieldMeta>; writableNames: Set<string> } | null = null;
  let useFallback = false;

  try {
    schema = await getTableSchema(baseId, tableName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[deliveryWriteBack] Schema fetch failed, using fallback direct update:', message);
    useFallback = true;
  }

  let fieldsToWrite: Record<string, unknown>;
  let written: string[];
  let skipped: { field: string; reason: string }[];

  if (useFallback || !schema) {
    // Fallback: use known field names directly
    fieldsToWrite = buildDeliveryUpdateFallback(payload);
    written = Object.keys(fieldsToWrite);
    skipped = [];
    console.log('[deliveryWriteBack] Using fallback direct update (no schema fetch)');
  } else {
    // Normal path: use schema-aware alias resolution
    const result = buildDeliveryUpdate(tableName, payload, schema);
    fieldsToWrite = result.fieldsToWrite;
    written = result.written;
    skipped = result.skipped;

    if (skipped.length > 0) {
      console.log('[deliveryWriteBack] Skipped fields:', skipped.map((s) => `${s.field}: ${s.reason}`).join('; '));
    }
  }

  if (Object.keys(fieldsToWrite).length === 0) {
    console.log('[deliveryWriteBack] No writable fields for record', recordId);
    return { ok: true, written: [], skipped };
  }

  // Temporary instrumentation: detect "Delivered At" field before update
  const hasDeliveredAt = Object.prototype.hasOwnProperty.call(fieldsToWrite, 'Delivered At');
  const fieldKeys = Object.keys(fieldsToWrite);
  console.log('[deliveryWriteBack] Pre-update instrumentation:', {
    baseId: baseId ? `${baseId.substring(0, 20)}...` : 'unknown',
    tableName,
    recordId,
    fieldKeys,
    hasDeliveredAt,
  });

  try {
    const base = getBase();
    await base(tableName).update(recordId, fieldsToWrite as any);
    console.log('[deliveryWriteBack] Written to', tableName, 'record', recordId, 'fields:', written.join(', '));
    return { ok: true, written, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorString = String(message);
    
    // Check if error is 422 INVALID_VALUE_FOR_COLUMN for Delivered At
    const isInvalidDeliveredAt = errorString.includes('INVALID_VALUE_FOR_COLUMN') && 
                                  (errorString.includes('Delivered At') || 
                                   written.some(f => f.includes('Delivered At')));
    
    if (isInvalidDeliveredAt && payload.kind === 'success') {
      // Find the Delivered At field alias that was written
      let deliveredAtAlias: string | null = null;
      let deliveredAtValue: string | null = null;
      const deliveredAtAliases = DELIVERY_FIELD_ALIASES.deliveredAt as readonly string[];
      for (const fieldName of Object.keys(fieldsToWrite)) {
        if (fieldName === 'Delivered At' || deliveredAtAliases.includes(fieldName as any)) {
          deliveredAtAlias = fieldName;
          deliveredAtValue = String(fieldsToWrite[fieldName]);
          break;
        }
      }
      
      // Fallback step 1: Try date-only format (YYYY-MM-DD) instead of full ISO
      const deliveredAtDateOnly = deliveredAtValue ? deliveredAtValue.slice(0, 10) : new Date().toISOString().slice(0, 10);
      console.log(`[deliveryWriteBack] Delivered At rejected (tried: "${deliveredAtValue}"); retrying with date-only format: "${deliveredAtDateOnly}"`);
      
      const dateOnlyFields: Record<string, unknown> = { ...fieldsToWrite };
      if (deliveredAtAlias) {
        dateOnlyFields[deliveredAtAlias] = deliveredAtDateOnly;
      }
      
      try {
        const base = getBase();
        await base(tableName).update(recordId, dateOnlyFields as any);
        console.log('[deliveryWriteBack] Written to', tableName, 'record', recordId, 'fields (fallback, date-only Delivered At):', written.join(', '));
        return { ok: true, written, skipped };
      } catch (dateOnlyErr) {
        const dateOnlyMessage = dateOnlyErr instanceof Error ? dateOnlyErr.message : String(dateOnlyErr);
        const dateOnlyErrorString = String(dateOnlyMessage);
        const stillInvalidDeliveredAt = dateOnlyErrorString.includes('INVALID_VALUE_FOR_COLUMN') && 
                                         (dateOnlyErrorString.includes('Delivered At') || 
                                          deliveredAtAlias !== null);
        
        if (stillInvalidDeliveredAt) {
          // Fallback step 2: Remove Delivered At entirely, but keep critical fields
          console.log(`[deliveryWriteBack] Delivered At still rejected (tried date-only: "${deliveredAtDateOnly}"); removing field but keeping critical flags`);
          
          // Build fallback fields: remove Delivered At, keep everything else
          const fallbackFields: Record<string, unknown> = { ...fieldsToWrite };
          if (deliveredAtAlias) {
            delete fallbackFields[deliveredAtAlias];
          }
          
          // Ensure critical fields are present (use schema-aware resolution if available, otherwise use known aliases)
          if (!schema || useFallback) {
            // Fallback mode: use known field names directly
            fallbackFields['Delivered'] = true;
            if (payload.readyToDeliverWebhook === false) {
              fallbackFields['Ready to Deliver (Webhook)'] = false;
            }
            // Clear "Needs Delivery" flag if it exists
            fallbackFields['Needs Delivery'] = false;
            if (payload.deliveredFolderUrl) {
              fallbackFields['Delivered Folder URL'] = payload.deliveredFolderUrl;
            }
          } else {
            // Schema-aware mode: resolve aliases
            const checkboxAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredCheckbox, schema.writableNames);
            if (checkboxAlias) {
              fallbackFields[checkboxAlias] = true;
            }
            
            if (payload.readyToDeliverWebhook === false) {
              const webhookAlias = resolveAlias(DELIVERY_FIELD_ALIASES.readyToDeliverWebhook, schema.writableNames);
              if (webhookAlias) {
                fallbackFields[webhookAlias] = false;
              }
            }
            
            // Try to clear "Needs Delivery" flag if it exists
            const needsDeliveryAlias = resolveAlias(['Needs Delivery'], schema.writableNames);
            if (needsDeliveryAlias) {
              fallbackFields[needsDeliveryAlias] = false;
            }
            
            if (payload.deliveredFolderUrl) {
              const urlAlias = resolveAlias(DELIVERY_FIELD_ALIASES.deliveredFolderOrFileUrl, schema.writableNames);
              if (urlAlias) {
                fallbackFields[urlAlias] = payload.deliveredFolderUrl;
              }
            }
          }
          
          try {
            const base = getBase();
            await base(tableName).update(recordId, fallbackFields as any);
            const fallbackWritten = Object.keys(fallbackFields);
            console.log('[deliveryWriteBack] Written to', tableName, 'record', recordId, 'fields (final fallback, no Delivered At):', fallbackWritten.join(', '));
            return { ok: true, written: fallbackWritten, skipped: [...skipped, { field: deliveredAtAlias || 'Delivered At', reason: 'INVALID_VALUE_FOR_COLUMN (removed)' }] };
          } catch (finalErr) {
            const finalMessage = finalErr instanceof Error ? finalErr.message : String(finalErr);
            console.error('[deliveryWriteBack] Final fallback update also failed for record', recordId, ':', finalMessage);
            return { ok: false, written: [], skipped, error: `Original: ${message}; Date-only: ${dateOnlyMessage}; Final: ${finalMessage}` };
          }
        } else {
          // Date-only format worked, but some other field failed
          console.error('[deliveryWriteBack] Date-only format accepted but update still failed for record', recordId, ':', dateOnlyMessage);
          return { ok: false, written: [], skipped, error: `Original: ${message}; Date-only retry: ${dateOnlyMessage}` };
        }
      }
    }
    
    console.error('[deliveryWriteBack] Update failed for record', recordId, ':', message);
    return { ok: false, written: [], skipped, error: message };
  }
}

/** Creative Review Asset Status table name for delivery write-back. */
export const CREATIVE_REVIEW_ASSET_STATUS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

/** Partner Delivery Batches table name for delivery write-back. */
export const PARTNER_DELIVERY_BATCHES_TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

/** Partner activity field aliases (Partner Delivery Batches). */
export const PARTNER_ACTIVITY_ALIASES = {
  partnerLastSeenAt: ['Partner Last Seen At'],
  newApprovedCount: ['New Approved Count'],
  downloadedCount: ['Downloaded Count'],
} as const;

export interface PartnerActivityPayload {
  partnerLastSeenAt?: string;
  newApprovedCount?: number;
  downloadedCount?: number;
}

/**
 * Write partner activity to a batch record (alias-aware, skips non-writable).
 * Used when partner marks seen or downloads assets.
 */
export async function writePartnerActivityToRecord(
  tableName: string,
  recordId: string,
  payload: PartnerActivityPayload
): Promise<WriteDeliveryResult> {
  const baseId = getBaseId();
  let schema: { fields: Map<string, TableFieldMeta>; writableNames: Set<string> };

  try {
    schema = await getTableSchema(baseId, tableName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[deliveryWriteBack] Schema fetch failed for partner activity:', message);
    return { ok: false, written: [], skipped: [], error: message };
  }

  const fieldsToWrite: Record<string, unknown> = {};
  const written: string[] = [];
  const skipped: { field: string; reason: string }[] = [];

  if (payload.partnerLastSeenAt !== undefined) {
    const alias = resolveAlias(PARTNER_ACTIVITY_ALIASES.partnerLastSeenAt, schema.writableNames);
    if (alias) {
      fieldsToWrite[alias] = payload.partnerLastSeenAt;
      written.push(alias);
    } else {
      console.warn('[deliveryWriteBack] Partner Last Seen At field not found on table, skipping write');
    }
  }
  if (payload.newApprovedCount !== undefined) {
    const alias = resolveAlias(PARTNER_ACTIVITY_ALIASES.newApprovedCount, schema.writableNames);
    if (alias) {
      fieldsToWrite[alias] = payload.newApprovedCount;
      written.push(alias);
    }
  }
  if (payload.downloadedCount !== undefined) {
    const alias = resolveAlias(PARTNER_ACTIVITY_ALIASES.downloadedCount, schema.writableNames);
    if (alias) {
      fieldsToWrite[alias] = payload.downloadedCount;
      written.push(alias);
    }
  }

  if (Object.keys(fieldsToWrite).length === 0) {
    return { ok: true, written: [], skipped };
  }

  try {
    const base = getBase();
    await base(tableName).update(recordId, fieldsToWrite as any);
    console.log('[deliveryWriteBack] Partner activity written to', tableName, 'record', recordId, 'fields:', written.join(', '));
    return { ok: true, written, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[deliveryWriteBack] Partner activity update failed for record', recordId, ':', message);
    return { ok: false, written: [], skipped, error: message };
  }
}
