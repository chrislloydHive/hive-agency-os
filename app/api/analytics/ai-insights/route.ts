// app/api/os/analytics/ai-insights/route.ts
// API endpoint for generating AI-powered growth insights from analytics data

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { GrowthAnalyticsSnapshot, AIInsights } from '@/lib/analytics/models';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot } = body as { snapshot: GrowthAnalyticsSnapshot };

    if (!snapshot || !snapshot.range || !snapshot.traffic) {
      return NextResponse.json(
        { error: 'Invalid snapshot data provided' },
        { status: 400 }
      );
    }

    console.log('[API /os/analytics/ai-insights] Generating insights for date range:', snapshot.range);

    const insights = await generateAIInsights(snapshot);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[API /os/analytics/ai-insights] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function generateAIInsights(snapshot: GrowthAnalyticsSnapshot): Promise<AIInsights> {
  const systemPrompt = `You are Hive OS – Agency Growth Strategist, an AI assistant analyzing GA4 and Search Console data to identify growth opportunities and prioritize actions.

You will receive analytics data including:
- Traffic metrics (users, sessions, pageviews, bounce rate, engagement)
- Channel breakdown (sessions, conversions by source)
- Top landing pages (sessions, conversions, engagement)
- Search queries (clicks, impressions, CTR, position)
- Top pages in search results

Your task:
1. Identify 3-5 key issues or opportunities based on the data
2. Propose 3-7 prioritized actions to improve performance in the next 30 days
3. Label each action with impact (high/medium/low), effort (high/medium/low), and area (traffic/conversion/content/seo/technical)

Respond ONLY with valid JSON in this exact format:
{
  "summary": "A brief 2-3 sentence overview of the current state and key opportunities",
  "issues": [
    {
      "title": "Issue title",
      "detail": "Detailed explanation",
      "evidence": "Specific data points supporting this"
    }
  ],
  "recommendedActions": [
    {
      "title": "Action title",
      "area": "traffic|conversion|content|seo|technical",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}`;

  const userPrompt = `Analyze this growth analytics snapshot and provide actionable insights:

Date Range: ${snapshot.range.startDate} to ${snapshot.range.endDate}

TRAFFIC SUMMARY:
- Users: ${snapshot.traffic.users ?? 'N/A'}
- Sessions: ${snapshot.traffic.sessions ?? 'N/A'}
- Pageviews: ${snapshot.traffic.pageviews ?? 'N/A'}
- Avg Session Duration: ${snapshot.traffic.avgSessionDurationSeconds ? Math.round(snapshot.traffic.avgSessionDurationSeconds) + 's' : 'N/A'}
- Bounce Rate: ${snapshot.traffic.bounceRate ? (snapshot.traffic.bounceRate * 100).toFixed(1) + '%' : 'N/A'}

TOP CHANNELS (by sessions):
${snapshot.channels.length > 0 ? snapshot.channels.slice(0, 5).map(c =>
  `- ${c.channel}: ${c.sessions} sessions, ${c.users ?? 'N/A'} users, ${c.conversions ?? 0} conversions`
).join('\n') : '- No channel data available'}

TOP LANDING PAGES:
${snapshot.topLandingPages.length > 0 ? snapshot.topLandingPages.slice(0, 10).map(p =>
  `- ${p.path}: ${p.sessions} sessions, ${p.conversions ?? 0} conversions`
).join('\n') : '- No landing page data available'}

TOP SEARCH QUERIES:
${snapshot.searchQueries.length > 0 ? snapshot.searchQueries.slice(0, 10).map(q =>
  `- "${q.query}": ${q.clicks} clicks, ${q.impressions} impressions, ${(q.ctr * 100).toFixed(1)}% CTR, position ${q.position?.toFixed(1) ?? 'N/A'}`
).join('\n') : '- No search query data available'}

TOP SEARCH PAGES:
${snapshot.searchPages.length > 0 ? snapshot.searchPages.slice(0, 10).map(p =>
  `- ${p.url}: ${p.clicks} clicks, ${(p.ctr * 100).toFixed(1)}% CTR, position ${p.position?.toFixed(1) ?? 'N/A'}`
).join('\n') : '- No search page data available'}

${snapshot.notes && snapshot.notes.length > 0 ? `\nNOTES: ${snapshot.notes.join(', ')}` : ''}

Provide your analysis as JSON.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return parsed as AIInsights;
    } catch (parseError) {
      console.error('[AI Insights] Failed to parse JSON, using fallback', parseError);

      // Fallback response
      return {
        summary: responseText.substring(0, 500),
        issues: [],
        recommendedActions: [],
      };
    }
  } catch (error) {
    console.error('[AI Insights] OpenAI API error:', error);
    throw error;
  }
}
