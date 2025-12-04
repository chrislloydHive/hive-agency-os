// lib/os/analytics/blueprintDataFetcher.ts
// Blueprint Analytics Data Fetcher
//
// Fetches and aggregates analytics data for the Blueprint page.
// This provides a strategic summary of analytics for decision-making.

import { getCompanyById } from '@/lib/airtable/companies';
import type { WorkspaceDateRange, Ga4ChannelBreakdownItem } from './types';
import { createDateRange, getWorkspaceGa4Summary, getWorkspaceDailySessions, getCompanyGa4Summary, getCompanyDailySessions } from './ga4';
import { getWorkspaceGscSummary, getCompanyGscSummary } from './gsc';
import { isGa4Configured } from '@/lib/os/integrations/ga4Client';
import { isGscConfigured } from '@/lib/os/integrations/gscClient';

// ============================================================================
// Types
// ============================================================================

/**
 * Top channel breakdown for analytics summary
 */
export interface TopChannel {
  channel: string;
  sessions: number;
  percent: number;
  conversions: number;
  conversionRate: number;
}

/**
 * Analytics summary for Blueprint page
 */
export interface BlueprintAnalyticsSummary {
  // Core metrics
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number | null;
  avgSessionDuration: number | null;

  // Search Console metrics
  ctr: number | null;
  avgPosition: number | null;
  clicks: number;
  impressions: number;

  // Funnel metrics
  funnelCompletionRate: number | null;

  // Channel breakdown
  topChannels: TopChannel[];

  // 30-day trendline (daily sessions)
  trendline: number[];

  // Period comparison
  sessionsChange: number | null;
  usersChange: number | null;
  conversionsChange: number | null;
  ctrChange: number | null;

  // Meta
  hasGa4: boolean;
  hasGsc: boolean;
  dateRange: {
    startDate: string;
    endDate: string;
    preset: string;
  };
  generatedAt: string;
}

/**
 * Result from the analytics data fetcher
 */
