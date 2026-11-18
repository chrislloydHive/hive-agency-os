// Serves one size from a Foldwrap HTML5 delivery zip that lives in a review folder.
// Preview: .../{entry}/index.html and the images it references.
// Download: .../{entry}?dl=1 returns that size's zip, intact.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

import { getCrasRecordIdByTokenAndFileId } from '@/lib/airtable/reviewAssetStatus';
import {
  contentTypeForHtml5Path,
  injectHtmlBase,
  loadHtml5PackageBuffer,
  readHtml5CreativeFile,
  readHtml5InnerZip,
} from '@/lib/review/html5DeliveryPackage';
import { html5PortalFileId, isSafeZipEntry } from '@/lib/review/html5PortalIds';
import { isDriveFileDirectChildOfAllowedReviewFolders } from '@/lib/review/reviewFolders';
import { resolveReviewProject } from '@/lib/review/resolveProject';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

async function authorized(
  token: string,
  driveFileId: string,
  entry: string,
  project: { recordId: string; jobFolderId?: string; name: string; hubName: string },
  drive: ReturnType<typeof google.drive>,
): Promise<boolean> {
  const composite = html5PortalFileId(driveFileId, entry);
  const child = await getCrasRecordIdByTokenAndFileId(token, composite);
  if (child) return true;
  const parent = await getCrasRecordIdByTokenAndFileId(token, driveFileId);
  if (parent) return true;
  return isDriveFileDirectChildOfAllowedReviewFolders(drive, {
    jobFolderId: project.jobFolderId,
    name: project.name,
    hubName: project.hubName,
  }, driveFileId);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; fileId: string; entry: string; path?: string[] }> },
) {
  const params = await ctx.params;
  const token = decodeURIComponent(params.token ?? '').trim();
  const driveFileId = decodeURIComponent(params.fileId ?? '').trim();
  let entry = params.entry ?? '';
  try {
    entry = decodeURIComponent(entry);
  } catch {
    return jsonError(400, 'Bad entry');
  }
  if (!token || !driveFileId || !isSafeZipEntry(entry)) {
    return jsonError(400, 'Missing review file');
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) return jsonError(401, 'Invalid token');
  const drive = google.drive({ version: 'v3', auth: resolved.auth });
  const allowed = await authorized(token, driveFileId, entry, resolved.project, drive);
  if (!allowed) return jsonError(403, 'File not found for this review');

  let packageBuf: Buffer;
  try {
    packageBuf = await loadHtml5PackageBuffer(drive, driveFileId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/html5] package read failed:', msg);
    return jsonError(502, 'Package not available');
  }

  const download = req.nextUrl.searchParams.get('dl') === '1';
  if (download || !params.path?.length) {
    const zip = readHtml5InnerZip(packageBuf, entry);
    if (!zip) return jsonError(404, 'Size not in package');
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        ...NO_STORE,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${entry.replace(/[^\x20-\x7E]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const innerPath = params.path.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join('/');
  const file = readHtml5CreativeFile(packageBuf, entry, innerPath);
  if (!file) return jsonError(404, 'File not in creative');

  const contentType = contentTypeForHtml5Path(innerPath);
  let body: Buffer = file;
  if (contentType.startsWith('text/html')) {
    const base = `/api/review/html5/${encodeURIComponent(token)}/${encodeURIComponent(driveFileId)}/${encodeURIComponent(entry)}/`;
    body = Buffer.from(injectHtmlBase(file.toString('utf8'), base), 'utf8');
  }

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
