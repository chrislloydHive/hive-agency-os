// lib/airtable/resolveCommentTargetAsset.ts
// Resolves an asset record ID from any source (CRAS, Assets table, Creative Review Assets, etc.)
// to the correct record ID for Comments.Target Asset field.
// The Target Asset field links to table tbl4ITKYtfE3JLyb6, so we normalize incoming IDs to that table.

import { getBase, getBaseId } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getRecord } from '@/lib/airtable/client';

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';
const EXPECTED_LINKED_TABLE_ID = 'tbl4ITKYtfE3JLyb6'; // From error message

/**
 * Resolves an asset record ID from any source to the correct record ID for Comments.Target Asset field.
 * 
 * The Comments.Target Asset field expects records from table tbl4ITKYtfE3JLyb6.
 * Incoming asset IDs might come from:
 * - CRAS (Creative Review Asset Status) table
 * - Assets table
 * - Creative Review Assets table
 * - Other asset-related tables
 * 
 * Strategy:
 * 1. Try to read the incoming record ID to detect which table it belongs to
 * 2. Extract lookup keys (Drive File ID, CRAS record ID, etc.) from the source record
 * 3. Query the expected linked table (tbl4ITKYtfE3JLyb6) for a matching record
 * 4. Return the resolved record ID, or throw if no match found
 * 
 * @param params.incomingAssetId - The asset record ID from any source
 * @param params.baseId - The base ID where Comments table lives (default: appQLwoVH8JyGSTIo)
 * @returns The resolved record ID for Target Asset field
 * @throws Error if resolution fails with clear message
 */
