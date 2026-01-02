// lib/os/jobs/provisionJob.ts
// Job Provisioning Service
//
// Creates jobs with Drive folder structure in a single operation.
// Handles job number generation, job creation, and Drive provisioning.

import { getCompanyById } from '@/lib/airtable/companies';
import { reserveNextJobNumber } from '@/lib/airtable/counters';
import { createJob, updateJob, getJobById } from '@/lib/airtable/jobs';
import { provisionJobFolders, type JobSubfolders } from '@/lib/os/folders/provisioning';
import type { JobRecord, ProjectType } from '@/lib/types/job';

// ============================================================================
// Types
// ============================================================================

export interface ProvisionJobInput {
  /** Company Airtable record ID */
  companyId: string;

  /** Project name */
  projectName: string;

  /** Optional project type */
  projectType?: ProjectType;

  /** Optional start date (ISO) */
  startDate?: string;

  /** Optional due date (ISO) */
  dueDate?: string;

  /** Optional assignment notes */
  assignment?: string;

  /** Optional owner */
  owner?: string;

  /** Whether to provision Drive folders (default: true) */
  provisionDrive?: boolean;
}

export interface ProvisionJobResult {
  ok: boolean;
  job?: JobRecord;
  subfolders?: JobSubfolders;
  error?: ProvisionJobError;
}

export interface ProvisionJobError {
  code: string;
  message: string;
  phase: 'validation' | 'job_creation' | 'drive_provisioning';
  howToFix?: string;
}

// ============================================================================
// Job Provisioning
// ============================================================================

/**
 * Provision a new job with Drive folders
 *
 * Steps:
 * 1. Validate company exists and has client code
 * 2. Reserve next job number (atomic)
 * 3. Create job record in Airtable
 * 4. Provision Drive folders (if enabled)
 * 5. Update job record with Drive folder info
 */
export async function provisionJob(input: ProvisionJobInput): Promise<ProvisionJobResult> {
  const { companyId, projectName, projectType, startDate, dueDate, assignment, owner } = input;
  const provisionDrive = input.provisionDrive !== false; // Default true

  console.log(`[ProvisionJob] Starting for company ${companyId}: "${projectName}"`);

  // 1. Validate company
  const company = await getCompanyById(companyId);
  if (!company) {
    return {
      ok: false,
      error: {
        code: 'COMPANY_NOT_FOUND',
        message: `Company ${companyId} not found.`,
        phase: 'validation',
      },
    };
  }

  if (!company.clientCode) {
    return {
      ok: false,
      error: {
        code: 'NO_CLIENT_CODE',
        message: `Company "${company.name}" does not have a client code set.`,
        phase: 'validation',
        howToFix: 'Set the Client Code field in the Companies table (e.g., "CAR" for Car Toys).',
      },
    };
  }

  // 2. Reserve job number
  const jobNumber = await reserveNextJobNumber();
  if (!jobNumber) {
    return {
      ok: false,
      error: {
        code: 'JOB_NUMBER_FAILED',
        message: 'Failed to reserve job number.',
        phase: 'job_creation',
        howToFix: 'Check the Counters table in Airtable and ensure the jobNumber counter exists.',
      },
    };
  }

  console.log(`[ProvisionJob] Reserved job number: ${jobNumber}`);

  // 3. Create job record
  const job = await createJob({
    jobNumber,
    clientCode: company.clientCode,
    projectName,
    companyId,
    projectType,
    startDate,
    dueDate,
    assignment,
    owner,
  });

  if (!job) {
    return {
      ok: false,
      error: {
        code: 'JOB_CREATION_FAILED',
        message: 'Failed to create job record in Airtable.',
        phase: 'job_creation',
      },
    };
  }

  console.log(`[ProvisionJob] Created job: ${job.jobCode} (${job.id})`);

  // 4. Provision Drive folders (if enabled)
  if (!provisionDrive) {
    console.log(`[ProvisionJob] Drive provisioning skipped (disabled)`);
    return { ok: true, job };
  }

  // Update status to provisioning
  await updateJob(job.id, { status: 'provisioning' });

  const driveResult = await provisionJobFolders({
    companyId,
    jobCode: job.jobCode,
    projectName,
  });

  if (!driveResult.ok) {
    // Mark job as having error
    await updateJob(job.id, {
      status: 'error',
      driveProvisioningError: driveResult.error?.message || 'Unknown error',
    });

    return {
      ok: false,
      job,
      error: {
        code: driveResult.error?.code || 'DRIVE_PROVISIONING_FAILED',
        message: driveResult.error?.message || 'Failed to provision Drive folders.',
        phase: 'drive_provisioning',
        howToFix: driveResult.error?.howToFix,
      },
    };
  }

  // 5. Update job with Drive folder info
  const updatedJob = await updateJob(job.id, {
    status: 'ready',
    driveJobFolderId: driveResult.jobFolderId,
    driveJobFolderUrl: driveResult.jobFolderUrl,
    driveProvisionedAt: new Date().toISOString(),
    driveProvisioningError: null,
  });

  console.log(`[ProvisionJob] ✅ Job ${job.jobCode} fully provisioned`);

  return {
    ok: true,
    job: updatedJob || job,
    subfolders: driveResult.subfolders,
  };
}

// ============================================================================
// Drive Provisioning for Existing Jobs
// ============================================================================

/**
 * Provision Drive folders for an existing job that doesn't have them
 *
 * Useful for:
 * - Jobs created before Drive integration was enabled
 * - Retrying failed Drive provisioning
 */
export async function provisionDriveForExistingJob(jobId: string): Promise<ProvisionJobResult> {
  console.log(`[ProvisionJob] Provisioning Drive for existing job: ${jobId}`);

  // 1. Get job
  const job = await getJobById(jobId);
  if (!job) {
    return {
      ok: false,
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} not found.`,
        phase: 'validation',
      },
    };
  }

  // 2. Check if already provisioned
  if (job.driveJobFolderId) {
    console.log(`[ProvisionJob] Job ${job.jobCode} already has Drive folder: ${job.driveJobFolderId}`);
    return { ok: true, job };
  }

  // 3. Get company
  const company = await getCompanyById(job.companyId);
  if (!company) {
    return {
      ok: false,
      error: {
        code: 'COMPANY_NOT_FOUND',
        message: `Company ${job.companyId} not found.`,
        phase: 'validation',
      },
    };
  }

  // 4. Update status
  await updateJob(job.id, { status: 'provisioning' });

  // 5. Provision Drive folders
  const driveResult = await provisionJobFolders({
    companyId: job.companyId,
    jobCode: job.jobCode,
    projectName: job.projectName,
  });

  if (!driveResult.ok) {
    await updateJob(job.id, {
      status: 'error',
      driveProvisioningError: driveResult.error?.message || 'Unknown error',
    });

    return {
      ok: false,
      job,
      error: {
        code: driveResult.error?.code || 'DRIVE_PROVISIONING_FAILED',
        message: driveResult.error?.message || 'Failed to provision Drive folders.',
        phase: 'drive_provisioning',
        howToFix: driveResult.error?.howToFix,
      },
    };
  }

  // 6. Update job
  const updatedJob = await updateJob(job.id, {
    status: 'ready',
    driveJobFolderId: driveResult.jobFolderId,
    driveJobFolderUrl: driveResult.jobFolderUrl,
    driveProvisionedAt: new Date().toISOString(),
    driveProvisioningError: null,
  });

  console.log(`[ProvisionJob] ✅ Drive provisioned for existing job ${job.jobCode}`);

  return {
    ok: true,
    job: updatedJob || job,
    subfolders: driveResult.subfolders,
  };
}
