// lib/os/folders/provisioning.ts
// Google Drive Folder Provisioning Service
//
// Creates and manages folder structures for clients and jobs in Google Drive.
// Uses ADC-based Drive client (no JSON keys required).
//
// Folder structure:
// WORK (from env: GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID)
// └── {Client Name}
//     └── *Projects
//         └── {JobCode} {ProjectName}
//             ├── Client Brief-Comms
//             ├── Estimate-Financials
//             ├── Timeline-Schedule
//             └── Creative
//                 ├── Assets
//                 ├── Working Files
//                 └── Final Files

import {
  ensureFolder,
  findChildFolder,
  folderUrl,
  mapDriveError,
  type DriveFolder,
  type DriveError,
} from '@/lib/integrations/google/driveClient';
import { getDriveConfig, isDriveIntegrationAvailable } from '@/lib/integrations/google/driveConfig';
import { updateCompanyDriveFolders, getCompanyById } from '@/lib/airtable/companies';
import type { CompanyRecord } from '@/lib/airtable/companies';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Root folder ID for all client folders (WORK / MAIN_CLIENT_FOLDERS)
 * Must be set in environment: GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID
 */
function getWorkRootFolderId(): string | null {
  return process.env.GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID || null;
}

// ============================================================================
// Types
// ============================================================================

export interface ProvisionClientFoldersInput {
  /** Company Airtable record ID */
  companyId: string;

  /** Company name (used for folder name) */
  companyName: string;
}

export interface ProvisionClientFoldersResult {
  ok: boolean;
  clientFolderId?: string;
  projectsFolderId?: string;
  error?: ProvisioningError;
}

export interface ProvisionJobFoldersInput {
  /** Company Airtable record ID */
  companyId: string;

  /** Job code (e.g., "117CAR") */
  jobCode: string;

  /** Project name for folder naming */
  projectName: string;
}

export interface ProvisionJobFoldersResult {
  ok: boolean;
  jobFolderId?: string;
  jobFolderUrl?: string;
  subfolders?: JobSubfolders;
  error?: ProvisioningError;
}

export interface JobSubfolders {
  clientBriefComms?: string;
  estimateFinancials?: string;
  timelineSchedule?: string;
  creative?: string;
  creativeAssets?: string;
  creativeWorkingFiles?: string;
  creativeFinalFiles?: string;
}

