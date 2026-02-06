// lib/review/backfillCras.ts
// Backfill CRAS records for all files in the review folder map (Prospecting + Retargeting).
// Used by POST /api/review/assets/backfill-cras.

import type { drive_v3 } from 'googleapis';
import { ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';

/** List non-folder files in a Drive folder. Shared Drive safe. */
async function listFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? '',
  }));
}

export interface BackfillCrasResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Ensure a CRAS record exists for every file in the folder map (variant:tactic -> folderId).
 * Creates records with Status=New when missing. Dedupe is by Review Token + Source Folder ID.
 */
export async function backfillCras(params: {
  drive: drive_v3.Drive;
  folderMap: Map<string, string>;
  token: string;
  projectId: string;
  dryRun?: boolean;
}): Promise<BackfillCrasResult> {
  const { drive, folderMap, token, projectId, dryRun = false } = params;
  const result: BackfillCrasResult = { created: 0, skipped: 0, errors: [] };

  for (const [key, folderId] of folderMap.entries()) {
    const [variant, tactic] = key.split(':');
    if (!variant || !tactic) {
      result.errors.push(`Invalid map key: ${key}`);
      continue;
    }
    let files: Array<{ id: string; name: string }>;
    try {
      files = await listFilesInFolder(drive, folderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${key} (${folderId}): list failed - ${msg}`);
      continue;
    }
    for (const file of files) {
      try {
        if (dryRun) {
          result.skipped += 1;
          continue;
        }
        const created = await ensureCrasRecord({
          token,
          projectId,
          driveFileId: file.id,
          filename: file.name,
          tactic,
          variant,
        });
        if (created) result.created += 1;
        else result.skipped += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${key} file ${file.id}: ${msg}`);
      }
    }
  }

  return result;
}
