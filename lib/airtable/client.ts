// lib/airtable/client.ts
// Airtable client with edge-compatible fetch-based helpers

import { getBase } from '@/lib/airtable';

// ============================================================================
// Retry Logic for Rate Limits
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // Start with 1 second

/**
 * Fetch wrapper with exponential backoff for 429 rate limit errors
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 429 && retries > 0) {
    const delay = BASE_DELAY_MS * Math.pow(2, MAX_RETRIES - retries);
    console.warn(`[Airtable] Rate limited, retrying in ${delay}ms... (${retries} retries left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1);
  }

  return response;
}

// Lazy initialization to avoid build-time errors when env vars aren't available
let _base: ReturnType<typeof getBase> | null = null;
export function getLazyBase() {
  if (!_base) {
    _base = getBase();
  }
  return _base;
}

// For backward compatibility, export base as a callable function that acts like Airtable.Base
// We use a function as the proxy target so that `apply` trap works when calling base('Table Name')
export const base = new Proxy(function() {} as unknown as ReturnType<typeof getBase>, {
  get(target, prop) {
    const instance = getLazyBase();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  apply(target, thisArg, args) {
    const instance = getLazyBase();
    return (instance as any)(...args);
  }
}) as ReturnType<typeof getBase>;

/**
 * Airtable Configuration
 */
export interface AirtableConfig {
  apiKey: string;
  baseId: string;
}

/**
 * Get Airtable configuration from environment variables
 * Throws if credentials are missing
 * Uses same base resolution logic as getBase(): checks AIRTABLE_OS_BASE_ID first, then AIRTABLE_BASE_ID
 */
export function getAirtableConfig(): AirtableConfig {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  // Check AIRTABLE_OS_BASE_ID first (for Hive OS routes), then fall back to AIRTABLE_BASE_ID
  const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error(
      'Airtable credentials not configured. Set AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN) and AIRTABLE_BASE_ID (or AIRTABLE_OS_BASE_ID).'
    );
  }

  return { apiKey, baseId };
}

/**
 * Create a record in an Airtable table using fetch API (edge-compatible)
 *
 * @param tableName - Name of the Airtable table
 * @param fields - Record fields as key-value pairs
 * @param baseIdOverride - Optional base ID override (for tables in different bases)
 * @returns Created record data from Airtable
 * @throws Error if the API request fails
 */
export async function createRecord(
  tableName: string,
  fields: Record<string, unknown>,
  baseIdOverride?: string
): Promise<any> {
  const config = getAirtableConfig();
  // Use override if provided, otherwise use default base
  const baseId = baseIdOverride || config.baseId;

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}`;

  const isCommentsTable = tableName === 'Comments';
  const apiKeyPrefix = config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'missing';
  
  console.log('[Airtable] Creating record:', {
    operation: 'airtable.create',
    url: url.replace(config.apiKey, '***'),
    tableName,
    baseId: isCommentsTable ? baseId : baseId.substring(0, 20) + '...', // Show full baseId for Comments table
    baseIdFull: isCommentsTable ? baseId : undefined, // Show full baseId for Comments table
    baseIdOverride: baseIdOverride || 'none',
    usingOverride: !!baseIdOverride,
    defaultBaseId: config.baseId.substring(0, 20) + '...',
    authMode: config.apiKey ? 'service_account' : 'none',
    apiKeyPrefix,
    fieldCount: Object.keys(fields).length,
    fieldKeys: Object.keys(fields),
    fields: (tableName === 'GAP-Heavy Run' || tableName === 'Diagnostic Runs' || tableName === 'Comments') ? fields : undefined, // Log fields for Heavy Run, Diagnostic Runs, and Comments tables
  });

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorDetails = {
      operation: 'airtable.create',
      status: response.status,
      statusText: response.statusText,
      errorText,
      url: url.replace(config.apiKey, '***'),
      tableName,
      baseId: isCommentsTable ? baseId : baseId.substring(0, 20) + '...',
      baseIdFull: isCommentsTable ? baseId : undefined,
      authMode: config.apiKey ? 'service_account' : 'none',
      apiKeyPrefix,
    };
    console.error('[Airtable] API error:', errorDetails);
    
    // Enhanced error message for 403 errors
    if (response.status === 403) {
      let errorObj: any = {};
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        // Not JSON, use raw text
      }
      const errorMessage = errorObj?.error?.message || errorText;
      const apiKeyPrefix = config.apiKey ? config.apiKey.substring(0, 20) + '...' : 'missing';
      
      console.error('[Airtable] 403 NOT_AUTHORIZED detected:', {
        operation: 'airtable.create',
        baseId: isCommentsTable ? baseId : baseId.substring(0, 20) + '...',
        baseIdFull: isCommentsTable ? baseId : undefined,
        tableName,
        authMode: config.apiKey ? 'service_account' : 'none',
        apiKeyPrefix,
        errorMessage,
        errorText,
      });
      
      throw new Error(
        `Airtable API 403 NOT_AUTHORIZED: ${errorMessage}. ` +
        `Operation: airtable.create, Base: ${isCommentsTable ? baseId : baseId.substring(0, 20) + '...'}, Table: ${tableName}, ` +
        `Auth Mode: ${config.apiKey ? 'service_account' : 'none'}, API Key: ${apiKeyPrefix}. ` +
        `Check API key permissions for base ${isCommentsTable ? baseId : baseId.substring(0, 20) + '...'} and table "${tableName}". ` +
        `The API key may not have access to this base/table, or the base/table may not exist.`
      );
    }
    
    throw new Error(
      `Airtable API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  console.log('[Airtable] Record created successfully:', {
    recordId: result?.id || result?.records?.[0]?.id,
    tableName,
    returnedFields: tableName === 'GAP-Heavy Run' ? result?.fields : undefined, // Log returned fields for Heavy Run
  });
  return result;
}

