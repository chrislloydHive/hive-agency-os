// app/api/review/assets/route.ts
// Returns asset list (sections with files) for the Client Review Portal.
// AIRTABLE-FIRST APPROACH: Assets are discovered from CRAS records in Airtable.
// Only files whose Drive parent is a recognized variant folder (Prospecting/Retargeting)
// are shown — files in subfolders within variant folders are excluded.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { listAssetStatuses, getDriveFileIdsForBatch, type StatusRecord } from '@/lib/airtable/reviewAssetStatus';
import { getGroupApprovals, groupKey } from '@/lib/airtable/reviewGroupApprovals';
import {
  getDeliveryContextByProjectId,
  listBatchesByProjectId,
  getProjectDefaultBatchId,
  getBatchDetails,
  getBatchDetailsInBase,
  type BatchContext,
} from '@/lib/airtable/partnerDeliveryBatches';
import {
  getReviewFolderMapFromJobFolderPartial,
  getReviewFolderMapFromClientProjectsFolder,
} from '@/lib/review/reviewFolders';
import type { drive_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

const VARIANTS = ['Prospecting', 'Retargeting'] as const;
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search'] as const;

/** Normalize tactic name to canonical form (e.g., "PMax" → "PMAX", "Performance Max" → "PMAX"). */
function normalizeTactic(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === 'pmax' || lower === 'p-max' || lower === 'performance max' || lower === 'performancemax') {
    return 'PMAX';
  }
  if (lower === 'ooh' || lower === 'out of home' || lower === 'out-of-home') {
    return 'OOH';
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export type ReviewState = 'new' | 'seen' | 'approved' | 'needs_changes';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  reviewState?: ReviewState;
  /** Click-through URL: status override or project primary; null if neither set. */
  clickThroughUrl?: string | null;
  /** When client first saw this asset; null = never seen (show "New"). */
  firstSeenByClientAt?: string | null;
  /** Client approval checkbox; "New" and "Approved" are mutually exclusive. */
  assetApprovedClient?: boolean;
  /** When asset was delivered to partner; null = not delivered. */
  deliveredAt?: string | null;
  /** True if asset has been delivered (default false). */
  delivered?: boolean;
  /** Drive folder ID of the delivery run; null if not delivered. */
  deliveredFolderId?: string | null;
  /** URL to open delivered folder/file in Drive; null if not delivered. */
  deliveredFileUrl?: string | null;
  /** CRAS record id for delivery updates. */
  airtableRecordId?: string;
  /** When asset was approved (for "Newly Approved" tab: approvedAt > partnerLastSeenAt). */
  approvedAt?: string | null;
  /** Name of person who approved (client). */
  approvedByName?: string | null;
  /** Email of person who approved (client). */
  approvedByEmail?: string | null;
  /** First seen at (portal/lightbox open). */
  firstSeenAt?: string | null;
  /** Last seen at (portal/lightbox open). */
  lastSeenAt?: string | null;
  /** When partner downloaded this asset in the portal; null = not downloaded. */
  partnerDownloadedAt?: string | null;
  // Placement grouping fields (for carousel/grouped assets)
  /** Placement Group ID: groups multiple assets as one reviewable placement (e.g., carousel). */
  placementGroupId?: string | null;
  /** Display name for the grouped placement. */
  placementGroupName?: string | null;
  /** Placement type: "Carousel", "Static", etc. Controls rendering. */
  placementType?: string | null;
  /** Sort order within the group (1, 2, 3, 4 for carousel cards). */
  placementCardOrder?: number | null;
}

interface TacticSectionData {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
  /** As-of group approval timestamp (from Creative Review Group Approvals). */
  groupApprovalApprovedAt?: string | null;
  groupApprovalApprovedByName?: string | null;
  groupApprovalApprovedByEmail?: string | null;
  /** Count of assets with modifiedTime > groupApprovalApprovedAt. */
  newSinceApprovalCount?: number;
}

/** Drive file metadata (mimeType, modifiedTime, parents) fetched in batches. */
interface DriveFileMeta {
  mimeType: string;
  modifiedTime: string;
  parents: string[];
}

/**
 * Fetch Drive file metadata for a batch of file IDs.
 * Includes parents so the caller can verify files are direct children of variant folders.
 */
async function batchGetDriveFileMeta(
  drive: drive_v3.Drive,
  fileIds: string[],
): Promise<Map<string, DriveFileMeta>> {
  const metaMap = new Map<string, DriveFileMeta>();
  const BATCH_SIZE = 100;

  for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
    const batch = fileIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (fileId) => {
        const res = await drive.files.get({
          fileId,
          fields: 'mimeType, modifiedTime, parents',
          supportsAllDrives: true,
        });
        return {
          fileId,
          mimeType: res.data.mimeType ?? 'application/octet-stream',
          modifiedTime: res.data.modifiedTime ?? '',
          parents: res.data.parents ?? [],
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        metaMap.set(result.value.fileId, {
          mimeType: result.value.mimeType,
          modifiedTime: result.value.modifiedTime,
          parents: result.value.parents,
        });
      }
    }
  }

  return metaMap;
}

