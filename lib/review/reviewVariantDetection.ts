// lib/review/reviewVariantDetection.ts
// Centralized variant (Prospecting / Retargeting) detection from folder names or paths.
// Ensures Retargeting is first-class: Remarketing, RTG, Re-targeting, etc. map to Retargeting.

export type ReviewVariant = 'Prospecting' | 'Retargeting';

const PROSPECTING_ALIASES = ['prospecting'];
const RETARGETING_ALIASES = ['retargeting', 'remarketing', 'rtg', 're-targeting', 're targeting'];

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '');
}

/**
 * Detect variant from a path segment or folder name (e.g. "Retargeting", "Remarketing", "RTG").
 * Returns canonical "Prospecting" | "Retargeting" or null if unknown.
 */
export function detectVariantFromPath(pathOrFolderName: string): ReviewVariant | null {
  if (typeof pathOrFolderName !== 'string' || !pathOrFolderName.trim()) return null;
  const normalized = normalizeForMatch(pathOrFolderName);
  // Use last path segment if path contains slashes (e.g. ".../Retargeting")
  const lastPart = pathOrFolderName.trim().split(/[/\\]/).pop()?.trim() ?? '';
  const segment = normalizeForMatch(lastPart) || normalized;
  if (!segment) return null;
  if (PROSPECTING_ALIASES.includes(segment)) return 'Prospecting';
  if (RETARGETING_ALIASES.includes(segment)) return 'Retargeting';
  return null;
}
