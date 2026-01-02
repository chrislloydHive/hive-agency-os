// lib/os/artifacts/instantiateFromTemplate.ts
// Template Instantiation via Google Drive
//
// Creates new artifacts by copying Google Drive templates.
// Uses ADC-based Drive client (no JSON keys required).
//
// Supports two modes:
// 1. Simple mode: Places artifacts in company's artifacts folder
// 2. Job mode: Places artifacts in the job's subfolder structure based on document type

import {
  getDriveConfig,
  isDriveIntegrationAvailable,
} from '@/lib/integrations/google/driveConfig';
import {
  copyFile,
  ensureFolder,
  getGoogleFileType,
  mapDriveError,
  type DriveFile,
  type DriveError,
} from '@/lib/integrations/google/driveClient';
import { createArtifact } from '@/lib/airtable/artifacts';
import { getCompanyById } from '@/lib/airtable/companies';
import { getJobById } from '@/lib/airtable/jobs';
import { getTemplateById } from '@/lib/airtable/templates';
import { getTemplateDestinationFolder } from '@/lib/os/folders/provisioning';
import type { Artifact, ArtifactType, GoogleFileType } from '@/lib/types/artifact';
import type { TemplateRecord } from '@/lib/types/template';

// ============================================================================
// Types
// ============================================================================

export interface InstantiateTemplateInput {
  /** Company ID for the artifact */
  companyId: string;

  /** Template ID to instantiate (Airtable record ID) */
  templateId: string;

  /** Optional custom title (overrides template naming pattern) */
  customTitle?: string;

  /** Optional job code for naming */
  jobCode?: string;

  /**
   * Optional job ID for folder routing
   * When provided, the artifact is placed in the job's subfolder
   * based on the template's document type
   */
  jobId?: string;

