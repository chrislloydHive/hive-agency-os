// app/api/review/assets/bulk-approve/route.ts
// POST: Set Asset Approved (Client) = true on selected assets. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import {
  getRecordIdsForBulkApprove,
  batchSetAssetApprovedClient,
  ensureCrasRecord,
} from '@/lib/airtable/reviewAssetStatus';
import { resolveDeliveryBatchFromCras } from '@/lib/review/resolveDeliveryBatch';

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

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    fileIds?: string[];
    approvedAt?: string;
    approvedByName?: string;
    approvedByEmail?: string;
    deliveryBatchId?: string | null;
    /** Per-section context so CRAS records can be created when missing. */
    sections?: { variant: string; tactic: string; fileIds: string[] }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];
  const approvedAt = resolveApprovedAt(body.approvedAt);
  const approvedByName = (body.approvedByName ?? '').toString().trim() || undefined;
  const approvedByEmail = (body.approvedByEmail ?? '').toString().trim() || undefined;
  const deliveryBatchId = body.deliveryBatchId != null ? String(body.deliveryBatchId).trim() || undefined : undefined;
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404, headers: NO_STORE });
  }

  const fileIdSet = new Set(fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0));
  const uniqueFileIds = [...fileIdSet];

  for (const sec of sections) {
    const variant = (sec.variant ?? '').toString().trim();
    const tactic = (sec.tactic ?? '').toString().trim();
    const ids = Array.isArray(sec.fileIds) ? sec.fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
    if (!variant || !tactic || ids.length === 0) continue;
    await Promise.all(
      ids.map((driveFileId) =>
        ensureCrasRecord({
          token,
          projectId: resolved.project.recordId,
          driveFileId,
          filename: '',
          tactic,
          variant,
        })
      )
    );
  }

  const { toUpdate, alreadyApproved } = await getRecordIdsForBulkApprove(token, uniqueFileIds);

  if (toUpdate.length === 0) {
    return NextResponse.json(
      { ok: true, approved: 0, alreadyApproved },
      { headers: NO_STORE }
    );
  }

  // Log Airtable fields being written (before approval)
  const approvalFields: Record<string, unknown> = {
    'Asset Approved (Client)': true,
    'Status': 'Approved',
    'Approved At': approvedAt || new Date().toISOString(),
  };
  if (approvedByName !== undefined) approvalFields['Approved By Name'] = String(approvedByName).slice(0, 100);
  if (approvedByEmail !== undefined) approvalFields['Approved By Email'] = String(approvedByEmail).slice(0, 200);
  if (deliveryBatchId != null && String(deliveryBatchId).trim()) {
    const bid = String(deliveryBatchId).trim();
    approvalFields['Delivery Batch ID'] = bid.startsWith('rec') ? [bid] : bid;
    approvalFields['Ready to Deliver (Webhook)'] = true;
  }
  console.log(`[bulk-approve] Writing Airtable fields for ${toUpdate.length} record(s):`, {
    fieldKeys: Object.keys(approvalFields),
    fields: approvalFields,
  });

  const result = await batchSetAssetApprovedClient(toUpdate, {
    approvedAt,
    approvedByName,
    approvedByEmail,
    deliveryBatchId: deliveryBatchId ?? undefined,
  });

  if (result.failedAt !== null) {
    const payload = {
      ok: false,
      error: result.error ?? 'Airtable update failed',
      approved: result.updated,
      alreadyApproved,
      partial: result.updated > 0,
      airtableError: result.airtableError,
    };
    return NextResponse.json(payload, { status: 500, headers: NO_STORE });
  }

  // Resolve batchRecordId for each record (if deliveryBatchId not provided or needs resolution)
  // Use shared resolution logic like single approve endpoint
  const recordBatchMap = new Map<string, { batchId: string; batchRecordId: string }>();
  
  // If deliveryBatchId was provided, use it for all records
  if (deliveryBatchId) {
    // Try to resolve batchRecordId from first record (if not already a record ID)
    if (!deliveryBatchId.startsWith('rec') && toUpdate.length > 0) {
      const resolved = await resolveDeliveryBatchFromCras(toUpdate[0]);
      if (resolved) {
        for (const recordId of toUpdate) {
          recordBatchMap.set(recordId, {
            batchId: resolved.deliveryBatchId,
            batchRecordId: resolved.batchRecordId,
          });
        }
      } else {
        // Fallback: use deliveryBatchId as-is (name string)
        for (const recordId of toUpdate) {
          recordBatchMap.set(recordId, {
            batchId: deliveryBatchId,
            batchRecordId: '', // Will be resolved by delivery endpoint
          });
        }
      }
    } else {
      // deliveryBatchId is already a record ID
      for (const recordId of toUpdate) {
        recordBatchMap.set(recordId, {
          batchId: deliveryBatchId,
          batchRecordId: deliveryBatchId,
        });
      }
    }
  } else {
    // No deliveryBatchId provided - resolve from each CRAS record's Project link
    console.log(`[bulk-approve] Resolving deliveryBatchId from CRAS Project links for ${toUpdate.length} record(s)`);
    for (const recordId of toUpdate) {
      const resolved = await resolveDeliveryBatchFromCras(recordId);
      if (resolved) {
        recordBatchMap.set(recordId, resolved);
      }
    }
  }

  // Trigger delivery via event-driven endpoint for all approved records
  if (toUpdate.length > 0) {
    const origin = getAppOrigin(req);
    const deliveryUrl = `${origin}/api/delivery/partner/approved`;
    
    console.log(`[bulk-approve] Triggering delivery for ${toUpdate.length} record(s)`);
    
    // Fire-and-forget: trigger delivery for each record with resolved batchRecordId
    toUpdate.forEach((recordId) => {
      const batchInfo = recordBatchMap.get(recordId);
      const batchId = batchInfo?.batchId || deliveryBatchId;
      const batchRecordId = batchInfo?.batchRecordId;
      
      if (!batchId) {
        console.warn(`[bulk-approve] No deliveryBatchId for record ${recordId}, skipping delivery trigger`);
        return;
      }
      
      const requestId = `bulk-approved-${recordId}-${Date.now()}`;
      fetch(deliveryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crasRecordId: recordId,
          batchId,
          deliveryBatchRecordId: batchRecordId,
          requestId,
          triggeredBy: 'bulk-approval',
        }),
      }).catch((err) => {
        console.error(`[bulk-approve] Failed to trigger delivery for ${recordId}:`, err);
      });
    });
  }

  return NextResponse.json(
    { ok: true, approved: result.updated, alreadyApproved },
    { headers: NO_STORE }
  );
}
