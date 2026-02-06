// app/api/review/assets/seen/route.ts
// POST: Mark asset as seen (open lightbox). Upserts Creative Review Asset Status.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { detectVariantFromPath } from '@/lib/review/reviewVariantDetection';
import { upsertSeen } from '@/lib/airtable/reviewAssetStatus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const VALID_TACTICS = new Set([
  'Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search',
]);

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    driveFileId?: string;
    fileId?: string;
    filename?: string;
    tactic?: string;
    variant?: string;
    authorName?: string;
    authorEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? body.fileId ?? '').toString().trim();
  const filename = (body.filename ?? '').toString().trim();
  const tactic = (body.tactic ?? '').toString().trim();
  const variantInput = (body.variant ?? '').toString().trim();
  const authorName = (body.authorName ?? '').toString().trim() || undefined;
  const authorEmail = (body.authorEmail ?? '').toString().trim() || undefined;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing driveFileId or fileId' }, { status: 400 });
  }
  if (!tactic || !VALID_TACTICS.has(tactic)) {
    return NextResponse.json({ error: 'Invalid tactic' }, { status: 400 });
  }
  const variant = variantInput ? detectVariantFromPath(variantInput) : null;
  if (!variant) {
    return NextResponse.json({ error: 'Invalid variant (expected Prospecting or Retargeting/Remarketing/RTG)' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  try {
    await upsertSeen({
      token,
      projectId: resolved.project.recordId,
      driveFileId,
      filename,
      tactic,
      variant, // canonical "Prospecting" | "Retargeting"
      authorName,
      authorEmail,
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/seen] Error:', message);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500, headers: NO_STORE });
  }
}
