// lib/delivery/runProductionFolderMirror.ts
// Orchestrates internal → partner production folder mirror for a Project.

import type { drive_v3 } from 'googleapis';
import {
  getProjectProductionFolders,
  isProductionFolderMirrorEnabled,
  type ProjectProductionFolders,
} from '@/lib/airtable/projectProductionFolders';
import { getDriveClient } from '@/lib/google/driveClient';
import { mirrorFolder, type MirrorFolderResult } from '@/lib/google/mirrorFolder';

export interface ProductionFolderMirrorRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  projectId: string;
  projectName?: string;
  internalProductionFolderId?: string;
  partnerProductionFolderId?: string;
  durationMs?: number;
  mirror?: MirrorFolderResult;
  error?: string;
}

export async function runProductionFolderMirrorForProject(
  projectId: string,
  options?: {
    drive?: drive_v3.Drive;
    oidcToken?: string | null;
    requestId?: string;
    /** Skip global feature-flag check (for tests). */
    force?: boolean;
  },
): Promise<ProductionFolderMirrorRunResult> {
  const requestId = options?.requestId ?? `mirror-${projectId.slice(-8)}`;

  if (!options?.force && !isProductionFolderMirrorEnabled()) {
    return { ok: true, skipped: true, reason: 'feature_disabled', projectId };
  }

  const folders = await getProjectProductionFolders(projectId);
  if (!folders) {
    return {
      ok: true,
      skipped: true,
      reason: 'missing_folder_ids',
      projectId,
    };
  }

  return runProductionFolderMirror(folders, options);
}

export async function runProductionFolderMirror(
  folders: ProjectProductionFolders,
  options?: {
    drive?: drive_v3.Drive;
    oidcToken?: string | null;
    requestId?: string;
  },
): Promise<ProductionFolderMirrorRunResult> {
  const started = Date.now();
  const requestId = options?.requestId ?? `mirror-${folders.projectId.slice(-8)}`;

  try {
    const drive =
      options?.drive ??
      (await getDriveClient({ vercelOidcToken: options?.oidcToken ?? process.env.VERCEL_OIDC_TOKEN ?? null }));

    console.log(`[production-mirror] START ${requestId}`, {
      projectId: folders.projectId,
      projectName: folders.projectName,
      internalProductionFolderId: folders.internalProductionFolderId,
      partnerProductionFolderId: folders.partnerProductionFolderId,
    });

    const mirror = await mirrorFolder(
      drive,
      folders.internalProductionFolderId,
      folders.partnerProductionFolderId,
      {
        logger: console,
      },
    );

    const durationMs = Date.now() - started;
    console.log(`[production-mirror] DONE ${requestId}`, {
      projectId: folders.projectId,
      copiedCount: mirror.copied.length,
      skippedCount: mirror.skipped.length,
      foldersCreated: mirror.folders.filter((f) => f.created).length,
      failures: mirror.failures.length,
      durationMs,
    });

    return {
      ok: mirror.failures.length === 0,
      projectId: folders.projectId,
      projectName: folders.projectName,
      internalProductionFolderId: folders.internalProductionFolderId,
      partnerProductionFolderId: folders.partnerProductionFolderId,
      durationMs,
      mirror,
      error: mirror.failures.length ? `${mirror.failures.length} copy failure(s)` : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[production-mirror] ERROR ${requestId}`, message);
    return {
      ok: false,
      projectId: folders.projectId,
      projectName: folders.projectName,
      error: message,
      durationMs: Date.now() - started,
    };
  }
}
