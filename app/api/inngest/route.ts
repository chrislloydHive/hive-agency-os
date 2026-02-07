// app/api/inngest/route.ts
// Inngest serve endpoint for handling background jobs

import { serve } from 'inngest/next';
import { InngestMiddleware } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import type { NextRequest } from 'next/server';

// Import all Inngest functions
import { generateFullGap } from '@/lib/inngest/functions/generate-full-gap';
import { websiteDiagnostic, websiteDiagnosticErrorHandler } from '@/lib/inngest/functions/website-diagnostic';
import {
  contextGraphProposeFromV5,
  insightsAggregateV5,
  signalsV5ThresholdBreached,
} from '@/lib/inngest/functions/website-lab-v5-handlers';
import { brandDiagnostic, brandDiagnosticErrorHandler } from '@/lib/inngest/functions/brand-diagnostic';
import {
  refreshAnalyticsFindingsScheduled,
  refreshAnalyticsFindingsManual,
} from '@/lib/inngest/functions/refresh-analytics-findings';
import { engagementContextGathering } from '@/lib/inngest/functions/engagement-context-gathering';
import {
  ensureUpcomingDeliverablesDaily,
  ensureUpcomingDeliverablesOnDemand,
} from '@/lib/inngest/functions/ensure-upcoming-deliverables';
import {
  weeklyBriefMonday,
  weeklyBriefOnDemand,
} from '@/lib/inngest/functions/weekly-brief';
import { runPendingDeliveriesScheduled } from '@/lib/inngest/functions/run-pending-deliveries';

// Middleware to read x-vercel-oidc-token header and inject into ctx.oidcToken
const routeOidcMiddleware = new InngestMiddleware({
  name: 'Route OIDC Token Propagation',
  init: () => {
    return {
      onFunctionRun: ({ ctx, reqArgs }) => {
        // Extract x-vercel-oidc-token from request headers
        let oidcToken: string | undefined;
        
        if (reqArgs && Array.isArray(reqArgs) && reqArgs.length > 0) {
          const firstArg = reqArgs[0];
          if (firstArg && typeof firstArg === 'object' && 'headers' in firstArg) {
            const headers = firstArg.headers as Headers | Record<string, string>;
            if (headers instanceof Headers) {
              oidcToken = headers.get('x-vercel-oidc-token') || undefined;
            } else if (typeof headers === 'object') {
              oidcToken = headers['x-vercel-oidc-token'] || headers['X-Vercel-OIDC-Token'] || undefined;
            }
          }
        }
        
        // Temporary console.log confirming presence
        console.log('[Inngest Route] OIDC token present:', !!oidcToken);
        
        return {
          transformInput: ({ ctx: inputCtx }) => {
            // Merge OIDC token into function context
            return {
              ctx: {
                ...inputCtx,
                oidcToken,
              },
            };
          },
        };
      },
    };
  },
});

// Serve all functions
// Middleware reads x-vercel-oidc-token header and injects into ctx.oidcToken
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // GAP generation
    generateFullGap,
    // Engagement context gathering
    engagementContextGathering,
    // Website Lab
    websiteDiagnostic,
    websiteDiagnosticErrorHandler,
    // Website Lab V5 Event Handlers (downstream, independent)
    contextGraphProposeFromV5,
    insightsAggregateV5,
    signalsV5ThresholdBreached,
    // Brand Lab
    brandDiagnostic,
    brandDiagnosticErrorHandler,
    // Analytics Findings
    refreshAnalyticsFindingsScheduled,
    refreshAnalyticsFindingsManual,
    // Program Recurring Deliverables
    ensureUpcomingDeliverablesDaily,
    ensureUpcomingDeliverablesOnDemand,
    // Weekly Brief Generation
    weeklyBriefMonday,
    weeklyBriefOnDemand,
    // Partner delivery: process CRAS Ready to Deliver (Webhook) without Airtable fetch
    runPendingDeliveriesScheduled,
  ],
  middleware: [routeOidcMiddleware],
});
