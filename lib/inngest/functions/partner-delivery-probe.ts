// lib/inngest/functions/partner-delivery-probe.ts
// Minimal probe function to verify Inngest is invoking functions for partner.delivery.requested events

import { inngest } from '../client';

export const partnerDeliveryProbe = inngest.createFunction(
  {
    id: 'partner-delivery-probe',
    name: 'Partner Delivery Probe (Debug)',
    retries: 0, // No retries for probe
  },
  { event: 'partner.delivery.requested' },
  async ({ event }) => {
    // Log immediately when function is invoked
    console.log(`[inngest/probe] received`, {
      name: event.name,
      requestId: event.data?.requestId,
      crasRecordId: event.data?.crasRecordId,
      batchId: event.data?.batchId,
      triggeredBy: event.data?.triggeredBy,
      eventId: event.id,
    });
    
    // Return immediately - do nothing else
    return { ok: true, probe: true };
  }
);
