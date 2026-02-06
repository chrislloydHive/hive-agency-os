// lib/review/markBatchSeen.ts
// Shared logic for batch-level "Mark all as seen": resolve project + batch, write Partner Last Seen At = now.
// Used by POST /api/review/partners/mark-seen and POST /api/review/assets/mark-seen.

import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getBatchDetails,
  getBatchDetailsInBase,
  getDeliveryContextByProjectId,
  getProjectDefaultBatchId,
} from '@/lib/airtable/partnerDeliveryBatches';
import { writePartnerActivityToRecord, PARTNER_DELIVERY_BATCHES_TABLE } from '@/lib/airtable/deliveryWriteBack';

export interface MarkBatchSeenBody {
  token?: string;
  batchId?: string;
  deliveryBatchId?: string;
  selectedBatchId?: string;
}

export interface MarkBatchSeenResult {
  status: 200 | 400 | 404 | 500;
  body: { ok: true; partnerLastSeenAt: string } | { ok: false; error: string };
}

/**
 * Resolve project via token, resolve batch by batchId (or infer default), write Partner Last Seen At = now.
 * Returns status and body for the HTTP response.
 */
export async function markBatchSeen(body: MarkBatchSeenBody): Promise<MarkBatchSeenResult> {
  const token = (body.token ?? '').toString().trim();
  const batchIdParam =
    (body.batchId ?? body.deliveryBatchId ?? body.selectedBatchId ?? '').toString().trim() || null;

  if (!token) {
    return { status: 400, body: { ok: false, error: 'Missing token' } };
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return { status: 404, body: { ok: false, error: 'Invalid or expired token' } };
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
    return {
      status: 404,
      body: {
        ok: false,
        error: batchId ? 'Batch not found' : 'No delivery batch for this project',
      },
    };
  }

  const now = new Date().toISOString();
  const result = await writePartnerActivityToRecord(PARTNER_DELIVERY_BATCHES_TABLE, batch.recordId, {
    partnerLastSeenAt: now,
    newApprovedCount: 0,
  });

  if (!result.ok && result.error) {
    return { status: 500, body: { ok: false, error: result.error } };
  }

  return { status: 200, body: { ok: true, partnerLastSeenAt: now } };
}
