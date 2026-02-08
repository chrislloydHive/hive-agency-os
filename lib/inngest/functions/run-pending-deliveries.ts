// lib/inngest/functions/run-pending-deliveries.ts
// Scheduled job: process CRAS records where Ready to Deliver (Webhook) = true.
// Replaces Airtable Run Script / Webhook automations; Airtable only sets flags, this runs delivery.
// Runs every 5 minutes. Idempotent; safe to re-run.

import { inngest } from '../client';
import { runPendingDeliveries } from '@/lib/delivery/runPendingDeliveries';

// DISABLED: This cron function is no longer used. Delivery is now event-driven via partnerDeliveryRequested.
// Kept for reference but gated behind env flag to prevent accidental registration.
const CRON_SCHEDULE = '*/1 * * * *'; // Every 1 minute (DISABLED)

// Only export if explicitly enabled via env flag (should never be true in production)
export const runPendingDeliveriesScheduled = process.env.ENABLE_PENDING_DELIVERY_CRON === 'true'
  ? inngest.createFunction(
      {
        id: 'partner-delivery-run-pending',
        name: 'Run Pending Partner Deliveries (DISABLED - use event-driven)',
        retries: 2,
        concurrency: { limit: 1 },
      },
      { cron: CRON_SCHEDULE },
      async ({ event, step }) => {
        console.log('[delivery-trigger] scheduled: ⚠️ CRON FUNCTION SHOULD NOT BE RUNNING');
        console.log('[run-pending-deliveries] ⚡ Function triggered by cron:', CRON_SCHEDULE, 'event:', event.id);
    
    return await step.run('process-deliveries', async () => {
      try {
        console.log('[run-pending-deliveries] Starting delivery processing...');
        
        // Read OIDC token from context (injected by middleware from x-vercel-oidc-token header)
        // For cron jobs, Vercel injects VERCEL_OIDC_TOKEN as env var automatically
        const oidcToken = process.env.VERCEL_OIDC_TOKEN || undefined;
        
        // Diagnostic: Check credential availability in Inngest function context
        const hasServiceAccountJson = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        const hasServiceAccountEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const hasServiceAccountKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
        const hasWifJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        const hasVercelOidcToken = !!oidcToken;
        
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
        
        // Pass OIDC token from context (or fallback to env var)
        const result = await runPendingDeliveries({ oidcToken });
        
        console.log('[run-pending-deliveries] Delivery processing complete:', {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          skipped: result.skipped,
        });
        
        if (result.processed > 0) {
          console.log(
            `[run-pending-deliveries] Summary: processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed} skipped=${result.skipped}`
          );
        } else {
          console.log('[run-pending-deliveries] No records to process');
        }
        
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error('[run-pending-deliveries] ❌ Inngest function error:', message);
        if (stack) {
          console.error('[run-pending-deliveries] Error stack:', stack);
        }
        throw err;
      }
    });
  }
  )
  : null; // Return null if env flag is not set, preventing registration
