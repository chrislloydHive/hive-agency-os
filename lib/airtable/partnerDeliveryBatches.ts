// lib/airtable/partnerDeliveryBatches.ts
// Lookup destination folder by Batch ID for partner delivery webhook.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  writeDeliveryToRecord,
  PARTNER_DELIVERY_BATCHES_TABLE,
  type DeliveryWritePayloadSuccess,
} from '@/lib/airtable/deliveryWriteBack';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const BATCH_ID_FIELD = 'Batch ID';
const DESTINATION_FOLDER_ID_FIELD = 'Destination Folder ID';
const VENDOR_NAME_FIELD = 'Vendor Name';
const PARTNER_LAST_SEEN_AT_FIELD = 'Partner Last Seen At';
const NEW_APPROVED_COUNT_FIELD = 'New Approved Count';
const DOWNLOADED_COUNT_FIELD = 'Downloaded Count';
/** Batch table: link to Projects (Option B – multiple batches per project). */
const BATCH_PROJECT_LINK_FIELD = 'Project';
/** Batch table: Status or Delivery Status (e.g. "Active", "Delivered"). */
const BATCH_STATUS_FIELD = 'Status';
const BATCH_DELIVERY_STATUS_FIELD = 'Delivery Status';

/**
 * Get Destination Folder ID for a delivery batch by Batch ID.
 * Returns null if no record found or field is empty.
 */
export async function getDestinationFolderIdByBatchId(
  batchId: string
): Promise<string | null> {
  const details = await getBatchDetails(batchId);
  return details?.destinationFolderId ?? null;
}

export interface DeliveryBatchDetails {
  /** Airtable record ID of the batch (for partner activity write-back). */
  recordId: string;
  deliveryBatchId: string;
  destinationFolderId: string;
  vendorName: string | null;
  /** When partner last clicked "Mark all as seen". */
  partnerLastSeenAt: string | null;
  /** Count of approved assets with approvedAt > partnerLastSeenAt (or partnerLastSeenAt null). */
  newApprovedCount: number | null;
  /** Count of assets with Partner Downloaded At set for this batch. */
  downloadedCount: number | null;
}

function mapRecordToBatchDetails(record: { id: string; fields: Record<string, unknown> }, batchId: string): DeliveryBatchDetails | null {
  const f = record.fields;
  const dest = typeof f[DESTINATION_FOLDER_ID_FIELD] === 'string' ? (f[DESTINATION_FOLDER_ID_FIELD] as string).trim() : '';
  if (!dest) return null;

  const vendorRaw = f[VENDOR_NAME_FIELD];
  const vendorName =
    typeof vendorRaw === 'string' && vendorRaw.trim()
      ? vendorRaw.trim()
      : null;

  const partnerLastSeenAtRaw = f[PARTNER_LAST_SEEN_AT_FIELD];
  const partnerLastSeenAt =
    typeof partnerLastSeenAtRaw === 'string' && partnerLastSeenAtRaw.trim()
      ? partnerLastSeenAtRaw.trim()
      : null;

  const newApprovedCountRaw = f[NEW_APPROVED_COUNT_FIELD];
  const newApprovedCount =
    typeof newApprovedCountRaw === 'number' && Number.isFinite(newApprovedCountRaw)
      ? newApprovedCountRaw
      : null;

  const downloadedCountRaw = f[DOWNLOADED_COUNT_FIELD];
  const downloadedCount =
    typeof downloadedCountRaw === 'number' && Number.isFinite(downloadedCountRaw)
      ? downloadedCountRaw
      : null;

  return {
    recordId: record.id,
    deliveryBatchId: batchId,
    destinationFolderId: dest,
    vendorName,
    partnerLastSeenAt,
    newApprovedCount,
    downloadedCount,
  };
}

/**
 * Get batch details by Batch ID from a specific Airtable base (REST API).
 * Use when Partner Delivery Batches table is in a different base (e.g. Client PM).
 */
