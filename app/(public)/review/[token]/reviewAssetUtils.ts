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

export function isAssetPending(asset: { assetApprovedClient?: boolean }): boolean {
  return !asset.assetApprovedClient;
}

export interface VariantApprovalStats {
  variant: string;
  total: number;
  approved: number;
  pending: number;
}

export interface PortalApprovalStats {
  totalCount: number;
  totalApproved: number;
  totalPending: number;
  byVariant: VariantApprovalStats[];
}

type SectionForStats = {
  variant: string;
  assets: { assetApprovedClient?: boolean }[];
};

/** Portal-wide approval counts derived from loaded sections (not hardcoded). */
export function getPortalApprovalStats(
  sections: SectionForStats[],
  variants: string[]
): PortalApprovalStats {
  const byVariant = variants.map((variant) => {
    const assets = sections.filter((s) => s.variant === variant).flatMap((s) => s.assets);
    const total = assets.length;
    const approved = assets.filter((a) => a.assetApprovedClient).length;
    return { variant, total, approved, pending: total - approved };
  });
  const totalCount = byVariant.reduce((sum, v) => sum + v.total, 0);
  const totalApproved = byVariant.reduce((sum, v) => sum + v.approved, 0);
  return {
    totalCount,
    totalApproved,
    totalPending: totalCount - totalApproved,
    byVariant,
  };
}

/** e.g. "Prospecting (4) and Retargeting (34)" — only types with pending > 0. */
export function formatPendingTypeBreakdown(byVariant: VariantApprovalStats[]): string {
  const withPending = byVariant.filter((v) => v.pending > 0);
  if (withPending.length === 0) return '';
  const parts = withPending.map((v) => `${v.variant} (${v.pending})`);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

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
