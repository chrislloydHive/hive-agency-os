// app/api/os/analytics/ai-insights/route.ts
// AI-Powered Workspace Analytics Insights API
// Generates strategic insights using OpenAI GPT-4o-mini

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import {
  getWorkspaceAnalyticsOverview,
  parseDateRangePreset,
} from '@/lib/os/analytics/overview';
import { createDateRange } from '@/lib/os/analytics/ga4';
import type {
  WorkspaceDateRange,
  DateRangePreset,
  WorkspaceAnalyticsOverview,
  WorkspaceAIInsights,
} from '@/lib/os/analytics/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an expert digital marketing analyst for a growth-focused marketing agency.
You analyze structured analytics data (GA4 traffic, channels, pages, Search Console, funnel metrics) and generate actionable strategic insights.

Your analysis should be:
- Data-driven: Use specific numbers, percentages, and comparisons from the provided data
- Actionable: Provide specific recommendations, not generic advice
- Prioritized: Focus on highest-impact opportunities first
- Concise: Busy executives will read this

You must respond with valid JSON in the exact format specified below. All fields are required.

JSON Response Format:
{
  "summary": "2-3 sentence executive summary highlighting key findings",
  "headlineMetrics": [
    {
      "label": "Metric name (e.g., 'Sessions', 'Bounce Rate')",
      "value": "Formatted value (e.g., '12,345', '45.2%')",
      "changeVsPrevious": "Change vs previous period or null (e.g., '+15.3%', '-8.2%')"
    }
  ],
  "keyIssues": [
    {
      "category": "traffic" | "search" | "funnel" | "conversion" | "other",
      "title": "Issue title",
      "detail": "Explanation with specific data points"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "detail": "How to capitalize with specific actions"
    }
  ],
  "quickWins": [
    "Specific actionable item that can be done this week"
  ],
  "experiments": [
    {
      "name": "Experiment name",
      "hypothesis": "What you're testing and expected outcome",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "successMetric": "How to measure success"
    }
  ],
  "suggestedWorkItems": [
    {
      "title": "Work item title",
      "area": "website" | "content" | "seo" | "demand" | "ops" | "other",
      "description": "Brief description of work needed",
      "priority": "low" | "medium" | "high"
    }
  ]
}`;

// ============================================================================
// Build Context for AI
// ============================================================================

function buildAnalyticsContext(overview: WorkspaceAnalyticsOverview): object {
  const { ga4, gsc, funnel, alerts, range, meta } = overview;

  return {
    dateRange: {
      startDate: range.startDate,
      endDate: range.endDate,
      preset: range.preset,
    },
    integrations: {
      ga4Connected: meta.hasGa4,
      gscConnected: meta.hasGsc,
    },
    traffic: ga4.traffic
      ? {
          sessions: ga4.traffic.sessions,
          users: ga4.traffic.users,
          pageviews: ga4.traffic.pageviews,
          bounceRate: ga4.traffic.bounceRate,
          avgSessionDurationSeconds: ga4.traffic.avgSessionDurationSeconds,
        }
      : null,
    channels: ga4.channels.map((c) => ({
      channel: c.channel,
      sessions: c.sessions,
      users: c.users,
      conversions: c.conversions,
    })),
    topLandingPages: ga4.landingPages.slice(0, 10).map((p) => ({
      path: p.path,
      sessions: p.sessions,
      bounceRate: p.bounceRate,
      conversions: p.conversions,
    })),
    search: {
      topQueries: gsc.queries.slice(0, 15).map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      })),
      topPages: gsc.pages.slice(0, 10).map((p) => ({
        url: p.url,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      })),
    },
    funnel: funnel
      ? funnel.stages.map((s) => ({
          label: s.label,
          value: s.value,
          prevValue: s.prevValue,
          changePercent:
            s.prevValue && s.prevValue > 0
              ? ((s.value - s.prevValue) / s.prevValue) * 100
              : null,
        }))
      : null,
    detectedAlerts: alerts.map((a) => ({
      severity: a.severity,
      category: a.category,
      title: a.title,
      detail: a.detail,
    })),
  };
}

// ============================================================================
// Generate Fallback Insights
// ============================================================================

function generateFallbackInsights(
  overview: WorkspaceAnalyticsOverview
): WorkspaceAIInsights {
  const { ga4, gsc, funnel, alerts } = overview;
  const traffic = ga4.traffic;

  // Build headline metrics
  const headlineMetrics = [];

  if (traffic) {
    headlineMetrics.push({
      label: 'Sessions',
      value: traffic.sessions?.toLocaleString() ?? 'N/A',
      changeVsPrevious: null,
    });
    headlineMetrics.push({
      label: 'Bounce Rate',
      value: traffic.bounceRate
        ? `${(traffic.bounceRate * 100).toFixed(1)}%`
        : 'N/A',
      changeVsPrevious: null,
    });
  }

  if (gsc.queries.length > 0) {
    const totalClicks = gsc.queries.reduce((sum, q) => sum + q.clicks, 0);
    headlineMetrics.push({
      label: 'Search Clicks',
      value: totalClicks.toLocaleString(),
      changeVsPrevious: null,
    });
  }

  // Build key issues from alerts
  const keyIssues = alerts
    .filter((a) => a.severity === 'critical' || a.severity === 'warning')
    .slice(0, 5)
    .map((a) => ({
      category: a.category as 'traffic' | 'search' | 'funnel' | 'conversion' | 'other',
      title: a.title,
      detail: a.detail,
    }));

  // Build opportunities from search data
  const opportunities = gsc.queries
    .filter((q) => q.position && q.position > 5 && q.impressions > 100)
    .slice(0, 3)
    .map((q) => ({
      title: `Improve ranking for "${q.query}"`,
      detail: `Currently at position ${q.position?.toFixed(1)} with ${q.impressions} impressions. Optimizing content could significantly increase clicks.`,
    }));

  // Quick wins
  const quickWins: string[] = [];
  if (traffic?.bounceRate && traffic.bounceRate > 0.6) {
    quickWins.push(
      'Review top landing pages for mobile responsiveness and load speed'
    );
  }
  if (gsc.queries.some((q) => q.ctr && q.ctr < 0.02 && q.impressions > 100)) {
    quickWins.push(
      'Optimize meta titles and descriptions for high-impression, low-CTR pages'
    );
  }
  if (quickWins.length === 0) {
    quickWins.push('Review GA4 goals to ensure conversion tracking is accurate');
  }

  // Summary
  const summary = traffic
    ? `Your site had ${traffic.sessions?.toLocaleString() ?? 'N/A'} sessions with a ${(traffic.bounceRate ?? 0) > 0.5 ? 'concerning' : 'healthy'} bounce rate of ${((traffic.bounceRate ?? 0) * 100).toFixed(1)}%. ${alerts.length} potential issues were detected requiring attention.`
    : 'Analytics data is limited. Please ensure GA4 and GSC integrations are configured properly.';

  return {
    summary,
    headlineMetrics,
    keyIssues,
    opportunities,
    quickWins,
    experiments: [
      {
        name: 'Landing Page CTA Test',
        hypothesis:
          'Adding a more prominent CTA above the fold will increase conversion rate by 10%',
        steps: [
          'Identify top 3 landing pages by traffic',
          'Create variant with prominent CTA button',
          'Run A/B test for 2 weeks',
        ],
        successMetric: 'Conversion rate increase of 10% or more',
      },
    ],
    suggestedWorkItems: alerts.slice(0, 3).map((a) => ({
      title: a.title,
      area: (a.category === 'traffic'
        ? 'website'
        : a.category === 'search'
        ? 'seo'
        : 'other') as 'website' | 'content' | 'seo' | 'demand' | 'ops' | 'other',
      description: a.detail,
      priority:
        a.severity === 'critical'
          ? 'high'
          : a.severity === 'warning'
          ? 'medium'
          : ('low' as 'low' | 'medium' | 'high'),
    })),
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse parameters
    const preset = searchParams.get('preset') as DateRangePreset | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const workspaceId = searchParams.get('workspaceId') || undefined;

    // Build date range
    let range: WorkspaceDateRange;

    if (startDate && endDate) {
      range = {
        startDate,
        endDate,
        preset: '30d',
      };
    } else if (preset) {
      range = createDateRange(parseDateRangePreset(preset));
    } else {
      range = createDateRange('30d');
    }

    console.log('[AI Insights API] Generating insights...', {
      range,
      workspaceId,
    });

    // Fetch analytics overview
    const overview = await getWorkspaceAnalyticsOverview({
      range,
      workspaceId,
      includeFunnel: true,
      includeAlerts: true,
    });

    // Build context for AI
    const context = buildAnalyticsContext(overview);

    // Generate AI insights
    let insights: WorkspaceAIInsights;

    try {
      const openai = getOpenAI();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this analytics data and generate strategic insights:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      insights = JSON.parse(responseText) as WorkspaceAIInsights;

      console.log('[AI Insights API] AI insights generated successfully');
    } catch (aiError) {
      console.warn(
        '[AI Insights API] AI generation failed, using fallback:',
        aiError
      );
      insights = generateFallbackInsights(overview);
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      range: overview.range,
      insights,
      meta: overview.meta,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Insights API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
