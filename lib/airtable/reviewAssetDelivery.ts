// lib/airtable/reviewAssetDelivery.ts
// Get and update Creative Review Asset Status delivery fields (webhook flow).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

const DELIVERY_STATUS_FIELD = 'Delivery Status';
const DELIVERED_AT_FIELD = 'Delivered At';
const DELIVERED_FILE_URL_FIELD = 'Delivered File URL';
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
    const driveFileId = typeof f['Drive File ID'] === 'string' ? (f['Drive File ID'] as string).trim() : null;
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

/**
 * Update Creative Review Asset Status record on delivery success.
 */
export async function updateAssetStatusDeliverySuccess(
  recordId: string,
  deliveredFileUrl: string
): Promise<void> {
  const base = getBase();
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    [DELIVERY_STATUS_FIELD]: 'Delivered',
    [DELIVERED_AT_FIELD]: now,
    [DELIVERED_FILE_URL_FIELD]: deliveredFileUrl,
    [DELIVERY_ERROR_FIELD]: '',
    [READY_TO_DELIVER_WEBHOOK_FIELD]: false,
  };
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
