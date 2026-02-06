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

/**
 * Get batch details by Batch ID. Returns null if not found.
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

  const record = records[0];
  const f = record.fields as Record<string, unknown>;
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
    deliveryBatchId: id,
    destinationFolderId: dest,
    vendorName,
    partnerLastSeenAt,
    newApprovedCount,
    downloadedCount,
  };
}

/** Project field: Delivery Batch ID (text) or link to Partner Delivery Batches. */
const PROJECT_DELIVERY_BATCH_ID_FIELD = 'Delivery Batch ID';
const PROJECT_DELIVERY_BATCH_LINK_FIELD = 'Partner Delivery Batch';

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
  return getBatchDetails(batchId);
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
  if (!result.ok && result.error) {
    throw new Error(result.error);
  }
}
