// app/api/delivery/partner/approved/route.ts
// POST: Trigger delivery for an approved CRAS record via Inngest event
// Called by Review UI after setting Asset Approved (Client) = true

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { getBase } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';
import { DELIVERY_BATCH_ID_FIELD } from '@/lib/airtable/reviewAssetStatus';
import { getBatchDetails, getBatchDetailsByRecordId } from '@/lib/airtable/partnerDeliveryBatches';

export const dynamic = 'force-dynamic';

// TEMP instrumentation: Log Inngest config when endpoint is called
console.log('[delivery/partner/approved] Inngest config check', {
  hasEventKey: Boolean(process.env.INNGEST_EVENT_KEY),
  eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.slice(0, 8) ?? null,
  clientId: 'hive-agency-os',
});

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// GET handler for debugging/verification
export async function GET() {
  return NextResponse.json(
    { ok: true, method: 'GET' },
    { headers: NO_STORE }
  );
}

export async function POST(req: Request) {
  // FIRST-LINE log that always runs
  console.log("[delivery/webhook] HIT", {
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

  // Log parsed body
  console.log("[delivery/webhook] BODY", body);

  const requestId = body.requestId ? String(body.requestId).trim() : undefined;
  const crasRecordId = body.crasRecordId ? String(body.crasRecordId).trim() : undefined;
  const deliveryBatchId = body.deliveryBatchId || body.batchId ? String(body.deliveryBatchId || body.batchId).trim() : undefined;
  const deliveryBatchRecordId = body.deliveryBatchRecordId ? String(body.deliveryBatchRecordId).trim() : undefined;
  
  console.log("[delivery/partner/approved] using batchRecordId from request?", { hasBodyBatchRecordId: !!deliveryBatchRecordId, deliveryBatchRecordId });

  // Log at first line for correlation tracing
  console.log(`[delivery/approved] start`, { requestId, crasRecordId, deliveryBatchId });

  if (!crasRecordId) {
    return NextResponse.json({ error: 'Missing crasRecordId' }, { status: 400, headers: NO_STORE });
  }

  try {
    // Prefer batchRecordId from request body (already resolved by approve handler)
    // Only fetch CRAS if needed for fallback
    let batchRecordId: string | undefined = deliveryBatchRecordId;
    let crasRecord: any = null;
    
    // Only fetch CRAS record if we need to fallback to CRAS field lookup
    if (!batchRecordId) {
      const base = getBase();
      crasRecord = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(crasRecordId);
      
      // Try to extract batchRecordId from CRAS fields
      // Check both "Partner Delivery Batch" (linked record) and "Delivery Batch ID" (can be text or linked record)
      const partnerDeliveryBatchField = crasRecord?.fields?.["Partner Delivery Batch"];
      const deliveryBatchIdField = crasRecord?.fields?.[DELIVERY_BATCH_ID_FIELD];
      
      // First try "Partner Delivery Batch" (linked record field)
      if (Array.isArray(partnerDeliveryBatchField) && partnerDeliveryBatchField.length > 0) {
        const firstLink = partnerDeliveryBatchField[0];
        if (typeof firstLink === 'string' && firstLink.startsWith('rec')) {
          batchRecordId = firstLink;
        } else if (typeof firstLink === 'object' && firstLink !== null && 'id' in firstLink) {
          batchRecordId = (firstLink as { id: string }).id;
        }
      } else if (typeof partnerDeliveryBatchField === 'string' && partnerDeliveryBatchField.startsWith('rec')) {
        batchRecordId = partnerDeliveryBatchField;
      }
      
      // Fallback: try "Delivery Batch ID" field (can be text or linked record)
      if (!batchRecordId) {
        if (Array.isArray(deliveryBatchIdField) && deliveryBatchIdField.length > 0) {
          const firstLink = deliveryBatchIdField[0];
          if (typeof firstLink === 'string' && firstLink.startsWith('rec')) {
            batchRecordId = firstLink;
          } else if (typeof firstLink === 'object' && firstLink !== null && 'id' in firstLink) {
            batchRecordId = (firstLink as { id: string }).id;
          }
        } else if (typeof deliveryBatchIdField === 'string' && deliveryBatchIdField.startsWith('rec')) {
          batchRecordId = deliveryBatchIdField;
        }
      }
      
      console.log("[delivery] CRAS field lookup", {
        crasRecordId,
        partnerDeliveryBatchField: partnerDeliveryBatchField || null,
        deliveryBatchIdField: deliveryBatchIdField || null,
        resolvedBatchRecordId: batchRecordId || null,
      });
    }
    
    // Log batch resolution for debugging
    console.log("[delivery] batch resolution", {
      fromRequest: deliveryBatchRecordId || null,
      fromCRASPartnerDeliveryBatch: crasRecord?.fields?.["Partner Delivery Batch"] || null,
      fromCRASDeliveryBatchId: crasRecord?.fields?.[DELIVERY_BATCH_ID_FIELD] || null,
      resolvedBatchRecordId: batchRecordId || null,
    });
    
    // Only throw error if BOTH request and CRAS are missing
    if (!batchRecordId) {
      const errorMsg = `No Partner Delivery Batch resolved for CRAS ${crasRecordId}`;
      console.error(`[delivery/partner/approved] CRITICAL: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const finalRequestId = requestId || `approved-${Date.now().toString(36)}-${crasRecordId.slice(-8)}`;
    const eventPayload = {
      name: 'partner.delivery.requested',
      data: {
        crasRecordId,
        batchId: deliveryBatchId,
        batchRecordId,
        requestId: finalRequestId,
        triggeredBy: body.triggeredBy || 'approval',
      },
    };
    
    console.log("[delivery/emit]", { crasRecordId, batchId: deliveryBatchId, batchRecordId });
    
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
