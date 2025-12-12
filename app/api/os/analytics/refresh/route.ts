// app/api/os/analytics/refresh/route.ts
// POST endpoint to refresh Analytics Lab data
//
// Pulls fresh data from GA4, Search Console, GBP, and paid media.
// Triggers findings generation and writes to Context Graph.

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSnapshot } from '@/lib/analytics/getAnalyticsSnapshot';
import { generateAnalyticsFindings } from '@/lib/os/contextAi/generateAnalyticsFindings';
import { generateAnalyticsNarrative } from '@/lib/os/analyticsAi/generateAnalyticsNarrative';
import { writeAnalyticsFindingsToBrain } from '@/lib/os/analyticsAi/writeAnalyticsFindingsToBrain';
import { writeAnalyticsToContextGraph } from '@/lib/os/analyticsAi/writeAnalyticsToContextGraph';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import type { AnalyticsRange } from '@/lib/types/companyAnalytics';
import type { AnalyticsLabResponse } from '@/lib/analytics/analyticsTypes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { companyId?: string; range?: AnalyticsRange } = {};

  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const companyId = body.companyId;
  const range = body.range || '28d';

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Missing companyId in request body' },
      { status: 400 }
    );
  }

  try {
    console.log('[Analytics Refresh] Starting refresh:', { companyId, range });
    const startTime = Date.now();

    // 1. Fetch fresh snapshot and trends
    const { snapshot, trends } = await getAnalyticsSnapshot({
      companyId,
      range,
      includeTrends: true,
    });

    console.log('[Analytics Refresh] Snapshot fetched:', {
      hasGa4: snapshot.hasGa4,
      hasGsc: snapshot.hasGsc,
      hasMedia: snapshot.hasMedia,
    });

    // 2. Get base analytics snapshot for findings generation
    const baseAnalytics = await getCompanyAnalyticsSnapshot({ companyId, range });

    // 3. Generate findings using AI
    let findings: AnalyticsLabResponse['findings'] = [];
    try {
      const aiFindings = await generateAnalyticsFindings({ analytics: baseAnalytics });
      findings = aiFindings.map((f) => ({
        ...f,
        source: f.source as 'analytics_ai' | 'rule_based',
        severity: f.severity as 'critical' | 'high' | 'medium' | 'low',
      }));
      console.log('[Analytics Refresh] Findings generated:', findings.length);
    } catch (error) {
      console.error('[Analytics Refresh] Error generating findings:', error);
    }

    // 4. Generate AI narrative
    let narrative: AnalyticsLabResponse['narrative'] | undefined;
    try {
      narrative = await generateAnalyticsNarrative({
        snapshot,
        findings,
      });
      console.log('[Analytics Refresh] Narrative generated');
    } catch (error) {
      console.error('[Analytics Refresh] Error generating narrative:', error);
    }

    // 5. Write findings to Brain/diagnostics
    try {
      await writeAnalyticsFindingsToBrain(companyId, findings);
      console.log('[Analytics Refresh] Findings written to Brain');
    } catch (error) {
      console.error('[Analytics Refresh] Error writing findings to Brain:', error);
    }

    // 6. Write analytics nodes to Context Graph
    try {
      await writeAnalyticsToContextGraph(companyId, snapshot);
      console.log('[Analytics Refresh] Context Graph updated');
    } catch (error) {
      console.error('[Analytics Refresh] Error updating Context Graph:', error);
    }

    const elapsed = Date.now() - startTime;
    console.log('[Analytics Refresh] Complete:', {
      companyId,
      elapsed,
      findingsCount: findings.length,
      hasNarrative: !!narrative,
    });

    // Build response
    const response: AnalyticsLabResponse = {
      snapshot,
      trends: trends ?? {
        sessions: [],
        conversions: [],
        organicClicks: [],
        organicImpressions: [],
        gbpActions: [],
        mediaSpend: [],
        cpa: [],
        roas: [],
      },
      narrative,
      findings,
    };

    return NextResponse.json({
      ok: true,
      data: response,
      meta: {
        refreshedAt: new Date().toISOString(),
        durationMs: elapsed,
      },
    });
  } catch (error) {
    console.error('[Analytics Refresh] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to refresh analytics',
      },
      { status: 500 }
    );
  }
}
