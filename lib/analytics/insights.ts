// lib/analytics/insights.ts
// AI-powered analytics insights engine for Hive OS
//
// This module generates insights from the unified CompanyAnalyticsSnapshot
// using the AI Gateway with company memory integration.

import { aiForCompany } from '@/lib/ai-gateway';
import type {
  CompanyAnalyticsSnapshot,
  AnalyticsAiInsights,
  AnalyticsInsight,
  WorkRecommendation,
  AnalyticsExperiment,
  InsightCategory,
  InsightPriority,
  WorkArea,
} from './types';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and senior marketing strategist analyzing a client's complete analytics picture.

You have access to comprehensive data including:
- GA4: traffic, engagement, conversions, device breakdown, traffic sources, top pages
- Search Console: organic search performance, queries, pages, positions
- DMA & GAP-IA Funnels: lead generation tool performance and conversion rates
- Period-over-period comparisons

Your job is to provide actionable, executive-level insights that help the agency serve this client better.

RESPONSE FORMAT:
You must respond with valid JSON matching this exact structure:

{
  "summary": "2-3 sentence executive summary of this client's current analytics state and primary focus areas",
  "healthScore": 0-100,
  "healthStatus": "healthy" | "attention" | "critical",
  "insights": [
    {
      "id": "unique-id",
      "category": "traffic" | "search" | "conversion" | "funnel" | "content" | "technical" | "engagement" | "opportunity" | "risk",
      "priority": "high" | "medium" | "low",
      "title": "Short insight title (max 8 words)",
      "summary": "One sentence summary",
      "detail": "2-3 sentences with specific data points and context",
      "evidence": "The specific metric or data supporting this insight",
      "metric": {
        "name": "Metric name",
        "value": "Formatted value (e.g., '1,234' or '45.2%')",
        "change": -10.5,
        "benchmark": "Optional benchmark or context"
      }
    }
  ],
  "quickWins": [
    "Specific action that can be done this week (one sentence)"
  ],
  "recommendations": [
    {
      "title": "Work item title (action-oriented, max 10 words)",
      "area": "website" | "content" | "seo" | "demand" | "ops" | "brand" | "general",
      "description": "What needs to be done and why (2-3 sentences)",
      "priority": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "reason": "Why this matters for the client (1-2 sentences)",
      "implementationGuide": "Step-by-step guide for implementing this recommendation"
    }
  ],
  "experiments": [
    {
      "name": "Experiment name",
      "hypothesis": "What we're testing and expected outcome",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "successMetric": "How to measure success",
      "expectedImpact": "high" | "medium" | "low",
      "timeframe": "Expected duration (e.g., '2-4 weeks')"
    }
  ],
  "highlights": [
    {
      "metric": "Metric name",
      "value": "Formatted value",
      "trend": "up" | "down" | "flat",
      "context": "Brief context about this metric"
    }
  ]
}

RULES:
1. insights should have 3-6 items, prioritized by importance
2. quickWins should have 2-4 immediately actionable items
3. recommendations should have 3-5 strategic work items
4. experiments should have 1-2 testable hypotheses
5. highlights should have 3-4 key metrics for the dashboard

SCORING GUIDELINES:
- healthScore: Consider traffic trends, conversion rates, funnel performance, and YoY/MoM changes
  - 80-100: Strong growth, good conversion rates, healthy funnels
  - 60-79: Stable with some areas for improvement
  - 40-59: Multiple concerning trends, needs attention
  - 0-39: Critical issues requiring immediate action

- healthStatus:
  - "healthy": healthScore >= 70
  - "attention": healthScore 40-69
  - "critical": healthScore < 40

INSIGHT PRIORITIES:
- "high": Immediate impact or risk, requires action within 1-2 weeks
- "medium": Important but not urgent, plan for next sprint/month
- "low": Nice to have, can be addressed when resources allow

Return ONLY valid JSON, no markdown formatting or code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate AI insights from a company's analytics snapshot
 */
