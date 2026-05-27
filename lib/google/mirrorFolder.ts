// lib/google/mirrorFolder.ts
// Recursively mirror a Drive folder tree into an existing destination folder.
// Name-based dedup per subfolder; never deletes or overwrites destination files.

import type { drive_v3 } from 'googleapis';
import {
  ensureChildFolderWithDrive,
  listFolderChildren,
} from '@/lib/google/driveClient';

const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';
const DEFAULT_COPY_CONCURRENCY = 5;

export interface MirrorFolderCopiedItem {
  name: string;
  from: string;
  into: string;
}

export interface MirrorFolderSkippedItem {
  name: string;
}

export interface MirrorFolderFolderItem {
  name: string;
  created: boolean;
  destFolderId: string;
}

export interface MirrorFolderResult {
  copied: MirrorFolderCopiedItem[];
  skipped: MirrorFolderSkippedItem[];
  folders: MirrorFolderFolderItem[];
  failures: Array<{ id: string; name?: string; reason: string }>;
}

export interface MirrorFolderOptions {
  /** Max parallel file copies within a folder (default 5). */
  copyConcurrency?: number;
  logger?: Pick<Console, 'log' | 'warn'>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDriveError(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  const status = e?.response?.status ?? e?.code;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

async function copyFileWithRetry(
  drive: drive_v3.Drive,
  fileId: string,
  destParentId: string,
  name: string,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await drive.files.copy({
        fileId,
        requestBody: { name, parents: [destParentId] },
        fields: 'id',
        supportsAllDrives: true,
      });
      return res.data.id!;
    } catch (err) {
      lastErr = err;
      if (isRetryableDriveError(err) && attempt < 4) {
        await sleep(Math.min(1000 * 2 ** attempt, 15_000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Mirror `sourceFolderId` into existing `destFolderId` (same-named subfolders, copy missing files only).
 */
export async function mirrorFolder(
  drive: drive_v3.Drive,
  sourceFolderId: string,
  destFolderId: string,
  opts: MirrorFolderOptions = {},
): Promise<MirrorFolderResult> {
  const log = opts.logger ?? console;
  const copyConcurrency = opts.copyConcurrency ?? DEFAULT_COPY_CONCURRENCY;
  const result: MirrorFolderResult = {
    copied: [],
    skipped: [],
    folders: [],
    failures: [],
  };

  async function recurse(sourceParentId: string, destParentId: string): Promise<void> {
    const sourceChildren = await listFolderChildren(drive, sourceParentId);
    const destChildren = await listFolderChildren(drive, destParentId);
    const destByName = new Map<string, drive_v3.Schema$File>();
    for (const child of destChildren) {
      if (child.name) destByName.set(child.name, child);
    }

    const folders = sourceChildren.filter((c) => c.mimeType === FOLDER_MIMETYPE);
    const files = sourceChildren.filter((c) => c.mimeType !== FOLDER_MIMETYPE);

    for (const folder of folders) {
      const folderName = folder.name ?? 'Untitled folder';
      const folderId = folder.id ?? '';
      if (!folderId) continue;

      try {
        const existing = destByName.get(folderName);
        let destSubfolderId: string;
        let created = false;
        if (existing?.id && existing.mimeType === FOLDER_MIMETYPE) {
          destSubfolderId = existing.id;
        } else {
          const createdFolder = await ensureChildFolderWithDrive(drive, destParentId, folderName);
          destSubfolderId = createdFolder.id;
          created = true;
        }
        result.folders.push({ name: folderName, created, destFolderId: destSubfolderId });
        await recurse(folderId, destSubfolderId);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn(`[mirrorFolder] folder failed name="${folderName}":`, reason);
        result.failures.push({ id: folderId, name: folderName, reason });
      }
    }

    const filesToCopy = files.filter((file) => {
      const name = file.name ?? '';
      return name && !destByName.has(name);
    });

    await mapWithConcurrency(filesToCopy, copyConcurrency, async (file) => {
      const name = file.name ?? 'Untitled';
      const id = file.id ?? '';
      if (!id) return;

      let fileIdToCopy = id;
      if (file.shortcutDetails?.targetId) {
        fileIdToCopy = file.shortcutDetails.targetId;
      }

      try {
        await copyFileWithRetry(drive, fileIdToCopy, destParentId, name);
        result.copied.push({ name, from: fileIdToCopy, into: destParentId });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn(`[mirrorFolder] file failed name="${name}":`, reason);
        result.failures.push({ id, name, reason });
      }
    });

    for (const file of files) {
      const name = file.name ?? '';
      if (name && destByName.has(name)) {
        result.skipped.push({ name });
      }
    }
  }

  await recurse(sourceFolderId, destFolderId);
  return result;
}
