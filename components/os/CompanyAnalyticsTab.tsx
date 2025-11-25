'use client';

// components/os/CompanyAnalyticsTab.tsx
// Analytics tab for company detail page - shows GA4 + Search Console data with AI insights

import { useState, useEffect } from 'react';
import type { GrowthAnalyticsSnapshot } from '@/lib/analytics/models';
import type {
  SearchConsoleSnapshot,
  SearchConsoleAIInsights,
} from '@/lib/os/searchConsole/types';

interface CompanyAnalyticsTabProps {
  companyId: string;
  companyName: string;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
}

export function CompanyAnalyticsTab({
  companyId,
  companyName,
  ga4PropertyId,
  searchConsoleSiteUrl,
}: CompanyAnalyticsTabProps) {
  // GA4 State
  const [snapshot, setSnapshot] = useState<GrowthAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search Console State
  const [gscSnapshot, setGscSnapshot] = useState<SearchConsoleSnapshot | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);

  // AI Insights State
  const [searchInsights, setSearchInsights] = useState<SearchConsoleAIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // UI State
  const [activeDays, setActiveDays] = useState(30);
  const [activeSection, setActiveSection] = useState<'traffic' | 'search'>('traffic');

  const hasGa4 = !!ga4PropertyId;
  const hasSearchConsole = !!searchConsoleSiteUrl;
  const hasAnyConnection = hasGa4 || hasSearchConsole;

  // Fetch GA4 analytics data
  const fetchAnalytics = async (days: number) => {
    if (!hasGa4) return;

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/analytics/company/${companyId}?start=${start}&end=${end}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);
    } catch (err) {
      console.error('Error fetching company analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Search Console data
  const fetchSearchConsoleData = async (days: number) => {
    if (!hasSearchConsole) return;

    setGscLoading(true);
    setGscError(null);

    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 3); // GSC has 2-3 day delay
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/os/analytics/search-console/company/${companyId}?start=${start}&end=${end}`
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
      console.error('Error fetching Search Console data:', err);
      setGscError(err instanceof Error ? err.message : 'Failed to load Search Console data');
    } finally {
      setGscLoading(false);
    }
  };

  // Fetch AI Search Insights
  const fetchSearchInsights = async (snapshot: SearchConsoleSnapshot) => {
    setInsightsLoading(true);

    try {
      const response = await fetch('/api/os/analytics/search-console/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setSearchInsights(data.insights);
    } catch (err) {
      console.warn('Error fetching AI insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (hasGa4) {
      fetchAnalytics(activeDays);
    }
    if (hasSearchConsole) {
      fetchSearchConsoleData(activeDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleRangeChange = (days: number) => {
    setActiveDays(days);
    if (hasGa4) fetchAnalytics(days);
    if (hasSearchConsole) fetchSearchConsoleData(days);
  };

  // No connections - show setup UI
  if (!hasAnyConnection) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-slate-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            Connect Analytics
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Connect this company's GA4 property or Search Console to see
            traffic, conversions, and SEO performance.
          </p>
          <p className="text-xs text-slate-600">
            Add GA4 Property ID or Search Console URL in the company settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status + Date Range */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {hasGa4 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-sm text-slate-300">GA4 Connected</span>
                <span className="text-xs text-slate-500">({ga4PropertyId})</span>
              </div>
            )}
            {hasSearchConsole && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-sm text-slate-300">Search Console</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => handleRangeChange(days)}
                disabled={loading || gscLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeDays === days
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      {hasGa4 && hasSearchConsole && (
        <div className="border-b border-slate-800">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveSection('traffic')}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'traffic'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Traffic Analytics
            </button>
            <button
              onClick={() => setActiveSection('search')}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'search'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Search Analytics
            </button>
          </nav>
        </div>
      )}

      {/* Traffic Analytics Section (GA4) */}
      {(activeSection === 'traffic' || !hasSearchConsole) && hasGa4 && (
        <>
          {/* Loading State */}
          {loading && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
              <p className="text-slate-400 mt-4">Loading traffic analytics...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => fetchAnalytics(activeDays)}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* GA4 Analytics Data */}
          {snapshot && !loading && (
            <>
              {/* Traffic Overview */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Traffic Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.users?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.sessions?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pageviews</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.pageviews?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Session</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.avgSessionDurationSeconds
                        ? `${Math.round(snapshot.traffic.avgSessionDurationSeconds)}s`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bounce Rate</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.bounceRate
                        ? `${(snapshot.traffic.bounceRate * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Channels */}
              {snapshot.channels.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Traffic by Channel
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Channel</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Sessions</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Users</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.channels.slice(0, 8).map((channel, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-4 py-2 text-slate-200 font-medium">{channel.channel}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.sessions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.users?.toLocaleString() ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.conversions?.toLocaleString() ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Landing Pages */}
              {snapshot.topLandingPages.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Top Landing Pages
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Page</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Sessions</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.topLandingPages.slice(0, 8).map((page, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">{page.path}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{page.sessions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{page.conversions?.toLocaleString() ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Search Analytics Section */}
      {(activeSection === 'search' || !hasGa4) && hasSearchConsole && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loading State */}
            {gscLoading && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                <p className="text-slate-400 mt-4">Loading Search Console data...</p>
              </div>
            )}

            {/* Error State */}
            {gscError && !gscLoading && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <p className="text-red-400">{gscError}</p>
                <button
                  onClick={() => fetchSearchConsoleData(activeDays)}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Search Console Data */}
            {gscSnapshot && !gscLoading && (
              <>
                {/* Summary Metrics */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                    Search Performance
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Clicks</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.clicks.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Impressions</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.impressions.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg CTR</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {(gscSnapshot.summary.ctr * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Position</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.avgPosition?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Queries */}
                {gscSnapshot.topQueries.length > 0 && (
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
                          {gscSnapshot.topQueries.slice(0, 15).map((query, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                              <td className="px-4 py-2 text-slate-200">{query.query}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{(query.ctr * 100).toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.avgPosition?.toFixed(1) ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top Pages */}
                {gscSnapshot.topPages.length > 0 && (
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
                          {gscSnapshot.topPages.slice(0, 10).map((page, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                              <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">
                                {page.url.replace(/^https?:\/\/[^/]+/, '')}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{(page.ctr * 100).toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.avgPosition?.toFixed(1) ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Device Breakdown */}
                {gscSnapshot.topDevices.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                      Performance by Device
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {gscSnapshot.topDevices.map((device, idx) => (
                        <div key={idx} className="bg-slate-800/50 rounded-lg p-4">
                          <div className="text-xs text-slate-500 mb-1">{device.device}</div>
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
              </>
            )}
          </div>

          {/* AI Insights Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                </svg>
                <h2 className="text-lg font-semibold text-amber-100">Search Insights</h2>
              </div>

              {insightsLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-amber-200 text-sm mt-3">Analyzing search data...</p>
                </div>
              )}

              {!insightsLoading && !searchInsights && !gscSnapshot && (
                <p className="text-sm text-amber-200/70">
                  Search insights will appear once Search Console data loads.
                </p>
              )}

              {searchInsights && !insightsLoading && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-amber-100 leading-relaxed whitespace-pre-line">
                    {searchInsights.summary}
                  </div>

                  {/* Quick Wins */}
                  {searchInsights.quickWins.length > 0 && (
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
                        {searchInsights.quickWins.slice(0, 4).map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-100">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Insights */}
                  {searchInsights.keyInsights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Insights</h3>
                      <div className="space-y-2">
                        {searchInsights.keyInsights.slice(0, 4).map((insight, idx) => (
                          <div
                            key={idx}
                            className={`border rounded p-3 ${
                              insight.type === 'opportunity'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : insight.type === 'warning'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-slate-900/50 border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  insight.type === 'opportunity'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : insight.type === 'warning'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {insight.type}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                            {insight.evidence && (
                              <div className="text-xs text-slate-500 mt-1 italic">{insight.evidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experiments */}
                  {searchInsights.experiments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Experiments</h3>
                      <div className="space-y-2">
                        {searchInsights.experiments.slice(0, 2).map((exp, idx) => (
                          <div
                            key={idx}
                            className="bg-purple-500/10 border border-purple-500/30 rounded p-3"
                          >
                            <div className="font-medium text-purple-200 text-sm">{exp.name}</div>
                            <div className="text-xs text-purple-300/70 mt-1">{exp.hypothesis}</div>
                            <div className="text-xs text-purple-300/50 mt-1">
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
          </div>
        </div>
      )}

      {/* Search Console Not Configured Message */}
      {!hasSearchConsole && hasGa4 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-1">
                Search Console Not Connected
              </h4>
              <p className="text-sm text-slate-500">
                Add the Search Console site URL in company settings to enable Search Analytics
                and AI-powered SEO insights for {companyName}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
