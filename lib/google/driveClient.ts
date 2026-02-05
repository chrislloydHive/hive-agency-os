// lib/google/driveClient.ts
// Google Drive client for job folder provisioning
//
// Uses a service account to create folders in Shared Drives.
// All operations support Shared Drives with supportsAllDrives: true.

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

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
    const missing = [
      !clientEmail && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      !privateKey && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    ].filter(Boolean) as string[];
    throw new Error(
      `Google Drive credentials not configured (service account). Set GOOGLE_SERVICE_ACCOUNT_JSON or ${missing.join(' and ')}.`
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
 * Get a Drive client using an OAuth2 client. No service account env required.
 * Use for partner delivery when a review portal token is provided.
 */
export function getDriveClientWithOAuth(oauthClient: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: oauthClient });
}

/**
 * Get authenticated Google Drive client using service account (lazy init).
 * Throws with a clear message if GOOGLE_SERVICE_ACCOUNT_JSON (or EMAIL+PRIVATE_KEY) is missing.
 * Only call when OAuth is not available (e.g. partner delivery without token).
 */
export function getDriveClientWithServiceAccount(): drive_v3.Drive {
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
 * Get authenticated Google Drive client (service account). Lazy init.
 * @deprecated Prefer getDriveClientWithOAuth for token-based flows; use getDriveClientWithServiceAccount for explicit SA usage.
 */
export function getDriveClient(): drive_v3.Drive {
  return getDriveClientWithServiceAccount();
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

    // TODO: when parent is in a Shared Drive and we have driveId, set corpora: 'drive', driveId: sharedDriveId for more reliable list.
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
    // TODO: when parent is in a Shared Drive and we have driveId, set corpora: 'drive', driveId: sharedDriveId.
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

export interface CopyFileToFolderOptions {
  /** When set, use this OAuth client instead of the service account. Use for copying from company/consumer Drive the SA cannot access. */
  auth?: OAuth2Client;
  /** When set, use this Drive client directly (e.g. from WIF). Takes precedence over auth when both omitted use service account. */
  drive?: drive_v3.Drive;
  /** When set with DELIVERY_DRIVE_DEBUG=true, preflight gets are run and one log line is emitted. */
  requestId?: string;
}

const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

const SHARED_DRIVE_HINT =
  'If these are different Shared Drives, SA must be member of both; if driveId is null, file may be in My Drive.';

/**
 * Shared Drive audit (preflightCopy / copyFileToFolder):
 * - files.get and files.copy: only supportsAllDrives is valid (includeItemsFromAllDrives is for files.list).
 * - All get/copy calls below use supportsAllDrives: true.
 * - files.list calls use supportsAllDrives: true and includeItemsFromAllDrives: true.
 */
const PREFLIGHT_FIELDS = 'id,name,mimeType,driveId,parents,trashed,capabilities';
const PREFLIGHT_SOURCE_FIELDS = `${PREFLIGHT_FIELDS},shortcutDetails`;

function getHttpStatusFromError(e: unknown): number | undefined {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const res = (e as { response?: { status?: number } }).response;
    return res?.status;
  }
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return (e as { code: number }).code;
  }
  return undefined;
}

/** Safely get error response body for logging (no secrets). */
function getErrorResponseBody(e: unknown): unknown {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const res = (e as { response?: { data?: unknown } }).response;
    return res?.data;
  }
  return undefined;
}

export interface VerifyDriveAccessResult {
  file: {
    id: string;
    name: string | null;
    driveId: string | null;
    mimeType: string | null;
    parents?: string[] | null;
    shortcutDetails?: { targetId?: string; targetMimeType?: string } | null;
  };
  folder: { id: string; name: string | null; driveId: string | null; mimeType: string | null; parents?: string[] | null };
}

/**
 * Validates access to a file and a folder. Returns metadata for both when successful.
 * Uses supportsAllDrives: true. Throws with a clear message including source/destination, id, and HTTP status when a get fails.
 */
