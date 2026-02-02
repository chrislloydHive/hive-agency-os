// app/api/review/assets/route.ts
// Returns asset list (sections with files) for the Client Review Portal.
// Called by the client on page load so the asset-list request is visible in Network
// and refresh returns fresh Drive data.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

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

async function listAllFiles(
  drive: ReturnType<typeof google.drive>,
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

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const osBase = getBase();
  const reviewSets = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS)
    .select({
      filterByFormula: `FIND("${project.recordId}", ARRAYJOIN({Project})) > 0`,
    })
    .all();

  const folderMap = new Map<string, string>();
  const folderIds: Record<string, string> = {};
  for (const set of reviewSets) {
    const fields = set.fields as Record<string, unknown>;
    const variant = fields['Variant'] as string;
    const tactic = fields['Tactic'] as string;
    const folderId = fields['Folder ID'] as string;
    if (variant && tactic && folderId) {
      const key = `${variant}:${tactic}`;
      folderMap.set(key, folderId);
      folderIds[key] = folderId;
    }
  }

  // folderMap keys: variant:tactic (e.g. Prospecting:Audio, Retargeting:Display)
  if (process.env.NODE_ENV === 'development' && folderMap.size > 0) {
    const keys = [...folderMap.keys()].sort().map((k) => k.replace(':', '.'));
    console.log('[review/assets] folderMap keys:', keys.join(', '));
  }

  const sections: TacticSectionData[] = [];
  for (const variant of VARIANTS) {
    for (const tactic of TACTICS) {
      const folderId = folderMap.get(`${variant}:${tactic}`);
      if (!folderId) {
        sections.push({ variant, tactic, assets: [], fileCount: 0 });
        continue;
      }
      const assets = await listAllFiles(drive, folderId);
      sections.push({ variant, tactic, assets, fileCount: assets.length });
    }
  }

  const totalFiles = sections.reduce((sum, s) => sum + s.assets.length, 0);
  const lastFetchedAt = new Date().toISOString();

  return NextResponse.json(
    {
      ok: true,
      version: 'review-assets-v1',
      token,
      projectId: project.recordId,
      folderIds: Object.keys(folderIds).length > 0 ? folderIds : undefined,
      lastFetchedAt,
      count: { sections: sections.length, files: totalFiles },
      sections,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
