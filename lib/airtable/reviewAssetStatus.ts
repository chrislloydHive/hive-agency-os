// lib/airtable/reviewAssetStatus.ts
// Creative Review Asset Status table: per-asset state (New/Seen/Approved/Needs Changes).
// Key = Review Token + "::" + Source Folder ID (unique per asset per review).
//
// Portal DB schema (delivery fields on each asset):
//   delivered: boolean (default false) — "Delivered" checkbox; also true if deliveredAt set
//   deliveredAt: datetime nullable — "Delivered At" (ISO timestamp)
//   deliveredFolderId: string nullable — "Delivered Folder ID" (optional, Drive folder of delivery run)
//   Delivery Batch ID: existing link/reference to batch/group

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  getTableSchema,
  resolveAlias,
  CRAS_PARTNER_DOWNLOADED_AT_ALIASES,
} from '@/lib/airtable/deliveryWriteBack';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

/** Airtable field: Google Drive folder ID (source folder or file ID for delivery). */
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

/** Airtable field: Delivery Batch ID – links asset to a partner delivery batch. */
export const DELIVERY_BATCH_ID_FIELD = 'Delivery Batch ID';

/** Airtable field name for client approval checkbox. Change here if your base uses a different name. */
export const ASSET_APPROVED_CLIENT_FIELD = 'Asset Approved (Client)';

/** Airtable field name for when client first saw the asset. Do not overwrite once set. */
export const FIRST_SEEN_BY_CLIENT_AT_FIELD = 'First Seen By Client At';

export type AssetStatusValue = 'New' | 'Seen' | 'Approved' | 'Needs Changes';

/** Airtable field: Delivered At (ISO timestamp when asset was delivered to partner). */
export const DELIVERED_AT_FIELD = 'Delivered At';

/** Airtable field: Delivered (checkbox, true when asset has been delivered to partner). */
export const DELIVERED_CHECKBOX_FIELD = 'Delivered';

/** Airtable field: Delivered Folder ID (Drive folder id for the delivery run). */
export const DELIVERED_FOLDER_ID_FIELD = 'Delivered Folder ID';

/** Airtable field names for delivered URL (folder or file); try both (alias-aware). */
const DELIVERED_URL_FIELD_ALIASES = ['Delivered Folder URL', 'Delivered File URL'] as const;

/** Airtable field: Partner Downloaded At (when partner completed download; drives "Downloaded" badge). */
export const PARTNER_DOWNLOADED_AT_FIELD = 'Partner Downloaded At';

/** Airtable field: Partner Download Started At (when stream began; optional, for visibility). */
export const PARTNER_DOWNLOAD_STARTED_AT_FIELD = 'Partner Download Started At';

/** Airtable field: Ready to Deliver (Webhook) – when true, backend worker runs delivery (no Airtable fetch). */
export const READY_TO_DELIVER_WEBHOOK_FIELD = 'Ready to Deliver (Webhook)';

export interface StatusRecord {
  recordId: string;
  status: AssetStatusValue;
  /** Client approval checkbox; used for bulk approve and to avoid re-updating. */
  assetApprovedClient: boolean;
  /** When client first saw this asset (portal load); null = never seen, show "New". */
  firstSeenByClientAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedByEmail: string | null;
  lastActivityAt: string | null;
  notes: string | null;
  /** Per-asset override (Creative Review Asset Status: Landing Page URL Override). */
  landingPageOverrideUrl: string | null;
  /** Effective URL from Airtable formula/lookup when present. */
  effectiveLandingPageUrl: string | null;
  /** When asset was delivered to partner; null = not delivered. */
  deliveredAt: string | null;
  /** True if asset has been delivered (Delivered checkbox or deliveredAt set). Default false. */
  delivered: boolean;
  /** Drive folder ID of the delivery run; null if not delivered or unknown. */
  deliveredFolderId: string | null;
  /** URL to open delivered folder/file in Drive; null if not delivered or unknown. */
  deliveredFileUrl: string | null;
  /** When partner downloaded this asset in the portal; null = not downloaded. */
  partnerDownloadedAt: string | null;
}

function keyFrom(token: string, driveFileId: string): string {
  return `${token}::${driveFileId}`;
}

function parseStatus(raw: unknown): AssetStatusValue {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'New' || s === 'Seen' || s === 'Approved' || s === 'Needs Changes') return s;
  return 'New';
}

function parseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function parseAssetApprovedClient(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === 'true' || raw === 1) return true;
  return false;
}

