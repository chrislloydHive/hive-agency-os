// lib/inngest/functions/partner-delivery-requested.ts
// Event-driven partner delivery: triggered when an asset is approved
// Replaces cron-based polling with immediate event-driven processing

import { inngest } from '../client';
import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
} from '@/lib/airtable/reviewAssetDelivery';
import {
  getDestinationFolderIdByBatchId,
  getBatchDetailsByRecordId,
} from '@/lib/airtable/partnerDeliveryBatches';

/**
 * Resolve destination folder ID for a CRAS record's batch reference.
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

export const partnerDeliveryRequested = inngest.createFunction(
  {
    id: 'partner-delivery-requested',
    name: 'Partner Delivery Requested (Event-Driven)',
    retries: 3,
    concurrency: { limit: 10 }, // Allow multiple deliveries in parallel
  },
  { event: 'partner.delivery.requested' },
  async ({ event, step }) => {
    const { crasRecordId, batchId, requestId, triggeredBy } = event.data;
    // Log execution trace: eventId is unique per execution (retries get new eventId)
    console.log(`[delivery-run] fn=partner-delivery-requested event=${event.name} eventId=${event.id} cras=${crasRecordId}`);
    console.log(`[delivery-trigger] approval-event: crasRecordId=${crasRecordId}, requestId=${requestId}, triggeredBy=${triggeredBy}`);
    console.log(`[partner-delivery-requested] ⚡ Event received: crasRecordId=${crasRecordId}, requestId=${requestId}, triggeredBy=${triggeredBy}`);

    return await step.run('load-record', async () => {
      try {
        // Load CRAS record
        const record = await getAssetStatusRecordById(crasRecordId);
        if (!record) {
          console.error(`[partner-delivery-requested] Record not found: ${crasRecordId}`);
          return {
            ok: false,
            error: `CRAS record not found: ${crasRecordId}`,
            crasRecordId,
          };
        }

        // Idempotency check: skip if already delivered
        if (isAlreadyDelivered(record)) {
          console.log(`[partner-delivery-requested] Record ${crasRecordId} already delivered (idempotent skip)`);
          return {
            ok: true,
            result: 'idempotent',
            crasRecordId,
            deliveredFileUrl: record.deliveredFileUrl ?? '',
          };
        }

        // Verify approval status (optional check, proceed anyway if approved is true)
        if (!record.assetApprovedClient) {
          console.warn(`[partner-delivery-requested] Record ${crasRecordId} not approved, but proceeding with delivery`);
        }

        // Resolve destination folder from batch
        const deliveryBatchIdRaw = record.deliveryBatchId ?? batchId;
        if (!deliveryBatchIdRaw) {
          console.error(`[partner-delivery-requested] No delivery batch ID for record ${crasRecordId}`);
          return {
            ok: false,
            error: `No delivery batch ID found for record ${crasRecordId}`,
            crasRecordId,
          };
        }

        const destinationFolderId = await resolveDestinationFolderId(deliveryBatchIdRaw);
        if (!destinationFolderId) {
          console.error(`[partner-delivery-requested] Could not resolve destination for batch: ${deliveryBatchIdRaw}`);
          return {
            ok: false,
            error: `Could not resolve destination for batch: ${deliveryBatchIdRaw}`,
            crasRecordId,
          };
        }

        // Get source folder ID from record
        const sourceFolderId = record.sourceFolderId;
        if (!sourceFolderId) {
          console.error(`[partner-delivery-requested] No source folder ID for record ${crasRecordId}`);
          return {
            ok: false,
            error: `No source folder ID found for record ${crasRecordId}`,
            crasRecordId,
          };
        }

        console.log(`[partner-delivery-requested] Resolved: sourceFolderId=${sourceFolderId}, destinationFolderId=${destinationFolderId}`);

        // Run delivery
        const deliveryResult = await runPartnerDelivery(
          {
            airtableRecordId: crasRecordId,
            sourceFolderId,
            deliveryBatchId: deliveryBatchIdRaw,
            destinationFolderId,
            dryRun: false,
            oidcToken: process.env.VERCEL_OIDC_TOKEN ?? undefined,
          },
          requestId || `event-${crasRecordId.slice(-8)}`
        );

        if (deliveryResult.ok) {
          if (deliveryResult.result === 'idempotent') {
            console.log(`[partner-delivery-requested] Record ${crasRecordId} delivery skipped (idempotent)`);
            return {
              ok: true,
              result: 'idempotent',
              crasRecordId,
              deliveredFileUrl: deliveryResult.deliveredFileUrl,
            };
          } else {
            const fileUrl = 'deliveredFileUrl' in deliveryResult ? deliveryResult.deliveredFileUrl : undefined;
            console.log(`[partner-delivery-requested] Record ${crasRecordId} delivered successfully: url=${fileUrl ?? 'none'}`);
            return {
              ok: true,
              result: 'delivered',
              crasRecordId,
              deliveredFileUrl: fileUrl,
              authMode: deliveryResult.authMode,
            };
          }
        } else {
          console.error(`[partner-delivery-requested] Record ${crasRecordId} delivery failed: ${deliveryResult.error}`);
          return {
            ok: false,
            error: deliveryResult.error,
            crasRecordId,
            authMode: deliveryResult.authMode,
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error(`[partner-delivery-requested] ❌ Error processing ${crasRecordId}:`, message);
        if (stack) {
          console.error(`[partner-delivery-requested] Error stack:`, stack);
        }
        throw err; // Let Inngest handle retries
      }
    });
  }
);
