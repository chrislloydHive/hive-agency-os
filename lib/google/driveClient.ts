// lib/google/driveClient.ts
// Google Drive client for job folder provisioning
//
// Uses a service account to create folders in Shared Drives.
// All operations support Shared Drives with supportsAllDrives: true.

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';

// ============================================================================
// Types
// ============================================================================

export interface DriveFolder {
  id: string;
  name: string;
  url: string;
}

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get service account credentials from environment
 */
function getServiceAccountCredentials(): ServiceAccountCredentials {
  // Try full JSON first
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        project_id: parsed.project_id,
      };
    } catch (error) {
      console.error('[Drive] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', error);
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
    }
  }

  // Fall back to individual fields
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or ' +
        'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
  }

  return {
    client_email: clientEmail,
    // Handle escaped newlines in private key
    private_key: privateKey.replace(/\\n/g, '\n'),
  };
}

// ============================================================================
// Drive Client
// ============================================================================

let _driveClient: drive_v3.Drive | null = null;

/**
 * Get authenticated Google Drive client
 */
export function getDriveClient(): drive_v3.Drive {
  if (_driveClient) {
    return _driveClient;
  }

  const credentials = getServiceAccountCredentials();

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  _driveClient = google.drive({ version: 'v3', auth });
  return _driveClient;
}

/**
 * Generate Drive folder URL from folder ID
 */
export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ============================================================================
// Folder Operations
// ============================================================================

/**
 * Find a folder by exact name under a parent folder
 *
 * @param parentId - Parent folder ID
 * @param name - Exact folder name to find
 * @returns Folder if found, null otherwise
 */
export async function findChildFolder(
  parentId: string,
  name: string
): Promise<DriveFolder | null> {
  const drive = getDriveClient();

  try {
    // Escape single quotes in the name for the query
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
  } catch (error: any) {
    console.error(`[Drive] Error finding folder "${name}" under ${parentId}:`, error?.message || error);
    throw error;
  }
}

/**
 * Create a folder under a parent folder
 *
 * @param parentId - Parent folder ID
 * @param name - Folder name (can contain "/" and other special characters)
 * @returns Created folder
 */
export async function createFolder(
  parentId: string,
  name: string
): Promise<DriveFolder> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name',
      supportsAllDrives: true,
    });

    const folder = response.data;
    console.log(`[Drive] Created folder: "${name}" (${folder.id})`);

    return {
      id: folder.id!,
      name: folder.name!,
      url: folderUrl(folder.id!),
    };
  } catch (error: any) {
    console.error(`[Drive] Error creating folder "${name}" under ${parentId}:`, error?.message || error);
    throw error;
  }
}

/**
 * Ensure a folder exists under a parent folder (find or create)
 *
 * This is the primary idempotent operation for folder provisioning.
 *
 * @param parentId - Parent folder ID
 * @param name - Folder name (can contain "/" and other special characters)
 * @returns Folder (existing or newly created)
 */
export async function ensureChildFolder(
  parentId: string,
  name: string
): Promise<DriveFolder> {
  // First, try to find existing folder
  const existing = await findChildFolder(parentId, name);
  if (existing) {
    console.log(`[Drive] Found existing folder: "${name}" (${existing.id})`);
    return existing;
  }

  // Create if not found
  return createFolder(parentId, name);
}

/**
 * List child folders under a parent folder
 *
 * @param parentId - Parent folder ID
 * @returns List of child folders
 */
export async function listChildFolders(parentId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'name',
    });

    const files = response.data.files || [];
    return files.map((f) => ({
      id: f.id!,
      name: f.name!,
      url: folderUrl(f.id!),
    }));
  } catch (error: any) {
    console.error(`[Drive] Error listing folders under ${parentId}:`, error?.message || error);
    throw error;
  }
}

/**
 * Get folder metadata by ID
 *
 * @param folderId - Folder ID
 * @returns Folder metadata or null if not found
 */
export async function getFolder(folderId: string): Promise<DriveFolder | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name',
      supportsAllDrives: true,
    });

    const folder = response.data;
    return {
      id: folder.id!,
      name: folder.name!,
      url: folderUrl(folder.id!),
    };
  } catch (error: any) {
    if (error?.code === 404) {
      return null;
    }
    console.error(`[Drive] Error getting folder ${folderId}:`, error?.message || error);
    throw error;
  }
}

// ============================================================================
// Job Folder Provisioning
// ============================================================================

import { JOB_SUBFOLDERS, CREATIVE_SUBFOLDERS } from '@/lib/types/job';

export interface ProvisionJobFolderResult {
  jobFolder: DriveFolder;
  subfolders: Record<string, DriveFolder>;
}

/**
 * Provision complete job folder structure
 *
 * Creates the job folder and all required subfolders according to the
 * canonical structure defined in lib/types/job.ts.
 *
 * @param projectsFolderId - ID of the *Projects folder
 * @param folderName - Job folder name (e.g., "117CAR Blog Development")
 * @returns Job folder and all subfolders
 */
export async function provisionJobFolderStructure(
  projectsFolderId: string,
  folderName: string
): Promise<ProvisionJobFolderResult> {
  console.log(`[Drive] Provisioning job folder structure: "${folderName}"`);

  // 1. Create/find job folder
  const jobFolder = await ensureChildFolder(projectsFolderId, folderName);

  const subfolders: Record<string, DriveFolder> = {};

  // 2. Create top-level subfolders
  for (const subfolderName of JOB_SUBFOLDERS) {
    const subfolder = await ensureChildFolder(jobFolder.id, subfolderName);
    subfolders[subfolderName] = subfolder;

    // 3. If this is the Creative folder, create its subfolders
    if (subfolderName === 'Creative') {
      for (const creativeSubfolderName of CREATIVE_SUBFOLDERS) {
        const creativeSubfolder = await ensureChildFolder(subfolder.id, creativeSubfolderName);
        subfolders[`Creative/${creativeSubfolderName}`] = creativeSubfolder;
      }
    }
  }

  console.log(`[Drive] Provisioned job folder structure with ${Object.keys(subfolders).length} subfolders`);

  return {
    jobFolder,
    subfolders,
  };
}

