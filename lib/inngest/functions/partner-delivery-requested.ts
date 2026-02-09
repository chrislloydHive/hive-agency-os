// lib/inngest/functions/partner-delivery-requested.ts
// Event-driven partner delivery: triggered when an asset is approved
// Replaces cron-based polling with immediate event-driven processing

import { inngest } from '../client';
import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
} from '@/lib/airtable/reviewAssetDelivery';
import { getBase } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';
import { DELIVERY_BATCH_ID_FIELD } from '@/lib/airtable/reviewAssetStatus';
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
    concurrency: { limit: 5 }, // Match plan limit (was 10, reduced to 5)
  },
  { event: 'partner.delivery.requested' },
  async ({ event, step }) => {
    // FIRST-LINE log (must be first statement in handler)
    console.log(`[inngest/partnerDelivery] START`, {
      name: event.name,
      requestId: event.data?.requestId,
      crasRecordId: event.data?.crasRecordId,
      batchId: event.data?.batchId ?? event.data?.deliveryBatchId,
    });
    
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

        // Resolve destination folder from batch (use batchId from event, or fetch from record if needed)
        let deliveryBatchIdRaw = batchId;
        if (!deliveryBatchIdRaw) {
          // Fallback: fetch batch ID from Airtable record
          try {
            const base = getBase();
            const airtableRecord = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(crasRecordId);
            const batchRaw = airtableRecord.fields[DELIVERY_BATCH_ID_FIELD];
            if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
              deliveryBatchIdRaw = (batchRaw[0] as string).trim();
            } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
              deliveryBatchIdRaw = (batchRaw as string).trim();
            }
          } catch (fetchErr) {
            console.warn(`[partner-delivery-requested] Failed to fetch batch ID from record:`, fetchErr);
          }
        }
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

        // Get source folder ID from record (driveFileId is the Source Folder ID field)
        const sourceFolderId = record.driveFileId;
        if (!sourceFolderId) {
          console.error(`[partner-delivery-requested] No source folder ID for record ${crasRecordId}`);
          return {
            ok: false,
            error: `No source folder ID found for record ${crasRecordId}`,
            crasRecordId,
          };
        }

        console.log(`[partner-delivery-requested] Resolved: sourceFolderId=${sourceFolderId}, destinationFolderId=${destinationFolderId}`);
        
        // Log before calling delivery
        console.log(`[inngest/partnerDelivery] calling delivery`, {
          requestId,
          crasRecordId,
          deliveryBatchId: deliveryBatchIdRaw,
        });
        
        console.log(`[partner-delivery-requested] About to call runPartnerDelivery:`, {
          crasRecordId,
          sourceFolderId,
          deliveryBatchId: deliveryBatchIdRaw,
          destinationFolderId,
          hasOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
        });

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

        console.log(`[partner-delivery-requested] runPartnerDelivery completed:`, {
          ok: deliveryResult.ok,
          result: deliveryResult.result,
          error: 'error' in deliveryResult ? deliveryResult.error : undefined,
          authMode: 'authMode' in deliveryResult ? deliveryResult.authMode : undefined,
        });

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
