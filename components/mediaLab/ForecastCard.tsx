'use client';

// components/mediaLab/ForecastCard.tsx
// Performance Forecast Display Component

import { useState } from 'react';
import {
  type MediaPlanForecast,
  type MediaPrimaryGoal,
  MEDIA_CHANNEL_COLORS,
  MEDIA_PRIMARY_GOAL_CONFIG,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

interface ForecastCardProps {
  forecast: MediaPlanForecast;
  primaryGoal: MediaPrimaryGoal;
  monthlyBudget: number;
}

// ============================================================================
// Component
// ============================================================================

export function ForecastCard({
  forecast,
  primaryGoal,
  monthlyBudget,
}: ForecastCardProps) {
  const [showChannelBreakdown, setShowChannelBreakdown] = useState(false);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number | null) =>
    n !== null ? `$${n.toLocaleString()}` : '—';
  const formatPercent = (n: number) => `${(n * 100).toFixed(2)}%`;

  const goalConfig = MEDIA_PRIMARY_GOAL_CONFIG[primaryGoal];

  // Determine primary metric based on goal
  const getPrimaryMetric = () => {
    switch (primaryGoal) {
      case 'installs':
        return {
          label: 'Est. Installs',
          value: forecast.estimatedInstalls,
          color: 'text-emerald-400',
          secondary: {
            label: 'Est. CPI',
            value: forecast.estimatedCPI ? `$${forecast.estimatedCPI}` : '—',
          },
        };
      case 'leads':
      case 'calls':
        return {
          label: 'Est. Leads',
          value: forecast.estimatedLeads,
          color: 'text-blue-400',
          secondary: {
            label: 'Est. CPL',
            value: forecast.estimatedCPL ? `$${forecast.estimatedCPL}` : '—',
          },
        };
      case 'awareness':
        return {
          label: 'Est. Impressions',
          value: forecast.estimatedImpressions,
          color: 'text-purple-400',
          secondary: {
            label: 'Est. Reach',
            value: formatNumber(Math.round(forecast.estimatedImpressions * 0.6)),
          },
        };
      case 'store_visits':
        return {
          label: 'Est. Clicks',
          value: forecast.estimatedClicks,
          color: 'text-cyan-400',
          secondary: {
            label: 'Est. Store Actions',
            value: formatNumber(Math.round(forecast.estimatedClicks * 0.15)),
          },
        };
      default:
        return {
          label: 'Est. Leads',
          value: forecast.estimatedLeads,
          color: 'text-amber-400',
          secondary: {
            label: 'Est. CPL',
            value: forecast.estimatedCPL ? `$${forecast.estimatedCPL}` : '—',
          },
        };
    }
  };

  const primaryMetric = getPrimaryMetric();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">
            Performance Forecast
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Based on industry benchmarks
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded ${goalConfig.color} bg-current/10`}
        >
          {goalConfig.label} Focus
        </span>
      </div>

      {/* Primary Metric */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {primaryMetric.label}
            </p>
            <p className={`text-3xl font-bold tabular-nums ${primaryMetric.color}`}>
              {formatNumber(primaryMetric.value)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{primaryMetric.secondary.label}</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {primaryMetric.secondary.value}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricBox
          label="Impressions"
          value={formatNumber(forecast.estimatedImpressions)}
        />
        <MetricBox
          label="Clicks"
          value={formatNumber(forecast.estimatedClicks)}
        />
        <MetricBox
          label="CTR"
          value={formatPercent(forecast.estimatedCTR)}
        />
        <MetricBox
          label="Monthly Spend"
          value={formatCurrency(forecast.totalMonthlySpend)}
          highlight
        />
      </div>

      {/* Channel Breakdown Toggle */}
      <button
        type="button"
        onClick={() => setShowChannelBreakdown(!showChannelBreakdown)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {showChannelBreakdown ? 'Hide' : 'Show'} Channel Breakdown
        <svg
          className={`w-3 h-3 transition-transform ${showChannelBreakdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Channel Breakdown Table */}
      {showChannelBreakdown && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    Channel
                  </th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    Spend
                  </th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    Impressions
                  </th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    Clicks
                  </th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    Leads
                  </th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    CPL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {forecast.byChannel.map((ch) => {
                  const colors = MEDIA_CHANNEL_COLORS[ch.channel];
                  return (
                    <tr key={ch.channel} className="hover:bg-slate-800/30">
                      <td className="py-2">
                        <span className={`${colors.text}`}>{ch.label}</span>
                      </td>
                      <td className="py-2 text-right text-slate-300 tabular-nums">
                        ${ch.spend.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-slate-400 tabular-nums">
                        {formatNumber(ch.estimatedImpressions)}
                      </td>
                      <td className="py-2 text-right text-slate-400 tabular-nums">
                        {formatNumber(ch.estimatedClicks)}
                      </td>
                      <td className="py-2 text-right text-amber-400 tabular-nums font-medium">
                        {formatNumber(ch.estimatedLeads)}
                      </td>
                      <td className="py-2 text-right text-purple-400 tabular-nums">
                        {ch.estimatedCPL ? `$${ch.estimatedCPL}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-[10px] text-slate-600 italic">
        * Forecasts are estimates based on industry benchmarks and may vary based on market conditions,
        competition, and campaign execution.
      </p>
    </div>
  );
}

// ============================================================================
// Metric Box
// ============================================================================

function MetricBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          highlight ? 'text-emerald-400' : 'text-slate-200'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
