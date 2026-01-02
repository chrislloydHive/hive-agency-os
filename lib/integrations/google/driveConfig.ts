// lib/integrations/google/driveConfig.ts
// Google Drive Integration Configuration
//
// Supports configuration via environment variables.
// This module does NOT use JSON key files - it relies on ADC (Application Default Credentials).

// ============================================================================
// Types
// ============================================================================

export interface DriveIntegrationConfig {
  /** Feature flag to enable/disable Drive integration */
  enabled: boolean;

  /** Template root folder ID (where templates live in Drive) */
  templateRootFolderId: string | null;

  /** Artifacts root folder ID (where created docs are stored) - legacy mode */
  artifactsRootFolderId: string | null;

  /**
   * Work root folder ID (MAIN_CLIENT_FOLDERS in Apps Script)
   * Structure: WORK/{ClientName}/*Projects/{JobCode} {ProjectName}/...
   */
  workRootFolderId: string | null;

  /** Optional: Shared Drive ID if templates/artifacts are in a Shared Drive */
  sharedDriveId: string | null;

  /** Test template file ID for health check verification */
  testTemplateFileId: string | null;

  /** Service account email (display-only, for sharing instructions) */
  serviceAccountEmail: string | null;

  /** Company folder strategy: 'create_company_folders' | 'flat' */
  companyFolderStrategy: 'create_company_folders' | 'flat';
}

export interface DriveConfigValidation {
  valid: boolean;
  errors: DriveConfigError[];
  warnings: DriveConfigWarning[];
}

export interface DriveConfigError {
  code: string;
  field: string;
  message: string;
  howToFix: string;
}

export interface DriveConfigWarning {
  code: string;
  message: string;
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load Drive integration configuration from environment variables
 */
export function getDriveConfig(): DriveIntegrationConfig {
  return {
    enabled: process.env.GOOGLE_DRIVE_PROVIDER_ENABLED === 'true',
    templateRootFolderId: process.env.GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID || null,
    artifactsRootFolderId: process.env.GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID || null,
    workRootFolderId: process.env.GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID || null,
    sharedDriveId: process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null,
    testTemplateFileId: process.env.GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID || null,
    serviceAccountEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || null,
    companyFolderStrategy:
      (process.env.GOOGLE_DRIVE_COMPANY_FOLDER_STRATEGY as 'create_company_folders' | 'flat') ||
      'create_company_folders',
  };
}

/**
 * Validate Drive configuration
 */
export function validateDriveConfig(config: DriveIntegrationConfig): DriveConfigValidation {
  const errors: DriveConfigError[] = [];
  const warnings: DriveConfigWarning[] = [];

  // If not enabled, skip validation
  if (!config.enabled) {
    return {
      valid: true,
      errors: [],
      warnings: [
        {
          code: 'DISABLED',
          message: 'Google Drive integration is disabled. Set GOOGLE_DRIVE_PROVIDER_ENABLED=true to enable.',
        },
      ],
    };
  }

  // Required: template root folder
  if (!config.templateRootFolderId) {
    errors.push({
      code: 'MISSING_TEMPLATE_ROOT',
      field: 'templateRootFolderId',
      message: 'Template root folder ID is not configured.',
      howToFix:
        'Set GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID to the Drive folder ID containing your templates.',
    });
  }

  // Required: artifacts root folder
  if (!config.artifactsRootFolderId) {
    errors.push({
      code: 'MISSING_ARTIFACTS_ROOT',
      field: 'artifactsRootFolderId',
      message: 'Artifacts root folder ID is not configured.',
      howToFix:
        'Set GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID to the Drive folder ID where created documents will be stored.',
    });
  }

  // Warning: no test template for health check
  if (!config.testTemplateFileId) {
    warnings.push({
      code: 'NO_TEST_TEMPLATE',
      message:
        'No test template file configured. Health checks will skip copy verification. Set GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID for complete health checks.',
    });
  }

  // Warning: no service account email for instructions
  if (!config.serviceAccountEmail) {
    warnings.push({
      code: 'NO_SERVICE_ACCOUNT_EMAIL',
      message:
        'Service account email not configured. Users will not see sharing instructions. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL for better UX.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if Drive integration is available (enabled + required config present)
 */
export function isDriveIntegrationAvailable(): boolean {
  const config = getDriveConfig();
  if (!config.enabled) return false;
  if (!config.templateRootFolderId) return false;
  if (!config.artifactsRootFolderId) return false;
  return true;
}

// ============================================================================
// Environment Variable Reference
// ============================================================================

/**
 * All environment variables used by this module:
 *
 * Required for operation:
 * - GOOGLE_DRIVE_PROVIDER_ENABLED=true|false
 * - GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID=<folder_id>
 * - GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID=<folder_id> (legacy mode)
 *
 * For job-based folder provisioning:
 * - GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID=<folder_id>
 *   The root folder containing all client folders (WORK / MAIN_CLIENT_FOLDERS)
 *   Structure: WORK/{ClientName}/*Projects/{JobCode} {ProjectName}/...
 *
 * Optional:
 * - GOOGLE_DRIVE_SHARED_DRIVE_ID=<shared_drive_id>
 * - GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID=<file_id>
 * - GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=<email@project.iam.gserviceaccount.com>
 * - GOOGLE_DRIVE_COMPANY_FOLDER_STRATEGY=create_company_folders|flat
 *
 * Authentication (ADC):
 * - Local dev: Run `gcloud auth application-default login`
 * - GCP prod: Attach service account to runtime
 * - Vercel prod: Use Workload Identity Federation
 */
