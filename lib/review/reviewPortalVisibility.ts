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
  if (input.notFound) return false;
  if (input.meta?.trashed) return false;

  const allowed = input.allowedFolderIds;
  if (!allowed || allowed.size === 0) return true;
  if (!input.meta) return true;

  return input.meta.parents.some((parentId) => allowed.has(parentId));
}
