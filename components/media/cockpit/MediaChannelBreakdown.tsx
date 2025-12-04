'use client';

// components/media/cockpit/MediaChannelBreakdown.tsx
// Channel and Provider breakdown for Media Lab cockpit
//
// Shows spend distribution across channels and providers
// with performance metrics (CTR, CPC, CPL)

import { useState } from 'react';
import type { ChannelBreakdown, ProviderBreakdown } from '@/lib/media/cockpit';

interface MediaChannelBreakdownProps {
  byChannel: ChannelBreakdown[];
  byProvider: ProviderBreakdown[];
  className?: string;
}

type ViewMode = 'channel' | 'provider';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface BreakdownRowProps {
  label: string;
  spend: number;
  spendShare: number;
  leads: number;
  cpl: number | null;
  cpc: number | null;
  maxSpend: number;
}

function BreakdownRow({ label, spend, spendShare, leads, cpl, cpc, maxSpend }: BreakdownRowProps) {
  const barWidth = maxSpend > 0 ? (spend / maxSpend) * 100 : 0;

  return (
    <div className="py-2 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-200 truncate">{label}</span>
        <span className="text-xs text-slate-400 tabular-nums">{formatCurrency(spend)}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-slate-500">
          Share: <span className="text-slate-400 tabular-nums">{formatPercent(spendShare)}</span>
        </span>
        <span className="text-slate-500">
          Leads: <span className="text-slate-400 tabular-nums">{leads.toLocaleString()}</span>
        </span>
        {cpl !== null && (
          <span className="text-slate-500">
            CPL: <span className="text-slate-400 tabular-nums">{formatCurrency(cpl)}</span>
          </span>
        )}
        {cpc !== null && (
          <span className="text-slate-500">
            CPC: <span className="text-slate-400 tabular-nums">{formatCurrency(cpc)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function MediaChannelBreakdown({
  byChannel,
  byProvider,
  className = '',
}: MediaChannelBreakdownProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('channel');

  const hasData = byChannel.length > 0 || byProvider.length > 0;

  // Empty state
  if (!hasData) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Channel Breakdown</h3>
        <div className="text-center py-6">
          <svg
            className="w-10 h-10 mx-auto mb-2 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
          <p className="text-xs text-slate-500">No channel data available</p>
        </div>
      </div>
    );
  }

  const data = viewMode === 'channel' ? byChannel : byProvider;
  const maxSpend = Math.max(...data.map((d) => d.spend));

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Spend Breakdown</h3>
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('channel')}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              viewMode === 'channel'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Channel
          </button>
          <button
            onClick={() => setViewMode('provider')}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              viewMode === 'provider'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Provider
          </button>
        </div>
      </div>

      {/* Breakdown list */}
      <div className="space-y-0 max-h-64 overflow-y-auto">
        {data.map((item) => (
          <BreakdownRow
            key={viewMode === 'channel' ? (item as ChannelBreakdown).channel : (item as ProviderBreakdown).provider}
            label={viewMode === 'channel' ? (item as ChannelBreakdown).channelLabel : (item as ProviderBreakdown).providerLabel}
            spend={item.spend}
            spendShare={item.spendShare}
            leads={item.leads + item.calls}
            cpl={item.cpl}
            cpc={item.cpc}
            maxSpend={maxSpend}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {data.length} {viewMode === 'channel' ? 'channels' : 'providers'} active
          </span>
          <span className="text-slate-400 tabular-nums">
            {formatCurrency(data.reduce((sum, d) => sum + d.spend, 0))} total
          </span>
        </div>
      </div>
    </div>
  );
}

export default MediaChannelBreakdown;
