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

  return NextResponse.json(
    { ok: true, approved: result.updated, alreadyApproved },
    { headers: NO_STORE }
  );
}
