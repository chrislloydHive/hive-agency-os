// lib/airtable/diagnosticDetails.ts
// Separate storage for full diagnostic data to bypass 100KB Evidence JSON limit

import Airtable from 'airtable';

// Lazy initialization to avoid build-time errors
let _base: Airtable.Base | null = null;
function getBase(): Airtable.Base {
  if (!_base) {
    const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!apiKey || !baseId) {
      throw new Error('Airtable credentials not configured');
    }
    _base = new Airtable({ apiKey }).base(baseId);
  }
  return _base;
}

const DIAGNOSTIC_DETAILS_TABLE = 'Diagnostic Details';

export interface DiagnosticDetail {
  id?: string;
  runId: string; // Link to Heavy GAP Run
  dataType: 'modules' | 'websiteLabV4' | 'websiteActionPlan' | 'brandLab' | 'other';
  jsonData: string; // Full JSON data as string
  sizeKB: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Save full diagnostic data to separate table
 * This bypasses the 100KB limit on Evidence JSON field
 *
 * If data exceeds 90KB, it's automatically chunked across multiple records
 */
export async function saveDiagnosticDetail(detail: DiagnosticDetail): Promise<string> {
  try {
    const sizeInBytes = Buffer.byteLength(detail.jsonData, 'utf8');
    const sizeInKB = Number((sizeInBytes / 1024).toFixed(2));

    console.log(`[diagnosticDetails] Saving ${detail.dataType} for run ${detail.runId}:`, {
      sizeKB: `${sizeInKB} KB`,
      sizeInBytes,
    });

    // Airtable's long text field limit is ~100KB
    // To be safe, chunk at 90KB (92160 bytes)
    const CHUNK_SIZE = 92160; // 90KB

    if (sizeInBytes <= CHUNK_SIZE) {
      // Data fits in single record
      const record = await getBase()(DIAGNOSTIC_DETAILS_TABLE).create({
        'Run ID': detail.runId,
        'Data Type': detail.dataType,
        'JSON Data': detail.jsonData,
        'Size KB': sizeInKB,
      });

      console.log(`[diagnosticDetails] Saved ${detail.dataType}:`, record.id);
      return record.id;
    }

    // Data is too large - chunk it across multiple records
    const chunks: string[] = [];
    let offset = 0;

    while (offset < detail.jsonData.length) {
      chunks.push(detail.jsonData.substring(offset, offset + CHUNK_SIZE));
      offset += CHUNK_SIZE;
    }

    console.log(`[diagnosticDetails] Data exceeds 90KB, splitting into ${chunks.length} chunks`);

    // Save each chunk as a separate record
    const chunkRecords = await Promise.all(
      chunks.map(async (chunk, index) => {
        const chunkSizeKB = Number((Buffer.byteLength(chunk, 'utf8') / 1024).toFixed(2));

        const record = await getBase()(DIAGNOSTIC_DETAILS_TABLE).create({
          'Run ID': detail.runId,
          'Data Type': `${detail.dataType}_chunk_${index + 1}_of_${chunks.length}`,
          'JSON Data': chunk,
          'Size KB': chunkSizeKB,
        });

        console.log(`[diagnosticDetails] Saved chunk ${index + 1}/${chunks.length}:`, record.id);
        return record.id;
      })
    );

    console.log(`[diagnosticDetails] Successfully saved ${detail.dataType} in ${chunks.length} chunks`);
    return chunkRecords[0]; // Return first chunk ID
  } catch (error) {
    const errorSizeKB = Number((Buffer.byteLength(detail.jsonData, 'utf8') / 1024).toFixed(2));
    console.error('[diagnosticDetails] Error saving detail:', error);
    console.error('[diagnosticDetails] Error details:', {
      dataType: detail.dataType,
      runId: detail.runId,
      sizeKB: errorSizeKB,
      sizeInBytes: Buffer.byteLength(detail.jsonData, 'utf8'),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get all diagnostic details for a specific run
 * Automatically reassembles chunked data
 */
export async function getDiagnosticDetailsByRunId(runId: string): Promise<DiagnosticDetail[]> {
  try {
    console.log('[diagnosticDetails] Fetching details for run:', runId);

    const records = await getBase()(DIAGNOSTIC_DETAILS_TABLE)
      .select({
        filterByFormula: `{Run ID} = '${runId}'`,
        sort: [{ field: 'Data Type', direction: 'asc' }], // Ensure chunks are in order
      })
      .all();

    const rawDetails = records.map((record) => ({
      id: record.id,
      runId: record.get('Run ID') as string,
      dataType: record.get('Data Type') as string,
      jsonData: record.get('JSON Data') as string,
      sizeKB: record.get('Size KB') as number,
      createdAt: record.get('Created') as string,
      updatedAt: record.get('Last Modified') as string,
    }));

    // Group by base data type (handle chunks)
    const grouped = new Map<string, typeof rawDetails>();

    for (const detail of rawDetails) {
      // Extract base type from potentially chunked data type
      // e.g., "modules_chunk_1_of_4" -> "modules"
      const baseType = detail.dataType.split('_chunk_')[0];

      if (!grouped.has(baseType)) {
        grouped.set(baseType, []);
      }
      grouped.get(baseType)!.push(detail);
    }

    // Reassemble chunks for each data type
    const details: DiagnosticDetail[] = [];

    console.log('[diagnosticDetails] Grouped data types:', Array.from(grouped.keys()));
    console.log('[diagnosticDetails] Group details:', Array.from(grouped.entries()).map(([type, chunks]) => ({
      type,
      chunkCount: chunks.length,
      dataTypes: chunks.map(c => c.dataType)
    })));

    for (const [baseType, chunks] of grouped.entries()) {
      console.log(`[diagnosticDetails] Processing ${baseType}: ${chunks.length} chunk(s), first dataType: ${chunks[0].dataType}`);

      if (chunks.length === 1 && !chunks[0].dataType.includes('_chunk_')) {
        // Single non-chunked record
        console.log(`[diagnosticDetails] ${baseType} is single non-chunked record`);
        details.push({
          id: chunks[0].id,
          runId: chunks[0].runId,
          dataType: baseType as 'modules' | 'websiteLabV4' | 'websiteActionPlan' | 'brandLab' | 'other',
          jsonData: chunks[0].jsonData,
          sizeKB: chunks[0].sizeKB,
          createdAt: chunks[0].createdAt,
          updatedAt: chunks[0].updatedAt,
        });
      } else {
        // Multiple chunks - reassemble
        console.log(`[diagnosticDetails] Reassembling ${chunks.length} chunks for ${baseType}`);

        // IMPORTANT: Filter out non-chunked records (e.g., old pending status)
        // Only process records that have the chunk pattern
        const chunkedRecordsOnly = chunks.filter(c => c.dataType.includes('_chunk_'));

        if (chunkedRecordsOnly.length === 0) {
          console.log(`[diagnosticDetails] No chunked records found for ${baseType}, treating as corrupted data`);
          continue; // Skip this data type entirely
        }

        // IMPORTANT: Deduplicate chunks by dataType (keep the most recent one)
        // This handles cases where duplicate chunks exist due to failed deletes
        const uniqueChunks = new Map<string, typeof chunks[0]>();
        for (const chunk of chunkedRecordsOnly) {
          const existing = uniqueChunks.get(chunk.dataType);
          if (!existing || chunk.createdAt > existing.createdAt) {
            uniqueChunks.set(chunk.dataType, chunk);
          }
        }
        const deduplicatedChunks = Array.from(uniqueChunks.values());

        if (deduplicatedChunks.length !== chunkedRecordsOnly.length) {
          console.log(`[diagnosticDetails] Deduplicated ${chunkedRecordsOnly.length} → ${deduplicatedChunks.length} chunks`);
        }

        // Sort chunks by chunk number
        const sortedChunks = deduplicatedChunks.sort((a, b) => {
          const aMatch = a.dataType.match(/_chunk_(\d+)_of_/);
          const bMatch = b.dataType.match(/_chunk_(\d+)_of_/);
          const aNum = aMatch ? parseInt(aMatch[1]) : 0;
          const bNum = bMatch ? parseInt(bMatch[1]) : 0;
          return aNum - bNum;
        });

        // Concatenate all chunks
        const reassembledData = sortedChunks.map((c) => c.jsonData).join('');
        const totalSizeKB = sortedChunks.reduce((sum, c) => sum + c.sizeKB, 0);

        // Validate reassembled data is valid JSON
        console.log(`[diagnosticDetails] Reassembled ${baseType}: ${totalSizeKB.toFixed(2)} KB from ${chunks.length} chunks`);
        console.log(`[diagnosticDetails] Chunk sizes:`, sortedChunks.map(c => `${c.dataType}: ${c.sizeKB}KB (${c.jsonData.length} chars)`));
        console.log(`[diagnosticDetails] First chunk preview:`, sortedChunks[0].jsonData.substring(0, 100));
        console.log(`[diagnosticDetails] Last chunk preview:`, sortedChunks[sortedChunks.length - 1].jsonData.substring(0, 100));

        details.push({
          id: sortedChunks[0].id,
          runId: sortedChunks[0].runId,
          dataType: baseType as 'modules' | 'websiteLabV4' | 'websiteActionPlan' | 'brandLab' | 'other',
          jsonData: reassembledData,
          sizeKB: totalSizeKB,
          createdAt: sortedChunks[0].createdAt,
          updatedAt: sortedChunks[0].updatedAt,
        });
      }
    }

    console.log(`[diagnosticDetails] Found ${details.length} details for run ${runId}`);
    return details;
  } catch (error) {
    console.error('[diagnosticDetails] Error fetching details:', error);
    throw error;
  }
}

/**
 * Get specific diagnostic detail by type
 */
export async function getDiagnosticDetail(
  runId: string,
  dataType: 'modules' | 'websiteLabV4' | 'websiteActionPlan' | 'brandLab' | 'other'
): Promise<DiagnosticDetail | null> {
  try {
    const details = await getDiagnosticDetailsByRunId(runId);
    return details.find((d) => d.dataType === dataType) || null;
  } catch (error) {
    console.error('[diagnosticDetails] Error fetching detail:', error);
    throw error;
  }
}

/**
 * Delete all diagnostic details for a run
 */
export async function deleteDiagnosticDetailsByRunId(runId: string): Promise<void> {
  try {
    console.log('[diagnosticDetails] Deleting details for run:', runId);

    const records = await getBase()(DIAGNOSTIC_DETAILS_TABLE)
      .select({
        filterByFormula: `{Run ID} = '${runId}'`,
      })
      .all();

    const recordIds = records.map((r) => r.id);

    if (recordIds.length > 0) {
      // Delete in batches of 10 (Airtable limit)
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await getBase()(DIAGNOSTIC_DETAILS_TABLE).destroy(batch);
      }
      console.log(`[diagnosticDetails] Deleted ${recordIds.length} details`);
    }
  } catch (error) {
    console.error('[diagnosticDetails] Error deleting details:', error);
    throw error;
  }
}

/**
 * Helper to parse JSON data safely
 */
export function parseDiagnosticData<T>(detail: DiagnosticDetail | null): T | null {
  if (!detail) return null;
  try {
    return JSON.parse(detail.jsonData) as T;
  } catch (error) {
    console.error('[diagnosticDetails] Error parsing JSON:', error);
    console.error('[diagnosticDetails] Data preview:', detail.jsonData.substring(0, 200));
    console.error('[diagnosticDetails] Data length:', detail.jsonData.length);
    console.error('[diagnosticDetails] Data type:', detail.dataType);
    console.error('[diagnosticDetails] Run ID:', detail.runId);
    return null;
  }
}
