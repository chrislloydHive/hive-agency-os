// app/api/review/assets/mark-downloaded/route.ts
// POST: Record per-asset downloaded for the partner (Partner Downloaded At).
// Body: { token, fileIds, deliveryBatchId? }.
// Updates CRAS records and batch Partner Activity (Downloaded Count).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { listAssetStatuses, setPartnerDownloadedAt, getDownloadedCountForBatch } from '@/lib/airtable/reviewAssetStatus';
import { getBatchDetails } from '@/lib/airtable/partnerDeliveryBatches';
import { writePartnerActivityToRecord, PARTNER_DELIVERY_BATCHES_TABLE } from '@/lib/airtable/deliveryWriteBack';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function keyFrom(token: string, fileId: string): string {
  return `${token}::${fileId}`;
}

export async function POST(req: NextRequest) {
  let body: { token?: string; fileIds?: string[]; deliveryBatchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map((id) => String(id).trim()).filter(Boolean) : [];
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim() || undefined;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }
  if (fileIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'Missing or empty fileIds' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  const statusMap = await listAssetStatuses(token);
  const updated: string[] = [];
  for (const fileId of fileIds) {
    const key = keyFrom(token, fileId);
    const rec = statusMap.get(key);
    if (rec?.recordId) {
      try {
        await setPartnerDownloadedAt(rec.recordId);
        updated.push(fileId);
      } catch (e) {
        console.warn('[review/assets/mark-downloaded] Failed for', fileId, e);
      }
    }
  }

  if (deliveryBatchId && updated.length > 0) {
    const batch = await getBatchDetails(deliveryBatchId);
    if (batch) {
      const downloadedCount = await getDownloadedCountForBatch(deliveryBatchId);
      await writePartnerActivityToRecord(PARTNER_DELIVERY_BATCHES_TABLE, batch.recordId, {
        downloadedCount,
      });
    }
  }

  return NextResponse.json(
    { ok: true, marked: updated.length, fileIds: updated },
    { headers: NO_STORE }
  );
}
