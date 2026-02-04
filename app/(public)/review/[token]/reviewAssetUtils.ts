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
