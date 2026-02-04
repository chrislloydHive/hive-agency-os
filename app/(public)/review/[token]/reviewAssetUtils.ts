/**
 * Shared helpers for Creative Review assets (New badge, selection).
 * Keep isNew and assetApprovedClient logic in one place.
 */

export interface AssetForNewCheck {
  firstSeenByClientAt?: string | null;
  assetApprovedClient?: boolean;
}

/**
 * "New" = never seen by client AND not approved. Mutually exclusive with Approved.
 * Treats empty string firstSeenByClientAt as null; safe for malformed values.
 */
export function isAssetNew(asset: AssetForNewCheck): boolean {
  const v = asset.firstSeenByClientAt;
  const hasSeenAt = v != null && typeof v === 'string' && v.trim() !== '';
  if (asset.assetApprovedClient) return false;
  return !hasSeenAt;
}

export interface SectionCounts {
  totalCount: number;
  newCount: number;
  approvedCount: number;
  pendingCount: number;
}

/**
 * Compute total, new, approved, and pending counts from a section's displayed assets.
 * Use this so all section-level counts are consistent (same source of truth).
 */
export function getSectionCounts(assets: AssetForNewCheck[]): SectionCounts {
  const totalCount = assets.length;
  let newCount = 0;
  let approvedCount = 0;
  for (const a of assets) {
    if (isAssetNew(a)) newCount += 1;
    if (a.assetApprovedClient) approvedCount += 1;
  }
  const pendingCount = totalCount - approvedCount;
  return { totalCount, newCount, approvedCount, pendingCount };
}