export async function resolveTargetAssetRecordId(params: {
  incomingAssetId: string;
  baseId?: string;
}): Promise<string> {
  const { incomingAssetId, baseId } = params;
  const assetId = String(incomingAssetId).trim();
  
  if (!assetId.startsWith('rec')) {
    throw new Error(`Invalid asset record ID format: ${assetId}. Expected format: rec...`);
  }

  const commentsBaseId = baseId || process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
  
  // Get the actual OS base ID that getBase() is using (not just env vars)
  const osBase = getBase();
  const actualOsBaseId = getBaseId() || process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) + '...' : 'missing';
  
  console.log('[resolveTargetAssetRecordId] Resolving asset record to Target Asset:', {
    incomingAssetId: assetId,
    expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
    resolutionBaseId: actualOsBaseId, // OS base where CRAS and assets live
    commentsBaseId, // Comments base only used for creating comment record
    resolutionApiKeyPrefix: apiKeyPrefix,
  });
  
  // Do NOT query Comments base for asset tables - assets live in OS base
  
  // Step 1: Read CRAS record (incoming assetId is a CRAS record ID)
  let crasRecord: { id: string; fields: Record<string, unknown> } | null = null;
  try {
    console.log('[resolveTargetAssetRecordId] Reading CRAS record:', {
      operation: 'airtable.find',
      baseId: actualOsBaseId,
      tableName: CRAS_TABLE,
      recordId: assetId,
      authMode: apiKey ? 'service_account' : 'none',
      apiKeyPrefix,
    });
    const record = await osBase(CRAS_TABLE).find(assetId);
    crasRecord = { id: record.id, fields: record.fields as Record<string, unknown> };
    console.log('[resolveTargetAssetRecordId] Found CRAS record:', {
      incomingAssetId: assetId,
      fields: Object.keys(crasRecord.fields),
      resolutionBaseId: actualOsBaseId,
    });
  } catch (crasErr: unknown) {
    const is403 = (crasErr as any)?.statusCode === 403 || 
                 (crasErr instanceof Error && (crasErr.message.includes('403') || crasErr.message.includes('NOT_AUTHORIZED')));
    if (is403) {
      console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on CRAS lookup:', {
        operation: 'airtable.find',
        baseId: actualOsBaseId,
        tableName: CRAS_TABLE,
        recordId: assetId,
        authMode: apiKey ? 'service_account' : 'none',
        apiKeyPrefix,
        error: crasErr instanceof Error ? crasErr.message : String(crasErr),
      });
      throw new Error(
        `Airtable PAT not authorized for OS base ${actualOsBaseId}. ` +
        `Cannot read CRAS record. Fix base permissions or use correct PAT.`
      );
    }
    throw new Error(
      `Failed to read CRAS record ${assetId}: ${crasErr instanceof Error ? crasErr.message : String(crasErr)}`
    );
  }
  
  if (!crasRecord) {
    throw new Error(`CRAS record ${assetId} not found`);
  }
  
  // Step 2: Check for linked field pointing to Creative Review Assets table (tbl4ITKYtfE3JLyb6)
  const possibleLinkFieldNames = [
    'Creative Review Asset', // Most likely field name
    'Review Asset',
    'Asset',
    'Target Asset',
  ];
  
  for (const fieldName of possibleLinkFieldNames) {
    const linkedValue = crasRecord.fields[fieldName];
    if (linkedValue) {
      let linkedRecordId: string | null = null;
      if (Array.isArray(linkedValue) && linkedValue.length > 0) {
        linkedRecordId = typeof linkedValue[0] === 'string' ? linkedValue[0] : String(linkedValue[0]);
      } else if (typeof linkedValue === 'string') {
        linkedRecordId = linkedValue;
      }
      
      if (linkedRecordId && linkedRecordId.startsWith('rec')) {
        console.log('[resolveTargetAssetRecordId] Found linked asset record (PREFERRED PATH):', {
          incomingAssetId: assetId,
          resolvedAssetId: linkedRecordId,
          linkFieldName: fieldName,
          resolutionPath: 'linked_field_on_cras_record',
          resolutionBaseId: actualOsBaseId,
        });
        return linkedRecordId;
      }
    }
  }
  
  // Step 3: Fallback - Search by Drive File ID in Creative Review Assets table only
  const driveFileId = (crasRecord.fields[SOURCE_FOLDER_ID_FIELD] || 
                       crasRecord.fields['Drive File ID'] || 
                       crasRecord.fields['File ID'] || 
                       crasRecord.fields['Google Drive ID']) as string | undefined;
  
  if (!driveFileId || typeof driveFileId !== 'string' || !driveFileId.trim()) {
    throw new Error(
      `CRAS record ${assetId} has no linked field and no Drive File ID for fallback search. ` +
      `Available fields: ${Object.keys(crasRecord.fields).join(', ')}`
    );
  }
  
  console.log('[resolveTargetAssetRecordId] No linked field found, using fallback search:', {
    incomingAssetId: assetId,
    driveFileId: driveFileId.trim(),
    targetTable: 'Creative Review Assets',
    resolutionPath: 'fallback_search_by_drive_file_id',
  });
  
  // Search only in Creative Review Assets table by Drive File ID
  const targetTableName = 'Creative Review Assets';
  const lookupFieldName = 'Drive File ID';
  const keyEsc = String(driveFileId).trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `{${lookupFieldName}} = "${keyEsc}"`;
  
  try {
    console.log('[resolveTargetAssetRecordId] Attempting airtable.select (FALLBACK PATH):', {
      operation: 'airtable.select',
      baseId: actualOsBaseId,
      tableName: targetTableName,
      filterFormula: formula,
      lookupField: lookupFieldName,
      lookupKey: driveFileId.trim(),
      resolutionPath: 'fallback_search_by_drive_file_id',
      authMode: apiKey ? 'service_account' : 'none',
      apiKeyPrefix,
    });
    
    const records = await osBase(targetTableName)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();
    
    if (records.length > 0) {
      const resolvedAssetId = records[0].id;
      console.log('[resolveTargetAssetRecordId] Found matching record (FALLBACK PATH):', {
        incomingAssetId: assetId,
        resolvedAssetId,
        targetTable: targetTableName,
        lookupField: lookupFieldName,
        lookupKey: driveFileId.trim(),
        expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
        resolutionBaseId: actualOsBaseId,
        resolutionPath: 'fallback_search_by_drive_file_id',
      });
      return resolvedAssetId;
    }
  } catch (fieldErr) {
    const is403 = (fieldErr as any)?.statusCode === 403 || 
                 (fieldErr instanceof Error && fieldErr.message.includes('403')) ||
                 (fieldErr instanceof Error && fieldErr.message.includes('NOT_AUTHORIZED'));
    if (is403) {
      console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on fallback search:', {
        operation: 'airtable.select',
        baseId: actualOsBaseId,
        tableName: targetTableName,
        filterFormula: formula,
        lookupField: lookupFieldName,
        lookupKey: driveFileId.trim(),
        authMode: apiKey ? 'service_account' : 'none',
        apiKeyPrefix,
        error: fieldErr instanceof Error ? fieldErr.message : String(fieldErr),
      });
      throw new Error(
        `Airtable PAT not authorized for OS base ${actualOsBaseId}. ` +
        `Cannot resolve asset record via fallback search. Fix base permissions or use correct PAT.`
      );
    }
    throw new Error(
      `Fallback search failed: ${fieldErr instanceof Error ? fieldErr.message : String(fieldErr)}`
    );
  }
  
  // Step 4: Resolution failed - throw clear error
  console.error('[resolveTargetAssetRecordId] Failed to resolve asset record:', {
    incomingAssetId: assetId,
    crasRecordFound: !!crasRecord,
    driveFileId: driveFileId || 'missing',
    expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
    resolutionBaseId: actualOsBaseId,
  });
  
  throw new Error(
    `Failed to resolve asset record for CRAS ${assetId}. ` +
    `No linked field found and fallback search by Drive File ID returned no results. ` +
    `Expected table: ${EXPECTED_LINKED_TABLE_ID} (Creative Review Assets).`
  );
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use resolveTargetAssetRecordId instead
 */
export async function resolveCommentTargetAssetId(
  crasRecordId: string,
  commentsBaseId?: string
): Promise<string | null> {
  try {
    return await resolveTargetAssetRecordId({
      incomingAssetId: crasRecordId,
      baseId: commentsBaseId,
    });
  } catch (err) {
    console.error('[resolveCommentTargetAssetId] Resolution failed:', err);
    return null;
  }
}
