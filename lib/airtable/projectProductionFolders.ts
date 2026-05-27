// lib/airtable/projectProductionFolders.ts
// Resolve internal + partner production folder IDs from Client PM Projects.

import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const PROJECTS_TABLE = AIRTABLE_TABLES.PROJECTS;

const INTERNAL_FIELD =
  process.env.INTERNAL_PRODUCTION_FOLDER_FIELD?.trim() || 'Internal Production Folder ID';

const PARTNER_FIELD_ALIASES = [
  process.env.PARTNER_PRODUCTION_FOLDER_FIELD?.trim() || 'Partner Production Folder ID',
  'Creative Review Hub Folder ID',
] as const;

const ACTIVE_STATUS_VALUES = new Set(
  (process.env.PRODUCTION_MIRROR_ACTIVE_STATUSES?.trim() || 'In Progress,Active,Delivering')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export interface ProjectProductionFolders {
  projectId: string;
  projectName: string;
  internalProductionFolderId: string;
  partnerProductionFolderId: string;
}

function readFolderId(fields: Record<string, unknown>, fieldName: string): string | null {
  const v = fields[fieldName];
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function readPartnerFolderId(fields: Record<string, unknown>): string | null {
  for (const alias of PARTNER_FIELD_ALIASES) {
    const id = readFolderId(fields, alias);
    if (id) return id;
  }
  return null;
}

function readProjectName(fields: Record<string, unknown>): string {
  for (const key of [
    'Project Name (Job #)',
    'Project Name (Job #) (Formula)',
    'Project',
    'Name',
  ]) {
    const v = fields[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '(unnamed)';
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): ProjectProductionFolders | null {
  const fields = record.fields;
  const internalProductionFolderId = readFolderId(fields, INTERNAL_FIELD);
  const partnerProductionFolderId = readPartnerFolderId(fields);
  if (!internalProductionFolderId || !partnerProductionFolderId) return null;

  return {
    projectId: record.id,
    projectName: readProjectName(fields),
    internalProductionFolderId,
    partnerProductionFolderId,
  };
}

/** True when PRODUCTION_FOLDER_MIRROR_ENABLED=1 or true. */
export function isProductionFolderMirrorEnabled(): boolean {
  const v = process.env.PRODUCTION_FOLDER_MIRROR_ENABLED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function getProjectProductionFolders(
  projectId: string,
): Promise<ProjectProductionFolders | null> {
  const base = getProjectsBase();
  try {
    const record = await base(PROJECTS_TABLE).find(projectId);
    return mapRecord({ id: record.id, fields: record.fields as Record<string, unknown> });
  } catch {
    return null;
  }
}

/**
 * Projects with both internal + partner production folder IDs.
 * Optionally filters to active-ish Status values.
 */
export async function listProjectsForProductionMirror(options?: {
  activeOnly?: boolean;
}): Promise<ProjectProductionFolders[]> {
  const base = getProjectsBase();
  const activeOnly = options?.activeOnly !== false;
  const out: ProjectProductionFolders[] = [];

  const filterByFormula = `NOT({${INTERNAL_FIELD}} = BLANK())`;

  try {
    const records = await base(PROJECTS_TABLE).select({ filterByFormula }).all();
    for (const record of records) {
      if (activeOnly) {
        const status = (record.fields as Record<string, unknown>)['Status'];
        if (typeof status === 'string' && status.trim() && !ACTIVE_STATUS_VALUES.has(status.trim())) {
          continue;
        }
      }
      const mapped = mapRecord({ id: record.id, fields: record.fields as Record<string, unknown> });
      if (mapped) out.push(mapped);
    }
  } catch (err) {
    console.error('[projectProductionFolders] list failed:', err);
  }

  return out;
}
