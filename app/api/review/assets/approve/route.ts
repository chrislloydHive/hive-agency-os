// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).
// NOTE: Approval sets delivery pipeline fields but does NOT trigger immediate delivery.
// Delivery runs from batch activation (when Make Active = true on Partner Delivery Batch).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient } from '@/lib/airtable/reviewAssetStatus';

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

  // Approve should ONLY update existing CRAS record (created by sync process on portal load)
  // If record doesn't exist, setSingleAssetApprovedClient will create it first with warning
  const result = await setSingleAssetApprovedClient({
    token,
    driveFileId,
    approvedAt,
    approvedByName,
    approvedByEmail,
    deliveryBatchId: deliveryBatchId ?? undefined,
    // Pass project info for fallback record creation (should not be needed if sync works)
    projectId: resolved.project.recordId,
    filename,
    tactic,
    variant,
  });

  if ('error' in result) {
    const status = result.error === 'Record not found' ? 404 : 500;
    const payload: { error: string; airtableError?: unknown } = { error: result.error };
    if (result.airtableError !== undefined) payload.airtableError = result.airtableError;
    return NextResponse.json(payload, { status, headers: NO_STORE });
  }

  // Note: Delivery is NOT triggered immediately on approval.
  // Assets are marked with Needs Delivery = true, Delivery Status = 'Ready for Delivery'.
  // Actual delivery runs from batch activation (when Make Active = true on Partner Delivery Batch).

  console.log(`[approve] Asset approved successfully. Delivery pipeline fields set (no immediate delivery).`, {
    recordId: 'recordId' in result ? result.recordId : undefined,
    deliveryBatchId: deliveryBatchId || 'undefined',
  });

  if ('alreadyApproved' in result) {
    return NextResponse.json(
      { ok: true, alreadyApproved: true },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
