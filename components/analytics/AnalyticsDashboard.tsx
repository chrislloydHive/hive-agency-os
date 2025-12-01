'use client';

// components/analytics/AnalyticsDashboard.tsx
// Unified Analytics Dashboard for Company Pages
//
// Uses the new v2 analytics API with:
// - GA4 metrics, traffic sources, top pages, device breakdown
// - Search Console metrics, queries, pages
// - DMA/GAP-IA funnel metrics
// - Period-over-period comparison
// - AI-powered insights

import { useState, useEffect, useCallback } from 'react';
import type {
  CompanyAnalyticsSnapshot,
  AnalyticsAiInsights,
  AnalyticsDateRangePreset,
} from '@/lib/analytics/types';

interface AnalyticsDashboardProps {
  companyId: string;
  companyName: string;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
}

type ActiveTab = 'overview' | 'funnels' | 'traffic' | 'search' | 'insights';

export function AnalyticsDashboard({
  companyId,
  companyName,
  ga4PropertyId,
  searchConsoleSiteUrl,
}: AnalyticsDashboardProps) {
  const [snapshot, setSnapshot] = useState<CompanyAnalyticsSnapshot | null>(null);
  const [insights, setInsights] = useState<AnalyticsAiInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [range, setRange] = useState<AnalyticsDateRangePreset>('30d');

  const hasGa4 = !!ga4PropertyId;
  const hasGsc = !!searchConsoleSiteUrl;
  const hasAnyConnection = hasGa4 || hasGsc;

  // Fetch analytics snapshot
  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/v2/company/${companyId}?range=${range}`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setSnapshot(data.snapshot);
    } catch (err) {
      console.error('[AnalyticsDashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [companyId, range]);

  // Fetch AI insights
  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);

    try {
      const response = await fetch(`/api/analytics/v2/company/${companyId}/insights?range=${range}`);
      const data = await response.json();

      if (data.ok && data.insights) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.warn('[AnalyticsDashboard] Error fetching insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, [companyId, range]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const handleRangeChange = (newRange: AnalyticsDateRangePreset) => {
    setRange(newRange);
  };

  const handleGenerateInsights = () => {
    fetchInsights();
  };

  // Format change percentage
  const formatChange = (change: number | undefined) => {
    if (change === undefined || change === null) return null;
    const sign = change > 0 ? '+' : '';
    const color = change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-slate-400';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  // No connections - show setup UI
  if (!hasAnyConnection) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Connect Analytics</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Connect this company's GA4 property or Search Console to see traffic, conversions, funnels, and SEO performance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{companyName}</h2>
              {snapshot && (
                <span className="text-sm text-slate-400">
                  {snapshot.range.startDate} – {snapshot.range.endDate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {snapshot?.ga4Connected && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-xs text-slate-400">GA4</span>
                </div>
              )}
              {snapshot?.gscConnected && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="text-xs text-slate-400">Search Console</span>
                </div>
              )}
              {snapshot?.funnels && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  <span className="text-xs text-slate-400">Funnels</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  range === r
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-4">
          {(['overview', 'funnels', 'traffic', 'search', 'insights'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-slate-400 mt-4">Loading analytics...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchSnapshot}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {snapshot && !loading && (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Sessions */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {snapshot.ga4?.metrics.sessions.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>GA4 • {range}</span>
                    {snapshot.comparison?.ga4?.sessionsChange !== undefined && (
                      formatChange(snapshot.comparison.ga4.sessionsChange)
                    )}
                  </div>
                </div>

                {/* Users */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {snapshot.ga4?.metrics.users.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>GA4</span>
                    {snapshot.comparison?.ga4?.usersChange !== undefined && (
                      formatChange(snapshot.comparison.ga4.usersChange)
                    )}
                  </div>
                </div>

                {/* Search Clicks */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Search Clicks</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {snapshot.searchConsole?.metrics.clicks.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-blue-400 mt-1 flex items-center gap-2">
                    <span>GSC</span>
                    {snapshot.comparison?.searchConsole?.clicksChange !== undefined && (
                      formatChange(snapshot.comparison.searchConsole.clicksChange)
                    )}
                  </div>
                </div>

                {/* Conversions */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Conversions</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {snapshot.ga4?.metrics.conversions.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-purple-400 mt-1 flex items-center gap-2">
                    <span>{snapshot.ga4?.metrics.conversionRate ? `${(snapshot.ga4.metrics.conversionRate * 100).toFixed(2)}% CVR` : 'GA4'}</span>
                    {snapshot.comparison?.ga4?.conversionsChange !== undefined && (
                      formatChange(snapshot.comparison.ga4.conversionsChange)
                    )}
                  </div>
                </div>
              </div>

              {/* Funnel Summary */}
              {snapshot.funnels && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                    Lead Generation Funnels
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">DMA Audits Started</div>
                      <div className="text-xl font-bold text-slate-100">
                        {snapshot.funnels.metrics.dma.auditsStarted}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">DMA Completed</div>
                      <div className="text-xl font-bold text-emerald-400">
                        {snapshot.funnels.metrics.dma.auditsCompleted}
                        <span className="text-sm text-slate-400 ml-1">
                          ({(snapshot.funnels.metrics.dma.completionRate * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">GAP-IA Started</div>
                      <div className="text-xl font-bold text-slate-100">
                        {snapshot.funnels.metrics.gapIa.started}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">GAP-IA CTA Clicked</div>
                      <div className="text-xl font-bold text-amber-400">
                        {snapshot.funnels.metrics.gapIa.ctaClicked}
                        <span className="text-sm text-slate-400 ml-1">
                          ({(snapshot.funnels.metrics.gapIa.viewToCtaRate * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Traffic Sources */}
              {snapshot.ga4?.trafficSources && snapshot.ga4.trafficSources.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Top Traffic Sources
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Source / Medium</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Sessions</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Users</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.ga4.trafficSources.slice(0, 6).map((src, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-4 py-2 text-slate-200">{src.source} / {src.medium}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{src.sessions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{src.users.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{src.conversions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Generate Insights Button */}
              {!insights && (
                <div className="flex justify-center">
                  <button
                    onClick={handleGenerateInsights}
                    disabled={insightsLoading}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {insightsLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                        Generating Insights...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1z" />
                        </svg>
                        Generate AI Insights
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Funnels Tab */}
          {activeTab === 'funnels' && (
            <div className="space-y-6">
              {snapshot.funnels ? (
                <>
                  {/* Funnel Visualization */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-6">
                      DMA Audit Funnel
                    </h3>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="w-32 h-24 bg-blue-500/20 border border-blue-500/40 rounded-lg flex items-center justify-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-300">
                              {snapshot.funnels.metrics.dma.auditsStarted}
                            </div>
                            <div className="text-xs text-blue-400">Started</div>
                          </div>
                        </div>
                      </div>
                      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <div className="text-center">
                        <div className="w-32 h-24 bg-emerald-500/20 border border-emerald-500/40 rounded-lg flex items-center justify-center">
                          <div>
                            <div className="text-2xl font-bold text-emerald-300">
                              {snapshot.funnels.metrics.dma.auditsCompleted}
                            </div>
                            <div className="text-xs text-emerald-400">Completed</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2">
                          {(snapshot.funnels.metrics.dma.completionRate * 100).toFixed(1)}% completion
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GAP-IA Funnel */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-6">
                      GAP-IA Funnel
                    </h3>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {[
                        { label: 'Started', value: snapshot.funnels.metrics.gapIa.started, color: 'blue' },
                        { label: 'Completed', value: snapshot.funnels.metrics.gapIa.completed, color: 'purple' },
                        { label: 'Report Viewed', value: snapshot.funnels.metrics.gapIa.reportViewed, color: 'amber' },
                        { label: 'CTA Clicked', value: snapshot.funnels.metrics.gapIa.ctaClicked, color: 'emerald' },
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className={`w-28 h-20 bg-${step.color}-500/20 border border-${step.color}-500/40 rounded-lg flex items-center justify-center`}>
                            <div className="text-center">
                              <div className={`text-xl font-bold text-${step.color}-300`}>{step.value}</div>
                              <div className={`text-[10px] text-${step.color}-400`}>{step.label}</div>
                            </div>
                          </div>
                          {idx < 3 && (
                            <svg className="w-6 h-6 text-slate-600 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-8 mt-4 text-xs text-slate-400">
                      <span>Start-to-Complete: {(snapshot.funnels.metrics.gapIa.startToCompleteRate * 100).toFixed(1)}%</span>
                      <span>View-to-CTA: {(snapshot.funnels.metrics.gapIa.viewToCtaRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Funnel by Source */}
                  {snapshot.funnels.bySource.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Funnel Performance by Source
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Source / Medium</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">DMA Started</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">DMA Completed</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">GAP-IA Started</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">GAP-IA CTA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.funnels.bySource.slice(0, 10).map((src, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                                <td className="px-4 py-2 text-slate-200">{src.source} / {src.medium}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{src.dmaStarted}</td>
                                <td className="px-4 py-2 text-right text-emerald-400">{src.dmaCompleted}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{src.gapIaStarted}</td>
                                <td className="px-4 py-2 text-right text-amber-400">{src.gapIaCtaClicked}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                  <svg className="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">No Funnel Data</h3>
                  <p className="text-sm text-slate-500">
                    DMA and GAP-IA funnel events need to be tracked in GA4 to see performance here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Traffic Tab */}
          {activeTab === 'traffic' && (
            <div className="space-y-6">
              {snapshot.ga4 ? (
                <>
                  {/* Traffic Overview */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                      Traffic Overview
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Sessions</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.ga4.metrics.sessions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Users</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.ga4.metrics.users.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">New Users</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.ga4.metrics.newUsers.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Bounce Rate</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {(snapshot.ga4.metrics.bounceRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Engagement</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {(snapshot.ga4.metrics.engagementRate * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Device Breakdown */}
                  {snapshot.ga4.deviceBreakdown.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                        Device Breakdown
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {snapshot.ga4.deviceBreakdown.map((device, idx) => (
                          <div key={idx} className="bg-slate-800/50 rounded-lg p-4">
                            <div className="text-xs text-slate-500 uppercase mb-1">{device.device}</div>
                            <div className="text-xl font-bold text-slate-100">
                              {device.sessions.toLocaleString()} sessions
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {device.users.toLocaleString()} users • {(device.bounceRate * 100).toFixed(0)}% bounce
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Pages */}
                  {snapshot.ga4.topPages.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Top Pages
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Page</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Pageviews</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Users</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Bounce</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.ga4.topPages.slice(0, 10).map((page, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                                <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">{page.path}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{page.pageviews.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{page.users.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{(page.bounceRate * 100).toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">GA4 Not Connected</h3>
                  <p className="text-sm text-slate-500">
                    Connect GA4 to see traffic analytics.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {snapshot.searchConsole ? (
                <>
                  {/* Search Overview */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                      Search Performance
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Clicks</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.searchConsole.metrics.clicks.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Impressions</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.searchConsole.metrics.impressions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">CTR</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {(snapshot.searchConsole.metrics.ctr * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Avg Position</div>
                        <div className="text-2xl font-bold text-slate-100">
                          {snapshot.searchConsole.metrics.avgPosition.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Queries */}
                  {snapshot.searchConsole.topQueries.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Top Search Queries
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Query</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Clicks</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Impressions</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">CTR</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Position</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.searchConsole.topQueries.slice(0, 15).map((query, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                                <td className="px-4 py-2 text-slate-200">{query.query}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{query.clicks.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{query.impressions.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{(query.ctr * 100).toFixed(2)}%</td>
                                <td className="px-4 py-2 text-right text-slate-300">{query.position.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Top Pages */}
                  {snapshot.searchConsole.topPages.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Top Pages in Search
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Page</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Clicks</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Impressions</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">CTR</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Position</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.searchConsole.topPages.slice(0, 10).map((page, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                                <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">
                                  {page.page.replace(/^https?:\/\/[^/]+/, '')}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-300">{page.clicks.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{page.impressions.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-slate-300">{(page.ctr * 100).toFixed(2)}%</td>
                                <td className="px-4 py-2 text-right text-slate-300">{page.position.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">Search Console Not Connected</h3>
                  <p className="text-sm text-slate-500">
                    Connect Search Console to see search analytics.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {!insights && !insightsLoading && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-amber-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-amber-100 mb-2">Generate AI Insights</h3>
                  <p className="text-sm text-amber-200/70 mb-6 max-w-md mx-auto">
                    Let Hive OS analyze your analytics data and generate strategic recommendations, quick wins, and experiments.
                  </p>
                  <button
                    onClick={handleGenerateInsights}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                  >
                    Generate Insights
                  </button>
                </div>
              )}

              {insightsLoading && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-slate-400 mt-4">Analyzing {companyName}'s data...</p>
                </div>
              )}

              {insights && !insightsLoading && (
                <>
                  {/* Health Score */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                        Analytics Health Score
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        insights.healthStatus === 'healthy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : insights.healthStatus === 'attention'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {insights.healthStatus.charAt(0).toUpperCase() + insights.healthStatus.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-5xl font-bold text-slate-100">{insights.healthScore}</div>
                      <div className="flex-1">
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              insights.healthScore >= 70
                                ? 'bg-emerald-500'
                                : insights.healthScore >= 40
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${insights.healthScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wide mb-3">
                      Executive Summary
                    </h3>
                    <p className="text-amber-100 leading-relaxed">{insights.summary}</p>
                  </div>

                  {/* Highlights */}
                  {insights.highlights.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {insights.highlights.map((highlight, idx) => (
                        <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                          <div className="text-xs text-slate-500 uppercase mb-1">{highlight.metric}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-slate-100">{highlight.value}</span>
                            {highlight.trend === 'up' && <span className="text-emerald-400">↑</span>}
                            {highlight.trend === 'down' && <span className="text-red-400">↓</span>}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{highlight.context}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Wins */}
                  {insights.quickWins.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Quick Wins
                      </h3>
                      <ul className="space-y-2">
                        {insights.quickWins.map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-emerald-100">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Insights */}
                  {insights.insights.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Key Insights
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {insights.insights.map((insight, idx) => (
                          <div key={idx} className="p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                insight.priority === 'high'
                                  ? 'bg-red-500/20 text-red-300'
                                  : insight.priority === 'medium'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-500/20 text-slate-300'
                              }`}>
                                {insight.priority}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                insight.category === 'traffic' ? 'bg-emerald-500/20 text-emerald-300' :
                                insight.category === 'search' ? 'bg-blue-500/20 text-blue-300' :
                                insight.category === 'funnel' ? 'bg-purple-500/20 text-purple-300' :
                                insight.category === 'conversion' ? 'bg-amber-500/20 text-amber-300' :
                                insight.category === 'risk' ? 'bg-red-500/20 text-red-300' :
                                insight.category === 'opportunity' ? 'bg-emerald-500/20 text-emerald-300' :
                                'bg-slate-500/20 text-slate-300'
                              }`}>
                                {insight.category}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200">{insight.title}</div>
                            <div className="text-sm text-slate-400 mt-1">{insight.detail}</div>
                            {insight.metric && (
                              <div className="text-xs text-slate-500 mt-2">
                                {insight.metric.name}: {insight.metric.value}
                                {insight.metric.change !== undefined && (
                                  <span className={insight.metric.change > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                    {' '}({insight.metric.change > 0 ? '+' : ''}{insight.metric.change.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {insights.recommendations.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Recommendations
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {insights.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                rec.impact === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                                rec.impact === 'medium' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {rec.impact} impact
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                rec.effort === 'low' ? 'bg-emerald-500/20 text-emerald-300' :
                                rec.effort === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {rec.effort} effort
                              </span>
                            </div>
                            <div className="font-medium text-slate-200">{rec.title}</div>
                            <div className="text-sm text-slate-400 mt-1">{rec.description}</div>
                            {rec.reason && (
                              <div className="text-xs text-slate-500 mt-2 italic">Why: {rec.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experiments */}
                  {insights.experiments.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                          Experiments to Run
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {insights.experiments.map((exp, idx) => (
                          <div key={idx} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                <span className="text-sm font-bold text-purple-300">{idx + 1}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-purple-200">{exp.name}</span>
                                  {exp.expectedImpact && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      exp.expectedImpact === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                                      exp.expectedImpact === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                      'bg-slate-500/20 text-slate-300'
                                    }`}>
                                      {exp.expectedImpact} impact
                                    </span>
                                  )}
                                  {exp.timeframe && (
                                    <span className="text-xs text-slate-500">{exp.timeframe}</span>
                                  )}
                                </div>
                                <div className="text-sm text-slate-400 mt-1">{exp.hypothesis}</div>
                                {exp.steps.length > 0 && (
                                  <ol className="list-decimal list-inside text-sm text-slate-500 mt-2 space-y-1">
                                    {exp.steps.map((step, stepIdx) => (
                                      <li key={stepIdx}>{step}</li>
                                    ))}
                                  </ol>
                                )}
                                <div className="text-xs text-purple-400 mt-2">
                                  Success: {exp.successMetric}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
