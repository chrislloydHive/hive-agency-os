// app/api/os/dma/ai-insights/route.ts
// AI-powered funnel insights for DMA metrics

import { NextRequest, NextResponse } from 'next/server';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

// DMA Funnel Insights response type
export interface DmaFunnelInsights {
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

/**
 * Generate AI-powered funnel insights from DMA metrics
 * POST /api/os/dma/ai-insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const snapshot: AuditFunnelSnapshot = body.snapshot;

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Missing snapshot data' },
        { status: 400 }
      );
    }

    // Generate insights based on the funnel data
    const insights = generateFunnelInsights(snapshot);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[DMA AI Insights] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

/**
 * Generate funnel insights from DMA snapshot
 * This is a rule-based analysis - can be enhanced with actual AI later
 */
function generateFunnelInsights(snapshot: AuditFunnelSnapshot): DmaFunnelInsights {
  const { totals, byChannel, timeSeries } = snapshot;

  // Calculate key metrics
  const completionRate = totals.completionRate;
  const totalStarted = totals.auditsStarted;
  const totalCompleted = totals.auditsCompleted;

  // Find top channel
  const topChannel = byChannel.length > 0
    ? byChannel.reduce((a, b) => a.auditsStarted > b.auditsStarted ? a : b)
    : null;

  // Find best converting channel
  const bestConvertingChannel = byChannel.length > 0
    ? byChannel.filter(c => c.auditsStarted >= 5).reduce((a, b) =>
        a.completionRate > b.completionRate ? a : b, byChannel[0])
    : null;

  // Calculate recent trend (last 7 days vs previous)
  const recentDays = timeSeries.slice(-7);
  const previousDays = timeSeries.slice(-14, -7);
  const recentTotal = recentDays.reduce((sum, d) => sum + d.auditsStarted, 0);
  const previousTotal = previousDays.reduce((sum, d) => sum + d.auditsStarted, 0);
  const trendDirection = previousTotal > 0
    ? ((recentTotal - previousTotal) / previousTotal) * 100
    : 0;

  // Build headline metrics
  const headlineMetrics = [
    {
      label: 'Audits Started',
      value: totalStarted.toLocaleString(),
      trend: trendDirection > 5 ? 'up' as const : trendDirection < -5 ? 'down' as const : 'flat' as const,
    },
    {
      label: 'Completion Rate',
      value: `${(completionRate * 100).toFixed(1)}%`,
      trend: completionRate >= 0.5 ? 'up' as const : 'down' as const,
    },
    {
      label: 'Top Channel',
      value: topChannel?.channel || 'N/A',
    },
  ];

  // Build key insights
  const keyInsights: DmaFunnelInsights['keyInsights'] = [];

  // Completion rate insight
  if (completionRate < 0.3) {
    keyInsights.push({
      title: 'Low completion rate needs attention',
      detail: `Only ${(completionRate * 100).toFixed(1)}% of started audits are being completed. Users may be dropping off due to form length, unclear value prop, or technical issues.`,
      evidence: `${totalStarted} started → ${totalCompleted} completed`,
      type: 'warning',
    });
  } else if (completionRate >= 0.5) {
    keyInsights.push({
      title: 'Strong completion rate',
      detail: `${(completionRate * 100).toFixed(1)}% completion rate is above average for audit tools. The funnel is converting well.`,
      evidence: `${totalStarted} started → ${totalCompleted} completed`,
      type: 'positive',
    });
  }

  // Channel performance insight
  if (bestConvertingChannel && topChannel && bestConvertingChannel.channel !== topChannel.channel) {
    keyInsights.push({
      title: 'Channel efficiency opportunity',
      detail: `${bestConvertingChannel.channel} has the highest conversion rate (${(bestConvertingChannel.completionRate * 100).toFixed(1)}%) but ${topChannel.channel} drives the most volume. Consider investing more in ${bestConvertingChannel.channel}.`,
      evidence: `${bestConvertingChannel.channel}: ${bestConvertingChannel.auditsStarted} started, ${(bestConvertingChannel.completionRate * 100).toFixed(1)}% rate`,
      type: 'neutral',
    });
  }

  // Volume trend insight
  if (trendDirection > 10) {
    keyInsights.push({
      title: 'Traffic is growing',
      detail: `Audit starts are up ${trendDirection.toFixed(0)}% compared to the previous period. Keep momentum with the current marketing mix.`,
      evidence: `Last 7 days: ${recentTotal} audits vs previous: ${previousTotal}`,
      type: 'positive',
    });
  } else if (trendDirection < -10) {
    keyInsights.push({
      title: 'Traffic declining',
      detail: `Audit starts are down ${Math.abs(trendDirection).toFixed(0)}% compared to the previous period. Review traffic sources and marketing campaigns.`,
      evidence: `Last 7 days: ${recentTotal} audits vs previous: ${previousTotal}`,
      type: 'warning',
    });
  }

  // Build quick wins
  const quickWins: string[] = [];

  if (completionRate < 0.4) {
    quickWins.push('Add progress indicator to show users how close they are to completion');
    quickWins.push('Send email reminders to users who abandoned mid-funnel');
  }

  if (topChannel?.channel === 'Organic Search') {
    quickWins.push('Optimize meta descriptions to improve CTR from search results');
  }

  if (topChannel?.channel === 'Direct') {
    quickWins.push('Add UTM parameters to all marketing links to improve attribution');
  }

  if (byChannel.length > 0) {
    const lowPerformingChannels = byChannel.filter(c => c.completionRate < 0.2 && c.auditsStarted >= 3);
    if (lowPerformingChannels.length > 0) {
      quickWins.push(`Investigate drop-off in ${lowPerformingChannels.map(c => c.channel).join(', ')} traffic`);
    }
  }

  // Build experiments
  const experiments: DmaFunnelInsights['experiments'] = [];

  if (completionRate < 0.5) {
    experiments.push({
      name: 'Simplified Form Test',
      hypothesis: 'Reducing form fields will increase completion rate by 20%+',
      successMetric: 'Completion rate > 50%',
    });
  }

  experiments.push({
    name: 'Social Proof Test',
    hypothesis: 'Adding testimonials/logos will increase trust and completion',
    successMetric: '+10% completion rate',
  });

  if (topChannel?.channel !== 'Organic Search') {
    experiments.push({
      name: 'SEO Landing Page',
      hypothesis: 'Creating targeted landing pages will increase organic traffic',
      successMetric: '+25% organic search audits',
    });
  }

  // Build summary
  const summaryParts: string[] = [];

  summaryParts.push(`Your DMA funnel processed ${totalStarted.toLocaleString()} audit starts with a ${(completionRate * 100).toFixed(1)}% completion rate.`);

  if (topChannel) {
    summaryParts.push(`${topChannel.channel} is your top traffic source.`);
  }

  if (keyInsights.some(i => i.type === 'warning')) {
    summaryParts.push('There are some areas that need attention.');
  } else if (keyInsights.some(i => i.type === 'positive')) {
    summaryParts.push('Overall funnel health looks good.');
  }

  return {
    summary: summaryParts.join(' '),
    headlineMetrics,
    keyInsights,
    quickWins: quickWins.slice(0, 4),
    experiments: experiments.slice(0, 3),
  };
}
