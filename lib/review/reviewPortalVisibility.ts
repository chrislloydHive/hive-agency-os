/**
 * Whether a CRAS row should appear in the client review portal based on live Drive state.
 * Airtable is the visibility checkbox; Drive decides if the file still belongs in review.
 */

export interface ReviewPortalDriveEligibility {
  /** Successful Drive metadata. Null when lookup failed. */
  meta: { trashed: boolean; parents: string[] } | null;
  /** Lookup failed with 404 after OAuth + service-account fallback. */
  notFound: boolean;
  /**
   * Direct-child folder IDs of Prospecting/Retargeting tactic folders.
   * Empty/null skips the parent check (folder map unavailable).
   */
  allowedFolderIds: Set<string> | null;
  /**
   * The CRAS file id, or a shortcut sitting in a review folder that points at it,
   * was listed as a direct child of a variant folder. Google Docs are often
   * shortcuts whose target parent is outside the review folder; listing the
   * folder is what proves the document is actually there.
   */
  presentInReviewFolder?: boolean;
}

/** A non-folder file listed directly inside a Client Review variant folder. */
export interface PortalListedFile {
  folderId: string;
  /** Id of the item that is actually in the folder (the shortcut, when one was added). */
  listedId: string;
  /** Id to preview (shortcut target when the folder child is a shortcut). */
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export function portalShortcutTargetId(file: {
  mimeType?: string | null;
  shortcutDetails?: { targetId?: string | null; targetMimeType?: string | null } | null;
}): { targetId: string; targetMimeType: string | null } | null {
  if ((file.mimeType ?? '') !== 'application/vnd.google-apps.shortcut') return null;
  const targetId = file.shortcutDetails?.targetId?.trim() ?? '';
  if (!targetId) return null;
  const targetMimeType = file.shortcutDetails?.targetMimeType?.trim() || null;
  return { targetId, targetMimeType };
}

export function portalListedFileFromChild(child: {
  folderId: string;
  id: string;
  name: string;
  mimeType?: string | null;
  modifiedTime?: string | null;
  shortcutTargetId?: string | null;
  shortcutTargetMimeType?: string | null;
}): PortalListedFile {
  const targetId = child.shortcutTargetId?.trim() || '';
  return {
    folderId: child.folderId,
    listedId: child.id,
    fileId: targetId || child.id,
    name: child.name,
    mimeType: child.shortcutTargetMimeType?.trim() || child.mimeType?.trim() || 'application/octet-stream',
    modifiedTime: child.modifiedTime?.trim() || '',
  };
}

export function portalListedFileIds(files: Iterable<PortalListedFile>): Set<string> {
  const ids = new Set<string>();
  for (const file of files) {
    if (file.fileId) ids.add(file.fileId);
    if (file.listedId) ids.add(file.listedId);
  }
  return ids;
}

/**
 * Match a CRAS row to the file currently in its review folder.
 * Prefers the same Drive id, then a same-name file in that variant folder
 * (stale CRAS id, live Google Doc / shortcut in the folder).
 */
export function matchPortalListedFile(
  files: readonly PortalListedFile[],
  driveFileId: string,
  filename: string | null,
  folderId?: string | null,
): PortalListedFile | null {
  const scope = folderId ? files.filter((file) => file.folderId === folderId) : files;
  const id = driveFileId.trim();
  const byId = scope.find((file) => file.fileId === id || file.listedId === id);
  if (byId) return byId;
  if (!filename) return null;
  return scope.find((file) => portalAssetNamesMatch(file.name, filename)) ?? null;
}

/** Keep the CRAS id when it is the listed file or its shortcut; otherwise use the live folder file. */
export function portalDisplayFileId(crasFileId: string, listed: PortalListedFile | null): string {
  if (!listed) return crasFileId;
  if (crasFileId === listed.fileId || crasFileId === listed.listedId) return crasFileId;
  return listed.fileId;
}

/** Lowercase basename without extension/punctuation, for matching Google Docs to CRAS rows. */
export function normalizePortalAssetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.(gdoc|gsheet|gslides|docx?|pdf|xlsx?|pptx?|txt|url|webloc|mp4|mov|webm)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function portalAssetNamesMatch(a: string, b: string): boolean {
  const na = normalizePortalAssetName(a);
  const nb = normalizePortalAssetName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.replace(/\s/g, '') === nb.replace(/\s/g, '');
}

export function hiddenPortalAssetNames(records: Iterable<{ filename: string | null; hidden?: boolean; showInClientPortal?: boolean }>): Set<string> {
  const names = new Set<string>();
  for (const rec of records) {
    const hidden = rec.hidden === true || rec.showInClientPortal !== true;
    if (!hidden || !rec.filename) continue;
    const n = normalizePortalAssetName(rec.filename);
    if (n) names.add(n);
  }
  return names;
}

/**
 * Hide assets that were deleted from Drive, trashed, or moved out of Client Review
 * variant folders (e.g. copies under _Production Assets that ingest used to pick up).
 */
export function isDriveFileEligibleForReviewPortal(input: ReviewPortalDriveEligibility): boolean {
  if (input.meta?.trashed) return false;
  // Listed in the review folder wins over a 404 or a parent that points at the
  // shortcut target's original location (typical for Google Docs).
  if (input.presentInReviewFolder) return true;
  if (input.notFound) return false;

  const allowed = input.allowedFolderIds;
  if (!allowed || allowed.size === 0) return true;
  if (!input.meta) return true;

  return input.meta.parents.some((parentId) => allowed.has(parentId));
}
