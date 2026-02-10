// lib/google/driveClient.ts
// Google Drive client for job folder provisioning
//
// Uses a service account to create folders in Shared Drives.
// All operations support Shared Drives with supportsAllDrives: true.

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { GoogleAuth } from 'google-auth-library';

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

/**
 * Get a Drive client using an OAuth2 client. No service account env required.
 * Use for partner delivery when a review portal token is provided.
 */
export function getDriveClientWithOAuth(oauthClient: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: oauthClient });
}

/**
 * Unified Drive client factory with explicit auth selection logic.
 * 
 * Auth selection order:
 * 1. If OAuth token provided → use OAuth client
 * 2. Else if USE_SERVICE_ACCOUNT=true → use WIF (external_account) and require Vercel OIDC token
 * 3. Else → hard error
 * 
 * Note: No singleton cache - tokens expire and caching is unsafe in serverless environments.
 * google-auth-library handles token caching internally per client instance during that invocation.
 * 
 * @param options - Auth options
 * @param options.oauthToken - OAuth token (from review portal) - pass OAuth2Client directly via getDriveClientWithOAuth
 * @param options.vercelOidcToken - Vercel OIDC token (from process.env.VERCEL_OIDC_TOKEN or request header)
 * @returns Authenticated Drive client
 */
export async function getDriveClient(options: {
  oauthToken?: OAuth2Client | null;
  vercelOidcToken?: string | null;
}): Promise<drive_v3.Drive> {
  const { oauthToken, vercelOidcToken } = options;

  // Priority 1: OAuth token (user token from review portal)
  if (oauthToken) {
    return getDriveClientWithOAuth(oauthToken);
  }

  // Priority 2: WIF with USE_SERVICE_ACCOUNT flag
  if (process.env.USE_SERVICE_ACCOUNT === 'true') {
    const token = vercelOidcToken ?? process.env.VERCEL_OIDC_TOKEN;
    if (!token) {
      throw new Error('USE_SERVICE_ACCOUNT=true requires VERCEL_OIDC_TOKEN to be set or passed explicitly');
    }
    return await getDriveClientWithWif(token);
  }

  // Priority 3: Hard error
  throw new Error('No OAuth token provided and USE_SERVICE_ACCOUNT is not enabled. Set USE_SERVICE_ACCOUNT=true to use WIF, or provide an OAuth token.');
}

/**
 * Get authenticated Google Drive client using explicit service account (JWT with private key).
 * 
 * @deprecated Use getDriveClient() with USE_SERVICE_ACCOUNT=true for WIF, or getDriveClientWithOAuth() for OAuth.
 * This function is kept for backward compatibility but should not be used with external_account credentials.
 */
export function getDriveClientWithServiceAccount(): drive_v3.Drive {
  const credentials = getServiceAccountCredentials();
  
  // Validate that we're not trying to use external_account credentials here
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === 'external_account') {
        throw new Error('Cannot use getDriveClientWithServiceAccount() with external_account credentials. Use getDriveClient() with USE_SERVICE_ACCOUNT=true instead.');
      }
    } catch {
      // Not JSON or parse failed, continue with JWT auth
    }
  }
  
  // Validate credentials before creating auth
  if (!credentials.client_email || !credentials.private_key) {
    const missing = [
      !credentials.client_email && 'client_email',
      !credentials.private_key && 'private_key',
    ].filter(Boolean);
    throw new Error(`Service account credentials incomplete: missing ${missing.join(' and ')}`);
  }
  
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  
  return google.drive({ version: 'v3', auth });
}

/**
 * Get authenticated Google Drive client using Workload Identity Federation (WIF) with Vercel OIDC.
 * 
 * This function reads external_account credentials from GOOGLE_SERVICE_ACCOUNT_JSON and patches
 * the credential_source to use a temp file containing the Vercel OIDC token.
 * 
 * @param vercelOidcToken - The OIDC token from Vercel (from process.env.VERCEL_OIDC_TOKEN or request header)
 * @returns Authenticated Drive client
 */
