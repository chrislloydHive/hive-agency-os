// lib/airtable/partnerDeliveryBatches.ts
// Lookup destination folder by Batch ID for partner delivery webhook.

import type { FieldSet } from 'airtable';

import { getProjectsBase } from '@/lib/airtable';
import { airtableFetch } from '@/lib/airtable/airtableFetch';
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
  
  // Debug: Log all available fields and the Destination Folder ID field value
  // Also check for alternative field names that might contain folder IDs
  const allFields = Object.keys(f);
  const folderIdFields = allFields.filter(key => 
    key.toLowerCase().includes('folder') || 
    key.toLowerCase().includes('destination') ||
    (typeof f[key] === 'string' && (f[key] as string).length > 20 && (f[key] as string).includes('1HELQKO9dB'))
  );
  
  console.log(`[delivery/batch] Reading batch details for record ${record.id}`, {
    batchId,
    availableFields: allFields,
    folderIdRelatedFields: folderIdFields.map(key => ({ field: key, value: f[key] })),
    destinationFolderIdRaw: f[DESTINATION_FOLDER_ID_FIELD],
    destinationFolderIdType: typeof f[DESTINATION_FOLDER_ID_FIELD],
    fieldName: DESTINATION_FOLDER_ID_FIELD,
    expectedFolderId: '1HELQKO9dB__2u-umWJ2uCpuOmajR7jf0',
  });
  
  const dest = typeof f[DESTINATION_FOLDER_ID_FIELD] === 'string' ? (f[DESTINATION_FOLDER_ID_FIELD] as string).trim() : '';
  
  console.log(`[delivery/batch] Parsed destination folder ID`, {
    batchId,
    recordId: record.id,
    rawValue: f[DESTINATION_FOLDER_ID_FIELD],
    trimmedValue: dest,
    isEmpty: !dest,
  });
  
  if (!dest) {
    console.warn(`[delivery/batch] Destination Folder ID is empty or missing for batch ${batchId} (record ${record.id})`);
    return null;
  }

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

  if (!process.env.AIRTABLE_API_KEY) return null;

  const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{${BATCH_ID_FIELD}} = "${escaped}"`);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?maxRecords=1&filterByFormula=${formula}`;
  const res = await airtableFetch(url, { method: 'GET' });
  if (!res.ok) return null;

  const json = (await res.json()) as { records?: Array<{ id: string; fields: Record<string, unknown> }> };
  const record = json.records?.[0];
  if (!record) return null;
  return mapRecordToBatchDetails(record, id);
}

/**
 * Get batch details by Batch ID. Uses Projects base ({@link getProjectsBase}) — same base as Project links.
 * Returns null if not found or Destination Folder ID is empty.
 */
export async function getBatchDetails(
  batchId: string
): Promise<DeliveryBatchDetails | null> {
  const id = String(batchId).trim();
  if (!id) return null;

  const base = getProjectsBase();
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

  const base = getProjectsBase();
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
 * Returns BatchContext[] sorted: Delivering first, then Active, then createdTime desc.
 */
export async function listBatchesByProjectId(
  projectId: string
): Promise<BatchContext[]> {
  const id = String(projectId).trim();
  if (!id) return [];

  let list: DeliveryBatchListItem[] = [];

  const base = getProjectsBase();
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
    const pri = (s: string) => {
      const x = s.toLowerCase();
      if (x === 'delivering') return 0;
      if (x === 'active') return 1;
      return 2;
    };
    const ap = pri(a.status);
    const bp = pri(b.status);
    if (ap !== bp) return ap - bp;
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

  if (!process.env.AIRTABLE_API_KEY) return [];

  const formula = encodeURIComponent(`FIND("${escapeFormula(id)}", ARRAYJOIN({${BATCH_PROJECT_LINK_FIELD}})) > 0`);
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&pageSize=100`;
  const res = await airtableFetch(url, { method: 'GET' });
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
  const base = getProjectsBase();
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
  const base = getProjectsBase();
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

/**
 * Get the project name for a batch by resolving its linked Project record.
 * Reads the batch's "Project" link field, then fetches the Project record's "Name".
 * Returns null if no project is linked or the name cannot be resolved.
 */
export async function getProjectNameByBatchRecordId(
  batchRecordId: string
): Promise<string | null> {
  const id = String(batchRecordId).trim();
  if (!id) return null;

  const base = getProjectsBase();
  try {
    const record = await base(TABLE).find(id);
    const f = record.fields as Record<string, unknown>;

    // Project is a linked record field (array of record IDs)
    const projectLinks = f[BATCH_PROJECT_LINK_FIELD];
    let projectRecordId: string | null = null;
    if (Array.isArray(projectLinks) && projectLinks.length > 0 && typeof projectLinks[0] === 'string') {
      projectRecordId = projectLinks[0];
    } else if (typeof projectLinks === 'string' && (projectLinks as string).startsWith('rec')) {
      projectRecordId = projectLinks;
    }

    if (!projectRecordId) {
      console.warn(`[delivery/batch] No Project linked to batch ${batchRecordId}`);
      return null;
    }

    // Fetch the project record to get its Name
    const projectRecord = await base(AIRTABLE_TABLES.PROJECTS).find(projectRecordId);
    const projectName = typeof projectRecord.fields['Name'] === 'string'
      ? (projectRecord.fields['Name'] as string).trim()
      : null;

    console.log(`[delivery/batch] Resolved project name for batch ${batchRecordId}:`, {
      projectRecordId,
      projectName,
    });

    return projectName;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[delivery/batch] Failed to get project name for batch ${batchRecordId}:`, msg);
    return null;
  }
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

