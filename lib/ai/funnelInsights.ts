// lib/ai/funnelInsights.ts
// Unified Funnel AI Insights Generator
// Provides AI-powered analysis for DMA, Company, and Workspace funnels

import Anthropic from '@anthropic-ai/sdk';
import type { FunnelDataset, FunnelStageId } from '@/lib/os/analytics/funnelTypes';

// ============================================================================
// Types
// ============================================================================

export interface FunnelInsightMetric {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface FunnelKeyInsight {
  title: string;
  detail: string;
  evidence: string;
  type: 'positive' | 'warning' | 'neutral';
}

export interface FunnelExperiment {
  name: string;
  hypothesis: string;
  successMetric: string;
  expectedLift?: number;
}

export interface FunnelInsights {
  summary: string;
  headlineMetrics: FunnelInsightMetric[];
  keyInsights: FunnelKeyInsight[];
  quickWins: string[];
  experiments: FunnelExperiment[];
  generatedAt: string;
}

export type FunnelInsightsContext = 'dma' | 'company' | 'workspace';

// ============================================================================
// Context-Specific System Prompts
// ============================================================================

const SYSTEM_PROMPTS: Record<FunnelInsightsContext, string> = {
  dma: `You are a conversion rate optimization expert analyzing a marketing audit funnel.
The funnel is for DigitalMarketingAudit.ai - a free tool where users enter their website URL to get an AI-powered marketing assessment.

The funnel has key stages:
- audit_started: User entered a URL and started the audit
- audit_completed: User finished viewing the full audit results

Your job is to analyze the funnel data and provide actionable insights to improve conversion.
Focus on specific, data-driven recommendations.`,

  company: `You are a growth strategist analyzing a company's marketing and sales funnel.
This funnel shows how prospects move from initial awareness through to becoming customers.

Funnel stages may include:
- Sessions: Website visits
- Audits: Marketing assessments completed
- Leads: Contact information captured
- Opportunities: Qualified sales prospects
- Deals: Closed business

Your job is to identify conversion bottlenecks and growth opportunities.
Consider industry benchmarks and provide specific, actionable recommendations.`,

  workspace: `You are the chief growth officer analyzing agency-wide funnel performance.
This funnel aggregates data across all client accounts and your agency's own marketing.

The workspace funnel typically includes:
- Sessions: Total website traffic
- DMA Audits: Free audit tool usage
- Leads: Captured contact information
- GAP Assessments: Detailed marketing assessments
- GAP Plans: Strategic planning deliverables

Your job is to identify patterns, opportunities, and areas needing attention.
Consider both individual channel performance and overall funnel health.`,
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate AI insights for a funnel dataset
 */
export async function generateFunnelInsights(
  dataset: FunnelDataset,
  options?: {
    companyName?: string;
    additionalContext?: string;
  }
): Promise<FunnelInsights> {
  const anthropic = new Anthropic();
  const context = dataset.context;
  const systemPrompt = SYSTEM_PROMPTS[context];

  // Build the data summary for the prompt
  const dataSummary = buildDataSummary(dataset, options);

  const userPrompt = `Analyze this funnel data and provide insights:

${dataSummary}

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
      "successMetric": "What to measure",
      "expectedLift": 15
    }
  ]
}

Provide:
- 2-3 headline metrics with trends if comparison data available
- 3-4 key insights (mix of positive, warning, and neutral)
- 2-3 quick wins that can be implemented immediately
- 1-2 experiments to test

Be specific with numbers from the data. Focus on actionable insights.`;

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
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  const insights: Omit<FunnelInsights, 'generatedAt'> = JSON.parse(jsonMatch[0]);

  return {
    ...insights,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a text summary of the funnel data for the AI prompt
 */
function buildDataSummary(
  dataset: FunnelDataset,
  options?: { companyName?: string; additionalContext?: string }
): string {
  const lines: string[] = [];

  // Context header
  if (options?.companyName) {
    lines.push(`COMPANY: ${options.companyName}`);
  }
  lines.push(
    `CONTEXT: ${dataset.context.charAt(0).toUpperCase() + dataset.context.slice(1)} Funnel`
  );
  lines.push(`DATE RANGE: ${dataset.range.startDate} to ${dataset.range.endDate}`);
  lines.push('');

  // Summary metrics
  lines.push('SUMMARY:');
  lines.push(`- Total Sessions/Entries: ${dataset.summary.totalSessions.toLocaleString()}`);
  lines.push(`- Total Conversions: ${dataset.summary.totalConversions.toLocaleString()}`);
  lines.push(
    `- Overall Conversion Rate: ${(dataset.summary.overallConversionRate * 100).toFixed(1)}%`
  );
  if (dataset.summary.topChannel) {
    lines.push(`- Top Channel: ${dataset.summary.topChannel}`);
  }
  if (dataset.summary.periodChange !== null) {
    lines.push(
      `- Period Change: ${dataset.summary.periodChange >= 0 ? '+' : ''}${dataset.summary.periodChange.toFixed(1)}%`
    );
  }
  lines.push('');

  // Funnel stages
  lines.push('FUNNEL STAGES:');
  for (let i = 0; i < dataset.stages.length; i++) {
    const stage = dataset.stages[i];
    let stageInfo = `- ${stage.label}: ${stage.value.toLocaleString()}`;

    // Add previous period comparison
    if (stage.prevValue !== null) {
      const change = ((stage.value - stage.prevValue) / stage.prevValue) * 100;
      stageInfo += ` (${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs prev)`;
    }

    // Add conversion from previous stage
    if (i > 0 && dataset.stages[i - 1].value > 0) {
      const convRate = (stage.value / dataset.stages[i - 1].value) * 100;
      stageInfo += ` [${convRate.toFixed(1)}% from prev stage]`;
    }

    lines.push(stageInfo);
  }
  lines.push('');

  // Channel breakdown
  if (dataset.channels.length > 0) {
    lines.push('BY CHANNEL:');
    for (const ch of dataset.channels.slice(0, 10)) {
      lines.push(
        `- ${ch.channel}: ${ch.sessions} sessions, ${ch.conversions} conversions (${(ch.conversionRate * 100).toFixed(1)}%)`
      );
    }
    lines.push('');
  }

  // Campaign breakdown
  if (dataset.campaigns.length > 0) {
    lines.push('BY CAMPAIGN:');
    for (const c of dataset.campaigns.slice(0, 10)) {
      lines.push(
        `- ${c.campaign} (${c.sourceMedium}): ${c.sessions} sessions, ${c.conversions} conversions (${(c.conversionRate * 100).toFixed(1)}%)`
      );
    }
    lines.push('');
  }

  // Time series trends (if available)
  if (dataset.timeSeries.length > 0) {
    lines.push('DAILY TREND (last 7 days):');
    const recentDays = dataset.timeSeries.slice(-7);
    for (const day of recentDays) {
      const mainStages = Object.entries(day.values)
        .filter(([key, val]) => val > 0 && key !== 'custom')
        .map(([key, val]) => `${formatStageLabel(key as FunnelStageId)}: ${val}`)
        .join(', ');
      if (mainStages) {
        lines.push(`- ${day.date}: ${mainStages}`);
      }
    }
    lines.push('');
  }

  // Additional context
  if (options?.additionalContext) {
    lines.push('ADDITIONAL CONTEXT:');
    lines.push(options.additionalContext);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format stage ID to readable label
 */
function formatStageLabel(stageId: FunnelStageId): string {
  const labels: Record<FunnelStageId, string> = {
    sessions: 'Sessions',
    audits_started: 'Started',
    audits_completed: 'Completed',
    leads: 'Leads',
    gap_assessments: 'Assessments',
    gap_plans: 'Plans',
    custom: 'Custom',
  };
  return labels[stageId] || stageId;
}

// ============================================================================
// Quick Insights (lightweight, no AI call)
// ============================================================================

/**
 * Generate quick rule-based insights without AI
 * Useful for instant feedback while waiting for AI insights
 */
export function generateQuickInsights(dataset: FunnelDataset): FunnelKeyInsight[] {
  const insights: FunnelKeyInsight[] = [];

  // Check overall conversion rate
  if (dataset.summary.overallConversionRate < 0.02) {
    insights.push({
      title: 'Low Overall Conversion',
      detail: `Only ${(dataset.summary.overallConversionRate * 100).toFixed(1)}% of sessions convert.`,
      evidence: `${dataset.summary.totalConversions} of ${dataset.summary.totalSessions} sessions`,
      type: 'warning',
    });
  } else if (dataset.summary.overallConversionRate > 0.1) {
    insights.push({
      title: 'Strong Conversion Rate',
      detail: `Converting ${(dataset.summary.overallConversionRate * 100).toFixed(1)}% of sessions.`,
      evidence: `${dataset.summary.totalConversions} conversions`,
      type: 'positive',
    });
  }

  // Check for period decline
  if (dataset.summary.periodChange !== null && dataset.summary.periodChange < -20) {
    insights.push({
      title: 'Significant Decline',
      detail: `Performance down ${Math.abs(dataset.summary.periodChange).toFixed(0)}% vs previous period.`,
      evidence: 'Compare with prior period to investigate cause',
      type: 'warning',
    });
  }

  // Check for underperforming channels
  const underperformingChannels = dataset.channels.filter(
    (ch) => ch.sessions >= 20 && ch.conversionRate < 0.1
  );
  if (underperformingChannels.length > 0) {
    insights.push({
      title: 'Underperforming Channels',
      detail: `${underperformingChannels.length} channel(s) with significant traffic but low conversion.`,
      evidence: underperformingChannels
        .slice(0, 2)
        .map((ch) => ch.channel)
        .join(', '),
      type: 'neutral',
    });
  }

  // Check for top performer
  if (dataset.channels.length > 0) {
    const topChannel = dataset.channels[0];
    if (topChannel.conversionRate > 0.3) {
      insights.push({
        title: 'Top Performing Channel',
        detail: `${topChannel.channel} converting at ${(topChannel.conversionRate * 100).toFixed(0)}%.`,
        evidence: `${topChannel.conversions} conversions from ${topChannel.sessions} sessions`,
        type: 'positive',
      });
    }
  }

  return insights.slice(0, 4); // Return max 4 quick insights
}
