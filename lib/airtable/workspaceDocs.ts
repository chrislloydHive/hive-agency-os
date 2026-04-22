/**
 * WorkspaceDocs — Airtable helper for the pinned working-documents launcher.
 *
 * Replaces the "Master Link Tracker" spreadsheet with a first-class table
 * surfaced in My Day's Workspace section. Click a row → opens the URL in a
 * new tab + bumps LastReviewed so the list re-sorts by actual usage.
 *
 * Same base as Tasks — set AIRTABLE_WORKSPACE_DOCS_TABLE_ID (or _TABLE for a
 * named lookup) if you move the table. Defaults to "WorkspaceDocs".
 */

import { fetchWithRetry } from './client';
import { resolveTasksBaseId } from './bases';

// ============================================================================
// Constants
// ============================================================================

function workspaceTableIdentifier(): string {
  return (
    process.env.AIRTABLE_WORKSPACE_DOCS_TABLE_ID?.trim() ||
    process.env.AIRTABLE_WORKSPACE_DOCS_TABLE?.trim() ||
    'WorkspaceDocs'
  );
}

function workspaceBaseIdOrThrow(): string {
  // Reuse the tasks base resolver — WorkspaceDocs lives in the same Hive OS
  // Airtable base as Tasks by default. Override via AIRTABLE_WORKSPACE_DOCS_BASE_ID
  // if you ever split them apart.
  const id = process.env.AIRTABLE_WORKSPACE_DOCS_BASE_ID?.trim() || resolveTasksBaseId();
  if (!id) {
    throw new Error(
      'Airtable base not configured for WorkspaceDocs. Set AIRTABLE_OS_BASE_ID or AIRTABLE_WORKSPACE_DOCS_BASE_ID.',
    );
  }
  return id;
}

const WS_FIELDS = {
  NAME: 'Name',
  URL: 'URL',
  DESCRIPTION: 'Description',
  CATEGORY: 'Category',
  FREQUENCY: 'Frequency',
  LAST_REVIEWED: 'LastReviewed',
  PINNED: 'Pinned',
  ARCHIVED_AT: 'ArchivedAt',
  AUTO_DISCOVERED: 'AutoDiscovered',
  CREATED_AT: 'CreatedAt',
  UPDATED_AT: 'UpdatedAt',
} as const;

// ============================================================================
// Types
// ============================================================================

export type WorkspaceCategory = 'Doc' | 'Sheet' | 'Slides' | 'Folder' | 'Web Page' | 'Other';
export type WorkspaceFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Occasional';

