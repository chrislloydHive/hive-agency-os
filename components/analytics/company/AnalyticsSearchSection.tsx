// components/analytics/company/AnalyticsSearchSection.tsx
// Search subtab for Company Analytics - Search Console data
//
// Displays:
// - Search performance overview (clicks, impressions, CTR, position)
// - Top search queries
// - Top pages in search
// - Device breakdown (optional)

'use client';

import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';

interface AnalyticsSearchSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function AnalyticsSearchSection({
  snapshot,
  isLoading,
  error,
  onRetry,
}: AnalyticsSearchSectionProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="h-4 w-32 bg-slate-700 rounded mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-16 bg-slate-700 rounded mb-2" />
                <div className="h-8 w-20 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl h-64" />
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl h-64" />
      </div>
    );
  }

  // Error state
  if (error) {
    const isNotConfigured = error.includes('not configured');
    return (
      <div className={`${isNotConfigured ? 'bg-slate-800/50 border-slate-700' : 'bg-red-500/10 border-red-500/30'} border rounded-xl p-6 text-center`}>
        <p className={isNotConfigured ? 'text-slate-400' : 'text-red-400'}>
          {isNotConfigured
            ? 'Search Console is not configured for this company.'
            : error}
        </p>
        {isNotConfigured ? (
          <p className="text-slate-500 text-sm mt-2">
            Add a Search Console Site URL to the company record to enable search analytics.
          </p>
        ) : onRetry ? (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        ) : null}
      </div>
    );
  }

  // Not connected state
  if (!snapshot?.gscConnected) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">
          Search Console Not Connected
        </h3>
        <p className="text-sm text-slate-500">
          Connect Search Console to view search performance data.
        </p>
      </div>
    );
  }

  // No data state
  if (!snapshot.searchConsole) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No Search Console data available for the selected period.</p>
        <p className="text-sm text-slate-500 mt-2">
          Note: Search Console data has a 2-3 day delay.
        </p>
      </div>
    );
  }

  const { metrics, topQueries, topPages, devices } = snapshot.searchConsole;
  const comparison = snapshot.comparison?.searchConsole;

  return (
    <div className="space-y-6">
      {/* Search Performance Overview */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Search Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricItem
            label="Clicks"
            value={metrics.clicks}
            change={comparison?.clicksChange}
          />
          <MetricItem
            label="Impressions"
            value={metrics.impressions}
            change={comparison?.impressionsChange}
          />
          <MetricItem
            label="Avg CTR"
            value={metrics.ctr}
            format="percentage"
            change={comparison?.ctrChange}
          />
          <MetricItem
            label="Avg Position"
            value={metrics.avgPosition}
            format="position"
            change={comparison?.positionChange}
            invertChange // Lower position is better
          />
        </div>
      </div>

      {/* Device Breakdown */}
      {devices && devices.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Performance by Device
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div key={device.device} className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1 capitalize">{device.device.toLowerCase()}</div>
                <div className="text-lg font-bold text-slate-100">
                  {device.clicks.toLocaleString()} clicks
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  CTR: {(device.ctr * 100).toFixed(2)}% • Pos: {device.position?.toFixed(1) ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Search Queries */}
      {topQueries.length > 0 && (
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
                {topQueries.slice(0, 15).map((query, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2 text-slate-200">{query.query}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{query.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{query.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{(query.ctr * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right text-slate-300">{query.position?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Pages in Search */}
      {topPages.length > 0 && (
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
                {topPages.slice(0, 10).map((page, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">
                      {extractPath(page.page)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">{page.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{page.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{(page.ctr * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right text-slate-300">{page.position?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Opportunity Highlights */}
      <OpportunityHighlights queries={topQueries} />
    </div>
  );
}

// Helper component for metric items
function MetricItem({
  label,
  value,
  format = 'number',
  change,
  invertChange = false,
}: {
  label: string;
  value: number;
  format?: 'number' | 'percentage' | 'position';
  change?: number;
  invertChange?: boolean;
}) {
  const formattedValue = (() => {
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(2)}%`;
      case 'position':
        return value.toFixed(1);
      default:
        return value.toLocaleString();
    }
  })();

  const isPositiveChange = invertChange ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const isNegativeChange = invertChange ? (change ?? 0) > 0 : (change ?? 0) < 0;

  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-100">{formattedValue}</div>
      {change !== undefined && Math.abs(change) >= 0.1 && (
        <div className={`text-xs mt-1 ${
          isPositiveChange ? 'text-emerald-400' :
          isNegativeChange ? 'text-red-400' :
          'text-slate-500'
        }`}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// Helper to extract path from full URL
function extractPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname || '/';
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, '') || '/';
  }
}

// Opportunity highlights component
function OpportunityHighlights({
  queries,
}: {
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
}) {
  // Find queries with high impressions but low CTR (opportunities)
  const opportunities = queries
    .filter(q => q.impressions >= 100 && q.ctr < 0.02 && q.position > 5 && q.position < 20)
    .slice(0, 3);

  // Find queries ranking on page 1 with good volume
  const winners = queries
    .filter(q => q.position <= 10 && q.clicks >= 5)
    .slice(0, 3);

  if (opportunities.length === 0 && winners.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Ranking Opportunities
          </h3>
          <p className="text-xs text-amber-200/70 mb-3">
            Queries with high impressions but low CTR - optimize these pages.
          </p>
          <div className="space-y-2">
            {opportunities.map((q, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg p-3">
                <div className="font-medium text-slate-200 text-sm truncate">{q.query}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Pos: {q.position.toFixed(1)} • {q.impressions.toLocaleString()} impressions • {(q.ctr * 100).toFixed(2)}% CTR
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winners */}
      {winners.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Top Performers
          </h3>
          <p className="text-xs text-emerald-200/70 mb-3">
            Queries ranking on page 1 - protect and expand these.
          </p>
          <div className="space-y-2">
            {winners.map((q, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg p-3">
                <div className="font-medium text-slate-200 text-sm truncate">{q.query}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Pos: {q.position.toFixed(1)} • {q.clicks.toLocaleString()} clicks • {(q.ctr * 100).toFixed(2)}% CTR
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
