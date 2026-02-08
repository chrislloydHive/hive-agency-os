// app/api/delivery/partner/approved/route.ts
// POST: Trigger delivery for an approved CRAS record via Inngest event
// Called by Review UI after setting Asset Approved (Client) = true

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// GET handler for debugging/verification
export async function GET() {
  return NextResponse.json(
    { ok: true, method: 'GET' },
    { headers: NO_STORE }
  );
}

export async function POST(req: Request) {
  let body: {
    requestId?: string;
    crasRecordId?: string;
    deliveryBatchId?: string;
    batchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const requestId = body.requestId ? String(body.requestId).trim() : undefined;
  const crasRecordId = body.crasRecordId ? String(body.crasRecordId).trim() : undefined;
  const deliveryBatchId = body.deliveryBatchId || body.batchId ? String(body.deliveryBatchId || body.batchId).trim() : undefined;

  // Log at first line for correlation tracing
  console.log(`[delivery/approved] start`, { requestId, crasRecordId, deliveryBatchId });

  if (!crasRecordId) {
    return NextResponse.json({ error: 'Missing crasRecordId' }, { status: 400, headers: NO_STORE });
  }

  try {
    const finalRequestId = requestId || `approved-${Date.now().toString(36)}-${crasRecordId.slice(-8)}`;
    const eventPayload = {
      name: 'partner.delivery.requested',
      data: {
        crasRecordId,
        batchId: deliveryBatchId,
        requestId: finalRequestId,
        triggeredBy: 'approval',
      },
    };
    
    // Log the exact event name and payload keys before sending
    console.log(`[delivery/partner/approved] sending event`, {
      name: eventPayload.name,
      requestId: finalRequestId,
      crasRecordId,
      deliveryBatchId,
      dataKeys: Object.keys(eventPayload.data),
    });
    
    // Send Inngest event to trigger delivery
    const res = await inngest.send(eventPayload);
    
    // Log the result of inngest.send()
    console.log(`[delivery/partner/approved] send result`, {
      requestId: finalRequestId,
      resType: typeof res,
      resKeys: res ? Object.keys(res) : [],
      resValue: res ? JSON.stringify(res).slice(0, 200) : null,
    });

    console.log(`[delivery/partner/approved] Event sent for CRAS record ${crasRecordId}, requestId=${finalRequestId}`);

    return NextResponse.json(
      { ok: true, requestId: finalRequestId },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[delivery/partner/approved] Failed to send event for ${crasRecordId}:`, message);
    return NextResponse.json(
      { error: `Failed to trigger delivery: ${message}` },
      { status: 500, headers: NO_STORE }
    );
  }
}
