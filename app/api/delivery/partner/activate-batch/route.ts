// app/api/delivery/partner/activate-batch/route.ts
// POST: Batch activation endpoint - triggered when Make Active = true on Partner Delivery Batch.
// Gathers eligible CRAS records, links them to the batch, and triggers delivery.
// Auth: X-DELIVERY-SECRET must match DELIVERY_WEBHOOK_SECRET.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getBatchDetailsByRecordId } from '@/lib/airtable/partnerDeliveryBatches';
import {
  getEligibleForDelivery,
  linkRecordsToBatch,
  setDeliveryStatusDelivering,
  getBatchRecordsReadyForDelivery,
  markAssetDelivered,
  markAssetDeliveryFailed,
} from '@/lib/airtable/reviewAssetStatus';
import {
  copyFileToFolder,
  folderUrl,
  getDriveClientWithServiceAccount,
} from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const DELIVERY_SECRET_HEADER = 'x-delivery-secret';

function getRequestId(): string {
  return randomUUID();
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  const secret = process.env.DELIVERY_WEBHOOK_SECRET;
  const headerSecret = req.headers.get(DELIVERY_SECRET_HEADER)?.trim();

  if (!secret || headerSecret !== secret) {
    console.warn(`[activate-batch] ${requestId} Unauthorized: missing or invalid ${DELIVERY_SECRET_HEADER}`);
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    batchRecordId?: string;
    gatherEligible?: boolean;
    dryRun?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    console.warn(`[activate-batch] ${requestId} Invalid JSON`);
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const batchRecordId = (body.batchRecordId ?? '').toString().trim();
  const gatherEligible = body.gatherEligible === true;
  const dryRun = body.dryRun === true;

  if (!batchRecordId) {
    return NextResponse.json(
      { ok: false, error: 'Missing batchRecordId' },
      { status: 400, headers: NO_STORE }
    );
  }

  console.log(`[activate-batch] ${requestId} Starting batch activation`, {
    batchRecordId,
    gatherEligible,
    dryRun,
  });

  // Get batch details
  const batchDetails = await getBatchDetailsByRecordId(batchRecordId);
  if (!batchDetails) {
    return NextResponse.json(
      { ok: false, error: 'Batch not found' },
      { status: 404, headers: NO_STORE }
    );
  }

  const { destinationFolderId, deliveryBatchId: batchId } = batchDetails;
  if (!destinationFolderId) {
    return NextResponse.json(
      { ok: false, error: 'Batch has no destination folder configured' },
      { status: 400, headers: NO_STORE }
    );
  }

  console.log(`[activate-batch] ${requestId} Batch details`, {
    batchId,
    destinationFolderId,
  });

  // Step 1: If gatherEligible, find all eligible CRAS records and link them to this batch
  if (gatherEligible) {
    const eligibleRecords = await getEligibleForDelivery();
    console.log(`[activate-batch] ${requestId} Found ${eligibleRecords.length} eligible records`);

    if (eligibleRecords.length > 0 && !dryRun) {
      const recordIds = eligibleRecords.map((r) => r.recordId);
      const linkResult = await linkRecordsToBatch(recordIds, batchRecordId);
      console.log(`[activate-batch] ${requestId} Linked ${linkResult.updated} records to batch`);

      if (linkResult.error) {
        return NextResponse.json(
          { ok: false, error: `Failed to link records: ${linkResult.error}` },
          { status: 500, headers: NO_STORE }
        );
      }
    }
  }

  // Step 2: Get all CRAS records linked to this batch that are ready for delivery
  const recordsToDeliver = await getBatchRecordsReadyForDelivery(batchRecordId);
  console.log(`[activate-batch] ${requestId} ${recordsToDeliver.length} records ready for delivery`);

  if (recordsToDeliver.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        message: 'No records ready for delivery',
        batchId,
        dryRun,
      },
      { headers: NO_STORE }
    );
  }

  if (dryRun) {
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        batchId,
        recordCount: recordsToDeliver.length,
        records: recordsToDeliver.map((r) => ({
          recordId: r.recordId,
          driveFileId: r.driveFileId,
          filename: r.filename,
        })),
      },
      { headers: NO_STORE }
    );
  }

  // Step 3: Set Delivery Status = 'Delivering' on all records
  const recordIds = recordsToDeliver.map((r) => r.recordId);
  const statusResult = await setDeliveryStatusDelivering(recordIds);
  console.log(`[activate-batch] ${requestId} Set 'Delivering' status on ${statusResult.updated} records`);

  // Step 4: Execute delivery - copy each file to destination folder using service account
  const driveClient = getDriveClientWithServiceAccount();
  const results: Array<{
    recordId: string;
    driveFileId: string;
    success: boolean;
    error?: string;
    deliveredFileId?: string;
  }> = [];

  for (const record of recordsToDeliver) {
    try {
      console.log(`[activate-batch] ${requestId} Copying file ${record.driveFileId} (${record.filename})`);

      // Copy file to destination folder using service account
      const copyResult = await copyFileToFolder(
        record.driveFileId,
        destinationFolderId,
        { drive: driveClient, requestId }
      );

      // Mark as delivered (copyFileToFolder throws on error, so if we get here it's success)
      await markAssetDelivered(record.recordId, destinationFolderId, copyResult.url);
      results.push({
        recordId: record.recordId,
        driveFileId: record.driveFileId,
        success: true,
        deliveredFileId: copyResult.id,
      });

      console.log(`[activate-batch] ${requestId} Delivered file ${record.driveFileId} -> ${copyResult.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[activate-batch] ${requestId} Error delivering file ${record.driveFileId}:`, errorMessage);
      await markAssetDeliveryFailed(record.recordId, errorMessage);
      results.push({
        recordId: record.recordId,
        driveFileId: record.driveFileId,
        success: false,
        error: errorMessage,
      });
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`[activate-batch] ${requestId} Batch delivery complete`, {
    batchId,
    total: results.length,
    successful,
    failed,
  });

  return NextResponse.json(
    {
      ok: true,
      batchId,
      destinationFolderId,
      destinationFolderUrl: folderUrl(destinationFolderId),
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    },
    { headers: NO_STORE }
  );
}
