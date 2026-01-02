// lib/airtable/jobDocuments.ts
// Airtable helpers for JobDocuments table

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { JobDocumentRecord, JobDocumentStatus, DocumentType } from '@/lib/types/template';

// ============================================================================
// Field Mappings
// ============================================================================

const JOB_DOCUMENT_FIELDS = {
  JOB: 'Job', // Link field to Jobs table
  DOCUMENT_TYPE: 'Document Type',
  STATUS: 'Status',
  DRIVE_FILE_ID: 'Drive File ID',
  DRIVE_URL: 'Drive URL',
  NAME: 'Name',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
} as const;

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map Airtable record to JobDocumentRecord
 */
function mapFieldsToJobDocument(record: any): JobDocumentRecord {
  const fields = record.fields;

  // Extract job ID from link field
  const jobLinks = fields[JOB_DOCUMENT_FIELDS.JOB] as string[] | undefined;
  const jobId = jobLinks?.[0] || '';

  return {
    id: record.id,
    jobId,
    documentType: (fields[JOB_DOCUMENT_FIELDS.DOCUMENT_TYPE] as DocumentType) || 'SOW',
    status: (fields[JOB_DOCUMENT_FIELDS.STATUS] as JobDocumentStatus) || 'draft',
    driveFileId: (fields[JOB_DOCUMENT_FIELDS.DRIVE_FILE_ID] as string) || '',
    driveUrl: (fields[JOB_DOCUMENT_FIELDS.DRIVE_URL] as string) || '',
    name: (fields[JOB_DOCUMENT_FIELDS.NAME] as string) || '',
    createdAt: fields[JOB_DOCUMENT_FIELDS.CREATED_AT] as string | undefined,
    updatedAt: fields[JOB_DOCUMENT_FIELDS.UPDATED_AT] as string | undefined,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a job document by ID
 */
export async function getJobDocumentById(documentId: string): Promise<JobDocumentRecord | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.JOB_DOCUMENTS).find(documentId);
    if (!record) return null;
    return mapFieldsToJobDocument(record);
  } catch (error: any) {
    if (error?.statusCode === 404) return null;
    console.error(`[JobDocuments] Failed to get document ${documentId}:`, error);
    return null;
  }
}

/**
 * List documents for a job
 */
export async function listJobDocuments(jobId: string): Promise<JobDocumentRecord[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.JOB_DOCUMENTS)
      .select({
        filterByFormula: `FIND("${jobId}", ARRAYJOIN({${JOB_DOCUMENT_FIELDS.JOB}}))`,
        sort: [{ field: JOB_DOCUMENT_FIELDS.CREATED_AT, direction: 'desc' }],
      })
      .all();

    return records.map(mapFieldsToJobDocument);
  } catch (error) {
    console.error(`[JobDocuments] Failed to list documents for job ${jobId}:`, error);
    return [];
  }
}

/**
 * Get a specific document type for a job (e.g., check if SOW exists)
 */
export async function getJobDocumentByType(
  jobId: string,
  documentType: DocumentType
): Promise<JobDocumentRecord | null> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.JOB_DOCUMENTS)
      .select({
        filterByFormula: `AND(FIND("${jobId}", ARRAYJOIN({${JOB_DOCUMENT_FIELDS.JOB}})), {${JOB_DOCUMENT_FIELDS.DOCUMENT_TYPE}} = "${documentType}")`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return mapFieldsToJobDocument(records[0]);
  } catch (error) {
    console.error(`[JobDocuments] Failed to get ${documentType} for job ${jobId}:`, error);
    return null;
  }
}

/**
 * Create a new job document
 */
export async function createJobDocument(data: {
  jobId: string;
  documentType: DocumentType;
  driveFileId: string;
  driveUrl: string;
  name: string;
  status?: JobDocumentStatus;
}): Promise<JobDocumentRecord | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      [JOB_DOCUMENT_FIELDS.JOB]: [data.jobId], // Link field expects array
      [JOB_DOCUMENT_FIELDS.DOCUMENT_TYPE]: data.documentType,
      [JOB_DOCUMENT_FIELDS.DRIVE_FILE_ID]: data.driveFileId,
      [JOB_DOCUMENT_FIELDS.DRIVE_URL]: data.driveUrl,
      [JOB_DOCUMENT_FIELDS.NAME]: data.name,
      [JOB_DOCUMENT_FIELDS.STATUS]: data.status || 'draft',
    };

    console.log(`[JobDocuments] Creating document: ${data.name} (${data.documentType})`);

    const createdRecords = await base(AIRTABLE_TABLES.JOB_DOCUMENTS).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];

    console.log(`[JobDocuments] Created document: ${data.name} (${createdRecord.id})`);
    return mapFieldsToJobDocument(createdRecord);
  } catch (error) {
    console.error('[JobDocuments] Failed to create document:', error);
    return null;
  }
}

/**
 * Update a job document's status
 */
export async function updateJobDocumentStatus(
  documentId: string,
  status: JobDocumentStatus
): Promise<JobDocumentRecord | null> {
  try {
    const base = getBase();

    await base(AIRTABLE_TABLES.JOB_DOCUMENTS).update(documentId, {
      [JOB_DOCUMENT_FIELDS.STATUS]: status,
    } as any);

    console.log(`[JobDocuments] Updated document ${documentId} status to ${status}`);
    return getJobDocumentById(documentId);
  } catch (error) {
    console.error(`[JobDocuments] Failed to update document ${documentId}:`, error);
    return null;
  }
}

/**
 * Delete a job document
 */
export async function deleteJobDocument(documentId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(AIRTABLE_TABLES.JOB_DOCUMENTS).destroy(documentId);
    console.log(`[JobDocuments] Deleted document ${documentId}`);
    return true;
  } catch (error) {
    console.error(`[JobDocuments] Failed to delete document ${documentId}:`, error);
    return false;
  }
}

/**
 * Batch create multiple job documents
 */
export async function createJobDocuments(
  documents: Array<{
    jobId: string;
    documentType: DocumentType;
    driveFileId: string;
    driveUrl: string;
    name: string;
    status?: JobDocumentStatus;
  }>
): Promise<JobDocumentRecord[]> {
  if (documents.length === 0) return [];

  try {
    const base = getBase();

    const records = documents.map((doc) => ({
      fields: {
        [JOB_DOCUMENT_FIELDS.JOB]: [doc.jobId],
        [JOB_DOCUMENT_FIELDS.DOCUMENT_TYPE]: doc.documentType,
        [JOB_DOCUMENT_FIELDS.DRIVE_FILE_ID]: doc.driveFileId,
        [JOB_DOCUMENT_FIELDS.DRIVE_URL]: doc.driveUrl,
        [JOB_DOCUMENT_FIELDS.NAME]: doc.name,
        [JOB_DOCUMENT_FIELDS.STATUS]: doc.status || 'draft',
      },
    }));

    console.log(`[JobDocuments] Batch creating ${documents.length} documents`);

    // Airtable allows max 10 records per batch
    const results: JobDocumentRecord[] = [];
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      const createdRecords = await base(AIRTABLE_TABLES.JOB_DOCUMENTS).create(batch as any);
      results.push(...createdRecords.map(mapFieldsToJobDocument));
    }

    console.log(`[JobDocuments] Batch created ${results.length} documents`);
    return results;
  } catch (error) {
    console.error('[JobDocuments] Failed to batch create documents:', error);
    return [];
  }
}
