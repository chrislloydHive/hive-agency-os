// lib/review/reviewFolders.ts
// Resolves CRH folder IDs by traversing Drive: root → Client Review → job → tactic → variant.
// Shared by assets listing and file proxy so both use the same allowed folders.

import type { drive_v3 } from 'googleapis';

const VARIANTS = ['Prospecting', 'Retargeting'] as const;
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search'] as const;

/** Get child folder id by exact name. Shared Drive safe. */
export async function getChildFolderId(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files.length > 0 ? files[0].id! : null;
}

export interface ReviewFolderMapResult {
  map: Map<string, string>;
  jobFolderId: string;
}

/**
 * Build folder map: variant:tactic -> variant folder id (leaf).
 * Path: rootFolderId → Client Review → hubName (job) → tactic → variant.
 * Returns null if any folder in the path is missing.
 */
export async function getReviewFolderMap(
  drive: drive_v3.Drive,
  hubName: string,
  rootFolderId: string,
): Promise<ReviewFolderMapResult | null> {
  const clientReviewFolderId = await getChildFolderId(drive, rootFolderId, 'Client Review');
  if (!clientReviewFolderId) return null;

  const jobFolderId = await getChildFolderId(drive, clientReviewFolderId, hubName);
  if (!jobFolderId) return null;

  const map = new Map<string, string>();
  for (const tactic of TACTICS) {
    const tacticFolderId = await getChildFolderId(drive, jobFolderId, tactic);
    if (!tacticFolderId) return null;
    for (const variant of VARIANTS) {
      const variantFolderId = await getChildFolderId(drive, tacticFolderId, variant);
      if (!variantFolderId) return null;
      map.set(`${variant}:${tactic}`, variantFolderId);
    }
  }
  return { map, jobFolderId };
}

/** All variant folder IDs for a project (for file proxy allowlist). */
export async function getAllowedReviewFolderIds(
  drive: drive_v3.Drive,
  hubName: string,
  rootFolderId: string,
): Promise<string[] | null> {
  const result = await getReviewFolderMap(drive, hubName, rootFolderId);
  return result ? [...result.map.values()] : null;
}

/**
 * Build folder map when job folder ID is already known (e.g. from Project record).
 * Path: jobFolderId → tactic → variant. Returns null if any child folder is missing.
 */
export async function getReviewFolderMapFromJobFolder(
  drive: drive_v3.Drive,
  jobFolderId: string,
): Promise<ReviewFolderMapResult | null> {
  const map = new Map<string, string>();
  for (const tactic of TACTICS) {
    const tacticFolderId = await getChildFolderId(drive, jobFolderId, tactic);
    if (!tacticFolderId) return null;
    for (const variant of VARIANTS) {
      const variantFolderId = await getChildFolderId(drive, tacticFolderId, variant);
      if (!variantFolderId) return null;
      map.set(`${variant}:${tactic}`, variantFolderId);
    }
  }
  return { map, jobFolderId };
}

/** All variant folder IDs when job folder ID is known (for file proxy allowlist). */
export async function getAllowedReviewFolderIdsFromJobFolder(
  drive: drive_v3.Drive,
  jobFolderId: string,
): Promise<string[] | null> {
  const result = await getReviewFolderMapFromJobFolder(drive, jobFolderId);
  return result ? [...result.map.values()] : null;
}

/**
 * Build folder map when job folder is under client Projects folder (by project name).
 * Path: clientProjectsFolderId → projectName → tactic → variant.
 * Use when Project record has no Creative Review Hub Folder ID (e.g. field missing or not yet written).
 */
export async function getReviewFolderMapFromClientProjectsFolder(
  drive: drive_v3.Drive,
  projectName: string,
  clientProjectsFolderId: string,
): Promise<ReviewFolderMapResult | null> {
  const jobFolderId = await getChildFolderId(drive, clientProjectsFolderId, projectName);
  if (!jobFolderId) return null;
  return getReviewFolderMapFromJobFolder(drive, jobFolderId);
}

/** All variant folder IDs when job is under client Projects folder (for file proxy allowlist). */
export async function getAllowedReviewFolderIdsFromClientProjectsFolder(
  drive: drive_v3.Drive,
  projectName: string,
  clientProjectsFolderId: string,
): Promise<string[] | null> {
  const result = await getReviewFolderMapFromClientProjectsFolder(drive, projectName, clientProjectsFolderId);
  return result ? [...result.map.values()] : null;
}
