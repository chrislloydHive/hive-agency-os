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
