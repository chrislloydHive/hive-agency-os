// app/api/review/assets/route.ts
// Returns asset list (sections with files) for the Client Review Portal.
// Folder map is built by traversing Drive: jobFolder → tactic → variant (new schema).
// Called by the client on page load; refresh returns fresh Drive data.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import type { drive_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

const VARIANTS = ['Prospecting', 'Retargeting'] as const;
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video'] as const;

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface TacticSectionData {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
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

/** Get child folder id by exact name. Shared Drive safe. Throws if missing when required. */
async function getChildFolderId(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files.length > 0 ? files[0].id! : null;
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

  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID;
  if (!rootFolderId) {
    return NextResponse.json(
      { error: 'Server misconfigured: CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID not set' },
      { status: 500 },
    );
  }

  // Resolve job folder: root → Client Review → <hubName>
  const clientReviewFolderId = await getChildFolderId(drive, rootFolderId, 'Client Review');
  if (!clientReviewFolderId) {
    return NextResponse.json(
      { error: 'Client Review folder not found under production assets root' },
      { status: 404 },
    );
  }

  const jobFolderId = await getChildFolderId(drive, clientReviewFolderId, project.hubName);
  if (!jobFolderId) {
    return NextResponse.json(
      {
        error: `Job folder not found: "${project.hubName}" under Client Review. Run scaffold first.`,
      },
      { status: 404 },
    );
  }

  // Build folderMap: jobFolderId → tactic → variant (new schema). Each folderId is the leaf variant folder.
  const folderMap = new Map<string, string>();
  for (const tactic of TACTICS) {
    const tacticFolderId = await getChildFolderId(drive, jobFolderId, tactic);
    if (!tacticFolderId) {
      return NextResponse.json(
        { error: `Tactic folder not found: "${tactic}" under job folder "${project.hubName}"` },
        { status: 404 },
      );
    }
    for (const variant of VARIANTS) {
      const variantFolderId = await getChildFolderId(drive, tacticFolderId, variant);
      if (!variantFolderId) {
        return NextResponse.json(
          { error: `Variant folder not found: "${variant}" under tactic "${tactic}"` },
          { status: 404 },
        );
      }
      folderMap.set(`${variant}:${tactic}`, variantFolderId);
    }
  }

  // List files from each variant folder (leaf folders only)
  const sections: TacticSectionData[] = [];
  const debug: { jobFolderId: string; tactic: string; variant: string; folderId: string; fileCount: number }[] = [];

  for (const variant of VARIANTS) {
    for (const tactic of TACTICS) {
      const folderId = folderMap.get(`${variant}:${tactic}`)!;
      const assets = await listAllFiles(drive, folderId);
      sections.push({ variant, tactic, assets, fileCount: assets.length });
      if (debugFlag) {
        debug.push({ jobFolderId, tactic, variant, folderId, fileCount: assets.length });
      }
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