/**
 * Ensure *Projects folder exists under client folder
 *
 * @param clientFolderId - ID of the client root folder (WORK/{Client Name})
 * @returns *Projects folder
 */
export async function ensureProjectsFolder(clientFolderId: string): Promise<DriveFolder> {
  return ensureChildFolder(clientFolderId, '*Projects');
}

// ============================================================================
// Document Operations (Template Copying)
// ============================================================================

export interface DriveDocument {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

/**
 * Generate Google Drive document URL from file ID
 */
export function documentUrl(fileId: string, mimeType?: string): string {
  // Google Docs have a special URL format
  if (mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }
  // Google Sheets
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }
  // Google Slides
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${fileId}/edit`;
  }
  // Default to Drive file view
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Copy any Drive file into a destination folder (for partner delivery, etc.).
 * Uses the source file's name for the copy. Supports Shared Drives.
 *
 * @param sourceFileId - Drive file ID to copy
 * @param destinationFolderId - Target folder ID
 * @returns Created copy with id, name, and view URL
 */
export async function copyFileToFolder(
  sourceFileId: string,
  destinationFolderId: string
): Promise<{ id: string; name: string; url: string }> {
  const drive = getDriveClient();

  const getRes = await drive.files.get({
    fileId: sourceFileId,
    fields: 'name, mimeType',
    supportsAllDrives: true,
  });
  const name = getRes.data.name ?? 'Copy';

  const response = await drive.files.copy({
    fileId: sourceFileId,
    requestBody: {
      name,
      parents: [destinationFolderId],
    },
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });

  const file = response.data;
  const url = documentUrl(file.id!, file.mimeType ?? undefined);
  return {
    id: file.id!,
    name: file.name ?? name,
    url,
  };
}

/**
 * Copy a Google Doc/Sheet/Slides template to a destination folder
 *
 * This is the core function for document provisioning from templates.
 *
 * @param templateFileId - Source template file ID (Google Doc, Sheet, or Slides)
 * @param destinationFolderId - Target folder ID where the copy will be placed
 * @param newName - Name for the new document (without extension)
 * @returns Created document with ID, name, and URL
 */
export async function copyDocTemplate(
  templateFileId: string,
  destinationFolderId: string,
  newName: string
): Promise<DriveDocument> {
  const drive = getDriveClient();

  try {
    console.log(`[Drive] Copying template ${templateFileId} to folder ${destinationFolderId} as "${newName}"`);

    const response = await drive.files.copy({
      fileId: templateFileId,
      requestBody: {
        name: newName,
        parents: [destinationFolderId],
      },
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    const file = response.data;
    const mimeType = file.mimeType || undefined;
    const url = documentUrl(file.id!, mimeType);

    console.log(`[Drive] Created document: "${newName}" (${file.id})`);

    return {
      id: file.id!,
      name: file.name!,
      url,
      mimeType: mimeType || '',
    };
  } catch (error: any) {
    console.error(`[Drive] Error copying template ${templateFileId}:`, error?.message || error);
    throw error;
  }
}

/**
 * Check if a document already exists in a folder by exact name
 *
 * Used to ensure idempotency when provisioning documents.
 *
 * @param folderId - Folder ID to search in
 * @param name - Exact document name to find
 * @returns Document if found, null otherwise
 */
export async function findDocumentInFolder(
  folderId: string,
  name: string
): Promise<DriveDocument | null> {
  const drive = getDriveClient();

  try {
    // Escape single quotes in the name for the query
    const escapedName = name.replace(/'/g, "\\'");

    const response = await drive.files.list({
      q: `'${folderId}' in parents and name = '${escapedName}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files || [];
    if (files.length === 0) {
      return null;
    }

    const file = files[0];
    const mimeType = file.mimeType || undefined;
    return {
      id: file.id!,
      name: file.name!,
      url: documentUrl(file.id!, mimeType),
      mimeType: mimeType || '',
    };
  } catch (error: any) {
    console.error(`[Drive] Error finding document "${name}" in ${folderId}:`, error?.message || error);
    throw error;
  }
}

/**
 * Copy a document template idempotently (find existing or create new)
 *
 * @param templateFileId - Source template file ID
 * @param destinationFolderId - Target folder ID
 * @param newName - Name for the document
 * @returns Document (existing or newly created)
 */
export async function ensureDocumentFromTemplate(
  templateFileId: string,
  destinationFolderId: string,
  newName: string
): Promise<DriveDocument> {
  // First, try to find existing document
  const existing = await findDocumentInFolder(destinationFolderId, newName);
  if (existing) {
    console.log(`[Drive] Found existing document: "${newName}" (${existing.id})`);
    return existing;
  }

  // Create if not found
  return copyDocTemplate(templateFileId, destinationFolderId, newName);
}

/**
 * Get document metadata by ID
 *
 * @param fileId - File ID
 * @returns Document metadata or null if not found
 */
export async function getDocument(fileId: string): Promise<DriveDocument | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    const file = response.data;
    const mimeType = file.mimeType || undefined;
    return {
      id: file.id!,
      name: file.name!,
      url: documentUrl(file.id!, mimeType),
      mimeType: mimeType || '',
    };
  } catch (error: any) {
    if (error?.code === 404) {
      return null;
    }
    console.error(`[Drive] Error getting document ${fileId}:`, error?.message || error);
    throw error;
  }
}
