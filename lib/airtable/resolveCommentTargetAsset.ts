// lib/airtable/resolveCommentTargetAsset.ts
// Resolves an asset record ID from any source (CRAS, Assets table, Creative Review Assets, etc.)
// to the correct record ID for Comments.Target Asset field.
// The Target Asset field links to table tbl4ITKYtfE3JLyb6, so we normalize incoming IDs to that table.

import { getBase, getCommentsBase } from '@/lib/airtable';
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
  
  console.log('[resolveTargetAssetRecordId] Resolving asset record to Target Asset:', {
    incomingAssetId: assetId,
    expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
    commentsBaseId,
  });

  const osBase = getBase();
  const commentsBase = getCommentsBase();
  
  // Step 1: Try to detect which table the incoming record belongs to
  // Try common source tables: CRAS, Assets, Creative Review Assets, etc.
  const possibleSourceTables = [
    CRAS_TABLE,
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
  for (const tableName of possibleSourceTables) {
    try {
      // Try OS base first (for CRAS and other OS tables)
      try {
        const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
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
        });
        break;
      } catch (osErr: unknown) {
        // Check for 403 errors
        const is403 = (osErr as any)?.statusCode === 403 || 
                     (osErr instanceof Error && (osErr.message.includes('403') || osErr.message.includes('NOT_AUTHORIZED')));
        if (is403) {
          const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
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
        // Not in OS base, try Comments base
        try {
          const commentsBaseIdActual = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
          const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
          console.log('[resolveTargetAssetRecordId] Attempting airtable.find (Comments base):', {
            operation: 'airtable.find',
            baseId: commentsBaseIdActual,
            tableName,
            recordId: assetId,
            authMode: apiKey ? 'service_account' : 'none',
            apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
            previousError: osErr instanceof Error ? osErr.message : String(osErr),
          });
          const record = await commentsBase(tableName).find(assetId);
          sourceRecord = { id: record.id, fields: record.fields as Record<string, unknown> };
          sourceTableName = tableName;
          console.log('[resolveTargetAssetRecordId] Found source record in Comments base:', {
            incomingAssetId: assetId,
            sourceTable: tableName,
            fields: Object.keys(sourceRecord.fields),
          });
          break;
        } catch (commentsErr) {
          // Log 403 errors specifically
          const is403 = (commentsErr as any)?.statusCode === 403 || 
                       (commentsErr instanceof Error && commentsErr.message.includes('403')) ||
                       (commentsErr instanceof Error && commentsErr.message.includes('NOT_AUTHORIZED'));
          if (is403) {
            const commentsBaseIdActual = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
            const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
            console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on airtable.find (Comments base):', {
              operation: 'airtable.find',
              baseId: commentsBaseIdActual,
              tableName,
              recordId: assetId,
              authMode: apiKey ? 'service_account' : 'none',
              apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
              error: commentsErr instanceof Error ? commentsErr.message : String(commentsErr),
            });
          }
          // Not in this table, try next
          continue;
        }
      }
    } catch (err) {
      // Table doesn't exist or record not found, try next table
      continue;
    }
  }
  
  // If record already belongs to expected table, return it directly
  // (We can't check table ID directly, but if it's in the Comments base and matches expected table, use it)
  if (sourceTableName && sourceRecord) {
    // Check if source record has a linked field pointing to target table
    const possibleLinkFieldNames = [
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
            console.log('[resolveTargetAssetRecordId] Found linked asset record:', {
              incomingAssetId: assetId,
              resolvedAssetId: linkedRecordId,
              linkFieldName: fieldName,
              lookupKey: fieldName,
            });
            return linkedRecordId;
          }
        } else if (typeof linkedValue === 'string' && linkedValue.startsWith('rec')) {
          console.log('[resolveTargetAssetRecordId] Found linked asset record (single value):', {
            incomingAssetId: assetId,
            resolvedAssetId: linkedValue,
            linkFieldName: fieldName,
            lookupKey: fieldName,
          });
          return linkedValue;
        }
      }
    }
    
    // Extract lookup keys from source record
    const fields = sourceRecord.fields;
    lookupKeys.driveFileId = (fields[SOURCE_FOLDER_ID_FIELD] || fields['Drive File ID'] || fields['File ID'] || fields['Google Drive ID']) as string | undefined;
    lookupKeys.crasRecordId = sourceTableName === CRAS_TABLE ? assetId : (fields['CRAS Record ID'] || fields['CRAS ID']) as string | undefined;
  } else {
    // Record not found in any known table - try to extract keys from error or use ID as-is
    console.warn('[resolveTargetAssetRecordId] Could not find source record in known tables:', {
      incomingAssetId: assetId,
      triedTables: possibleSourceTables,
    });
    // Use the incoming ID as a potential CRAS record ID for lookup
    lookupKeys.crasRecordId = assetId;
  }
  
  // Step 2: Query expected linked table using lookup keys
  const possibleTargetTableNames = [
    'Assets',
    'Creative Assets',
    'Creative Review Assets',
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
      const commentsBaseIdActual = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
      const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
      
      try {
        console.log('[resolveTargetAssetRecordId] Attempting airtable.select (Comments base):', {
          operation: 'airtable.select',
          baseId: commentsBaseIdActual,
          tableName,
          filterFormula: formula,
          lookupField: fieldName,
          lookupKey: key.trim(),
          authMode: apiKey ? 'service_account' : 'none',
          apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
        });
        
        const records = await commentsBase(tableName)
          .select({ filterByFormula: formula, maxRecords: 1 })
          .firstPage();
        
        if (records.length > 0) {
          const resolvedAssetId = records[0].id;
          console.log('[resolveTargetAssetRecordId] Found matching record in target table:', {
            incomingAssetId: assetId,
            resolvedAssetId,
            targetTable: tableName,
            lookupField: fieldName,
            lookupKey: key.trim(),
            expectedLinkedTableId: EXPECTED_LINKED_TABLE_ID,
          });
          return resolvedAssetId;
        }
      } catch (fieldErr) {
        // Log 403 errors specifically
        const is403 = (fieldErr as any)?.statusCode === 403 || 
                     (fieldErr instanceof Error && fieldErr.message.includes('403')) ||
                     (fieldErr instanceof Error && fieldErr.message.includes('NOT_AUTHORIZED'));
        if (is403) {
          console.error('[resolveTargetAssetRecordId] 403 NOT_AUTHORIZED on airtable.select (Comments base):', {
            operation: 'airtable.select',
            baseId: commentsBaseIdActual,
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
  
  // Step 3: Resolution failed - throw clear error
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
