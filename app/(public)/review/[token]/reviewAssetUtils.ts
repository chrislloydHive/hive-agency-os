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

/** Primary CTA — amber matches portal selection / “New” accents so pending work stands out. */
export const REVIEW_APPROVE_BUTTON_CLASS =
  'rounded-md bg-amber-600 font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

/** Completed approval — muted outline, distinct from the solid Approve action. */
export const REVIEW_APPROVED_INDICATOR_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-950/50 font-medium text-emerald-300';

/** Status badge on asset cards when approved. */
export const REVIEW_APPROVED_BADGE_CLASS =
  'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-semibold';

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
