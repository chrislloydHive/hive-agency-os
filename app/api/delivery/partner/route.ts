// app/api/delivery/partner/route.ts
// POST: Partner delivery webhook. Airtable automation sends one asset per request.
// Copies Drive file to destination folder and updates Creative Review Asset Status.
// Auth: X-DELIVERY-SECRET must match DELIVERY_WEBHOOK_SECRET.
// dryRun: true = validate only, no copy, no Airtable updates.

import { NextRequest, NextResponse } from 'next/server';
import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const DELIVERY_SECRET_HEADER = 'x-delivery-secret';

function getRequestId(): string {
  return `delivery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  const secret = process.env.DELIVERY_WEBHOOK_SECRET;
  const headerSecret = req.headers.get(DELIVERY_SECRET_HEADER)?.trim();

  if (!secret || headerSecret !== secret) {
    console.warn(`[delivery/partner] ${requestId} Unauthorized: missing or invalid ${DELIVERY_SECRET_HEADER}`);
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    airtableRecordId?: string;
    driveFileId?: string;
    deliveryBatchId?: string;
    destinationFolderId?: string;
    token?: string;
    dryRun?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    console.warn(`[delivery/partner] ${requestId} Invalid JSON`);
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const airtableRecordId = (body.airtableRecordId ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? '').toString().trim();
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim();
  const destinationFolderId = (body.destinationFolderId ?? '').toString().trim();
  const token = (body.token ?? '').toString().trim() || undefined;
  const dryRun = body.dryRun === true;

  if (!airtableRecordId) {
    console.warn(`[delivery/partner] ${requestId} Missing airtableRecordId`);
    return NextResponse.json({ ok: false, error: 'Missing airtableRecordId' }, { status: 400, headers: NO_STORE });
  }

  const result = await runPartnerDelivery(
    {
      airtableRecordId,
      driveFileId,
      deliveryBatchId: deliveryBatchId || undefined,
      destinationFolderId: destinationFolderId || undefined,
      dryRun,
      token,
    },
    requestId
  );

  if (result.ok && result.result === 'dry_run') {
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        resolvedDestinationFolderId: result.resolvedDestinationFolderId,
        wouldCopyFileId: result.wouldCopyFileId,
      },
      { headers: NO_STORE }
    );
  }

  if (result.ok) {
    return NextResponse.json(
      { ok: true, deliveredFileUrl: result.deliveredFileUrl },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ok: false, error: result.error },
    { status: result.statusCode, headers: NO_STORE }
  );
}
