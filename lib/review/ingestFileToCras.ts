// lib/review/ingestFileToCras.ts
// Creative ingestion: given a Drive file (with its parent folder ID), look up
// the matching Project via the Projects table's "Creative Review Hub Folder ID"
// and create a CRAS (Creative Review Asset Status) record linked to that Project.
//
// A file is considered to belong to a project if its parent folder is the
// project's Creative Review Hub folder OR any descendant of it (subfolders at
// any depth, e.g. Display/Prospecting). Matching is dynamic — no hardcoded
// folder IDs — and supports multiple projects simultaneously.

import type { drive_v3 } from 'googleapis';
import {
  getProjectsByCreativeReviewHubFolderId,
  type ProjectFolderMapping,
} from '@/lib/airtable/projectFolderMap';
import { ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';

export interface IngestFileInput {
  /** Drive file ID. */
  fileId: string;
  /** Drive file name. */
  fileName?: string;
  /** Drive folder ID this file lives in (its immediate parent). */
  folderId: string;
  /**
   * Optional: full ancestor chain of the file's parent (folderId first, then
   * each successive parent up the tree). When provided, no Drive API calls are
   * made — we walk this chain in-memory. If absent we fall back to the Drive
   * API (if a client is available) to walk up parents at lookup time.
   */
  parentFolderIds?: string[];
  /** Optional tactic / variant if the caller knows them. */
  tactic?: string;
  variant?: string;
}

export interface IngestOptions {
  /** Optional Drive client used to walk up the parent chain when parentFolderIds is missing. */
  drive?: drive_v3.Drive;
  /** Max depth to walk up the parent chain. */
  maxDepth?: number;
}

export type IngestFileResult =
  | { status: 'created'; project: ProjectFolderMapping }
  | { status: 'exists'; project: ProjectFolderMapping }
  | { status: 'unmatched' }
  | { status: 'error'; error: string };

const DEFAULT_MAX_DEPTH = 10;

/**
 * Lightweight in-process cache mapping a Drive folder ID → its parent folder ID.
 * Avoids re-fetching the same folder while traversing many sibling files.
 */
const parentLookupCache = new Map<string, string | null>();

async function getParentFolderId(
  drive: drive_v3.Drive,
  folderId: string
): Promise<string | null> {
  if (parentLookupCache.has(folderId)) {
    return parentLookupCache.get(folderId) ?? null;
  }
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id,parents',
      supportsAllDrives: true,
    });
    const parent = res.data.parents?.[0] ?? null;
    parentLookupCache.set(folderId, parent);
    return parent;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ingest] failed to fetch parent for folderId=${folderId}:`,
      msg
    );
    parentLookupCache.set(folderId, null);
    return null;
  }
}

/**
 * Returns true if `folderId` is the same as `targetFolderId` or is nested
 * anywhere underneath it.
 *
 * - If `parentChain` is provided (caller-known ancestor list), the check is
 *   performed in-memory with no Drive API calls.
 * - Otherwise, if a Drive client is available, walks up parents via Drive API
 *   (cached, bounded by `maxDepth`).
 * - Otherwise, falls back to an exact-id comparison.
 */
export async function isDescendantOf(
  folderId: string,
  targetFolderId: string,
  options: { parentChain?: string[]; drive?: drive_v3.Drive; maxDepth?: number } = {}
): Promise<boolean> {
  if (!folderId || !targetFolderId) return false;
  if (folderId === targetFolderId) return true;

  // 1) Caller-supplied chain → in-memory check.
  if (options.parentChain && options.parentChain.length > 0) {
    return options.parentChain.includes(targetFolderId);
  }

  // 2) Drive API walk-up.
  if (options.drive) {
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    let current: string | null = folderId;
    for (let i = 0; i < maxDepth && current; i++) {
      const parent: string | null = await getParentFolderId(options.drive, current);
      if (!parent) return false;
      if (parent === targetFolderId) return true;
      current = parent;
    }
    return false;
  }

  // 3) No information available → exact match only (already failed above).
  return false;
}

/**
 * Resolve the parent chain for a file's folder up to `maxDepth` ancestors.
 * Used to match a file against any project whose CRH folder appears in the chain.
 */
async function resolveParentChain(
  startFolderId: string,
  options: IngestOptions
): Promise<string[]> {
  const chain: string[] = [startFolderId];
  if (!options.drive) return chain;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  let current: string | null = startFolderId;
  for (let i = 0; i < maxDepth; i++) {
    const parent: string | null = await getParentFolderId(options.drive, current!);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/**
 * Ingest a single file: match its parent (or any ancestor) against Projects
 * and create a CRAS record if a matching project is found.
 */
export async function ingestFileToCras(
  file: IngestFileInput,
  folderMap?: Map<string, ProjectFolderMapping>,
  options: IngestOptions = {}
): Promise<IngestFileResult> {
  console.log('[ingest] file detected:', {
    fileId: file.fileId,
    fileName: file.fileName,
    folderId: file.folderId,
  });

  const map = folderMap ?? (await getProjectsByCreativeReviewHubFolderId());

  // Build ancestor chain. Prefer caller-provided list; otherwise use Drive API.
  const chain =
    file.parentFolderIds && file.parentFolderIds.length > 0
      ? file.parentFolderIds
      : await resolveParentChain(file.folderId, options);

  // Find the first project whose CRH folder appears anywhere in the chain.
  let matched: ProjectFolderMapping | undefined;
  for (const ancestorId of chain) {
    const candidate = map.get(ancestorId);
    if (candidate) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    console.log(
      `[ingest] no project mapping for folderId: ${file.folderId}`,
      { fileId: file.fileId, ancestorChain: chain }
    );
    return { status: 'unmatched' };
  }

  console.log('[ingest] matched project:', {
    projectId: matched.projectId,
    projectName: matched.projectName,
    crhFolderId: matched.folderId,
    fileId: file.fileId,
  });

  if (!matched.reviewToken) {
    console.warn(
      `[ingest] project ${matched.projectName} (${matched.projectId}) has no Client Review Portal Token; creating CRAS with empty token.`
    );
  }

  try {
    const created = await ensureCrasRecord({
      token: matched.reviewToken ?? '',
      projectId: matched.projectId,
      driveFileId: file.fileId,
      filename: file.fileName,
      tactic: file.tactic ?? '',
      variant: file.variant ?? '',
    });
    if (created) {
      console.log('[ingest] CRAS created', {
        projectId: matched.projectId,
        fileId: file.fileId,
      });
    } else {
      console.log('[ingest] CRAS already exists', {
        projectId: matched.projectId,
        fileId: file.fileId,
      });
    }
    return { status: created ? 'created' : 'exists', project: matched };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ingest] failed to create CRAS record:', msg);
    return { status: 'error', error: msg };
  }
}

/**
 * Ingest a batch of files. Loads the project folder map once and reuses it
 * (and the parent-folder cache) across all files for efficiency.
 */
export async function ingestFilesToCras(
  files: IngestFileInput[],
  options: IngestOptions = {}
): Promise<{
  created: number;
  exists: number;
  unmatched: number;
  errors: number;
  unmatchedFolderIds: string[];
}> {
  const map = await getProjectsByCreativeReviewHubFolderId();
  console.log(
    `[ingest] loaded ${map.size} project(s) with Creative Review Hub Folder ID`
  );

  let created = 0;
  let exists = 0;
  let unmatched = 0;
  let errors = 0;
  const unmatchedFolderIds = new Set<string>();

  for (const file of files) {
    const result = await ingestFileToCras(file, map, options);
    switch (result.status) {
      case 'created':
        created++;
        break;
      case 'exists':
        exists++;
        break;
      case 'unmatched':
        unmatched++;
        unmatchedFolderIds.add(file.folderId);
        break;
      case 'error':
        errors++;
        break;
    }
  }

  console.log('[ingest] batch done', {
    filesScanned: files.length,
    created,
    exists,
    unmatched,
    errors,
    unmatchedFolderIds: Array.from(unmatchedFolderIds),
  });

  return {
    created,
    exists,
    unmatched,
    errors,
    unmatchedFolderIds: Array.from(unmatchedFolderIds),
  };
}