export async function generateAnalyticsInsights(
  companyId: string,
  snapshot: CompanyAnalyticsSnapshot
): Promise<AnalyticsAiInsights> {
  console.log('[AnalyticsInsights] Generating insights for:', snapshot.companyName);

  try {
    // Build task prompt with the snapshot data
    const taskPrompt = buildTaskPrompt(snapshot);

    // Use AI Gateway with company memory
    const result = await aiForCompany(companyId, {
      type: 'Analytics Insight',
      tags: deriveInsightTags(snapshot),
      systemPrompt: SYSTEM_PROMPT,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 6000,
      jsonMode: true,
      memoryOptions: {
        limit: 10,
        types: ['GAP IA', 'GAP Full', 'Analytics Insight', 'Strategy'],
      },
    });

    console.log('[AnalyticsInsights] Response received, memory entry:', result.memoryEntryId);

    // Parse and validate the response
    const insights = parseAndValidateInsights(result.content, snapshot);

    console.log('[AnalyticsInsights] Insights generated:', {
      healthScore: insights.healthScore,
      healthStatus: insights.healthStatus,
      insightsCount: insights.insights.length,
      recommendationsCount: insights.recommendations.length,
      memoryEntriesLoaded: result.loadedMemoryCount,
    });

    return insights;
  } catch (error) {
    console.error('[AnalyticsInsights] Error generating insights:', error);
    return generateFallbackInsights(snapshot);
  }
}

// ============================================================================
// Task Prompt Builder
// ============================================================================

