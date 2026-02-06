// app/api/review/partners/mark-seen/route.ts
// POST: Record partner "Mark all as seen" — set Partner Last Seen At on the batch.
// Body: { token, deliveryBatchId? }. If deliveryBatchId omitted, resolved from project's delivery context.
// Does NOT run on page load; only when partner explicitly clicks "Mark all as seen".

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getBatchDetails, getDeliveryContextByProjectId } from '@/lib/airtable/partnerDeliveryBatches';
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
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim() || null;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  let batch = deliveryBatchId ? await getBatchDetails(deliveryBatchId) : null;
  if (!batch && !deliveryBatchId) {
    const ctx = await getDeliveryContextByProjectId(resolved.project.recordId);
    if (ctx) batch = ctx;
  }
  if (!batch) {
    return NextResponse.json(
      { ok: false, error: deliveryBatchId ? 'Batch not found' : 'No delivery context for this project' },
      { status: 404, headers: NO_STORE }
    );
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
