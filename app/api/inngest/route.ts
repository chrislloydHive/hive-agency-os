// app/api/inngest/route.ts
// Inngest serve endpoint for handling background jobs

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

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

// Serve all functions
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
  ],
});
