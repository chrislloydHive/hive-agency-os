// lib/review/reviewFolders.ts
// Resolves CRH folder IDs by traversing Drive: root → Client Review → job → tactic → variant.
// Shared by assets listing and file proxy so both use the same allowed folders.
// Variant folder names are resolved via detectVariantFromPath (Remarketing, RTG → Retargeting).

import type { drive_v3 } from 'googleapis';
import { detectVariantFromPath } from '@/lib/review/reviewVariantDetection';

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

/** List direct child folders (id, name). Shared Drive safe. */
async function listChildFolders(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files.map((f) => ({ id: f.id!, name: f.name ?? '' }));
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

/**
 * Build folder map from job folder, including only tactic→variant folders that exist.
 * Variant is detected via detectVariantFromPath so Remarketing, RTG, Re-targeting → Retargeting.
 * Unknown child folders are logged (not silently skipped); skipped count is logged at end.
 */
export async function getReviewFolderMapFromJobFolderPartial(
  drive: drive_v3.Drive,
  jobFolderId: string,
): Promise<ReviewFolderMapResult> {
  const map = new Map<string, string>();
  let skippedFolderCount = 0;
  for (const tactic of TACTICS) {
    const tacticFolderId = await getChildFolderId(drive, jobFolderId, tactic);
    if (!tacticFolderId) continue;
    const childFolders = await listChildFolders(drive, tacticFolderId);
    for (const folder of childFolders) {
      const variant = detectVariantFromPath(folder.name);
      if (variant) {
        map.set(`${variant}:${tactic}`, folder.id);
      } else {
        skippedFolderCount += 1;
        console.warn(
          `[reviewFolders] Skipped unknown variant folder (tactic=${tactic}, folderId=${folder.id}, folderName=${folder.name})`
        );
      }
    }
  }
  if (skippedFolderCount > 0) {
    console.warn(`[reviewFolders] getReviewFolderMapFromJobFolderPartial: skipped ${skippedFolderCount} folder(s) with unrecognized variant name (jobFolderId=${jobFolderId})`);
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
 * Uses partial map so missing tactic/variant folders do not cause null.
 */
export async function getReviewFolderMapFromClientProjectsFolder(
  drive: drive_v3.Drive,
  projectName: string,
  clientProjectsFolderId: string,
): Promise<ReviewFolderMapResult | null> {
  const jobFolderId = await getChildFolderId(drive, clientProjectsFolderId, projectName);
  if (!jobFolderId) return null;
  return getReviewFolderMapFromJobFolderPartial(drive, jobFolderId);
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
