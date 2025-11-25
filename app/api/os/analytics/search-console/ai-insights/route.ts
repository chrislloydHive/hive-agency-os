// app/api/os/analytics/search-console/ai-insights/route.ts
// AI-Powered Search Console Insights API
// Generates strategic SEO insights from GSC snapshot data

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import type {
  SearchConsoleSnapshot,
  SearchConsoleAIInsights,
} from '@/lib/os/searchConsole/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and senior SEO strategist.
You are given a JSON object describing Google Search Console performance for a website (summary metrics, top queries, top pages, top countries, top devices).
Your job is to produce a concise but insightful analysis including:

1. An executive summary (2–3 paragraphs) highlighting the most important findings
2. 3–7 key insights (with evidence: metrics, queries, or pages)
3. 3–7 quick wins (tactical changes we can make now)
4. 1–3 recommended experiments (with hypothesis + success metric)

Speak like you're advising a founder/CMO. Be specific and avoid fluff.

Focus on:
- High-impression, low-CTR opportunities (meta title/description optimization)
- Position 5-20 keywords that could be improved with content updates
- Pages with declining position or missed ranking opportunities
- Mobile vs desktop performance gaps
- Geographic expansion opportunities

You must respond with valid JSON in the exact format specified below. All fields are required.

JSON Response Format:
{
  "summary": "2-3 paragraph executive summary highlighting key findings",
  "headlineMetrics": [
    {
      "label": "Metric name (e.g., 'Total Clicks', 'Avg CTR')",
      "value": "Formatted value (e.g., '12,345', '3.2%')",
      "changeVsPreviousPeriod": "Change vs previous period or null (e.g., '+15.3%', '-8.2%')"
    }
  ],
  "keyInsights": [
    {
      "type": "opportunity" | "warning" | "neutral",
      "title": "Insight title",
      "detail": "Explanation with specific data points",
      "evidence": "Specific metrics, queries, or pages supporting this insight"
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
  ]
}`;

// ============================================================================
// Request Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const snapshot = body.snapshot as SearchConsoleSnapshot;

    // Validate snapshot
    if (!snapshot || !snapshot.summary || !snapshot.topQueries) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid snapshot data',
          hint: 'Provide a valid SearchConsoleSnapshot object with summary and topQueries.',
        },
        { status: 400 }
      );
    }

    console.log('[Search AI Insights API] Generating insights...', {
      siteUrl: snapshot.siteUrl,
      range: snapshot.range,
      queryCount: snapshot.topQueries.length,
    });

    // Build context for AI
    const context = buildSnapshotContext(snapshot);

    // Generate AI insights
    let insights: SearchConsoleAIInsights;

    try {
      const openai = getOpenAI();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this Search Console data and generate strategic SEO insights:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      insights = JSON.parse(responseText) as SearchConsoleAIInsights;

      console.log('[Search AI Insights API] Insights generated successfully');
    } catch (aiError) {
      console.warn(
        '[Search AI Insights API] AI generation failed, using fallback:',
        aiError
      );
      insights = generateFallbackInsights(snapshot);
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      siteUrl: snapshot.siteUrl,
      range: snapshot.range,
      insights,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Search AI Insights API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// Context Builder
// ============================================================================

function buildSnapshotContext(snapshot: SearchConsoleSnapshot): object {
  const { summary, topQueries, topPages, topCountries, topDevices, range, siteUrl } = snapshot;

  // Find opportunities in the data
  const lowCtrHighImpressions = topQueries.filter(
    (q) => q.impressions > 100 && q.ctr < 0.02
  );
  const positionOpportunities = topQueries.filter(
    (q) => q.avgPosition && q.avgPosition > 5 && q.avgPosition < 20 && q.impressions > 50
  );

  return {
    siteUrl,
    dateRange: {
      startDate: range.startDate,
      endDate: range.endDate,
    },
    summary: {
      totalClicks: summary.clicks,
      totalImpressions: summary.impressions,
      avgCtr: summary.ctr,
      avgPosition: summary.avgPosition,
    },
    topQueries: topQueries.slice(0, 20).map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.avgPosition,
    })),
    topPages: topPages.slice(0, 15).map((p) => ({
      url: p.url.replace(/^https?:\/\/[^/]+/, ''), // Remove domain for readability
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.avgPosition,
    })),
    deviceBreakdown: topDevices.map((d) => ({
      device: d.device,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.ctr,
      position: d.avgPosition,
    })),
    topCountries: topCountries.slice(0, 5).map((c) => ({
      country: c.country,
      clicks: c.clicks,
      impressions: c.impressions,
    })),
    detectedOpportunities: {
      lowCtrHighImpressions: lowCtrHighImpressions.slice(0, 5).map((q) => ({
        query: q.query,
        impressions: q.impressions,
        ctr: q.ctr,
      })),
      positionOpportunities: positionOpportunities.slice(0, 5).map((q) => ({
        query: q.query,
        position: q.avgPosition,
        impressions: q.impressions,
      })),
    },
  };
}

// ============================================================================
// Fallback Insights Generator
// ============================================================================

function generateFallbackInsights(
  snapshot: SearchConsoleSnapshot
): SearchConsoleAIInsights {
  const { summary, topQueries, topPages, topDevices } = snapshot;

  // Build headline metrics
  const headlineMetrics = [
    {
      label: 'Total Clicks',
      value: summary.clicks.toLocaleString(),
      changeVsPreviousPeriod: null,
    },
    {
      label: 'Total Impressions',
      value: summary.impressions.toLocaleString(),
      changeVsPreviousPeriod: null,
    },
    {
      label: 'Average CTR',
      value: `${(summary.ctr * 100).toFixed(2)}%`,
      changeVsPreviousPeriod: null,
    },
    {
      label: 'Average Position',
      value: summary.avgPosition?.toFixed(1) || 'N/A',
      changeVsPreviousPeriod: null,
    },
  ];

  // Find opportunities
  const lowCtrQueries = topQueries.filter(
    (q) => q.impressions > 100 && q.ctr < 0.02
  );
  const positionOpportunities = topQueries.filter(
    (q) => q.avgPosition && q.avgPosition > 5 && q.avgPosition < 20
  );

  // Build key insights
  const keyInsights: SearchConsoleAIInsights['keyInsights'] = [];

  if (lowCtrQueries.length > 0) {
    keyInsights.push({
      type: 'opportunity',
      title: 'Low CTR High-Impression Queries',
      detail: `Found ${lowCtrQueries.length} queries with high impressions but low CTR (<2%). Optimizing meta titles and descriptions for these queries could significantly increase traffic.`,
      evidence: `Top opportunity: "${lowCtrQueries[0].query}" has ${lowCtrQueries[0].impressions} impressions but only ${(lowCtrQueries[0].ctr * 100).toFixed(2)}% CTR.`,
    });
  }

  if (positionOpportunities.length > 0) {
    keyInsights.push({
      type: 'opportunity',
      title: 'Position 5-20 Improvement Opportunities',
      detail: `${positionOpportunities.length} queries are ranking between positions 5-20. These are prime candidates for content optimization to reach page 1.`,
      evidence: `Example: "${positionOpportunities[0].query}" at position ${positionOpportunities[0].avgPosition?.toFixed(1)} with ${positionOpportunities[0].impressions} impressions.`,
    });
  }

  // Check device breakdown
  const mobileDevice = topDevices.find((d) => d.device === 'MOBILE');
  const desktopDevice = topDevices.find((d) => d.device === 'DESKTOP');
  if (mobileDevice && desktopDevice && mobileDevice.ctr < desktopDevice.ctr * 0.7) {
    keyInsights.push({
      type: 'warning',
      title: 'Mobile CTR Gap',
      detail: 'Mobile CTR is significantly lower than desktop CTR, which may indicate mobile UX or page speed issues.',
      evidence: `Mobile CTR: ${(mobileDevice.ctr * 100).toFixed(2)}% vs Desktop CTR: ${(desktopDevice.ctr * 100).toFixed(2)}%`,
    });
  }

  // Build quick wins
  const quickWins: string[] = [];

  if (lowCtrQueries.length > 0) {
    quickWins.push(
      `Update meta title and description for pages ranking for "${lowCtrQueries[0].query}" to improve CTR`
    );
  }

  if (positionOpportunities.length > 0) {
    quickWins.push(
      `Add more comprehensive content to pages targeting "${positionOpportunities[0].query}" to improve rankings`
    );
  }

  if (topPages.length > 0) {
    quickWins.push(
      `Audit the top landing page (${topPages[0].url}) for optimization opportunities`
    );
  }

  if (quickWins.length === 0) {
    quickWins.push('Review Search Console for any manual actions or security issues');
    quickWins.push('Ensure all important pages are indexed and mobile-friendly');
  }

  // Build summary
  const summary_text = `Your site received ${summary.clicks.toLocaleString()} clicks from ${summary.impressions.toLocaleString()} impressions during this period, with an average CTR of ${(summary.ctr * 100).toFixed(2)}% and average position of ${summary.avgPosition?.toFixed(1) || 'N/A'}.\n\n${keyInsights.length > 0 ? `Key findings include ${keyInsights.length} insights, with the most notable being opportunities to improve CTR for high-impression queries and optimize content for keywords ranking between positions 5-20.` : 'Continue monitoring your search performance and look for opportunities to improve rankings and CTR.'}`;

  return {
    summary: summary_text,
    headlineMetrics,
    keyInsights,
    quickWins,
    experiments: [
      {
        name: 'Meta Description A/B Test',
        hypothesis:
          'Updating meta descriptions to include more compelling calls-to-action will increase CTR by 20%',
        steps: [
          'Identify top 5 pages by impressions with CTR below average',
          'Rewrite meta descriptions with action-oriented language',
          'Monitor CTR changes over 2-4 weeks',
        ],
        successMetric: 'CTR increase of 20% or more for tested pages',
      },
    ],
  };
}
