import type { drive_v3 } from 'googleapis';
import { getDriveClientWithServiceAccount } from '@/lib/google/driveClient';
import { driveErrorsSuggestServiceAccountFallback } from '@/lib/review/googleDriveErrors';
import { portalShortcutTargetId } from '@/lib/review/reviewPortalVisibility';

const SHORTCUT_CACHE_TTL_MS = 5 * 60_000;
const shortcutCache = new Map<string, { targetId: string; expiresAt: number }>();

async function shortcutTargetFrom(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<string | null> {
  const res = await drive.files.get({
    fileId,
    fields: 'mimeType, shortcutDetails(targetId, targetMimeType)',
    supportsAllDrives: true,
  });
  return portalShortcutTargetId(res.data)?.targetId ?? null;
}

/**
 * If `fileId` is a Drive shortcut (how Google Docs are often placed in a review
 * folder), return the target file id. Otherwise return `fileId`.
 */
export async function followDriveShortcut(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const cached = shortcutCache.get(fileId);
  if (cached && cached.expiresAt > Date.now()) return cached.targetId;

  const remember = (targetId: string) => {
    shortcutCache.set(fileId, { targetId, expiresAt: Date.now() + SHORTCUT_CACHE_TTL_MS });
    return targetId;
  };

  try {
    return remember((await shortcutTargetFrom(drive, fileId)) ?? fileId);
  } catch (err) {
    if (!driveErrorsSuggestServiceAccountFallback(err)) return fileId;
    try {
      const saDrive = getDriveClientWithServiceAccount();
      return remember((await shortcutTargetFrom(saDrive, fileId)) ?? fileId);
    } catch {
      return fileId;
    }
  }
}
