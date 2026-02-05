// lib/airtable/reviewAssetDelivery.ts
// Get and update Creative Review Asset Status delivery fields (webhook flow).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

/** Airtable field: Google Drive folder ID for the source (delivery copies this folder tree). */
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

const AIRTABLE_UPDATE_TIMEOUT_MS = 9000;

/**
 * Run an async function with a timeout using a fresh AbortController.
 * Use for fire-and-forget Airtable updates so they don't inherit the request's AbortSignal.
 */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

const DELIVERY_STATUS_FIELD = 'Delivery Status';
const DELIVERED_AT_FIELD = 'Delivered At';
const DELIVERED_FILE_URL_FIELD = 'Delivered File URL';
const DELIVERED_FOLDER_ID_FIELD = 'Delivered Folder ID';
const DELIVERED_FOLDER_URL_FIELD = 'Delivered Folder URL';
const DELIVERY_FILES_COUNT_FIELD = 'Delivery Files Count';
const DELIVERY_FOLDERS_COUNT_FIELD = 'Delivery Folders Count';
const DELIVERY_FAILURES_FIELD = 'Delivery Failures';
const DELIVERY_ERROR_FIELD = 'Delivery Error';
const READY_TO_DELIVER_WEBHOOK_FIELD = 'Ready to Deliver (Webhook)';

export type DeliveryStatusValue = 'Not Delivered' | 'Delivering' | 'Delivered' | 'Error';

export interface AssetDeliveryRecord {
  recordId: string;
  driveFileId: string | null;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  deliveredFileUrl: string | null;
  deliveryError: string | null;
}

/**
 * Fetch a Creative Review Asset Status record by Airtable record ID.
 * Returns null if not found.
 */
export async function getAssetStatusRecordById(
  recordId: string
): Promise<AssetDeliveryRecord | null> {
  const base = getBase();
  try {
    const record = await base(TABLE).find(recordId);
    const f = record.fields as Record<string, unknown>;
    const driveFileId = typeof f[SOURCE_FOLDER_ID_FIELD] === 'string' ? (f[SOURCE_FOLDER_ID_FIELD] as string).trim() : null;
    return {
      recordId: record.id,
      driveFileId: driveFileId || null,
      deliveryStatus: (f[DELIVERY_STATUS_FIELD] as string) ?? null,
      deliveredAt: (f[DELIVERED_AT_FIELD] as string) ?? null,
      deliveredFileUrl: (f[DELIVERED_FILE_URL_FIELD] as string) ?? null,
      deliveryError: (f[DELIVERY_ERROR_FIELD] as string) ?? null,
    };
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'statusCode' in err ? (err as { statusCode: number }).statusCode : undefined;
    if (code === 404) return null;
    throw err;
  }
}

/**
 * True if the record is already delivered (idempotency: skip copy and return ok).
 */
export function isAlreadyDelivered(record: AssetDeliveryRecord): boolean {
  const status = (record.deliveryStatus ?? '').trim();
  if (status === 'Delivered') return true;
  if ((record.deliveredAt ?? '').trim().length > 0) return true;
  return false;
}

export interface DeliverySuccessFolderPayload {
  deliveredFolderId: string;
  deliveredFolderUrl: string;
  filesCopied: number;
  foldersCreated: number;
  failures?: Array<{ id: string; name?: string; reason: string }>;
}

/**
 * Update Creative Review Asset Status record on delivery success.
 * Accepts either a single URL string (legacy) or a folder payload (deliveredFolderId, deliveredFolderUrl, counts, failures).
 */
export async function updateAssetStatusDeliverySuccess(
  recordId: string,
  deliveredFileUrlOrFolderPayload: string | DeliverySuccessFolderPayload
): Promise<void> {
  const base = getBase();
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    [DELIVERY_STATUS_FIELD]: 'Delivered',
    [DELIVERED_AT_FIELD]: now,
    [DELIVERY_ERROR_FIELD]: '',
    [READY_TO_DELIVER_WEBHOOK_FIELD]: false,
  };

  if (typeof deliveredFileUrlOrFolderPayload === 'string') {
    fields[DELIVERED_FILE_URL_FIELD] = deliveredFileUrlOrFolderPayload;
  } else {
    const p = deliveredFileUrlOrFolderPayload;
    fields[DELIVERED_FILE_URL_FIELD] = p.deliveredFolderUrl;
    fields[DELIVERED_FOLDER_ID_FIELD] = p.deliveredFolderId;
    fields[DELIVERED_FOLDER_URL_FIELD] = p.deliveredFolderUrl;
    fields[DELIVERY_FILES_COUNT_FIELD] = p.filesCopied;
    fields[DELIVERY_FOLDERS_COUNT_FIELD] = p.foldersCreated;
    if (p.failures && p.failures.length > 0) {
      fields[DELIVERY_FAILURES_FIELD] = JSON.stringify(p.failures);
    }
  }

  await base(TABLE).update(recordId, fields as any);
}

/**
 * Update Creative Review Asset Status record on delivery failure.
 */
export async function updateAssetStatusDeliveryError(
  recordId: string,
  errorMessage: string
): Promise<void> {
  const base = getBase();
  const truncated = String(errorMessage).slice(0, 1000);
  const fields: Record<string, unknown> = {
    [DELIVERY_STATUS_FIELD]: 'Error',
    [DELIVERY_ERROR_FIELD]: truncated,
    [READY_TO_DELIVER_WEBHOOK_FIELD]: false,
  };
  await base(TABLE).update(recordId, fields as any);
}

/**
 * Update delivery error via Airtable REST API with a fresh AbortController (no request signal).
 * Use for fire-and-forget updates from webhook handlers so client disconnect doesn't abort the update.
 */
export async function updateAssetStatusDeliveryErrorFireAndForget(
  recordId: string,
  errorMessage: string,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
  if (!apiKey || !baseId) {
    throw new Error('Airtable credentials not configured');
  }
  const truncated = String(errorMessage).slice(0, 1000);
  const fields: Record<string, unknown> = {
    [DELIVERY_STATUS_FIELD]: 'Error',
    [DELIVERY_ERROR_FIELD]: truncated,
    [READY_TO_DELIVER_WEBHOOK_FIELD]: false,
  };
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
    signal: signal ?? null,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed (${res.status}): ${text}`);
  }
}