export async function verifyDriveAccess(
  drive: drive_v3.Drive,
  fileId: string,
  folderId: string
): Promise<VerifyDriveAccessResult> {
  const supportsAllDrives = true;

  let fileData: drive_v3.Schema$File;
  try {
    const res = await drive.files.get({
      fileId,
      fields: PREFLIGHT_SOURCE_FIELDS,
      supportsAllDrives,
    });
    fileData = res.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = getHttpStatusFromError(e);
    const body = getErrorResponseBody(e);
    console.warn(
      '[Drive/verifyDriveAccess] source files.get failed:',
      JSON.stringify({ fileId, httpStatus: status, message: msg, responseBody: body })
    );
    const statusPart = status != null ? ` HTTP ${status}.` : '';
    throw new Error(
      `Source not accessible. fileId=${fileId}.${statusPart} ${msg} (supportsAllDrives: ${supportsAllDrives}). ${SHARED_DRIVE_HINT}`
    );
  }

  let folderData: drive_v3.Schema$File;
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: PREFLIGHT_FIELDS,
      supportsAllDrives,
    });
    folderData = res.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = getHttpStatusFromError(e);
    const body = getErrorResponseBody(e);
    console.warn(
      '[Drive/verifyDriveAccess] destination files.get failed:',
      JSON.stringify({ folderId, httpStatus: status, message: msg, responseBody: body })
    );
    const statusPart = status != null ? ` HTTP ${status}.` : '';
    const fileDriveId = fileData.driveId ?? 'null';
    throw new Error(
      `Destination folder not accessible. folderId=${folderId}.${statusPart} ${msg} (supportsAllDrives: ${supportsAllDrives}). Source driveId: ${fileDriveId}. ${SHARED_DRIVE_HINT}`
    );
  }

  return {
    file: {
      id: fileData.id ?? fileId,
      name: fileData.name ?? null,
      driveId: fileData.driveId ?? null,
      mimeType: fileData.mimeType ?? null,
      parents: fileData.parents ?? null,
      shortcutDetails: fileData.shortcutDetails ?? undefined,
    },
    folder: {
      id: folderData.id ?? folderId,
      name: folderData.name ?? null,
      driveId: folderData.driveId ?? null,
      mimeType: folderData.mimeType ?? null,
      parents: folderData.parents ?? null,
    },
  };
}

/**
 * Preflight: ensure source file and destination folder exist and dest is a folder. Throws with clear message on failure.
 * Uses verifyDriveAccess for gets; throws if source is a shortcut (use targetId). Logs driveId + name for both when successful.
 */
export async function preflightCopy(
  drive: drive_v3.Drive,
  sourceFileId: string,
  destinationFolderId: string
): Promise<void> {
  const result = await verifyDriveAccess(drive, sourceFileId, destinationFolderId);
  const destData = result.folder;
  const shortcutDetails = result.file.shortcutDetails;

  if (shortcutDetails != null && typeof shortcutDetails === 'object') {
    const targetId = shortcutDetails.targetId ?? 'unknown';
    throw new Error(
      `Source file (${sourceFileId}) is a shortcut, not the actual file. Use the shortcut's target file ID for the copy. targetId: ${targetId}`
    );
  }

  if (destData.mimeType !== FOLDER_MIMETYPE) {
    throw new Error(
      `Destination is not a folder (mimeType=${destData.mimeType ?? 'unknown'}). Use a Drive folder ID.`
    );
  }

  console.log(
    '[Drive/preflight]',
    JSON.stringify({
      sourceId: result.file.id,
      sourceName: result.file.name,
      sourceDriveId: result.file.driveId,
      sourceParents: result.file.parents ?? null,
      destId: result.folder.id,
      destName: result.folder.name,
      destDriveId: result.folder.driveId,
      destParents: result.folder.parents ?? null,
      sourceMimeType: result.file.mimeType,
      destMimeType: result.folder.mimeType,
    })
  );
}

/**
 * Preflight for folder-based delivery: validates source and destination are folders.
 * Uses supportsAllDrives: true. Throws with clear message if source is not a folder or dest is not a folder.
 */
