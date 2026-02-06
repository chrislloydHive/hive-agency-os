// app/api/review/assets/mark-seen/route.ts
// POST: Batch-level "Mark all as seen". Body: { token, batchId }.
// Resolves project via token, selected batch by batchId, writes Partner Last Seen At = now on the batch record.
// Scoped to the selected batch (Option B). Use this from the portal when a batch is selected.

import { NextRequest, NextResponse } from 'next/server';
import { markBatchSeen } from '@/lib/review/markBatchSeen';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: { token?: string; batchId?: string; deliveryBatchId?: string; selectedBatchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const result = await markBatchSeen(body);
  return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
}