export async function getDriveClientWithWif(vercelOidcToken: string): Promise<drive_v3.Drive> {
  if (!vercelOidcToken) {
    throw new Error('Missing Vercel OIDC token. Set VERCEL_OIDC_TOKEN or pass token explicitly.');
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON (expected external_account credentials)');
  }

  let external: any;
  try {
    external = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (external.type !== 'external_account') {
    throw new Error(`Expected external_account credentials, got type: ${external.type}`);
  }

  // Write the OIDC token to a temp file that matches the credential_source.file path
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vercel-oidc-'));
  const tokenPath = path.join(dir, 'token');

  await fs.writeFile(tokenPath, vercelOidcToken, 'utf8');

  // Patch the external_account config to use our temp file
  const patchedExternal = {
    ...external,
    credential_source: {
      ...(external.credential_source ?? {}),
      file: tokenPath,
      format: { type: 'text' },
    },
  };

  const auth = new GoogleAuth({
    credentials: patchedExternal,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const client = await auth.getClient();
  
  // getClient() returns a union type, but we need it to be compatible with google.drive
  // Cast to any to work around the type mismatch (the actual runtime type is correct)
  return google.drive({ version: 'v3', auth: client as any });
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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
 * Sanitize a segment for use as a Drive folder name: trim, replace slashes.
 * Returns fallback if result would be empty.
 */
export function sanitizeFolderSegment(segment: string, fallback = 'Uncategorized'): string {
  const s = String(segment ?? '')
    .trim()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 0 ? s : fallback;
}

/**
 * Find a folder by exact name under a parent (using provided drive client).
 */
export async function findChildFolderWithDrive(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<DriveFolder | null> {
  try {
    const escapedName = name.replace(/'/g, "\\'");
    const response = await drive.files.list({
      q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = response.data.files ?? [];
    if (files.length === 0) return null;
    const folder = files[0];
    return { id: folder.id!, name: folder.name!, url: folderUrl(folder.id!) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Drive] Error finding folder "${name}" under ${parentId}:`, msg);
    throw error;
  }
}

/**
 * Create a folder under a parent (using provided drive client).
 */
export async function createFolderWithDrive(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<DriveFolder> {
  try {
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
    console.log(`[Drive] Created folder: "${name}" (${folder.id}) under ${parentId}`);
    return { id: folder.id!, name: folder.name!, url: folderUrl(folder.id!) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Drive] Error creating folder "${name}" under ${parentId}:`, msg);
    throw error;
  }
}

/**
 * Ensure a folder exists under a parent (find or create), using the provided drive client.
 */
export async function ensureChildFolderWithDrive(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<DriveFolder> {
  const existing = await findChildFolderWithDrive(drive, parentId, name);
  if (existing) return existing;
  return createFolderWithDrive(drive, parentId, name);
}

/**
 * Ensure a path of subfolders exists under root (idempotent). Creates each segment in order.
 * @param drive - Drive client (OAuth or WIF)
 * @param rootFolderId - Destination folder ID (batch destination)
 * @param pathSegments - e.g. ["Display", "Prospecting"] for Display/Prospecting
 * @returns Final folder ID (leaf of the path)
 */
export async function ensureSubfolderPath(
  drive: drive_v3.Drive,
  rootFolderId: string,
  pathSegments: string[]
): Promise<string> {
  const sanitized = pathSegments
    .map((seg) => sanitizeFolderSegment(seg))
    .filter((s) => s.length > 0);
  let currentId = rootFolderId;
  for (const name of sanitized) {
    const folder = await ensureChildFolderWithDrive(drive, currentId, name);
    currentId = folder.id;
  }
  return currentId;
}

/**
 * List child folders under a parent folder
 *
 * @param parentId - Parent folder ID
 * @returns List of child folders
 */
export async function listChildFolders(parentId: string): Promise<DriveFolder[]> {
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
    const mime = result.file.mimeType ?? 'unknown';
    throw new Error(
      `Source Folder ID must be a Drive folder. You provided a file (mimeType=${mime}). Use the folder that contains the assets, not a single file.`
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

    // Idempotency check: check if file with same name already exists in destination
    try {
      const escapedName = name.replace(/'/g, "\\'");
      const existingRes = await drive.files.list({
        q: `'${destinationFolderId}' in parents and name = '${escapedName}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1,
      });
    const existingFiles = existingRes.data.files ?? [];
    if (existingFiles.length > 0) {
      const existing = existingFiles[0];
      console.log(`[delivery/copy] SKIPPING`, {
        sourceId: sourceFileId,
        destFolderId: destinationFolderId,
        destFolderUrl: folderUrl(destinationFolderId),
        reason: `file already exists: "${name}"`,
        existingId: existing.id,
      });
      const url = existing.webViewLink && existing.webViewLink.trim() ? existing.webViewLink : documentUrl(existing.id!, undefined);
      return {
        id: existing.id!,
        name: existing.name ?? name,
        url,
      };
    }
    } catch (checkError) {
      // If idempotency check fails, continue with copy (non-critical)
      console.warn(`[delivery] Idempotency check failed, proceeding with copy:`, checkError instanceof Error ? checkError.message : String(checkError));
    }

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
    console.log(`[delivery/copy] DONE`, {
      sourceId: sourceFileId,
      createdFileOrFolderId: file.id!,
      fileName: file.name ?? name,
      fileUrl: url,
    });
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
    const mime = sourceMeta.data.mimeType ?? 'unknown';
    throw new Error(
      `Source Folder ID must be a Drive folder. You provided a file (mimeType=${mime}). Use the folder that contains the assets, not a single file.`
    );
  }

  // Idempotency check: check if folder with same name already exists
  const escapedFolderName = deliveredFolderName.replace(/'/g, "\\'");
  let deliveredRootFolderId: string;
  let deliveredRootFolderUrl: string;
  try {
    const existingRes = await drive.files.list({
      q: `'${destinationParentFolderId.replace(/'/g, "\\'")}' in parents and name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1,
    });
    const existingFolders = existingRes.data.files ?? [];
    if (existingFolders.length > 0) {
      const existing = existingFolders[0];
      deliveredRootFolderId = existing.id!;
      deliveredRootFolderUrl =
        (existing.webViewLink && existing.webViewLink.trim()) ||
        folderUrl(deliveredRootFolderId);
      console.log(`[drive] reuse folder: name="${deliveredFolderName}", folderId=${deliveredRootFolderId}`);
      foldersCreated = 0; // Reused existing folder
    } else {
      // Create new folder
      const createRes = await drive.files.create({
        requestBody: {
          name: deliveredFolderName,
          mimeType: FOLDER_MIMETYPE,
          parents: [destinationParentFolderId],
        },
        fields: 'id,name,webViewLink',
        supportsAllDrives: true,
      });
      deliveredRootFolderId = createRes.data.id!;
      deliveredRootFolderUrl =
        (createRes.data.webViewLink && createRes.data.webViewLink.trim()) ||
        folderUrl(deliveredRootFolderId);
      foldersCreated = 1;
    }
  } catch (checkError) {
    // If idempotency check fails, create folder anyway (non-critical)
    console.warn(`[drive] Idempotency check failed for "${deliveredFolderName}", creating anyway:`, checkError instanceof Error ? checkError.message : String(checkError));
    const createRes = await drive.files.create({
      requestBody: {
        name: deliveredFolderName,
        mimeType: FOLDER_MIMETYPE,
        parents: [destinationParentFolderId],
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });
    deliveredRootFolderId = createRes.data.id!;
    deliveredRootFolderUrl =
      (createRes.data.webViewLink && createRes.data.webViewLink.trim()) ||
      folderUrl(deliveredRootFolderId);
    foldersCreated = 1;
  }

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
          // Idempotency check: check if folder with same name already exists
          const folderName = item.name ?? 'Untitled folder';
          const escapedName = folderName.replace(/'/g, "\\'");
          let newFolderId: string;
          try {
            const existingRes = await drive.files.list({
              q: `'${destParentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
              fields: 'files(id, name)',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
              pageSize: 1,
            });
            const existingFolders = existingRes.data.files ?? [];
            if (existingFolders.length > 0) {
              newFolderId = existingFolders[0].id!;
              console.log(`[delivery/copy] SKIPPING`, {
                sourceId: id,
                destFolderId: destParentId,
                destFolderUrl: folderUrl(destParentId),
                reason: `folder already exists: "${folderName}"`,
                existingId: newFolderId,
              });
            } else {
              const createChild = await drive.files.create({
                requestBody: {
                  name: folderName,
                  mimeType: FOLDER_MIMETYPE,
                  parents: [destParentId],
                },
                fields: 'id',
                supportsAllDrives: true,
              });
              newFolderId = createChild.data.id!;
            }
          } catch (checkError) {
            // If idempotency check fails, create folder anyway (non-critical)
            console.warn(`[delivery] Idempotency check failed for folder "${folderName}", creating anyway:`, checkError instanceof Error ? checkError.message : String(checkError));
            const createChild = await drive.files.create({
              requestBody: {
                name: folderName,
                mimeType: FOLDER_MIMETYPE,
                parents: [destParentId],
              },
              fields: 'id',
              supportsAllDrives: true,
            });
            newFolderId = createChild.data.id!;
          }
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
        // Idempotency check: check if file with same name already exists
        const fileName = name ?? 'Untitled';
        const escapedName = fileName.replace(/'/g, "\\'");
        let shouldCopy = true;
        try {
          const existingRes = await drive.files.list({
            q: `'${destParentId}' in parents and name = '${escapedName}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 1,
          });
          const existingFiles = existingRes.data.files ?? [];
          if (existingFiles.length > 0) {
            console.log(`[delivery/copy] SKIPPING`, {
              sourceId: fileIdToCopy,
              destFolderId: destParentId,
              destFolderUrl: folderUrl(destParentId),
              reason: `file already exists: "${fileName}"`,
              existingId: existingFiles[0].id,
            });
            shouldCopy = false;
            filesCopied++; // Count as copied for stats
          }
        } catch (checkError) {
          // If idempotency check fails, continue with copy (non-critical)
          console.warn(`[delivery] Idempotency check failed for file "${fileName}", copying anyway:`, checkError instanceof Error ? checkError.message : String(checkError));
        }
        
        if (shouldCopy) {
          console.log(`[delivery/copy] START`, {
            sourceId: fileIdToCopy,
            destFolderId: destParentId,
            destFolderUrl: folderUrl(destParentId),
            reason: `copying file "${fileName}"`,
          });
          const copyRes = await drive.files.copy({
            fileId: fileIdToCopy,
            requestBody: { parents: [destParentId] },
            fields: 'id',
            supportsAllDrives: true,
          });
          console.log(`[delivery/copy] DONE`, {
            sourceId: fileIdToCopy,
            createdFileOrFolderId: copyRes.data.id!,
            fileName,
          });
          filesCopied++;
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        console.warn(`[Drive/copyFolderTree] Failed to copy file ${id}:`, reason);
        failures.push({ id, name, reason });
      }
    }
  }

  // Pre-check: List source folder contents for diagnostics
  try {
    const sourceChildren = await listFolderChildren(drive, sourceFolderId);
    const sourceFiles = sourceChildren.filter(f => f.mimeType !== FOLDER_MIMETYPE);
    const sourceFolders = sourceChildren.filter(f => f.mimeType === FOLDER_MIMETYPE);
    console.log(`[Drive/copyFolderTree] Source folder ${sourceFolderId} contains: ${sourceFiles.length} files, ${sourceFolders.length} folders`);
    if (sourceFiles.length === 0 && sourceFolders.length === 0) {
      console.warn(`[Drive/copyFolderTree] WARNING: Source folder ${sourceFolderId} appears to be empty!`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[Drive/copyFolderTree] Failed to list source folder contents for diagnostics:`, msg);
  }

  console.log(`[Drive/copyFolderTree] Starting recursive copy from ${sourceFolderId} to ${deliveredRootFolderId}`);
  await recurse(sourceFolderId, deliveredRootFolderId);
  console.log(`[Drive/copyFolderTree] Copy complete: filesCopied=${filesCopied}, foldersCreated=${foldersCreated}, failures=${failures.length}`);

  // Post-check: Verify destination folder has files
  if (filesCopied > 0) {
    try {
      const destChildren = await listFolderChildren(drive, deliveredRootFolderId);
      const destFiles = destChildren.filter(f => f.mimeType !== FOLDER_MIMETYPE);
      const destFolders = destChildren.filter(f => f.mimeType === FOLDER_MIMETYPE);
      console.log(`[Drive/copyFolderTree] Destination folder ${deliveredRootFolderId} now contains: ${destFiles.length} files, ${destFolders.length} folders`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Drive/copyFolderTree] Failed to verify destination folder contents:`, msg);
    }
  }

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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
  const drive = await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN });

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
