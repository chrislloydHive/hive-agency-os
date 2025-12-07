// lib/os/workspaceSettings.ts
// Workspace settings for OAuth tokens and integrations

import { getAirtableConfig, findRecordByField, updateRecord, createRecord } from '@/lib/airtable/client';

const TABLE_NAME = 'WorkspaceSettings';
const DEFAULT_WORKSPACE_ID = 'hive-os'; // Single workspace for now

// Simple in-memory cache to prevent rate limiting from parallel calls
// Cache expires after 60 seconds
const CACHE_TTL_MS = 60_000;
const workspaceCache = new Map<string, { data: WorkspaceSettings | null; expiresAt: number; promise?: Promise<WorkspaceSettings | null> }>();

export interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  // GA4 Integration
  ga4RefreshToken?: string | null;
  ga4PropertyId?: string | null;
  ga4ConnectedAt?: string | null;
  // Google Search Console Integration
  gscRefreshToken?: string | null;
  gscPropertyUri?: string | null;
  gscConnectedAt?: string | null;
  gscScopes?: string[] | null;
  // Metadata
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AirtableWorkspaceSettingsFields {
  WorkspaceId: string;
  GA4RefreshToken?: string;
  GA4PropertyId?: string;
  GA4ConnectedAt?: string;
  GSCRefreshToken?: string;
  GSCPropertyUri?: string;
  GSCConnectedAt?: string;
  GSCScopes?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

/**
 * Map Airtable record to WorkspaceSettings
 */
function mapAirtableToWorkspaceSettings(record: any): WorkspaceSettings {
  const fields = record.fields as AirtableWorkspaceSettingsFields;
  return {
    id: record.id,
    workspaceId: fields.WorkspaceId || DEFAULT_WORKSPACE_ID,
    ga4RefreshToken: fields.GA4RefreshToken || null,
    ga4PropertyId: fields.GA4PropertyId || null,
    ga4ConnectedAt: fields.GA4ConnectedAt || null,
    gscRefreshToken: fields.GSCRefreshToken || null,
    gscPropertyUri: fields.GSCPropertyUri || null,
    gscConnectedAt: fields.GSCConnectedAt || null,
    gscScopes: fields.GSCScopes ? fields.GSCScopes.split(',').map(s => s.trim()) : null,
    createdAt: fields.CreatedAt || null,
    updatedAt: fields.UpdatedAt || null,
  };
}

/**
 * Internal function to fetch workspace settings from Airtable
 */
async function fetchWorkspaceSettingsFromAirtable(
  workspaceId: string
): Promise<WorkspaceSettings | null> {
  // Try to find existing settings
  console.log('[WorkspaceSettings] Looking for workspace:', workspaceId);
  const record = await findRecordByField(TABLE_NAME, 'WorkspaceId', workspaceId);

  if (record) {
    console.log('[WorkspaceSettings] Found existing record:', record.id);
    return mapAirtableToWorkspaceSettings(record);
  }

  // No record found - create new settings record
  console.log('[WorkspaceSettings] No record found, creating new settings for workspace:', workspaceId);
  const newRecord = await createRecord(TABLE_NAME, {
    WorkspaceId: workspaceId,
    CreatedAt: new Date().toISOString(),
  });

  console.log('[WorkspaceSettings] Created new record:', newRecord?.id);
  return mapAirtableToWorkspaceSettings(newRecord);
}

/**
 * Get workspace settings for the default workspace
 * Returns null if table doesn't exist or there's an error
 * Uses in-memory caching to prevent rate limiting from parallel calls
 */
export async function getWorkspaceSettings(
  workspaceId: string = DEFAULT_WORKSPACE_ID
): Promise<WorkspaceSettings | null> {
  const now = Date.now();
  const cached = workspaceCache.get(workspaceId);

  // Return cached data if still valid
  if (cached && cached.expiresAt > now && cached.data !== undefined) {
    console.log('[WorkspaceSettings] Cache hit for workspace:', workspaceId);
    return cached.data;
  }

  // If there's an in-flight promise, wait for it (deduplication)
  if (cached?.promise) {
    console.log('[WorkspaceSettings] Waiting for in-flight request:', workspaceId);
    return cached.promise;
  }

  // Create a new promise and store it to deduplicate concurrent calls
  const promise = fetchWorkspaceSettingsFromAirtable(workspaceId)
    .then((data) => {
      workspaceCache.set(workspaceId, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return data;
    })
    .catch((error) => {
      // Clear the promise on error so retries can happen
      workspaceCache.delete(workspaceId);
      console.warn('[WorkspaceSettings] Error fetching/creating settings:', error);
      return null;
    });

  workspaceCache.set(workspaceId, { data: null as any, expiresAt: 0, promise });

  return promise;
}

/**
 * Update workspace settings
 */
export async function updateWorkspaceSettings(
  updates: Partial<Omit<WorkspaceSettings, 'id' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = DEFAULT_WORKSPACE_ID
): Promise<WorkspaceSettings> {
  // Get current settings (or create if doesn't exist)
  const current = await getWorkspaceSettings(workspaceId);

  if (!current) {
    throw new Error('Could not get or create workspace settings - WorkspaceSettings table may not exist in Airtable');
  }

  // Build Airtable fields from updates
  const fields: Partial<AirtableWorkspaceSettingsFields> = {
    UpdatedAt: new Date().toISOString(),
  };

  if (updates.ga4RefreshToken !== undefined) {
    fields.GA4RefreshToken = updates.ga4RefreshToken || '';
  }
  if (updates.ga4PropertyId !== undefined) {
    fields.GA4PropertyId = updates.ga4PropertyId || '';
  }
  if (updates.ga4ConnectedAt !== undefined) {
    fields.GA4ConnectedAt = updates.ga4ConnectedAt || '';
  }
  if (updates.gscRefreshToken !== undefined) {
    fields.GSCRefreshToken = updates.gscRefreshToken || '';
  }
  if (updates.gscPropertyUri !== undefined) {
    fields.GSCPropertyUri = updates.gscPropertyUri || '';
  }
  if (updates.gscConnectedAt !== undefined) {
    fields.GSCConnectedAt = updates.gscConnectedAt || '';
  }
  if (updates.gscScopes !== undefined) {
    fields.GSCScopes = updates.gscScopes ? updates.gscScopes.join(',') : '';
  }

  const updatedRecord = await updateRecord(TABLE_NAME, current.id, fields);
  return mapAirtableToWorkspaceSettings(updatedRecord);
}

/**
 * Check if GA4 is connected
 */
export async function isGa4Connected(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  return !!settings?.ga4RefreshToken && !!settings?.ga4PropertyId;
}

/**
 * Check if GSC is connected
 */
export async function isGscConnected(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  return !!settings?.gscRefreshToken && !!settings?.gscPropertyUri;
}

/**
 * Disconnect GA4 integration
 */
export async function disconnectGa4(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<void> {
  await updateWorkspaceSettings({
    ga4RefreshToken: null,
    ga4PropertyId: null,
    ga4ConnectedAt: null,
  }, workspaceId);
}

/**
 * Disconnect GSC integration
 */
export async function disconnectGsc(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<void> {
  await updateWorkspaceSettings({
    gscRefreshToken: null,
    gscPropertyUri: null,
    gscConnectedAt: null,
    gscScopes: null,
  }, workspaceId);
}
