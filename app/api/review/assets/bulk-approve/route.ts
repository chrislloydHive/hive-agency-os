// app/api/review/assets/bulk-approve/route.ts
// POST: Set Asset Approved (Client) = true on currently displayed assets (by file IDs).
// Token-only auth. Batch updates Creative Review Asset Status in chunks of 10.
// Airtable automation is expected to set Approved At and Needs Delivery.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getRecordIdsForBulkApprove,
  batchSetAssetApprovedClient,
} from '@/lib/airtable/reviewAssetStatus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: { token?: string; fileIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  const fileIdSet = new Set(fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0));
  const uniqueFileIds = [...fileIdSet];

  const { toUpdate, alreadyApproved } = await getRecordIdsForBulkApprove(token, uniqueFileIds);

  if (toUpdate.length === 0) {
    return NextResponse.json(
      { ok: true, approved: 0, alreadyApproved },
      { headers: NO_STORE }
    );
  }

  const result = await batchSetAssetApprovedClient(toUpdate);

  if (result.failedAt !== null) {
    const payload = {
      ok: false,
      error: result.error ?? 'Airtable update failed',
      approved: result.updated,
      alreadyApproved,
      partial: result.updated > 0,
      airtableError: result.airtableError,
    };
    return NextResponse.json(payload, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, approved: result.updated, alreadyApproved },
    { headers: NO_STORE }
  );
}
