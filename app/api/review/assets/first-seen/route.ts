// app/api/review/assets/first-seen/route.ts
// POST: Set "First Seen By Client At" = now on assets that have never been seen.
// Token-only auth. Fire-and-forget from client after assets load. Batch in chunks of 10.
// Only updates records where the field is currently null (do not overwrite).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getRecordIdsForFirstSeen,
  batchSetFirstSeenByClientAt,
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

  const uniqueFileIds = [...new Set(fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const { toUpdate } = await getRecordIdsForFirstSeen(token, uniqueFileIds);

  if (toUpdate.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 }, { headers: NO_STORE });
  }

  const result = await batchSetFirstSeenByClientAt(toUpdate);
  if (result.failedAt !== null) {
    return NextResponse.json(
      { ok: false, error: result.error, updated: result.updated },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true, updated: result.updated }, { headers: NO_STORE });
}
