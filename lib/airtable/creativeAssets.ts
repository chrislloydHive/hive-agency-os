// lib/airtable/creativeAssets.ts
// Airtable integration for Creative Assets table (Client PM OS)
//
// Creative Assets are linked from Media Releases (Release Assets). This table has:
// - Approval Status (existing) — used in Media Releases rollups (# Approved Assets)
// - Approved (formula 0/1) — for that rollup
// - Media Releases link (inverse), Delivered?, Delivery Count, Replaces Asset,
//   Channel, Format / Size, Clickthrough URL, Landing Page Override

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_ASSETS;

// ============================================================================
// Types
// ============================================================================

export type ApprovalStatusValue = 'Approved' | 'Pending' | 'Rejected' | string;

export interface CreativeAsset {
  id: string;
  /** Primary / name — exact field name depends on your base */
  name: string;
  /** Existing: single select. Used in Media Releases rollups. */
  approvalStatus: ApprovalStatusValue | null;
  /** Formula: 1 when Approval Status = Approved, 0 otherwise (for rollup SUM). */
  approved: number;
  /** Link to Media Releases (multiple). */
  mediaReleaseIds: string[];
  /** Formula: IF(COUNTA({Media Releases})>0,"Yes","No"). */
  delivered: string | null;
  /** Rollup: count of linked Media Releases. */
  deliveryCount: number;
  /** Link to Creative Assets (single) — asset this replaces. */
  replacesAssetId: string | null;
  /** Single select. */
  channel: string | null;
  /** Text or single select. */
  formatSize: string | null;
  /** URL. */
  clickthroughUrl: string | null;
  /** URL. */
  landingPageOverride: string | null;
}

export interface CreateCreativeAssetInput {
  name: string;
  approvalStatus?: ApprovalStatusValue | null;
  mediaReleaseIds?: string[];
  replacesAssetId?: string | null;
  channel?: string | null;
  formatSize?: string | null;
  clickthroughUrl?: string | null;
  landingPageOverride?: string | null;
}

// ============================================================================
// Airtable field names
// ============================================================================

export const CREATIVE_ASSET_FIELDS = {
  /** Primary field name — adjust if your base uses a different label */
  NAME: 'Name',
  APPROVAL_STATUS: 'Approval Status',
  APPROVED: 'Approved',
  MEDIA_RELEASES: 'Media Releases',
  DELIVERED: 'Delivered?',
  DELIVERY_COUNT: 'Delivery Count',
  REPLACES_ASSET: 'Replaces Asset',
  CHANNEL: 'Channel',
  FORMAT_SIZE: 'Format / Size',
  CLICKTHROUGH_URL: 'Clickthrough URL',
  LANDING_PAGE_OVERRIDE: 'Landing Page Override',
} as const;

const F = CREATIVE_ASSET_FIELDS;

function parseOptionalString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return s || null;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
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
// Map Airtable -> app
// ============================================================================

function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): CreativeAsset {
  const f = record.fields;
  return {
    id: record.id,
    name: (f[F.NAME] as string) ?? '',
    approvalStatus: parseOptionalString(f[F.APPROVAL_STATUS]),
    approved: parseNumber(f[F.APPROVED]),
    mediaReleaseIds: parseStringArray(f[F.MEDIA_RELEASES]),
    delivered: parseOptionalString(f[F.DELIVERED]),
    deliveryCount: parseNumber(f[F.DELIVERY_COUNT]),
    replacesAssetId: Array.isArray(f[F.REPLACES_ASSET]) ? (f[F.REPLACES_ASSET] as string[])[0] ?? null : parseOptionalString(f[F.REPLACES_ASSET]),
    channel: parseOptionalString(f[F.CHANNEL]),
    formatSize: parseOptionalString(f[F.FORMAT_SIZE]),
    clickthroughUrl: parseOptionalString(f[F.CLICKTHROUGH_URL]),
    landingPageOverride: parseOptionalString(f[F.LANDING_PAGE_OVERRIDE]),
  };
}

function mapToAirtableFields(input: CreateCreativeAssetInput | Partial<CreativeAsset>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ('name' in input && input.name !== undefined) fields[F.NAME] = input.name;
  if ('approvalStatus' in input && input.approvalStatus !== undefined) fields[F.APPROVAL_STATUS] = input.approvalStatus ?? null;
  if ('mediaReleaseIds' in input && input.mediaReleaseIds !== undefined) fields[F.MEDIA_RELEASES] = input.mediaReleaseIds;
  if ('replacesAssetId' in input && input.replacesAssetId !== undefined) fields[F.REPLACES_ASSET] = input.replacesAssetId ? [input.replacesAssetId] : [];
  if ('channel' in input && input.channel !== undefined) fields[F.CHANNEL] = input.channel ?? null;
  if ('formatSize' in input && input.formatSize !== undefined) fields[F.FORMAT_SIZE] = input.formatSize ?? null;
  if ('clickthroughUrl' in input && input.clickthroughUrl !== undefined) fields[F.CLICKTHROUGH_URL] = input.clickthroughUrl ?? null;
  if ('landingPageOverride' in input && input.landingPageOverride !== undefined) fields[F.LANDING_PAGE_OVERRIDE] = input.landingPageOverride ?? null;
  return fields;
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * Get a single creative asset by ID.
 */
export async function getCreativeAssetById(recordId: string): Promise<CreativeAsset | null> {
  try {
    const base = getBase();
    const record = await base(TABLE).find(recordId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Creative Assets] Failed to get asset ${recordId}:`, error);
    return null;
  }
}

/**
 * Create a new creative asset.
 */
export async function createCreativeAsset(input: CreateCreativeAssetInput): Promise<CreativeAsset | null> {
  try {
    const base = getBase();
    const fields = mapToAirtableFields(input);
    const record = await base(TABLE).create(fields as Record<string, unknown>);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error('[Creative Assets] Failed to create asset:', error);
    return null;
  }
}

/**
 * Update a creative asset (writable fields only; formula/rollup fields are read-only).
 */
export async function updateCreativeAsset(
  recordId: string,
  updates: Partial<Omit<CreativeAsset, 'id' | 'approved' | 'delivered' | 'deliveryCount'>>
): Promise<CreativeAsset | null> {
  try {
    const base = getBase();
    const fields = mapToAirtableFields(updates);
    if (Object.keys(fields).length === 0) {
      return getCreativeAssetById(recordId);
    }
    const record = await base(TABLE).update(recordId, fields as Record<string, unknown>);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Creative Assets] Failed to update asset ${recordId}:`, error);
    return null;
  }
}
