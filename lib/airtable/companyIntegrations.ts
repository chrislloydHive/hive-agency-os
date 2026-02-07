// lib/airtable/companyIntegrations.ts
// Per-company integrations storage for OAuth tokens and integration metadata

import { getAirtableConfig, findRecordByField, updateRecord, createRecord } from '@/lib/airtable/client';

const TABLE_NAME = 'CompanyIntegrations';

// ============================================================================
// Types
// ============================================================================

export interface GA4Integration {
  connected: boolean;
  propertyId?: string;        // "properties/123456789"
  webStreamId?: string;       // "properties/123456789/dataStreams/987654321"
  measurementId?: string;     // "G-XXXXXXXX"
  conversionEvents?: string[];
  allEvents?: string[];       // All events discovered (for suggestions)
  attributionSettings?: {
    acquisitionConversionEventLookbackWindow?: string;
    otherConversionEventLookbackWindow?: string;
    reportingAttributionModel?: string;
  };
  lastSyncedAt?: string;
}

export interface GSCIntegration {
  connected: boolean;
  siteUrl?: string;           // "https://example.com/"
  lastSyncedAt?: string;
  sampleMetrics?: {
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  };
}

export interface GoogleIntegration {
  connected: boolean;
  refreshToken?: string;      // Encrypted refresh token
  accessToken?: string;       // Short-lived access token (optional caching)
  accessTokenExpiresAt?: string;
  connectedAt?: string;
  connectedEmail?: string;    // Email of the Google account used
  ga4?: GA4Integration;
  gsc?: GSCIntegration;
}

