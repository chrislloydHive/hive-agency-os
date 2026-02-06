// app/api/review/assets/deliver-batch/route.ts
// POST: Portal-initiated vendor delivery. Delivers approved (and not-yet-delivered) assets.
// Body: { token, deliveryBatchId, destinationFolderId, approvedFileIds }.
// Auth: token (review portal); no webhook secret required.

import { NextRequest, NextResponse } from 'next/server';
import { runPartnerDeliveryByBatch } from '@/lib/delivery/partnerDelivery';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    deliveryBatchId?: string;
    destinationFolderId?: string;
    approvedFileIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim();
  const destinationFolderId = (body.destinationFolderId ?? '').toString().trim() || undefined;
  const approvedFileIds = Array.isArray(body.approvedFileIds)
    ? body.approvedFileIds.map((id) => String(id).trim()).filter(Boolean)
    : undefined;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }
  if (!deliveryBatchId) {
    return NextResponse.json({ ok: false, error: 'Missing deliveryBatchId' }, { status: 400, headers: NO_STORE });
  }
  if (!approvedFileIds?.length) {
    return NextResponse.json({ ok: false, error: 'No approved assets to deliver' }, { status: 400, headers: NO_STORE });
  }

  const oidcToken = req.headers.get('x-vercel-oidc-token')?.trim() || undefined;

  const result = await runPartnerDeliveryByBatch({
    deliveryBatchId,
    destinationFolderId,
    approvedFileIds,
    dryRun: false,
    oidcToken,
    token,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, authMode: result.authMode },
      { status: result.statusCode, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deliveredFolderId: result.deliveredFolderId,
      deliveredFolderUrl: result.deliveredFolderUrl,
      deliverySummary: result.deliverySummary,
      authMode: result.authMode,
    },
    { headers: NO_STORE }
  );
}