export async function preflightFolderCopy(
  drive: drive_v3.Drive,
  sourceFolderId: string,
  destinationFolderId: string
): Promise<void> {
  const result = await verifyDriveAccess(drive, sourceFolderId, destinationFolderId);
  if (result.file.mimeType !== FOLDER_MIMETYPE) {
    throw new Error(
      `Source is not a folder (mimeType=${result.file.mimeType ?? 'unknown'}). Source Folder ID must be a folder ID for folder delivery.`
    );
  }
  if (result.folder.mimeType !== FOLDER_MIMETYPE) {
    throw new Error(
      `Destination is not a folder (mimeType=${result.folder.mimeType ?? 'unknown'}). Use a Drive folder ID.`
    );
  }
  console.log(
    '[Drive/preflightFolder]',
    JSON.stringify({
      sourceFolderId: result.file.id,
      sourceName: result.file.name,
      sourceDriveId: result.file.driveId,
      destFolderId: result.folder.id,
      destName: result.folder.name,
      destDriveId: result.folder.driveId,
    })
  );
}

/**
 * Preflight: get source and dest with supportsAllDrives, log one line. Used only when DELIVERY_DRIVE_DEBUG=true.
 */
async function runPreflightLog(
  drive: drive_v3.Drive,
  sourceFileId: string,
  destFolderId: string,
  requestId: string
): Promise<void> {
  let sourceOk = false;
  let destOk = false;
  let sourceDriveId: string | undefined;
  let destDriveId: string | undefined;
  try {
    const src = await drive.files.get({
      fileId: sourceFileId,
      fields: PREFLIGHT_FIELDS,
      supportsAllDrives: true,
    });
    sourceOk = true;
    sourceDriveId = src.data.driveId ?? undefined;
  } catch {
    // leave sourceOk false
  }
  try {
    const dest = await drive.files.get({
      fileId: destFolderId,
      fields: PREFLIGHT_FIELDS,
      supportsAllDrives: true,
    });
    destOk = true;
    destDriveId = dest.data.driveId ?? undefined;
  } catch {
    // leave destOk false
  }
  console.log(
    `[drive/preflight] sourceOk=${sourceOk} destOk=${destOk} sourceDriveId=${sourceDriveId ?? ''} destDriveId=${destDriveId ?? ''} requestId=${requestId}`
  );
}

/**
 * Copy any Drive file into a destination folder (for partner delivery, etc.).
 * Uses the source file's name for the copy. Supports Shared Drives.
 * When options.auth is provided, uses that OAuth client (e.g. company Drive); otherwise uses the service account.
 * Every Drive call uses supportsAllDrives: true; copy uses requestBody.parents = [destinationFolderId].
 *
 * @param sourceFileId - Drive file ID to copy
 * @param destinationFolderId - Target folder ID
 * @param options - Optional auth and requestId (requestId + DELIVERY_DRIVE_DEBUG enable preflight log)
 * @returns Created copy with id, name, and view URL
 */
