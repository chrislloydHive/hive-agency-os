// lib/airtable/reviewAssetDelivery.ts
// Get and update Creative Review Asset Status delivery fields (webhook flow).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  writeDeliveryToRecord,
  CREATIVE_REVIEW_ASSET_STATUS_TABLE,
  type DeliveryWritePayloadSuccess,
  type DeliveryWritePayloadError,
} from '@/lib/airtable/deliveryWriteBack';

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
const DELIVERY_ERROR_FIELD = 'Delivery Error';

export type DeliveryStatusValue = 'Not Delivered' | 'Delivering' | 'Delivered' | 'Error';

const TACTIC_FIELD = 'Tactic';
const VARIANT_FIELD = 'Variant';

export interface AssetDeliveryRecord {
  recordId: string;
  driveFileId: string | null;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  deliveredFileUrl: string | null;
  deliveryError: string | null;
  /** e.g. Display, Social, Video (for subfolder routing). */
  tactic: string | null;
  /** e.g. Prospecting, Retargeting (optional). */
  variant: string | null;
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
    const tacticRaw = f[TACTIC_FIELD];
    const tactic = typeof tacticRaw === 'string' && tacticRaw.trim() ? tacticRaw.trim() : null;
    const variantRaw = f[VARIANT_FIELD];
    const variant = typeof variantRaw === 'string' && variantRaw.trim() ? variantRaw.trim() : null;
    return {
      recordId: record.id,
      driveFileId: driveFileId || null,
      deliveryStatus: (f[DELIVERY_STATUS_FIELD] as string) ?? null,
      deliveredAt: (f[DELIVERED_AT_FIELD] as string) ?? null,
      deliveredFileUrl: (f[DELIVERED_FILE_URL_FIELD] as string) ?? null,
      deliveryError: (f[DELIVERY_ERROR_FIELD] as string) ?? null,
      tactic,
      variant,
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
 * Uses field-alias aware write-back (skips non-writable, safe for single-select). Logs fields written.
 * Accepts either a single URL string (legacy) or a folder payload (deliveredFolderId, deliveredFolderUrl, counts, failures).
 */
export async function updateAssetStatusDeliverySuccess(
  recordId: string,
  deliveredFileUrlOrFolderPayload: string | DeliverySuccessFolderPayload
): Promise<void> {
  const now = new Date().toISOString();
  let deliveredFolderUrl: string;
  let deliveredFolderId: string;
  let deliverySummary: string;
  let deliveryFilesCount: number | undefined;
  let deliveryFoldersCount: number | undefined;
  let deliveryFailures: string | undefined;

  if (typeof deliveredFileUrlOrFolderPayload === 'string') {
    deliveredFolderUrl = deliveredFileUrlOrFolderPayload;
    deliveredFolderId = '';
    deliverySummary = JSON.stringify({ url: deliveredFileUrlOrFolderPayload });
  } else {
    const p = deliveredFileUrlOrFolderPayload;
    deliveredFolderUrl = p.deliveredFolderUrl;
    deliveredFolderId = p.deliveredFolderId;
    deliverySummary = JSON.stringify({
      deliveredFolderId: p.deliveredFolderId,
      deliveredFolderUrl: p.deliveredFolderUrl,
      filesCopied: p.filesCopied,
      foldersCreated: p.foldersCreated,
      failures: p.failures ?? [],
    });
    deliveryFilesCount = p.filesCopied;
    deliveryFoldersCount = p.foldersCreated;
    if (p.failures && p.failures.length > 0) {
      deliveryFailures = JSON.stringify(p.failures);
    }
  }

  const payload: DeliveryWritePayloadSuccess = {
    kind: 'success',
    deliveryStatus: 'Delivered',
    deliveredAt: now,
    deliveredCheckbox: true,
    deliveredFolderId,
    deliveredFolderUrl,
    deliverySummary,
    deliveryError: '',
    readyToDeliverWebhook: false,
    ...(deliveryFilesCount !== undefined && { deliveryFilesCount }),
    ...(deliveryFoldersCount !== undefined && { deliveryFoldersCount }),
    ...(deliveryFailures !== undefined && { deliveryFailures }),
  };

  const result = await writeDeliveryToRecord(
    CREATIVE_REVIEW_ASSET_STATUS_TABLE,
    recordId,
    payload
  );
  if (!result.ok && result.error) {
    throw new Error(result.error);
  }
}

/**
 * Update Creative Review Asset Status record on delivery failure.
 * Uses field-alias aware write-back. Logs fields written.
 */
export async function updateAssetStatusDeliveryError(
  recordId: string,
  errorMessage: string
): Promise<void> {
  const truncated = String(errorMessage).slice(0, 1000);
  const payload: DeliveryWritePayloadError = {
    kind: 'error',
    deliveryStatus: 'Error',
    deliveryError: truncated,
  };
  const result = await writeDeliveryToRecord(
    CREATIVE_REVIEW_ASSET_STATUS_TABLE,
    recordId,
    payload
  );
  if (!result.ok && result.error) {
    throw new Error(result.error);
  }
}

/**
 * Update delivery error via field-alias aware write-back (fire-and-forget safe).
 * Use for fire-and-forget updates from webhook handlers so client disconnect doesn't abort the update.
 */
export async function updateAssetStatusDeliveryErrorFireAndForget(
  recordId: string,
  errorMessage: string,
  _signal?: AbortSignal
): Promise<void> {
  const truncated = String(errorMessage).slice(0, 1000);
  const payload: DeliveryWritePayloadError = {
    kind: 'error',
    deliveryStatus: 'Error',
    deliveryError: truncated,
  };
  const result = await writeDeliveryToRecord(
    CREATIVE_REVIEW_ASSET_STATUS_TABLE,
    recordId,
    payload
  );
  if (!result.ok && result.error) {
    console.warn('[reviewAssetDelivery] Fire-and-forget delivery error write failed:', result.error);
  }
}
