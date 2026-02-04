// app/api/review/assets/route.ts
// Returns asset list (sections with files) for the Client Review Portal.
// Folder map is built by traversing Drive: jobFolder → tactic → variant (new schema).
// Called by the client on page load; refresh returns fresh Drive data.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getReviewFolderMap, getReviewFolderMapFromJobFolder, getReviewFolderMapFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import { listAssetStatuses } from '@/lib/airtable/reviewAssetStatus';
import { getGroupApprovals, groupKey } from '@/lib/airtable/reviewGroupApprovals';
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

export async function GET(req: NextRequest) {
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
    ? await getReviewFolderMapFromJobFolder(drive, project.jobFolderId)
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
  for (const section of sections) {
    for (const asset of section.assets) {
      const a = asset as ReviewAsset;
      a.reviewState = toReviewState(asset.fileId);
      a.clickThroughUrl = toClickThroughUrl(asset.fileId);
      a.firstSeenByClientAt = toFirstSeenByClientAt(asset.fileId);
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

  const payload: Record<string, unknown> = {
    ok: true,
    version: 'review-assets-v1',
    token,
    projectId: project.recordId,
    lastFetchedAt,
    count: { sections: sections.length, files: totalFiles },
    sections,
  };
  if (debugFlag) {
    payload.debug = debug;
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
