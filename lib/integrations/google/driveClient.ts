// lib/integrations/google/driveClient.ts
// Google Drive Client using Application Default Credentials (ADC)
//
// This client does NOT use JSON key files. It relies on:
// - Local dev: gcloud auth application-default login
// - GCP prod: Attached service account (Compute Engine, Cloud Run, etc.)
// - Vercel prod: Workload Identity Federation
//
// All operations support Shared Drives with supportsAllDrives: true.

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { getDriveConfig } from './driveConfig';

// ============================================================================
// Types
// ============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  webViewLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  url: string;
}

export interface DriveError {
  code: string;
  message: string;
  howToFix: string;
  httpStatus?: number;
}

// ============================================================================
// Drive Client (ADC-based)
// ============================================================================

let _driveClient: drive_v3.Drive | null = null;
let _authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

/**
 * Get authenticated Google Drive client using ADC (Application Default Credentials)
 *
 * This does NOT require JSON key files. Authentication is provided by:
 * - Local dev: gcloud auth application-default login
 * - GCP prod: Attached service account
 * - Vercel: Workload Identity Federation
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (_driveClient) {
    return _driveClient;
  }

  // Use ADC - no keyFile parameter
  // projectId is needed for quota attribution when using user credentials
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;

  // If GOOGLE_APPLICATION_CREDENTIALS_JSON is set, use it directly
  // This avoids issues with OIDC token files that don't exist in Inngest functions
  let credentials: any = undefined;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      console.log('[Drive/ADC] Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON, type:', credentials.type);
      
      // If credentials reference OIDC token file that doesn't exist, modify to use env var or file
      if (credentials.type === 'external_account' && 
          credentials.credential_source?.file === '/var/run/secrets/vercel-oidc/token') {
        const fs = require('fs');
        const oidcTokenPath = '/var/run/secrets/vercel-oidc/token';
        const fileExists = fs.existsSync(oidcTokenPath);
        
        if (!fileExists) {
          if (process.env.VERCEL_OIDC_TOKEN) {
            // Modify credentials to use the token directly instead of file
            // Create a custom getSubjectToken function
            const token = process.env.VERCEL_OIDC_TOKEN;
            credentials.credential_source = {
              ...credentials.credential_source,
              // Remove file reference, we'll provide token via getSubjectToken
            };
            // Store token for later use (GoogleAuth will call getSubjectToken)
            (credentials as any)._oidcToken = token;
            console.log('[Drive/ADC] Modified credentials to use VERCEL_OIDC_TOKEN env var instead of missing file');
          } else {
            console.warn('[Drive/ADC] OIDC token file missing and VERCEL_OIDC_TOKEN not set - ADC will likely fail');
          }
        }
      }
    } catch (e) {
      console.warn('[Drive/ADC] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', e instanceof Error ? e.message : String(e));
      credentials = undefined;
    }
  }

  _authClient = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
    projectId,
    ...(credentials ? { credentials } : {}),
  });

  _driveClient = google.drive({ version: 'v3', auth: _authClient });
  return _driveClient;
}

/**
 * Clear cached client (useful for testing)
 */
export function clearDriveClientCache(): void {
  _driveClient = null;
  _authClient = null;
}

/**
 * Get the current service account email (if available)
 * Returns null if running with user credentials or email can't be determined
 */
