// components/analytics/company/AnalyticsTrafficSection.tsx
// Traffic subtab for Company Analytics - GA4 traffic breakdown
//
// Displays:
// - Traffic overview metrics
// - Traffic by source/medium (channel breakdown)
// - Top landing pages

'use client';

import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';

interface AnalyticsTrafficSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function AnalyticsTrafficSection({
  snapshot,
  isLoading,
  error,
  onRetry,
}: AnalyticsTrafficSectionProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="h-4 w-32 bg-slate-700 rounded mb-4" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
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

  // Not connected state
  if (!snapshot?.ga4Connected) {
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">
          GA4 Not Connected
        </h3>
        <p className="text-sm text-slate-500">
          Connect a GA4 property to view traffic analytics.
        </p>
      </div>
    );
  }

  // No data state
  if (!snapshot.ga4) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No GA4 data available for the selected period.</p>
      </div>
    );
  }

  const { metrics, trafficSources, channelTraffic, topPages, deviceBreakdown } = snapshot.ga4;
  const comparison = snapshot.comparison?.ga4;

  return (
    <div className="space-y-6">
      {/* Traffic Overview */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Traffic Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <MetricItem
            label="Users"
            value={metrics.users}
            change={comparison?.usersChange}
          />
          <MetricItem
            label="Sessions"
            value={metrics.sessions}
            change={comparison?.sessionsChange}
          />
          <MetricItem
            label="Pageviews"
            value={metrics.pageviews}
          />
          <MetricItem
            label="Avg Session"
            value={formatDuration(metrics.avgSessionDuration)}
            isFormatted
          />
          <MetricItem
            label="Bounce Rate"
            value={metrics.bounceRate}
            format="percentage"
            change={comparison?.bounceRateChange}
            invertChange
          />
        </div>
      </div>

      {/* Device Breakdown */}
      {deviceBreakdown.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Traffic by Device
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {deviceBreakdown.map((device) => (
              <div key={device.device} className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DeviceIcon device={device.device} />
                  <span className="text-sm font-medium text-slate-200 capitalize">
                    {device.device}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {device.sessions.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {device.users.toLocaleString()} users • {(device.bounceRate * 100).toFixed(1)}% bounce
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traffic by Channel */}
      {channelTraffic && channelTraffic.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Traffic by Channel
          </h3>
          <div className="space-y-3">
            {channelTraffic.map((channel) => (
              <div key={channel.channel} className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-300 capitalize font-medium">
                  {channel.channel}
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        channel.channel === 'organic' ? 'bg-emerald-500' :
                        channel.channel === 'paid' ? 'bg-purple-500' :
                        channel.channel === 'social' ? 'bg-blue-500' :
                        channel.channel === 'email' ? 'bg-amber-500' :
                        channel.channel === 'referral' ? 'bg-cyan-500' :
                        channel.channel === 'direct' ? 'bg-slate-500' :
                        'bg-slate-600'
                      }`}
                      style={{ width: `${channel.percentOfTotal * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right text-sm text-slate-300 font-mono">
                  {channel.sessions.toLocaleString()}
                </div>
                <div className="w-16 text-right text-xs text-slate-500">
                  {(channel.percentOfTotal * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traffic by Source */}
      {trafficSources.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Traffic by Source / Medium
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
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.slice(0, 10).map((source, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2 text-slate-200">
                      <span className="font-medium">{source.source}</span>
                      <span className="text-slate-500"> / {source.medium}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {source.sessions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {source.users.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {source.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {(source.bounceRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Landing Pages */}
      {topPages.length > 0 && (
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
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Avg Time</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Bounce</th>
                </tr>
              </thead>
              <tbody>
                {topPages.slice(0, 10).map((page, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">
                      {page.path}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {page.pageviews.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {page.users.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {formatDuration(page.avgTimeOnPage)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {(page.bounceRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  isFormatted = false,
}: {
  label: string;
  value: number | string;
  format?: 'number' | 'percentage';
  change?: number;
  invertChange?: boolean;
  isFormatted?: boolean;
}) {
  const formattedValue = isFormatted
    ? value
    : format === 'percentage'
    ? `${((value as number) * 100).toFixed(1)}%`
    : (value as number).toLocaleString();

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

// Helper component for device icons
function DeviceIcon({ device }: { device: 'desktop' | 'mobile' | 'tablet' }) {
  switch (device) {
    case 'desktop':
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'mobile':
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'tablet':
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

// Helper to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
