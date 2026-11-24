/**
 * Copy one approved CRAS asset into its Partner Delivery Batch destination.
 * Runs in the request that called POST /api/delivery/partner/approved.
 * Does not enqueue Inngest: that event was accepted and never started a run,
 * so the HTTP handler has to do the copy and report the real status.
 */

import { getBatchDetailsByRecordId } from '@/lib/airtable/partnerDeliveryBatches';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
  updateAssetStatusDeliveryError,
} from '@/lib/airtable/reviewAssetDelivery';
import { folderUrl } from '@/lib/google/driveClient';
import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';

export interface DeliverApprovedCrasInput {
  crasRecordId: string;
  batchRecordId: string;
  requestId: string;
}

export type DeliverApprovedCrasResult =
  | {
      ok: true;
      requestId: string;
      result: 'delivered' | 'idempotent';
      deliveredFileUrl?: string;
      deliveredFolderUrl?: string;
      deliveredFolderId?: string;
    }
  | {
      ok: false;
      error: string;
      statusCode: 400 | 404 | 422 | 500;
    };

async function writeFailure(crasRecordId: string, error: string): Promise<void> {
  try {
    await updateAssetStatusDeliveryError(crasRecordId, error);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deliverApprovedCras] Failed to write Delivery Error for ${crasRecordId}: ${message}`);
  }
}

/**
 * Copy the CRAS source file (or folder) into the batch destination.
 * A file is placed at {destination}/{Tactic}/{Variant}/{filename}, using the
 * source Drive parents (for example PMAX/Prospecting). Production Folder ID
 * is not required. The batch destination is already the partner production
 * folder, so no extra project folder is created.
 */
export async function deliverApprovedCras(
  input: DeliverApprovedCrasInput
): Promise<DeliverApprovedCrasResult> {
  const { crasRecordId, batchRecordId, requestId } = input;

  const record = await getAssetStatusRecordById(crasRecordId);
  if (!record) {
    const error = `CRAS record not found: ${crasRecordId}`;
    console.error(`[deliverApprovedCras] ${error}`);
    return { ok: false, error, statusCode: 404 };
  }

  if (isAlreadyDelivered(record)) {
    console.log(`[deliverApprovedCras] ${crasRecordId} already delivered`);
    return {
      ok: true,
      requestId,
      result: 'idempotent',
      deliveredFileUrl: record.deliveredFileUrl ?? '',
    };
  }

  const sourceFolderId = record.driveFileId;
  if (!sourceFolderId) {
    const error = `No Source Folder ID on CRAS ${crasRecordId}. Production Folder ID is not used for this copy.`;
    console.error(`[deliverApprovedCras] ${error}`);
    await writeFailure(crasRecordId, error);
    return { ok: false, error, statusCode: 422 };
  }

  const batch = await getBatchDetailsByRecordId(batchRecordId);
  if (!batch?.destinationFolderId) {
    const error = `Partner Delivery Batch ${batchRecordId} is missing Destination Folder ID`;
    console.error(`[deliverApprovedCras] ${error}`);
    await writeFailure(crasRecordId, error);
    return { ok: false, error, statusCode: 422 };
  }

  console.log('[deliverApprovedCras] start', {
    requestId,
    crasRecordId,
    batchRecordId,
    sourceId: sourceFolderId,
    destinationFolderId: batch.destinationFolderId,
    tactic: record.tactic,
    variant: record.variant,
    productionFolderIdRequired: false,
  });

  let deliveryResult: Awaited<ReturnType<typeof runPartnerDelivery>>;
  try {
    deliveryResult = await runPartnerDelivery(
      {
        airtableRecordId: crasRecordId,
        sourceFolderId,
        deliveryBatchId: batchRecordId,
        destinationFolderId: batch.destinationFolderId,
        dryRun: false,
        // Omit projectName. The destination folder is the partner production
        // folder; tactic/variant (PMAX/Prospecting, …) are created directly under it.
        oidcToken: process.env.VERCEL_OIDC_TOKEN ?? undefined,
      },
      requestId
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = `Partner delivery failed: ${message}`;
    console.error(`[deliverApprovedCras] ${error}`);
    await writeFailure(crasRecordId, error);
    return { ok: false, error, statusCode: 500 };
  }

  if (!deliveryResult.ok) {
    console.error('[deliverApprovedCras] failed', {
      requestId,
      crasRecordId,
      error: deliveryResult.error,
      statusCode: deliveryResult.statusCode,
    });
    return {
      ok: false,
      error: deliveryResult.error,
      statusCode: deliveryResult.statusCode,
    };
  }

  if (deliveryResult.result === 'idempotent') {
    return {
      ok: true,
      requestId,
      result: 'idempotent',
      deliveredFileUrl: deliveryResult.deliveredFileUrl,
    };
  }

  if (deliveryResult.result === 'dry_run') {
    return {
      ok: false,
      error: 'Delivery was invoked as a dry run',
      statusCode: 500,
    };
  }

  const deliveredFolderId = deliveryResult.deliveredRootFolderId;
  const deliveredFolderUrl = deliveredFolderId ? folderUrl(deliveredFolderId) : undefined;
  console.log('[deliverApprovedCras] delivered', {
    requestId,
    crasRecordId,
    deliveredFileUrl: deliveryResult.deliveredFileUrl,
    deliveredFolderId,
    deliveredFolderUrl,
    filesCopied: deliveryResult.filesCopied,
    foldersCreated: deliveryResult.foldersCreated,
  });

  return {
    ok: true,
    requestId,
    result: 'delivered',
    deliveredFileUrl: deliveryResult.deliveredFileUrl,
    deliveredFolderUrl,
    deliveredFolderId,
  };
}
