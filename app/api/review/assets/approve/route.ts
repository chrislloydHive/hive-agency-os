// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient, ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';

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
  const deliveryBatchId = body.deliveryBatchId != null ? String(body.deliveryBatchId).trim() || undefined : undefined;
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

  if ('alreadyApproved' in result) {
    // Still trigger delivery if batchId is set (idempotency will handle duplicates)
    if (deliveryBatchId && 'recordId' in result) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        fetch(`${baseUrl}/api/delivery/partner/approved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crasRecordId: result.recordId,
            batchId: deliveryBatchId,
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
  if (deliveryBatchId && 'recordId' in result) {
    try {
      // Fire-and-forget: call delivery endpoint asynchronously
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      fetch(`${baseUrl}/api/delivery/partner/approved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crasRecordId: result.recordId,
          batchId: deliveryBatchId,
        }),
      }).catch((err) => {
        console.error('[approve] Failed to trigger delivery:', err);
      });
    } catch (err) {
      // Non-blocking: log error but don't fail the approval
      console.error('[approve] Error triggering delivery:', err);
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
