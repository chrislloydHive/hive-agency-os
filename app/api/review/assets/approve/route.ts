// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Canonical approval only;
// does not write Status. Airtable automation sets Needs Delivery and timestamps.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { setSingleAssetApprovedClient } from '@/lib/airtable/reviewAssetStatus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: { token?: string; driveFileId?: string; fileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? body.fileId ?? '').toString().trim();

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing driveFileId or fileId' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const result = await setSingleAssetApprovedClient(token, driveFileId);

  if ('error' in result) {
    const status = result.error === 'Record not found' ? 404 : 500;
    const payload: { error: string; airtableError?: unknown } = { error: result.error };
    if (result.airtableError !== undefined) payload.airtableError = result.airtableError;
    return NextResponse.json(payload, { status, headers: NO_STORE });
  }

  if ('alreadyApproved' in result) {
    return NextResponse.json(
      { ok: true, alreadyApproved: true },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
