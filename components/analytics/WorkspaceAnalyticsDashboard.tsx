'use client';

// components/analytics/WorkspaceAnalyticsDashboard.tsx
// Global Workspace Analytics Dashboard
//
// Shows aggregated analytics across all companies in the workspace,
// including top performers, attention-needed alerts, and funnel metrics.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { WorkspaceAnalyticsSummary, AnalyticsDateRangePreset } from '@/lib/analytics/types';

export function WorkspaceAnalyticsDashboard() {
  const [summary, setSummary] = useState<WorkspaceAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<AnalyticsDateRangePreset>('30d');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/v2/workspace?range=${range}`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch workspace analytics');
      }

      setSummary(data.summary);
    } catch (err) {
      console.error('[WorkspaceAnalytics] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRangeChange = (newRange: AnalyticsDateRangePreset) => {
    setRange(newRange);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Analytics Overview</h2>
          <p className="text-slate-400 text-sm mt-1">
            Aggregated metrics across all companies
          </p>
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
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors ml-2"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !summary && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-slate-400 mt-4">Loading workspace analytics...</p>
          <p className="text-slate-500 text-sm mt-2">This may take a minute as we aggregate all companies.</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {summary && (
        <>
          {/* Coverage Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Companies</div>
              <div className="text-2xl font-bold text-slate-100">{summary.totals.companies}</div>
              <div className="text-xs text-slate-400 mt-1">In workspace</div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">GA4 Connected</div>
              <div className="text-2xl font-bold text-emerald-400">{summary.totals.companiesWithGa4}</div>
              <div className="text-xs text-slate-400 mt-1">
                {summary.totals.companies > 0 ? Math.round((summary.totals.companiesWithGa4 / summary.totals.companies) * 100) : 0}% coverage
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">GSC Connected</div>
              <div className="text-2xl font-bold text-blue-400">{summary.totals.companiesWithGsc}</div>
              <div className="text-xs text-slate-400 mt-1">
                {summary.totals.companies > 0 ? Math.round((summary.totals.companiesWithGsc / summary.totals.companies) * 100) : 0}% coverage
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Attention Needed</div>
              <div className={`text-2xl font-bold ${summary.attentionNeeded.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {summary.attentionNeeded.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Companies</div>
            </div>
          </div>

          {/* Totals Row */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Workspace Totals ({range})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Sessions</div>
                <div className="text-2xl font-bold text-slate-100">
                  {summary.totals.totalSessions.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-400 mt-1">All GA4</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Users</div>
                <div className="text-2xl font-bold text-slate-100">
                  {summary.totals.totalUsers.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Conversions</div>
                <div className="text-2xl font-bold text-purple-400">
                  {summary.totals.totalConversions.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Search Clicks</div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary.totals.totalClicks.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase mb-1">Impressions</div>
                <div className="text-2xl font-bold text-slate-100">
                  {summary.totals.totalImpressions.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Funnel Totals */}
          {(summary.totals.totalDmaStarted > 0 || summary.totals.totalGapIaStarted > 0 || summary.totals.totalGapFullStarted > 0) && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Lead Generation Funnels
              </h3>
              {/* DMA & GAP-IA Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">DMA Started</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {summary.totals.totalDmaStarted.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">DMA Completed</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {summary.totals.totalDmaCompleted.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {summary.totals.totalDmaStarted > 0
                      ? `${((summary.totals.totalDmaCompleted / summary.totals.totalDmaStarted) * 100).toFixed(0)}% rate`
                      : '0% rate'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">GAP-IA Started</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {summary.totals.totalGapIaStarted.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">GAP-IA Completed</div>
                  <div className="text-2xl font-bold text-amber-400">
                    {summary.totals.totalGapIaCompleted.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {summary.totals.totalGapIaStarted > 0
                      ? `${((summary.totals.totalGapIaCompleted / summary.totals.totalGapIaStarted) * 100).toFixed(0)}% rate`
                      : '0% rate'}
                  </div>
                </div>
              </div>
              {/* Full GAP Funnel Row */}
              {summary.totals.totalGapFullStarted > 0 && (
                <>
                  <div className="border-t border-slate-700 pt-4 mb-4">
                    <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-3">Full GAP Funnel</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">GAP Started</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {summary.totals.totalGapFullStarted.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Processing</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {summary.totals.totalGapFullProcessingStarted.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">GAP Complete</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {summary.totals.totalGapFullComplete.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {summary.totals.totalGapFullStarted > 0
                          ? `${((summary.totals.totalGapFullComplete / summary.totals.totalGapFullStarted) * 100).toFixed(0)}% rate`
                          : '0%'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Review CTA Clicked</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {summary.totals.totalGapFullReviewCtaClicked.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {summary.totals.totalGapFullComplete > 0
                          ? `${((summary.totals.totalGapFullReviewCtaClicked / summary.totals.totalGapFullComplete) * 100).toFixed(0)}% of complete`
                          : '0%'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Full Funnel Rate</div>
                      <div className="text-2xl font-bold text-amber-400">
                        {summary.totals.totalGapFullStarted > 0
                          ? `${((summary.totals.totalGapFullReviewCtaClicked / summary.totals.totalGapFullStarted) * 100).toFixed(1)}%`
                          : '0%'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Start to CTA</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Companies */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Top Companies by Sessions
                </h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {summary.topCompanies.bySessions.length > 0 ? (
                  summary.topCompanies.bySessions.map((company, idx) => (
                    <Link
                      key={company.companyId}
                      href={`/c/${company.companyId}/analytics`}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-300">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{company.companyName}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-sm">
                        {company.value.toLocaleString()}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* Top by Search Clicks */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Top Companies by Search Clicks
                </h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {summary.topCompanies.bySearchClicks.length > 0 ? (
                  summary.topCompanies.bySearchClicks.map((company, idx) => (
                    <Link
                      key={company.companyId}
                      href={`/c/${company.companyId}/analytics`}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{company.companyName}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-sm">
                        {company.value.toLocaleString()}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* Top by Conversions */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Top Companies by Conversions
                </h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {summary.topCompanies.byConversions.length > 0 ? (
                  summary.topCompanies.byConversions.map((company, idx) => (
                    <Link
                      key={company.companyId}
                      href={`/c/${company.companyId}/analytics`}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{company.companyName}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-sm">
                        {company.value.toLocaleString()}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* Top by DMA Completions */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Top Companies by DMA Completions
                </h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {summary.topCompanies.byDmaCompletions.length > 0 ? (
                  summary.topCompanies.byDmaCompletions.map((company, idx) => (
                    <Link
                      key={company.companyId}
                      href={`/c/${company.companyId}/analytics`}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{company.companyName}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-sm">
                        {company.value.toLocaleString()}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-slate-500 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* Top by GAP Review CTA Clicks */}
            {summary.topCompanies.byGapReviewCtaClicks && summary.topCompanies.byGapReviewCtaClicks.length > 0 && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                    Top Companies by GAP Review CTA Clicks
                  </h3>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {summary.topCompanies.byGapReviewCtaClicks.map((company, idx) => (
                    <Link
                      key={company.companyId}
                      href={`/c/${company.companyId}/analytics`}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{company.companyName}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-sm">
                        {company.value.toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Company Funnel Breakdown Table */}
          {summary.companyFunnelBreakdown && summary.companyFunnelBreakdown.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Per-Company Funnel Performance
                </h3>
                <p className="text-xs text-slate-500 mt-1">Companies with funnel activity, sorted by total volume</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
                      <th className="text-left p-3 font-medium">Company</th>
                      <th className="text-right p-3 font-medium">DMA Started</th>
                      <th className="text-right p-3 font-medium">DMA Complete</th>
                      <th className="text-right p-3 font-medium">DMA Rate</th>
                      <th className="text-right p-3 font-medium">GAP Started</th>
                      <th className="text-right p-3 font-medium">GAP Complete</th>
                      <th className="text-right p-3 font-medium">Review CTA</th>
                      <th className="text-right p-3 font-medium">CTA Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {summary.companyFunnelBreakdown.map((company) => (
                      <tr key={company.companyId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <Link
                            href={`/c/${company.companyId}/analytics`}
                            className="text-slate-200 hover:text-amber-400 transition-colors"
                          >
                            {company.companyName}
                          </Link>
                        </td>
                        <td className="text-right p-3 font-mono text-slate-300">
                          {company.dmaStarted.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-emerald-400">
                          {company.dmaCompleted.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-slate-400">
                          {(company.dmaCompletionRate * 100).toFixed(0)}%
                        </td>
                        <td className="text-right p-3 font-mono text-slate-300">
                          {company.gapFullStarted.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-emerald-400">
                          {company.gapFullComplete.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-purple-400">
                          {company.gapFullReviewCtaClicked.toLocaleString()}
                        </td>
                        <td className={`text-right p-3 font-mono ${
                          company.gapReviewCtaRate < 0.05 && company.gapFullComplete >= 5
                            ? 'text-red-400'
                            : company.gapReviewCtaRate > 0.15
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                        }`}>
                          {(company.gapReviewCtaRate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attention Needed */}
          {summary.attentionNeeded.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-red-500/30">
                <h3 className="text-sm font-semibold text-red-300 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Attention Needed
                </h3>
              </div>
              <div className="divide-y divide-red-500/20">
                {summary.attentionNeeded.map((item, idx) => (
                  <Link
                    key={`${item.companyId}-${idx}`}
                    href={`/c/${item.companyId}/analytics`}
                    className="flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors"
                  >
                    <div>
                      <span className="text-red-200 font-medium">{item.companyName}</span>
                      <p className="text-red-300/70 text-sm mt-0.5">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-red-300 font-mono text-sm">
                        {item.value.toFixed(1)}%
                      </span>
                      <p className="text-red-400/50 text-xs">threshold: {item.threshold}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Generated At */}
          <div className="text-center text-xs text-slate-500">
            Generated at {new Date(summary.generatedAt).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