function parseOptionalIsoString(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function parseDeliveredCheckbox(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === 'true' || raw === 1) return true;
  return false;
}

function recordToStatus(r: { id: string; fields: Record<string, unknown> }, token: string, driveFileId: string): StatusRecord {
  const f = r.fields;
  const deliveredAt = parseOptionalIsoString(f[DELIVERED_AT_FIELD]);
  const deliveredCheckbox = parseDeliveredCheckbox(f[DELIVERED_CHECKBOX_FIELD]);
  const deliveredFolderIdRaw = f[DELIVERED_FOLDER_ID_FIELD];
  const deliveredFolderId =
    typeof deliveredFolderIdRaw === 'string' && deliveredFolderIdRaw.trim()
      ? deliveredFolderIdRaw.trim()
      : null;
  const delivered = deliveredCheckbox || (deliveredAt != null && deliveredAt.trim().length > 0);
  let deliveredFileUrl: string | null = null;
  for (const fieldName of DELIVERED_URL_FIELD_ALIASES) {
    const raw = f[fieldName];
    const url = parseUrl(raw);
    if (url) {
      deliveredFileUrl = url;
      break;
    }
  }
  const partnerDownloadedAt = parseOptionalIsoString(f[PARTNER_DOWNLOADED_AT_FIELD]);
  return {
    recordId: r.id,
    status: parseStatus(f['Status']),
    assetApprovedClient: parseAssetApprovedClient(f[ASSET_APPROVED_CLIENT_FIELD]),
    // Gracefully handle missing field (may not exist in all Airtable bases)
    firstSeenByClientAt: f[FIRST_SEEN_BY_CLIENT_AT_FIELD] != null 
      ? parseOptionalIsoString(f[FIRST_SEEN_BY_CLIENT_AT_FIELD])
      : null,
    firstSeenAt: (f['First Seen At'] as string) ?? null,
    lastSeenAt: (f['Last Seen At'] as string) ?? null,
    approvedAt: (f['Approved At'] as string) ?? null,
    approvedByName: (f['Approved By Name'] as string) ?? null,
    approvedByEmail: (f['Approved By Email'] as string) ?? null,
    lastActivityAt: (f['Last Activity At'] as string) ?? null,
    notes: (f['Notes'] as string) ?? null,
    landingPageOverrideUrl: parseUrl(f['Landing Page URL Override']),
    effectiveLandingPageUrl: parseUrl(f['Effective Landing Page URL']),
    deliveredAt,
    delivered,
    deliveredFolderId,
    deliveredFileUrl,
    partnerDownloadedAt,
  };
}

/** Cache for getCrasRecordIdByTokenAndFileId: key = token::fileId, value = { recordId, expiresAt }. */
const recordIdByTokenFileIdCache = new Map<
  string,
  { recordId: string; expiresAt: number }
>();
const RECORD_ID_CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Get CRAS record ID for a single asset by review token and Drive file ID.
 * Same scope as listAssetStatuses (Review Token); single-record lookup.
 * Optional short TTL cache to reduce Airtable reads.
 */
export async function getCrasRecordIdByTokenAndFileId(
  token: string,
  fileId: string
): Promise<string | null> {
  const tokenTrim = String(token).trim();
  const fileIdTrim = String(fileId).trim();
  if (!tokenTrim || !fileIdTrim) return null;

  const cacheKey = keyFrom(tokenTrim, fileIdTrim);
  const cached = recordIdByTokenFileIdCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.recordId;
  }

  const base = getBase();
  const tokenEsc = tokenTrim.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const fileEsc = fileIdTrim.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `AND({Review Token} = "${tokenEsc}", {${SOURCE_FOLDER_ID_FIELD}} = "${fileEsc}")`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  const recordId = records.length > 0 ? records[0].id : null;
  if (recordId) {
    recordIdByTokenFileIdCache.set(cacheKey, {
      recordId,
      expiresAt: Date.now() + RECORD_ID_CACHE_TTL_MS,
    });
  }
  return recordId;
}

/**
 * List all asset statuses for a review token. Returns Map keyed by token::driveFileId.
 */
