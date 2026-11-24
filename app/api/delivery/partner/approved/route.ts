// app/api/delivery/partner/approved/route.ts
// POST: Trigger delivery for an approved CRAS record via Inngest event
// (Also invoked server-side from review portal approve routes.)

import { NextResponse } from 'next/server';
import { triggerPartnerDeliveryForCras } from '@/lib/delivery/triggerPartnerDeliveryForCras';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// TEMP instrumentation: Log Inngest config when endpoint is called
console.log('[delivery/partner/approved] Inngest config check', {
  hasEventKey: Boolean(process.env.INNGEST_EVENT_KEY),
  eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.slice(0, 8) ?? null,
  clientId: 'hive-agency-os',
});

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// GET handler for debugging/verification
export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET' }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  console.log('[delivery/webhook] HIT', {
    method: req.method,
    url: req.url,
    time: new Date().toISOString(),
  });

  let body: {
    requestId?: string;
    crasRecordId?: string;
    deliveryBatchId?: string;
    batchId?: string;
    deliveryBatchRecordId?: string;
    triggeredBy?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  console.log('[delivery/webhook] BODY', body);

  const result = await triggerPartnerDeliveryForCras({
    crasRecordId: body.crasRecordId ?? '',
    requestId: body.requestId,
    deliveryBatchId: body.deliveryBatchId,
    batchId: body.batchId,
    deliveryBatchRecordId: body.deliveryBatchRecordId,
    triggeredBy: body.triggeredBy,
    execute: true,
  });

  console.log('[delivery/partner/approved] result', {
    crasRecordId: body.crasRecordId ?? null,
    triggeredBy: body.triggeredBy ?? null,
    ok: result.ok,
    statusCode: result.ok ? 200 : result.statusCode,
    result: result.ok ? result.result ?? null : null,
    error: result.ok ? null : result.error,
    deliveredFolderId: result.ok ? result.deliveredFolderId ?? null : null,
  });

  if (!result.ok) {
    const status = result.statusCode;
    return NextResponse.json(
      result.crasFields !== undefined
        ? { ok: false, error: result.error, crasFields: result.crasFields }
        : { ok: false, error: result.error },
      { status, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requestId: result.requestId,
      result: result.result ?? 'delivered',
      deliveredFileUrl: result.deliveredFileUrl,
      deliveredFolderUrl: result.deliveredFolderUrl,
      deliveredFolderId: result.deliveredFolderId,
    },
    { headers: NO_STORE },
  );
}
