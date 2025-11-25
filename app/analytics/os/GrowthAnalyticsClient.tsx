'use client';

// app/analytics/os/GrowthAnalyticsClient.tsx
// Client component for Growth Analytics with interactive UI and AI insights

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { GrowthAnalyticsSnapshot, AIInsights } from '@/lib/analytics/models';
import type { AnalyticsAnomaly, AnalyticsInsight } from '@/lib/os/types';

interface SiteInfo {
  id: string;
  name: string;
  domain: string;
  color: string;
  hasGa4: boolean;
  hasSearchConsole: boolean;
}

interface GrowthAnalyticsClientProps {
  initialSnapshot: GrowthAnalyticsSnapshot | null;
  initialRange: { startDate: string; endDate: string };
  initialSites: SiteInfo[];
  initialSiteId?: string;
  error: string | null;
}

// Calculate days from date range
const getDaysFromRange = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export function GrowthAnalyticsClient({
  initialSnapshot,
  initialRange,
  initialSites,
  initialSiteId,
  error: initialError,
}: GrowthAnalyticsClientProps) {
  const [range, setRange] = useState(initialRange);
  const [snapshot, setSnapshot] = useState<GrowthAnalyticsSnapshot | null>(initialSnapshot);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [anomalies, setAnomalies] = useState<AnalyticsAnomaly[]>([]);
  const [workspaceInsights, setWorkspaceInsights] = useState<AnalyticsInsight[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(initialError);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);
  const [sites] = useState<SiteInfo[]>(initialSites);
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(initialSiteId);

  const activeDays = useMemo(() => getDaysFromRange(range.startDate, range.endDate), [range]);
  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId), [sites, selectedSiteId]);

  // Fetch AI insights on mount if we have a snapshot
  useEffect(() => {
    if (snapshot && !insights && !loadingInsights) {
      fetchInsights(snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInsights = async (snap: GrowthAnalyticsSnapshot) => {
    setLoadingInsights(true);
    setErrorInsights(null);

    try {
      const response = await fetch('/api/os/analytics/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setInsights(data.insights);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setErrorInsights(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fetch workspace analytics (anomalies and insights)
  const fetchWorkspaceAnalytics = async () => {
    try {
      const response = await fetch('/api/os/analytics/workspace');
      if (!response.ok) return;

      const data = await response.json();
      if (data.anomalies) setAnomalies(data.anomalies);
      if (data.insights) setWorkspaceInsights(data.insights);
    } catch (err) {
      console.warn('Failed to fetch workspace analytics:', err);
    }
  };

  // Fetch workspace analytics on mount
  useEffect(() => {
    fetchWorkspaceAnalytics();
  }, []);

  const handleRangeChange = async (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const newRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };

    setRange(newRange);
    await fetchData(newRange, selectedSiteId);
  };

  const handleSiteChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    await fetchData(range, siteId);
  };

  const fetchData = async (dateRange: { startDate: string; endDate: string }, siteId?: string) => {
    setLoadingMetrics(true);
    setErrorMetrics(null);
    setInsights(null); // Clear old insights

    try {
      let url = `/api/analytics/growth?start=${dateRange.startDate}&end=${dateRange.endDate}`;
      if (siteId) {
        url += `&site=${siteId}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);

      // Fetch new insights
      fetchInsights(data.snapshot);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setErrorMetrics(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Get "This Week, Do" actions - highest impact, lowest effort
  const thisWeekActions = useMemo(() => {
    if (!insights?.recommendedActions) return [];

    // Filter for high impact, low effort actions
    return insights.recommendedActions
      .filter((a) => a.impact === 'high' && a.effort === 'low')
      .slice(0, 3);
  }, [insights]);

  if (errorMetrics) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400 font-medium">Error loading analytics</p>
        <p className="text-red-300 text-sm mt-2">{errorMetrics}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
        <p className="text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Site Selector & Date Range Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* Site Selector */}
          {sites.length > 1 && (
            <div className="flex items-center gap-2">
              {sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleSiteChange(site.id)}
                  disabled={loadingMetrics}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSiteId === site.id
                      ? site.color === 'amber'
                        ? 'bg-amber-500 text-slate-900'
                        : site.color === 'purple'
                        ? 'bg-purple-500 text-white'
                        : site.color === 'yellow'
                        ? 'bg-yellow-500 text-slate-900'
                        : 'bg-slate-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-400">
            Showing data for the last <span className={`font-medium ${
              selectedSite?.color === 'amber' ? 'text-amber-400' :
              selectedSite?.color === 'purple' ? 'text-purple-400' :
              selectedSite?.color === 'yellow' ? 'text-yellow-400' : 'text-amber-400'
            }`}>{activeDays} days</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => handleRangeChange(days)}
              disabled={loadingMetrics}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDays === days
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {days} Days
            </button>
          ))}
          {loadingMetrics && (
            <span className="text-sm text-slate-400 ml-2">Loading...</span>
          )}
        </div>
      </div>

      {/* Anomalies Alert Banner */}
      {anomalies.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-300">
                {anomalies.length} Anomal{anomalies.length === 1 ? 'y' : 'ies'} Detected
              </h3>
              <div className="mt-2 space-y-1">
                {anomalies.slice(0, 3).map((anomaly) => (
                  <div key={anomaly.id} className="flex items-center gap-2 text-sm">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      anomaly.severity === 'high' ? 'bg-red-500/20 text-red-300' :
                      anomaly.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {anomaly.severity}
                    </span>
                    <span className="text-slate-300">{anomaly.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Insights Cards */}
      {workspaceInsights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaceInsights.filter(i => i.impact === 'high').slice(0, 3).map((insight) => (
            <div key={insight.id} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  insight.area === 'traffic' ? 'bg-blue-500/20 text-blue-300' :
                  insight.area === 'conversion' ? 'bg-emerald-500/20 text-emerald-300' :
                  insight.area === 'seo' ? 'bg-purple-500/20 text-purple-300' :
                  insight.area === 'content' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>
                  {insight.area}
                </span>
              </div>
              <h4 className="text-sm font-medium text-slate-200 mb-1">{insight.title}</h4>
              <p className="text-xs text-slate-400 line-clamp-2">{insight.description}</p>
              {insight.recommendation && (
                <p className="text-xs text-emerald-400 mt-2 line-clamp-1">
                  → {insight.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Main Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Traffic Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Traffic Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</div>
                <div className="text-2xl font-bold text-slate-100">
                  {snapshot.traffic.users?.toLocaleString() ?? '—'}
                </div>
                {/* TODO: Add delta metric when available */}
                <div className="text-xs text-slate-500 mt-1">—</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</div>
                <div className="text-2xl font-bold text-slate-100">
                  {snapshot.traffic.sessions?.toLocaleString() ?? '—'}
                </div>
                {/* TODO: Add delta metric when available */}
                <div className="text-xs text-slate-500 mt-1">—</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pageviews</div>
                <div className="text-2xl font-bold text-slate-100">
                  {snapshot.traffic.pageviews?.toLocaleString() ?? '—'}
                </div>
                {/* TODO: Add delta metric when available */}
                <div className="text-xs text-slate-500 mt-1">—</div>
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

          {/* Channels Table */}
          {snapshot.channels.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Traffic by Channel</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Channel
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Sessions
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Users
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Conversions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.channels.map((channel, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-6 py-3 text-slate-200 font-medium">{channel.channel}</td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {channel.sessions.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {channel.users?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {channel.conversions?.toLocaleString() ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Landing Pages Table */}
          {snapshot.topLandingPages.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Top Landing Pages</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Page
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Sessions
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Conversions
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Avg Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.topLandingPages.slice(0, 10).map((page, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-6 py-3 text-slate-200 font-mono text-xs truncate max-w-xs">
                          {page.path}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {page.sessions.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {page.conversions?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {page.avgEngagementTimeSeconds
                            ? `${Math.round(page.avgEngagementTimeSeconds)}s`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search Queries Table */}
          {snapshot.searchQueries.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Top Search Queries</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Query
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Clicks
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Impressions
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        CTR
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Position
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.searchQueries.slice(0, 10).map((query, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-6 py-3 text-slate-200">{query.query}</td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {query.clicks.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {query.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {(query.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {query.position?.toFixed(1) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search Pages Table */}
          {snapshot.searchPages.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Top Pages in Search</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        URL
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Clicks
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        CTR
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase">
                        Position
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.searchPages.slice(0, 10).map((page, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-6 py-3 text-slate-200 font-mono text-xs truncate max-w-xs">
                          {page.url}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {page.clicks.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {(page.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-3 text-right text-slate-300">
                          {page.position?.toFixed(1) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1/3 width) - AI Insights */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
              </svg>
              <h2 className="text-lg font-semibold text-amber-100">AI Growth Recommendations</h2>
            </div>

            {loadingInsights && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                <p className="text-amber-200 text-sm mt-3">Analyzing your data...</p>
              </div>
            )}

            {errorInsights && !loadingInsights && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <p className="text-red-400 text-sm">{errorInsights}</p>
              </div>
            )}

            {insights && !loadingInsights && (
              <div className="space-y-5">
                {/* This Week, Do: Section */}
                {thisWeekActions.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      This week, do:
                    </h3>
                    <ul className="space-y-2">
                      {thisWeekActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-amber-100">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>{action.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                <div className="text-sm text-amber-100 leading-relaxed">
                  {insights.summary}
                </div>

                {/* Key Issues */}
                {insights.issues.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Issues</h3>
                    <div className="space-y-3">
                      {insights.issues.map((issue, idx) => (
                        <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded p-3">
                          <div className="font-medium text-slate-200 text-sm mb-1">{issue.title}</div>
                          <div className="text-xs text-slate-400 mb-1">{issue.detail}</div>
                          <div className="text-xs text-slate-500 italic">{issue.evidence}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Actions */}
                {insights.recommendedActions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-100 mb-2">Recommended Actions</h3>
                    <div className="space-y-3">
                      {insights.recommendedActions.map((action, idx) => (
                        <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="font-medium text-slate-200 text-sm">{action.title}</div>
                            <div className="flex gap-1 flex-shrink-0">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  action.impact === 'high'
                                    ? 'bg-green-500/20 text-green-300'
                                    : action.impact === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {action.impact}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                {action.effort}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-amber-400 mb-2 uppercase tracking-wide">
                            {action.area}
                          </div>
                          <ul className="text-xs text-slate-400 space-y-1">
                            {action.steps.map((step, stepIdx) => (
                              <li key={stepIdx}>• {step}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Link to DMA Insights */}
            <div className="mt-6 pt-6 border-t border-amber-500/20">
              <Link
                href="/dma/insights"
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View DMA Funnel Insights
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