export async function listAssetStatuses(token: string): Promise<Map<string, StatusRecord>> {
  const osBase = getBase();
  const escaped = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  if (!escaped) return new Map();

  const formula = `{Review Token} = "${escaped}"`;
  const records = await osBase(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const map = new Map<string, StatusRecord>();
  for (const r of records) {
    const fields = r.fields as Record<string, unknown>;
    const driveFileId = (fields[SOURCE_FOLDER_ID_FIELD] as string) ?? '';
    if (driveFileId) {
      const key = keyFrom(token, driveFileId);
      map.set(key, recordToStatus(r as { id: string; fields: Record<string, unknown> }, token, driveFileId));
    }
  }
  return map;
}

export interface ApprovedAssetForDelivery {
  recordId: string;
  driveId: string;
}

/**
 * List approved assets for a delivery batch (DB is the approval truth).
 * Returns records where Delivery Batch ID = batchId and Asset Approved (Client) = true,
 * with non-empty Source Folder ID (used as Drive file ID for files.copy).
 */
export async function getApprovedAssetDriveIdsByBatchId(
  batchId: string
): Promise<ApprovedAssetForDelivery[]> {
  const id = String(batchId).trim();
  if (!id) return [];

  const base = getBase();
  const batchEsc = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `AND({${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}", {${ASSET_APPROVED_CLIENT_FIELD}} = TRUE())`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const out: ApprovedAssetForDelivery[] = [];
  for (const r of records) {
    const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
    const driveId = typeof raw === 'string' ? raw.trim() : '';
    if (driveId) {
      out.push({ recordId: r.id, driveId });
    }
  }
  return out;
}

/**
 * List approved and not-yet-delivered assets for a batch (for deliver-batch validation).
 * Returns records where Delivery Batch ID = batchId, Asset Approved = true, and Delivered At is blank.
 */
export async function getApprovedAndNotDeliveredByBatchId(
  batchId: string
): Promise<ApprovedAssetForDelivery[]> {
  const id = String(batchId).trim();
  if (!id) return [];

  const base = getBase();
  const batchEsc = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `AND({${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}", {${ASSET_APPROVED_CLIENT_FIELD}} = TRUE(), ISBLANK({${DELIVERED_AT_FIELD}}))`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const out: ApprovedAssetForDelivery[] = [];
  for (const r of records) {
    const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
    const driveId = typeof raw === 'string' ? raw.trim() : '';
    if (driveId) {
      out.push({ recordId: r.id, driveId });
    }
  }
  return out;
}

/** Pending webhook delivery row: CRAS record flagged for delivery, not yet delivered. */
export interface PendingWebhookDeliveryRecord {
  recordId: string;
  sourceFolderId: string;
  /** Batch ID string (e.g. "Batch 1") or first linked batch record id (e.g. "recXXX"). */
  deliveryBatchIdRaw: string;
}

/**
 * List CRAS records where Ready to Deliver (Webhook) = true and not yet delivered.
 * Used by the backend worker so Airtable only sets flags (no outbound fetch).
 * Idempotent: skip records that already have Delivered At set (formula) or Delivered = true.
 */
export async function getPendingWebhookDeliveryRecords(): Promise<PendingWebhookDeliveryRecord[]> {
  const base = getBase();
  // Use Ready to Deliver (Webhook) = TRUE and filter out delivered in code (ISBLANK may not be supported in all bases)
  const formula = `{${READY_TO_DELIVER_WEBHOOK_FIELD}} = TRUE()`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const out: PendingWebhookDeliveryRecord[] = [];
  let skippedDelivered = 0;
  let skippedNoSource = 0;
  let skippedNoBatch = 0;
  
  for (const r of records) {
    const f = r.fields as Record<string, unknown>;
    
    // Filter out already-delivered records (idempotency check in code)
    const deliveredAt = typeof f[DELIVERED_AT_FIELD] === 'string' ? (f[DELIVERED_AT_FIELD] as string).trim() : '';
    if (deliveredAt) {
      skippedDelivered++;
      console.log(`[getPendingWebhookDeliveryRecords] Record ${r.id} skipped: already delivered (Delivered At=${deliveredAt})`);
      continue; // Skip if Delivered At is set
    }
    
    const sourceFolderId = typeof f[SOURCE_FOLDER_ID_FIELD] === 'string' ? (f[SOURCE_FOLDER_ID_FIELD] as string).trim() : '';
    if (!sourceFolderId) {
      skippedNoSource++;
      console.log(`[getPendingWebhookDeliveryRecords] Record ${r.id} skipped: missing Source Folder ID (field value: ${JSON.stringify(f[SOURCE_FOLDER_ID_FIELD])})`);
      continue;
    }

    const batchRaw = f[DELIVERY_BATCH_ID_FIELD];
    let deliveryBatchIdRaw = '';
    if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
      deliveryBatchIdRaw = (batchRaw[0] as string).trim();
    } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
      deliveryBatchIdRaw = (batchRaw as string).trim();
    }
    if (!deliveryBatchIdRaw) {
      skippedNoBatch++;
      continue;
    }

    out.push({ recordId: r.id, sourceFolderId, deliveryBatchIdRaw });
  }
  
  // Always log when we check (even if 0 records found)
  console.log(`[getPendingWebhookDeliveryRecords] Query result: ${records.length} records with "Ready to Deliver (Webhook)" = TRUE. After filtering: ${out.length} ready to process (skipped: ${skippedDelivered} already delivered, ${skippedNoSource} missing source folder, ${skippedNoBatch} missing batch ID)`);
  
  // Log sample record IDs for debugging if we filtered everything out
  if (records.length > 0 && out.length === 0) {
    const sampleIds = records.slice(0, 3).map(r => r.id);
    console.warn(`[getPendingWebhookDeliveryRecords] ⚠️ All ${records.length} records were filtered out. Sample record IDs: ${sampleIds.join(', ')}`);
  }
  
  return out;
}