// ── Post-approval: Partner Delivery Batch status (Airtable automations) ─────

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;
/** CRAS linked field → Partner Delivery Batches row (same base as CRAS). */
const CRAS_PARTNER_DELIVERY_BATCH_FIELD = 'Partner Delivery Batch';
/** CRAS: batch link, record id, or Batch ID name string (same field name as pipeline uses). */
const CRAS_DELIVERY_BATCH_ID_FIELD = 'Delivery Batch ID';

function partnerBatchDeliveringOnApproveDisabled(): boolean {
  const v = process.env.PARTNER_BATCH_SET_DELIVERING_ON_APPROVE?.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'off';
}

function extractProjectRecordId(raw: unknown): string | null {
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string' && raw[0].startsWith('rec')) {
    return raw[0];
  }
  if (typeof raw === 'string' && raw.startsWith('rec')) return raw;
  return null;
}

/** Value from CRAS **Delivery Batch ID** (link, rec id, or batch name) for post-approve sync. */
function extractCrasDeliveryBatchIdHintForSync(fields: Record<string, unknown>): string | null {
  const raw = fields[CRAS_DELIVERY_BATCH_ID_FIELD];
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (typeof first === 'string' && first.startsWith('rec')) return first;
    if (typeof first === 'object' && first !== null && 'id' in first) {
      const id = (first as { id?: string }).id;
      if (typeof id === 'string' && id.startsWith('rec')) return id;
    }
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
}

function extractPartnerBatchRecordIdFromCrasFields(
  fields: Record<string, unknown>,
  deliveryBatchId?: string | null,
): string | null {
  if (deliveryBatchId?.trim().startsWith('rec')) return deliveryBatchId.trim();
  const pdb = fields[CRAS_PARTNER_DELIVERY_BATCH_FIELD];
  if (Array.isArray(pdb) && pdb.length > 0) {
    const first = pdb[0];
    if (typeof first === 'string' && first.startsWith('rec')) return first;
    if (typeof first === 'object' && first !== null && 'id' in first) {
      const id = (first as { id?: string }).id;
      if (typeof id === 'string' && id.startsWith('rec')) return id;
    }
  }
  if (typeof pdb === 'string' && pdb.startsWith('rec')) return pdb;
  return null;
}

/**
 * When a client approves an asset, some Airtable automations (e.g. production
 * checklist) require at least one **Partner Delivery Batches** row for the
 * project with **Status** (or **Delivery Status**) = `Delivering`. New rows
 * from `ensurePartnerDeliverySetup` are promoted to Delivering at scaffold
 * time; this helper still sets `Delivering` idempotently for older rows stuck
 * in `Active`.
 *
 * Disable with `PARTNER_BATCH_SET_DELIVERING_ON_APPROVE=0` if your base uses a
 * different state machine.
 */
