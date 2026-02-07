// app/api/inngest/route.ts
// Inngest serve endpoint for handling background jobs

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import type { NextRequest, NextResponse } from 'next/server';

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

// Get the serve handlers
const handlers = serve({
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
});

// Wrap handlers to read x-vercel-oidc-token header and log presence
// Note: The actual token propagation is handled by middleware in lib/inngest/client.ts
// This wrapper just logs the header presence for verification
export const GET = async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
  const oidcToken = req.headers.get('x-vercel-oidc-token');
  // Temporary console.log confirming presence
  console.log('[Inngest Route] OIDC token present:', !!oidcToken);
  return handlers.GET(req, context);
};

export const POST = async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
  const oidcToken = req.headers.get('x-vercel-oidc-token');
  // Temporary console.log confirming presence
  console.log('[Inngest Route] OIDC token present:', !!oidcToken);
  return handlers.POST(req, context);
};

export const PUT = async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
  const oidcToken = req.headers.get('x-vercel-oidc-token');
  // Temporary console.log confirming presence
  console.log('[Inngest Route] OIDC token present:', !!oidcToken);
  return handlers.PUT(req, context);
};
