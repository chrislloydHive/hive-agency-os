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
  'Google Refresh Token'?: string;
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
    refreshToken: fields['Google Refresh Token'] || undefined,
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
      if (g.refreshToken !== undefined) fields['Google Refresh Token'] = g.refreshToken;
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
 */
export async function getCompanyIntegrations(
  companyId: string
): Promise<CompanyIntegrations | null> {
  try {
    console.log('[CompanyIntegrations] Looking for company:', companyId);
    const record = await findRecordByField(TABLE_NAME, 'CompanyId', companyId);

    if (record) {
      console.log('[CompanyIntegrations] Found existing record:', record.id);
      return mapAirtableToCompanyIntegrations(record);
    }

    console.log('[CompanyIntegrations] No record found for company:', companyId);
    return null;
  } catch (error) {
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
      'Google Refresh Token': '',
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
  recordId?: string;
};

export interface FindCompanyIntegrationArgs {
  companyId: string;
  companyName?: string | null;
  clientCode?: string | null;
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
  if (dbBaseId) basesToTry.push({ label: 'DB', baseId: dbBaseId });
  if (osBaseId && osBaseId !== dbBaseId) basesToTry.push({ label: 'OS', baseId: osBaseId });

  if (basesToTry.length === 0) {
    return {
      record: null,
      matchedBy: null,
      debug: { attempts: [{ base: '-', baseId: '-', tableName: '-', formula: '-', status: 0, ok: false, recordCount: null, error: 'No AIRTABLE_DB_BASE_ID or AIRTABLE_BASE_ID configured' }] },
    };
  }

  const tableName = 'CompanyIntegrations';
  const attempts: LookupAttempt[] = [];

  for (const base of basesToTry) {
    // Build lookup steps for this base
    type Step = { key: string; formula: string };
    const steps: Step[] = [
      { key: `CompanyId (${base.label})`, formula: `{CompanyId} = "${escapeFormulaValue(companyId)}"` },
      { key: `RECORD_ID (${base.label})`, formula: `RECORD_ID() = "${escapeFormulaValue(companyId)}"` },
    ];
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
          throw new Error(
            `Airtable token lacks access to ${base.label} base (baseId=${base.baseId}). ` +
            `Received ${r.status}: ${r.text.slice(0, 200)}`,
          );
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
    googleRefreshToken: (f['Google Refresh Token'] as string) || null,
    googleConnectedEmail: (f['GoogleConnectedEmail'] as string) || null,
    recordId: result.record.id,
    matchedBy: result.matchedBy,
    debug: result.debug,
  };
}

// ============================================================================
// DB-base-aware Google token upsert
// ============================================================================

/**
 * Update (or create) Google OAuth tokens in the AIRTABLE_DB_BASE_ID base.
 *
 * Unlike `updateGoogleTokens()` which routes through the generic Airtable
 * client (AIRTABLE_BASE_ID / OS base), this function writes directly to the
 * DB base via fetch so tokens always land in the canonical location that the
 * scaffold and other flows read from.
 *
 * Flow:
 *   1. findCompanyIntegration() to locate existing row (DB → OS fallback)
 *   2. If no row → POST to create one
 *   3. PATCH the row with token fields + GoogleConnected = true
 *
 * Never logs token values.
 */
export async function updateGoogleTokensInDBBase(
  companyId: string,
  tokens: {
    refreshToken: string;
    accessToken?: string;
    accessTokenExpiresAt?: string;
    connectedEmail?: string;
  },
): Promise<{ recordId: string }> {
  const baseId = process.env.AIRTABLE_DB_BASE_ID;
  if (!baseId) throw new Error('Missing AIRTABLE_DB_BASE_ID');

  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) throw new Error('Missing AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN');

  const tableName = 'CompanyIntegrations';
  const url = airtableListUrl(baseId, tableName);

  // 1. Try to find existing row
  const existing = await findCompanyIntegration({ companyId });
  let recordId: string;

  if (existing.record) {
    recordId = existing.record.id;
    console.log(`[CompanyIntegrations] DB upsert – found existing row ${recordId} (matchedBy=${existing.matchedBy})`);
  } else {
    // 2. Create a new row with CompanyId
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{ fields: { CompanyId: companyId, GoogleConnected: false } }],
      }),
    });
    const createText = await createRes.text();
    if (!createRes.ok) {
      throw new Error(
        `Failed to create CompanyIntegrations row (${createRes.status}): ${createText.slice(0, 300)}`,
      );
    }
    const createData = JSON.parse(createText);
    recordId = createData.records[0].id;
    console.log(`[CompanyIntegrations] DB upsert – created new row ${recordId} for companyId=${companyId}`);
  }

  // 3. PATCH token fields
  const REFRESH_TOKEN_FIELD = 'Google Refresh Token';
  const patchUrl = `${url}/${recordId}`;
  const now = new Date().toISOString();

  const fields: Record<string, unknown> = {
    GoogleConnected: true,
    [REFRESH_TOKEN_FIELD]: tokens.refreshToken,
    GoogleConnectedAt: now,
  };
  if (tokens.accessToken !== undefined) {
    fields.GoogleAccessToken = tokens.accessToken;
  }
  if (tokens.accessTokenExpiresAt !== undefined) {
    fields.GoogleAccessTokenExpiresAt = tokens.accessTokenExpiresAt;
  }
  if (tokens.connectedEmail !== undefined) {
    fields.GoogleConnectedEmail = tokens.connectedEmail;
  }

  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!patchRes.ok) {
    const patchText = await patchRes.text();
    throw new Error(
      `Failed to update CompanyIntegrations tokens (${patchRes.status}): ${patchText.slice(0, 300)}`,
    );
  }

  console.log(
    `[CompanyIntegrations] DB upsert – recordId=${recordId} ` +
    `field="${REFRESH_TOKEN_FIELD}" hasRefreshToken=${tokens.refreshToken.length > 0} ` +
    `companyId=${companyId}`,
  );
  return { recordId };
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