function buildTaskPrompt(snapshot: CompanyAnalyticsSnapshot): string {
  const parts: string[] = [];

  parts.push(`Generate analytics insights for ${snapshot.companyName}:`);
  parts.push('');
  parts.push('=== ANALYTICS SNAPSHOT ===');
  parts.push(`Date Range: ${snapshot.range.startDate} to ${snapshot.range.endDate} (${snapshot.range.preset})`);
  parts.push(`Domain: ${snapshot.domain}`);
  parts.push('');

  // GA4 Data
  if (snapshot.ga4) {
    parts.push('--- GA4 METRICS ---');
    parts.push(`Sessions: ${snapshot.ga4.metrics.sessions.toLocaleString()}`);
    parts.push(`Users: ${snapshot.ga4.metrics.users.toLocaleString()}`);
    parts.push(`New Users: ${snapshot.ga4.metrics.newUsers.toLocaleString()}`);
    parts.push(`Pageviews: ${snapshot.ga4.metrics.pageviews.toLocaleString()}`);
    parts.push(`Bounce Rate: ${(snapshot.ga4.metrics.bounceRate * 100).toFixed(1)}%`);
    parts.push(`Engagement Rate: ${(snapshot.ga4.metrics.engagementRate * 100).toFixed(1)}%`);
    parts.push(`Avg Session Duration: ${Math.round(snapshot.ga4.metrics.avgSessionDuration)}s`);
    parts.push(`Conversions: ${snapshot.ga4.metrics.conversions}`);
    parts.push(`Conversion Rate: ${(snapshot.ga4.metrics.conversionRate * 100).toFixed(2)}%`);
    parts.push('');

    if (snapshot.ga4.trafficSources.length > 0) {
      parts.push('Top Traffic Sources:');
      snapshot.ga4.trafficSources.slice(0, 5).forEach((src) => {
        parts.push(`  - ${src.source}/${src.medium}: ${src.sessions} sessions, ${src.conversions} conversions`);
      });
      parts.push('');
    }

    if (snapshot.ga4.topPages.length > 0) {
      parts.push('Top Pages:');
      snapshot.ga4.topPages.slice(0, 5).forEach((page) => {
        parts.push(`  - ${page.path}: ${page.pageviews} views, ${(page.bounceRate * 100).toFixed(0)}% bounce`);
      });
      parts.push('');
    }

    if (snapshot.ga4.deviceBreakdown.length > 0) {
      parts.push('Device Breakdown:');
      snapshot.ga4.deviceBreakdown.forEach((device) => {
        parts.push(`  - ${device.device}: ${device.sessions} sessions (${(device.conversionRate * 100).toFixed(1)}% CVR)`);
      });
      parts.push('');
    }
  } else {
    parts.push('--- GA4 METRICS ---');
    parts.push('GA4 not connected for this company.');
    parts.push('');
  }

  // Search Console Data
  if (snapshot.searchConsole) {
    parts.push('--- SEARCH CONSOLE ---');
    parts.push(`Clicks: ${snapshot.searchConsole.metrics.clicks.toLocaleString()}`);
    parts.push(`Impressions: ${snapshot.searchConsole.metrics.impressions.toLocaleString()}`);
    parts.push(`CTR: ${(snapshot.searchConsole.metrics.ctr * 100).toFixed(2)}%`);
    parts.push(`Avg Position: ${snapshot.searchConsole.metrics.avgPosition.toFixed(1)}`);
    parts.push('');

    if (snapshot.searchConsole.topQueries.length > 0) {
      parts.push('Top Search Queries:');
      snapshot.searchConsole.topQueries.slice(0, 5).forEach((q) => {
        parts.push(`  - "${q.query}": ${q.clicks} clicks, pos ${q.position.toFixed(1)}`);
      });
      parts.push('');
    }
  } else {
    parts.push('--- SEARCH CONSOLE ---');
    parts.push('Search Console not connected for this company.');
    parts.push('');
  }

  // Funnel Data
  if (snapshot.funnels) {
    parts.push('--- DMA & GAP-IA FUNNELS ---');
    parts.push('DMA Funnel:');
    parts.push(`  - Audits Started: ${snapshot.funnels.metrics.dma.auditsStarted}`);
    parts.push(`  - Audits Completed: ${snapshot.funnels.metrics.dma.auditsCompleted}`);
    parts.push(`  - Completion Rate: ${(snapshot.funnels.metrics.dma.completionRate * 100).toFixed(1)}%`);
    parts.push('');
    parts.push('GAP-IA Funnel:');
    parts.push(`  - Started: ${snapshot.funnels.metrics.gapIa.started}`);
    parts.push(`  - Completed: ${snapshot.funnels.metrics.gapIa.completed}`);
    parts.push(`  - Reports Viewed: ${snapshot.funnels.metrics.gapIa.reportViewed}`);
    parts.push(`  - CTAs Clicked: ${snapshot.funnels.metrics.gapIa.ctaClicked}`);
    parts.push(`  - Start-to-Complete Rate: ${(snapshot.funnels.metrics.gapIa.startToCompleteRate * 100).toFixed(1)}%`);
    parts.push(`  - View-to-CTA Rate: ${(snapshot.funnels.metrics.gapIa.viewToCtaRate * 100).toFixed(1)}%`);
    parts.push('');

    if (snapshot.funnels.bySource.length > 0) {
      parts.push('Funnel Performance by Source:');
      snapshot.funnels.bySource.slice(0, 5).forEach((src) => {
        const totalStarts = src.dmaStarted + src.gapIaStarted;
        parts.push(`  - ${src.source}/${src.medium}: ${totalStarts} starts, ${src.dmaCompleted + src.gapIaCompleted} completes`);
      });
      parts.push('');
    }
  }

  // Comparison Data
  if (snapshot.comparison) {
    parts.push('--- PERIOD COMPARISON ---');
    if (snapshot.comparison.ga4) {
      parts.push('GA4 Changes (vs previous period):');
      parts.push(`  - Sessions: ${formatChange(snapshot.comparison.ga4.sessionsChange)}`);
      parts.push(`  - Users: ${formatChange(snapshot.comparison.ga4.usersChange)}`);
      parts.push(`  - Conversions: ${formatChange(snapshot.comparison.ga4.conversionsChange)}`);
      parts.push(`  - Bounce Rate: ${formatChange(snapshot.comparison.ga4.bounceRateChange)}`);
    }
    if (snapshot.comparison.searchConsole) {
      parts.push('Search Console Changes:');
      parts.push(`  - Clicks: ${formatChange(snapshot.comparison.searchConsole.clicksChange)}`);
      parts.push(`  - Impressions: ${formatChange(snapshot.comparison.searchConsole.impressionsChange)}`);
      parts.push(`  - CTR: ${formatChange(snapshot.comparison.searchConsole.ctrChange)}`);
      parts.push(`  - Position: ${formatChange(snapshot.comparison.searchConsole.positionChange)} (negative is better)`);
    }
    if (snapshot.comparison.funnels) {
      parts.push('Funnel Changes:');
      parts.push(`  - DMA Completion Rate: ${formatChange(snapshot.comparison.funnels.dmaCompletionRateChange)}`);
      parts.push(`  - GAP-IA CTA Rate: ${formatChange(snapshot.comparison.funnels.gapIaCtaRateChange)}`);
    }
    parts.push('');
  }

  parts.push('=== END SNAPSHOT ===');
  parts.push('');
  parts.push('Based on this data, provide strategic insights and recommendations.');

  return parts.join('\n');
}

