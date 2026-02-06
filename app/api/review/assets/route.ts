// app/api/review/assets/route.ts
// Returns asset list (sections with files) for the Client Review Portal.
// Folder map is built by traversing Drive: jobFolder → tactic → variant (new schema).
// Called by the client on page load; refresh returns fresh Drive data.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getReviewFolderMap, getReviewFolderMapFromJobFolderPartial, getReviewFolderMapFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import { listAssetStatuses } from '@/lib/airtable/reviewAssetStatus';
import { getGroupApprovals, groupKey } from '@/lib/airtable/reviewGroupApprovals';
import { getDeliveryContextByProjectId } from '@/lib/airtable/partnerDeliveryBatches';
import type { drive_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

const VARIANTS = ['Prospecting', 'Retargeting'] as const;
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search'] as const;

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
  /** CRAS record id for delivery updates. */
  airtableRecordId?: string;
  /** When asset was approved (for "Newly Approved" tab: approvedAt > partnerLastSeenAt). */
  approvedAt?: string | null;
  /** When partner downloaded this asset in the portal; null = not downloaded. */
  partnerDownloadedAt?: string | null;
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

/** List non-folder files in a Drive folder. Shared Drive safe. */
async function listAllFiles(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<ReviewAsset[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    fileId: f.id!,
    name: f.name!,
    mimeType: f.mimeType || 'application/octet-stream',
    modifiedTime: f.modifiedTime || '',
  }));
}

