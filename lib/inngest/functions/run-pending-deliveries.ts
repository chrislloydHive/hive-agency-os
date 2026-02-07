// lib/inngest/functions/run-pending-deliveries.ts
// Scheduled job: process CRAS records where Ready to Deliver (Webhook) = true.
// Replaces Airtable Run Script / Webhook automations; Airtable only sets flags, this runs delivery.
// Runs every 5 minutes. Idempotent; safe to re-run.

import { inngest } from '../client';
import { runPendingDeliveries } from '@/lib/delivery/runPendingDeliveries';

// Temporarily set to every 1 minute for faster testing/debugging
// TODO: Change back to '*/5 * * * *' (every 5 minutes) once delivery is working
const CRON_SCHEDULE = '*/1 * * * *'; // Every 1 minute (temporary for debugging)

export const runPendingDeliveriesScheduled = inngest.createFunction(
  {
    id: 'partner-delivery-run-pending',
    name: 'Run Pending Partner Deliveries',
    retries: 2,
    concurrency: { limit: 1 },
  },
  { cron: CRON_SCHEDULE },
  async () => {
    try {
      // Diagnostic: Check credential availability in Inngest function context
      const hasServiceAccountJson = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const hasServiceAccountEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const hasServiceAccountKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      const hasWifJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const hasVercelOidcToken = !!process.env.VERCEL_OIDC_TOKEN;
      
      console.log('[run-pending-deliveries] Inngest function credential check:', {
        serviceAccount: {
          hasJson: hasServiceAccountJson,
          hasEmail: hasServiceAccountEmail,
          hasKey: hasServiceAccountKey,
          available: hasServiceAccountJson || (hasServiceAccountEmail && hasServiceAccountKey),
        },
        wif: {
          hasJson: hasWifJson,
          hasVercelOidcToken,
        },
      });
      
      const result = await runPendingDeliveries({ oidcToken: undefined });
      if (result.processed > 0) {
        console.log(
          `[run-pending-deliveries] processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed} skipped=${result.skipped}`
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[run-pending-deliveries] Inngest function error:', message, stack);
      throw err;
    }
  }
);
