// app/api/review/partners/mark-seen/route.ts
// POST: Record partner "Mark all as seen" — set Partner Last Seen At on the batch.
// Body: { token, deliveryBatchId }.
// Does NOT run on page load; only when partner explicitly clicks "Mark all as seen".

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getBatchDetails } from '@/lib/airtable/partnerDeliveryBatches';
import { writePartnerActivityToRecord, PARTNER_DELIVERY_BATCHES_TABLE } from '@/lib/airtable/deliveryWriteBack';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: { token?: string; deliveryBatchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }
  if (!deliveryBatchId) {
    return NextResponse.json({ ok: false, error: 'Missing deliveryBatchId' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  const batch = await getBatchDetails(deliveryBatchId);
  if (!batch) {
    return NextResponse.json({ ok: false, error: 'Batch not found' }, { status: 404, headers: NO_STORE });
  }

  const now = new Date().toISOString();
  const result = await writePartnerActivityToRecord(PARTNER_DELIVERY_BATCHES_TABLE, batch.recordId, {
    partnerLastSeenAt: now,
    newApprovedCount: 0,
  });

  if (!result.ok && result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, partnerLastSeenAt: now },
    { headers: NO_STORE }
  );
}
