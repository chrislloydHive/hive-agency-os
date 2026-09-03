/**
 * Merge refreshed /api/review/assets sections into existing portal state.
 * Incoming (API) is the source of truth for which fileIds belong in a section,
 * so unchecking "Show in Client Portal" in Airtable actually removes the asset.
 * Matching fileIds keep previous fields then overlay API fields (Mux, review state).
 */

export type MergeableReviewAsset = {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

export type MergeableTacticSection = {
  variant: string;
  tactic: string;
  assets: MergeableReviewAsset[];
  fileCount: number;
};

function sectionKey(variant: string, tactic: string): string {
  return `${variant}:${tactic}`;
}

function sortAssetsNewestFirst(assets: MergeableReviewAsset[]): MergeableReviewAsset[] {
  return [...assets].sort((a, b) => {
    const ta = typeof a.modifiedTime === 'string' ? Date.parse(a.modifiedTime) : 0;
    const tb = typeof b.modifiedTime === 'string' ? Date.parse(b.modifiedTime) : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Incoming (API) wins file membership for a section. Previous-only assets are
 * dropped so Airtable visibility flags are not undone by Drive SSR leftovers.
 * Incoming wins field conflicts on matching fileIds.
 */
export function mergeReviewSections<T extends MergeableTacticSection>(
  previous: T[],
  incoming: T[],
): T[] {
  const prevByKey = new Map(previous.map((s) => [sectionKey(s.variant, s.tactic), s]));
  const incByKey = new Map(incoming.map((s) => [sectionKey(s.variant, s.tactic), s]));
  const allKeys = new Set([...prevByKey.keys(), ...incByKey.keys()]);

  const merged: T[] = [];
  for (const key of allKeys) {
    const prevSec = prevByKey.get(key);
    const incSec = incByKey.get(key);
    if (!prevSec && incSec) {
      merged.push(incSec);
      continue;
    }
    if (prevSec && !incSec) {
      merged.push(prevSec);
      continue;
    }
    if (!prevSec || !incSec) continue;

    const prevByFileId = new Map(prevSec.assets.map((a) => [a.fileId, a]));
    const byFileId = new Map<string, MergeableReviewAsset>();
    for (const a of incSec.assets) {
      const existing = prevByFileId.get(a.fileId);
      byFileId.set(a.fileId, existing ? { ...existing, ...a } : { ...a });
    }

    const assets = sortAssetsNewestFirst([...byFileId.values()]) as T['assets'];
    merged.push({
      ...prevSec,
      ...incSec,
      assets,
      fileCount: assets.length,
      groupId: (prevSec as { groupId?: string }).groupId ?? (incSec as { groupId?: string }).groupId,
    });
  }

  return merged.sort((a, b) => {
    const v = a.variant.localeCompare(b.variant);
    if (v !== 0) return v;
    return a.tactic.localeCompare(b.tactic);
  });
}
