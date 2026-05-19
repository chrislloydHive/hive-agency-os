import type { StatusRecord } from '@/lib/airtable/reviewAssetStatus';
import { resolveInlineContentType } from '@/lib/review/reviewMediaDisplay';

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

/** Attach CRAS / Mux / review fields to Drive-listed assets for SSR first paint. */
export function enrichReviewSectionsFromCras<T extends CrasEnrichableSection>(
  sections: T[],
  statusMap: Map<string, StatusRecord>,
): T[] {
  return sections.map((sec) => ({
    ...sec,
    assets: sec.assets.map((asset) => {
      const rec = statusMap.get(asset.fileId);
      if (!rec) {
        return {
          ...asset,
          mimeType: resolveInlineContentType(asset.mimeType, asset.name),
        };
      }
      return {
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
      };
    }),
  }));
}