  /** Who is creating this artifact */
  createdBy?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface InstantiateTemplateResult {
  ok: boolean;
  artifact?: Artifact;
  driveFile?: DriveFile;
  /** The folder where the document was placed */
  destinationFolder?: {
    id: string;
    name: string;
  };
  error?: InstantiateTemplateError;
}

export interface InstantiateTemplateError {
  code: string;
  message: string;
  howToFix?: string;
}

// ============================================================================
// Template Instantiation
// ============================================================================

/**
 * Instantiate an artifact from a template
 *
 * This function:
 * 1. Validates Drive integration is available
 * 2. Loads the template from Airtable
 * 3. Determines destination folder (job subfolder or company folder)
 * 4. Copies the template to the destination folder
 * 5. Creates an artifact record in Airtable
 *
 * Folder routing:
 * - If jobId is provided, routes to job's subfolder based on template.documentType
 * - Otherwise, uses company's artifacts folder (legacy mode)
 */
export async function instantiateFromTemplate(
  input: InstantiateTemplateInput
): Promise<InstantiateTemplateResult> {
  const { companyId, templateId, customTitle, jobCode, jobId, createdBy } = input;

  console.log(
    `[InstantiateTemplate] Starting for company=${companyId}, template=${templateId}${jobId ? `, job=${jobId}` : ''}`
  );

  // 1. Check Drive integration is available
  if (!isDriveIntegrationAvailable()) {
    return {
      ok: false,
      error: {
        code: 'DRIVE_NOT_AVAILABLE',
        message: 'Google Drive integration is not enabled or configured.',
        howToFix:
          'Enable Drive integration by setting GOOGLE_DRIVE_PROVIDER_ENABLED=true and configuring folder IDs.',
      },
    };
  }

  const config = getDriveConfig();

  // 2. Load the template
  const template = await getTemplateById(templateId);
  if (!template) {
    return {
      ok: false,
      error: {
        code: 'TEMPLATE_NOT_FOUND',
        message: `Template ${templateId} not found.`,
      },
    };
  }

  if (!template.driveTemplateFileId) {
    return {
      ok: false,
      error: {
        code: 'TEMPLATE_NO_DRIVE_FILE',
        message: `Template "${template.name}" has no Drive template file configured.`,
        howToFix: 'Configure the Drive Template File ID for this template in Airtable.',
      },
    };
  }

  // 3. Load company info for folder naming
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

  // 4. Determine destination folder
  let destinationFolderId: string;
  let destinationFolderName = 'Artifacts';

  // If job is provided, route to job's subfolder based on document type
  if (jobId) {
    const job = await getJobById(jobId);
    if (!job) {
      return {
        ok: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found.`,
        },
      };
    }

    if (!job.driveJobFolderId) {
      return {
        ok: false,
        error: {
          code: 'JOB_NO_DRIVE_FOLDER',
          message: `Job ${job.jobCode} does not have a Drive folder provisioned.`,
          howToFix: 'Provision Drive folders for this job first.',
        },
      };
    }

    // Get destination subfolder based on template document type
    try {
      const destination = await getTemplateDestinationFolder(
        job.driveJobFolderId,
        template.documentType
      );

      if (destination) {
        destinationFolderId = destination.folderId;
        destinationFolderName = destination.folderName;
        console.log(
          `[InstantiateTemplate] Routing to job subfolder: ${destinationFolderName} (${destinationFolderId})`
        );
      } else {
        // Fallback to job root folder
        destinationFolderId = job.driveJobFolderId;
        destinationFolderName = 'Job Root';
      }
    } catch (error) {
      const driveError = mapDriveError(error);
      console.error('[InstantiateTemplate] Failed to find job subfolder:', driveError);
      return {
        ok: false,
        error: {
          code: driveError.code,
          message: driveError.message,
          howToFix: driveError.howToFix,
        },
      };
    }
  } else {
    // Legacy mode: use company's artifacts folder
    destinationFolderId = config.artifactsRootFolderId!;

    // Create company folder if using that strategy
    if (config.companyFolderStrategy === 'create_company_folders') {
      try {
        // Use company name or ID for folder name
        const companyFolderName = company.name || companyId;
        const companyFolder = await ensureFolder(destinationFolderId, companyFolderName);

        // Create an Artifacts subfolder
        const artifactsFolder = await ensureFolder(companyFolder.id, 'Artifacts');
        destinationFolderId = artifactsFolder.id;
        destinationFolderName = 'Artifacts';
      } catch (error) {
        const driveError = mapDriveError(error);
        console.error('[InstantiateTemplate] Failed to create company folder:', driveError);
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
  }

  // 5. Generate document name
  const documentName = generateDocumentName(template, customTitle, jobCode, company.name);

  // 6. Copy template to destination
  let driveFile: DriveFile;
  try {
    driveFile = await copyFile(template.driveTemplateFileId, destinationFolderId, documentName);
  } catch (error) {
    const driveError = mapDriveError(error);
    console.error('[InstantiateTemplate] Failed to copy template:', driveError);
    return {
      ok: false,
      error: {
        code: driveError.code,
        message: driveError.message,
        howToFix: driveError.howToFix,
      },
    };
  }

  // 7. Create artifact record in Airtable
  const artifactType = mapTemplateToArtifactType(template);
  const googleFileType = getGoogleFileType(driveFile.mimeType) as GoogleFileType;

  const artifact = await createArtifact({
    companyId,
    title: documentName,
    type: artifactType,
    source: 'template',
    googleFileId: driveFile.id,
    googleFileType,
    googleFileUrl: driveFile.webViewLink || driveFile.url,
    googleFolderId: destinationFolderId,
    createdBy: createdBy || 'system',
    description: `Created from template: ${template.name}`,
    tags: ['from-template', template.scope],
  });

  if (!artifact) {
    // Drive file was created but Airtable record failed
    // Log error but still return the Drive file info
    console.error(
      '[InstantiateTemplate] Created Drive file but failed to create Airtable artifact record'
    );
    return {
      ok: false,
      driveFile,
      error: {
        code: 'AIRTABLE_CREATE_FAILED',
        message: 'Created document in Drive but failed to save artifact record.',
        howToFix: 'Check Airtable configuration and try again.',
      },
    };
  }

  console.log(`[InstantiateTemplate] Successfully created artifact ${artifact.id} from template`);

  return {
    ok: true,
    artifact,
    driveFile,
    destinationFolder: {
      id: destinationFolderId,
      name: destinationFolderName,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate document name from template naming pattern
 */
function generateDocumentName(
  template: TemplateRecord,
  customTitle: string | undefined,
  jobCode: string | undefined,
  companyName: string
): string {
  // Use custom title if provided
  if (customTitle) {
    return customTitle;
  }

  // Use template naming pattern
  let name = template.namingPattern || template.name;

  // Replace placeholders
  name = name.replace(/\{companyName\}/gi, companyName);
  name = name.replace(/\{jobCode\}/gi, jobCode || 'DRAFT');
  name = name.replace(/\{date\}/gi, new Date().toISOString().split('T')[0]);
  name = name.replace(/\{documentType\}/gi, template.documentType);

  return name;
}

/**
 * Map template document type to artifact type
 */
function mapTemplateToArtifactType(template: TemplateRecord): ArtifactType {
  switch (template.documentType) {
    case 'SOW':
      return 'strategy_doc';
    case 'BRIEF':
      return 'brief_doc';
    case 'TIMELINE':
      return 'custom';
    case 'MSA':
      return 'custom';
    default:
      return 'custom';
  }
}

// ============================================================================
// Batch Instantiation
// ============================================================================

export interface BatchInstantiateInput {
  companyId: string;
  templateIds: string[];
  jobCode?: string;
  createdBy?: string;
}

export interface BatchInstantiateResult {
  ok: boolean;
  results: InstantiateTemplateResult[];
  successCount: number;
  failureCount: number;
}

/**
 * Instantiate multiple templates at once
 */
export async function batchInstantiateFromTemplates(
  input: BatchInstantiateInput
): Promise<BatchInstantiateResult> {
  const { companyId, templateIds, jobCode, createdBy } = input;

  const results: InstantiateTemplateResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const templateId of templateIds) {
    const result = await instantiateFromTemplate({
      companyId,
      templateId,
      jobCode,
      createdBy,
    });

    results.push(result);

    if (result.ok) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return {
    ok: failureCount === 0,
    results,
    successCount,
    failureCount,
  };
}
