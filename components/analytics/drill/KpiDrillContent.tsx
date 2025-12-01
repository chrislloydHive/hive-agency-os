// components/analytics/drill/KpiDrillContent.tsx
// Deep-dive content for KPI card modals
//
// Shows detailed breakdown of a specific metric including:
// - Current vs previous period comparison
// - Mini sparkline chart (using real time series data from snapshot)
// - Contextual insights based on metric performance

'use client';

import { MiniSparkline, StatRow } from './AnalyticsDrillModal';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';
import { getMetricInsight } from '@/lib/analytics/metricInsights';

type KpiType =
  | 'sessions'
  | 'users'
  | 'pageviews'
  | 'conversions'
  | 'bounceRate'
  | 'searchClicks'
  | 'impressions'
  | 'avgPosition'
  | 'ctr';

interface KpiDrillContentProps {
  kpiType: KpiType;
  snapshot: CompanyAnalyticsSnapshot;
}

export function KpiDrillContent({ kpiType, snapshot }: KpiDrillContentProps) {
  const ga4 = snapshot.ga4;
  const gsc = snapshot.searchConsole;
  const comparison = snapshot.comparison;

  // Get time series data for the sparkline
  const getTimeSeriesData = () => {
    switch (kpiType) {
      case 'sessions':
        return ga4?.timeSeries?.map((d) => ({ date: d.date, value: d.sessions })) || [];
      case 'users':
        return ga4?.timeSeries?.map((d) => ({ date: d.date, value: d.users })) || [];
      case 'pageviews':
        return ga4?.timeSeries?.map((d) => ({ date: d.date, value: d.pageviews })) || [];
      case 'conversions':
        return ga4?.timeSeries?.map((d) => ({ date: d.date, value: d.conversions })) || [];
      case 'searchClicks':
        return gsc?.timeSeries?.map((d) => ({ date: d.date, value: d.clicks })) || [];
      case 'impressions':
        return gsc?.timeSeries?.map((d) => ({ date: d.date, value: d.impressions })) || [];
      case 'avgPosition':
        return gsc?.timeSeries?.map((d) => ({ date: d.date, value: d.position })) || [];
      case 'ctr':
        return gsc?.timeSeries?.map((d) => ({ date: d.date, value: d.ctr * 100 })) || [];
      default:
        return [];
    }
  };

  const timeSeriesData = getTimeSeriesData();

  // Calculate metrics
  const getMetrics = () => {
    switch (kpiType) {
      case 'sessions':
        return {
          current: ga4?.metrics.sessions || 0,
          change: comparison?.ga4?.sessionsChange,
          label: 'Sessions',
          color: 'emerald' as const,
          format: 'number',
          source: 'GA4',
          additionalStats: [
            { label: 'Users', value: formatNumber(ga4?.metrics.users || 0) },
            { label: 'New Users', value: formatNumber(ga4?.metrics.newUsers || 0) },
            {
              label: 'Avg Session Duration',
              value: formatDuration(ga4?.metrics.avgSessionDuration || 0),
            },
          ],
        };
      case 'users':
        return {
          current: ga4?.metrics.users || 0,
          change: comparison?.ga4?.usersChange,
          label: 'Users',
          color: 'blue' as const,
          format: 'number',
          source: 'GA4',
          additionalStats: [
            { label: 'New Users', value: formatNumber(ga4?.metrics.newUsers || 0) },
            { label: 'Sessions', value: formatNumber(ga4?.metrics.sessions || 0) },
            {
              label: 'Sessions per User',
              value:
                ga4?.metrics.users && ga4.metrics.users > 0
                  ? (ga4.metrics.sessions / ga4.metrics.users).toFixed(2)
                  : '0',
            },
          ],
        };
      case 'pageviews':
        return {
          current: ga4?.metrics.pageviews || 0,
          change: undefined,
          label: 'Pageviews',
          color: 'purple' as const,
          format: 'number',
          source: 'GA4',
          additionalStats: [
            {
              label: 'Pages per Session',
              value:
                ga4?.metrics.sessions && ga4.metrics.sessions > 0
                  ? (ga4.metrics.pageviews / ga4.metrics.sessions).toFixed(2)
                  : '0',
            },
            { label: 'Top Page', value: ga4?.topPages?.[0]?.path || 'N/A' },
          ],
        };
      case 'conversions':
        return {
          current: ga4?.metrics.conversions || 0,
          change: comparison?.ga4?.conversionsChange,
          label: 'Conversions',
          color: 'amber' as const,
          format: 'number',
          source: 'GA4',
          additionalStats: [
            {
              label: 'Conversion Rate',
              value: `${((ga4?.metrics.conversionRate || 0) * 100).toFixed(2)}%`,
            },
            { label: 'Sessions', value: formatNumber(ga4?.metrics.sessions || 0) },
          ],
        };
      case 'bounceRate':
        return {
          current: (ga4?.metrics.bounceRate || 0) * 100,
          change: comparison?.ga4?.bounceRateChange,
          label: 'Bounce Rate',
          color: 'purple' as const,
          format: 'percentage',
          source: 'GA4',
          invertChange: true,
          additionalStats: [
            {
              label: 'Engagement Rate',
              value: `${((ga4?.metrics.engagementRate || 0) * 100).toFixed(1)}%`,
            },
            { label: 'Sessions', value: formatNumber(ga4?.metrics.sessions || 0) },
          ],
        };
      case 'searchClicks':
        return {
          current: gsc?.metrics.clicks || 0,
          change: comparison?.searchConsole?.clicksChange,
          label: 'Search Clicks',
          color: 'amber' as const,
          format: 'number',
          source: 'Search Console',
          additionalStats: [
            { label: 'Impressions', value: formatNumber(gsc?.metrics.impressions || 0) },
            { label: 'CTR', value: `${((gsc?.metrics.ctr || 0) * 100).toFixed(2)}%` },
            { label: 'Avg Position', value: (gsc?.metrics.avgPosition || 0).toFixed(1) },
          ],
        };
      case 'impressions':
        return {
          current: gsc?.metrics.impressions || 0,
          change: comparison?.searchConsole?.impressionsChange,
          label: 'Search Impressions',
          color: 'purple' as const,
          format: 'number',
          source: 'Search Console',
          additionalStats: [
            { label: 'Clicks', value: formatNumber(gsc?.metrics.clicks || 0) },
            { label: 'CTR', value: `${((gsc?.metrics.ctr || 0) * 100).toFixed(2)}%` },
          ],
        };
      case 'avgPosition':
        return {
          current: gsc?.metrics.avgPosition || 0,
          change: comparison?.searchConsole?.positionChange,
          label: 'Avg Search Position',
          color: 'blue' as const,
          format: 'position',
          source: 'Search Console',
          invertChange: true,
          additionalStats: [
            { label: 'Top Query', value: gsc?.topQueries?.[0]?.query || 'N/A' },
            {
              label: 'Top Query Position',
              value: gsc?.topQueries?.[0]?.position?.toFixed(1) || 'N/A',
            },
          ],
        };
      case 'ctr':
        return {
          current: (gsc?.metrics.ctr || 0) * 100,
          change: comparison?.searchConsole?.ctrChange,
          label: 'Click-Through Rate',
          color: 'emerald' as const,
          format: 'percentage',
          source: 'Search Console',
          additionalStats: [
            { label: 'Clicks', value: formatNumber(gsc?.metrics.clicks || 0) },
            { label: 'Impressions', value: formatNumber(gsc?.metrics.impressions || 0) },
          ],
        };
      default:
        return {
          current: 0,
          change: undefined,
          label: 'Unknown',
          color: 'emerald' as const,
          format: 'number',
          source: 'Unknown',
          additionalStats: [],
        };
    }
  };

  const metrics = getMetrics();

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'position':
        return value.toFixed(1);
      default:
        return value.toLocaleString();
    }
  };

  const getTrend = (change?: number, invert?: boolean): 'up' | 'down' | 'neutral' => {
    if (change === undefined || Math.abs(change) < 0.1) return 'neutral';
    const isPositive = invert ? change < 0 : change > 0;
    return isPositive ? 'up' : 'down';
  };

  return (
    <div className="space-y-4">
      {/* Main metric */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Current Period
          </span>
          <span className="text-xs text-slate-500">{metrics.source}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-slate-100">
            {formatValue(metrics.current, metrics.format)}
          </span>
          {metrics.change !== undefined && Math.abs(metrics.change) >= 0.1 && (
            <span
              className={`text-sm font-medium ${
                getTrend(metrics.change, metrics.invertChange) === 'up'
                  ? 'text-emerald-400'
                  : getTrend(metrics.change, metrics.invertChange) === 'down'
                  ? 'text-red-400'
                  : 'text-slate-500'
              }`}
            >
              {metrics.change > 0 ? '+' : ''}
              {metrics.change.toFixed(1)}% vs prev period
            </span>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {timeSeriesData.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
            Trend ({snapshot.range.preset})
          </div>
          <MiniSparkline data={timeSeriesData} color={metrics.color} height={60} />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>{formatDateLabel(timeSeriesData[0]?.date)}</span>
            <span>{formatDateLabel(timeSeriesData[timeSeriesData.length - 1]?.date)}</span>
          </div>
        </div>
      )}

      {/* Additional stats */}
      {metrics.additionalStats && metrics.additionalStats.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Related Metrics
          </div>
          <div className="space-y-0">
            {metrics.additionalStats.map((stat, idx) => (
              <StatRow key={idx} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      )}

      {/* Insight based on data - using rule-based insights engine */}
      {(() => {
        const insightResult = getMetricInsight(kpiType, snapshot);
        if (!insightResult) return null;

        const severityStyles = {
          positive: 'bg-emerald-500/10 border-emerald-500/30',
          negative: 'bg-red-500/10 border-red-500/30',
          neutral: 'bg-slate-500/10 border-slate-500/30',
          info: 'bg-amber-500/10 border-amber-500/30',
        };

        const severityIcons = {
          positive: (
            <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          negative: (
            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          neutral: (
            <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          info: (
            <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
            </svg>
          ),
        };

        const textColors = {
          positive: 'text-emerald-100',
          negative: 'text-red-100',
          neutral: 'text-slate-200',
          info: 'text-amber-100',
        };

        return (
          <div className={`${severityStyles[insightResult.severity]} border rounded-lg p-4`}>
            <div className="flex items-start gap-2">
              {severityIcons[insightResult.severity]}
              <p className={`text-sm ${textColors[insightResult.severity]}`}>
                {insightResult.insight}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Helper functions
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDateLabel(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