export async function setPartnerDeliveryBatchStatusDeliveringForApproval(
  batchRecordId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (partnerBatchDeliveringOnApproveDisabled()) {
    return { ok: false, reason: 'PARTNER_BATCH_SET_DELIVERING_ON_APPROVE disabled' };
  }
  const id = String(batchRecordId).trim();
  if (!id.startsWith('rec')) return { ok: false, reason: 'not a record id' };

  const base = getProjectsBase();
  try {
    const rec = await base(TABLE).find(id);
    const f = rec.fields as Record<string, unknown>;
    const s1 = typeof f[BATCH_STATUS_FIELD] === 'string' ? (f[BATCH_STATUS_FIELD] as string).trim() : '';
    const s2 =
      typeof f[BATCH_DELIVERY_STATUS_FIELD] === 'string'
        ? (f[BATCH_DELIVERY_STATUS_FIELD] as string).trim()
        : '';
    const merged = (s1 || s2).toLowerCase();
    if (merged === 'delivered' || merged === 'cancelled' || merged === 'canceled') {
      return { ok: false, reason: `terminal batch state: ${s1 || s2}` };
    }
    if (merged === 'delivering') {
      return { ok: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }

  const deliveringPayload = {
    [BATCH_STATUS_FIELD]: 'Delivering',
    [BATCH_DELIVERY_STATUS_FIELD]: 'Delivering',
  } as Partial<FieldSet>;

  // Prefer a single update so Airtable automations that watch either field both see "Delivering".
  try {
    await base(TABLE).update(id, deliveringPayload);
    console.log(
      `[delivery/batch] Set ${TABLE} ${id} ${BATCH_STATUS_FIELD}+${BATCH_DELIVERY_STATUS_FIELD}=Delivering (post-approve)`,
    );
    return { ok: true };
  } catch (bothErr) {
    try {
      await base(TABLE).update(id, { [BATCH_STATUS_FIELD]: 'Delivering' } as Partial<FieldSet>);
      console.log(`[delivery/batch] Set ${TABLE} ${id} ${BATCH_STATUS_FIELD}=Delivering (post-approve)`);
      return { ok: true };
    } catch {
      try {
        await base(TABLE).update(id, {
          [BATCH_DELIVERY_STATUS_FIELD]: 'Delivering',
        } as Partial<FieldSet>);
        console.log(
          `[delivery/batch] Set ${TABLE} ${id} ${BATCH_DELIVERY_STATUS_FIELD}=Delivering (post-approve)`,
        );
        return { ok: true };
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        const bothMsg = bothErr instanceof Error ? bothErr.message : String(bothErr);
        console.warn(`[delivery/batch] Could not set Delivering on batch ${id}:`, msg, { triedBothFields: bothMsg });
        return { ok: false, reason: msg };
      }
    }
  }
}

async function resolvePartnerBatchRecordIdForApprovedCras(
  fields: Record<string, unknown>,
  deliveryBatchId?: string | null,
  projectIdFallback?: string | null,
): Promise<string | null> {
  const fromCrasField = extractCrasDeliveryBatchIdHintForSync(fields);
  const hint = (deliveryBatchId?.trim() || fromCrasField || '').trim() || null;

  const direct = extractPartnerBatchRecordIdFromCrasFields(fields, hint);
  if (direct) return direct;

  if (hint && !hint.startsWith('rec')) {
    const byName = await getBatchDetails(hint);
    if (byName?.recordId) return byName.recordId;
  }

  const projectId =
    extractProjectRecordId(fields['Project']) ??
    (projectIdFallback?.trim().startsWith('rec') ? projectIdFallback.trim() : null);
  if (!projectId) return null;

  const batches = await listBatchesByProjectId(projectId);
  if (batches.length === 0) return null;
  const preferred =
    batches.find((b) => (b.status ?? '').toLowerCase() === 'delivering') ??
    batches.find((b) => (b.status ?? '').toLowerCase() === 'active') ??
    batches[0];
  return preferred?.batchRecordId ?? null;
}

/**
 * After CRAS rows are marked approved, flip linked Partner Delivery Batches to
 * `Delivering` once per batch so Airtable scripts that gate on that status can run.
 */
export async function syncPartnerDeliveryBatchesForApprovedCras(
  crasRecordIds: string[],
): Promise<void> {
  if (!crasRecordIds.length || partnerBatchDeliveringOnApproveDisabled()) return;

  const base = getProjectsBase();
  const seen = new Set<string>();

  for (const rid of crasRecordIds) {
    const id = String(rid).trim();
    if (!id.startsWith('rec')) continue;
    try {
      const rec = await base(CRAS_TABLE).find(id);
      const f = rec.fields as Record<string, unknown>;
      const batchRec = await resolvePartnerBatchRecordIdForApprovedCras(f, null, null);
      if (!batchRec || seen.has(batchRec)) continue;
      seen.add(batchRec);
      const r = await setPartnerDeliveryBatchStatusDeliveringForApproval(batchRec);
      if (!r.ok && r.reason && !r.reason.includes('disabled')) {
        console.warn(`[delivery/batch] post-approve batch ${batchRec}: ${r.reason}`);
      }
    } catch (e) {
      console.warn(`[delivery/batch] post-approve sync skip CRAS ${id}:`, e instanceof Error ? e.message : e);
    }
  }
}
