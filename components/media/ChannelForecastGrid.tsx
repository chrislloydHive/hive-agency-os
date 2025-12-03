'use client';

// components/media/ChannelForecastGrid.tsx
// Channel Forecast Grid for Media Lab
//
// Displays forecast results per channel in a table/card format:
// - Channel name with color indicator
// - Budget, Impressions, Clicks, Leads, Calls, Installs
// - CPC, CPL, Conversion Rate
// - Impact bars showing Budget Share vs Lead Share

import React, { useMemo, useState } from 'react';
import {
  type ChannelForecast,
  type MediaForecastResult,
  CHANNEL_COLORS,
  formatCurrency,
  formatCompact,
  formatPercent,
} from '@/lib/media/forecastEngine';

// ============================================================================
// Types
// ============================================================================

interface ChannelForecastGridProps {
  forecast: MediaForecastResult | null;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ImpactBarProps {
  budgetShare: number;
  leadShare: number;
  color: string;
}

function ImpactBar({ budgetShare, leadShare, color }: ImpactBarProps) {
  const efficiency = leadShare > 0 && budgetShare > 0
    ? (leadShare / budgetShare).toFixed(2)
    : '—';

  const isEfficient = leadShare > budgetShare;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
            <span>Budget</span>
            <span>{formatPercent(budgetShare, 0)}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(budgetShare * 100, 100)}%`,
                backgroundColor: color,
                opacity: 0.5,
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
            <span>Leads</span>
            <span>{formatPercent(leadShare, 0)}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(leadShare * 100, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      </div>
      <div className={`text-[9px] text-center ${isEfficient ? 'text-emerald-400' : 'text-amber-400'}`}>
        {efficiency}x efficiency
      </div>
    </div>
  );
}

interface ChannelRowProps {
  channel: ChannelForecast;
  isExpanded: boolean;
  onToggle: () => void;
}

function ChannelRow({ channel, isExpanded, onToggle }: ChannelRowProps) {
  const colors = CHANNEL_COLORS[channel.channel];
  const channelColor = channel.channel === 'search' ? 'rgb(96, 165, 250)' :
    channel.channel === 'social' ? 'rgb(244, 114, 182)' :
    channel.channel === 'lsa' ? 'rgb(192, 132, 252)' :
    channel.channel === 'display' ? 'rgb(34, 211, 238)' :
    'rgb(52, 211, 153)';

  return (
    <div className={`border rounded-lg transition-all ${colors.border} ${colors.bg}`}>
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* Channel Indicator */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: channelColor }}
          />
          <span className={`text-sm font-medium ${colors.text}`}>
            {channel.channelLabel}
          </span>
        </div>

        {/* Budget */}
        <div className="min-w-[80px] text-right">
          <div className="text-xs text-slate-400">Budget</div>
          <div className="text-sm font-medium text-slate-200">
            {formatCurrency(channel.budget)}
          </div>
        </div>

        {/* Impressions */}
        <div className="min-w-[70px] text-right">
          <div className="text-xs text-slate-400">Impr.</div>
          <div className="text-sm font-medium text-slate-200">
            {formatCompact(channel.impressions)}
          </div>
        </div>

        {/* Clicks */}
        <div className="min-w-[60px] text-right">
          <div className="text-xs text-slate-400">Clicks</div>
          <div className="text-sm font-medium text-slate-200">
            {formatCompact(channel.clicks)}
          </div>
        </div>

        {/* Leads */}
        <div className="min-w-[50px] text-right">
          <div className="text-xs text-slate-400">Leads</div>
          <div className="text-sm font-bold text-amber-400">
            {channel.leads}
          </div>
        </div>

        {/* CPC */}
        <div className="min-w-[60px] text-right">
          <div className="text-xs text-slate-400">CPC</div>
          <div className="text-sm font-medium text-slate-200">
            {formatCurrency(channel.cpc)}
          </div>
        </div>

        {/* CPL */}
        <div className="min-w-[60px] text-right">
          <div className="text-xs text-slate-400">CPL</div>
          <div className="text-sm font-medium text-slate-200">
            {channel.cpl ? formatCurrency(channel.cpl) : '—'}
          </div>
        </div>

        {/* Expand Indicator */}
        <div className="ml-auto">
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-700/50">
          <div className="grid grid-cols-4 gap-4 pt-3">
            {/* Calls & Installs */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Calls</span>
                <span className="text-xs font-medium text-slate-300">{channel.calls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Installs</span>
                <span className="text-xs font-medium text-emerald-400">{channel.installs}</span>
              </div>
            </div>

            {/* Cost Metrics */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">CPM</span>
                <span className="text-xs font-medium text-slate-300">{formatCurrency(channel.cpm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Conv. Rate</span>
                <span className="text-xs font-medium text-slate-300">{formatPercent(channel.convRate)}</span>
              </div>
            </div>

            {/* Budget Share */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Budget Share</span>
                <span className="text-xs font-medium text-slate-300">{formatPercent(channel.budgetPercent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Lead Share</span>
                <span className="text-xs font-medium text-slate-300">{formatPercent(channel.leadShare)}</span>
              </div>
            </div>

            {/* Impact Bar */}
            <div>
              <ImpactBar
                budgetShare={channel.budgetPercent}
                leadShare={channel.leadShare}
                color={channelColor}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChannelForecastGrid({ forecast, className = '' }: ChannelForecastGridProps) {
  // Track which channels are expanded
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const toggleChannel = (channel: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  // Sort channels by budget descending
  const sortedChannels = useMemo(() => {
    if (!forecast) return [];
    return [...forecast.byChannel].sort((a, b) => b.budget - a.budget);
  }, [forecast]);

  // Empty state
  if (!forecast || forecast.byChannel.length === 0) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-sm font-medium text-slate-400 mb-1">No Channel Data</h3>
          <p className="text-xs text-slate-500">Set a budget to see channel forecasts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Channel Breakdown</h3>
        <button
          onClick={() => {
            if (expandedChannels.size === sortedChannels.length) {
              setExpandedChannels(new Set());
            } else {
              setExpandedChannels(new Set(sortedChannels.map(c => c.channel)));
            }
          }}
          className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          {expandedChannels.size === sortedChannels.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Channel List */}
      <div className="space-y-2">
        {sortedChannels.map((channel) => (
          <ChannelRow
            key={channel.channel}
            channel={channel}
            isExpanded={expandedChannels.has(channel.channel)}
            onToggle={() => toggleChannel(channel.channel)}
          />
        ))}
      </div>

      {/* Summary Bar */}
      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Budget</div>
            <div className="text-sm font-semibold text-slate-200">
              {formatCurrency(forecast.summary.totalBudget)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Impressions</div>
            <div className="text-sm font-semibold text-slate-200">
              {formatCompact(forecast.summary.totalImpressions)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Clicks</div>
            <div className="text-sm font-semibold text-slate-200">
              {formatCompact(forecast.summary.totalClicks)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Leads</div>
            <div className="text-sm font-bold text-amber-400">
              {forecast.summary.totalLeads}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Blended CPL</div>
            <div className="text-sm font-semibold text-slate-200">
              {forecast.summary.blendedCPL ? formatCurrency(forecast.summary.blendedCPL) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChannelForecastGrid;
