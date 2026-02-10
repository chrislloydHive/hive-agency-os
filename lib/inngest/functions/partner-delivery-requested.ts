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
  getBatchDetails,
  listBatchesByProjectId,
} from '@/lib/airtable/partnerDeliveryBatches';
import {
  getDriveClient,
  ensureChildFolderWithDrive,
  copyDriveFolderTree,
} from '@/lib/google/driveClient';

/**
 * Resolve destination folder ID for a CRAS record's batch reference.
 * Returns both destination folder ID and batch record ID for logging.
 * Includes fallback to project-based batch lookup when name lookup fails.
 */
async function resolveDestinationFolderId(
  deliveryBatchIdRaw: string,
  batchRecordIdFromCras?: string | null,
  projectIdFromCras?: string | null
): Promise<{ destinationFolderId: string | null; batchRecordId: string | null; error?: string }> {
  const raw = deliveryBatchIdRaw.trim();
  if (!raw) return { destinationFolderId: null, batchRecordId: null, error: 'Empty batch identifier' };

  // If we already have a record ID from CRAS, use it directly
  if (batchRecordIdFromCras && batchRecordIdFromCras.startsWith('rec')) {
    const details = await getBatchDetailsByRecordId(batchRecordIdFromCras);
    console.log("[delivery/destination] RESOLVED from CRAS link", {
      batchId: deliveryBatchIdRaw,
      batchRecordId: batchRecordIdFromCras,
      destinationFolderId: details?.destinationFolderId || null,
      destinationFolderUrl: details?.destinationFolderId ? `https://drive.google.com/drive/folders/${details.destinationFolderId}` : null,
      source: 'CRAS link field',
      fieldRead: 'Destination Folder ID',
    });
    return {
      destinationFolderId: details?.destinationFolderId ?? null,
      batchRecordId: batchRecordIdFromCras,
      error: details ? undefined : `Batch record not found: ${batchRecordIdFromCras}`,
    };
  }

  // If batchId is already a record ID, use it
  if (raw.startsWith('rec')) {
    const details = await getBatchDetailsByRecordId(raw);
    console.log("[delivery/destination] RESOLVED from batchId record ID", {
      batchId: deliveryBatchIdRaw,
      batchRecordId: raw,
      destinationFolderId: details?.destinationFolderId || null,
      destinationFolderUrl: details?.destinationFolderId ? `https://drive.google.com/drive/folders/${details.destinationFolderId}` : null,
      source: 'batchId is record ID',
      fieldRead: 'Destination Folder ID',
    });
    return {
      destinationFolderId: details?.destinationFolderId ?? null,
      batchRecordId: raw,
      error: details ? undefined : `Batch record not found: ${raw}`,
    };
  }

  // Otherwise, it's a Batch ID name string - look it up
  let details = await getBatchDetails(raw);
  console.log("[delivery/destination] RESOLVED from Batch ID name", {
    batchId: raw,
    batchRecordId: details?.recordId || null,
    destinationFolderId: details?.destinationFolderId || null,
    destinationFolderUrl: details?.destinationFolderId ? `https://drive.google.com/drive/folders/${details.destinationFolderId}` : null,
    source: 'Batch ID name lookup',
    fieldRead: 'Destination Folder ID',
    warning: details ? undefined : `Batch not found by name "${raw}" - batch may have been renamed`,
  });
  
  // If name lookup failed and we have a project ID, try fallback: find batches for project
  if (!details && projectIdFromCras && projectIdFromCras.trim()) {
    console.log("[delivery/destination] Name lookup failed, trying project-based fallback", {
      batchId: raw,
      projectId: projectIdFromCras,
    });
    
    try {
      const projectBatches = await listBatchesByProjectId(projectIdFromCras);
      // Prefer active batches, then most recent
      const activeBatches = projectBatches.filter(b => b.status?.toLowerCase() === 'active');
      const batchesToCheck = activeBatches.length > 0 ? activeBatches : projectBatches;
      
      if (batchesToCheck.length === 1) {
        // Only one batch for this project - use it
        const fallbackBatch = batchesToCheck[0];
        console.log("[delivery/destination] Found single batch for project (fallback)", {
          batchId: raw,
          projectId: projectIdFromCras,
          fallbackBatchRecordId: fallbackBatch.batchRecordId,
          fallbackBatchId: fallbackBatch.batchId,
          destinationFolderId: fallbackBatch.destinationFolderId,
        });
        return {
          destinationFolderId: fallbackBatch.destinationFolderId,
          batchRecordId: fallbackBatch.batchRecordId,
        };
      } else if (batchesToCheck.length > 1) {
        // Multiple batches - can't auto-resolve
        console.warn("[delivery/destination] Multiple batches found for project, cannot auto-resolve", {
          batchId: raw,
          projectId: projectIdFromCras,
          batchCount: batchesToCheck.length,
          batchIds: batchesToCheck.map(b => b.batchId),
        });
        return {
          destinationFolderId: null,
          batchRecordId: null,
          error: `Batch not found by name "${raw}" and project has ${batchesToCheck.length} batches. Please update CRAS record to use Partner Delivery Batch link field (record ID) instead of Batch ID text field.`,
        };
      }
    } catch (projectErr) {
      console.warn("[delivery/destination] Project-based fallback failed", {
        batchId: raw,
        projectId: projectIdFromCras,
        error: projectErr instanceof Error ? projectErr.message : String(projectErr),
      });
    }
  }
  
  if (!details) {
    return {
      destinationFolderId: null,
      batchRecordId: null,
      error: `Batch not found by name "${raw}". Batch may have been renamed - ensure CRAS records use Partner Delivery Batch link field (record ID) instead of Batch ID text field.${projectIdFromCras ? ` Tried project-based fallback but no single batch found for project ${projectIdFromCras}.` : ''}`,
    };
  }

  console.log("[delivery/destination] FINAL RESOLUTION", {
    batchId: raw,
    batchRecordId: details.recordId,
    destinationFolderId: details.destinationFolderId,
    destinationFolderUrl: `https://drive.google.com/drive/folders/${details.destinationFolderId}`,
    fieldRead: 'Destination Folder ID',
  });
  return {
    destinationFolderId: details.destinationFolderId,
    batchRecordId: details.recordId,
  };
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
      batchRecordId: event.data?.batchRecordId,
    });
    
    const { crasRecordId, batchId, batchRecordId: eventBatchRecordId, requestId, triggeredBy } = event.data;
    
    // Log batchRecordId presence for debugging
    console.log(`[partner-delivery-requested] batchRecordId check:`, {
      hasBatchRecordId: !!eventBatchRecordId,
      batchRecordId: eventBatchRecordId,
      batchId,
      willUseRecordId: eventBatchRecordId && eventBatchRecordId.startsWith('rec'),
    });
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

        // Resolve destination folder from batch
        // Priority: 1) batchRecordId from event, 2) batchId from event, 3) fetch from CRAS record
        let deliveryBatchIdRaw: string | null = null;
        let batchRecordIdFromCras: string | null = null;
        let projectIdFromCras: string | null = null;
        
        // If we have batchRecordId from event, use it directly (preferred)
        if (eventBatchRecordId && eventBatchRecordId.startsWith('rec')) {
          batchRecordIdFromCras = eventBatchRecordId;
          deliveryBatchIdRaw = eventBatchRecordId;
          console.log(`[partner-delivery-requested] Using batchRecordId from event: ${batchRecordIdFromCras}`);
        } else if (batchId) {
          // Fallback to batchId from event (might be a name string)
          deliveryBatchIdRaw = batchId;
          console.log(`[partner-delivery-requested] Using batchId from event: ${batchId}`);
        } else {
          // Last resort: fetch batch ID from Airtable record
          try {
            const base = getBase();
            const airtableRecord = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(crasRecordId);
            const batchRaw = airtableRecord.fields[DELIVERY_BATCH_ID_FIELD];
            if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
              // It's a linked record - use the record ID directly
              batchRecordIdFromCras = (batchRaw[0] as string).trim();
              deliveryBatchIdRaw = batchRecordIdFromCras;
              console.log(`[partner-delivery-requested] Fetched batchRecordId from CRAS record: ${batchRecordIdFromCras}`);
            } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
              // It's a text field (Batch ID name)
              deliveryBatchIdRaw = (batchRaw as string).trim();
              console.log(`[partner-delivery-requested] Fetched batchId from CRAS record: ${deliveryBatchIdRaw}`);
            }
            
            // Also get Project ID for fallback batch resolution
            const projectRaw = airtableRecord.fields['Project'];
            if (Array.isArray(projectRaw) && projectRaw.length > 0 && typeof projectRaw[0] === 'string') {
              projectIdFromCras = (projectRaw[0] as string).trim();
            } else if (typeof projectRaw === 'string' && projectRaw.trim()) {
              projectIdFromCras = (projectRaw as string).trim();
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

        // Resolve destination folder - prefer record ID lookup for stability
        const destinationResult = await resolveDestinationFolderId(
          deliveryBatchIdRaw,
          batchRecordIdFromCras,
          projectIdFromCras
        );
        if (!destinationResult.destinationFolderId) {
          console.error(`[partner-delivery-requested] Could not resolve destination for batch: ${deliveryBatchIdRaw}`, {
            batchRecordId: destinationResult.batchRecordId,
            error: destinationResult.error,
          });
          return {
            ok: false,
            error: `Could not resolve destination for batch: ${deliveryBatchIdRaw}${destinationResult.batchRecordId ? ` (record ID: ${destinationResult.batchRecordId})` : ''}${destinationResult.error ? `. ${destinationResult.error}` : ''}`,
            crasRecordId,
          };
        }
        const destinationFolderId = destinationResult.destinationFolderId;
        const batchRecordId = destinationResult.batchRecordId;

        // Log resolved destination folder
        console.log(`[delivery/destination] RESOLVED`, {
          destinationFolderId,
          batchRecordId,
          batchId: deliveryBatchIdRaw,
          destinationFolderUrl: `https://drive.google.com/drive/folders/${destinationFolderId}`,
        });

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
        console.log(`[delivery/copy] ASSET_TO_COPY`, {
          crasRecordId,
          sourceId: sourceFolderId,
          sourceUrl: `https://drive.google.com/drive/folders/${sourceFolderId}`,
          destFolderId: destinationFolderId,
          destFolderUrl: `https://drive.google.com/drive/folders/${destinationFolderId}`,
        });
        
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
            const deliveredFolderId = 'deliveredRootFolderId' in deliveryResult ? deliveryResult.deliveredRootFolderId : undefined;
            console.log(`[partner-delivery-requested] Record ${crasRecordId} delivered successfully: url=${fileUrl ?? 'none'}`);
            console.log(`[delivery/copy] FINAL_RESULT`, {
              crasRecordId,
              deliveredFolderId,
              deliveredFolderUrl: fileUrl,
              filesCopied: 'filesCopied' in deliveryResult ? deliveryResult.filesCopied : undefined,
              foldersCreated: 'foldersCreated' in deliveryResult ? deliveryResult.foldersCreated : undefined,
            });
            
            // Add production assets delivery (after approved deliverables)
            // Only proceed if we have a deliveredRootFolderId (not dry-run or idempotent)
            if ('deliveredRootFolderId' in deliveryResult && deliveryResult.deliveredRootFolderId) {
              const productionAssetsResult = await addProductionAssets({
                deliveryRootFolderId: deliveryResult.deliveredRootFolderId,
                batchId: deliveryBatchIdRaw,
                requestId: requestId || `event-${crasRecordId.slice(-8)}`,
              });
              
              if (!productionAssetsResult.ok) {
                console.warn(`[partner-delivery-requested] Production assets delivery failed (non-blocking):`, productionAssetsResult.error);
              }
            }
            
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

/**
 * Add production assets to partner delivery package.
 * Copies animated display production assets from source folder to _Production Assets/Animated Display.
 * Non-blocking: logs warnings but does not fail delivery if this step fails.
 */
async function addProductionAssets(params: {
  deliveryRootFolderId: string;
  batchId: string;
  requestId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { deliveryRootFolderId, batchId, requestId } = params;
  
  console.log(`[delivery/partner] production assets start`, { batchId, requestId });
  
  // Check if production assets folder ID is configured
  const sourceFolderId = process.env.PROSPECTING_ANIMATED_PROD_ASSETS_FOLDER_ID?.trim();
  if (!sourceFolderId) {
    console.warn(`[delivery/skip] missing folder config`, {
      envVarName: 'PROSPECTING_ANIMATED_PROD_ASSETS_FOLDER_ID',
      assetType: 'Animated Display Production Assets',
      batchRecordId: batchId,
    });
    return { ok: true }; // Not an error - just not configured
  }
  
  try {
    // Get Drive client (use WIF/OIDC like the main delivery)
    const drive = await getDriveClient({
      vercelOidcToken: process.env.VERCEL_OIDC_TOKEN ?? null,
    });
    
    // Ensure destination folder structure: _Production Assets/Animated Display
    const productionAssetsRoot = await ensureChildFolderWithDrive(
      drive,
      deliveryRootFolderId,
      '_Production Assets'
    );
    
    console.log(`[delivery/partner] production assets destination ready`, {
      sourceFolderId,
      destParentFolderId: productionAssetsRoot.id,
      destPath: '_Production Assets/Animated Display',
    });
    
    // Copy all files and subfolders from source to destination
    // copyDriveFolderTree will create/reuse "Animated Display" folder inside _Production Assets
    const copyResult = await copyDriveFolderTree(
      drive,
      sourceFolderId,
      productionAssetsRoot.id,
      {
        deliveredFolderName: 'Animated Display',
        drive,
      }
    );
    
    console.log(`[delivery/partner] production assets copied`, {
      sourceFolderId,
      destParentFolderId: productionAssetsRoot.id,
      fileCount: copyResult.filesCopied,
      foldersCreated: copyResult.foldersCreated,
      failures: copyResult.failures.length,
    });
    
    if (copyResult.filesCopied === 0) {
      console.warn(`[delivery/partner] Production assets folder is empty or inaccessible: ${sourceFolderId}`);
    }
    
    if (copyResult.failures.length > 0) {
      console.warn(`[delivery/partner] Production assets copy had ${copyResult.failures.length} failures:`, copyResult.failures);
    }
    
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[delivery/partner] Production assets delivery failed (non-blocking):`, errorMessage);
    // Return ok: false but don't throw - this is non-blocking
    return { ok: false, error: errorMessage };
  }
}
