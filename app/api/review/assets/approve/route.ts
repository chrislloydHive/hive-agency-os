// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient, ensureCrasRecord, DELIVERY_BATCH_ID_FIELD } from '@/lib/airtable/reviewAssetStatus';
import { getBase } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    driveFileId?: string;
    fileId?: string;
    approvedAt?: string;
    approvedByName?: string;
    approvedByEmail?: string;
    deliveryBatchId?: string | null;
    tactic?: string;
    variant?: string;
    filename?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? body.fileId ?? '').toString().trim();
  const approvedAt = resolveApprovedAt(body.approvedAt);
  const approvedByName = (body.approvedByName ?? '').toString().trim() || undefined;
  const approvedByEmail = (body.approvedByEmail ?? '').toString().trim() || undefined;
  
  // Debug: Log raw deliveryBatchId from body
  console.log(`[approve] Raw body.deliveryBatchId:`, body.deliveryBatchId, `type:`, typeof body.deliveryBatchId);
  const deliveryBatchId = body.deliveryBatchId != null ? String(body.deliveryBatchId).trim() || undefined : undefined;
  console.log(`[approve] Parsed deliveryBatchId:`, deliveryBatchId);
  
  const tactic = (body.tactic ?? '').toString().trim() || undefined;
  const variant = (body.variant ?? '').toString().trim() || undefined;
  const filename = (body.filename ?? '').toString().trim() || undefined;

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

  if (tactic && variant) {
    await ensureCrasRecord({
      token,
      projectId: resolved.project.recordId,
      driveFileId,
      filename,
      tactic,
      variant,
    });
  }

  const result = await setSingleAssetApprovedClient({
    token,
    driveFileId,
    approvedAt,
    approvedByName,
    approvedByEmail,
    deliveryBatchId: deliveryBatchId ?? undefined,
  });

  if ('error' in result) {
    const status = result.error === 'Record not found' ? 404 : 500;
    const payload: { error: string; airtableError?: unknown } = { error: result.error };
    if (result.airtableError !== undefined) payload.airtableError = result.airtableError;
    return NextResponse.json(payload, { status, headers: NO_STORE });
  }

  // Resolve deliveryBatchId: use provided value, or fetch from CRAS record if missing
  let finalDeliveryBatchId = deliveryBatchId;
  if (!finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] deliveryBatchId not in request, fetching from CRAS record ${result.recordId}`);
    try {
      const base = getBase();
      const record = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(result.recordId);
      console.log(`[approve] Fetched CRAS record, checking field "${DELIVERY_BATCH_ID_FIELD}"`);
      const batchRaw = record.fields[DELIVERY_BATCH_ID_FIELD];
      console.log(`[approve] Raw batch field value:`, batchRaw, `type:`, typeof batchRaw, `isArray:`, Array.isArray(batchRaw));
      
      if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
        finalDeliveryBatchId = (batchRaw[0] as string).trim();
        console.log(`[approve] Extracted deliveryBatchId from array: ${finalDeliveryBatchId}`);
      } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
        finalDeliveryBatchId = (batchRaw as string).trim();
        console.log(`[approve] Extracted deliveryBatchId from string: ${finalDeliveryBatchId}`);
      } else {
        console.log(`[approve] deliveryBatchId field is empty or invalid:`, batchRaw);
      }
      
      if (finalDeliveryBatchId) {
        console.log(`[approve] ✅ Successfully fetched deliveryBatchId from record: ${finalDeliveryBatchId}`);
      } else {
        console.log(`[approve] ⚠️ deliveryBatchId field exists but is empty/null in CRAS record ${result.recordId}`);
      }
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(`[approve] ❌ Failed to fetch deliveryBatchId from record ${result.recordId}:`, errMsg);
      if (fetchErr instanceof Error && fetchErr.stack) {
        console.error(`[approve] Error stack:`, fetchErr.stack);
      }
    }
  }

  if ('alreadyApproved' in result) {
    // Still trigger delivery if batchId is set (idempotency will handle duplicates)
    if (finalDeliveryBatchId && 'recordId' in result) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        fetch(`${baseUrl}/api/delivery/partner/approved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crasRecordId: result.recordId,
            batchId: finalDeliveryBatchId,
          }),
        }).catch((err) => {
          console.error('[approve] Failed to trigger delivery (already approved):', err);
        });
      } catch (err) {
        console.error('[approve] Error triggering delivery (already approved):', err);
      }
    }
    return NextResponse.json(
      { ok: true, alreadyApproved: true },
      { headers: NO_STORE }
    );
  }

  // Trigger delivery via event-driven endpoint (if deliveryBatchId is set)
  if (finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] Triggering delivery: crasRecordId=${result.recordId}, batchId=${finalDeliveryBatchId}`);
    try {
      // Fire-and-forget: call delivery endpoint asynchronously
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const deliveryUrl = `${baseUrl}/api/delivery/partner/approved`;
      console.log(`[approve] Calling delivery endpoint: ${deliveryUrl}`);
      fetch(deliveryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crasRecordId: result.recordId,
          batchId: finalDeliveryBatchId,
        }),
      })
        .then(async (res) => {
          const text = await res.text();
          if (res.ok) {
            console.log(`[approve] Delivery triggered successfully: ${text}`);
          } else {
            console.error(`[approve] Delivery endpoint returned ${res.status}: ${text}`);
          }
        })
        .catch((err) => {
          console.error('[approve] Failed to trigger delivery:', err);
        });
    } catch (err) {
      // Non-blocking: log error but don't fail the approval
      console.error('[approve] Error triggering delivery:', err);
    }
  } else {
    if (!finalDeliveryBatchId) {
      console.log(`[approve] No deliveryBatchId available (not in request and not in record), skipping delivery trigger`);
    }
    if (!('recordId' in result)) {
      console.log(`[approve] No recordId in result, skipping delivery trigger`);
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
