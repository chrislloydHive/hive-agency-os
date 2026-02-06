// lib/delivery/runPendingDeliveries.ts
// Backend worker: process CRAS records where Ready to Deliver (Webhook) = true.
// Airtable only sets flags; this job runs delivery (same code path as POST /api/delivery/partner legacy mode).
// Idempotent: skips already-delivered records; safe to re-run.

import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';
import { getPendingWebhookDeliveryRecords } from '@/lib/airtable/reviewAssetStatus';
import {
  getDestinationFolderIdByBatchId,
  getBatchDetailsByRecordId,
} from '@/lib/airtable/partnerDeliveryBatches';

export interface PendingDeliveryRunResult {
  recordId: string;
  ok: boolean;
  error?: string;
  deliveredFileUrl?: string;
  authMode?: string;
}

export interface RunPendingDeliveriesResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: PendingDeliveryRunResult[];
}

/**
 * Resolve destination folder ID for a CRAS record's batch reference.
 * deliveryBatchIdRaw can be Batch ID string (e.g. "Batch 1") or Partner Delivery Batches record id (recXXX).
 */
async function resolveDestinationFolderId(deliveryBatchIdRaw: string): Promise<string | null> {
  const raw = deliveryBatchIdRaw.trim();
  if (!raw) return null;

  if (raw.startsWith('rec')) {
    const details = await getBatchDetailsByRecordId(raw);
    return details?.destinationFolderId ?? null;
  }
  return getDestinationFolderIdByBatchId(raw);
}

/**
 * Run delivery for all CRAS records where Ready to Deliver (Webhook) = true and not yet delivered.
 * Uses WIF/service account (no OAuth token). Writes back to CRAS: Delivered?, Delivered At,
 * Delivered File/Folder URL, Delivery Status, clears Ready to Deliver (Webhook); on failure writes Delivery Error.
 * Idempotent: runPartnerDelivery skips records already delivered; safe to re-run after partial failures.
 */
export async function runPendingDeliveries(options?: {
  /** Optional OIDC token when running in Vercel with GCP WIF (e.g. from cron). */
  oidcToken?: string | null;
}): Promise<RunPendingDeliveriesResult> {
  const requestId = `pending-${Date.now().toString(36)}`;
  const pending = await getPendingWebhookDeliveryRecords();
  const results: PendingDeliveryRunResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    const destinationFolderId = await resolveDestinationFolderId(row.deliveryBatchIdRaw);
    if (!destinationFolderId) {
      results.push({
        recordId: row.recordId,
        ok: false,
        error: `Could not resolve destination for batch: ${row.deliveryBatchIdRaw}`,
      });
      failed++;
      continue;
    }

    const deliveryResult = await runPartnerDelivery(
      {
        airtableRecordId: row.recordId,
        sourceFolderId: row.sourceFolderId,
        deliveryBatchId: row.deliveryBatchIdRaw,
        destinationFolderId,
        dryRun: false,
        oidcToken: options?.oidcToken ?? undefined,
      },
      `${requestId}-${row.recordId}`
    );

    if (deliveryResult.ok) {
      if (deliveryResult.result === 'idempotent') {
        results.push({
          recordId: row.recordId,
          ok: true,
          deliveredFileUrl: deliveryResult.deliveredFileUrl,
        });
        skipped++;
      } else {
        results.push({
          recordId: row.recordId,
          ok: true,
          deliveredFileUrl: 'deliveredFileUrl' in deliveryResult ? deliveryResult.deliveredFileUrl : undefined,
          authMode: deliveryResult.authMode,
        });
        succeeded++;
      }
    } else {
      results.push({
        recordId: row.recordId,
        ok: false,
        error: deliveryResult.error,
        authMode: deliveryResult.authMode,
      });
      failed++;
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}