function formatChange(change: number): string {
  if (change === 0) return '0%';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function deriveInsightTags(snapshot: CompanyAnalyticsSnapshot): string[] {
  const tags: string[] = ['Analytics'];

  if (snapshot.ga4) tags.push('GA4');
  if (snapshot.searchConsole) tags.push('SEO');
  if (snapshot.funnels) tags.push('Funnels');

  // Add risk tag if any concerning metrics
  if (snapshot.comparison?.ga4?.sessionsChange && snapshot.comparison.ga4.sessionsChange < -20) {
    tags.push('Traffic Risk');
  }
  if (snapshot.comparison?.searchConsole?.clicksChange && snapshot.comparison.searchConsole.clicksChange < -20) {
    tags.push('SEO Risk');
  }

  return tags.slice(0, 4);
}

// ============================================================================
// Parsing & Validation
// ============================================================================

function parseAndValidateInsights(
  responseText: string,
  snapshot: CompanyAnalyticsSnapshot
): AnalyticsAiInsights {
  try {
    const parsed = JSON.parse(responseText);

    return {
      generatedAt: new Date().toISOString(),
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Unable to generate summary.',
      healthScore: typeof parsed.healthScore === 'number' ? Math.min(100, Math.max(0, parsed.healthScore)) : 50,
      healthStatus: ['healthy', 'attention', 'critical'].includes(parsed.healthStatus)
        ? parsed.healthStatus
        : 'attention',
      insights: Array.isArray(parsed.insights) ? parsed.insights.map(validateInsight) : [],
      quickWins: Array.isArray(parsed.quickWins)
        ? parsed.quickWins.filter((w: unknown) => typeof w === 'string')
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(validateRecommendation)
        : [],
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments.map(validateExperiment) : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(validateHighlight) : [],
    };
  } catch (parseError) {
    console.error('[AnalyticsInsights] Failed to parse response:', parseError);
    return generateFallbackInsights(snapshot);
  }
}

function validateInsight(item: any): AnalyticsInsight {
  const validCategories: InsightCategory[] = [
    'traffic', 'search', 'conversion', 'funnel', 'content', 'technical', 'engagement', 'opportunity', 'risk',
  ];
  const validPriorities: InsightPriority[] = ['high', 'medium', 'low'];

  return {
    id: String(item.id || `insight-${Math.random().toString(36).substr(2, 9)}`),
    category: validCategories.includes(item.category) ? item.category : 'traffic',
    priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
    title: String(item.title || 'Insight'),
    summary: String(item.summary || ''),
    detail: String(item.detail || ''),
    evidence: typeof item.evidence === 'string' ? item.evidence : undefined,
    metric: item.metric
      ? {
          name: String(item.metric.name || ''),
          value: item.metric.value,
          change: typeof item.metric.change === 'number' ? item.metric.change : undefined,
          benchmark: item.metric.benchmark,
        }
      : undefined,
  };
}

function validateRecommendation(item: any): WorkRecommendation {
  const validAreas: WorkArea[] = ['website', 'content', 'seo', 'demand', 'ops', 'brand', 'general'];
  const validPriorities: InsightPriority[] = ['high', 'medium', 'low'];

  return {
    title: String(item.title || 'Work item'),
    area: validAreas.includes(item.area) ? item.area : 'general',
    description: String(item.description || ''),
    priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
    impact: validPriorities.includes(item.impact) ? item.impact : 'medium',
    effort: validPriorities.includes(item.effort) ? item.effort : 'medium',
    reason: String(item.reason || ''),
    implementationGuide: typeof item.implementationGuide === 'string' ? item.implementationGuide : undefined,
  };
}

function validateExperiment(item: any): AnalyticsExperiment {
  const validImpacts: InsightPriority[] = ['high', 'medium', 'low'];

  return {
    name: String(item.name || 'Experiment'),
    hypothesis: String(item.hypothesis || ''),
    steps: Array.isArray(item.steps) ? item.steps.filter((s: unknown) => typeof s === 'string') : [],
    successMetric: String(item.successMetric || ''),
    expectedImpact: validImpacts.includes(item.expectedImpact) ? item.expectedImpact : 'medium',
    timeframe: typeof item.timeframe === 'string' ? item.timeframe : undefined,
  };
}

function validateHighlight(item: any): AnalyticsAiInsights['highlights'][0] {
  return {
    metric: String(item.metric || ''),
    value: String(item.value || ''),
    trend: ['up', 'down', 'flat'].includes(item.trend) ? item.trend : 'flat',
    context: String(item.context || ''),
  };
}

// ============================================================================
// Fallback Generator
// ============================================================================

function generateFallbackInsights(snapshot: CompanyAnalyticsSnapshot): AnalyticsAiInsights {
  const insights: AnalyticsInsight[] = [];
  const quickWins: string[] = [];
  const recommendations: WorkRecommendation[] = [];
  const highlights: AnalyticsAiInsights['highlights'] = [];
  let healthScore = 50;

  // GA4 insights
  if (snapshot.ga4) {
    const { metrics, topPages, deviceBreakdown } = snapshot.ga4;

    insights.push({
      id: 'traffic-overview',
      category: 'traffic',
      priority: 'medium',
      title: `${metrics.sessions.toLocaleString()} sessions in ${snapshot.range.preset}`,
      summary: `The site received ${metrics.sessions.toLocaleString()} sessions from ${metrics.users.toLocaleString()} users.`,
      detail: `With a ${(metrics.bounceRate * 100).toFixed(1)}% bounce rate and ${(metrics.engagementRate * 100).toFixed(1)}% engagement rate, there's ${metrics.bounceRate > 0.6 ? 'room for improvement' : 'healthy engagement'}.`,
      metric: {
        name: 'Sessions',
        value: metrics.sessions.toLocaleString(),
      },
    });

    highlights.push({
      metric: 'Sessions',
      value: metrics.sessions.toLocaleString(),
      trend: snapshot.comparison?.ga4?.sessionsChange
        ? snapshot.comparison.ga4.sessionsChange > 0 ? 'up' : snapshot.comparison.ga4.sessionsChange < 0 ? 'down' : 'flat'
        : 'flat',
      context: `${snapshot.range.preset} traffic`,
    });

    if (metrics.conversionRate > 0) {
      highlights.push({
        metric: 'Conversion Rate',
        value: `${(metrics.conversionRate * 100).toFixed(2)}%`,
        trend: 'flat',
        context: `${metrics.conversions} total conversions`,
      });
    }

    // Adjust health score based on metrics
    if (metrics.bounceRate < 0.5) healthScore += 10;
    if (metrics.engagementRate > 0.6) healthScore += 10;
    if (metrics.conversions > 0) healthScore += 10;
  } else {
    insights.push({
      id: 'no-ga4',
      category: 'technical',
      priority: 'high',
      title: 'GA4 not configured',
      summary: 'Traffic analytics are unavailable.',
      detail: 'Configure GA4 to get traffic, engagement, and conversion insights.',
    });

    quickWins.push('Connect GA4 to enable traffic analytics');
    healthScore -= 10;
  }

  // Search Console insights
  if (snapshot.searchConsole) {
    const { metrics, topQueries } = snapshot.searchConsole;

    insights.push({
      id: 'search-overview',
      category: 'search',
      priority: 'medium',
      title: `${metrics.clicks.toLocaleString()} search clicks`,
      summary: `Organic search driving ${metrics.clicks.toLocaleString()} clicks from ${metrics.impressions.toLocaleString()} impressions.`,
      detail: `With a ${(metrics.ctr * 100).toFixed(2)}% CTR and average position of ${metrics.avgPosition.toFixed(1)}, ${metrics.ctr < 0.02 ? 'CTR optimization could significantly improve traffic' : 'search performance is solid'}.`,
      metric: {
        name: 'Search CTR',
        value: `${(metrics.ctr * 100).toFixed(2)}%`,
      },
    });

    highlights.push({
      metric: 'Search Clicks',
      value: metrics.clicks.toLocaleString(),
      trend: snapshot.comparison?.searchConsole?.clicksChange
        ? snapshot.comparison.searchConsole.clicksChange > 0 ? 'up' : snapshot.comparison.searchConsole.clicksChange < 0 ? 'down' : 'flat'
        : 'flat',
      context: `Avg position: ${metrics.avgPosition.toFixed(1)}`,
    });

    if (metrics.ctr < 0.02) {
      quickWins.push('Review and optimize meta titles/descriptions to improve CTR');
    }

    // Adjust health score
    if (metrics.ctr > 0.03) healthScore += 5;
    if (metrics.avgPosition < 20) healthScore += 5;
  } else {
    insights.push({
      id: 'no-gsc',
      category: 'technical',
      priority: 'medium',
      title: 'Search Console not configured',
      summary: 'SEO analytics are unavailable.',
      detail: 'Configure Search Console to get keyword and search performance insights.',
    });

    quickWins.push('Connect Search Console to enable SEO analytics');
    healthScore -= 5;
  }

  // Funnel insights
  if (snapshot.funnels) {
    const { dma, gapIa } = snapshot.funnels.metrics;
    const totalStarts = dma.auditsStarted + gapIa.started;
    const totalCompletes = dma.auditsCompleted + gapIa.completed;

    if (totalStarts > 0) {
      insights.push({
        id: 'funnel-overview',
        category: 'funnel',
        priority: 'high',
        title: `${totalCompletes} lead tool completions`,
        summary: `DMA and GAP-IA tools generated ${totalCompletes} completions from ${totalStarts} starts.`,
        detail: `DMA completion rate: ${(dma.completionRate * 100).toFixed(0)}%. GAP-IA start-to-complete: ${(gapIa.startToCompleteRate * 100).toFixed(0)}%, view-to-CTA: ${(gapIa.viewToCtaRate * 100).toFixed(0)}%.`,
        metric: {
          name: 'Tool Completions',
          value: totalCompletes.toString(),
        },
      });

      highlights.push({
        metric: 'DMA Completions',
        value: dma.auditsCompleted.toString(),
        trend: 'flat',
        context: `${(dma.completionRate * 100).toFixed(0)}% completion rate`,
      });

      // Adjust health score for funnel performance
      if (dma.completionRate > 0.5) healthScore += 10;
      if (gapIa.viewToCtaRate > 0.2) healthScore += 5;
    }
  }

  // Comparison insights
  if (snapshot.comparison?.ga4) {
    const { sessionsChange, conversionsChange } = snapshot.comparison.ga4;

    if (sessionsChange < -10) {
      insights.push({
        id: 'traffic-decline',
        category: 'risk',
        priority: 'high',
        title: 'Traffic declining',
        summary: `Sessions down ${Math.abs(sessionsChange).toFixed(1)}% vs previous period.`,
        detail: 'Investigate traffic sources to identify which channels are underperforming and take corrective action.',
        metric: {
          name: 'Sessions Change',
          value: `${sessionsChange.toFixed(1)}%`,
          change: sessionsChange,
        },
      });
      healthScore -= 15;
    } else if (sessionsChange > 10) {
      insights.push({
        id: 'traffic-growth',
        category: 'opportunity',
        priority: 'medium',
        title: 'Traffic growing',
        summary: `Sessions up ${sessionsChange.toFixed(1)}% vs previous period.`,
        detail: 'Traffic growth is positive. Analyze which channels are driving this growth and double down on what\'s working.',
        metric: {
          name: 'Sessions Change',
          value: `+${sessionsChange.toFixed(1)}%`,
          change: sessionsChange,
        },
      });
      healthScore += 10;
    }
  }

  // Cap health score
  healthScore = Math.min(100, Math.max(0, healthScore));

  // Determine health status
  let healthStatus: 'healthy' | 'attention' | 'critical' = 'attention';
  if (healthScore >= 70) healthStatus = 'healthy';
  else if (healthScore < 40) healthStatus = 'critical';

  // Generate summary
  const summaryParts: string[] = [];
  summaryParts.push(`${snapshot.companyName}'s analytics show ${healthStatus === 'healthy' ? 'healthy performance' : healthStatus === 'critical' ? 'areas requiring immediate attention' : 'room for optimization'}.`);

  if (snapshot.ga4) {
    summaryParts.push(`Traffic is at ${snapshot.ga4.metrics.sessions.toLocaleString()} sessions with ${(snapshot.ga4.metrics.engagementRate * 100).toFixed(0)}% engagement.`);
  }

  if (snapshot.funnels && (snapshot.funnels.metrics.dma.auditsStarted > 0 || snapshot.funnels.metrics.gapIa.started > 0)) {
    summaryParts.push(`Lead gen tools are active with ${snapshot.funnels.metrics.dma.auditsCompleted + snapshot.funnels.metrics.gapIa.completed} completions.`);
  }

  // Add default recommendation
  recommendations.push({
    title: 'Review analytics configuration',
    area: 'ops',
    description: 'Ensure all tracking is properly configured to capture the full customer journey.',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    reason: 'Complete data enables better decision making and optimization.',
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summaryParts.join(' '),
    healthScore,
    healthStatus,
    insights,
    quickWins,
    recommendations,
    experiments: [
      {
        name: 'Content Performance Optimization',
        hypothesis: 'Updating underperforming pages will improve engagement metrics.',
        steps: [
          'Identify top 5 pages by traffic with below-average engagement',
          'Review and update content for quality and relevance',
          'Monitor metrics over 4 weeks',
        ],
        successMetric: 'Increase engagement rate by 15%',
        expectedImpact: 'medium',
        timeframe: '4-6 weeks',
      },
    ],
    highlights,
  };
}