export async function copyFileToFolder(
  sourceFileId: string,
  destinationFolderId: string,
  options?: CopyFileToFolderOptions
): Promise<{ id: string; name: string; url: string }> {
  const drive =
    options?.drive ??
    (options?.auth ? getDriveClientWithOAuth(options.auth) : getDriveClientWithServiceAccount());

  if (process.env.DELIVERY_DRIVE_DEBUG === 'true' && options?.requestId) {
    await runPreflightLog(drive, sourceFileId, destinationFolderId, options.requestId);
  }

  try {
    const getRes = await drive.files.get({
      fileId: sourceFileId,
      fields: 'name, mimeType',
      supportsAllDrives: true,
    });
    const name = getRes.data.name ?? 'Copy';

    const response = await drive.files.copy({
      fileId: sourceFileId,
      requestBody: {
        parents: [destinationFolderId],
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });

    const file = response.data;
    const url =
      (file.webViewLink && file.webViewLink.trim()) || documentUrl(file.id!, undefined);
    return {
      id: file.id!,
      name: file.name ?? name,
      url,
    };
  } catch (err: unknown) {
    const code =
      (typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined) ??
      (typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined);
    if (code === 403 || code === 404) {
      console.warn(
        '[Drive] Shared Drive member verified; likely missing supportsAllDrives/includeItemsFromAllDrives/corpora/driveId or incorrect parents/removeParents.'
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Folder tree copy (partner delivery: copy entire folder into destination)
// ---------------------------------------------------------------------------

export interface CopyDriveFolderTreeOptions {
  /** Name for the new root folder created in the destination (e.g. "Delivered – ProjectName – 2025-02-03"). */
  deliveredFolderName: string;
  /** Optional drive client (e.g. WIF); when omitted uses default. */
  drive?: drive_v3.Drive;
}

export interface CopyDriveFolderTreeResult {
  deliveredRootFolderId: string;
  deliveredRootFolderUrl: string;
  foldersCreated: number;
  filesCopied: number;
  failures: Array<{ id: string; name?: string; reason: string }>;
}

/** List all children of a folder (paginated). supportsAllDrives and includeItemsFromAllDrives. */
async function listFolderChildren(
  drive: drive_v3.Drive,
  parentId: string
): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, shortcutDetails)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      pageToken,
    });
    const list = res.data.files ?? [];
    files.push(...list);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

/**
 * Recursively copy a Drive folder tree into a destination folder. Creates a new folder with deliveredFolderName
 * inside destinationParentFolderId, then recreates all subfolders and copies all files (including resolving shortcuts).
 * Supports Shared Drives. Do not use files.copy for folders — only create folders and copy files.
 */
export async function copyDriveFolderTree(
  drive: drive_v3.Drive,
  sourceFolderId: string,
  destinationParentFolderId: string,
  options: CopyDriveFolderTreeOptions
): Promise<CopyDriveFolderTreeResult> {
  const { deliveredFolderName } = options;
  const failures: Array<{ id: string; name?: string; reason: string }> = [];
  let foldersCreated = 0;
  let filesCopied = 0;

  const sourceMeta = await drive.files.get({
    fileId: sourceFolderId,
    fields: 'id,name,mimeType',
    supportsAllDrives: true,
  });
  if (sourceMeta.data.mimeType !== FOLDER_MIMETYPE) {
    throw new Error(
      `Source is not a folder (mimeType=${sourceMeta.data.mimeType ?? 'unknown'}). Source Folder ID must be a folder ID.`
    );
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: deliveredFolderName,
      mimeType: FOLDER_MIMETYPE,
      parents: [destinationParentFolderId],
    },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });
  const deliveredRootFolderId = createRes.data.id!;
  const deliveredRootFolderUrl =
    (createRes.data.webViewLink && createRes.data.webViewLink.trim()) ||
    folderUrl(deliveredRootFolderId);
  foldersCreated = 1;

  async function recurse(
    sourceParentId: string,
    destParentId: string
  ): Promise<void> {
    const children = await listFolderChildren(drive, sourceParentId);
    for (const item of children) {
      const id = item.id ?? '';
      const name = item.name ?? undefined;
      const mimeType = item.mimeType ?? '';

      if (mimeType === FOLDER_MIMETYPE) {
        try {
          const createChild = await drive.files.create({
            requestBody: {
              name: item.name ?? 'Untitled folder',
              mimeType: FOLDER_MIMETYPE,
              parents: [destParentId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          const newFolderId = createChild.data.id!;
          foldersCreated++;
          await recurse(id, newFolderId);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          console.warn(`[Drive/copyFolderTree] Failed to create/copy folder ${id}:`, reason);
          failures.push({ id, name, reason });
        }
        continue;
      }

      let fileIdToCopy = id;
      if (item.shortcutDetails?.targetId) {
        fileIdToCopy = item.shortcutDetails.targetId;
      }

      try {
        await drive.files.copy({
          fileId: fileIdToCopy,
          requestBody: { parents: [destParentId] },
          fields: 'id',
          supportsAllDrives: true,
        });
        filesCopied++;
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        console.warn(`[Drive/copyFolderTree] Failed to copy file ${id}:`, reason);
        failures.push({ id, name, reason });
      }
    }
  }

  await recurse(sourceFolderId, deliveredRootFolderId);

  return {
    deliveredRootFolderId,
    deliveredRootFolderUrl,
    foldersCreated,
    filesCopied,
    failures,
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

    // TODO: when folder is in a Shared Drive and we have driveId, set corpora: 'drive', driveId: sharedDriveId.
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
