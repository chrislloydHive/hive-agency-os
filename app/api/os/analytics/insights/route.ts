// app/api/os/analytics/insights/route.ts
// AI-Interpreted Analytics Insights API - Layer C
// Uses OpenAI to generate strategic insights from workspace analytics

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import {
  getWorkspaceAnalytics,
  getWorkspaceAnalyticsLast30Days,
} from '@/lib/os/analytics/workspace';
import type { WorkspaceAnalytics } from '@/lib/os/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// System Prompt for AI Analysis
// ============================================================================

const SYSTEM_PROMPT = `You are an expert digital marketing analyst for a marketing agency.
You receive structured analytics data (GA4 traffic, channels, pages, Search Console queries) and must provide actionable strategic insights.

Your analysis should cover:
1. Traffic Health - Is traffic growing? Are engagement metrics healthy?
2. Channel Effectiveness - Which channels are working? Which need attention?
3. SEO Performance - How is organic search performing? What opportunities exist?
4. Content Performance - Which pages drive results? Which underperform?
5. Quick Wins - What can be improved immediately?

RULES:
- Be specific - use actual numbers and percentages from the data
- Prioritize by impact - focus on what will move the needle most
- Be actionable - give specific recommendations, not generic advice
- Be concise - busy executives will read this

Respond with JSON:
{
  "summary": "2-3 sentence executive summary",
  "trafficHealth": {
    "status": "healthy" | "warning" | "critical",
    "headline": "One line summary",
    "details": "2-3 sentences of analysis"
  },
  "channelInsights": [
    {
      "channel": "channel name",
      "status": "strong" | "moderate" | "weak",
      "insight": "What's happening",
      "recommendation": "What to do"
    }
  ],
  "seoOpportunities": [
    {
      "type": "ranking" | "content" | "technical",
      "title": "Opportunity title",
      "detail": "Explanation",
      "impact": "high" | "medium" | "low"
    }
  ],
  "quickWins": [
    {
      "action": "What to do",
      "expectedImpact": "What you'll gain",
      "effort": "low" | "medium"
    }
  ],
  "contentRecommendations": [
    {
      "page": "page path",
      "issue": "What's wrong",
      "recommendation": "How to fix"
    }
  ]
}`;

// ============================================================================
// Types
// ============================================================================