/**
 * Convert StatusRecord from CRAS to ReviewAsset for portal display.
 * Uses CRAS data as the source of truth; enriches with Drive metadata when available.
 */
function statusRecordToReviewAsset(
  rec: StatusRecord,
  primaryLandingPageUrl: string | null,
  driveMeta?: DriveFileMeta,
): ReviewAsset {
  const toReviewState = (): ReviewState => {
    if (rec.assetApprovedClient) return 'approved';
    const s = rec.status.toLowerCase();
    if (s === 'needs changes') return 'needs_changes';
    if (s === 'seen') return 'seen';
    return 'new';
  };

  const clickThroughUrl = rec.landingPageOverrideUrl ?? rec.effectiveLandingPageUrl ?? primaryLandingPageUrl ?? null;

  return {
    fileId: rec.driveFileId,
    name: rec.filename ?? rec.driveFileId, // Fallback to fileId if no filename
    mimeType: driveMeta?.mimeType ?? 'application/octet-stream',
    modifiedTime: driveMeta?.modifiedTime ?? '',
    reviewState: toReviewState(),
    clickThroughUrl,
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
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const debugFlag = req.nextUrl.searchParams.get('debug') === '1';
    const batchIdParam = req.nextUrl.searchParams.get('batchId')?.trim() || null;

    const resolved = await resolveReviewProject(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const { project, auth } = resolved;
    const drive = google.drive({ version: 'v3', auth });

    // ═══════════════════════════════════════════════════════════════════════════
    // AIRTABLE-FIRST APPROACH: Fetch all CRAS records for this token first.
    // Assets are shown based on CRAS records, not Drive folder traversal.
    // This ensures all assets with CRAS records are displayed regardless of
    // their Drive folder location.
    // ═══════════════════════════════════════════════════════════════════════════

    let statusMap: Map<string, StatusRecord>;
    try {
      statusMap = await listAssetStatuses(token);
      console.log(`[review/assets] AIRTABLE-FIRST: Found ${statusMap.size} CRAS records for token ${token.slice(0, 8)}...`);
    } catch (err) {
      console.error('[review/assets] listAssetStatuses failed:', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: 'Failed to load asset statuses from Airtable', detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    const primaryLandingPageUrl = project.primaryLandingPageUrl ?? null;

    // Filter out hidden assets and collect all CRAS records
    const visibleCrasRecords: StatusRecord[] = [];
    const allCrasRecords = Array.from(statusMap.values());
    for (const rec of allCrasRecords) {
      // Only filter by explicit Hidden field, not by folder location
      if (rec.hidden) {
        console.log(`[review/assets] Skipping hidden asset: ${rec.driveFileId} (${rec.filename})`);
        continue;
      }
      visibleCrasRecords.push(rec);
    }

    console.log(`[review/assets] After hidden filter: ${visibleCrasRecords.length} visible assets`);

    // Optionally fetch Drive metadata (mimeType, modifiedTime) for all visible assets
    // This is non-blocking - if Drive API fails, we still show assets with defaults
    let driveMetaMap = new Map<string, DriveFileMeta>();
    const fileIdsForMeta = visibleCrasRecords.map(r => r.driveFileId);
    if (fileIdsForMeta.length > 0) {
      try {
        driveMetaMap = await batchGetDriveFileMeta(drive, fileIdsForMeta);
        console.log(`[review/assets] Fetched Drive metadata for ${driveMetaMap.size}/${fileIdsForMeta.length} files`);
      } catch (err) {
        console.warn('[review/assets] batchGetDriveFileMeta failed (non-fatal):', err instanceof Error ? err.message : err);
      }
    }

    // Resolve variant folder IDs so we can verify each file is a direct child
    // of a Prospecting or Retargeting folder (not in a subfolder).
    let allowedParentIds = new Set<string>();
    try {
      const folderResult = project.jobFolderId
        ? await getReviewFolderMapFromJobFolderPartial(drive, project.jobFolderId)
        : await (async () => {
            const clientProjectsFolderId = process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
            if (clientProjectsFolderId) {
              return getReviewFolderMapFromClientProjectsFolder(drive, project.name, clientProjectsFolderId);
            }
            return null;
          })();
      if (folderResult) {
        for (const folderId of folderResult.map.values()) {
          allowedParentIds.add(folderId);
        }
        console.log(`[review/assets] Resolved ${allowedParentIds.size} variant folder IDs for parent filtering`);
      }
    } catch (err) {
      console.warn('[review/assets] Failed to resolve folder map (parent filtering disabled):', err instanceof Error ? err.message : err);
    }

    // Group CRAS records by tactic/variant and convert to ReviewAsset format
    const sectionMap = new Map<string, ReviewAsset[]>();

    // Initialize all sections (even empty ones)
    for (const variant of VARIANTS) {
      for (const tactic of TACTICS) {
        sectionMap.set(`${variant}:${tactic}`, []);
      }
    }

    // Populate sections from CRAS records.
    // Only files that are direct children of a variant folder are included.
    let skippedTacticVariantCount = 0;
    let skippedParentCount = 0;

    for (const rec of visibleCrasRecords) {
      const rawTactic = rec.tactic ?? '';
      const rawVariant = rec.variant ?? '';

      // Normalize tactic/variant names
      const tactic = rawTactic ? normalizeTactic(rawTactic) : '';
      const variant = rawVariant ? rawVariant.charAt(0).toUpperCase() + rawVariant.slice(1) : '';

      const validTactic = TACTICS.includes(tactic as typeof TACTICS[number]);
      const validVariant = VARIANTS.includes(variant as typeof VARIANTS[number]);

      if (!validTactic || !validVariant) {
        skippedTacticVariantCount++;
        if (skippedTacticVariantCount <= 5) {
          console.log(`[review/assets] Skipping asset ${rec.driveFileId} (${rec.filename}) — unrecognized tactic/variant ("${rawTactic}"/"${rawVariant}")`);
        }
        continue;
      }

      // Only show files whose Drive parent is a known variant folder.
      // This excludes files in subfolders and files no longer in Drive.
      if (allowedParentIds.size > 0) {
        const driveMeta = driveMetaMap.get(rec.driveFileId);
        if (!driveMeta) {
          // File not found in Drive (deleted/moved/inaccessible) — skip
          skippedParentCount++;
          if (skippedParentCount <= 5) {
            console.log(`[review/assets] Skipping asset ${rec.driveFileId} (${rec.filename}) — not found in Drive`);
          }
          continue;
        }
        const parents = driveMeta.parents;
        if (!parents.some((pid) => allowedParentIds.has(pid))) {
          skippedParentCount++;
          if (skippedParentCount <= 5) {
            console.log(`[review/assets] Skipping asset ${rec.driveFileId} (${rec.filename}) — not a direct child of a variant folder`);
          }
          continue;
        }
      }

      const key = `${variant}:${tactic}`;
      const driveMeta = driveMetaMap.get(rec.driveFileId);
      const asset = statusRecordToReviewAsset(rec, primaryLandingPageUrl, driveMeta);

      const sectionAssets = sectionMap.get(key);
      if (sectionAssets) {
        sectionAssets.push(asset);
      }
    }

    if (skippedTacticVariantCount > 0) {
      console.log(`[review/assets] Skipped ${skippedTacticVariantCount} assets with missing/unrecognized tactic/variant`);
    }
    if (skippedParentCount > 0) {
      console.log(`[review/assets] Skipped ${skippedParentCount} assets not in variant folders (in subfolders)`);
    }

    // Build sections array
    const sections: TacticSectionData[] = [];
    for (const variant of VARIANTS) {
      for (const tactic of TACTICS) {
        const key = `${variant}:${tactic}`;
        const assets = sectionMap.get(key) ?? [];
        sections.push({
          variant,
          tactic,
          assets,
          fileCount: assets.length,
        });
      }
    }

    // Attach group approval (as-of) and newSinceApprovalCount per section
    let groupApprovals: Record<string, { approvedAt: string; approvedByName: string | null; approvedByEmail: string | null }> = {};
    try {
      groupApprovals = await getGroupApprovals(token);
    } catch (err) {
      console.warn('[review/assets] getGroupApprovals failed (table may be missing):', err instanceof Error ? err.message : err);
    }
    for (const section of sections) {
      const key = groupKey(section.tactic, section.variant);
      const approval = groupApprovals[key];
      if (approval) {
        section.groupApprovalApprovedAt = approval.approvedAt;
        section.groupApprovalApprovedByName = approval.approvedByName ?? null;
        section.groupApprovalApprovedByEmail = approval.approvedByEmail ?? null;
        const approvedAtMs = new Date(approval.approvedAt).getTime();
        section.newSinceApprovalCount = section.assets.filter(
          (a) => a.modifiedTime && new Date(a.modifiedTime).getTime() > approvedAtMs
        ).length;
      } else {
        section.groupApprovalApprovedAt = null;
        section.groupApprovalApprovedByName = null;
        section.groupApprovalApprovedByEmail = null;
        section.newSinceApprovalCount = 0;
      }
    }

    const totalFiles = sections.reduce((sum, s) => sum + s.assets.length, 0);
    const lastFetchedAt = new Date().toISOString();

    // Delivery batches handling
    let deliveryBatches: BatchContext[] = [];
    let selectedBatchId: string | null = null;
    let deliveryContext: BatchContext | null = null;

    try {
      deliveryBatches = await listBatchesByProjectId(project.recordId);
    } catch (err) {
      console.warn('[review/assets] listBatchesByProjectId failed:', err instanceof Error ? err.message : err);
    }

    const defaultBatchId = await getProjectDefaultBatchId(project.recordId).catch(() => null);

    if (deliveryBatches.length > 0) {
      const batchIds = new Set(deliveryBatches.map((b) => b.batchId));
      if (batchIdParam && batchIds.has(batchIdParam)) {
        selectedBatchId = batchIdParam;
      } else if (defaultBatchId && batchIds.has(defaultBatchId)) {
        selectedBatchId = defaultBatchId;
      } else {
        const firstActive = deliveryBatches.find((b) => (b.status ?? '').toLowerCase() === 'active');
        selectedBatchId = (firstActive ?? deliveryBatches[0]).batchId;
      }
    }

    if (selectedBatchId && deliveryBatches.length > 0) {
      const selectedBatch = deliveryBatches.find((b) => b.batchId === selectedBatchId) ?? null;
      if (selectedBatch) {
        const details = await getBatchDetails(selectedBatchId);
        const detailsInBase =
          !details && process.env.PARTNER_DELIVERY_BASE_ID?.trim()
            ? await getBatchDetailsInBase(selectedBatchId, process.env.PARTNER_DELIVERY_BASE_ID.trim())
            : null;
        const d = details ?? detailsInBase;
        deliveryContext = {
          ...selectedBatch,
          partnerLastSeenAt: d?.partnerLastSeenAt ?? undefined,
          recordId: selectedBatch.batchRecordId,
          deliveryBatchId: selectedBatch.batchId,
        } as BatchContext & { recordId: string; deliveryBatchId: string };
      }
    }

    if (!deliveryContext && deliveryBatches.length === 0) {
      try {
        const ctx = await getDeliveryContextByProjectId(project.recordId);
        if (ctx) {
          selectedBatchId = ctx.deliveryBatchId;
          deliveryContext = {
            batchRecordId: ctx.recordId,
            batchId: ctx.deliveryBatchId,
            destinationFolderId: ctx.destinationFolderId,
            destinationFolderUrl: `https://drive.google.com/drive/folders/${ctx.destinationFolderId}`,
            vendorName: ctx.vendorName,
            partnerName: ctx.vendorName,
            partnerLastSeenAt: ctx.partnerLastSeenAt,
            recordId: ctx.recordId,
            deliveryBatchId: ctx.deliveryBatchId,
          } as BatchContext & { recordId: string; deliveryBatchId: string };
        }
      } catch (err) {
        console.warn('[review/assets] getDeliveryContextByProjectId failed:', err instanceof Error ? err.message : err);
      }
    }

    // Scope assets to the selected batch when we have one
    let batchFileIds: Set<string> | null = null;
    if (selectedBatchId) {
      const selectedBatchRecordId = deliveryBatches.find((b) => b.batchId === selectedBatchId)?.batchRecordId ?? null;
      try {
        batchFileIds = await getDriveFileIdsForBatch(token, selectedBatchId, selectedBatchRecordId);
      } catch (err) {
        console.warn('[review/assets] getDriveFileIdsForBatch failed:', err instanceof Error ? err.message : err);
      }
    }

    if (batchFileIds !== null) {
      for (const section of sections) {
        section.assets = section.assets.filter((a) => batchFileIds!.has(a.fileId));
        section.fileCount = section.assets.length;
      }
    }

    // No longer filter by ALLOWED_PORTAL_VARIANTS - all sections with assets are shown
    // The filtering is now done by Tactic/Variant fields in Airtable
    const portalSections = sections;

    const partnerLastSeenAt = deliveryContext?.partnerLastSeenAt ?? null;
    const allAssets = portalSections.flatMap((s) => s.assets) as ReviewAsset[];
    const approvedCount = allAssets.filter((a) => a.assetApprovedClient).length;
    const downloadedCount = allAssets.filter((a) => a.partnerDownloadedAt).length;
    const newApprovedCount = allAssets.filter((a) => {
      if (!a.assetApprovedClient || a.partnerDownloadedAt) return false;
      if (!partnerLastSeenAt) return true;
      return !!(a.approvedAt && new Date(a.approvedAt) > new Date(partnerLastSeenAt));
    }).length;
    const portalTotalFiles = portalSections.reduce((sum, s) => sum + s.fileCount, 0);

    const payload: Record<string, unknown> = {
      ok: true,
      version: 'review-assets-v2-airtable-first', // Version bump to indicate new approach
      token,
      projectId: project.recordId,
      lastFetchedAt,
      count: { sections: portalSections.length, files: portalTotalFiles },
      sections: portalSections,
      deliveryBatches,
      ...(selectedBatchId && { selectedBatchId }),
      ...(deliveryContext && { deliveryContext }),
      counts: {
        newApproved: newApprovedCount,
        approved: approvedCount,
        downloaded: downloadedCount,
      },
    };

    if (debugFlag) {
      payload.debug = {
        approach: 'airtable-first',
        totalCrasRecords: statusMap.size,
        visibleAssets: visibleCrasRecords.length,
        driveMetaFetched: driveMetaMap.size,
      };
    }

    if (totalFiles === 0) {
      const hint: Record<string, unknown> = {
        message: 'No CRAS records found for this review token. Assets are sourced from Airtable Creative Review Asset Status table.',
        checkAirtableTable: 'Creative Review Asset Status',
        checkField: 'Review Token',
        tokenPrefix: token.slice(0, 8) + '...',
      };
      payload.emptyAssetsHint = hint;
      console.warn('[review/assets] 0 files (Airtable-first)', { projectName: project.name, crasRecordsCount: statusMap.size });
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[review/assets] GET error:', message, stack);
    const isInvalidGrant = /invalid_grant/i.test(message);
    return NextResponse.json(
      {
        error: isInvalidGrant ? 'Google access expired or revoked' : 'Failed to load assets',
        detail: message,
        ...(isInvalidGrant && { code: 'GOOGLE_RECONNECT', hint: 'Reconnect Google for this company (CompanyIntegrations / Connect Google flow) to get a new refresh token.' }),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