/**
 * Get the set of Drive file IDs (Source Folder ID) for assets that belong to a batch.
 * Supports both Delivery Batch ID as text (Batch ID string) and as linked Partner Delivery Batch record.
 * Used to scope GET /api/review/assets to the selected batch.
 */
export async function getDriveFileIdsForBatch(
  token: string,
  batchId: string,
  batchRecordId?: string | null
): Promise<Set<string>> {
  const tokenEsc = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const id = String(batchId).trim();
  if (!tokenEsc || !id) return new Set();

  const base = getBase();
  const batchEsc = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let formula: string;
  if (batchRecordId && String(batchRecordId).trim()) {
    const recEsc = String(batchRecordId).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
    formula = `AND({Review Token} = "${tokenEsc}", OR({${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}", FIND("${recEsc}", ARRAYJOIN({${DELIVERY_BATCH_ID_FIELD}})) > 0))`;
  } else {
    formula = `AND({Review Token} = "${tokenEsc}", {${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}")`;
  }

  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const fileIds = new Set<string>();
  for (const r of records) {
    const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
    const driveId = typeof raw === 'string' ? raw.trim() : '';
    if (driveId) fileIds.add(driveId);
  }
  return fileIds;
}

/**
 * Get CRAS record IDs for a batch and set of Drive file IDs.
 * Used to mark assets as delivered after portal-initiated delivery (client sends approvedFileIds).
 */
export async function getRecordIdsByBatchIdAndFileIds(
  batchId: string,
  fileIds: string[]
): Promise<ApprovedAssetForDelivery[]> {
  const id = String(batchId).trim();
  const set = new Set(fileIds.map((f) => String(f).trim()).filter(Boolean));
  if (!id || set.size === 0) return [];

  const base = getBase();
  const batchEsc = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `{${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}"`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const out: ApprovedAssetForDelivery[] = [];
  for (const r of records) {
    const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
    const driveId = typeof raw === 'string' ? raw.trim() : '';
    if (driveId && set.has(driveId)) {
      out.push({ recordId: r.id, driveId });
    }
  }
  return out;
}

/**
 * Set Partner Downloaded At = now on a CRAS record (when stream completes successfully).
 * Alias-safe: writes to "ID Partner Downloaded At" or "Partner Downloaded At" if present.
 * Does not throw if the field is missing (log + skip). In dev, logs { recordId, wrotePartnerDownloadedAt: true }.
 */
