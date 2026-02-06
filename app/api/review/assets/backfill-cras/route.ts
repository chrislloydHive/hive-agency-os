// app/api/review/assets/backfill-cras/route.ts
// POST: Backfill CRAS records for all files in the review folder map (Prospecting + Retargeting).
// Body: { token, dryRun?: boolean }. Uses same folder resolution as GET /api/review/assets.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getReviewFolderMapFromJobFolderPartial,
  getReviewFolderMapFromClientProjectsFolder,
} from '@/lib/review/reviewFolders';
import { backfillCras } from '@/lib/review/backfillCras';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed', hint: 'Use POST with body { "token": "<review-portal-token>", "dryRun": false }' },
    { status: 405, headers: { Allow: 'POST', ...NO_STORE } }
  );
}

export async function POST(req: NextRequest) {
  let body: { token?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const dryRun = body.dryRun === true;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const folderResult = project.jobFolderId
    ? await getReviewFolderMapFromJobFolderPartial(drive, project.jobFolderId)
    : await (async () => {
        const clientProjectsFolderId =
          process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
        if (clientProjectsFolderId) {
          const fromClient = await getReviewFolderMapFromClientProjectsFolder(
            drive,
            project.name,
            clientProjectsFolderId
          );
          if (fromClient) return fromClient;
        }
        return null;
      })();

  if (!folderResult) {
    return NextResponse.json(
      { ok: false, error: 'Review folders not found. Run scaffold or set job folder.' },
      { status: 404, headers: NO_STORE }
    );
  }

  const result = await backfillCras({
    drive,
    folderMap: folderResult.map,
    token,
    projectId: project.recordId,
    dryRun,
  });

  return NextResponse.json(
    {
      ok: true,
      dryRun,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
    },
    { headers: NO_STORE }
  );
}