/** List direct children (files + folders) for diagnostics when 0 assets. */
async function listDirectChildren(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<{ fileCount: number; folderCount: number; fileNames: string[]; folderNames: string[] }> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(name, mimeType)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  const fileNames: string[] = [];
  const folderNames: string[] = [];
  for (const f of files) {
    const name = f.name ?? '(no name)';
    if (f.mimeType === 'application/vnd.google-apps.folder') folderNames.push(name);
    else fileNames.push(name);
  }
  return { fileCount: fileNames.length, folderCount: folderNames.length, fileNames, folderNames };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const debugFlag = req.nextUrl.searchParams.get('debug') === '1';

    const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const folderResult = project.jobFolderId
    ? await getReviewFolderMapFromJobFolderPartial(drive, project.jobFolderId)
    : await (async () => {
        const clientProjectsFolderId = process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
        if (clientProjectsFolderId) {
          const fromClient = await getReviewFolderMapFromClientProjectsFolder(drive, project.name, clientProjectsFolderId);
          if (fromClient) return fromClient;
        }
        const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID;
        if (!rootFolderId) return null;
        return getReviewFolderMap(drive, project.hubName, rootFolderId);
      })();

  if (!folderResult) {
    return NextResponse.json(
      project.jobFolderId
        ? { error: 'Review folders not found under job folder. Run scaffold first.' }
        : { error: 'Server misconfigured or review folders not found. Run scaffold first.' },
      { status: 404 },
    );
  }
  const { map: folderMap, jobFolderId } = folderResult;

  // List files from each variant folder (leaf folders only). Key must be variant:tactic to match folder map.
  const sections: TacticSectionData[] = [];
  const debug: { jobFolderId: string; tactic: string; variant: string; folderId: string; fileCount: number }[] = [];

  for (const variant of VARIANTS) {
    for (const tactic of TACTICS) {
      const mapKey = `${variant}:${tactic}`;
      const folderId = folderMap.get(mapKey);
      if (!folderId) {
        console.warn(`[review/assets] Missing folder for ${mapKey}, skipping section`);
        sections.push({ variant, tactic, assets: [], fileCount: 0 });
        if (debugFlag) debug.push({ jobFolderId, tactic, variant, folderId: '', fileCount: 0 });
        continue;
      }
      const assets = await listAllFiles(drive, folderId);
      sections.push({ variant, tactic, assets, fileCount: assets.length });
      if (debugFlag) {
        debug.push({ jobFolderId, tactic, variant, folderId, fileCount: assets.length });
      }
    }
  }

  // Attach review state and click-through URL from Creative Review Asset Status + project primary (non-fatal if table missing)
  let statusMap: Awaited<ReturnType<typeof listAssetStatuses>>;
  try {
    statusMap = await listAssetStatuses(token);
  } catch (err) {
    console.warn('[review/assets] listAssetStatuses failed (table may be missing):', err instanceof Error ? err.message : err);
    statusMap = new Map();
  }
  const primaryLandingPageUrl = project.primaryLandingPageUrl ?? null;
  const toReviewState = (fileId: string): ReviewState => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    if (!rec) return 'new';
    if (rec.assetApprovedClient) return 'approved';
    const s = rec.status.toLowerCase();
    if (s === 'needs changes') return 'needs_changes';
    return s as ReviewState;
  };
  const toClickThroughUrl = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    const override = rec?.landingPageOverrideUrl ?? rec?.effectiveLandingPageUrl ?? null;
    return override || primaryLandingPageUrl || null;
  };
  const toFirstSeenByClientAt = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.firstSeenByClientAt ?? null;
  };
  const toAssetApprovedClient = (fileId: string): boolean => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.assetApprovedClient ?? false;
  };
  const toDeliveredAt = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.deliveredAt ?? null;
  };
  const toDelivered = (fileId: string): boolean => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.delivered ?? false;
  };
  const toDeliveredFolderId = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.deliveredFolderId ?? null;
  };
  const toAirtableRecordId = (fileId: string): string | undefined => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.recordId;
  };
  const toApprovedAt = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.approvedAt ?? null;
  };
  const toPartnerDownloadedAt = (fileId: string): string | null => {
    const key = `${token}::${fileId}`;
    const rec = statusMap.get(key);
    return rec?.partnerDownloadedAt ?? null;
  };
  for (const section of sections) {
    for (const asset of section.assets) {
      const a = asset as ReviewAsset;
      a.reviewState = toReviewState(asset.fileId);
      a.clickThroughUrl = toClickThroughUrl(asset.fileId);
      a.firstSeenByClientAt = toFirstSeenByClientAt(asset.fileId);
      a.assetApprovedClient = toAssetApprovedClient(asset.fileId);
      a.deliveredAt = toDeliveredAt(asset.fileId);
      a.delivered = toDelivered(asset.fileId);
      a.deliveredFolderId = toDeliveredFolderId(asset.fileId);
      a.airtableRecordId = toAirtableRecordId(asset.fileId);
      a.approvedAt = toApprovedAt(asset.fileId);
      a.partnerDownloadedAt = toPartnerDownloadedAt(asset.fileId);
    }
  }

  // Attach group approval (as-of) and newSinceApprovalCount per section (non-fatal if table missing)
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

  let deliveryContext: Awaited<ReturnType<typeof getDeliveryContextByProjectId>> = null;
  try {
    deliveryContext = await getDeliveryContextByProjectId(project.recordId);
  } catch (err) {
    console.warn('[review/assets] getDeliveryContextByProjectId failed:', err instanceof Error ? err.message : err);
  }

  const partnerLastSeenAt = deliveryContext?.partnerLastSeenAt ?? null;
  const allAssets = sections.flatMap((s) => s.assets) as ReviewAsset[];
  const approvedCount = allAssets.filter((a) => a.assetApprovedClient).length;
  const downloadedCount = allAssets.filter((a) => a.partnerDownloadedAt).length;
  const newApprovedCount = allAssets.filter((a) => {
    if (!a.assetApprovedClient || a.partnerDownloadedAt) return false;
    if (!partnerLastSeenAt) return true;
    return !!(a.approvedAt && new Date(a.approvedAt) > new Date(partnerLastSeenAt));
  }).length;

  const payload: Record<string, unknown> = {
    ok: true,
    version: 'review-assets-v1',
    token,
    projectId: project.recordId,
    lastFetchedAt,
    count: { sections: sections.length, files: totalFiles },
    sections,
    ...(deliveryContext && { deliveryContext }),
    counts: {
      newApproved: newApprovedCount,
      approved: approvedCount,
      downloaded: downloadedCount,
    },
  };
  if (debugFlag) {
    payload.debug = debug;
    payload.folderResolution = {
      jobFolderId,
      projectName: project.name,
      hubName: project.hubName,
      usedJobFolderFromProject: !!project.jobFolderId,
    };
  }
  if (totalFiles === 0) {
    const firstVariantFolderId = folderMap.size > 0 ? (folderMap.values().next().value as string) : undefined;
    const hint: Record<string, unknown> = {
      message: 'No files found in variant folders. Expected: job folder → tactic (Audio, Display, …) → Prospecting/Retargeting; files must be direct children of those variant folders.',
      jobFolderId,
      jobFolderUrl: `https://drive.google.com/drive/folders/${jobFolderId}`,
      variantFoldersFound: folderMap.size,
      checkAirtableField: 'Creative Review Hub Folder ID (on Project)',
    };
    if (firstVariantFolderId) {
      hint.sampleVariantFolderUrl = `https://drive.google.com/drive/folders/${firstVariantFolderId}`;
      try {
        const children = await listDirectChildren(drive, firstVariantFolderId);
        hint.sampleFolderInspect = {
          directFileCount: children.fileCount,
          directFolderCount: children.folderCount,
          sampleFileNames: children.fileNames.slice(0, 10),
          sampleFolderNames: children.folderNames.slice(0, 10),
          hint: children.folderCount > 0 && children.fileCount === 0
            ? 'Files may be inside subfolders; move them to be direct children of the variant folder.'
            : undefined,
        };
      } catch (inspectErr) {
        hint.sampleFolderInspect = { error: inspectErr instanceof Error ? inspectErr.message : String(inspectErr) };
      }
    }
    payload.emptyAssetsHint = hint;
    console.warn('[review/assets] 0 files', { projectName: project.name, jobFolderId, variantFoldersFound: folderMap.size });
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
