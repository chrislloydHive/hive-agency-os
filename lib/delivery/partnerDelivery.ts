// lib/delivery/partnerDelivery.ts
// Core partner delivery logic: resolve destination, copy file, update Airtable.
// Used by POST /api/delivery/partner and /api/delivery/partner/test.

import { copyFileToFolder } from '@/lib/google/driveClient';
import { getDestinationFolderIdByBatchId } from '@/lib/airtable/partnerDeliveryBatches';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
  updateAssetStatusDeliverySuccess,
  updateAssetStatusDeliveryError,
} from '@/lib/airtable/reviewAssetDelivery';

export type PartnerDeliveryResult =
  | { ok: true; deliveredFileUrl: string; result: 'ok' }
  | { ok: true; dryRun: true; resolvedDestinationFolderId: string; wouldCopyFileId: string; result: 'dry_run' }
  | { ok: true; deliveredFileUrl: string; result: 'idempotent' }
  | { ok: false; error: string; statusCode: 400 | 404 | 500; result: 'error' };

export interface PartnerDeliveryParams {
  airtableRecordId: string;
  driveFileId: string;
  deliveryBatchId?: string;
  destinationFolderId?: string;
  dryRun?: boolean;
}

export interface PartnerDeliveryLog {
  requestId: string;
  airtableRecordId: string;
  driveFileId: string;
  destinationFolderId: string | null;
  dryRun: boolean;
  result: 'ok' | 'dry_run' | 'idempotent' | 'error';
  error?: string;
}

function logStructured(log: PartnerDeliveryLog): void {
  const payload: Record<string, unknown> = {
    requestId: log.requestId,
    airtableRecordId: log.airtableRecordId,
    driveFileId: log.driveFileId,
    destinationFolderId: log.destinationFolderId,
    dryRun: log.dryRun,
    result: log.result,
  };
  if (log.error != null) payload.error = log.error;
  console.log('[delivery/partner]', JSON.stringify(payload));
}

/**
 * Run partner delivery: validate, resolve destination, optionally copy and update Airtable.
 * When dryRun is true: no copy, no Airtable updates; returns resolvedDestinationFolderId and wouldCopyFileId.
 */
export async function runPartnerDelivery(
  params: PartnerDeliveryParams,
  requestId: string
): Promise<PartnerDeliveryResult> {
  const { airtableRecordId, driveFileId, deliveryBatchId, destinationFolderId: paramDestinationFolderId, dryRun = false } = params;

  let destinationFolderId = (paramDestinationFolderId ?? '').trim();
  if (!destinationFolderId && (deliveryBatchId ?? '').trim()) {
    const fromBatch = await getDestinationFolderIdByBatchId((deliveryBatchId ?? '').trim());
    destinationFolderId = fromBatch ?? '';
  }

  const fail = (error: string, statusCode: 400 | 404 | 500, updateAirtable: boolean): PartnerDeliveryResult => {
    if (!dryRun && updateAirtable) {
      updateAssetStatusDeliveryError(airtableRecordId, error).catch((e) =>
        console.error(`[delivery/partner] ${requestId} Failed to update Airtable error:`, e)
      );
    }
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId: destinationFolderId || null,
      dryRun,
      result: 'error',
      error,
    });
    return { ok: false, error, statusCode, result: 'error' };
  };

  if (!driveFileId) {
    return fail('Missing driveFileId', 400, true);
  }

  if (!destinationFolderId) {
    return fail(
      'Missing destination folder: set destinationFolderId in the webhook payload or configure Destination Folder ID for the batch in Partner Delivery Batches',
      400,
      true
    );
  }

  if (dryRun) {
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: true,
      result: 'dry_run',
    });
    return {
      ok: true,
      dryRun: true,
      resolvedDestinationFolderId: destinationFolderId,
      wouldCopyFileId: driveFileId,
      result: 'dry_run',
    };
  }

  let record: Awaited<ReturnType<typeof getAssetStatusRecordById>>;
  try {
    record = await getAssetStatusRecordById(airtableRecordId);
  } catch (e) {
    console.error(`[delivery/partner] ${requestId} getAssetStatusRecordById failed:`, e);
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'error',
      error: e instanceof Error ? e.message : 'Failed to load record',
    });
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to load record', statusCode: 500, result: 'error' };
  }

  if (!record) {
    return fail(`Airtable record not found: ${airtableRecordId}`, 404, false);
  }

  if (isAlreadyDelivered(record)) {
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'idempotent',
    });
    return {
      ok: true,
      deliveredFileUrl: record.deliveredFileUrl ?? '',
      result: 'idempotent',
    };
  }

  try {
    const result = await copyFileToFolder(driveFileId, destinationFolderId);
    await updateAssetStatusDeliverySuccess(airtableRecordId, result.url);
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'ok',
    });
    return { ok: true, deliveredFileUrl: result.url, result: 'ok' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(message, 500, true);
  }
}