export interface CompanyIntegrations {
  id?: string;                // Airtable record ID
  companyId: string;
  google?: GoogleIntegration;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableCompanyIntegrationsFields {
  CompanyId: string;
  GoogleConnected?: boolean;
  GoogleRefreshToken?: string;
  GoogleAccessToken?: string;
  GoogleAccessTokenExpiresAt?: string;
  GoogleConnectedAt?: string;
  GoogleConnectedEmail?: string;
  // GA4 fields
  GA4Connected?: boolean;
  GA4PropertyId?: string;
  GA4WebStreamId?: string;
  GA4MeasurementId?: string;
  GA4ConversionEvents?: string;  // JSON array
  GA4AllEvents?: string;         // JSON array
  GA4AttributionSettings?: string; // JSON object
  GA4LastSyncedAt?: string;
  // GSC fields
  GSCConnected?: boolean;
  GSCSiteUrl?: string;
  GSCLastSyncedAt?: string;
  GSCSampleMetrics?: string;     // JSON object
  // Timestamps
  CreatedAt?: string;
  UpdatedAt?: string;
}

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapAirtableToCompanyIntegrations(record: any): CompanyIntegrations {
  const fields = record.fields as AirtableCompanyIntegrationsFields;

  const google: GoogleIntegration | undefined = fields.GoogleConnected ? {
    connected: true,
    refreshToken: fields.GoogleRefreshToken || undefined,
    accessToken: fields.GoogleAccessToken || undefined,
    accessTokenExpiresAt: fields.GoogleAccessTokenExpiresAt || undefined,
    connectedAt: fields.GoogleConnectedAt || undefined,
    connectedEmail: fields.GoogleConnectedEmail || undefined,
    ga4: fields.GA4Connected ? {
      connected: true,
      propertyId: fields.GA4PropertyId || undefined,
      webStreamId: fields.GA4WebStreamId || undefined,
      measurementId: fields.GA4MeasurementId || undefined,
      conversionEvents: parseJsonField(fields.GA4ConversionEvents, []),
      allEvents: parseJsonField(fields.GA4AllEvents, []),
      attributionSettings: parseJsonField(fields.GA4AttributionSettings, undefined),
      lastSyncedAt: fields.GA4LastSyncedAt || undefined,
    } : { connected: false },
    gsc: fields.GSCConnected ? {
      connected: true,
      siteUrl: fields.GSCSiteUrl || undefined,
      lastSyncedAt: fields.GSCLastSyncedAt || undefined,
      sampleMetrics: parseJsonField(fields.GSCSampleMetrics, undefined),
    } : { connected: false },
  } : undefined;

  return {
    id: record.id,
    companyId: fields.CompanyId,
    google,
    createdAt: fields.CreatedAt || undefined,
    updatedAt: fields.UpdatedAt || undefined,
  };
}

function mapCompanyIntegrationsToAirtable(
  integrations: Partial<CompanyIntegrations>
): Partial<AirtableCompanyIntegrationsFields> {
  const fields: Partial<AirtableCompanyIntegrationsFields> = {};

  if (integrations.companyId) {
    fields.CompanyId = integrations.companyId;
  }

  if (integrations.google !== undefined) {
    const g = integrations.google;
    fields.GoogleConnected = g?.connected ?? false;

    if (g) {
      if (g.refreshToken !== undefined) fields.GoogleRefreshToken = g.refreshToken;
      if (g.accessToken !== undefined) fields.GoogleAccessToken = g.accessToken;
      if (g.accessTokenExpiresAt !== undefined) fields.GoogleAccessTokenExpiresAt = g.accessTokenExpiresAt;
      if (g.connectedAt !== undefined) fields.GoogleConnectedAt = g.connectedAt;
      if (g.connectedEmail !== undefined) fields.GoogleConnectedEmail = g.connectedEmail;

      if (g.ga4 !== undefined) {
        fields.GA4Connected = g.ga4.connected;
        if (g.ga4.propertyId !== undefined) fields.GA4PropertyId = g.ga4.propertyId;
        if (g.ga4.webStreamId !== undefined) fields.GA4WebStreamId = g.ga4.webStreamId;
        if (g.ga4.measurementId !== undefined) fields.GA4MeasurementId = g.ga4.measurementId;
        if (g.ga4.conversionEvents !== undefined) fields.GA4ConversionEvents = JSON.stringify(g.ga4.conversionEvents);
        if (g.ga4.allEvents !== undefined) fields.GA4AllEvents = JSON.stringify(g.ga4.allEvents);
        if (g.ga4.attributionSettings !== undefined) fields.GA4AttributionSettings = JSON.stringify(g.ga4.attributionSettings);
        if (g.ga4.lastSyncedAt !== undefined) fields.GA4LastSyncedAt = g.ga4.lastSyncedAt;
      }

      if (g.gsc !== undefined) {
        fields.GSCConnected = g.gsc.connected;
        if (g.gsc.siteUrl !== undefined) fields.GSCSiteUrl = g.gsc.siteUrl;
        if (g.gsc.lastSyncedAt !== undefined) fields.GSCLastSyncedAt = g.gsc.lastSyncedAt;
        if (g.gsc.sampleMetrics !== undefined) fields.GSCSampleMetrics = JSON.stringify(g.gsc.sampleMetrics);
      }
    }
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get company integrations by company ID
 * 
 * IMPORTANT: This function preserves the original behavior of checking AIRTABLE_BASE_ID first.
 * For multi-base lookup with DB/OS fallback, use findCompanyIntegration() directly.
 */
export async function getCompanyIntegrations(
  companyId: string
): Promise<CompanyIntegrations | null> {
  try {
    console.log('[CompanyIntegrations] Looking for company:', companyId);
    
    // Preserve original behavior: use findRecordByField which checks AIRTABLE_BASE_ID
    // This ensures backward compatibility - if CompanyIntegrations is in AIRTABLE_BASE_ID,
    // it will be found there first, matching the old behavior
    const record = await findRecordByField(TABLE_NAME, 'CompanyId', companyId);

    if (record) {
      console.log('[CompanyIntegrations] Found existing record:', record.id);
      return mapAirtableToCompanyIntegrations(record);
    }

    console.log('[CompanyIntegrations] No record found for company:', companyId);
    return null;
  } catch (error) {
    // If we get a permission error, try multi-base lookup as fallback
    const errStr = error instanceof Error ? error.message : String(error);
    if (errStr.includes('403') || errStr.includes('401') || errStr.includes('permission')) {
      console.warn('[CompanyIntegrations] Permission error with AIRTABLE_BASE_ID, trying multi-base lookup:', errStr);
      try {
        const result = await findCompanyIntegration({ companyId });
        if (result.record) {
          console.log(`[CompanyIntegrations] Found via multi-base lookup: ${result.record.id} (matched by: ${result.matchedBy})`);
          return mapAirtableToCompanyIntegrations(result.record as any);
        }
      } catch (fallbackError) {
        console.warn('[CompanyIntegrations] Multi-base lookup also failed:', fallbackError);
      }
    }
    console.warn('[CompanyIntegrations] Error fetching integrations:', error);
    return null;
  }
}

/**
 * Create or update company integrations
 */
export async function upsertCompanyIntegrations(
  integrations: CompanyIntegrations
): Promise<CompanyIntegrations> {
  const existing = await getCompanyIntegrations(integrations.companyId);

  const fields = mapCompanyIntegrationsToAirtable(integrations);
  fields.UpdatedAt = new Date().toISOString();

  if (existing?.id) {
    // Update existing record
    console.log('[CompanyIntegrations] Updating record:', existing.id);
    const updatedRecord = await updateRecord(TABLE_NAME, existing.id, fields);
    return mapAirtableToCompanyIntegrations(updatedRecord);
  } else {
    // Create new record
    console.log('[CompanyIntegrations] Creating new record for company:', integrations.companyId);
    fields.CreatedAt = new Date().toISOString();
    const newRecord = await createRecord(TABLE_NAME, fields);
    return mapAirtableToCompanyIntegrations(newRecord);
  }
}

/**
 * Update only Google OAuth tokens for a company
 */
export async function updateGoogleTokens(
  companyId: string,
  tokens: {
    refreshToken: string;
    accessToken?: string;
    accessTokenExpiresAt?: string;
    connectedEmail?: string;
  }
): Promise<CompanyIntegrations> {
  const existing = await getCompanyIntegrations(companyId);

  const google: GoogleIntegration = {
    ...(existing?.google || { connected: false }),
    connected: true,
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    connectedAt: new Date().toISOString(),
    connectedEmail: tokens.connectedEmail,
  };

  return upsertCompanyIntegrations({
    companyId,
    google,
  });
}

/**
 * Update GA4 integration data for a company
 */
export async function updateGA4Integration(
  companyId: string,
  ga4Data: Partial<GA4Integration>
): Promise<CompanyIntegrations> {
  const existing = await getCompanyIntegrations(companyId);

  if (!existing?.google?.connected) {
    throw new Error('Google not connected for this company');
  }

  const google: GoogleIntegration = {
    ...existing.google,
    ga4: {
      ...(existing.google.ga4 || { connected: false }),
      ...ga4Data,
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
  };

  return upsertCompanyIntegrations({
    companyId,
    google,
  });
}

/**
 * Update GSC integration data for a company
 */
export async function updateGSCIntegration(
  companyId: string,
  gscData: Partial<GSCIntegration>
): Promise<CompanyIntegrations> {
  const existing = await getCompanyIntegrations(companyId);

  if (!existing?.google?.connected) {
    throw new Error('Google not connected for this company');
  }

  const google: GoogleIntegration = {
    ...existing.google,
    gsc: {
      ...(existing.google.gsc || { connected: false }),
      ...gscData,
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
  };

  return upsertCompanyIntegrations({
    companyId,
    google,
  });
}

/**
 * Disconnect Google integration for a company
 */
export async function disconnectGoogle(companyId: string): Promise<void> {
  const existing = await getCompanyIntegrations(companyId);

  if (existing?.id) {
    await updateRecord(TABLE_NAME, existing.id, {
      GoogleConnected: false,
      GoogleRefreshToken: '',
      GoogleAccessToken: '',
      GA4Connected: false,
      GSCConnected: false,
      UpdatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Check if Google is connected for a company
 */
export async function isGoogleConnected(companyId: string): Promise<boolean> {
  const integrations = await getCompanyIntegrations(companyId);
  return integrations?.google?.connected === true && !!integrations.google.refreshToken;
}

/**
 * Get Google connection status for a company
 */
export async function getGoogleConnectionStatus(companyId: string): Promise<{
  connected: boolean;
  ga4Connected: boolean;
  gscConnected: boolean;
  ga4PropertyId?: string;
  ga4MeasurementId?: string;
  gscSiteUrl?: string;
  connectedEmail?: string;
  connectedAt?: string;
}> {
  const integrations = await getCompanyIntegrations(companyId);

  return {
    connected: integrations?.google?.connected === true && !!integrations.google.refreshToken,
    ga4Connected: integrations?.google?.ga4?.connected === true,
    gscConnected: integrations?.google?.gsc?.connected === true,
    ga4PropertyId: integrations?.google?.ga4?.propertyId,
    ga4MeasurementId: integrations?.google?.ga4?.measurementId,
    gscSiteUrl: integrations?.google?.gsc?.siteUrl,
    connectedEmail: integrations?.google?.connectedEmail,
    connectedAt: integrations?.google?.connectedAt,
  };
}

// ============================================================================
// Robust CompanyIntegrations lookup (DB base → OS base fallback)
// ============================================================================

export type CompanyGoogleOAuth = {
  companyId: string;
  googleConnected: boolean;
  googleRefreshToken: string | null;
  googleConnectedEmail?: string | null;
  googleOAuthScopeVersion?: string | null;
  recordId?: string;
};

export interface FindCompanyIntegrationArgs {
  /** Optional when looking up by clientCode or companyName only (e.g. reconnect for review when company is not in OS). */
  companyId?: string | null;
  companyName?: string | null;
  clientCode?: string | null;
  /** If set, only try this Airtable base (e.g. Client PM base where CompanyIntegrations lives). Use when table is not in DB/OS bases. */
  baseIdOverride?: string | null;
}

export interface LookupAttempt {
  base: string;
  baseId: string;
  tableName: string;
  formula: string;
  status: number;
  ok: boolean;
  recordCount: number | null;
  error: unknown;
}

export interface FindCompanyIntegrationResult {
  record: { id: string; fields: Record<string, unknown> } | null;
  matchedBy: string | null;
  debug: { attempts: LookupAttempt[] };
}

function escapeFormulaValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeChecked(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string' && v.toLowerCase() === 'checked') return true;
  return false;
}

function airtableListUrl(baseId: string, tableName: string): string {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

// ============================================================================
// Safe-patch helper — filters fields to only those that exist in Airtable
// ============================================================================

const schemaCache = new Map<string, { fields: Set<string>; fetchedAt: number }>();
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch the list of field names for a table (cached for 10 min).
 * Uses the Airtable Meta API: GET /v0/meta/bases/{baseId}/tables
 */
async function getTableFieldNames(baseId: string, tableName: string): Promise<Set<string>> {
  const cacheKey = `${baseId}::${tableName}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cached.fields;
  }

  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN');

  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`[CompanyIntegrations] Schema fetch failed (${res.status}) – skipping field filter`);
    return new Set(); // empty = don't filter
  }

  const json = await res.json() as { tables?: Array<{ name: string; fields?: Array<{ name: string }> }> };
  const table = json.tables?.find((t) => t.name === tableName);
  const fieldNames = new Set(table?.fields?.map((f) => f.name) ?? []);

  schemaCache.set(cacheKey, { fields: fieldNames, fetchedAt: Date.now() });
  console.log(`[CompanyIntegrations] Cached ${fieldNames.size} field names for ${tableName}`);
  return fieldNames;
}

/**
 * Strip any keys from `fields` that don't exist in the Airtable table schema.
 * If schema fetch fails, returns fields unchanged (fail-open).
 */
async function filterToKnownFields(
  baseId: string,
  tableName: string,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let knownFields: Set<string>;
  try {
    knownFields = await getTableFieldNames(baseId, tableName);
  } catch (err) {
    console.warn('[CompanyIntegrations] filterToKnownFields – schema fetch error, passing all fields:', err);
    return fields;
  }

  // Empty set means schema fetch failed – don't filter
  if (knownFields.size === 0) return fields;

  const filtered: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (knownFields.has(key)) {
      filtered[key] = value;
    } else {
      dropped.push(key);
    }
  }

  if (dropped.length > 0) {
    console.warn(`[CompanyIntegrations] Dropped unknown fields for ${tableName}: ${dropped.join(', ')}`);
  }

  return filtered;
}

async function airtableGet(
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; json: Record<string, any>; text: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, json, text };
}

/**
 * Find a CompanyIntegrations record across one or two Airtable bases.
 *
 * Lookup order (per base):
 *   1. {CompanyId} = companyId  (string field exact match)
 *   2. RECORD_ID() = companyId  (if CompanyId is the record's own ID)
 *   3. {Client Code} = clientCode  (if provided)
 *   4. {Company Name} = companyName  (if provided)
 *   5. {CompanyName} = companyName   (field-name variant)
 *
 * Bases tried in order:
 *   - AIRTABLE_DB_BASE_ID  (if set)
 *   - AIRTABLE_OS_BASE_ID / AIRTABLE_BASE_ID  (fallback)
 *
 * Every Airtable request is logged with base, table, formula, status, and
 * response body on failure. This makes "query failed" errors actionable.
 */
export async function findCompanyIntegration({
  companyId,
  companyName,
  clientCode,
  baseIdOverride,
}: FindCompanyIntegrationArgs): Promise<FindCompanyIntegrationResult> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) {
    return {
      record: null,
      matchedBy: null,
      debug: { attempts: [{ base: '-', baseId: '-', tableName: '-', formula: '-', status: 0, ok: false, recordCount: null, error: 'Missing env var: AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN' }] },
    };
  }

  const dbBaseId = process.env.AIRTABLE_DB_BASE_ID || '';
  const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

  const basesToTry: Array<{ label: string; baseId: string }> = [];
  if (baseIdOverride && baseIdOverride.trim()) {
    basesToTry.push({ label: 'Override', baseId: baseIdOverride.trim() });
  } else {
    if (dbBaseId) basesToTry.push({ label: 'DB', baseId: dbBaseId });
    if (osBaseId && osBaseId !== dbBaseId) basesToTry.push({ label: 'OS', baseId: osBaseId });
  }

  if (basesToTry.length === 0) {
    return {
      record: null,
      matchedBy: null,
      debug: { attempts: [{ base: '-', baseId: '-', tableName: '-', formula: '-', status: 0, ok: false, recordCount: null, error: 'No AIRTABLE_DB_BASE_ID or AIRTABLE_BASE_ID configured' }] },
    };
  }

  const tableName = 'CompanyIntegrations';
  const attempts: LookupAttempt[] = [];
  const hasCompanyId = typeof companyId === 'string' && companyId.trim().length > 0;
  const hasClientCode = typeof clientCode === 'string' && clientCode.trim().length > 0;
  const hasCompanyName = typeof companyName === 'string' && companyName.trim().length > 0;
  if (!hasCompanyId && !hasClientCode && !hasCompanyName) {
    return {
      record: null,
      matchedBy: null,
      debug: { attempts: [{ base: '-', baseId: '-', tableName: '-', formula: '-', status: 0, ok: false, recordCount: null, error: 'Provide at least one of companyId, clientCode, or companyName' }] },
    };
  }

  for (const base of basesToTry) {
    // Build lookup steps for this base
    type Step = { key: string; formula: string };
    const steps: Step[] = [];
    if (hasCompanyId) {
      const idVal = escapeFormulaValue(companyId!.trim());
      steps.push(
        { key: `CompanyId (${base.label})`, formula: `{CompanyId} = "${idVal}"` },
        { key: `RECORD_ID (${base.label})`, formula: `RECORD_ID() = "${idVal}"` },
      );
    }
    if (clientCode) {
      steps.push({ key: `Client Code (${base.label})`, formula: `{Client Code} = "${escapeFormulaValue(clientCode)}"` });
    }
    if (companyName) {
      steps.push(
        { key: `Company Name (${base.label})`, formula: `{Company Name} = "${escapeFormulaValue(companyName)}"` },
        { key: `CompanyName (${base.label})`, formula: `{CompanyName} = "${escapeFormulaValue(companyName)}"` },
      );
    }

    for (const step of steps) {
      const url =
        airtableListUrl(base.baseId, tableName) +
        `?maxRecords=1&filterByFormula=${encodeURIComponent(step.formula)}`;

      const r = await airtableGet(url, apiKey);

      const attempt: LookupAttempt = {
        base: base.label,
        baseId: base.baseId,
        tableName,
        formula: step.formula,
        status: r.status,
        ok: r.ok,
        recordCount: r.ok ? (r.json?.records?.length ?? 0) : null,
        error: r.ok ? null : (r.json?.error ?? r.text),
      };
      attempts.push(attempt);

      console.log(
        `[CompanyIntegrations] ${step.key} – base=${base.baseId} status=${r.status} ` +
        `records=${attempt.recordCount ?? 'N/A'} formula=${step.formula}` +
        (r.ok ? '' : ` ERROR: ${r.text.slice(0, 200)}`),
      );

      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          // Log permission error but continue trying other bases/formulas
          // Don't throw - allow fallback to other bases or return null gracefully
          console.warn(
            `[CompanyIntegrations] Permission denied (${r.status}) for ${base.label} base (baseId=${base.baseId.slice(0, 20)}...). ` +
            `Token may lack access to CompanyIntegrations table in this base. ` +
            `Error: ${r.text.slice(0, 200)}`,
          );
          // Continue to next step/base rather than aborting
          continue;
        }
        // Non-auth error on this formula — skip to next step rather than aborting,
        // because the field name may simply not exist in this base.
        continue;
      }

      const rec = r.json?.records?.[0];
      if (rec) {
        console.log(
          `[CompanyIntegrations] MATCHED by "${step.key}" – recordId=${rec.id}`,
        );
        return {
          record: { id: rec.id, fields: rec.fields || {} },
          matchedBy: step.key,
          debug: { attempts },
        };
      }
    }
  }

  console.log(
    `[CompanyIntegrations] No record found after ${attempts.length} attempts across ${basesToTry.map((b) => b.label).join(', ')}`,
  );
  return { record: null, matchedBy: null, debug: { attempts } };
}

/**
 * Convenience wrapper: find CompanyIntegrations and extract Google OAuth fields.
 * Returns null when no record is found.
 */
export async function getCompanyGoogleOAuthFromDBBase(
  companyId: string,
  opts?: { clientCode?: string; companyName?: string },
): Promise<(CompanyGoogleOAuth & { matchedBy: string; debug: { attempts: LookupAttempt[] } }) | null> {
  const result = await findCompanyIntegration({
    companyId,
    clientCode: opts?.clientCode,
    companyName: opts?.companyName,
  });

  if (!result.record || !result.matchedBy) {
    return null;
  }

  const f = result.record.fields;
  return {
    companyId,
    googleConnected: normalizeChecked(f['GoogleConnected']),
    googleRefreshToken: (f['GoogleRefreshToken'] as string) || null,
    googleConnectedEmail: (f['GoogleConnectedEmail'] as string) || null,
    googleOAuthScopeVersion: (f['GoogleOAuthScopeVersion'] as string) || (f['Google OAuth Scope Version'] as string) || null,
    recordId: result.record.id,
    matchedBy: result.matchedBy,
    debug: result.debug,
  };
}

// ============================================================================
// Primary callback helper — PATCH tokens into the base where the record lives
// ============================================================================

/**
 * Update Google OAuth tokens on an existing CompanyIntegrations record.
 *
 * Uses findCompanyIntegration() to locate the row (DB base → OS base
 * fallback), then PATCHes it **in the same base it was found in**.
 *
 * - GoogleRefreshToken is only overwritten when a new value is provided.
 * - GoogleConnected is set to true when a refresh token exists (new or
 *   already stored).
 *
 * Throws if no CompanyIntegrations record is found for the companyId.
 * Never logs token values.
 */
export async function updateGoogleTokensForCompany(args: {
  companyId: string;
  refreshToken?: string | null;
  accessToken?: string | null;
  expiresAt?: string | null;
  connectedEmail?: string | null;
}): Promise<{ ok: true; updatedRecordId: string }> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) throw new Error('Missing AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN');

  // 1. Locate record
  const result = await findCompanyIntegration({ companyId: args.companyId });

  if (!result.record) {
    const err = new Error(
      `No CompanyIntegrations record found for companyId=${args.companyId}`,
    );
    (err as any).debug = result.debug;
    throw err;
  }

  const recordId = result.record.id;
  const existingFields = result.record.fields;

  // Determine which base the record was found in
  const matchedAttempt = result.debug.attempts.find(
    (a) => a.ok && a.recordCount !== null && a.recordCount > 0,
  );
  const baseId = matchedAttempt?.baseId
    || process.env.AIRTABLE_DB_BASE_ID
    || process.env.AIRTABLE_OS_BASE_ID
    || process.env.AIRTABLE_BASE_ID
    || '';

  if (!baseId) throw new Error('Cannot determine Airtable baseId for PATCH');

  // 2. Build PATCH fields
  const hasNewRefresh = typeof args.refreshToken === 'string' && args.refreshToken.length > 0;
  const hasExistingRefresh =
    typeof existingFields['GoogleRefreshToken'] === 'string' &&
    (existingFields['GoogleRefreshToken'] as string).length > 0;

  const fields: Record<string, unknown> = {
    GoogleConnected: hasNewRefresh || hasExistingRefresh,
    GoogleConnectedAt: new Date().toISOString(),
  };

  if (hasNewRefresh) {
    fields.GoogleRefreshToken = args.refreshToken;
  }
  if (args.accessToken) {
    fields.GoogleAccessToken = args.accessToken;
  }
  if (args.expiresAt) {
    fields.GoogleAccessTokenExpiresAt = args.expiresAt;
  }
  if (args.connectedEmail) {
    fields.GoogleConnectedEmail = args.connectedEmail;
  }

  // 3. PATCH (filter to known fields to avoid 422 on schema mismatches)
  const safeFields = await filterToKnownFields(baseId, 'CompanyIntegrations', fields);
  const patchUrl = `${airtableListUrl(baseId, 'CompanyIntegrations')}/${recordId}`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: safeFields }),
  });

  if (!patchRes.ok) {
    const patchText = await patchRes.text();
    throw new Error(
      `Failed to PATCH CompanyIntegrations ${recordId} (${patchRes.status}): ${patchText.slice(0, 300)}`,
    );
  }

  console.log(
    `[CompanyIntegrations] updateGoogleTokensForCompany – ` +
    `recordId=${recordId} baseId=${baseId} ` +
    `GoogleConnected=${fields.GoogleConnected} ` +
    `hasNewRefreshToken=${hasNewRefresh} ` +
    `companyId=${args.companyId}`,
  );

  return { ok: true, updatedRecordId: recordId };
}

// ============================================================================
// Direct DB-base upsert for Google OAuth tokens (used by callback route)
// ============================================================================

type GoogleTokenPayload = {
  refreshToken: string;
  accessToken: string;
  expiresAt: string; // ISO string
  connectedEmail?: string | null;
  scopeVersion?: string | null;
};

const COMPANY_INTEGRATIONS_TABLE = 'CompanyIntegrations';

function airtableAuthHeaders() {
  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN)');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function airtableGetDirect(baseId: string, path: string) {
  const url = `https://api.airtable.com/v0/${baseId}/${path}`;
  const res = await fetch(url, { headers: airtableAuthHeaders() });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* empty */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`Airtable GET failed (${res.status}): ${msg}`);
  }
  return json;
}

async function airtablePatch(baseId: string, table: string, recordId: string, fields: Record<string, unknown>) {
  const safeFields = await filterToKnownFields(baseId, table, fields);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: airtableAuthHeaders(),
    body: JSON.stringify({ fields: safeFields }),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* empty */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`Airtable PATCH failed (${res.status}): ${msg}`);
  }
  return json;
}

async function airtablePostDirect(baseId: string, table: string, fields: Record<string, unknown>) {
  const safeFields = await filterToKnownFields(baseId, table, fields);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: airtableAuthHeaders(),
    body: JSON.stringify({ records: [{ fields: safeFields }] }),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* empty */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`Airtable POST failed (${res.status}): ${msg}`);
  }
  return json;
}

/**
 * Upserts Google OAuth tokens into CompanyIntegrations (DB base).
 * Matches on {CompanyId} exact string match. Creates the row if missing.
 *
 * Field names written (exact Airtable column names):
 *   CompanyId, GoogleConnected, GoogleRefreshToken, GoogleAccessToken,
 *   GoogleAccessTokenExpiresAt, GoogleConnectedAt, GoogleConnectedEmail
 *
 * Never logs token values.
 */
export async function upsertCompanyGoogleTokens(
  companyId: string,
  tokens: GoogleTokenPayload,
) {
  const baseId = process.env.AIRTABLE_DB_BASE_ID;
  if (!baseId) throw new Error('Missing AIRTABLE_DB_BASE_ID');

  const nowIso = new Date().toISOString();

  // Find existing row by CompanyId
  const formula = `{CompanyId} = "${escapeFormulaValue(companyId)}"`;
  const query = `${encodeURIComponent(COMPANY_INTEGRATIONS_TABLE)}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const found = await airtableGetDirect(baseId, query);

  const fields: Record<string, unknown> = {
    CompanyId: companyId,
    GoogleConnected: true,
    GoogleRefreshToken: tokens.refreshToken,
    GoogleAccessToken: tokens.accessToken,
    GoogleAccessTokenExpiresAt: tokens.expiresAt,
    GoogleConnectedAt: nowIso,
    GoogleConnectedEmail: tokens.connectedEmail || '',
    ...(tokens.scopeVersion ? { GoogleOAuthScopeVersion: tokens.scopeVersion } : {}),
  };

  const recId = found?.records?.[0]?.id;

  if (recId) {
    console.log(`[CompanyIntegrations] upsertCompanyGoogleTokens – updating record ${recId} for companyId=${companyId}`);
    return airtablePatch(baseId, COMPANY_INTEGRATIONS_TABLE, recId, fields);
  }

  // Create if missing
  console.log(`[CompanyIntegrations] upsertCompanyGoogleTokens – creating row for companyId=${companyId}`);
  return airtablePostDirect(baseId, COMPANY_INTEGRATIONS_TABLE, fields);
}

// ============================================================================
// Admin helper — create a placeholder row for "Connect Google" flow
// ============================================================================

/**
 * Insert a stub CompanyIntegrations row with GoogleConnected=false.
 * Used by an admin "Connect Google" flow to pre-create the row before
 * the OAuth callback fills in the refresh token.
 */
export async function createCompanyIntegrationPlaceholder({
  companyId,
  companyName,
  clientCode,
}: {
  companyId: string;
  companyName?: string;
  clientCode?: string;
}) {
  const baseId = process.env.AIRTABLE_DB_BASE_ID;
  if (!baseId) throw new Error('Missing AIRTABLE_DB_BASE_ID');

  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) throw new Error('Missing AIRTABLE_API_KEY');

  const url = airtableListUrl(baseId, 'CompanyIntegrations');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            CompanyId: companyId,
            ...(companyName ? { 'Company Name': companyName } : {}),
            ...(clientCode ? { 'Client Code': clientCode } : {}),
            GoogleConnected: false,
          },
        },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Failed to create CompanyIntegrations placeholder (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const data = JSON.parse(text);
  const record = data?.records?.[0];
  console.log(`[CompanyIntegrations] Created placeholder row: ${record?.id} for companyId=${companyId}`);
  return data;
}