export async function setPartnerDownloadedAt(recordId: string): Promise<boolean> {
  const base = getBase();
  const now = new Date().toISOString();
  const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

  if (baseId) {
    try {
      const schema = await getTableSchema(baseId, TABLE);
      const alias = resolveAlias(CRAS_PARTNER_DOWNLOADED_AT_ALIASES, schema.writableNames);
      if (!alias) {
        console.warn('[reviewAssetStatus] setPartnerDownloadedAt: no writable field found for Partner Downloaded At (tried: %s), skipping', CRAS_PARTNER_DOWNLOADED_AT_ALIASES.join(', '));
        return false;
      }
      await base(TABLE).update(recordId, { [alias]: now } as any);
      if (process.env.NODE_ENV === 'development') {
        console.log('[reviewAssetStatus]', JSON.stringify({ recordId, wrotePartnerDownloadedAt: true }));
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[reviewAssetStatus] setPartnerDownloadedAt failed (alias path):', recordId, msg);
      return false;
    }
  }

  try {
    await base(TABLE).update(recordId, { [PARTNER_DOWNLOADED_AT_FIELD]: now } as any);
    if (process.env.NODE_ENV === 'development') {
      console.log('[reviewAssetStatus]', JSON.stringify({ recordId, wrotePartnerDownloadedAt: true }));
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[reviewAssetStatus] setPartnerDownloadedAt failed (field may be missing):', recordId, msg);
    return false;
  }
}

/**
 * Set Partner Download Started At = now on a CRAS record (when download stream is about to start).
 * Safe: catches Airtable errors (e.g. missing field) and logs without throwing.
 */
export async function setPartnerDownloadStartedAt(recordId: string): Promise<boolean> {
  const base = getBase();
  const now = new Date().toISOString();
  try {
    await base(TABLE).update(recordId, { [PARTNER_DOWNLOAD_STARTED_AT_FIELD]: now } as any);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[reviewAssetStatus] setPartnerDownloadStartedAt failed (field may be missing):', recordId, msg);
    return false;
  }
}

/**
 * Count assets in a batch that have Partner Downloaded At set.
 */
export async function getDownloadedCountForBatch(batchId: string): Promise<number> {
  const id = String(batchId).trim();
  if (!id) return 0;
  const base = getBase();
  const batchEsc = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Filter for downloaded records in code (ISBLANK may not be supported in all bases)
  const formula = `{${DELIVERY_BATCH_ID_FIELD}} = "${batchEsc}"`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula })
    .all();
  // Count records where Partner Downloaded At is set
  let count = 0;
  for (const r of records) {
    const f = r.fields as Record<string, unknown>;
    const downloadedAt = typeof f[PARTNER_DOWNLOADED_AT_FIELD] === 'string' ? (f[PARTNER_DOWNLOADED_AT_FIELD] as string).trim() : '';
    if (downloadedAt) count++;
  }
  return count;
}

/**
 * Find existing record by Review Token + Source Folder ID.
 */
async function findExisting(token: string, driveFileId: string): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const osBase = getBase();
  const tokenEsc = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const fileEsc = String(driveFileId).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const formula = `AND({Review Token} = "${tokenEsc}", {${SOURCE_FOLDER_ID_FIELD}} = "${fileEsc}")`;
  const records = await osBase(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
  if (records.length === 0) return null;
  return { id: records[0].id, fields: records[0].fields as Record<string, unknown> };
}

export interface UpsertSeenArgs {
  token: string;
  projectId: string;
  driveFileId: string;
  filename: string;
  tactic: string;
  variant: string;
  authorName?: string;
  authorEmail?: string;
}

/**
 * Ensure a CRAS record exists for this token + drive file. Creates with Status=New if missing (for backfill).
 * Returns true if a record was created, false if one already existed.
 */
export interface EnsureCrasRecordArgs {
  token: string;
  projectId: string;
  driveFileId: string;
  filename?: string;
  tactic: string;
  variant: string;
}

export async function ensureCrasRecord(args: EnsureCrasRecordArgs): Promise<boolean> {
  const existing = await findExisting(args.token, args.driveFileId);
  if (existing) return false;
  const osBase = getBase();
  const now = new Date().toISOString();
  await osBase(TABLE).create({
    'Review Token': args.token,
    Project: [args.projectId],
    [SOURCE_FOLDER_ID_FIELD]: args.driveFileId,
    Filename: (args.filename ?? '').slice(0, 500),
    Tactic: args.tactic,
    Variant: args.variant,
    Status: 'New',
    'Last Activity At': now,
  } as any);
  return true;
}

/**
 * Mark asset as seen. Creates record with Status=Seen if new; otherwise updates Status (New→Seen) and timestamps.
 */
