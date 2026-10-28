// lib/delivery/syncPartnerJobFolder.ts
// Keep a partner job folder (Partners → Brkthru → {job}) structurally identical to the
// primary WORK → Car Toys → Projects → {job} folder.
//
// Guarantees (all idempotent, safe to run repeatedly and concurrently):
//  1. Every folder in the primary tree exists exactly once in the partner tree (folders only).
//  2. Every primary Google Doc / Sheet / Slides file (and shortcut to one) appears in the same
//     relative location as a SHORTCUT to the primary file — one source of truth, no drift.
//     Media and other files are never touched: partners only receive approved assets via delivery.
//  3. Empty duplicate sibling folders are trashed (oldest wins). Non-empty duplicates are
//     reported, never deleted, so no asset can be lost.
//  4. The primary tree is only ever read.

import type { drive_v3 } from 'googleapis';
import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { ensureChildFolderWithDrive, getDriveClient } from '@/lib/google/driveClient';

export const BRKTHRU_PARENT_FOLDER_ID = '1jlxinp9VsGNMajmC-o8YLhzDVIOch7Md';

const FOLDER = 'application/vnd.google-apps.folder';
const SHORTCUT = 'application/vnd.google-apps.shortcut';
const SHAREABLE_DOC_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
]);

const PRIMARY_LINK_FIELDS = [
  process.env.PRIMARY_JOB_FOLDER_FIELD?.trim() || 'Drive Project Folder Link',
  'Drive Folder URL',
];

export interface SyncPartnerJobFolderResult {
  foldersCreated: number;
  shortcutsCreated: number;
  duplicateFoldersTrashed: number;
  /** Non-empty duplicate folders left in place; need a human merge. */
  duplicatesNeedingReview: Array<{ path: string; folderIds: string[] }>;
  /** Partner-side real copies of a primary doc (not shortcuts); left alone, listed for review. */
  docCopiesNeedingReview: Array<{ path: string; partnerFileId: string }>;
  failures: Array<{ path: string; reason: string }>;
}

type Child = drive_v3.Schema$File;

async function listChildren(drive: drive_v3.Drive, parentId: string): Promise<Child[]> {
  const out: Child[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, createdTime, shortcutDetails)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 200,
      pageToken,
    });
    out.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

function oldestFirst(a: Child, b: Child): number {
  const ta = a.createdTime ? Date.parse(a.createdTime) : 0;
  const tb = b.createdTime ? Date.parse(b.createdTime) : 0;
  return ta !== tb ? ta - tb : (a.id ?? '').localeCompare(b.id ?? '');
}

