// lib/airtable/jobs.ts
// Airtable helpers for Jobs table

import { getBase } from '@/lib/airtable';
import type { JobRecord, JobStatus, ProjectType } from '@/lib/types/job';
import { generateJobCode } from '@/lib/types/job';

const JOBS_TABLE = 'Jobs';

// ============================================================================
// Field Mappings
// ============================================================================

const JOBS_FIELDS = {
  JOB_NUMBER: 'Job Number',
  JOB_CODE: 'Job Code',
  PROJECT_NAME: 'Project Name',
  COMPANY: 'Company', // Link field
  PROJECT_TYPE: 'Project Type',
  START_DATE: 'Start Date',
  DUE_DATE: 'Due Date',
  STATUS: 'Status',
  ASSIGNMENT: 'Assignment',
  OWNER: 'Owner',
  DRIVE_JOB_FOLDER_ID: 'Drive Job Folder ID',
  DRIVE_JOB_FOLDER_URL: 'Drive Job Folder URL',
  DRIVE_PROVISIONED_AT: 'Drive Provisioned At',
  DRIVE_PROVISIONING_ERROR: 'Drive Provisioning Error',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
} as const;

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map Airtable record to JobRecord
 */
function mapFieldsToJobRecord(record: any): JobRecord {
  const fields = record.fields;

  // Extract company ID from link field
  const companyLinks = fields[JOBS_FIELDS.COMPANY] as string[] | undefined;
  const companyId = companyLinks?.[0] || '';

  return {
    id: record.id,
    jobNumber: (fields[JOBS_FIELDS.JOB_NUMBER] as number) || 0,
    jobCode: (fields[JOBS_FIELDS.JOB_CODE] as string) || '',
    projectName: (fields[JOBS_FIELDS.PROJECT_NAME] as string) || '',
    companyId,
    projectType: fields[JOBS_FIELDS.PROJECT_TYPE] as ProjectType | undefined,
    startDate: fields[JOBS_FIELDS.START_DATE] as string | undefined,
    dueDate: fields[JOBS_FIELDS.DUE_DATE] as string | undefined,
    status: (fields[JOBS_FIELDS.STATUS] as JobStatus) || 'not_started',
    assignment: fields[JOBS_FIELDS.ASSIGNMENT] as string | undefined,
    owner: fields[JOBS_FIELDS.OWNER] as string | undefined,
    driveJobFolderId: fields[JOBS_FIELDS.DRIVE_JOB_FOLDER_ID] as string | undefined,
    driveJobFolderUrl: fields[JOBS_FIELDS.DRIVE_JOB_FOLDER_URL] as string | undefined,
    driveProvisionedAt: fields[JOBS_FIELDS.DRIVE_PROVISIONED_AT] as string | undefined,
    driveProvisioningError: fields[JOBS_FIELDS.DRIVE_PROVISIONING_ERROR] as string | undefined,
    createdAt: fields[JOBS_FIELDS.CREATED_AT] as string | undefined,
    updatedAt: fields[JOBS_FIELDS.UPDATED_AT] as string | undefined,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a job by Airtable record ID
 */
export async function getJobById(jobId: string): Promise<JobRecord | null> {
  try {
    const base = getBase();
    const record = await base(JOBS_TABLE).find(jobId);
    if (!record) return null;
    return mapFieldsToJobRecord(record);
  } catch (error: any) {
    if (error?.statusCode === 404) return null;
    console.error(`[Jobs] Failed to get job ${jobId}:`, error);
    return null;
  }
}

/**
 * Get a job by job code (e.g., "117CAR")
 */
export async function getJobByCode(jobCode: string): Promise<JobRecord | null> {
  try {
    const base = getBase();
    const records = await base(JOBS_TABLE)
      .select({
        filterByFormula: `{${JOBS_FIELDS.JOB_CODE}} = "${jobCode}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return mapFieldsToJobRecord(records[0]);
  } catch (error) {
    console.error(`[Jobs] Failed to get job by code ${jobCode}:`, error);
    return null;
  }
}

/**
 * List all jobs, optionally filtered by company
 */
export async function listJobs(options?: {
  companyId?: string;
  limit?: number;
}): Promise<JobRecord[]> {
  try {
    const base = getBase();

    let filterFormula: string | undefined;
    if (options?.companyId) {
      // Filter by company link field using FIND
      filterFormula = `FIND("${options.companyId}", ARRAYJOIN({${JOBS_FIELDS.COMPANY}}))`;
    }

    const records = await base(JOBS_TABLE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: options?.limit || 100,
        sort: [{ field: JOBS_FIELDS.CREATED_AT, direction: 'desc' }],
      })
      .all();

    return records.map(mapFieldsToJobRecord);
  } catch (error) {
    console.error('[Jobs] Failed to list jobs:', error);
    return [];
  }
}

/**
 * Create a new job
 */
export async function createJob(data: {
  jobNumber: number;
  clientCode: string;
  projectName: string;
  companyId: string;
  projectType?: ProjectType;
  startDate?: string;
  dueDate?: string;
  assignment?: string;
  owner?: string;
}): Promise<JobRecord | null> {
  try {
    const base = getBase();
    const jobCode = generateJobCode(data.jobNumber, data.clientCode);

    const fields: Record<string, unknown> = {
      [JOBS_FIELDS.JOB_NUMBER]: data.jobNumber,
      [JOBS_FIELDS.JOB_CODE]: jobCode,
      [JOBS_FIELDS.PROJECT_NAME]: data.projectName,
      [JOBS_FIELDS.COMPANY]: [data.companyId], // Link field expects array
      [JOBS_FIELDS.STATUS]: 'not_started',
    };

    if (data.projectType) fields[JOBS_FIELDS.PROJECT_TYPE] = data.projectType;
    if (data.startDate) fields[JOBS_FIELDS.START_DATE] = data.startDate;
    if (data.dueDate) fields[JOBS_FIELDS.DUE_DATE] = data.dueDate;
    if (data.assignment) fields[JOBS_FIELDS.ASSIGNMENT] = data.assignment;
    if (data.owner) fields[JOBS_FIELDS.OWNER] = data.owner;

    console.log(`[Jobs] Creating job: ${jobCode} - ${data.projectName}`);

    const createdRecords = await base(JOBS_TABLE).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];

    console.log(`[Jobs] Created job: ${jobCode} (${createdRecord.id})`);
    return mapFieldsToJobRecord(createdRecord);
  } catch (error) {
    console.error('[Jobs] Failed to create job:', error);
    return null;
  }
}

/**
 * Update a job
 */
export async function updateJob(
  jobId: string,
  data: {
    projectName?: string;
    projectType?: ProjectType | null;
    startDate?: string | null;
    dueDate?: string | null;
    assignment?: string | null;
    owner?: string | null;
    status?: JobStatus;
    driveJobFolderId?: string;
    driveJobFolderUrl?: string;
    driveProvisionedAt?: string;
    driveProvisioningError?: string | null;
  }
): Promise<JobRecord | null> {
  try {
    const base = getBase();
    const fields: Record<string, unknown> = {};

    if (data.projectName !== undefined) fields[JOBS_FIELDS.PROJECT_NAME] = data.projectName;
    if (data.projectType !== undefined) fields[JOBS_FIELDS.PROJECT_TYPE] = data.projectType;
    if (data.startDate !== undefined) fields[JOBS_FIELDS.START_DATE] = data.startDate;
    if (data.dueDate !== undefined) fields[JOBS_FIELDS.DUE_DATE] = data.dueDate;
    if (data.assignment !== undefined) fields[JOBS_FIELDS.ASSIGNMENT] = data.assignment;
    if (data.owner !== undefined) fields[JOBS_FIELDS.OWNER] = data.owner;
    if (data.status !== undefined) fields[JOBS_FIELDS.STATUS] = data.status;
    if (data.driveJobFolderId !== undefined) fields[JOBS_FIELDS.DRIVE_JOB_FOLDER_ID] = data.driveJobFolderId;
    if (data.driveJobFolderUrl !== undefined) fields[JOBS_FIELDS.DRIVE_JOB_FOLDER_URL] = data.driveJobFolderUrl;
    if (data.driveProvisionedAt !== undefined) fields[JOBS_FIELDS.DRIVE_PROVISIONED_AT] = data.driveProvisionedAt;
    if (data.driveProvisioningError !== undefined) fields[JOBS_FIELDS.DRIVE_PROVISIONING_ERROR] = data.driveProvisioningError;

    if (Object.keys(fields).length === 0) {
      return getJobById(jobId);
    }

    await base(JOBS_TABLE).update(jobId, fields as any);
    console.log(`[Jobs] Updated job ${jobId}`);
    return getJobById(jobId);
  } catch (error) {
    console.error(`[Jobs] Failed to update job ${jobId}:`, error);
    return null;
  }
}

/**
 * Get jobs by status
 */
export async function getJobsByStatus(status: JobStatus): Promise<JobRecord[]> {
  try {
    const base = getBase();
    const records = await base(JOBS_TABLE)
      .select({
        filterByFormula: `{${JOBS_FIELDS.STATUS}} = "${status}"`,
        sort: [{ field: JOBS_FIELDS.CREATED_AT, direction: 'desc' }],
      })
      .all();

    return records.map(mapFieldsToJobRecord);
  } catch (error) {
    console.error(`[Jobs] Failed to get jobs by status ${status}:`, error);
    return [];
  }
}
