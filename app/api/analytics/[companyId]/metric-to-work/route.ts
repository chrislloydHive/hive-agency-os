// app/api/analytics/[companyId]/metric-to-work/route.ts
// API Route: Generate AI work suggestion from an analytics metric
//
// Takes a metric configuration and recent data points, returns
// an AI-generated work suggestion with implementation guide.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import type { AnalyticsMetricConfig, AnalyticsSeriesPoint } from '@/lib/analytics/blueprintTypes';
import type { MetricWorkSuggestion } from '@/lib/types/work';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface MetricToWorkRequest {
  metric: AnalyticsMetricConfig;
  points: AnalyticsSeriesPoint[];
  companyName: string;
  websiteUrl?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json() as MetricToWorkRequest;
    const { metric, points, companyName, websiteUrl } = body;

    // Validate required fields
    if (!metric || !metric.id || !metric.label) {
      return NextResponse.json(
        { ok: false, error: 'Missing required metric configuration' },
        { status: 400 }
      );
    }

    console.log('[Metric to Work] Generating suggestion:', {
      companyId,
      companyName,
      metricId: metric.id,
      metricLabel: metric.label,
      pointsCount: points?.length || 0,
    });

    // Calculate trend from points
    const trend = calculateTrend(points);

    const systemPrompt = `You are a senior digital marketing strategist and implementation specialist at a growth agency.

Given:
- A company's name and website
- An analytics metric configuration
- Recent data points and trend analysis for that metric

You will propose ONE highly actionable work item for the marketing team.

The work item must include:
1. A concise title (6-10 words) that clearly states the action
2. A summary (2-3 sentences) explaining the problem or opportunity
3. A detailed "How to Implement" section with specific, actionable steps
4. An "Expected Impact" description of what improvement to expect

Guidelines:
- Be specific to this company and metric
- Focus on practical, implementable actions
- Include measurable outcomes where possible
- Consider the metric's current trend and performance
- Tailor recommendations to the metric group (${metric.group})

Return ONLY valid JSON in this exact shape:
{
  "title": "string (6-10 words)",
  "summary": "string (2-3 sentences)",
  "howToImplement": "string (detailed markdown with numbered steps)",
  "expectedImpact": "string (1-2 sentences)"
}`;

    const userPrompt = `Company: ${companyName}
Website: ${websiteUrl || 'Not provided'}

Metric Details:
- ID: ${metric.id}
- Label: ${metric.label}
- Description: ${metric.description || 'Not provided'}
- Group: ${metric.group}
- Source: ${metric.source}
- Chart Type: ${metric.chartType}
- Target Direction: ${metric.targetDirection} (${metric.targetDirection === 'up' ? 'higher is better' : 'lower is better'})

Recent Data Analysis:
- Data Points: ${points?.length || 0} observations
- Trend: ${trend.direction} (${trend.changePercent.toFixed(1)}% change)
- Current Value: ${trend.currentValue?.toFixed(2) || 'N/A'}
- Previous Value: ${trend.previousValue?.toFixed(2) || 'N/A'}

${points && points.length > 0 ? `Recent Data (most recent last):
${points.slice(-10).map((p) => {
  const label = p.date ?? p.label ?? 'N/A';
  return `- ${label}: ${p.value.toLocaleString()}`;
}).join('\n')}` : 'No recent data available.'}

Based on this metric and its recent performance, propose one specific work item that would help improve this metric for ${companyName}.`;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const rawContent = response.choices[0]?.message?.content || '{}';

    let suggestion: MetricWorkSuggestion;
    try {
      suggestion = JSON.parse(rawContent);
    } catch {
      console.error('[Metric to Work] Failed to parse AI response:', rawContent);
      return NextResponse.json(
        { ok: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate suggestion has required fields
    if (!suggestion.title || !suggestion.summary || !suggestion.howToImplement) {
      console.error('[Metric to Work] Invalid suggestion structure:', suggestion);
      return NextResponse.json(
        { ok: false, error: 'AI response missing required fields' },
        { status: 500 }
      );
    }

    console.log('[Metric to Work] Suggestion generated:', {
      title: suggestion.title,
      summaryLength: suggestion.summary.length,
      howToImplementLength: suggestion.howToImplement.length,
    });

    return NextResponse.json({
      ok: true,
      suggestion,
    });
  } catch (error) {
    console.error('[Metric to Work] Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate trend from data points
 */
function calculateTrend(points: AnalyticsSeriesPoint[] | undefined): {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  currentValue?: number;
  previousValue?: number;
} {
  if (!points || points.length < 2) {
    return {
      direction: 'stable',
      changePercent: 0,
      currentValue: points?.[0]?.value,
    };
  }

  // Calculate current and previous period values
  const midpoint = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, midpoint);
  const secondHalf = points.slice(midpoint);

  const previousValue = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const currentValue = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  const changePercent = previousValue > 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : 0;

  let direction: 'up' | 'down' | 'stable';
  if (changePercent > 5) {
    direction = 'up';
  } else if (changePercent < -5) {
    direction = 'down';
  } else {
    direction = 'stable';
  }

  return {
    direction,
    changePercent,
    currentValue,
    previousValue,
  };
}