export async function getBatchDetailsInBase(
  batchId: string,
  baseId: string
): Promise<DeliveryBatchDetails | null> {
  const id = String(batchId).trim();
  if (!id || !baseId) return null;

  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) return null;

  const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{${BATCH_ID_FIELD}} = "${escaped}"`);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?maxRecords=1&filterByFormula=${formula}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return null;

  const json = (await res.json()) as { records?: Array<{ id: string; fields: Record<string, unknown> }> };
  const record = json.records?.[0];
  if (!record) return null;
  return mapRecordToBatchDetails(record, id);
}

/**
 * Get batch details by Batch ID. Uses default base (getBase()).
 * Returns null if not found or Destination Folder ID is empty.
 */
export async function getBatchDetails(
  batchId: string
): Promise<DeliveryBatchDetails | null> {
  const id = String(batchId).trim();
  if (!id) return null;

  const base = getBase();
  const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `{${BATCH_ID_FIELD}} = "${escaped}"`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  if (records.length === 0) return null;
  return mapRecordToBatchDetails(records[0] as { id: string; fields: Record<string, unknown> }, id);
}

/**
 * Get batch details by Partner Delivery Batches record ID (e.g. from CRAS link field).
 * Use when CRAS stores a link to the batch record instead of the Batch ID string.
 */
export async function getBatchDetailsByRecordId(
  batchRecordId: string
): Promise<DeliveryBatchDetails | null> {
  const id = String(batchRecordId).trim();
  if (!id) return null;

  const base = getBase();
  try {
    const record = await base(TABLE).find(id);
    const f = record.fields as Record<string, unknown>;
    const batchId = typeof f[BATCH_ID_FIELD] === 'string' ? (f[BATCH_ID_FIELD] as string).trim() : id;
    return mapRecordToBatchDetails(record as { id: string; fields: Record<string, unknown> }, batchId);
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'statusCode' in err ? (err as { statusCode: number }).statusCode : undefined;
    if (code === 404) return null;
    throw err;
  }
}

/** Project field: Delivery Batch ID (text) or link to Partner Delivery Batches. */
const PROJECT_DELIVERY_BATCH_ID_FIELD = 'Delivery Batch ID';
const PROJECT_DELIVERY_BATCH_LINK_FIELD = 'Partner Delivery Batch';
/** Project field: default batch when partner has multiple (Option B). */
const PROJECT_DEFAULT_PARTNER_BATCH_FIELD = 'Default Partner Batch';

/** Option B: batch context for partner portal (list + selection). */
export interface BatchContext {
  batchRecordId: string;
  batchId: string;
  destinationFolderId: string;
  destinationFolderUrl?: string;
  vendorName?: string | null;
  partnerName?: string | null;
  status?: string;
  createdTime?: string;
  /** When partner last clicked "Mark all as seen" (selected batch only). */
  partnerLastSeenAt?: string | null;
}

export interface DeliveryBatchListItem {
  batchId: string;
  destinationFolderId: string;
  vendorName: string | null;
  status: string;
  recordId: string;
  createdTime: string;
}

function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function listItemToBatchContext(item: DeliveryBatchListItem): BatchContext {
  return {
    batchRecordId: item.recordId,
    batchId: item.batchId,
    destinationFolderId: item.destinationFolderId,
    destinationFolderUrl: folderUrl(item.destinationFolderId),
    vendorName: item.vendorName,
    partnerName: item.vendorName,
    status: item.status || undefined,
    createdTime: item.createdTime || undefined,
  };
}

function escapeFormula(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function mapRecordToListItem(record: { id: string; fields: Record<string, unknown>; createdTime?: string }): DeliveryBatchListItem | null {
  const f = record.fields;
  const batchIdRaw = f[BATCH_ID_FIELD];
  const batchId = typeof batchIdRaw === 'string' && batchIdRaw.trim() ? batchIdRaw.trim() : null;
  const dest = typeof f[DESTINATION_FOLDER_ID_FIELD] === 'string' ? (f[DESTINATION_FOLDER_ID_FIELD] as string).trim() : '';
  if (!batchId || !dest) return null;

  const vendorRaw = f[VENDOR_NAME_FIELD];
  const vendorName =
    typeof vendorRaw === 'string' && vendorRaw.trim()
      ? vendorRaw.trim()
      : null;

  const statusRaw = f[BATCH_STATUS_FIELD] ?? f[BATCH_DELIVERY_STATUS_FIELD];
  const status = typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : '';

  const createdTime = typeof (record as { createdTime?: string }).createdTime === 'string'
    ? (record as { createdTime: string }).createdTime
    : '';

  return {
    batchId,
    destinationFolderId: dest,
    vendorName,
    status,
    recordId: record.id,
    createdTime,
  };
}

/**
 * List all Partner Delivery Batches linked to a project (Option B).
 * Uses default base first; if empty and PARTNER_DELIVERY_BASE_ID is set, queries that base.
 * Returns BatchContext[] sorted: Active first, then createdTime desc.
 */
export async function listBatchesByProjectId(
  projectId: string
): Promise<BatchContext[]> {
  const id = String(projectId).trim();
  if (!id) return [];

  let list: DeliveryBatchListItem[] = [];

  const base = getBase();
  const formula = `FIND("${escapeFormula(id)}", ARRAYJOIN({${BATCH_PROJECT_LINK_FIELD}})) > 0`;
  try {
    const records = await base(TABLE)
      .select({ filterByFormula: formula })
      .firstPage();
    for (const rec of records) {
      const r = rec as { id: string; fields: Record<string, unknown>; createdTime?: string };
      const item = mapRecordToListItem(r);
      if (item) list.push(item);
    }
  } catch {
    list = [];
  }

  if (list.length === 0 && process.env.PARTNER_DELIVERY_BASE_ID?.trim()) {
    list = await listBatchesByProjectIdInBase(id, process.env.PARTNER_DELIVERY_BASE_ID.trim());
  }

  list.sort((a, b) => {
    const aActive = a.status.toLowerCase() === 'active' ? 0 : 1;
    const bActive = b.status.toLowerCase() === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    return bTime - aTime;
  });

  return list.map(listItemToBatchContext);
}

/**
 * List batches by project from a specific base (REST API).
 */
export async function listBatchesByProjectIdInBase(
  projectId: string,
  baseId: string
): Promise<DeliveryBatchListItem[]> {
  const id = String(projectId).trim();
  if (!id || !baseId) return [];

  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  if (!apiKey) return [];

  const formula = encodeURIComponent(`FIND("${escapeFormula(id)}", ARRAYJOIN({${BATCH_PROJECT_LINK_FIELD}})) > 0`);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return [];

  const json = (await res.json()) as { records?: Array<{ id: string; fields: Record<string, unknown>; createdTime?: string }> };
  const records = json.records ?? [];
  const list: DeliveryBatchListItem[] = [];
  for (const rec of records) {
    const item = mapRecordToListItem(rec);
    if (item) list.push(item);
  }
  return list;
}

/**
 * Get the Project's default Partner Batch ID (Batch ID string) for selection.
 * Reads Project's "Default Partner Batch" link and returns that batch's Batch ID.
 */
export async function getProjectDefaultBatchId(projectId: string): Promise<string | null> {
  const base = getBase();
  const projectsTable = AIRTABLE_TABLES.PROJECTS;
  try {
    const projectRecord = await base(projectsTable).find(projectId);
    const fields = projectRecord.fields as Record<string, unknown>;
    const linkVal = fields[PROJECT_DEFAULT_PARTNER_BATCH_FIELD];
    if (!Array.isArray(linkVal) || linkVal.length === 0) return null;
    const first = linkVal[0];
    const linkedRecordId = typeof first === 'string' ? first : (first as { id?: string })?.id;
    if (!linkedRecordId) return null;

    const batchRecord = await base(TABLE).find(linkedRecordId);
    const batchFields = batchRecord.fields as Record<string, unknown>;
    const batchId = typeof batchFields[BATCH_ID_FIELD] === 'string' ? (batchFields[BATCH_ID_FIELD] as string).trim() : null;
    return batchId || null;
  } catch {
    return null;
  }
}

/**
 * Get delivery context for a project (batch id, destination folder, vendor).
 * Resolves from Project's linked Partner Delivery Batch or "Delivery Batch ID" text.
 */
export async function getDeliveryContextByProjectId(
  projectId: string
): Promise<DeliveryBatchDetails | null> {
  const base = getBase();
  const projectsTable = AIRTABLE_TABLES.PROJECTS;

  let batchId: string | null = null;
  try {
    const projectRecord = await base(projectsTable).find(projectId);
    const fields = projectRecord.fields as Record<string, unknown>;
    const linkVal = fields[PROJECT_DELIVERY_BATCH_LINK_FIELD];
    if (Array.isArray(linkVal) && linkVal.length > 0) {
      const first = linkVal[0];
      const linkedId = typeof first === 'string' ? first : (first as { id?: string })?.id;
      if (linkedId) {
        const batchRecord = await base(TABLE).find(linkedId);
        const batchFields = batchRecord.fields as Record<string, unknown>;
        batchId = typeof batchFields[BATCH_ID_FIELD] === 'string' ? (batchFields[BATCH_ID_FIELD] as string).trim() : null;
      }
    }
    if (!batchId && typeof fields[PROJECT_DELIVERY_BATCH_ID_FIELD] === 'string') {
      batchId = (fields[PROJECT_DELIVERY_BATCH_ID_FIELD] as string).trim();
    }
  } catch {
    return null;
  }

  if (!batchId) return null;

  let details = await getBatchDetails(batchId);
  if (!details && process.env.PARTNER_DELIVERY_BASE_ID?.trim()) {
    details = await getBatchDetailsInBase(batchId, process.env.PARTNER_DELIVERY_BASE_ID.trim());
  }
  return details;
}

export interface DeliveryResultPayload {
  deliveredFolderId: string;
  deliveredFolderUrl: string;
  approvedCount: number;
  filesCopied: number;
  failures: Array<{ fileId: string; reason: string }>;
}

/**
 * Write delivery result to an Airtable record (Partner Delivery Batches).
 * Uses field-alias aware helper: Delivery Status, Delivered At, Delivered checkbox, Folder ID/URL, Summary, Error.
 */
export async function updateDeliveryResultToRecord(
  recordId: string,
  payload: DeliveryResultPayload
): Promise<void> {
  const now = new Date().toISOString();
  const summaryJson = JSON.stringify({
    approvedCount: payload.approvedCount,
    filesCopied: payload.filesCopied,
    failures: payload.failures,
  });
  const deliveryError =
    payload.failures.length > 0
      ? `${payload.failures.length} file(s) failed: ${payload.failures.map((f) => f.reason).join('; ').slice(0, 200)}`
      : '';

  const writePayload: DeliveryWritePayloadSuccess = {
    kind: 'success',
    deliveryStatus: 'Delivered',
    deliveredAt: now,
    deliveredCheckbox: true,
    deliveredFolderId: payload.deliveredFolderId,
    deliveredFolderUrl: payload.deliveredFolderUrl,
    deliverySummary: summaryJson,
    ...(deliveryError && { deliveryError }),
  };

  const result = await writeDeliveryToRecord(
    PARTNER_DELIVERY_BATCHES_TABLE,
    recordId,
    writePayload
  );
  
  // Log result for debugging
  console.log('[deliveryWriteBack] Batch record update result:', {
    recordId,
    ok: result.ok,
    written: result.written,
    skipped: result.skipped,
    error: result.error || null,
  });
  
  // Only throw if critical fields failed AND no fields were written
  if (!result.ok && result.error && result.written.length === 0) {
    // Log error but don't throw - delivery succeeded, Airtable write-back is best-effort
    console.error('[deliveryWriteBack] Batch record update failed (non-blocking):', result.error);
    // Don't throw - allow delivery to succeed even if Airtable write-back fails
  }
}