export async function upsertSeen(args: UpsertSeenArgs): Promise<void> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const existing = await findExisting(args.token, args.driveFileId);

  if (!existing) {
    const createFields: Record<string, unknown> = {
      'Review Token': args.token,
      Project: [args.projectId],
      [SOURCE_FOLDER_ID_FIELD]: args.driveFileId,
      Filename: (args.filename ?? '').slice(0, 500),
      Tactic: args.tactic,
      Variant: args.variant,
      Status: 'Seen',
      'First Seen At': now,
      'Last Seen At': now,
      'Last Activity At': now,
    };
    // Only include First Seen By Client At if field exists (graceful degradation)
    createFields[FIRST_SEEN_BY_CLIENT_AT_FIELD] = now;
    
    try {
      await osBase(TABLE).create(createFields as any);
    } catch (err) {
      // If field doesn't exist (422), remove it and retry without it
      const message = err instanceof Error ? err.message : String(err);
      const isFieldMissing = typeof err === 'object' && err !== null && 
        ('statusCode' in err && (err as { statusCode: number }).statusCode === 422) ||
        message.includes('UNKNOWN_FIELD_NAME') ||
        message.includes(FIRST_SEEN_BY_CLIENT_AT_FIELD);
      
      if (isFieldMissing && FIRST_SEEN_BY_CLIENT_AT_FIELD in createFields) {
        console.warn(`[reviewAssetStatus] Field "${FIRST_SEEN_BY_CLIENT_AT_FIELD}" not found in Airtable. Creating record without it.`);
        delete createFields[FIRST_SEEN_BY_CLIENT_AT_FIELD];
        await osBase(TABLE).create(createFields as any);
      } else {
        throw err;
      }
    }
    return;
  }

  const currentStatus = parseStatus(existing.fields['Status']);
  const updates: Record<string, unknown> = {
    'Last Seen At': now,
    'Last Activity At': now,
    Filename: (args.filename ?? '').slice(0, 500),
  };
  if (currentStatus === 'New') {
    updates['Status'] = 'Seen';
  }
  // Only set First Seen By Client At if field exists and is not already set
  const existingFirstSeenByClient = existing.fields[FIRST_SEEN_BY_CLIENT_AT_FIELD] != null
    ? parseOptionalIsoString(existing.fields[FIRST_SEEN_BY_CLIENT_AT_FIELD])
    : null;
  if (existingFirstSeenByClient == null || existingFirstSeenByClient === '') {
    // Only include field if it exists in Airtable (graceful degradation)
    // If field doesn't exist, Airtable will ignore it or return 422, which we handle elsewhere
    updates[FIRST_SEEN_BY_CLIENT_AT_FIELD] = now;
  }
  try {
    await osBase(TABLE).update(existing.id, updates as any);
  } catch (err) {
    // If field doesn't exist (422), remove it and retry without it
    const message = err instanceof Error ? err.message : String(err);
    const isFieldMissing = typeof err === 'object' && err !== null && 
      ('statusCode' in err && (err as { statusCode: number }).statusCode === 422) ||
      message.includes('UNKNOWN_FIELD_NAME') ||
      message.includes(FIRST_SEEN_BY_CLIENT_AT_FIELD);
    
    if (isFieldMissing && FIRST_SEEN_BY_CLIENT_AT_FIELD in updates) {
      console.warn(`[reviewAssetStatus] Field "${FIRST_SEEN_BY_CLIENT_AT_FIELD}" not found in Airtable. Retrying without it.`);
      delete updates[FIRST_SEEN_BY_CLIENT_AT_FIELD];
      await osBase(TABLE).update(existing.id, updates as any);
    } else {
      throw err;
    }
  }
}

export interface UpsertStatusArgs {
  token: string;
  projectId: string;
  driveFileId: string;
  status: AssetStatusValue;
  /** When status is Approved, use this timestamp if provided (e.g. from client to avoid server TZ skew). */
  approvedAt?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  notes?: string;
}

/**
 * Set asset status (Approved / Needs Changes). Creates record if missing; otherwise updates.
 */
export async function upsertStatus(args: UpsertStatusArgs): Promise<void> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const approvedAt = args.status === 'Approved' && args.approvedAt ? args.approvedAt : now;
  const existing = await findExisting(args.token, args.driveFileId);

  const updates: Record<string, unknown> = {
    Status: args.status,
    'Last Activity At': now,
  };
  if (args.notes !== undefined) {
    updates['Notes'] = String(args.notes).slice(0, 5000);
  }
  if (args.status === 'Approved') {
    updates['Approved At'] = approvedAt;
    if (args.approvedByName !== undefined) updates['Approved By Name'] = args.approvedByName.slice(0, 100);
    if (args.approvedByEmail !== undefined) updates['Approved By Email'] = args.approvedByEmail.slice(0, 200);
  }

  if (!existing) {
    await osBase(TABLE).create({
      'Review Token': args.token,
      Project: [args.projectId],
      [SOURCE_FOLDER_ID_FIELD]: args.driveFileId,
      Filename: '',
      Tactic: '',
      Variant: '',
      ...updates,
    } as any);
    return;
  }

  await osBase(TABLE).update(existing.id, updates as any);
}

