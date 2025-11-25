'use client';

// components/os/WorkspaceAnalyticsClient.tsx
// Workspace Analytics Dashboard with GA4, GSC, Funnel, and AI Insights

import { useState, useEffect, useMemo } from 'react';
import type {
  WorkspaceAnalyticsOverview,
  WorkspaceAIInsights,
  DateRangePreset,
  AnalyticsAlert,
} from '@/lib/os/analytics/types';
import type {
  SearchConsoleSnapshot,
  SearchConsoleAIInsights,
} from '@/lib/os/searchConsole/types';

interface WorkspaceAnalyticsClientProps {
  initialOverview: WorkspaceAnalyticsOverview | null;
  error: string | null;
}

export function WorkspaceAnalyticsClient({
  initialOverview,
  error: initialError,
}: WorkspaceAnalyticsClientProps) {
  const [overview, setOverview] = useState<WorkspaceAnalyticsOverview | null>(initialOverview);
  const [aiInsights, setAiInsights] = useState<WorkspaceAIInsights | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('30d');
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'search' | 'funnel'>('overview');

  // Enhanced Search Console state
  const [gscSnapshot, setGscSnapshot] = useState<SearchConsoleSnapshot | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);
  const [searchInsights, setSearchInsights] = useState<SearchConsoleAIInsights | null>(null);
  const [searchInsightsLoading, setSearchInsightsLoading] = useState(false);

  // Fetch AI insights on mount
  useEffect(() => {
    if (overview && !aiInsights && !loadingInsights) {
      fetchAiInsights(selectedPreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOverview = async (preset: DateRangePreset) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/analytics/overview?preset=${preset}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');

      const data = await response.json();
      setOverview(data.overview);
      setSelectedPreset(preset);

      // Also fetch AI insights
      fetchAiInsights(preset);
    } catch (err) {
      console.error('Error fetching overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsights = async (preset: DateRangePreset) => {
    setLoadingInsights(true);

    try {
      const response = await fetch(`/api/os/analytics/ai-insights?preset=${preset}`);
      if (!response.ok) throw new Error('Failed to generate insights');

      const data = await response.json();
      setAiInsights(data.insights);
    } catch (err) {
      console.warn('Error fetching AI insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fetch enhanced Search Console snapshot
  const fetchGscSnapshot = async (preset: DateRangePreset) => {
    setGscLoading(true);
    setGscError(null);

    try {
      const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 3); // GSC has 2-3 day delay
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/os/analytics/search-console/summary?start=${start}&end=${end}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Search Console data');
      }

      const data = await response.json();
      setGscSnapshot(data.snapshot);

      // Fetch AI insights for the snapshot
      fetchSearchInsights(data.snapshot);
    } catch (err) {
      console.error('Error fetching GSC snapshot:', err);
      setGscError(err instanceof Error ? err.message : 'Failed to load Search Console data');
    } finally {
      setGscLoading(false);
    }
  };

  // Fetch AI Search Insights
  const fetchSearchInsights = async (snapshot: SearchConsoleSnapshot) => {
    setSearchInsightsLoading(true);

    try {
      const response = await fetch('/api/os/analytics/search-console/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate search insights');
      }

      const data = await response.json();
      setSearchInsights(data.insights);
    } catch (err) {
      console.warn('Error fetching search insights:', err);
    } finally {
      setSearchInsightsLoading(false);
    }
  };

  // Fetch GSC snapshot when switching to search tab
  useEffect(() => {
    if (activeTab === 'search' && !gscSnapshot && !gscLoading) {
      fetchGscSnapshot(selectedPreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Group alerts by severity
  const alertsByCategory = useMemo(() => {
    if (!overview?.alerts) return { critical: [], warning: [], info: [] };

    return {
      critical: overview.alerts.filter((a) => a.severity === 'critical'),
      warning: overview.alerts.filter((a) => a.severity === 'warning'),
      info: overview.alerts.filter((a) => a.severity === 'info'),
    };
  }, [overview?.alerts]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400 font-medium">Error loading analytics</p>
        <p className="text-red-300 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mb-4" />
        <p className="text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  const traffic = overview.ga4.traffic;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Period:</span>
          <span className="text-sm font-medium text-amber-400">
            {overview.range.startDate} to {overview.range.endDate}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {(['7d', '30d', '90d'] as DateRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => fetchOverview(preset)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPreset === preset
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {preset === '7d' ? '7 Days' : preset === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
          {loading && <span className="text-sm text-slate-400 ml-2">Loading...</span>}
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alertsByCategory.critical.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/20 to-red-500/5 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-300 mb-2">
                {alertsByCategory.critical.length} Critical Issue
                {alertsByCategory.critical.length !== 1 && 's'}
              </h3>
              <div className="space-y-2">
                {alertsByCategory.critical.map((alert) => (
                  <div key={alert.id} className="text-sm text-slate-300">
                    <span className="font-medium">{alert.title}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{alert.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'traffic', label: 'Traffic' },
            { id: 'search', label: 'Search' },
            { id: 'funnel', label: 'Funnel' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Headline Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard
                  label="Sessions"
                  value={traffic?.sessions?.toLocaleString() ?? '—'}
                />
                <MetricCard
                  label="Users"
                  value={traffic?.users?.toLocaleString() ?? '—'}
                />
                <MetricCard
                  label="Bounce Rate"
                  value={traffic?.bounceRate ? `${(traffic.bounceRate * 100).toFixed(1)}%` : '—'}
                  status={traffic?.bounceRate && traffic.bounceRate > 0.6 ? 'warning' : 'normal'}
                />
                <MetricCard
                  label="Avg Session"
                  value={
                    traffic?.avgSessionDurationSeconds
                      ? `${Math.round(traffic.avgSessionDurationSeconds)}s`
                      : '—'
                  }
                />
              </div>

              {/* Channel Summary */}
              {overview.ga4.channels.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Channels</h3>
                  <div className="space-y-3">
                    {overview.ga4.channels.slice(0, 5).map((channel, idx) => {
                      const percentage = traffic?.sessions
                        ? (channel.sessions / traffic.sessions) * 100
                        : 0;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-slate-300">{channel.channel}</span>
                              <span className="text-sm text-slate-400">
                                {channel.sessions.toLocaleString()} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {alertsByCategory.warning.length > 0 && (
                <AlertsList alerts={alertsByCategory.warning} severity="warning" />
              )}
            </>
          )}

          {activeTab === 'traffic' && (
            <>
              {/* Traffic Metrics */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Traffic Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <MetricCard label="Users" value={traffic?.users?.toLocaleString() ?? '—'} />
                  <MetricCard label="Sessions" value={traffic?.sessions?.toLocaleString() ?? '—'} />
                  <MetricCard label="Pageviews" value={traffic?.pageviews?.toLocaleString() ?? '—'} />
                  <MetricCard
                    label="Bounce Rate"
                    value={traffic?.bounceRate ? `${(traffic.bounceRate * 100).toFixed(1)}%` : '—'}
                  />
                  <MetricCard
                    label="Avg Session Duration"
                    value={
                      traffic?.avgSessionDurationSeconds
                        ? `${Math.round(traffic.avgSessionDurationSeconds)}s`
                        : '—'
                    }
                  />
                </div>
              </div>

              {/* Channel Table */}
              {overview.ga4.channels.length > 0 && (
                <DataTable
                  title="Traffic by Channel"
                  columns={['Channel', 'Sessions', 'Users', 'Conversions']}
                  rows={overview.ga4.channels.map((c) => [
                    c.channel,
                    c.sessions.toLocaleString(),
                    c.users.toLocaleString(),
                    c.conversions?.toLocaleString() ?? '—',
                  ])}
                />
              )}

              {/* Landing Pages Table */}
              {overview.ga4.landingPages.length > 0 && (
                <DataTable
                  title="Top Landing Pages"
                  columns={['Page', 'Sessions', 'Bounce Rate', 'Conversions']}
                  rows={overview.ga4.landingPages.slice(0, 10).map((p) => [
                    p.path,
                    p.sessions.toLocaleString(),
                    p.bounceRate ? `${(p.bounceRate * 100).toFixed(1)}%` : '—',
                    p.conversions?.toLocaleString() ?? '—',
                  ])}
                />
              )}
            </>
          )}

          {activeTab === 'search' && (
            <>
              {/* Loading State */}
              {gscLoading && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-slate-400 mt-4">Loading Search Console data...</p>
                </div>
              )}

              {/* Error State */}
              {gscError && !gscLoading && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
                  <p className="text-red-400 font-medium">{gscError}</p>
                  <p className="text-red-300 text-sm mt-2">
                    Check that SEARCH_CONSOLE_SITE_URL is configured correctly.
                  </p>
                  <button
                    onClick={() => fetchGscSnapshot(selectedPreset)}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Enhanced Search Summary with GSC Snapshot */}
              {gscSnapshot && !gscLoading && (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Search Performance</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <MetricCard
                        label="Clicks"
                        value={gscSnapshot.summary.clicks.toLocaleString()}
                      />
                      <MetricCard
                        label="Impressions"
                        value={gscSnapshot.summary.impressions.toLocaleString()}
                      />
                      <MetricCard
                        label="Avg CTR"
                        value={`${(gscSnapshot.summary.ctr * 100).toFixed(2)}%`}
                      />
                      <MetricCard
                        label="Avg Position"
                        value={gscSnapshot.summary.avgPosition?.toFixed(1) ?? '—'}
                      />
                    </div>
                  </div>

                  {/* Search Queries Table */}
                  {gscSnapshot.topQueries.length > 0 && (
                    <DataTable
                      title="Top Search Queries"
                      columns={['Query', 'Clicks', 'Impressions', 'CTR', 'Position']}
                      rows={gscSnapshot.topQueries.slice(0, 15).map((q) => [
                        q.query,
                        q.clicks.toLocaleString(),
                        q.impressions.toLocaleString(),
                        `${(q.ctr * 100).toFixed(2)}%`,
                        q.avgPosition?.toFixed(1) ?? '—',
                      ])}
                    />
                  )}

                  {/* Search Pages Table */}
                  {gscSnapshot.topPages.length > 0 && (
                    <DataTable
                      title="Top Pages in Search"
                      columns={['URL', 'Clicks', 'Impressions', 'CTR', 'Position']}
                      rows={gscSnapshot.topPages.slice(0, 10).map((p) => [
                        p.url.replace(/^https?:\/\/[^/]+/, ''),
                        p.clicks.toLocaleString(),
                        p.impressions.toLocaleString(),
                        `${(p.ctr * 100).toFixed(2)}%`,
                        p.avgPosition?.toFixed(1) ?? '—',
                      ])}
                    />
                  )}

                  {/* Device Breakdown */}
                  {gscSnapshot.topDevices.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-slate-100 mb-4">Performance by Device</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {gscSnapshot.topDevices.map((device, idx) => (
                          <div key={idx} className="bg-slate-800/50 rounded-lg p-4">
                            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{device.device}</div>
                            <div className="text-lg font-bold text-slate-100">
                              {device.clicks.toLocaleString()} clicks
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              CTR: {(device.ctr * 100).toFixed(2)}% | Pos: {device.avgPosition?.toFixed(1) ?? '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Country Breakdown */}
                  {gscSnapshot.topCountries.length > 0 && (
                    <DataTable
                      title="Top Countries"
                      columns={['Country', 'Clicks', 'Impressions', 'CTR']}
                      rows={gscSnapshot.topCountries.slice(0, 10).map((c) => [
                        c.country,
                        c.clicks.toLocaleString(),
                        c.impressions.toLocaleString(),
                        `${(c.ctr * 100).toFixed(2)}%`,
                      ])}
                    />
                  )}
                </>
              )}

              {/* Fallback to original overview data if enhanced snapshot not available */}
              {!gscSnapshot && !gscLoading && !gscError && (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Search Performance</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <MetricCard
                        label="Clicks"
                        value={overview.gsc.queries
                          .reduce((sum, q) => sum + q.clicks, 0)
                          .toLocaleString()}
                      />
                      <MetricCard
                        label="Impressions"
                        value={overview.gsc.queries
                          .reduce((sum, q) => sum + q.impressions, 0)
                          .toLocaleString()}
                      />
                      <MetricCard
                        label="Avg CTR"
                        value={
                          overview.gsc.queries.length > 0
                            ? `${(
                                (overview.gsc.queries.reduce((sum, q) => sum + q.clicks, 0) /
                                  overview.gsc.queries.reduce((sum, q) => sum + q.impressions, 0)) *
                                100
                              ).toFixed(2)}%`
                            : '—'
                        }
                      />
                      <MetricCard label="Queries" value={overview.gsc.queries.length.toString()} />
                    </div>
                  </div>

                  {overview.gsc.queries.length > 0 && (
                    <DataTable
                      title="Top Search Queries"
                      columns={['Query', 'Clicks', 'Impressions', 'CTR', 'Position']}
                      rows={overview.gsc.queries.slice(0, 15).map((q) => [
                        q.query,
                        q.clicks.toLocaleString(),
                        q.impressions.toLocaleString(),
                        q.ctr ? `${(q.ctr * 100).toFixed(2)}%` : '—',
                        q.position?.toFixed(1) ?? '—',
                      ])}
                    />
                  )}

                  {overview.gsc.pages.length > 0 && (
                    <DataTable
                      title="Top Pages in Search"
                      columns={['URL', 'Clicks', 'Impressions', 'CTR', 'Position']}
                      rows={overview.gsc.pages.slice(0, 10).map((p) => [
                        p.url.replace(/^https?:\/\/[^/]+/, ''),
                        p.clicks.toLocaleString(),
                        p.impressions.toLocaleString(),
                        p.ctr ? `${(p.ctr * 100).toFixed(2)}%` : '—',
                        p.position?.toFixed(1) ?? '—',
                      ])}
                    />
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'funnel' && overview.funnel && (
            <>
              {/* Funnel Visualization */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-6">Growth Funnel</h3>
                <div className="space-y-4">
                  {overview.funnel.stages.map((stage, idx) => {
                    const maxValue = Math.max(...overview.funnel!.stages.map((s) => s.value));
                    const percentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
                    const changePercent =
                      stage.prevValue && stage.prevValue > 0
                        ? ((stage.value - stage.prevValue) / stage.prevValue) * 100
                        : null;

                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-300">{stage.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-100">
                              {stage.value.toLocaleString()}
                            </span>
                            {changePercent !== null && (
                              <span
                                className={`text-xs ${
                                  changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {changePercent >= 0 ? '+' : ''}
                                {changePercent.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-8 bg-slate-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        {idx < overview.funnel!.stages.length - 1 && (
                          <div className="flex justify-end text-xs text-slate-500 mt-1">
                            {stage.value > 0 && overview.funnel!.stages[idx + 1].value > 0 && (
                              <span>
                                → {((overview.funnel!.stages[idx + 1].value / stage.value) * 100).toFixed(1)}%
                                conversion
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-6">
          {/* Search AI Insights (when on Search tab) */}
          {activeTab === 'search' && (
            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-lg p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <h2 className="text-lg font-semibold text-purple-100">Search AI Insights</h2>
              </div>

              {searchInsightsLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
                  <p className="text-purple-200 text-sm mt-3">Analyzing search data...</p>
                </div>
              )}

              {!searchInsights && !searchInsightsLoading && gscSnapshot && (
                <div className="text-center py-8">
                  <p className="text-purple-200 text-sm">No search insights available yet.</p>
                  <button
                    onClick={() => fetchSearchInsights(gscSnapshot)}
                    className="mt-3 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded-lg text-sm transition-colors"
                  >
                    Generate Insights
                  </button>
                </div>
              )}

              {searchInsights && !searchInsightsLoading && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-purple-100 leading-relaxed">{searchInsights.summary}</div>

                  {/* Headline Metrics */}
                  {searchInsights.headlineMetrics && searchInsights.headlineMetrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {searchInsights.headlineMetrics.slice(0, 4).map((metric, idx) => (
                        <div key={idx} className="bg-purple-500/10 rounded p-2 text-center">
                          <div className="text-xs text-purple-300">{metric.label}</div>
                          <div className="text-sm font-bold text-purple-100">{metric.value}</div>
                          {metric.changeVsPreviousPeriod && (
                            <div className={`text-xs ${
                              metric.changeVsPreviousPeriod.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {metric.changeVsPreviousPeriod}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Wins */}
                  {searchInsights.quickWins && searchInsights.quickWins.length > 0 && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Quick Wins
                      </h3>
                      <ul className="space-y-2">
                        {searchInsights.quickWins.slice(0, 4).map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-purple-100">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Insights */}
                  {searchInsights.keyInsights && searchInsights.keyInsights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-purple-100 mb-2">Key Insights</h3>
                      <div className="space-y-2">
                        {searchInsights.keyInsights.slice(0, 4).map((insight, idx) => (
                          <div
                            key={idx}
                            className={`border rounded p-3 ${
                              insight.type === 'opportunity'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : insight.type === 'warning'
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-slate-900/50 border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  insight.type === 'opportunity'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : insight.type === 'warning'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {insight.type}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                            {insight.evidence && (
                              <div className="text-xs text-slate-500 mt-2 italic">{insight.evidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experiments */}
                  {searchInsights.experiments && searchInsights.experiments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-purple-100 mb-2">Suggested Experiments</h3>
                      <div className="space-y-2">
                        {searchInsights.experiments.slice(0, 2).map((exp, idx) => (
                          <div
                            key={idx}
                            className="bg-indigo-500/10 border border-indigo-500/30 rounded p-3"
                          >
                            <div className="font-medium text-indigo-200 text-sm">{exp.name}</div>
                            <div className="text-xs text-indigo-300/70 mt-1">{exp.hypothesis}</div>
                            <div className="text-xs text-indigo-400 mt-2">
                              Success: {exp.successMetric}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* General AI Insights (for non-Search tabs) */}
          {activeTab !== 'search' && (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                </svg>
                <h2 className="text-lg font-semibold text-amber-100">AI Insights</h2>
              </div>

              {loadingInsights && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-amber-200 text-sm mt-3">Analyzing data...</p>
                </div>
              )}

              {aiInsights && !loadingInsights && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-amber-100 leading-relaxed">{aiInsights.summary}</div>

                  {/* Quick Wins */}
                  {aiInsights.quickWins.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Quick Wins
                      </h3>
                      <ul className="space-y-2">
                        {aiInsights.quickWins.slice(0, 3).map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-100">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Issues */}
                  {aiInsights.keyIssues.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Issues</h3>
                      <div className="space-y-2">
                        {aiInsights.keyIssues.slice(0, 3).map((issue, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900/50 border border-slate-700 rounded p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  issue.category === 'traffic'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : issue.category === 'search'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : issue.category === 'funnel'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {issue.category}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200 text-sm">{issue.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{issue.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opportunities */}
                  {aiInsights.opportunities.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Opportunities</h3>
                      <div className="space-y-2">
                        {aiInsights.opportunities.slice(0, 3).map((opp, idx) => (
                          <div
                            key={idx}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3"
                          >
                            <div className="font-medium text-emerald-200 text-sm">{opp.title}</div>
                            <div className="text-xs text-emerald-300/70 mt-1">{opp.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Work Items */}
                  {aiInsights.suggestedWorkItems.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Suggested Work</h3>
                      <div className="space-y-2">
                        {aiInsights.suggestedWorkItems.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm bg-slate-900/50 border border-slate-700 rounded p-2"
                          >
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                item.priority === 'high'
                                  ? 'bg-red-500/20 text-red-300'
                                  : item.priority === 'medium'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-500/20 text-slate-300'
                              }`}
                            >
                              {item.priority}
                            </span>
                            <div>
                              <div className="font-medium text-slate-200">{item.title}</div>
                              <div className="text-xs text-slate-400">{item.area}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricCard({
  label,
  value,
  status = 'normal',
}: {
  label: string;
  value: string;
  status?: 'normal' | 'warning' | 'good';
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${
          status === 'warning'
            ? 'text-amber-400'
            : status === 'good'
            ? 'text-emerald-400'
            : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-slate-800">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`${
                    idx === 0 ? 'text-left' : 'text-right'
                  } px-6 py-3 text-xs font-semibold text-slate-400 uppercase`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-800/50 last:border-0">
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={`px-6 py-3 ${
                      cellIdx === 0
                        ? 'text-slate-200 font-mono text-xs truncate max-w-xs'
                        : 'text-right text-slate-300'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsList({ alerts, severity }: { alerts: AnalyticsAlert[]; severity: string }) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        severity === 'warning'
          ? 'bg-amber-500/10 border-amber-500/30'
          : severity === 'critical'
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-blue-500/10 border-blue-500/30'
      }`}
    >
      <h3
        className={`text-sm font-semibold mb-3 ${
          severity === 'warning'
            ? 'text-amber-300'
            : severity === 'critical'
            ? 'text-red-300'
            : 'text-blue-300'
        }`}
      >
        {alerts.length} {severity.charAt(0).toUpperCase() + severity.slice(1)}
        {alerts.length !== 1 && 's'}
      </h3>
      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert) => (
          <div key={alert.id} className="text-sm text-slate-300">
            <span className="font-medium">{alert.title}</span>
            {alert.hint && <p className="text-xs text-slate-400 mt-0.5">💡 {alert.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