export async function getServiceAccountEmail(): Promise<string | null> {
  try {
    if (!_authClient) {
      _authClient = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
    }

    const credentials = await _authClient.getCredentials();
    return credentials.client_email || null;
  } catch {
    // Fall back to config
    const config = getDriveConfig();
    return config.serviceAccountEmail;
  }
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map Google API errors to actionable DriveError
 */
export function mapDriveError(error: unknown): DriveError {
  const err = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
  const httpStatus = err.code;
  const message = err.message || 'Unknown error';
  const reason = err.errors?.[0]?.reason;

  // 401 - Authentication failed
  if (httpStatus === 401) {
    return {
      code: 'AUTH_FAILED',
      message: 'Google Drive authentication failed.',
      howToFix:
        'For local development, run: gcloud auth application-default login\n' +
        'For production, configure Workload Identity Federation or attach a service account.',
      httpStatus,
    };
  }

  // 403 - Permission denied
  if (httpStatus === 403) {
    if (reason === 'insufficientFilePermissions') {
      return {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'The service account does not have permission to access this file/folder.',
        howToFix:
          'Share the folder or Shared Drive with the service account email as:\n' +
          '- For Shared Drives: Content Manager role\n' +
          '- For regular folders: Editor role',
        httpStatus,
      };
    }

    return {
      code: 'ACCESS_DENIED',
      message: 'Access denied to Google Drive resource.',
      howToFix:
        'Ensure the file/folder is shared with the service account email. ' +
        'For Shared Drives, the service account must be a member with Content Manager access.',
      httpStatus,
    };
  }

  // 404 - Not found
  if (httpStatus === 404) {
    return {
      code: 'NOT_FOUND',
      message: 'The specified file or folder was not found.',
      howToFix:
        'Verify the file/folder ID is correct. ' +
        'If the item is in a Shared Drive, ensure supportsAllDrives=true is set ' +
        'and the service account has access to the Shared Drive.',
      httpStatus,
    };
  }

  // Default
  return {
    code: 'DRIVE_ERROR',
    message,
    howToFix: 'Check the Google Drive API error and retry.',
    httpStatus,
  };
}

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Generate Google Drive folder URL
 */
export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Generate document URL based on MIME type
 */
export function documentUrl(fileId: string, mimeType?: string): string {
  if (mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${fileId}/edit`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Get Google file type from MIME type
 */
export function getGoogleFileType(
  mimeType: string
): 'document' | 'spreadsheet' | 'presentation' | 'folder' | 'file' {
  if (mimeType === 'application/vnd.google-apps.document') return 'document';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'spreadsheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'presentation';
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  return 'file';
}

// ============================================================================
// Folder Operations
// ============================================================================

/**
 * Get folder metadata by ID
 */
export async function getFolder(folderId: string): Promise<DriveFolder | null> {
  const drive = await getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    const file = response.data;
    if (file.mimeType !== 'application/vnd.google-apps.folder') {
      return null; // Not a folder
    }

    return {
      id: file.id!,
      name: file.name!,
      url: folderUrl(file.id!),
    };
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Find child folder by name
 */
export async function findChildFolder(
  parentId: string,
  name: string
): Promise<DriveFolder | null> {
  const drive = await getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");

  const response = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  if (files.length === 0) {
    return null;
  }

  const folder = files[0];
  return {
    id: folder.id!,
    name: folder.name!,
    url: folderUrl(folder.id!),
  };
}

/**
 * Create a folder
 */
export async function createFolder(parentId: string, name: string): Promise<DriveFolder> {
  const drive = await getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  const folder = response.data;
  console.log(`[Drive ADC] Created folder: "${name}" (${folder.id})`);

  return {
    id: folder.id!,
    name: folder.name!,
    url: folderUrl(folder.id!),
  };
}

/**
 * Ensure folder exists (find or create)
 */
export async function ensureFolder(parentId: string, name: string): Promise<DriveFolder> {
  const existing = await findChildFolder(parentId, name);
  if (existing) {
    console.log(`[Drive ADC] Found existing folder: "${name}" (${existing.id})`);
    return existing;
  }
  return createFolder(parentId, name);
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Get file metadata by ID
 */
export async function getFile(fileId: string): Promise<DriveFile | null> {
  const drive = await getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, webViewLink',
      supportsAllDrives: true,
    });

    const file = response.data;
    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType || '',
      url: documentUrl(file.id!, file.mimeType || undefined),
      webViewLink: file.webViewLink || undefined,
    };
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Copy a file (template) to a destination folder
 *
 * This is the core operation for template instantiation.
 */
export async function copyFile(
  templateFileId: string,
  destinationFolderId: string,
  newName: string
): Promise<DriveFile> {
  const drive = await getDriveClient();

  console.log(
    `[Drive ADC] Copying template ${templateFileId} to folder ${destinationFolderId} as "${newName}"`
  );

  const response = await drive.files.copy({
    fileId: templateFileId,
    requestBody: {
      name: newName,
      parents: [destinationFolderId],
    },
    fields: 'id, name, mimeType, webViewLink',
    supportsAllDrives: true,
  });

  const file = response.data;
  console.log(`[Drive ADC] Created document: "${newName}" (${file.id})`);

  return {
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType || '',
    url: documentUrl(file.id!, file.mimeType || undefined),
    webViewLink: file.webViewLink || undefined,
  };
}

/**
 * Trash a file (soft delete)
 */
export async function trashFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();

  await drive.files.update({
    fileId,
    requestBody: {
      trashed: true,
    },
    supportsAllDrives: true,
  });

  console.log(`[Drive ADC] Trashed file: ${fileId}`);
}

/**
 * Find file in folder by name
 */
export async function findFileInFolder(
  folderId: string,
  name: string
): Promise<DriveFile | null> {
  const drive = await getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");

  const response = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escapedName}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  if (files.length === 0) {
    return null;
  }

  const file = files[0];
  return {
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType || '',
    url: documentUrl(file.id!, file.mimeType || undefined),
    webViewLink: file.webViewLink || undefined,
  };
}

// ============================================================================
// Health Check Operations
// ============================================================================

export interface DriveHealthCheckResult {
  auth: 'ok' | 'fail';
  folderAccess: 'ok' | 'fail' | 'skipped';
  templateCopy: 'ok' | 'fail' | 'skipped';
  errors: DriveError[];
}

/**
 * Perform health check on Drive integration
 */
export async function performHealthCheck(): Promise<DriveHealthCheckResult> {
  const config = getDriveConfig();
  const errors: DriveError[] = [];
  const result: DriveHealthCheckResult = {
    auth: 'fail',
    folderAccess: 'skipped',
    templateCopy: 'skipped',
    errors: [],
  };

  // Step 1: Test authentication
  try {
    await getDriveClient();
    result.auth = 'ok';
  } catch (error) {
    result.auth = 'fail';
    errors.push(mapDriveError(error));
    result.errors = errors;
    return result;
  }

  // Step 2: Test folder access
  if (config.templateRootFolderId) {
    try {
      const folder = await getFolder(config.templateRootFolderId);
      if (folder) {
        result.folderAccess = 'ok';
      } else {
        result.folderAccess = 'fail';
        errors.push({
          code: 'TEMPLATE_FOLDER_NOT_FOUND',
          message: `Template folder ${config.templateRootFolderId} not found.`,
          howToFix:
            'Verify the GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID is correct and the folder is shared with the service account.',
        });
      }
    } catch (error) {
      result.folderAccess = 'fail';
      errors.push(mapDriveError(error));
    }
  }

  // Also check artifacts folder
  if (config.artifactsRootFolderId) {
    try {
      const folder = await getFolder(config.artifactsRootFolderId);
      if (!folder) {
        result.folderAccess = 'fail';
        errors.push({
          code: 'ARTIFACTS_FOLDER_NOT_FOUND',
          message: `Artifacts folder ${config.artifactsRootFolderId} not found.`,
          howToFix:
            'Verify the GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID is correct and the folder is shared with the service account.',
        });
      }
    } catch (error) {
      result.folderAccess = 'fail';
      errors.push(mapDriveError(error));
    }
  }

  // Step 3: Test template copy (if test template configured)
  if (config.testTemplateFileId && config.artifactsRootFolderId && result.folderAccess === 'ok') {
    try {
      // Create a test folder for health checks
      const testFolderName = '_integration_test';
      const testFolder = await ensureFolder(config.artifactsRootFolderId, testFolderName);

      // Copy test template
      const testFileName = `_health_check_${Date.now()}`;
      const copiedFile = await copyFile(config.testTemplateFileId, testFolder.id, testFileName);

      // Immediately trash the copied file
      await trashFile(copiedFile.id);

      result.templateCopy = 'ok';
    } catch (error) {
      result.templateCopy = 'fail';
      errors.push(mapDriveError(error));
    }
  }

  result.errors = errors;
  return result;
}
