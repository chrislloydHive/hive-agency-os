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
    // First line log - must be first statement
    console.log(`[inngest/probe] RECEIVED`, {
      name: event.name,
      requestId: event.data?.requestId,
      crasRecordId: event.data?.crasRecordId,
      batchId: event.data?.batchId,
      triggeredBy: event.data?.triggeredBy,
    });
    
    // Return immediately - do nothing else
    return { ok: true, probe: true };
  }
);
