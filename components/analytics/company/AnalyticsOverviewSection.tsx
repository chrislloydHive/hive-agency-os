// components/analytics/company/AnalyticsOverviewSection.tsx
// Overview subtab for Company Analytics - executive summary view
//
// Displays:
// - High-level KPI cards (sessions, users, clicks, position)
// - DMA/GAP funnel metrics
// - AI-generated insights sidebar
// - Quick wins and work suggestions
// - Recent activity timeline

'use client';

import type { CompanyAnalyticsSnapshot, AnalyticsAiInsights } from '@/lib/analytics/types';
import { FunnelMetricsCard } from '../FunnelMetricsCard';
import { CompanyActivityTimeline } from '@/components/os/CompanyActivityTimeline';

interface AnalyticsOverviewSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  insights?: AnalyticsAiInsights | null;
  isLoading: boolean;
  isLoadingInsights?: boolean;
  error: string | null;
  onRetry?: () => void;
  onFetchInsights?: () => void;
  companyId?: string;
}

export function AnalyticsOverviewSection({
  snapshot,
  insights,
  isLoading,
  isLoadingInsights,
  error,
  onRetry,
  onFetchInsights,
  companyId,
}: AnalyticsOverviewSectionProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* KPI Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 animate-pulse">
                <div className="h-3 w-16 bg-slate-700 rounded mb-2" />
                <div className="h-8 w-20 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
          {/* Funnel skeleton */}
          <div className="h-48 bg-slate-900/70 border border-slate-800 rounded-xl animate-pulse" />
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 animate-pulse">
          <div className="h-6 w-32 bg-amber-500/20 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-amber-500/10 rounded" />
            <div className="h-4 bg-amber-500/10 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // No data state
  if (!snapshot) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No analytics data available.</p>
      </div>
    );
  }

  const ga4 = snapshot.ga4;
  const gsc = snapshot.searchConsole;
  const funnels = snapshot.funnels;
  const comparison = snapshot.comparison;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Sessions */}
          <KpiCard
            label="Sessions"
            value={ga4?.metrics.sessions}
            change={comparison?.ga4?.sessionsChange}
            source="GA4"
            connected={snapshot.ga4Connected}
          />

          {/* Users */}
          <KpiCard
            label="Users"
            value={ga4?.metrics.users}
            change={comparison?.ga4?.usersChange}
            source="GA4"
            connected={snapshot.ga4Connected}
          />

          {/* Search Clicks */}
          <KpiCard
            label="Search Clicks"
            value={gsc?.metrics.clicks}
            change={comparison?.searchConsole?.clicksChange}
            source="GSC"
            connected={snapshot.gscConnected}
          />

          {/* Avg Position */}
          <KpiCard
            label="Avg Position"
            value={gsc?.metrics.avgPosition}
            change={comparison?.searchConsole?.positionChange}
            format="position"
            source="GSC"
            connected={snapshot.gscConnected}
            invertChange // Lower position is better
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Conversions"
            value={ga4?.metrics.conversions}
            change={comparison?.ga4?.conversionsChange}
            source="GA4"
            connected={snapshot.ga4Connected}
          />

          <KpiCard
            label="Bounce Rate"
            value={ga4?.metrics.bounceRate}
            change={comparison?.ga4?.bounceRateChange}
            format="percentage"
            source="GA4"
            connected={snapshot.ga4Connected}
            invertChange // Lower bounce is better
          />

          <KpiCard
            label="Impressions"
            value={gsc?.metrics.impressions}
            change={comparison?.searchConsole?.impressionsChange}
            source="GSC"
            connected={snapshot.gscConnected}
          />

          <KpiCard
            label="CTR"
            value={gsc?.metrics.ctr}
            change={comparison?.searchConsole?.ctrChange}
            format="percentage"
            source="GSC"
            connected={snapshot.gscConnected}
          />
        </div>

        {/* DMA/GAP Funnel Metrics */}
        {snapshot.ga4Connected && (
          <FunnelMetricsCard
            funnels={funnels?.metrics}
            comparison={comparison?.funnels}
          />
        )}

        {/* Quick Wins */}
        {insights?.quickWins && insights.quickWins.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Wins
            </h3>
            <ul className="space-y-2">
              {insights.quickWins.slice(0, 4).map((win, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-emerald-100">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Work Recommendations */}
        {insights?.recommendations && insights.recommendations.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Suggested Work Items
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {insights.recommendations.slice(0, 4).map((rec, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rec.priority === 'high'
                        ? 'bg-red-500/20 text-red-300'
                        : rec.priority === 'medium'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {rec.area}
                    </span>
                    {rec.impact && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.impact === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : rec.impact === 'medium'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {rec.impact} impact
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-slate-200">{rec.title}</div>
                  <div className="text-sm text-slate-400 mt-1">{rec.description}</div>
                  {rec.reason && (
                    <div className="text-xs text-slate-500 mt-2 italic">
                      Why: {rec.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        {companyId && (
          <CompanyActivityTimeline companyId={companyId} limit={10} />
        )}
      </div>

      {/* AI Insights Sidebar */}
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
            </svg>
            <h2 className="text-lg font-semibold text-amber-100">Hive OS Insight</h2>
          </div>

          {isLoadingInsights && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
              <p className="text-amber-200 text-sm mt-3">Generating insights...</p>
            </div>
          )}

          {!isLoadingInsights && !insights && (
            <div className="text-center py-4">
              <p className="text-sm text-amber-200/70 mb-4">
                Get AI-powered analysis of your analytics data.
              </p>
              {onFetchInsights && (
                <button
                  onClick={onFetchInsights}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition-colors"
                >
                  Generate Insights
                </button>
              )}
            </div>
          )}

          {insights && !isLoadingInsights && (
            <div className="space-y-5">
              {/* Health Score */}
              {insights.healthScore !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                  <div className={`text-2xl font-bold ${
                    insights.healthStatus === 'healthy' ? 'text-emerald-400' :
                    insights.healthStatus === 'attention' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {insights.healthScore}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase">Health Score</div>
                    <div className={`text-sm font-medium ${
                      insights.healthStatus === 'healthy' ? 'text-emerald-300' :
                      insights.healthStatus === 'attention' ? 'text-amber-300' :
                      'text-red-300'
                    }`}>
                      {insights.healthStatus === 'healthy' ? 'Healthy' :
                       insights.healthStatus === 'attention' ? 'Needs Attention' :
                       'Critical'}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="text-sm text-amber-100 leading-relaxed whitespace-pre-line">
                {insights.summary}
              </div>

              {/* Key Insights */}
              {insights.insights && insights.insights.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Insights</h3>
                  <div className="space-y-2">
                    {insights.insights.slice(0, 5).map((insight) => (
                      <div
                        key={insight.id}
                        className={`border rounded p-3 ${
                          insight.category === 'traffic'
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : insight.category === 'search'
                            ? 'bg-blue-500/10 border-blue-500/30'
                            : insight.category === 'conversion' || insight.category === 'funnel'
                            ? 'bg-purple-500/10 border-purple-500/30'
                            : insight.category === 'engagement'
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-slate-900/50 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              insight.category === 'traffic'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : insight.category === 'search'
                                ? 'bg-blue-500/20 text-blue-300'
                                : insight.category === 'conversion' || insight.category === 'funnel'
                                ? 'bg-purple-500/20 text-purple-300'
                                : insight.category === 'engagement'
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}
                          >
                            {insight.category}
                          </span>
                        </div>
                        <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{insight.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// KPI Card helper component
function KpiCard({
  label,
  value,
  change,
  format = 'number',
  source,
  connected = true,
  invertChange = false,
}: {
  label: string;
  value?: number | null;
  change?: number;
  format?: 'number' | 'percentage' | 'position';
  source: 'GA4' | 'GSC';
  connected?: boolean;
  invertChange?: boolean;
}) {
  if (!connected) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
        <div className="text-sm text-slate-500">{source} not connected</div>
      </div>
    );
  }

  const formattedValue = (() => {
    if (value === undefined || value === null) return '—';
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'position':
        return value.toFixed(1);
      default:
        return value.toLocaleString();
    }
  })();

  const sourceColor = source === 'GA4' ? 'text-emerald-400' : 'text-blue-400';

  // For change indicator, invert the logic if invertChange is true
  const isPositiveChange = invertChange ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const isNegativeChange = invertChange ? (change ?? 0) > 0 : (change ?? 0) < 0;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-100">{formattedValue}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs ${sourceColor}`}>{source}</span>
        {change !== undefined && Math.abs(change) >= 0.1 && (
          <span className={`text-xs ${
            isPositiveChange ? 'text-emerald-400' :
            isNegativeChange ? 'text-red-400' :
            'text-slate-500'
          }`}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