export interface WorkspaceDoc {
  id: string;
  name: string;
  url: string;
  description: string;
  category: WorkspaceCategory | null;
  frequency: WorkspaceFrequency | null;
  lastReviewed: string | null;
  pinned: boolean;
  archivedAt: string | null;
  autoDiscovered: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateWorkspaceDocInput {
  name: string;
  url: string;
  description?: string;
  category?: WorkspaceCategory;
  frequency?: WorkspaceFrequency;
  lastReviewed?: string;
  pinned?: boolean;
  autoDiscovered?: boolean;
}

export interface UpdateWorkspaceDocInput {
  name?: string;
  url?: string;
  description?: string;
  category?: WorkspaceCategory | null;
  frequency?: WorkspaceFrequency | null;
  lastReviewed?: string | null;
  pinned?: boolean;
  archivedAt?: string | null;
  autoDiscovered?: boolean;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRecordToWorkspaceDoc(record: { id: string; fields?: Record<string, unknown> }): WorkspaceDoc {
  const f = record.fields || {};
  return {
    id: record.id,
    name: (f[WS_FIELDS.NAME] as string) || '',
    url: (f[WS_FIELDS.URL] as string) || '',
    description: (f[WS_FIELDS.DESCRIPTION] as string) || '',
    category: (f[WS_FIELDS.CATEGORY] as WorkspaceCategory) || null,
    frequency: (f[WS_FIELDS.FREQUENCY] as WorkspaceFrequency) || null,
    lastReviewed: (f[WS_FIELDS.LAST_REVIEWED] as string) || null,
    pinned: Boolean(f[WS_FIELDS.PINNED]),
    archivedAt: (f[WS_FIELDS.ARCHIVED_AT] as string) || null,
    autoDiscovered: Boolean(f[WS_FIELDS.AUTO_DISCOVERED]),
    createdAt: (f[WS_FIELDS.CREATED_AT] as string) || null,
    updatedAt: (f[WS_FIELDS.UPDATED_AT] as string) || null,
  };
}

function mapInputToFields(
  input: CreateWorkspaceDocInput | UpdateWorkspaceDocInput,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ('name' in input && input.name !== undefined) fields[WS_FIELDS.NAME] = input.name;
  if ('url' in input && input.url !== undefined) fields[WS_FIELDS.URL] = input.url;
  if ('description' in input && input.description !== undefined) fields[WS_FIELDS.DESCRIPTION] = input.description;
  if ('category' in input) fields[WS_FIELDS.CATEGORY] = input.category || null;
  if ('frequency' in input) fields[WS_FIELDS.FREQUENCY] = input.frequency || null;
  if ('lastReviewed' in input) fields[WS_FIELDS.LAST_REVIEWED] = input.lastReviewed || null;
  if ('pinned' in input && input.pinned !== undefined) fields[WS_FIELDS.PINNED] = input.pinned;
  if ('archivedAt' in input) fields[WS_FIELDS.ARCHIVED_AT] = input.archivedAt || null;
  if ('autoDiscovered' in input && input.autoDiscovered !== undefined) fields[WS_FIELDS.AUTO_DISCOVERED] = input.autoDiscovered;
  return fields;
}

/**
 * Find a workspace doc by its URL. Used by the auto-discovery sync to dedup
 * before creating. Set `includeArchived: true` to match previously archived
 * rows (so we can skip/un-archive rather than creating duplicates).
 */
export async function findWorkspaceDocByUrl(
  url: string,
  options: { includeArchived?: boolean } = {},
): Promise<WorkspaceDoc | null> {
  if (!url) return null;
  const baseId = workspaceBaseIdOrThrow();
  const tableId = workspaceTableIdentifier();
  const safeUrl = url.replace(/'/g, "\\'");
  const filter = `{${WS_FIELDS.URL}} = '${safeUrl}'`;
  const params = new URLSearchParams();
  params.set('filterByFormula', filter);
  params.set('maxRecords', '1');
  const fetchUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
  const response = await fetchWithRetry(fetchUrl, { method: 'GET' });
  if (!response.ok) {
    if (response.status === 422) return null;
    throw new Error(`Airtable lookup by URL failed (${response.status})`);
  }
  const data = await response.json();
  const record = (data.records || [])[0];
  if (!record) return null;
  const doc = mapRecordToWorkspaceDoc(record);
  if (!options.includeArchived && doc.archivedAt) return null;
  return doc;
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * List workspace docs. By default excludes archived items (ArchivedAt set).
 * Sorted client-side by LastReviewed desc (newest first) with a fallback to
 * CreatedAt for items that have never been reviewed yet.
 */
export async function getWorkspaceDocs(options?: {
  includeArchived?: boolean;
  includeUnpinned?: boolean;
}): Promise<WorkspaceDoc[]> {
  const baseId = workspaceBaseIdOrThrow();
  const tableId = workspaceTableIdentifier();

  const records = await fetchAllRecords(baseId, tableId);
  let docs = records.map(mapRecordToWorkspaceDoc);

  if (!options?.includeArchived) {
    docs = docs.filter((d) => !d.archivedAt);
  }
  if (!options?.includeUnpinned) {
    docs = docs.filter((d) => d.pinned);
  }

  // Sort by LastReviewed desc (newest first). Fall back to CreatedAt.
  docs.sort((a, b) => {
    const aTs = Date.parse(a.lastReviewed || a.createdAt || '') || 0;
    const bTs = Date.parse(b.lastReviewed || b.createdAt || '') || 0;
    return bTs - aTs;
  });

  return docs;
}

async function fetchAllRecords(
  baseId: string,
  tableId: string,
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const all: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (offset) params.set('offset', offset);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
    const response = await fetchWithRetry(url, { method: 'GET' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Airtable fetch failed for WorkspaceDocs (${response.status}): ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

export async function createWorkspaceDoc(input: CreateWorkspaceDocInput): Promise<WorkspaceDoc> {
  const baseId = workspaceBaseIdOrThrow();
  const tableId = workspaceTableIdentifier();
  const fields = mapInputToFields({
    pinned: true, // default: new docs are pinned
    ...input,
  });

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable create failed for WorkspaceDocs (${response.status}): ${text.slice(0, 200)}`);
  }
  return mapRecordToWorkspaceDoc(await response.json());
}

export async function updateWorkspaceDoc(
  recordId: string,
  input: UpdateWorkspaceDocInput,
): Promise<WorkspaceDoc> {
  const baseId = workspaceBaseIdOrThrow();
  const tableId = workspaceTableIdentifier();
  const fields = mapInputToFields(input);

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable update failed for WorkspaceDocs (${response.status}): ${text.slice(0, 200)}`);
  }
  return mapRecordToWorkspaceDoc(await response.json());
}

/** Soft-archive (sets ArchivedAt to now). Keeps the record for history. */
export async function archiveWorkspaceDoc(recordId: string): Promise<WorkspaceDoc> {
  return updateWorkspaceDoc(recordId, { archivedAt: new Date().toISOString() });
}

/** Un-archive + re-pin. */
export async function restoreWorkspaceDoc(recordId: string): Promise<WorkspaceDoc> {
  return updateWorkspaceDoc(recordId, { archivedAt: null, pinned: true });
}

/** Bump LastReviewed to now — called when the user clicks a row to open it. */
export async function touchWorkspaceDoc(recordId: string): Promise<WorkspaceDoc> {
  return updateWorkspaceDoc(recordId, { lastReviewed: new Date().toISOString() });
}