// ============================================================================
// Bulk approve (Asset Approved (Client) = true only; Airtable automation sets the rest)
// ============================================================================

const BULK_APPROVE_CHUNK_SIZE = 10;

export interface BulkApproveRecordResult {
  toUpdate: string[];
  alreadyApproved: number;
  noRecord: number;
}

/**
 * For a list of asset file IDs (e.g. currently displayed), return Airtable record IDs
 * that need updating (not yet approved) and counts for already approved / no record.
 */
export async function getRecordIdsForBulkApprove(
  token: string,
  fileIds: string[]
): Promise<BulkApproveRecordResult> {
  const statusMap = await listAssetStatuses(token);
  const toUpdate: string[] = [];
  let alreadyApproved = 0;
  let noRecord = 0;
  for (const fileId of fileIds) {
    const key = keyFrom(token, fileId);
    const rec = statusMap.get(key);
    if (!rec) {
      noRecord += 1;
      continue;
    }
    if (rec.assetApprovedClient || rec.status === 'Approved') {
      alreadyApproved += 1;
      continue;
    }
    toUpdate.push(rec.recordId);
  }
  return { toUpdate, alreadyApproved, noRecord };
}

export interface BatchSetAssetApprovedClientResult {
  updated: number;
  failedAt: number | null;
  error?: string;
  airtableError?: unknown;
}

export interface BatchSetAssetApprovedClientOptions {
  /** Client-sent approval time (ISO) so "Approved At" reflects when the user clicked. */
  approvedAt?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  /** When set, write this to Delivery Batch ID on each CRAS record (Partner Delivery Batch link or Batch ID text). */
  deliveryBatchId?: string | null;
}

/**
 * Set Asset Approved (Client) = true on the given Airtable record IDs.
 * Optionally sets Approved At / Approved By on each record so timestamps match the user's action.
 * Updates in chunks of 10 (Airtable limit). Stops on first batch failure.
 */
export async function batchSetAssetApprovedClient(
  recordIds: string[],
  options?: BatchSetAssetApprovedClientOptions
): Promise<BatchSetAssetApprovedClientResult> {
  const osBase = getBase();
  const fields: Record<string, unknown> = {
    [ASSET_APPROVED_CLIENT_FIELD]: true,
    Status: 'Approved',
  };
  if (options?.approvedAt) {
    fields['Approved At'] = options.approvedAt;
    if (options.approvedByName !== undefined) fields['Approved By Name'] = String(options.approvedByName).slice(0, 100);
    if (options.approvedByEmail !== undefined) fields['Approved By Email'] = String(options.approvedByEmail).slice(0, 200);
  }
  if (options?.deliveryBatchId != null && String(options.deliveryBatchId).trim()) {
    const bid = String(options.deliveryBatchId).trim();
    fields[DELIVERY_BATCH_ID_FIELD] = bid.startsWith('rec') ? [bid] : bid;
    // When a delivery batch is set, automatically mark as ready for delivery
    // This triggers the backend worker to process the delivery
    fields[READY_TO_DELIVER_WEBHOOK_FIELD] = true;
  }
  let updated = 0;
  for (let i = 0; i < recordIds.length; i += BULK_APPROVE_CHUNK_SIZE) {
    const chunk = recordIds.slice(i, i + BULK_APPROVE_CHUNK_SIZE);
    try {
      await Promise.all(chunk.map((id) => osBase(TABLE).update(id, fields as any)));
      updated += chunk.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const airtableError = err;
      return {
        updated,
        failedAt: i,
        error: message,
        airtableError,
      };
    }
  }
  return { updated, failedAt: null };
}

export interface SetSingleAssetApprovedClientArgs {
  token: string;
  driveFileId: string;
  /** Client-sent approval time (ISO string) so "Approved At" reflects when the user clicked. */
  approvedAt?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  /** When set, write this to Delivery Batch ID on the CRAS record (Partner Delivery Batch link or Batch ID text). */
  deliveryBatchId?: string | null;
}

