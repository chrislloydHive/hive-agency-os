import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

const anthropic = new Anthropic();

interface DmaFunnelInsights {
  summary: string;
  headlineMetrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'flat';
  }>;
  keyInsights: Array<{
    title: string;
    detail: string;
    evidence: string;
    type: 'positive' | 'warning' | 'neutral';
  }>;
  quickWins: string[];
  experiments: Array<{
    name: string;
    hypothesis: string;
    successMetric: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { snapshot } = (await request.json()) as { snapshot: AuditFunnelSnapshot };

    if (!snapshot) {
      return NextResponse.json({ error: 'Missing snapshot data' }, { status: 400 });
    }

    const systemPrompt = `You are a conversion rate optimization expert analyzing a marketing audit funnel.
The funnel is for DigitalMarketingAudit.ai - a free tool where users enter their website URL to get an AI-powered marketing assessment.

The funnel has two key events:
- audit_started: User entered a URL and started the audit
- audit_completed: User finished viewing the full audit results

Your job is to analyze the funnel data and provide actionable insights.`;

    const userPrompt = `Analyze this DMA audit funnel data and provide insights:

DATE RANGE: ${snapshot.range.startDate} to ${snapshot.range.endDate}

TOTALS:
- Audits Started: ${snapshot.totals.auditsStarted}
- Audits Completed: ${snapshot.totals.auditsCompleted}
- Completion Rate: ${(snapshot.totals.completionRate * 100).toFixed(1)}%
- Unique Users: ${snapshot.totals.uniqueUsers ?? 'N/A'}

BY CHANNEL:
${snapshot.byChannel.map(c => `- ${c.channel}: ${c.auditsStarted} started, ${c.auditsCompleted} completed (${(c.completionRate * 100).toFixed(1)}%)`).join('\n')}

BY CAMPAIGN:
${snapshot.byCampaign.length > 0
  ? snapshot.byCampaign.map(c => `- ${c.campaign} (${c.sourceMedium}): ${c.auditsStarted} started, ${c.auditsCompleted} completed (${(c.completionRate * 100).toFixed(1)}%)`).join('\n')
  : 'No campaign data available'}

TOP LANDING PAGES:
${snapshot.byLandingPage.slice(0, 10).map(p => `- ${p.path}: ${p.sessions} sessions, ${p.auditsStarted} started, ${p.auditsCompleted} completed`).join('\n')}

Respond with a JSON object matching this exact structure:
{
  "summary": "2-3 sentence executive summary of funnel performance",
  "headlineMetrics": [
    { "label": "short label", "value": "formatted value", "trend": "up|down|flat" }
  ],
  "keyInsights": [
    {
      "title": "Short insight title",
      "detail": "1-2 sentence explanation",
      "evidence": "Supporting data point",
      "type": "positive|warning|neutral"
    }
  ],
  "quickWins": ["Actionable recommendation 1", "Actionable recommendation 2"],
  "experiments": [
    {
      "name": "Experiment name",
      "hypothesis": "If we do X, we expect Y because Z",
      "successMetric": "What to measure"
    }
  ]
}

Provide 2-3 headline metrics, 3-4 key insights, 2-3 quick wins, and 1-2 experiments.
Focus on actionable insights that could improve completion rate.
Be specific with numbers from the data.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const insights: DmaFunnelInsights = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[DMA AI Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