export interface BlueprintAnalyticsResult {
  ok: boolean;
  summary: BlueprintAnalyticsSummary | null;
  error?: string;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch analytics summary for Blueprint page
 */
export async function fetchBlueprintAnalytics(
  companyId: string,
  options: {
    preset?: '7d' | '30d' | '90d';
    workspaceId?: string;
  } = {}
): Promise<BlueprintAnalyticsResult> {
  const { preset = '30d', workspaceId } = options;

  console.log('[BlueprintAnalytics] Fetching for company:', companyId);

  try {
    // Get company to check GA4/GSC credentials
    const company = await getCompanyById(companyId);
    if (!company) {
      return { ok: false, summary: null, error: 'Company not found' };
    }

    // Check if this COMPANY has analytics configured (not just the workspace)
    // We only show analytics for companies that have their own GA4/GSC credentials
    const companyGa4PropertyId = company.ga4PropertyId || null;
    const companyGscSiteUrl = company.searchConsoleSiteUrl || null;
    const companyHasGa4 = Boolean(companyGa4PropertyId);
    const companyHasGsc = Boolean(companyGscSiteUrl);

    // If company doesn't have analytics configured, return early
    if (!companyHasGa4 && !companyHasGsc) {
      console.log('[BlueprintAnalytics] Company has no analytics configured:', companyId);
      return { ok: true, summary: null };
    }

    // Check if workspace integrations are available to fetch the data
    const [hasWorkspaceGa4, hasWorkspaceGsc] = await Promise.all([
      companyHasGa4 ? isGa4Configured(workspaceId) : Promise.resolve(false),
      companyHasGsc ? isGscConfigured(workspaceId) : Promise.resolve(false),
    ]);

    // Determine if we can actually fetch data
    const hasGa4 = companyHasGa4 && hasWorkspaceGa4;
    const hasGsc = companyHasGsc && hasWorkspaceGsc;

    // Create date ranges for current and previous period
    const currentRange = createDateRange(preset);
    const previousRange = createPreviousPeriodRange(currentRange);

    // Create a 30-day range for trendline (always 30 days regardless of preset)
    const trendlineRange = createDateRange('30d');

    // Fetch current period data + daily sessions for trendline
    // Use company-specific GA4 property and GSC site URL when available
    const [currentGa4, currentGsc, previousGa4, previousGsc, dailySessions] = await Promise.all([
      hasGa4
        ? getCompanyGa4Summary(currentRange, companyGa4PropertyId!, workspaceId)
        : Promise.resolve({ traffic: null, channels: [], landingPages: [] }),
      hasGsc
        ? getCompanyGscSummary(currentRange, companyGscSiteUrl!, workspaceId)
        : Promise.resolve({ queries: [], pages: [], totals: { clicks: 0, impressions: 0, avgCtr: null, avgPosition: null } }),
      hasGa4
        ? getCompanyGa4Summary(previousRange, companyGa4PropertyId!, workspaceId).catch(() => ({ traffic: null, channels: [], landingPages: [] }))
        : Promise.resolve({ traffic: null, channels: [], landingPages: [] }),
      hasGsc
        ? getCompanyGscSummary(previousRange, companyGscSiteUrl!, workspaceId).catch(() => ({ queries: [], pages: [], totals: { clicks: 0, impressions: 0, avgCtr: null, avgPosition: null } }))
        : Promise.resolve({ queries: [], pages: [], totals: { clicks: 0, impressions: 0, avgCtr: null, avgPosition: null } }),
      hasGa4
        ? getCompanyDailySessions(trendlineRange, companyGa4PropertyId!, workspaceId).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Calculate metrics
    const currentTraffic = currentGa4.traffic;
    const previousTraffic = previousGa4.traffic;

    const sessions = currentTraffic?.sessions ?? 0;
    const users = currentTraffic?.users ?? 0;
    // Calculate conversions from channels (sum of all channel conversions)
    const conversions = currentGa4.channels.reduce(
      (sum: number, ch: Ga4ChannelBreakdownItem) => sum + (ch.conversions ?? 0),
      0
    );
    const previousConversions = previousGa4.channels.reduce(
      (sum: number, ch: Ga4ChannelBreakdownItem) => sum + (ch.conversions ?? 0),
      0
    );
    const bounceRate = currentTraffic?.bounceRate ?? null;
    const avgSessionDuration = currentTraffic?.avgSessionDurationSeconds ?? null;

    // GSC metrics
    const clicks = currentGsc.totals?.clicks ?? 0;
    const impressions = currentGsc.totals?.impressions ?? 0;
    const ctr = currentGsc.totals?.avgCtr ?? null;
    const avgPosition = currentGsc.totals?.avgPosition ?? null;

    // Calculate period changes
    const sessionsChange = calculatePercentChange(
      previousTraffic?.sessions,
      sessions
    );
    const usersChange = calculatePercentChange(
      previousTraffic?.users,
      users
    );
    const conversionsChange = calculatePercentChange(
      previousConversions,
      conversions
    );
    const ctrChange = calculatePercentChange(
      previousGsc.totals?.avgCtr,
      ctr
    );

    // Calculate funnel completion rate (conversions / sessions)
    const funnelCompletionRate = sessions > 0 ? (conversions / sessions) * 100 : null;

    // Build top channels
    const topChannels: TopChannel[] = currentGa4.channels
      .slice(0, 3)
      .map((ch: Ga4ChannelBreakdownItem) => {
        const chConversions = ch.conversions ?? 0;
        return {
          channel: ch.channel,
          sessions: ch.sessions,
          percent: sessions > 0 ? (ch.sessions / sessions) * 100 : 0,
          conversions: chConversions,
          conversionRate: ch.sessions > 0 ? (chConversions / ch.sessions) * 100 : 0,
        };
      });

    // Build trendline from real daily sessions data
    const trendline = dailySessions.length > 0
      ? dailySessions.map((d: { date: string; sessions: number }) => d.sessions)
      : [];

    const summary: BlueprintAnalyticsSummary = {
      sessions,
      users,
      conversions,
      bounceRate,
      avgSessionDuration,
      ctr,
      avgPosition,
      clicks,
      impressions,
      funnelCompletionRate,
      topChannels,
      trendline,
      sessionsChange,
      usersChange,
      conversionsChange,
      ctrChange,
      hasGa4,
      hasGsc,
      dateRange: {
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        preset,
      },
      generatedAt: new Date().toISOString(),
    };

    console.log('[BlueprintAnalytics] Summary generated:', {
      sessions,
      users,
      conversions,
      topChannels: topChannels.length,
    });

    return { ok: true, summary };
  } catch (error) {
    console.error('[BlueprintAnalytics] Error:', error);
    return {
      ok: false,
      summary: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percent change between two values
 */
function calculatePercentChange(
  previous: number | null | undefined,
  current: number | null | undefined
): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  if (current === null || current === undefined) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Creates a previous period date range for comparison
 */
function createPreviousPeriodRange(currentRange: WorkspaceDateRange): WorkspaceDateRange {
  const currentStart = new Date(currentRange.startDate);
  const currentEnd = new Date(currentRange.endDate);
  const periodDays = Math.ceil(
    (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - periodDays);

  return {
    startDate: previousStart.toISOString().split('T')[0],
    endDate: previousEnd.toISOString().split('T')[0],
    preset: currentRange.preset,
  };
}

// ============================================================================
// Strategic Insight Generator
// ============================================================================

export interface AnalyticsStrategicInsight {
  type: 'strength' | 'warning' | 'opportunity';
  title: string;
  description: string;
  metric?: string;
  value?: string;
}

/**
 * Generate strategic insights from analytics summary
 */
export function generateAnalyticsInsights(
  summary: BlueprintAnalyticsSummary
): AnalyticsStrategicInsight[] {
  const insights: AnalyticsStrategicInsight[] = [];

  // Traffic trend insights
  if (summary.sessionsChange !== null) {
    if (summary.sessionsChange > 10) {
      insights.push({
        type: 'strength',
        title: 'Traffic Growing',
        description: `Sessions increased ${summary.sessionsChange.toFixed(1)}% compared to previous period.`,
        metric: 'Sessions',
        value: `+${summary.sessionsChange.toFixed(1)}%`,
      });
    } else if (summary.sessionsChange < -10) {
      insights.push({
        type: 'warning',
        title: 'Traffic Declining',
        description: `Sessions decreased ${Math.abs(summary.sessionsChange).toFixed(1)}% compared to previous period.`,
        metric: 'Sessions',
        value: `${summary.sessionsChange.toFixed(1)}%`,
      });
    }
  }

  // Conversion insights
  if (summary.funnelCompletionRate !== null) {
    if (summary.funnelCompletionRate > 5) {
      insights.push({
        type: 'strength',
        title: 'Strong Conversion Rate',
        description: `Funnel completion rate is ${summary.funnelCompletionRate.toFixed(1)}% - above typical benchmarks.`,
        metric: 'Conversion Rate',
        value: `${summary.funnelCompletionRate.toFixed(1)}%`,
      });
    } else if (summary.funnelCompletionRate < 1) {
      insights.push({
        type: 'opportunity',
        title: 'Conversion Optimization Needed',
        description: `Funnel completion rate is ${summary.funnelCompletionRate.toFixed(1)}% - consider CRO initiatives.`,
        metric: 'Conversion Rate',
        value: `${summary.funnelCompletionRate.toFixed(1)}%`,
      });
    }
  }

  // SEO insights
  if (summary.avgPosition !== null) {
    if (summary.avgPosition <= 10) {
      insights.push({
        type: 'strength',
        title: 'Strong Search Visibility',
        description: `Average position is ${summary.avgPosition.toFixed(1)} - within first page results.`,
        metric: 'Avg Position',
        value: summary.avgPosition.toFixed(1),
      });
    } else if (summary.avgPosition > 20) {
      insights.push({
        type: 'opportunity',
        title: 'SEO Improvement Opportunity',
        description: `Average position is ${summary.avgPosition.toFixed(1)} - SEO optimization could improve visibility.`,
        metric: 'Avg Position',
        value: summary.avgPosition.toFixed(1),
      });
    }
  }

  // Channel insights
  if (summary.topChannels.length > 0) {
    const topChannel = summary.topChannels[0];
    if (topChannel.percent > 50) {
      insights.push({
        type: 'warning',
        title: 'Channel Concentration Risk',
        description: `${topChannel.channel} accounts for ${topChannel.percent.toFixed(0)}% of traffic - consider diversification.`,
        metric: topChannel.channel,
        value: `${topChannel.percent.toFixed(0)}%`,
      });
    }

    // Find high-converting channel
    const highConvertingChannel = summary.topChannels.find(
      (ch) => ch.conversionRate > 5
    );
    if (highConvertingChannel) {
      insights.push({
        type: 'opportunity',
        title: 'High-Converting Channel',
        description: `${highConvertingChannel.channel} converts at ${highConvertingChannel.conversionRate.toFixed(1)}% - consider scaling investment.`,
        metric: highConvertingChannel.channel,
        value: `${highConvertingChannel.conversionRate.toFixed(1)}%`,
      });
    }
  }

  return insights;
}
