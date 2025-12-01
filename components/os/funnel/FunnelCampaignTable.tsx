'use client';

// components/os/funnel/FunnelCampaignTable.tsx
// Detailed table of campaign performance

import type { FunnelCampaignPerformance } from '@/lib/os/analytics/funnelTypes';

export interface FunnelCampaignTableProps {
  campaigns: FunnelCampaignPerformance[];
  title?: string;
  isLoading?: boolean;
}

export function FunnelCampaignTable({
  campaigns,
  title = 'Campaign Performance',
  isLoading = false,
}: FunnelCampaignTableProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  if (campaigns.length === 0 && !isLoading) {
    return null; // Don't render if no campaigns
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
          <p className="text-slate-400 text-sm mt-3">Loading campaign data...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Campaign
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                  Source/Medium
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
              {campaigns.map((campaign, idx) => (
                <tr
                  key={`${campaign.campaign}-${idx}`}
                  className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4 text-slate-200 font-medium">
                    {campaign.campaign}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {campaign.sourceMedium}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">
                    {formatNumber(campaign.sessions)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                    {formatNumber(campaign.conversions)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-semibold ${
                    campaign.conversionRate >= 0.5
                      ? 'text-emerald-400'
                      : campaign.conversionRate >= 0.3
                      ? 'text-amber-400'
                      : campaign.conversionRate < 0.2 && campaign.sessions >= 10
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                    {formatPercent(campaign.conversionRate)}
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
