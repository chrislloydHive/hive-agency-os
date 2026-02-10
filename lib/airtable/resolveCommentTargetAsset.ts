// lib/airtable/resolveCommentTargetAsset.ts
// Resolves an asset record ID from any source (CRAS, Assets table, Creative Review Assets, etc.)
// to the correct record ID for Comments.Target Asset field.
// The Target Asset field links to table tbl4ITKYtfE3JLyb6, so we normalize incoming IDs to that table.

import { getBase } from '@/lib/airtable';
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
  const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
  
  console.log('[resolveTargetAssetRecordId] Resolving asset record to Target Asset:', {
    incomingAssetId: assetId,
    expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
    resolutionBaseId: osBaseId, // Resolve in OS base where assets live
    commentsBaseId, // Comments base only used for creating comment record
  });

  const osBase = getBase();
  // Do NOT query Comments base for asset tables - assets live in OS base
  
  // Step 1: Prioritize CRAS table lookup (most common case)
  // Try CRAS first, then other tables
  const possibleSourceTables = [
    CRAS_TABLE, // Try CRAS first since incomingAssetId is often a CRAS record ID
    'Assets',
    'Creative Assets',
    'Creative Review Assets',
    'Review Assets',
    'Asset Records',
  ];
  
  let sourceRecord: { id: string; fields: Record<string, unknown> } | null = null;
  let sourceTableName: string | null = null;
  let lookupKeys: { driveFileId?: string; crasRecordId?: string } = {};
  
  // Try to read the record from each possible source table
  // ONLY query OS base - assets don't exist in Comments base
  for (const tableName of possibleSourceTables) {
    try {
      const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
      console.log('[resolveTargetAssetRecordId] Attempting airtable.find (OS base):', {
        operation: 'airtable.find',
        baseId: osBaseId,
        tableName,
        recordId: assetId,
        authMode: apiKey ? 'service_account' : 'none',
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
      });
      const record = await osBase(tableName).find(assetId);
      sourceRecord = { id: record.id, fields: record.fields as Record<string, unknown> };
      sourceTableName = tableName;
      console.log('[resolveTargetAssetRecordId] Found source record in OS base:', {
        incomingAssetId: assetId,
        sourceTable: tableName,
        fields: Object.keys(sourceRecord.fields),
        resolutionBaseId: osBaseId,
      });
      break;
    } catch (osErr: unknown) {
      // Check for 403 errors
      const is403 = (osErr as any)?.statusCode === 403 || 
                   (osErr instanceof Error && (osErr.message.includes('403') || osErr.message.includes('NOT_AUTHORIZED')));
      if (is403) {
        const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
        console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on airtable.find (OS base):', {
          operation: 'airtable.find',
          baseId: osBaseId,
          tableName,
          recordId: assetId,
          authMode: apiKey ? 'service_account' : 'none',
          apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
          error: osErr instanceof Error ? osErr.message : String(osErr),
          errorDetails: osErr,
        });
      }
      // Not in this table, try next
      continue;
    }
  }
  
  // Step 2: If source record found, check for linked field FIRST (preferred path)
  if (sourceTableName && sourceRecord) {
    // Check if source record has a linked field pointing to target table
    // This is the preferred path - no need to search if linked field exists
    const possibleLinkFieldNames = [
      'Creative Review Asset', // Most likely field name for CRAS -> Asset link
      'Asset',
      'Target Asset',
      'Linked Asset',
      'Asset Record',
      'Asset ID',
      'Asset ID (DB)',
    ];
    
    for (const fieldName of possibleLinkFieldNames) {
      const linkedValue = sourceRecord.fields[fieldName];
      if (linkedValue) {
        if (Array.isArray(linkedValue) && linkedValue.length > 0) {
          const linkedRecordId = typeof linkedValue[0] === 'string' ? linkedValue[0] : String(linkedValue[0]);
          if (linkedRecordId.startsWith('rec')) {
            console.log('[resolveTargetAssetRecordId] Found linked asset record (PREFERRED PATH):', {
              incomingAssetId: assetId,
              resolvedAssetId: linkedRecordId,
              linkFieldName: fieldName,
              sourceTable: sourceTableName,
              resolutionPath: 'linked_field_on_source_record',
              resolutionBaseId: osBaseId,
            });
            return linkedRecordId;
          }
        } else if (typeof linkedValue === 'string' && linkedValue.startsWith('rec')) {
          console.log('[resolveTargetAssetRecordId] Found linked asset record (PREFERRED PATH, single value):', {
            incomingAssetId: assetId,
            resolvedAssetId: linkedValue,
            linkFieldName: fieldName,
            sourceTable: sourceTableName,
            resolutionPath: 'linked_field_on_source_record',
            resolutionBaseId: osBaseId,
          });
          return linkedValue;
        }
      }
    }
    
    // No linked field found - extract lookup keys for fallback search
    console.log('[resolveTargetAssetRecordId] No linked field found on source record, using fallback search:', {
      incomingAssetId: assetId,
      sourceTable: sourceTableName,
      availableFields: Object.keys(sourceRecord.fields),
      resolutionPath: 'fallback_search_by_drive_file_id',
    });
    
    const fields = sourceRecord.fields;
    lookupKeys.driveFileId = (fields[SOURCE_FOLDER_ID_FIELD] || fields['Drive File ID'] || fields['File ID'] || fields['Google Drive ID']) as string | undefined;
    lookupKeys.crasRecordId = sourceTableName === CRAS_TABLE ? assetId : (fields['CRAS Record ID'] || fields['CRAS ID']) as string | undefined;
  } else {
    // Record not found in any known table - try to extract keys from error or use ID as-is
    console.warn('[resolveTargetAssetRecordId] Could not find source record in known tables:', {
      incomingAssetId: assetId,
      triedTables: possibleSourceTables,
      resolutionPath: 'fallback_use_incoming_id',
    });
    // Use the incoming ID as a potential CRAS record ID for lookup
    lookupKeys.crasRecordId = assetId;
  }
  
  // Step 3: Fallback - Query expected linked table using lookup keys (only if no linked field found)
  // ONLY query OS base - target asset table is in OS base, not Comments base
  // This path is only used if Step 2 didn't find a linked field on the source record
  if (!lookupKeys.driveFileId && !lookupKeys.crasRecordId) {
    // No lookup keys available, can't proceed with fallback search
    console.warn('[resolveTargetAssetRecordId] No lookup keys available for fallback search');
  } else {
    const possibleTargetTableNames = [
      'Creative Review Assets', // Most likely table name for tbl4ITKYtfE3JLyb6
      'Assets',
      'Creative Assets',
      'Review Assets',
      'Asset Records',
    ];
    
    const possibleFieldNames = [
      { name: 'Drive File ID', key: lookupKeys.driveFileId },
      { name: 'Source Folder ID', key: lookupKeys.driveFileId },
      { name: 'File ID', key: lookupKeys.driveFileId },
      { name: 'Google Drive ID', key: lookupKeys.driveFileId },
      { name: 'CRAS Record ID', key: lookupKeys.crasRecordId },
      { name: 'CRAS ID', key: lookupKeys.crasRecordId },
      { name: 'Asset ID (DB)', key: lookupKeys.crasRecordId },
    ];
    
    for (const tableName of possibleTargetTableNames) {
      for (const { name: fieldName, key } of possibleFieldNames) {
        if (!key || typeof key !== 'string' || !key.trim()) continue;
        
        // Declare formula outside try block so it's accessible in catch block
        const keyEsc = String(key).trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const formula = `{${fieldName}} = "${keyEsc}"`;
        const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
        
        try {
          console.log('[resolveTargetAssetRecordId] Attempting airtable.select (OS base, FALLBACK PATH):', {
            operation: 'airtable.select',
            baseId: osBaseId,
            tableName,
            filterFormula: formula,
            lookupField: fieldName,
            lookupKey: key.trim(),
            resolutionPath: 'fallback_search_by_drive_file_id',
            authMode: apiKey ? 'service_account' : 'none',
            apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
          });
          
          const records = await osBase(tableName)
            .select({ filterByFormula: formula, maxRecords: 1 })
            .firstPage();
          
          if (records.length > 0) {
            const resolvedAssetId = records[0].id;
            console.log('[resolveTargetAssetRecordId] Found matching record in target table (FALLBACK PATH):', {
              incomingAssetId: assetId,
              resolvedAssetId,
              targetTable: tableName,
              lookupField: fieldName,
              lookupKey: key.trim(),
              expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
              resolutionBaseId: osBaseId,
              resolutionPath: 'fallback_search_by_drive_file_id',
              commentsBaseId, // Comments base only used for creating comment record
            });
            return resolvedAssetId;
          }
        } catch (fieldErr) {
          // Log 403 errors specifically
          const is403 = (fieldErr as any)?.statusCode === 403 || 
                       (fieldErr instanceof Error && fieldErr.message.includes('403')) ||
                       (fieldErr instanceof Error && fieldErr.message.includes('NOT_AUTHORIZED'));
          if (is403) {
            console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on airtable.select (OS base):', {
              operation: 'airtable.select',
              baseId: osBaseId,
              tableName,
              filterFormula: formula,
              lookupField: fieldName,
              lookupKey: key.trim(),
              authMode: apiKey ? 'service_account' : 'none',
              apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
              error: fieldErr instanceof Error ? fieldErr.message : String(fieldErr),
            });
          }
          // Field or table doesn't exist, try next combination
          continue;
        }
      }
    }
  }
  
  // Step 4: Resolution failed - throw clear error
  const errorDetails = {
    incomingAssetId: assetId,
    sourceTable: sourceTableName || 'unknown',
    expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
    lookupKeys,
    triedTargetTables: possibleTargetTableNames,
    triedLookupFields: possibleFieldNames.map(f => f.name),
  };
  
  console.error('[resolveTargetAssetRecordId] Failed to resolve asset record:', errorDetails);
  
  throw new Error(
    `assetId "${assetId}" does not belong to the linked table (${EXPECTED_LINKED_TABLE_ID}); ` +
    `provide the Creative Review Asset record id. ` +
    `Debug info: ${JSON.stringify(errorDetails, null, 2)}`
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
