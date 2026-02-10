// lib/review/resolveDeliveryBatch.ts
// Shared logic for resolving deliveryBatchId and batchRecordId from CRAS Project link

import { getBase, getBaseId } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

export interface ResolvedDeliveryBatch {
  deliveryBatchId: string;
  batchRecordId: string;
}

/**
 * Resolve deliveryBatchId and batchRecordId from CRAS Project link → Partner Delivery Batches query.
 * Returns null if resolution fails or no batch found.
 */
export async function resolveDeliveryBatchFromCras(
  crasRecordId: string
): Promise<ResolvedDeliveryBatch | null> {
  try {
    const base = getBase();
    const baseId = getBaseId() || 'unknown';
    const record = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(crasRecordId);
    const fields = record.fields as Record<string, unknown>;
    
    // Get Project linked record(s) from CRAS
    const projectField = fields['Project'] as string[] | string | undefined;
    const projectIds = Array.isArray(projectField) ? projectField : (typeof projectField === 'string' ? [projectField] : []);
    
    if (projectIds.length === 0) {
      console.error(`[resolveDeliveryBatch] ❌ CRAS record ${crasRecordId} has no Project link`);
      return null;
    }
    
    // Use the first Project ID (CRAS should only link to one Project)
    const projectId = projectIds[0];
    console.log(`[resolveDeliveryBatch] CRAS record ${crasRecordId} links to Project: ${projectId}`);
    
    // Query Partner Delivery Batches table in the same base as CRAS
    const tableName = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;
    const projectLinkField = 'Project';
    
    // Optional coarse server-side filter for performance (Active or Delivering batches)
    const coarseFormula = 'OR({Status}="Active",{Status}="Delivering")';
    
    console.log(`[resolveDeliveryBatch] Querying Partner Delivery Batches:`, {
      baseId: `${baseId.substring(0, 20)}...`,
      tableName,
      projectId,
      coarseFormula,
    });
    
    try {
      // Query with coarse filter
      const records = await base(tableName)
        .select({ filterByFormula: coarseFormula })
        .all();
      
      console.log(`[resolveDeliveryBatch] Found ${records.length} Partner Delivery Batch(es) (coarse filter)`);
      
      // Filter client-side: keep only batches where Project linked record array includes projectId
      const batches: Array<{ batchId: string; status: string; createdTime: string; recordId: string }> = [];
      for (const rec of records) {
        const batchFields = rec.fields as Record<string, unknown>;
        
        // Check if Project linked record array includes our projectId
        const projectField = batchFields[projectLinkField];
        const projectArray = Array.isArray(projectField) ? projectField : [];
        if (!projectArray.includes(projectId)) {
          continue; // Skip batches not linked to this project
        }
        
        // Extract Batch ID
        const batchIdRaw = batchFields['Batch ID'];
        const batchId = typeof batchIdRaw === 'string' && batchIdRaw.trim() ? batchIdRaw.trim() : null;
        if (!batchId) {
          continue; // Skip batches without Batch ID
        }
        
        // Extract status
        const statusRaw = batchFields['Status'] ?? batchFields['Delivery Status'];
        const status = typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : '';
        
        // Extract created time
        const recWithTime = rec as unknown as { id: string; fields: Record<string, unknown>; createdTime?: string };
        const createdTime = typeof recWithTime.createdTime === 'string' ? recWithTime.createdTime : '';
        
        // Also check for "Batch Created At" field if createdTime is missing
        const batchCreatedAtRaw = batchFields['Batch Created At'];
        const batchCreatedAt = typeof batchCreatedAtRaw === 'string' && batchCreatedAtRaw.trim() ? batchCreatedAtRaw.trim() : '';
        const finalCreatedTime = createdTime || batchCreatedAt;
        
        batches.push({ batchId, status, createdTime: finalCreatedTime, recordId: rec.id });
      }
      
      console.log(`[resolveDeliveryBatch] Filtered to ${batches.length} batch(es) linked to Project ${projectId}`);
      
      if (batches.length === 0) {
        console.error(`[resolveDeliveryBatch] ❌ No Partner Delivery Batches found linked to Project:`, {
          crasRecordId,
          projectId,
          baseId: `${baseId.substring(0, 20)}...`,
          tableName,
          batchesScanned: records.length,
        });
        return null;
      }
      
      // Sort deterministically: Active first, then Delivering, then newest Created time
      batches.sort((a, b) => {
        // Status priority: Active (0) > Delivering (1) > others (2)
        const statusPriority = (s: string) => {
          const lower = s.toLowerCase();
          if (lower === 'active') return 0;
          if (lower === 'delivering') return 1;
          return 2;
        };
        const aPriority = statusPriority(a.status);
        const bPriority = statusPriority(b.status);
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        // Then by newest Created time
        const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return bTime - aTime; // Newest first
      });
      
      const selectedBatch = batches[0];
      console.log(`[resolveDeliveryBatch] ✅ Resolved deliveryBatchId from Partner Delivery Batch: ${selectedBatch.batchId}`, {
        batchRecordId: selectedBatch.recordId,
        status: selectedBatch.status,
        totalMatches: batches.length,
      });
      
      return {
        deliveryBatchId: selectedBatch.batchId,
        batchRecordId: selectedBatch.recordId,
      };
    } catch (queryErr) {
      const queryErrMsg = queryErr instanceof Error ? queryErr.message : String(queryErr);
      console.error(`[resolveDeliveryBatch] ❌ Failed to query Partner Delivery Batches:`, {
        crasRecordId,
        projectId,
        baseId: `${baseId.substring(0, 20)}...`,
        tableName,
        error: queryErrMsg,
      });
      return null;
    }
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[resolveDeliveryBatch] ❌ Failed to resolve deliveryBatchId:`, errMsg);
    if (fetchErr instanceof Error && fetchErr.stack) {
      console.error(`[resolveDeliveryBatch] Error stack:`, fetchErr.stack);
    }
    return null;
  }
}