interface AIAnalyticsInsights {
  summary: string;
  trafficHealth: {
    status: 'healthy' | 'warning' | 'critical';
    headline: string;
    details: string;
  };
  channelInsights: Array<{
    channel: string;
    status: 'strong' | 'moderate' | 'weak';
    insight: string;
    recommendation: string;
  }>;
  seoOpportunities: Array<{
    type: 'ranking' | 'content' | 'technical';
    title: string;
    detail: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  quickWins: Array<{
    action: string;
    expectedImpact: string;
    effort: 'low' | 'medium';
  }>;
  contentRecommendations: Array<{
    page: string;
    issue: string;
    recommendation: string;
  }>;
}

// ============================================================================
// Build context for AI
// ============================================================================

function buildAnalyticsContext(analytics: WorkspaceAnalytics): object {
  return {
    period: analytics.period,
    traffic: {
      ...analytics.traffic,
      trend: analytics.trafficTrend,
    },
    channels: analytics.channels.map((c) => ({
      ...c,
      trend: analytics.channelTrends[c.channel],
    })),
    topPages: analytics.topPages.slice(0, 15),
    search: {
      summary: {
        totalClicks: analytics.searchMetrics.totalClicks,
        totalImpressions: analytics.searchMetrics.totalImpressions,
        avgCtr: analytics.searchMetrics.avgCtr,
        avgPosition: analytics.searchMetrics.avgPosition,
      },
      topQueries: analytics.searchMetrics.topQueries.slice(0, 10),
      topPages: analytics.searchMetrics.topPages.slice(0, 10),
      trend: analytics.searchTrend,
    },
    detectedAnomalies: analytics.anomalies,
    existingInsights: analytics.insights,
  };
}

// ============================================================================
// Generate fallback insights
// ============================================================================

function generateFallbackInsights(analytics: WorkspaceAnalytics): AIAnalyticsInsights {
  // Determine traffic health
  let trafficStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (analytics.trafficTrend.percentChange < -15) {
    trafficStatus = 'critical';
  } else if (analytics.trafficTrend.percentChange < -5 || analytics.anomalies.length > 2) {
    trafficStatus = 'warning';
  }

  // Build channel insights
  const channelInsights = analytics.channels.slice(0, 5).map((c) => {
    const totalSessions = analytics.traffic.sessions || 1;
    const share = (c.sessions / totalSessions) * 100;

    let status: 'strong' | 'moderate' | 'weak' = 'moderate';
    if (share > 30) status = 'strong';
    else if (share < 10) status = 'weak';

    return {
      channel: c.channel,
      status,
      insight: `${c.sessions.toLocaleString()} sessions (${share.toFixed(1)}% of total)`,
      recommendation: status === 'weak'
        ? `Consider investing more in ${c.channel}`
        : `Maintain ${c.channel} performance`,
    };
  });

  // Build SEO opportunities from search data
  const seoOpportunities = analytics.searchMetrics.topQueries
    .filter((q) => q.position && q.position > 5 && q.impressions > 100)
    .slice(0, 3)
    .map((q) => ({
      type: 'ranking' as const,
      title: `Improve ranking for "${q.query}"`,
      detail: `Currently at position ${q.position?.toFixed(1)} with ${q.impressions} impressions`,
      impact: q.impressions > 500 ? 'high' as const : 'medium' as const,
    }));

  // Quick wins from anomalies
  const quickWins = analytics.anomalies
    .filter((a) => a.severity === 'high')
    .slice(0, 3)
    .map((a) => ({
      action: a.description,
      expectedImpact: 'Improved engagement metrics',
      effort: 'medium' as const,
    }));

  return {
    summary: `Your site had ${analytics.traffic.sessions?.toLocaleString() || 'N/A'} sessions with ${analytics.trafficTrend.percentChange > 0 ? 'an increase' : 'a decrease'} of ${Math.abs(analytics.trafficTrend.percentChange).toFixed(1)}% vs the previous period. ${analytics.anomalies.length} potential issues were detected.`,
    trafficHealth: {
      status: trafficStatus,
      headline: trafficStatus === 'critical'
        ? 'Traffic needs immediate attention'
        : trafficStatus === 'warning'
        ? 'Some metrics need monitoring'
        : 'Traffic looks healthy',
      details: `${analytics.traffic.sessions?.toLocaleString() || 0} sessions, ${analytics.traffic.users?.toLocaleString() || 0} users, ${((analytics.traffic.bounceRate || 0) * 100).toFixed(1)}% bounce rate.`,
    },
    channelInsights,
    seoOpportunities,
    quickWins,
    contentRecommendations: analytics.topPages
      .filter((p) => p.bounceRate && p.bounceRate > 0.7)
      .slice(0, 3)
      .map((p) => ({
        page: p.path,
        issue: `High bounce rate (${((p.bounceRate || 0) * 100).toFixed(1)}%)`,
        recommendation: 'Review content relevance and page load speed',
      })),
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId') || undefined;

    // Get date range or use default
    const period = searchParams.get('period');
    let analytics: WorkspaceAnalytics;

    if (period === '30d' || !searchParams.get('startDate')) {
      analytics = await getWorkspaceAnalyticsLast30Days(siteId);
    } else {
      const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
      const startDate = searchParams.get('startDate')!;

      analytics = await getWorkspaceAnalytics({
        startDate,
        endDate,
        siteId,
      });
    }

    console.log('[AI Insights API] Generating insights...');

    // Build context for AI
    const context = buildAnalyticsContext(analytics);

    // Try AI-powered insights
    let aiInsights: AIAnalyticsInsights;

    try {
      const openai = getOpenAI();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this analytics data and provide strategic insights:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      aiInsights = JSON.parse(responseText) as AIAnalyticsInsights;

      console.log('[AI Insights API] AI insights generated successfully');
    } catch (aiError) {
      console.warn('[AI Insights API] AI generation failed, using fallback:', aiError);
      aiInsights = generateFallbackInsights(analytics);
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      period: analytics.period,
      insights: aiInsights,
      rawAnalytics: {
        traffic: analytics.traffic,
        trafficTrend: analytics.trafficTrend,
        anomalies: analytics.anomalies,
        basicInsights: analytics.insights,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Insights API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
