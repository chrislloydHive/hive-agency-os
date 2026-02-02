// app/api/review/assets/status/route.ts
// POST: Set asset status (Approved / Needs Changes). Upserts Creative Review Asset Status.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { upsertStatus, type AssetStatusValue } from '@/lib/airtable/reviewAssetStatus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const VALID_STATUSES: AssetStatusValue[] = ['Approved', 'Needs Changes'];

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    driveFileId?: string;
    fileId?: string;
    status?: string;
    approvedByName?: string;
    approvedByEmail?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? body.fileId ?? '').toString().trim();
  const statusRaw = (body.status ?? '').toString().trim();
  const approvedByName = (body.approvedByName ?? '').toString().trim() || undefined;
  const approvedByEmail = (body.approvedByEmail ?? '').toString().trim() || undefined;
  const notes = body.notes != null ? String(body.notes).trim() : undefined;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing driveFileId or fileId' }, { status: 400 });
  }
  const status = VALID_STATUSES.includes(statusRaw as AssetStatusValue)
    ? (statusRaw as AssetStatusValue)
    : null;
  if (!status) {
    return NextResponse.json({ error: 'Invalid status; use Approved or Needs Changes' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  try {
    await upsertStatus({
      token,
      projectId: resolved.project.recordId,
      driveFileId,
      status,
      approvedByName,
      approvedByEmail,
      notes,
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/status] Error:', message);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500, headers: NO_STORE });
  }
}