/**
 * Get a single record by ID from Airtable
 *
 * @param tableName - Name of the Airtable table
 * @param recordId - ID of the record to retrieve
 * @returns Record data from Airtable
 * @throws Error if the API request fails
 */
export async function getRecord(
  tableName: string,
  recordId: string
): Promise<any> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(tableName)}/${recordId}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Airtable GET failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Update a record in an Airtable table using fetch API (edge-compatible)
 *
 * @param tableName - Name of the Airtable table
 * @param recordId - ID of the record to update
 * @param fields - Record fields to update
 * @returns Updated record data from Airtable
 * @throws Error if the API request fails
 */
export async function updateRecord(
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>,
  requestId?: string | null
): Promise<any> {
  const config = getAirtableConfig();

  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  // Temporary instrumentation: detect "Delivered At" field
  const hasDeliveredAt = Object.prototype.hasOwnProperty.call(fields, 'Delivered At');
  const fieldKeys = Object.keys(fields);

  // Log correlation ID and update details before sending request
  console.log(`[airtable/update] requestId`, requestId ?? null, `table`, tableName, `recordId`, recordId, `keys`, fieldKeys, `hasDeliveredAt`, hasDeliveredAt);

  console.log('[Airtable] Updating record:', {
    url: url.replace(config.apiKey, '***'),
    tableName,
    recordId,
    fieldCount: Object.keys(fields).length,
    fields: tableName === 'GAP-Heavy Run' ? fields : undefined, // Log fields for Heavy Run table
    hasCompanyField: tableName === 'GAP-Heavy Run' ? ('Company' in fields) : undefined,
    // Temporary instrumentation for "Delivered At" debugging
    hasDeliveredAt,
    fieldKeys: hasDeliveredAt ? fieldKeys : undefined,
  });

  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      errorText,
      url: url.replace(config.apiKey, '***'),
      tableName,
      recordId,
    };
    console.error('[Airtable] API error:', errorDetails);
    throw new Error(
      `Airtable API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  console.log('[Airtable] Record updated successfully:', {
    recordId: result?.id,
    tableName,
  });
  return result;
}

/**
 * Find a record by a specific field value using fetch API (edge-compatible)
 *
 * @param tableName - Name of the Airtable table
 * @param fieldName - Name of the field to search
 * @param value - Value to search for
 * @returns Record data from Airtable or null if not found
 * @throws Error if the API request fails
 */
export async function findRecordByField(
  tableName: string,
  fieldName: string,
  value: string
): Promise<any> {
  const config = getAirtableConfig();

  // RECORD_ID() is a function, not a field, so don't wrap it in curly braces
  const filterFormula = fieldName === 'RECORD_ID()'
    ? `RECORD_ID() = '${value.replace(/'/g, "\\'")}'`
    : `{${fieldName}} = '${value.replace(/'/g, "\\'")}'`;
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    tableName
  )}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  console.log('[Airtable] Finding record:', {
    tableName,
    fieldName,
    value,
  });

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Airtable] API error: status=${response.status}, statusText=${response.statusText}, table=${tableName}, field=${fieldName}, value=${value}, error=${errorText}`);
    
    // Provide helpful guidance for permission errors
    if (response.status === 403 || response.status === 401) {
      const baseId = config.baseId.slice(0, 20);
      throw new Error(
        `Airtable API permission error (${response.status}): Token lacks access to table "${tableName}" in base ${baseId}... ` +
        `Ensure AIRTABLE_API_KEY has read permissions for this table. ` +
        `If the table is in a different base, configure AIRTABLE_DB_BASE_ID or AIRTABLE_OS_BASE_ID. ` +
        `Error: ${errorText.slice(0, 300)}`
      );
    }
    
    throw new Error(
      `Airtable API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  const records = result.records || [];

  if (records.length === 0) {
    console.log('[Airtable] No record found:', {
      tableName,
      fieldName,
      value,
    });
    return null;
  }

  console.log('[Airtable] Record found:', {
    recordId: records[0].id,
    tableName,
  });
  return records[0];
}

/**
 * Archive a record by setting its Archived field to true
 *
 * @param tableName - Name of the Airtable table
 * @param recordId - ID of the record to archive
 * @returns Updated record data from Airtable
 * @throws Error if the API request fails
 */
export async function archiveRecord(
  tableName: string,
  recordId: string
): Promise<any> {
  console.log('[Airtable] Archiving record:', {
    tableName,
    recordId,
  });

  return updateRecord(tableName, recordId, { Archived: true });
}

/**
 * Delete a record from an Airtable table using fetch API (edge-compatible)
 *
 * @param tableName - Name of the Airtable table
 * @param recordId - ID of the record to delete
 * @returns Deleted record confirmation from Airtable
 * @throws Error if the API request fails
 */
export async function deleteRecord(
  tableName: string,
  recordId: string
): Promise<any> {
  const config = getAirtableConfig();

  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  console.log('[Airtable] Deleting record:', {
    url: url.replace(config.apiKey, '***'),
    tableName,
    recordId,
  });

  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      errorText,
      url: url.replace(config.apiKey, '***'),
      tableName,
      recordId,
    };
    console.error('[Airtable] API error:', errorDetails);
    throw new Error(
      `Airtable API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  console.log('[Airtable] Record deleted successfully:', {
    recordId: result?.id,
    tableName,
  });
  return result;
}
