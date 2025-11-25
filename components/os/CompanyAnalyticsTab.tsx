'use client';

// components/os/CompanyAnalyticsTab.tsx
// Analytics tab for company detail page - shows GA4 + Search Console data

import { useState, useEffect } from 'react';
import type { GrowthAnalyticsSnapshot } from '@/lib/analytics/models';

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
  const [snapshot, setSnapshot] = useState<GrowthAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDays, setActiveDays] = useState(30);

  const hasGa4 = !!ga4PropertyId;
  const hasSearchConsole = !!searchConsoleSiteUrl;
  const hasAnyConnection = hasGa4 || hasSearchConsole;

  // Fetch analytics data
  const fetchAnalytics = async (days: number) => {
    if (!hasAnyConnection) return;

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      // Use company-specific analytics endpoint
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

  useEffect(() => {
    if (hasAnyConnection) {
      fetchAnalytics(activeDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasAnyConnection]);

  const handleRangeChange = (days: number) => {
    setActiveDays(days);
    fetchAnalytics(days);
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
      {/* Connection Status */}
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
                disabled={loading}
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
            onClick={() => fetchAnalytics(activeDays)}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Analytics Data */}
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

          {/* Search Queries */}
          {snapshot.searchQueries.length > 0 && (
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
                    {snapshot.searchQueries.slice(0, 10).map((query, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-4 py-2 text-slate-200">{query.query}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{query.clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{query.impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{(query.ctr * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right text-slate-300">{query.position?.toFixed(1) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Data Message */}
          {snapshot.traffic.users === null && snapshot.channels.length === 0 && snapshot.searchQueries.length === 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-slate-500">No analytics data available for this period.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
