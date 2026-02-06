// app/api/review/partners/mark-seen/route.ts
// POST: Record partner "Mark all as seen" — set Partner Last Seen At on the Partner Delivery Batch record (per batch).
// Body: { token, batchId? }. batchId (or deliveryBatchId / selectedBatchId) identifies the batch; if omitted, inferred from project default.
// Does NOT run on page load; only when partner explicitly clicks "Mark all as seen".

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getBatchDetails,
  getBatchDetailsInBase,
  getDeliveryContextByProjectId,
  getProjectDefaultBatchId,
} from '@/lib/airtable/partnerDeliveryBatches';
import { writePartnerActivityToRecord, PARTNER_DELIVERY_BATCHES_TABLE } from '@/lib/airtable/deliveryWriteBack';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: { token?: string; batchId?: string; deliveryBatchId?: string; selectedBatchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const batchIdParam =
    (body.batchId ?? body.deliveryBatchId ?? body.selectedBatchId ?? '').toString().trim() || null;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  let batchId = batchIdParam;
  if (!batchId) {
    const defaultId = await getProjectDefaultBatchId(resolved.project.recordId).catch(() => null);
    if (defaultId) batchId = defaultId;
    else {
      const ctx = await getDeliveryContextByProjectId(resolved.project.recordId);
      if (ctx) batchId = ctx.deliveryBatchId;
    }
  }

  let batch = batchId ? await getBatchDetails(batchId) : null;
  if (!batch && batchId && process.env.PARTNER_DELIVERY_BASE_ID?.trim()) {
    batch = await getBatchDetailsInBase(batchId, process.env.PARTNER_DELIVERY_BASE_ID.trim());
  }
  if (!batch && !batchId) {
    const ctx = await getDeliveryContextByProjectId(resolved.project.recordId);
    if (ctx) batch = ctx;
  }
  if (!batch) {
    return NextResponse.json(
      { ok: false, error: batchId ? 'Batch not found' : 'No delivery batch for this project' },
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
