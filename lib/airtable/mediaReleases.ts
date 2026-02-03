// lib/airtable/mediaReleases.ts
// Airtable integration for Media Releases table (Client PM OS)
//
// Media Releases track outbound media: assets, partners, channels, and delivery readiness.
// Rollups: # Assets Linked, # Approved Assets. Formula: Delivery Readiness (ready only when
// all linked assets are approved and at least one asset is linked).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';

const TABLE = AIRTABLE_TABLES.MEDIA_RELEASES;

// ============================================================================
// Types (match Airtable field names and options)
// ============================================================================

export type MediaReleaseType =
  | 'Initial'
  | 'Optimization'
  | 'Replacement'
  | 'Test'
  | 'Reporting';

export type MediaReleaseStatus =
  | 'Draft'
  | 'Ready to Send'
  | 'Sent'
  | 'Confirmed Live'
  | 'Archived';

export interface MediaRelease {
  id: string;
  releaseName: string;
  projectId: string | null;
  mediaPartner: string | null;
  channels: string[];
  releaseType: MediaReleaseType | null;
  releaseDate: string | null;
  status: MediaReleaseStatus;
  releaseAssetIds: string[];
  releaseFolderUrl: string | null;
  releaseSheetUrl: string | null;
  instructionsNotes: string | null;
  trafficInstructions: string | null;
  /** Rollup: count of linked Release Assets */
  assetsLinkedCount: number;
  /** Rollup: sum of approved assets (Creative Assets with approval = 1) */
  approvedAssetsCount: number;
  /** Formula: "Ready" when all linked assets approved and at least one linked; else "Blocked" */
  deliveryReadiness: string | null;
}

export interface CreateMediaReleaseInput {
  releaseName: string;
  projectId?: string | null;
  mediaPartner?: string | null;
  channels?: string[];
  releaseType?: MediaReleaseType | null;
  releaseDate?: string | null;
  status?: MediaReleaseStatus;
  releaseAssetIds?: string[];
  releaseFolderUrl?: string | null;
  releaseSheetUrl?: string | null;
  instructionsNotes?: string | null;
  trafficInstructions?: string | null;
}

// ============================================================================
// Airtable field names (single source of truth)
// ============================================================================

const FIELDS = {
  RELEASE_NAME: 'Release Name',
  JOB_PROJECT: 'Job # / Project',
  MEDIA_PARTNER: 'Media Partner',
  CHANNELS: 'Channels',
  RELEASE_TYPE: 'Release Type',
  RELEASE_DATE: 'Release Date',
  STATUS: 'Status',
  RELEASE_ASSETS: 'Release Assets',
  RELEASE_FOLDER_URL: 'Release Folder URL',
  RELEASE_SHEET_URL: 'Release Sheet URL',
  INSTRUCTIONS_NOTES: 'Instructions / Notes',
  TRAFFIC_INSTRUCTIONS: 'Traffic Instructions',
  ASSETS_LINKED_COUNT: '# Assets Linked',
  APPROVED_ASSETS_COUNT: '# Approved Assets',
  DELIVERY_READINESS: 'Delivery Readiness',
} as const;

const RELEASE_TYPES: MediaReleaseType[] = [
  'Initial',
  'Optimization',
  'Replacement',
  'Test',
  'Reporting',
];

const STATUSES: MediaReleaseStatus[] = [
  'Draft',
  'Ready to Send',
  'Sent',
  'Confirmed Live',
  'Archived',
];

function parseReleaseType(raw: unknown): MediaReleaseType | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return RELEASE_TYPES.includes(s as MediaReleaseType) ? (s as MediaReleaseType) : null;
}

function parseStatus(raw: unknown): MediaReleaseStatus {
  if (typeof raw !== 'string') return 'Draft';
  const s = raw.trim();
  return STATUSES.includes(s as MediaReleaseStatus) ? (s as MediaReleaseStatus) : 'Draft';
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function parseOptionalString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return s || null;
}

function parseNumber(raw: unknown): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

// ============================================================================
// Map Airtable <-> app types
// ============================================================================

function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): MediaRelease {
  const f = record.fields;
  return {
    id: record.id,
    releaseName: (f[FIELDS.RELEASE_NAME] as string) ?? '',
    projectId: Array.isArray(f[FIELDS.JOB_PROJECT]) ? (f[FIELDS.JOB_PROJECT] as string[])[0] ?? null : (f[FIELDS.JOB_PROJECT] as string) ?? null,
    mediaPartner: parseOptionalString(f[FIELDS.MEDIA_PARTNER]),
    channels: parseStringArray(f[FIELDS.CHANNELS]),
    releaseType: parseReleaseType(f[FIELDS.RELEASE_TYPE]),
    releaseDate: parseOptionalString(f[FIELDS.RELEASE_DATE]),
    status: parseStatus(f[FIELDS.STATUS]),
    releaseAssetIds: parseStringArray(f[FIELDS.RELEASE_ASSETS]),
    releaseFolderUrl: parseOptionalString(f[FIELDS.RELEASE_FOLDER_URL]),
    releaseSheetUrl: parseOptionalString(f[FIELDS.RELEASE_SHEET_URL]),
    instructionsNotes: parseOptionalString(f[FIELDS.INSTRUCTIONS_NOTES]),
    trafficInstructions: parseOptionalString(f[FIELDS.TRAFFIC_INSTRUCTIONS]),
    assetsLinkedCount: parseNumber(f[FIELDS.ASSETS_LINKED_COUNT]),
    approvedAssetsCount: parseNumber(f[FIELDS.APPROVED_ASSETS_COUNT]),
    deliveryReadiness: parseOptionalString(f[FIELDS.DELIVERY_READINESS]),
  };
}

