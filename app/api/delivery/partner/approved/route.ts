// app/api/delivery/partner/approved/route.ts
// POST: Trigger delivery for an approved CRAS record via Inngest event
// Called by Review UI after setting Asset Approved (Client) = true

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    crasRecordId: string;
    batchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const crasRecordId = (body.crasRecordId ?? '').toString().trim();
  const batchId = body.batchId ? String(body.batchId).trim() : undefined;

  if (!crasRecordId) {
    return NextResponse.json({ error: 'Missing crasRecordId' }, { status: 400, headers: NO_STORE });
  }

  // Generate a unique request ID for this delivery
  const requestId = `approved-${Date.now().toString(36)}-${crasRecordId.slice(-8)}`;

  try {
    // Send Inngest event to trigger delivery
    await inngest.send({
      name: 'partner.delivery.requested',
      data: {
        crasRecordId,
        batchId,
        requestId,
        triggeredBy: 'approval',
      },
    });

    console.log(`[delivery/partner/approved] Event sent for CRAS record ${crasRecordId}, requestId=${requestId}`);

    return NextResponse.json(
      { ok: true, requestId },
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
