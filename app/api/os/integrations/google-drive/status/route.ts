// app/api/os/integrations/google-drive/status/route.ts
// Google Drive Integration Status Endpoint
//
// Returns the current status of Google Drive integration including:
// - Whether it's enabled
// - Authentication mode (ADC)
// - Health check results (auth, folder access, template copy)
// - Actionable error messages
//
// GET /api/os/integrations/google-drive/status

import { NextRequest, NextResponse } from 'next/server';
import {
  getDriveConfig,
  validateDriveConfig,
  type DriveIntegrationConfig,
  type DriveConfigError,
} from '@/lib/integrations/google/driveConfig';
import {
  performHealthCheck,
  getServiceAccountEmail,
  type DriveHealthCheckResult,
  type DriveError,
} from '@/lib/integrations/google/driveClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface DriveStatusResponse {
  /** Whether integration is enabled and operational */
  enabled: boolean;

  /** Authentication mode */
  mode: 'adc';

  /** Service account email (for sharing instructions) */
  serviceAccountEmail: string | null;

  /** Configuration validation */
  configValid: boolean;

  /** Health check results */
  checks: {
    auth: 'ok' | 'fail' | 'skipped';
    folderAccess: 'ok' | 'fail' | 'skipped';
    templateCopy: 'ok' | 'fail' | 'skipped';
  };

  /** All errors (config + health check) */
  errors: Array<{
    code: string;
    message: string;
    howToFix: string;
  }>;

  /** Setup instructions for admins */
  setupInstructions?: SetupInstructions;
}

interface SetupInstructions {
  /** Steps to enable Drive integration */
  steps: SetupStep[];
  /** Documentation URL */
  docsUrl?: string;
}

interface SetupStep {
  number: number;
  title: string;
  description: string;
  command?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(_request: NextRequest) {
  try {
    // Load configuration
    const config = getDriveConfig();
    const validation = validateDriveConfig(config);

    // Get service account email
    let serviceAccountEmail: string | null = null;
    try {
      serviceAccountEmail = await getServiceAccountEmail();
    } catch {
      // Best effort - fall back to config value
      serviceAccountEmail = config.serviceAccountEmail;
    }

    // If not enabled or config invalid, return early with setup instructions
    if (!config.enabled || !validation.valid) {
      const response: DriveStatusResponse = {
        enabled: false,
        mode: 'adc',
        serviceAccountEmail,
        configValid: validation.valid,
        checks: {
          auth: 'skipped',
          folderAccess: 'skipped',
          templateCopy: 'skipped',
        },
        errors: validation.errors.map((e) => ({
          code: e.code,
          message: e.message,
          howToFix: e.howToFix,
        })),
        setupInstructions: buildSetupInstructions(config, serviceAccountEmail),
      };

      return NextResponse.json(response);
    }

    // Perform health check
    let healthCheck: DriveHealthCheckResult;
    try {
      healthCheck = await performHealthCheck();
    } catch (error) {
      console.error('[Drive Status] Health check failed:', error);
      healthCheck = {
        auth: 'fail',
        folderAccess: 'skipped',
        templateCopy: 'skipped',
        errors: [
          {
            code: 'HEALTH_CHECK_FAILED',
            message: error instanceof Error ? error.message : 'Health check failed',
            howToFix: 'Check server logs for details.',
          },
        ],
      };
    }

    // Determine overall status
    const allChecksPass =
      healthCheck.auth === 'ok' &&
      (healthCheck.folderAccess === 'ok' || healthCheck.folderAccess === 'skipped') &&
      (healthCheck.templateCopy === 'ok' || healthCheck.templateCopy === 'skipped');

    const response: DriveStatusResponse = {
      enabled: allChecksPass,
      mode: 'adc',
      serviceAccountEmail,
      configValid: true,
      checks: {
        auth: healthCheck.auth,
        folderAccess: healthCheck.folderAccess,
        templateCopy: healthCheck.templateCopy,
      },
      errors: healthCheck.errors.map((e) => ({
        code: e.code,
        message: e.message,
        howToFix: e.howToFix,
      })),
    };

    // Include setup instructions if not fully enabled
    if (!allChecksPass) {
      response.setupInstructions = buildSetupInstructions(config, serviceAccountEmail);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Drive Status] Error:', error);

    return NextResponse.json(
      {
        enabled: false,
        mode: 'adc',
        serviceAccountEmail: null,
        configValid: false,
        checks: {
          auth: 'fail',
          folderAccess: 'skipped',
          templateCopy: 'skipped',
        },
        errors: [
          {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal error',
            howToFix: 'Check server logs for details.',
          },
        ],
      } satisfies DriveStatusResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// Setup Instructions Builder
// ============================================================================

function buildSetupInstructions(
  config: DriveIntegrationConfig,
  serviceAccountEmail: string | null
): SetupInstructions {
  const steps: SetupStep[] = [];
  let stepNumber = 1;

  // Step: Enable the feature flag
  if (!config.enabled) {
    steps.push({
      number: stepNumber++,
      title: 'Enable Google Drive integration',
      description: 'Set the environment variable to enable Drive integration.',
      command: 'GOOGLE_DRIVE_PROVIDER_ENABLED=true',
    });
  }

  // Step: Configure folder IDs
  if (!config.templateRootFolderId) {
    steps.push({
      number: stepNumber++,
      title: 'Configure template folder',
      description:
        'Create a folder in Google Drive for templates and set its ID. ' +
        'Get the folder ID from the URL: drive.google.com/drive/folders/<FOLDER_ID>',
      command: 'GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID=<your_folder_id>',
    });
  }

  if (!config.artifactsRootFolderId) {
    steps.push({
      number: stepNumber++,
      title: 'Configure artifacts folder',
      description:
        'Create a folder in Google Drive for generated documents and set its ID.',
      command: 'GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID=<your_folder_id>',
    });
  }

  // Step: Share folders with service account
  if (serviceAccountEmail) {
    steps.push({
      number: stepNumber++,
      title: 'Share folders with service account',
      description:
        `Share your template and artifacts folders (or Shared Drive) with the service account email:\n\n` +
        `${serviceAccountEmail}\n\n` +
        `For Shared Drives: Add as Content Manager\n` +
        `For regular folders: Add as Editor\n\n` +
        `Do NOT add the service account as a Google Workspace user - just share the folder/drive with it.`,
    });
  } else {
    steps.push({
      number: stepNumber++,
      title: 'Configure service account email',
      description:
        'Set the service account email so users can see sharing instructions.',
      command: 'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=<your-sa>@<project>.iam.gserviceaccount.com',
    });
  }

  // Step: Authentication setup
  steps.push({
    number: stepNumber++,
    title: 'Configure authentication',
    description:
      'For local development:\n' +
      '  Run: gcloud auth application-default login\n\n' +
      'For production on GCP:\n' +
      '  Attach the service account to your runtime (Compute Engine, Cloud Run, etc.)\n\n' +
      'For production on Vercel:\n' +
      '  Configure Workload Identity Federation (see documentation)',
  });

  // Optional: Test template
  if (!config.testTemplateFileId) {
    steps.push({
      number: stepNumber++,
      title: '(Optional) Configure test template',
      description:
        'For comprehensive health checks, provide a test template file ID. ' +
        'This allows the system to verify template copying works.',
      command: 'GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID=<your_template_file_id>',
    });
  }

  return {
    steps,
    docsUrl: '/docs/integrations/google-drive',
  };
}