function mapToAirtableFields(
  input: CreateMediaReleaseInput | Partial<MediaRelease>,
  now?: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ('releaseName' in input && input.releaseName !== undefined)
    fields[FIELDS.RELEASE_NAME] = input.releaseName;
  if ('projectId' in input && input.projectId !== undefined)
    fields[FIELDS.JOB_PROJECT] = input.projectId ? [input.projectId] : [];
  if ('mediaPartner' in input && input.mediaPartner !== undefined)
    fields[FIELDS.MEDIA_PARTNER] = input.mediaPartner ?? null;
  if ('channels' in input && input.channels !== undefined)
    fields[FIELDS.CHANNELS] = input.channels;
  if ('releaseType' in input && input.releaseType !== undefined)
    fields[FIELDS.RELEASE_TYPE] = input.releaseType ?? null;
  if ('releaseDate' in input && input.releaseDate !== undefined)
    fields[FIELDS.RELEASE_DATE] = input.releaseDate ?? null;
  if ('status' in input && input.status !== undefined)
    fields[FIELDS.STATUS] = input.status;
  if ('releaseAssetIds' in input && input.releaseAssetIds !== undefined)
    fields[FIELDS.RELEASE_ASSETS] = input.releaseAssetIds;
  if ('releaseFolderUrl' in input && input.releaseFolderUrl !== undefined)
    fields[FIELDS.RELEASE_FOLDER_URL] = input.releaseFolderUrl ?? null;
  if ('releaseSheetUrl' in input && input.releaseSheetUrl !== undefined)
    fields[FIELDS.RELEASE_SHEET_URL] = input.releaseSheetUrl ?? null;
  if ('instructionsNotes' in input && input.instructionsNotes !== undefined)
    fields[FIELDS.INSTRUCTIONS_NOTES] = input.instructionsNotes ?? null;
  if ('trafficInstructions' in input && input.trafficInstructions !== undefined)
    fields[FIELDS.TRAFFIC_INSTRUCTIONS] = input.trafficInstructions ?? null;
  return fields;
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * List media releases linked to a project.
 */
export async function getMediaReleasesByProject(projectId: string): Promise<MediaRelease[]> {
  try {
    const base = getBase();
    const escaped = String(projectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
    const formula = `FIND("${escaped}", ARRAYJOIN({${FIELDS.JOB_PROJECT}})) > 0`;
    const records = await base(TABLE)
      .select({
        filterByFormula: formula,
        sort: [{ field: FIELDS.RELEASE_DATE, direction: 'desc' }],
      })
      .all();
    return records.map((r) =>
      mapAirtableRecord(r as { id: string; fields: Record<string, unknown> })
    );
  } catch (error) {
    console.error(`[Media Releases] Failed to get releases for project ${projectId}:`, error);
    return [];
  }
}

/**
 * Get a single media release by ID.
 */
export async function getMediaReleaseById(recordId: string): Promise<MediaRelease | null> {
  try {
    const base = getBase();
    const record = await base(TABLE).find(recordId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Media Releases] Failed to get release ${recordId}:`, error);
    return null;
  }
}

/**
 * Create a new media release.
 */
export async function createMediaRelease(
  input: CreateMediaReleaseInput
): Promise<MediaRelease | null> {
  try {
    const base = getBase();
    const fields = mapToAirtableFields({
      ...input,
      status: input.status ?? 'Draft',
    });
    const record = await base(TABLE).create(fields as Record<string, unknown>);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error('[Media Releases] Failed to create release:', error);
    return null;
  }
}

/**
 * Update a media release.
 */
export async function updateMediaRelease(
  recordId: string,
  updates: Partial<Omit<MediaRelease, 'id' | 'assetsLinkedCount' | 'approvedAssetsCount' | 'deliveryReadiness'>>
): Promise<MediaRelease | null> {
  try {
    const base = getBase();
    const fields = mapToAirtableFields(updates);
    if (Object.keys(fields).length === 0) {
      const existing = await getMediaReleaseById(recordId);
      return existing ?? null;
    }
    const record = await base(TABLE).update(recordId, fields as Record<string, unknown>);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Media Releases] Failed to update release ${recordId}:`, error);
    return null;
  }
}

/**
 * Delete a media release.
 */
export async function deleteMediaRelease(recordId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(TABLE).destroy(recordId);
    return true;
  } catch (error) {
    console.error(`[Media Releases] Failed to delete release ${recordId}:`, error);
    return false;
  }
}
