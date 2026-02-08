// app/api/debug/inngest-delivery-ping/route.ts
// Debug endpoint to test Inngest event emission for partner delivery
// POST body: { crasRecordId, deliveryBatchId }

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    crasRecordId?: string;
    deliveryBatchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const crasRecordId = body.crasRecordId ? String(body.crasRecordId).trim() : undefined;
  const deliveryBatchId = body.deliveryBatchId ? String(body.deliveryBatchId).trim() : undefined;

  if (!crasRecordId) {
    return NextResponse.json({ error: 'Missing crasRecordId' }, { status: 400, headers: NO_STORE });
  }

  const requestId = `debug-${crasRecordId}-${Date.now()}`;
  const eventName = 'partner.delivery.requested';

  try {
    const eventPayload = {
      name: eventName,
      data: {
        crasRecordId,
        batchId: deliveryBatchId,
        requestId,
        triggeredBy: 'debug-ping',
      },
    };

    console.log(`[debug/ping] emitted`, {
      requestId,
      crasRecordId,
      deliveryBatchId,
      eventName,
    });

    const res = await inngest.send(eventPayload);

    console.log(`[debug/ping] send result`, {
      requestId,
      resType: typeof res,
      resKeys: res ? Object.keys(res) : [],
    });

    return NextResponse.json(
      { ok: true, requestId, eventName },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[debug/ping] Failed to emit event:`, message);
    return NextResponse.json(
      { error: `Failed to emit event: ${message}` },
      { status: 500, headers: NO_STORE }
    );
  }
}