export interface ProvisioningError {
  code: string;
  message: string;
  howToFix?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Projects subfolder name (prefixed with * for sorting) */
const PROJECTS_FOLDER_NAME = '*Projects';

/** Job subfolder names (using hyphens for Drive compatibility) */
export const JOB_SUBFOLDER_NAMES = {
  clientBriefComms: 'Client Brief-Comms',
  estimateFinancials: 'Estimate-Financials',
  timelineSchedule: 'Timeline-Schedule',
  creative: 'Creative',
} as const;

/** Creative subfolder names */
export const CREATIVE_SUBFOLDER_NAMES = {
  assets: 'Assets',
  workingFiles: 'Working Files',
  finalFiles: 'Final Files',
} as const;

// ============================================================================
// Client Folder Provisioning
// ============================================================================

/**
 * Provision Drive folders for a client
 *
 * Creates:
 * - {ClientName} folder under CLIENTS_ROOT
 * - *Projects subfolder
 *
 * Updates the company record with the folder IDs.
 *
 * Idempotent: If folders already exist, returns existing IDs.
 */
export async function provisionClientFolders(
  input: ProvisionClientFoldersInput
): Promise<ProvisionClientFoldersResult> {
  const { companyId, companyName } = input;

  console.log(`[FolderProvisioning] Provisioning client folders for: ${companyName} (${companyId})`);

  // 1. Check Drive integration is available
  if (!isDriveIntegrationAvailable()) {
    return {
      ok: false,
      error: {
        code: 'DRIVE_NOT_AVAILABLE',
        message: 'Google Drive integration is not enabled.',
        howToFix: 'Enable Drive integration by setting GOOGLE_DRIVE_PROVIDER_ENABLED=true.',
      },
    };
  }

  // 2. Get work root folder ID
  const workRootId = getWorkRootFolderId();
  if (!workRootId) {
    return {
      ok: false,
      error: {
        code: 'MISSING_WORK_ROOT',
        message: 'GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID is not configured.',
        howToFix:
          'Set GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID to the ID of your WORK folder in Drive.',
      },
    };
  }

  try {
    // 3. Create or find client folder under WORK
    const clientFolder = await ensureFolder(workRootId, companyName);
    console.log(`[FolderProvisioning] Client folder: ${clientFolder.name} (${clientFolder.id})`);

    // 4. Create or find *Projects subfolder
    const projectsFolder = await ensureFolder(clientFolder.id, PROJECTS_FOLDER_NAME);
    console.log(`[FolderProvisioning] Projects folder: ${projectsFolder.name} (${projectsFolder.id})`);

    // 5. Update company record with folder IDs
    await updateCompanyDriveFolders(companyId, {
      driveClientFolderId: clientFolder.id,
      driveProjectsFolderId: projectsFolder.id,
    });

    console.log(`[FolderProvisioning] ✅ Client folders provisioned for ${companyName}`);

    return {
      ok: true,
      clientFolderId: clientFolder.id,
      projectsFolderId: projectsFolder.id,
    };
  } catch (error) {
    const driveError = mapDriveError(error);
    console.error(`[FolderProvisioning] ❌ Failed to provision client folders:`, driveError);
    return {
      ok: false,
      error: {
        code: driveError.code,
        message: driveError.message,
        howToFix: driveError.howToFix,
      },
    };
  }
}

/**
 * Ensure client folders exist, provisioning if needed
 *
 * Returns the Projects folder ID for use in job provisioning.
 */
export async function ensureClientFolders(companyId: string): Promise<{
  ok: boolean;
  projectsFolderId?: string;
  error?: ProvisioningError;
}> {
  // 1. Get company record
  const company = await getCompanyById(companyId);
  if (!company) {
    return {
      ok: false,
      error: {
        code: 'COMPANY_NOT_FOUND',
        message: `Company ${companyId} not found.`,
      },
    };
  }

  // 2. If already provisioned, return existing
  if (company.driveProjectsFolderId) {
    console.log(
      `[FolderProvisioning] Client already has Projects folder: ${company.driveProjectsFolderId}`
    );
    return {
      ok: true,
      projectsFolderId: company.driveProjectsFolderId,
    };
  }

  // 3. Provision client folders
  const result = await provisionClientFolders({
    companyId,
    companyName: company.name,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  return {
    ok: true,
    projectsFolderId: result.projectsFolderId,
  };
}

// ============================================================================
// Job Folder Provisioning
// ============================================================================

/**
 * Provision Drive folders for a job
 *
 * Creates:
 * - {JobCode} {ProjectName} folder under *Projects
 * - Subfolders: Client Brief-Comms, Estimate-Financials, Timeline-Schedule, Creative
 * - Creative subfolders: Assets, Working Files, Final Files
 *
 * Requires client folders to be provisioned first (or uses existing).
 *
 * Idempotent: If folders already exist, returns existing IDs.
 */
export async function provisionJobFolders(
  input: ProvisionJobFoldersInput
): Promise<ProvisionJobFoldersResult> {
  const { companyId, jobCode, projectName } = input;

  console.log(`[FolderProvisioning] Provisioning job folders for: ${jobCode} ${projectName}`);

  // 1. Ensure client folders exist
  const clientResult = await ensureClientFolders(companyId);
  if (!clientResult.ok || !clientResult.projectsFolderId) {
    return {
      ok: false,
      error: clientResult.error || {
        code: 'CLIENT_FOLDERS_MISSING',
        message: 'Could not provision or find client folders.',
      },
    };
  }

  const projectsFolderId = clientResult.projectsFolderId;

  try {
    // 2. Create job folder: "{JobCode} {ProjectName}"
    const jobFolderName = `${jobCode} ${projectName}`;
    const jobFolder = await ensureFolder(projectsFolderId, jobFolderName);
    console.log(`[FolderProvisioning] Job folder: ${jobFolder.name} (${jobFolder.id})`);

    // 3. Create subfolders in parallel
    const [clientBriefComms, estimateFinancials, timelineSchedule, creative] = await Promise.all([
      ensureFolder(jobFolder.id, JOB_SUBFOLDER_NAMES.clientBriefComms),
      ensureFolder(jobFolder.id, JOB_SUBFOLDER_NAMES.estimateFinancials),
      ensureFolder(jobFolder.id, JOB_SUBFOLDER_NAMES.timelineSchedule),
      ensureFolder(jobFolder.id, JOB_SUBFOLDER_NAMES.creative),
    ]);

    // 4. Create Creative subfolders in parallel
    const [creativeAssets, creativeWorkingFiles, creativeFinalFiles] = await Promise.all([
      ensureFolder(creative.id, CREATIVE_SUBFOLDER_NAMES.assets),
      ensureFolder(creative.id, CREATIVE_SUBFOLDER_NAMES.workingFiles),
      ensureFolder(creative.id, CREATIVE_SUBFOLDER_NAMES.finalFiles),
    ]);

    console.log(`[FolderProvisioning] ✅ Job folders provisioned for ${jobCode}`);

    return {
      ok: true,
      jobFolderId: jobFolder.id,
      jobFolderUrl: folderUrl(jobFolder.id),
      subfolders: {
        clientBriefComms: clientBriefComms.id,
        estimateFinancials: estimateFinancials.id,
        timelineSchedule: timelineSchedule.id,
        creative: creative.id,
        creativeAssets: creativeAssets.id,
        creativeWorkingFiles: creativeWorkingFiles.id,
        creativeFinalFiles: creativeFinalFiles.id,
      },
    };
  } catch (error) {
    const driveError = mapDriveError(error);
    console.error(`[FolderProvisioning] ❌ Failed to provision job folders:`, driveError);
    return {
      ok: false,
      error: {
        code: driveError.code,
        message: driveError.message,
        howToFix: driveError.howToFix,
      },
    };
  }
}

// ============================================================================
// Template Destination Resolution
// ============================================================================

/**
 * Template destination folder types
 *
 * Maps template document types to their destination subfolders.
 */
export type TemplateDestinationType =
  | 'client_brief_comms'
  | 'estimate_financials'
  | 'timeline_schedule'
  | 'creative'
  | 'job_root';

/**
 * Map template document type to destination folder type
 */
export function mapDocumentTypeToDestination(
  documentType: string
): TemplateDestinationType {
  switch (documentType.toUpperCase()) {
    case 'SOW':
    case 'ESTIMATE':
    case 'INVOICE':
    case 'QUOTE':
      return 'estimate_financials';

    case 'BRIEF':
    case 'COMMS':
    case 'EMAIL':
      return 'client_brief_comms';

    case 'TIMELINE':
    case 'SCHEDULE':
    case 'GANTT':
      return 'timeline_schedule';

    case 'CREATIVE':
    case 'DESIGN':
    case 'ASSET':
      return 'creative';

    default:
      return 'job_root';
  }
}

/**
 * Get destination folder ID for a template based on job and document type
 */
export async function getTemplateDestinationFolder(
  jobFolderId: string,
  documentType: string
): Promise<{ folderId: string; folderName: string } | null> {
  const destination = mapDocumentTypeToDestination(documentType);

  // Job root doesn't need subfolder lookup
  if (destination === 'job_root') {
    return { folderId: jobFolderId, folderName: 'Job Root' };
  }

  // Map destination to subfolder name
  const subfolderNameMap: Record<TemplateDestinationType, string> = {
    client_brief_comms: JOB_SUBFOLDER_NAMES.clientBriefComms,
    estimate_financials: JOB_SUBFOLDER_NAMES.estimateFinancials,
    timeline_schedule: JOB_SUBFOLDER_NAMES.timelineSchedule,
    creative: JOB_SUBFOLDER_NAMES.creative,
    job_root: '',
  };

  const subfolderName = subfolderNameMap[destination];
  if (!subfolderName) {
    return { folderId: jobFolderId, folderName: 'Job Root' };
  }

  // Find the subfolder
  const subfolder = await findChildFolder(jobFolderId, subfolderName);
  if (!subfolder) {
    console.warn(
      `[FolderProvisioning] Subfolder "${subfolderName}" not found in job folder ${jobFolderId}`
    );
    return { folderId: jobFolderId, folderName: 'Job Root' };
  }

  return { folderId: subfolder.id, folderName: subfolderName };
}

// ============================================================================
// Lookup Helpers
// ============================================================================

/**
 * Find job folder by job code within a company's projects folder
 */
export async function findJobFolder(
  projectsFolderId: string,
  jobCode: string
): Promise<DriveFolder | null> {
  // Job folders are named "{JobCode} {ProjectName}"
  // We need to search for folders starting with the job code
  // Note: This is a simplified implementation that assumes exact matching
  // In production, you might want to use a list + filter approach

  // For now, we'll rely on the job record having the folder ID stored
  // This function is provided for manual lookups or migrations
  console.warn(
    `[FolderProvisioning] findJobFolder not fully implemented - use job.driveJobFolderId instead`
  );
  return null;
}

/**
 * Get folder info from company (with caching via Airtable)
 */
export async function getCompanyFolderInfo(companyId: string): Promise<{
  clientFolderId: string | null;
  projectsFolderId: string | null;
  clientFolderUrl: string | null;
  projectsFolderUrl: string | null;
}> {
  const company = await getCompanyById(companyId);

  return {
    clientFolderId: company?.driveClientFolderId || null,
    projectsFolderId: company?.driveProjectsFolderId || null,
    clientFolderUrl: company?.driveClientFolderId
      ? folderUrl(company.driveClientFolderId)
      : null,
    projectsFolderUrl: company?.driveProjectsFolderId
      ? folderUrl(company.driveProjectsFolderId)
      : null,
  };
}