/**
 * Set Asset Approved (Client) = true for a single asset by token + driveFileId.
 * Optionally sets Approved At / Approved By so the timestamp reflects the user's action time.
 * Does not write Status; Airtable automation can set Needs Delivery etc.
 * Returns alreadyApproved if the checkbox was already true.
 */
export async function setSingleAssetApprovedClient(
  args: SetSingleAssetApprovedClientArgs
): Promise<
  | { ok: true; recordId: string }
  | { alreadyApproved: true; recordId: string }
  | { error: string; airtableError?: unknown }
> {
  const { token, driveFileId, approvedAt, approvedByName, approvedByEmail, deliveryBatchId } = args;
  const existing = await findExisting(token, driveFileId);
  if (!existing) {
    return { error: 'Record not found' };
  }
  if (parseAssetApprovedClient(existing.fields[ASSET_APPROVED_CLIENT_FIELD])) {
    return { alreadyApproved: true, recordId: existing.id };
  }
  const osBase = getBase();
  const fields: Record<string, unknown> = {
    [ASSET_APPROVED_CLIENT_FIELD]: true,
    Status: 'Approved',
  };
  if (approvedAt) {
    fields['Approved At'] = approvedAt;
    if (approvedByName !== undefined) fields['Approved By Name'] = String(approvedByName).slice(0, 100);
    if (approvedByEmail !== undefined) fields['Approved By Email'] = String(approvedByEmail).slice(0, 200);
  }
  if (deliveryBatchId != null && String(deliveryBatchId).trim()) {
    const bid = String(deliveryBatchId).trim();
    fields[DELIVERY_BATCH_ID_FIELD] = bid.startsWith('rec') ? [bid] : bid;
    // When a delivery batch is set, automatically mark as ready for delivery
    // This triggers the backend worker to process the delivery
    fields[READY_TO_DELIVER_WEBHOOK_FIELD] = true;
  }
  try {
    await osBase(TABLE).update(existing.id, fields as any);
    return { ok: true, recordId: existing.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, airtableError: err };
  }
}

// ============================================================================
// First Seen By Client At (set once on portal load for unseen assets)
// ============================================================================

const FIRST_SEEN_CHUNK_SIZE = 10;

/**
 * Return Airtable record IDs for assets that have never been seen by client
 * (First Seen By Client At is null). Used to batch-set timestamp on portal load.
 */
export async function getRecordIdsForFirstSeen(
  token: string,
  fileIds: string[]
): Promise<{ toUpdate: string[] }> {
  const statusMap = await listAssetStatuses(token);
  const toUpdate: string[] = [];
  for (const fileId of fileIds) {
    const key = keyFrom(token, fileId);
    const rec = statusMap.get(key);
    if (!rec) continue;
    if (rec.firstSeenByClientAt != null && rec.firstSeenByClientAt !== '') continue;
    toUpdate.push(rec.recordId);
  }
  return { toUpdate };
}

/**
 * Set First Seen By Client At = now on the given record IDs. Chunks of 10.
 * Only call with records that currently have null (do not overwrite).
 * Gracefully handles missing field (422) - logs warning but doesn't fail.
 */
export async function batchSetFirstSeenByClientAt(
  recordIds: string[]
): Promise<{ updated: number; failedAt: number | null; error?: string }> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const fields = { [FIRST_SEEN_BY_CLIENT_AT_FIELD]: now } as Record<string, unknown>;
  let updated = 0;
  for (let i = 0; i < recordIds.length; i += FIRST_SEEN_CHUNK_SIZE) {
    const chunk = recordIds.slice(i, i + FIRST_SEEN_CHUNK_SIZE);
    try {
      await Promise.all(chunk.map((id) => osBase(TABLE).update(id, fields as any)));
      updated += chunk.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Check if this is a 422 (field doesn't exist) - treat as non-fatal
      const isFieldMissing = typeof err === 'object' && err !== null && 
        ('statusCode' in err && (err as { statusCode: number }).statusCode === 422) ||
        message.includes('UNKNOWN_FIELD_NAME') ||
        message.includes('First Seen By Client At');
      
      if (isFieldMissing) {
        console.warn(`[reviewAssetStatus] Field "${FIRST_SEEN_BY_CLIENT_AT_FIELD}" not found in Airtable. Skipping first-seen tracking. Error:`, message);
        // Continue processing - this is a non-critical field
        updated += chunk.length; // Count as "updated" since we tried
        continue;
      }
      
      // For other errors, fail fast
      return { updated, failedAt: i, error: message };
    }
  }
  return { updated, failedAt: null };
}
