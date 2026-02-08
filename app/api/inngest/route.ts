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
import { partnerDeliveryRequested } from '@/lib/inngest/functions/partner-delivery-requested';

// Get the serve handlers
const registeredFunctions = [
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
  // Partner delivery: event-driven (triggered on approval)
  partnerDeliveryRequested,
];

// Log registered functions at boot (once per process)
if (typeof window === 'undefined') {
  const functionIds = registeredFunctions.map(f => {
    const id = typeof f.id === 'function' ? f.id() : (f.id || f.name || 'unknown');
    return id;
  });
  console.log('[inngest/route] registered', functionIds);
  
  // Check if partner delivery function is registered
  const hasPartnerDelivery = functionIds.some(id => 
    typeof id === 'string' && (id.includes('partner-delivery') || id.includes('partnerDelivery'))
  );
  console.log('[inngest/route] partner-delivery-requested registered?', hasPartnerDelivery);
}

const handlers = serve({
  client: inngest,
  functions: registeredFunctions,
});

// Wrap handlers to read x-vercel-oidc-token header and set process.env.VERCEL_OIDC_TOKEN
// This makes the token available to downstream code that checks process.env.VERCEL_OIDC_TOKEN
type RouteContext = {
  params: Promise<Record<string, string>>;
};

export const GET = async (req: NextRequest, context: RouteContext) => {
  // Guard: Reject requests for the old disabled cron function
  const url = new URL(req.url);
  const fnId = url.searchParams.get('fnId');
  if (fnId && fnId.includes('partner-delivery-run-pending')) {
    console.warn('[inngest/route] ⚠️ Rejecting request for disabled cron function:', fnId);
    return new Response(
      JSON.stringify({ error: 'This function has been disabled. Use event-driven partnerDeliveryRequested instead.' }),
      { status: 410, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = req.headers.get('x-vercel-oidc-token');
  // Set process.env.VERCEL_OIDC_TOKEN for the duration of this request
  if (token) {
    process.env.VERCEL_OIDC_TOKEN = token;
  }
  // TEMPORARY log
  console.log('[inngest] x-vercel-oidc-token present?', Boolean(token), 'len', token?.length ?? 0);
  return handlers.GET(req, context);
};

export const POST = async (req: NextRequest, context: RouteContext) => {
  // Guard: Reject requests for the old disabled cron function
  const url = new URL(req.url);
  const fnId = url.searchParams.get('fnId');
  if (fnId && fnId.includes('partner-delivery-run-pending')) {
    console.warn('[inngest/route] ⚠️ Rejecting request for disabled cron function:', fnId);
    return new Response(
      JSON.stringify({ error: 'This function has been disabled. Use event-driven partnerDeliveryRequested instead.' }),
      { status: 410, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = req.headers.get('x-vercel-oidc-token');
  // Set process.env.VERCEL_OIDC_TOKEN for the duration of this request
  if (token) {
    process.env.VERCEL_OIDC_TOKEN = token;
  }
  // TEMPORARY log
  console.log('[inngest] x-vercel-oidc-token present?', Boolean(token), 'len', token?.length ?? 0);
  return handlers.POST(req, context);
};

export const PUT = async (req: NextRequest, context: RouteContext) => {
  // Guard: Reject requests for the old disabled cron function
  const url = new URL(req.url);
  const fnId = url.searchParams.get('fnId');
  if (fnId && fnId.includes('partner-delivery-run-pending')) {
    console.warn('[inngest/route] ⚠️ Rejecting request for disabled cron function:', fnId);
    return new Response(
      JSON.stringify({ error: 'This function has been disabled. Use event-driven partnerDeliveryRequested instead.' }),
      { status: 410, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = req.headers.get('x-vercel-oidc-token');
  // Set process.env.VERCEL_OIDC_TOKEN for the duration of this request
  if (token) {
    process.env.VERCEL_OIDC_TOKEN = token;
  }
  // TEMPORARY log
  console.log('[inngest] x-vercel-oidc-token present?', Boolean(token), 'len', token?.length ?? 0);
  return handlers.PUT(req, context);
};
