import {
  isStatusRecordVisibleInPortal,
  statusRecordForDriveFile,
  type StatusRecord,
} from '@/lib/airtable/reviewAssetStatus';
import { resolveInlineContentType } from '@/lib/review/reviewMediaDisplay';
import {
  hiddenPortalAssetNames,
  normalizePortalAssetName,
  portalAssetNamesMatch,
} from '@/lib/review/reviewPortalVisibility';

type ReviewState = 'new' | 'seen' | 'approved' | 'needs_changes';

type CrasEnrichableAsset = {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

type CrasEnrichableSection = {
  variant: string;
  tactic: string;
  assets: CrasEnrichableAsset[];
  fileCount: number;
};

function toReviewState(rec: StatusRecord): ReviewState | undefined {
  if (rec.assetApprovedClient) return 'approved';
  const s = rec.status.toLowerCase();
  if (s === 'needs changes') return 'needs_changes';
  if (s === 'seen') return 'seen';
  return 'new';
}

function crasRecordForDriveAsset(
  statusMap: Map<string, StatusRecord>,
  token: string,
  asset: CrasEnrichableAsset,
): StatusRecord | undefined {
  const byId = statusRecordForDriveFile(statusMap, token, asset.fileId);
  const nameMatches = [...statusMap.values()].filter(
    (rec) => rec.filename != null && portalAssetNamesMatch(asset.name, rec.filename),
  );
  const hiddenByName = nameMatches.find((rec) => !isStatusRecordVisibleInPortal(rec));
  // An unchecked duplicate with the same title must win over a newer checked row
  // that portal load created with a different Drive file id.
  if (hiddenByName) return hiddenByName;
  if (byId) return byId;
  return nameMatches[0];
}

/** Attach CRAS / Mux / review fields to Drive-listed assets for SSR first paint.
 *  Only assets with a visible CRAS row are shown. Drive-only leftovers (Google Docs
 *  whose file id does not match Airtable) are not shown. Same-name unchecked CRAS
 *  hides the file even if another duplicate is still checked.
 */
export function enrichReviewSectionsFromCras<T extends CrasEnrichableSection>(
  sections: T[],
  statusMap: Map<string, StatusRecord>,
  token: string,
): T[] {
  const hiddenNames = hiddenPortalAssetNames(statusMap.values());

  return sections.map((sec) => {
    const assets = sec.assets.flatMap((asset) => {
      const driveName = normalizePortalAssetName(asset.name);
      if (driveName && hiddenNames.has(driveName)) {
        return [];
      }
      const rec = crasRecordForDriveAsset(statusMap, token, asset);
      if (!rec || !isStatusRecordVisibleInPortal(rec)) {
        return [];
      }
      return [{
        ...asset,
        name: rec.filename ?? asset.name,
        mimeType: resolveInlineContentType(
          asset.mimeType?.trim() || 'application/octet-stream',
          rec.filename ?? asset.name,
        ),
        reviewState: toReviewState(rec),
        clickThroughUrl: rec.landingPageOverrideUrl ?? rec.effectiveLandingPageUrl ?? null,
        firstSeenByClientAt: rec.firstSeenByClientAt,
        assetApprovedClient: rec.assetApprovedClient,
        deliveredAt: rec.deliveredAt,
        delivered: rec.delivered,
        deliveredFolderId: rec.deliveredFolderId,
        deliveredFileUrl: rec.deliveredFileUrl,
        airtableRecordId: rec.recordId,
        approvedAt: rec.approvedAt,
        approvedByName: rec.approvedByName,
        approvedByEmail: rec.approvedByEmail,
        firstSeenAt: rec.firstSeenAt,
        lastSeenAt: rec.lastSeenAt,
        partnerDownloadedAt: rec.partnerDownloadedAt,
        placementGroupId: rec.placementGroupId,
        placementGroupName: rec.placementGroupName,
        placementType: rec.placementType,
        placementCardOrder: rec.placementCardOrder,
        muxPlaybackId: rec.muxPlaybackId,
        muxStatus: rec.muxStatus,
        muxAspectRatio: rec.muxAspectRatio,
      }];
    });
    return {
      ...sec,
      assets,
      fileCount: assets.length,
    };
  });
}
