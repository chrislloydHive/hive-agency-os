// lib/os/analytics/workspace.ts
// Workspace-Level Analytics Engine
// Aggregates GA4 and GSC data into a unified workspace analytics view

import { getGa4AnalyticsSnapshot } from '@/lib/analytics/ga4Analytics';
import { getSearchConsoleSnapshot } from '@/lib/analytics/searchConsoleAnalytics';
import type {
  TrafficSummary,
  ChannelSummary,
  LandingPageSummary,
  SearchQuerySummary,
  SearchPageSummary,
} from '@/lib/analytics/models';
import type {
  WorkspaceAnalytics,
  TrafficMetrics,
  ChannelMetrics,
  PageMetrics,
  SearchMetrics,
  MetricTrend,
  AnalyticsAnomaly,
  AnalyticsInsight,
} from '@/lib/os/types';

// ============================================================================
// Configuration
// ============================================================================

const ANOMALY_THRESHOLDS = {
  bounceRate: { high: 0.75, medium: 0.65 },
  sessionDuration: { low: 30, medium: 60 }, // seconds
  trafficDrop: { high: -30, medium: -15 }, // percent
  trafficSpike: { high: 50, medium: 25 }, // percent
  ctrLow: { high: 0.01, medium: 0.02 }, // 1%, 2%
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateTrend(
  current: number | null,
  previous: number | null
): MetricTrend {
  if (current === null || previous === null || previous === 0) {
    return {
      direction: 'stable',
      percentChange: 0,
      previousValue: previous,
      currentValue: current,
    };
  }

  const percentChange = ((current - previous) / previous) * 100;

  let direction: MetricTrend['direction'] = 'stable';
  if (percentChange > 5) direction = 'up';
  else if (percentChange < -5) direction = 'down';

  return {
    direction,
    percentChange: Math.round(percentChange * 10) / 10,
    previousValue: previous,
    currentValue: current,
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Data Transformation
// ============================================================================

function transformTrafficToMetrics(traffic: TrafficSummary): TrafficMetrics {
  return {
    users: traffic.users,
    sessions: traffic.sessions,
    pageviews: traffic.pageviews,
    avgSessionDuration: traffic.avgSessionDurationSeconds,
    bounceRate: traffic.bounceRate,
    newUserRate: null,
  };
}

function transformChannelsToMetrics(channels: ChannelSummary[]): ChannelMetrics[] {
  return channels.map((c) => ({
    channel: c.channel,
    sessions: c.sessions,
    users: c.users ?? 0,
    conversions: c.conversions,
    conversionRate: c.sessions > 0 && c.conversions !== null
      ? c.conversions / c.sessions
      : null,
  }));
}

function transformPagesToMetrics(pages: LandingPageSummary[]): PageMetrics[] {
  return pages.map((p) => ({
    path: p.path,
    sessions: p.sessions,
    users: p.users ?? 0,
    avgEngagementTime: p.avgEngagementTimeSeconds,
    bounceRate: null,
    conversions: p.conversions,
  }));
}

function transformSearchData(
  queries: SearchQuerySummary[],
  pages: SearchPageSummary[]
): SearchMetrics {
  // Calculate totals from query data
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  // Calculate weighted average position
  const totalClicksForPosition = queries.reduce((sum, q) => sum + q.clicks, 0);
  const avgPosition = totalClicksForPosition > 0
    ? queries.reduce((sum, q) => sum + (q.position || 0) * q.clicks, 0) / totalClicksForPosition
    : 0;

  return {
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
    topQueries: queries.slice(0, 20),
    topPages: pages.slice(0, 20).map((p) => ({
      url: p.url,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position,
    })),
  };
}

// ============================================================================
// Anomaly Detection
// ============================================================================

function detectAnomalies(
  traffic: TrafficMetrics,
  trafficTrend: MetricTrend,
  searchMetrics: SearchMetrics | null
): AnalyticsAnomaly[] {
  const anomalies: AnalyticsAnomaly[] = [];

  // High bounce rate
  if (traffic.bounceRate !== null) {
    if (traffic.bounceRate > ANOMALY_THRESHOLDS.bounceRate.high) {
      anomalies.push({
        id: generateId(),
        type: 'threshold-breach',
        metric: 'bounceRate',
        severity: 'high',
        description: `Bounce rate is critically high at ${(traffic.bounceRate * 100).toFixed(1)}%`,
        detectedAt: new Date().toISOString(),
        value: traffic.bounceRate,
        expectedValue: 0.5,
        percentDeviation: ((traffic.bounceRate - 0.5) / 0.5) * 100,
      });
    } else if (traffic.bounceRate > ANOMALY_THRESHOLDS.bounceRate.medium) {
      anomalies.push({
        id: generateId(),
        type: 'threshold-breach',
        metric: 'bounceRate',
        severity: 'medium',
        description: `Bounce rate elevated at ${(traffic.bounceRate * 100).toFixed(1)}%`,
        detectedAt: new Date().toISOString(),
        value: traffic.bounceRate,
        expectedValue: 0.5,
        percentDeviation: ((traffic.bounceRate - 0.5) / 0.5) * 100,
      });
    }
  }

  // Low session duration
  if (traffic.avgSessionDuration !== null) {
    if (traffic.avgSessionDuration < ANOMALY_THRESHOLDS.sessionDuration.low) {
      anomalies.push({
        id: generateId(),
        type: 'threshold-breach',
        metric: 'avgSessionDuration',
        severity: 'high',
        description: `Very low engagement - avg session only ${traffic.avgSessionDuration}s`,
        detectedAt: new Date().toISOString(),
        value: traffic.avgSessionDuration,
        expectedValue: 120,
        percentDeviation: ((traffic.avgSessionDuration - 120) / 120) * 100,
      });
    } else if (traffic.avgSessionDuration < ANOMALY_THRESHOLDS.sessionDuration.medium) {
      anomalies.push({
        id: generateId(),
        type: 'threshold-breach',
        metric: 'avgSessionDuration',
        severity: 'medium',
        description: `Low engagement - avg session ${traffic.avgSessionDuration}s`,
        detectedAt: new Date().toISOString(),
        value: traffic.avgSessionDuration,
        expectedValue: 120,
        percentDeviation: ((traffic.avgSessionDuration - 120) / 120) * 100,
      });
    }
  }

  // Traffic drop
  if (trafficTrend.percentChange < ANOMALY_THRESHOLDS.trafficDrop.high) {
    anomalies.push({
      id: generateId(),
      type: 'drop',
      metric: 'sessions',
      severity: 'high',
      description: `Traffic dropped ${Math.abs(trafficTrend.percentChange).toFixed(1)}% vs previous period`,
      detectedAt: new Date().toISOString(),
      value: trafficTrend.currentValue || 0,
      expectedValue: trafficTrend.previousValue || 0,
      percentDeviation: trafficTrend.percentChange,
    });
  } else if (trafficTrend.percentChange < ANOMALY_THRESHOLDS.trafficDrop.medium) {
    anomalies.push({
      id: generateId(),
      type: 'drop',
      metric: 'sessions',
      severity: 'medium',
      description: `Traffic down ${Math.abs(trafficTrend.percentChange).toFixed(1)}% vs previous period`,
      detectedAt: new Date().toISOString(),
      value: trafficTrend.currentValue || 0,
      expectedValue: trafficTrend.previousValue || 0,
      percentDeviation: trafficTrend.percentChange,
    });
  }

  // Traffic spike (could be good or suspicious)
  if (trafficTrend.percentChange > ANOMALY_THRESHOLDS.trafficSpike.high) {
    anomalies.push({
      id: generateId(),
      type: 'spike',
      metric: 'sessions',
      severity: 'medium',
      description: `Unusual traffic spike: +${trafficTrend.percentChange.toFixed(1)}% vs previous period`,
      detectedAt: new Date().toISOString(),
      value: trafficTrend.currentValue || 0,
      expectedValue: trafficTrend.previousValue || 0,
      percentDeviation: trafficTrend.percentChange,
    });
  }

  // Low CTR from search
  if (searchMetrics && searchMetrics.avgCtr < ANOMALY_THRESHOLDS.ctrLow.high) {
    anomalies.push({
      id: generateId(),
      type: 'threshold-breach',
      metric: 'searchCtr',
      severity: 'high',
      description: `Search CTR is very low at ${(searchMetrics.avgCtr * 100).toFixed(2)}%`,
      detectedAt: new Date().toISOString(),
      value: searchMetrics.avgCtr,
      expectedValue: 0.03,
      percentDeviation: ((searchMetrics.avgCtr - 0.03) / 0.03) * 100,
    });
  }

  return anomalies;
}

// ============================================================================
// Insight Generation
// ============================================================================

function generateInsights(
  traffic: TrafficMetrics,
  channels: ChannelMetrics[],
  pages: PageMetrics[],
  searchMetrics: SearchMetrics | null,
  anomalies: AnalyticsAnomaly[]
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  // Channel performance insights
  if (channels.length > 0) {
    const topChannel = channels.reduce(
      (max, c) => (c.sessions > (max?.sessions || 0) ? c : max),
      channels[0]
    );
    if (topChannel) {
      insights.push({
        id: generateId(),
        title: `${topChannel.channel} is your top traffic source`,
        description: `${topChannel.channel} drives ${topChannel.sessions.toLocaleString()} sessions (${((topChannel.sessions / (traffic.sessions || 1)) * 100).toFixed(1)}% of total)`,
        area: 'traffic',
        impact: 'medium',
        recommendation: `Consider investing more in ${topChannel.channel} channel to grow further.`,
      });
    }
  }

  // Weak channel opportunities
  const organicChannel = channels.find(
    (c) => c.channel.toLowerCase().includes('organic')
  );
  if (organicChannel && traffic.sessions) {
    const organicShare = (organicChannel.sessions / traffic.sessions) * 100;
    if (organicShare < 30) {
      insights.push({
        id: generateId(),
        title: 'Organic search underperforming',
        description: `Organic search only drives ${organicShare.toFixed(1)}% of traffic`,
        area: 'seo',
        impact: 'high',
        recommendation: 'Focus on SEO improvements to reduce dependence on paid channels.',
      });
    }
  }

  // Landing page insights
  const highBouncePage = pages.find(
    (p) => p.bounceRate !== null && p.bounceRate > 0.7 && p.sessions > 100
  );
  if (highBouncePage) {
    insights.push({
      id: generateId(),
      title: 'High-traffic page with poor engagement',
      description: `${highBouncePage.path} has ${(highBouncePage.bounceRate! * 100).toFixed(1)}% bounce rate with ${highBouncePage.sessions} sessions`,
      area: 'content',
      impact: 'high',
      recommendation: 'Review page content, loading speed, and relevance to user intent.',
    });
  }

  // Search performance insights
  if (searchMetrics && searchMetrics.topQueries.length > 0) {
    const topQuery = searchMetrics.topQueries[0];
    if (topQuery.position && topQuery.position > 10) {
      insights.push({
        id: generateId(),
        title: 'Top query not ranking well',
        description: `"${topQuery.query}" gets ${topQuery.impressions.toLocaleString()} impressions but ranks at position ${topQuery.position.toFixed(1)}`,
        area: 'seo',
        impact: 'high',
        recommendation: 'Optimize content for this query to improve rankings and capture more clicks.',
      });
    }
  }

  // Conversion insights
  const channelsWithConversions = channels.filter(
    (c) => c.conversions !== null && c.conversions > 0
  );
  if (channelsWithConversions.length > 0) {
    const bestConverter = channelsWithConversions.reduce((max, c) =>
      (c.conversionRate || 0) > (max.conversionRate || 0) ? c : max
    );
    if (bestConverter.conversionRate && bestConverter.conversionRate > 0.02) {
      insights.push({
        id: generateId(),
        title: `${bestConverter.channel} converts best`,
        description: `${(bestConverter.conversionRate * 100).toFixed(2)}% conversion rate with ${bestConverter.conversions} conversions`,
        area: 'conversion',
        impact: 'medium',
        recommendation: `Focus acquisition efforts on ${bestConverter.channel} for better ROI.`,
      });
    }
  }

  // Add insights for any high-severity anomalies
  for (const anomaly of anomalies.filter((a) => a.severity === 'high')) {
    insights.push({
      id: generateId(),
      title: `Action needed: ${anomaly.description}`,
      description: `Detected ${anomaly.type} in ${anomaly.metric}`,
      area: anomaly.metric.includes('search') ? 'seo' : 'traffic',
      impact: 'high',
      linkedAnomaly: anomaly.id,
    });
  }

  return insights;
}

// ============================================================================
// Main Function
// ============================================================================

export interface GetWorkspaceAnalyticsOptions {
  startDate: string;
  endDate: string;
  siteId?: string;
  includePreviousPeriod?: boolean;
}

export async function getWorkspaceAnalytics(
  options: GetWorkspaceAnalyticsOptions
): Promise<WorkspaceAnalytics> {
  const { startDate, endDate, siteId, includePreviousPeriod = true } = options;

  console.log('[Workspace Analytics] Fetching data...', { startDate, endDate, siteId });

  // Calculate previous period dates for comparison
  const currentStart = new Date(startDate);
  const currentEnd = new Date(endDate);
  const periodDays = Math.ceil(
    (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - periodDays);

  // Fetch current period data in parallel
  const [ga4Data, gscData] = await Promise.all([
    getGa4AnalyticsSnapshot(startDate, endDate, siteId).catch((error) => {
      console.warn('[Workspace Analytics] GA4 fetch failed:', error);
      return {
        traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
        channels: [],
        topLandingPages: [],
      };
    }),
    getSearchConsoleSnapshot(startDate, endDate, siteId).catch((error) => {
      console.warn('[Workspace Analytics] GSC fetch failed:', error);
      return { queries: [], pages: [] };
    }),
  ]);

  // Fetch previous period for trends
  let previousGa4Data: { traffic: TrafficSummary } | null = null;
  if (includePreviousPeriod) {
    try {
      const prevData = await getGa4AnalyticsSnapshot(
        previousStart.toISOString().split('T')[0],
        previousEnd.toISOString().split('T')[0],
        siteId
      );
      previousGa4Data = prevData;
    } catch {
      // Ignore - previous period data is optional
    }
  }

  // Transform data to OS types
  const traffic = transformTrafficToMetrics(ga4Data.traffic);
  const channels = transformChannelsToMetrics(ga4Data.channels);
  const topPages = transformPagesToMetrics(ga4Data.topLandingPages);
  const searchMetrics = gscData.queries.length > 0 || gscData.pages.length > 0
    ? transformSearchData(gscData.queries, gscData.pages)
    : null;

  // Calculate traffic trend
  const trafficTrend = calculateTrend(
    traffic.sessions,
    previousGa4Data?.traffic.sessions ?? null
  );

  // Calculate channel trends
  const channelTrends: Record<string, MetricTrend> = {};
  for (const channel of channels) {
    // We don't have previous channel data in the current implementation
    // Could be enhanced to fetch that separately
    channelTrends[channel.channel] = calculateTrend(channel.sessions, null);
  }

  // Calculate search trend (no previous period data available in current impl)
  const searchTrend = calculateTrend(searchMetrics?.totalClicks ?? null, null);

  // Detect anomalies
  const anomalies = detectAnomalies(traffic, trafficTrend, searchMetrics);

  // Generate insights
  const insights = generateInsights(
    traffic,
    channels,
    topPages,
    searchMetrics,
    anomalies
  );

  const analytics: WorkspaceAnalytics = {
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    traffic,
    trafficTrend,
    channels,
    channelTrends,
    topPages,
    searchMetrics: searchMetrics || {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      topQueries: [],
      topPages: [],
    },
    searchTrend,
    anomalies,
    insights,
  };

  console.log('[Workspace Analytics] Generated:', {
    sessions: traffic.sessions,
    channels: channels.length,
    pages: topPages.length,
    anomalies: anomalies.length,
    insights: insights.length,
  });

  return analytics;
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function getWorkspaceAnalyticsLast30Days(
  siteId?: string
): Promise<WorkspaceAnalytics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  return getWorkspaceAnalytics({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    siteId,
  });
}

export async function getWorkspaceAnalyticsLast7Days(
  siteId?: string
): Promise<WorkspaceAnalytics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return getWorkspaceAnalytics({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    siteId,
  });
}
