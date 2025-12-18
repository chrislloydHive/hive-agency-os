// app/api/inngest/route.ts
// Inngest serve endpoint for handling background jobs

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Import all Inngest functions
import { generateFullGap } from '@/lib/inngest/functions/generate-full-gap';
import { websiteDiagnostic, websiteDiagnosticErrorHandler } from '@/lib/inngest/functions/website-diagnostic';
import { brandDiagnostic, brandDiagnosticErrorHandler } from '@/lib/inngest/functions/brand-diagnostic';
import {
  refreshAnalyticsFindingsScheduled,
  refreshAnalyticsFindingsManual,
} from '@/lib/inngest/functions/refresh-analytics-findings';
import { engagementContextGathering } from '@/lib/inngest/functions/engagement-context-gathering';

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
    // Brand Lab
    brandDiagnostic,
    brandDiagnosticErrorHandler,
    // Analytics Findings
    refreshAnalyticsFindingsScheduled,
    refreshAnalyticsFindingsManual,
  ],
});