/** Extract a Drive folder id from a folder URL or raw id. */
export function parseDriveFolderId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(s) ?? /[?&]id=([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
}

export async function syncPartnerJobFolder(
  drive: drive_v3.Drive,
  primaryFolderId: string,
  partnerFolderId: string,
  opts: { dryRun?: boolean; logger?: Pick<Console, 'log' | 'warn'> } = {},
): Promise<SyncPartnerJobFolderResult> {
  if (primaryFolderId === partnerFolderId) {
    throw new Error('syncPartnerJobFolder: primary and partner folder are the same');
  }
  const log = opts.logger ?? console;
  const dryRun = opts.dryRun === true;
  const result: SyncPartnerJobFolderResult = {
    foldersCreated: 0,
    shortcutsCreated: 0,
    duplicateFoldersTrashed: 0,
    duplicatesNeedingReview: [],
    docCopiesNeedingReview: [],
    failures: [],
  };

  async function recurse(srcId: string, dstId: string, path: string): Promise<void> {
    const [src, dst] = await Promise.all([listChildren(drive, srcId), listChildren(drive, dstId)]);

    // --- collapse duplicate sibling folders on the partner side (oldest wins) ---
    const dstFoldersByName = new Map<string, Child[]>();
    for (const c of dst) {
      if (c.mimeType === FOLDER && c.name) {
        const list = dstFoldersByName.get(c.name) ?? [];
        list.push(c);
        dstFoldersByName.set(c.name, list);
      }
    }
    for (const [name, list] of dstFoldersByName) {
      if (list.length < 2) continue;
      list.sort(oldestFirst);
      for (const dup of list.slice(1)) {
        try {
          const kids = await listChildren(drive, dup.id!);
          if (kids.length === 0) {
            if (!dryRun) {
              await drive.files.update({
                fileId: dup.id!,
                requestBody: { trashed: true },
                supportsAllDrives: true,
              });
            }
            result.duplicateFoldersTrashed++;
          } else {
            const p = `${path}/${name}`;
            const existing = result.duplicatesNeedingReview.find((d) => d.path === p);
            if (existing) existing.folderIds.push(dup.id!);
            else result.duplicatesNeedingReview.push({ path: p, folderIds: [list[0].id!, dup.id!] });
          }
        } catch (err) {
          result.failures.push({ path: `${path}/${name}`, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    const dstNames = new Map<string, Child>();
    for (const c of dst) if (c.name && !dstNames.has(c.name)) dstNames.set(c.name, c);

    // --- folders ---
    for (const folder of src.filter((c) => c.mimeType === FOLDER && c.id && c.name)) {
      const name = folder.name!;
      const here = `${path}/${name}`;
      try {
        const winner = (dstFoldersByName.get(name) ?? [])[0];
        let childDstId: string;
        if (winner?.id) {
          childDstId = winner.id;
        } else if (dryRun) {
          result.foldersCreated++;
          continue; // nothing to recurse into
        } else {
          childDstId = (await ensureChildFolderWithDrive(drive, dstId, name)).id;
          result.foldersCreated++;
        }
        await recurse(folder.id!, childDstId, here);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn(`[syncPartnerJobFolder] folder failed ${here}: ${reason}`);
        result.failures.push({ path: here, reason });
      }
    }

    // --- docs → shortcuts ---
    for (const file of src.filter((c) => c.mimeType !== FOLDER && c.id && c.name)) {
      const isShortcut = file.mimeType === SHORTCUT;
      const targetId = isShortcut ? file.shortcutDetails?.targetId : file.id;
      const targetType = isShortcut ? file.shortcutDetails?.targetMimeType : file.mimeType;
      if (!targetId || !targetType || !SHAREABLE_DOC_TYPES.has(targetType)) continue;

      const name = file.name!;
      const here = `${path}/${name}`;
      const present = dstNames.get(name);
      if (present) {
        if (present.mimeType !== SHORTCUT && present.mimeType !== FOLDER) {
          result.docCopiesNeedingReview.push({ path: here, partnerFileId: present.id! });
        }
        continue;
      }
      try {
        if (!dryRun) {
          await drive.files.create({
            requestBody: {
              name,
              mimeType: SHORTCUT,
              parents: [dstId],
              shortcutDetails: { targetId },
            },
            fields: 'id',
            supportsAllDrives: true,
          });
        }
        result.shortcutsCreated++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn(`[syncPartnerJobFolder] shortcut failed ${here}: ${reason}`);
        result.failures.push({ path: here, reason });
      }
    }
  }

  await recurse(primaryFolderId, partnerFolderId, '');
  return result;
}

export interface SyncForProjectResult {
  ok: boolean;
  skipped?: string;
  projectName?: string;
  primaryFolderId?: string;
  partnerFolderId?: string;
  sync?: SyncPartnerJobFolderResult;
  error?: string;
}

function readProjectName(fields: Record<string, unknown>): string | null {
  for (const key of ['Project Name (Job #)', 'Project Name (Job #) (Formula)', 'Project', 'Name']) {
    const v = fields[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Resolve a Project's primary + Brkthru job folders and sync them. */
export async function syncPartnerJobFolderForProject(
  projectId: string,
  options: { drive?: drive_v3.Drive; oidcToken?: string | null; dryRun?: boolean } = {},
): Promise<SyncForProjectResult> {
  try {
    const record = await getProjectsBase()(AIRTABLE_TABLES.PROJECTS).find(projectId);
    const fields = record.fields as Record<string, unknown>;
    const projectName = readProjectName(fields);
    if (!projectName) return { ok: true, skipped: 'no_project_name' };

    let primaryFolderId: string | null = null;
    for (const f of PRIMARY_LINK_FIELDS) {
      primaryFolderId = parseDriveFolderId(fields[f]);
      if (primaryFolderId) break;
    }
    if (!primaryFolderId) return { ok: true, skipped: 'no_primary_folder_link', projectName };

    const drive =
      options.drive ??
      (await getDriveClient({ vercelOidcToken: options.oidcToken ?? process.env.VERCEL_OIDC_TOKEN ?? null }));

    // Never create a job folder here for projects that were never delivered: delivery owns that.
    // ensureChild is race-safe, so reusing it for "find the oldest" is fine when the folder exists.
    const siblings = await listChildren(drive, BRKTHRU_PARENT_FOLDER_ID);
    const partner = siblings
      .filter((c) => c.mimeType === FOLDER && c.name === projectName)
      .sort(oldestFirst)[0];
    if (!partner?.id) return { ok: true, skipped: 'no_partner_job_folder', projectName, primaryFolderId };

    const sync = await syncPartnerJobFolder(drive, primaryFolderId, partner.id, { dryRun: options.dryRun });
    console.log('[syncPartnerJobFolder] done', { projectName, ...sync, duplicatesNeedingReview: sync.duplicatesNeedingReview.length, docCopiesNeedingReview: sync.docCopiesNeedingReview.length, failures: sync.failures.length });
    return {
      ok: sync.failures.length === 0,
      projectName,
      primaryFolderId,
      partnerFolderId: partner.id,
      sync,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[syncPartnerJobFolder] error', error);
    return { ok: false, error };
  }
}
