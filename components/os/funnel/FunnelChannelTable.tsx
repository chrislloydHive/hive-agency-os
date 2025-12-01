'use client';

// components/os/funnel/FunnelChannelTable.tsx
// Detailed table of channel performance

import type { FunnelChannelPerformance } from '@/lib/os/analytics/funnelTypes';

export interface FunnelChannelTableProps {
  channels: FunnelChannelPerformance[];
  title?: string;
  isLoading?: boolean;
  showChart?: boolean;
}

export function FunnelChannelTable({
  channels,
  title = 'Channel Performance',
  isLoading = false,
}: FunnelChannelTableProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  if (channels.length === 0 && !isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100 mb-4">{title}</h2>
        <div className="text-center py-8 text-slate-500 text-sm">
          No channel data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
      {title && (
        <div className="p-4 sm:p-6 border-b border-slate-800">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100">{title}</h2>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
          <p className="text-slate-400 text-sm mt-3">Loading channel data...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Channel
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Sessions
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Conversions
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr
                  key={channel.channel}
                  className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4 text-slate-200 font-medium">
                    {channel.channel}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">
                    {formatNumber(channel.sessions)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                    {formatNumber(channel.conversions)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-semibold ${
                    channel.conversionRate >= 0.5
                      ? 'text-emerald-400'
                      : channel.conversionRate >= 0.3
                      ? 'text-amber-400'
                      : channel.conversionRate < 0.2 && channel.sessions >= 10
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                    {formatPercent(channel.conversionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
