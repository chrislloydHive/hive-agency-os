// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient, ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';
import { resolveDeliveryBatchFromCras } from '@/lib/review/resolveDeliveryBatch';

// Field name for Source Folder ID (matches reviewAssetStatus.ts)
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/**
 * Get the application origin URL deterministically.
 * Tries request headers first, then env vars, then fallback.
 */
function getAppOrigin(req?: Request | NextRequest): string {
  if (req) {
    // Try x-forwarded-proto + x-forwarded-host (Vercel/proxy headers)
    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('x-forwarded-host');
    if (proto && host) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
    
    // Try origin header
    const origin = req.headers.get('origin');
    if (origin) {
      return origin.replace(/\/$/, '');
    }
  }
  
  // Try APP_ORIGIN env var
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN.replace(/\/$/, '');
  }
  
  // Fallback to production domain
  return 'https://hiveagencyos.com';
}

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

  // Use deliveryBatchId from request if provided
  let finalDeliveryBatchId = deliveryBatchId;
  let selectedBatchRecordId: string | undefined = undefined;
  if (finalDeliveryBatchId) {
    console.log(`[approve] Using deliveryBatchId from request: ${finalDeliveryBatchId}`);
  }

  // Log Airtable fields being written (before approval)
  const approvalFields: Record<string, unknown> = {
    'Asset Approved (Client)': true,
    'Status': 'Approved',
    'Approved At': approvedAt || new Date().toISOString(),
  };
  if (approvedByName !== undefined) approvalFields['Approved By Name'] = String(approvedByName).slice(0, 100);
  if (approvedByEmail !== undefined) approvalFields['Approved By Email'] = String(approvedByEmail).slice(0, 200);
  if (finalDeliveryBatchId != null && String(finalDeliveryBatchId).trim()) {
    const bid = String(finalDeliveryBatchId).trim();
    approvalFields['Delivery Batch ID'] = bid.startsWith('rec') ? [bid] : bid;
    approvalFields['Ready to Deliver (Webhook)'] = true;
  }
  console.log(`[approve] Writing Airtable fields:`, {
    fieldKeys: Object.keys(approvalFields),
    fields: approvalFields,
  });

  const result = await setSingleAssetApprovedClient({
    token,
    driveFileId,
    approvedAt,
    approvedByName,
    approvedByEmail,
    deliveryBatchId: finalDeliveryBatchId ?? undefined,
  });

  if ('error' in result) {
    const status = result.error === 'Record not found' ? 404 : 500;
    const payload: { error: string; airtableError?: unknown } = { error: result.error };
    if (result.airtableError !== undefined) payload.airtableError = result.airtableError;
    return NextResponse.json(payload, { status, headers: NO_STORE });
  }

  // Resolve deliveryBatchId from CRAS Project link → Partner Delivery Batches query (if not provided)
  if (!finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] deliveryBatchId not in request, resolving from CRAS Project link`);
    const resolved = await resolveDeliveryBatchFromCras(result.recordId);
    if (resolved) {
      finalDeliveryBatchId = resolved.deliveryBatchId;
      selectedBatchRecordId = resolved.batchRecordId;
    }
  }
  
  console.log(`[approve] Final deliveryBatchId after approval: ${finalDeliveryBatchId || 'undefined'}`);

  // Generate requestId for correlation tracing
  let requestId: string | undefined = undefined;
  if ('recordId' in result) {
    requestId = `approved-${result.recordId}-${Date.now()}`;
    console.log(`[approve] requestId=${requestId}`);
  }

  if ('alreadyApproved' in result) {
    // Still trigger delivery if batchId is set (idempotency will handle duplicates)
    if (finalDeliveryBatchId && 'recordId' in result) {
      const origin = getAppOrigin(req);
      const deliveryUrl = `${origin}/api/delivery/partner/approved`;
      console.log("[approve] posting to delivery endpoint", { crasRecordId: result.recordId, deliveryBatchRecordId: selectedBatchRecordId, deliveryBatchId: finalDeliveryBatchId });
      try {
        const res = await fetch(deliveryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crasRecordId: result.recordId,
            batchId: finalDeliveryBatchId,
            deliveryBatchRecordId: selectedBatchRecordId,
            requestId,
            triggeredBy: 'approval',
          }),
        });
        const text = await res.text().catch(() => '');
        console.log(`[approve] delivery endpoint response`, { requestId, status: res.status, ok: res.ok, text: text.slice(0, 500) });
      } catch (err) {
        console.log(`[approve] delivery endpoint fetch failed`, { requestId, err: err instanceof Error ? err.message : String(err) });
      }
      console.log(`[approve] after calling delivery endpoint`, { requestId });
    }
    return NextResponse.json(
      { ok: true, alreadyApproved: true },
      { headers: NO_STORE }
    );
  }

  // Trigger delivery via event-driven endpoint (if deliveryBatchId is set)
  if (finalDeliveryBatchId && 'recordId' in result) {
    const origin = getAppOrigin(req);
    const deliveryUrl = `${origin}/api/delivery/partner/approved`;
    console.log("[approve] posting to delivery endpoint", { crasRecordId: result.recordId, deliveryBatchRecordId: selectedBatchRecordId, deliveryBatchId: finalDeliveryBatchId });
    try {
      const res = await fetch(deliveryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crasRecordId: result.recordId,
          batchId: finalDeliveryBatchId,
          deliveryBatchRecordId: selectedBatchRecordId,
          requestId,
          triggeredBy: 'approval',
        }),
      });
      const text = await res.text().catch(() => '');
      console.log(`[approve] delivery endpoint response`, { requestId, status: res.status, ok: res.ok, text: text.slice(0, 500) });
    } catch (err) {
      console.log(`[approve] delivery endpoint fetch failed`, { requestId, err: err instanceof Error ? err.message : String(err) });
    }
    console.log(`[approve] after calling delivery endpoint`, { requestId });
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
