'use client';

// components/media/scenarios/MediaScenarioForecastPanel.tsx
// Forecast results display panel for scenario planning
//
// Shows:
// - Summary metrics (installs, leads, CPA)
// - Channel breakdown
// - Commentary

import type { MediaForecastResult } from '@/lib/media/forecastEngine';
import type { MediaScenario, MediaScenarioForecastSummary } from '@/lib/media/types';
import { formatCurrency, formatCompact, CHANNEL_COLORS } from '@/lib/media/types';

interface MediaScenarioForecastPanelProps {
  scenario: MediaScenario;
  forecast: MediaForecastResult | null;
  isLoading?: boolean;
  error?: string;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================================================
// Summary Metrics
// ============================================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
}

function MetricCard({ label, value, subValue, highlight }: MetricCardProps) {
  return (
    <div className={`p-3 rounded-lg border ${
      highlight
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-slate-800/50 border-slate-700/50'
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${highlight ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </div>
      {subValue && <div className="text-[10px] text-slate-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

// ============================================================================
// Channel Breakdown
// ============================================================================

interface ChannelRowProps {
  channelLabel: string;
  channel: string;
  spend: number;
  installs: number;
  leads: number;
  cpl: number | null;
  maxSpend: number;
}

function ChannelRow({ channelLabel, channel, spend, installs, leads, cpl, maxSpend }: ChannelRowProps) {
  const colors = CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS] || {
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
  };
  const barWidth = maxSpend > 0 ? (spend / maxSpend) * 100 : 0;

  return (
    <div className="py-2 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${colors.text}`}>{channelLabel}</span>
        <span className="text-xs text-slate-400 tabular-nums">{formatCurrency(spend)}</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full ${colors.bg.replace('/10', '/40')} rounded-full transition-all duration-300`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span>{installs} installs</span>
        <span>{leads} leads</span>
        {cpl !== null && <span>{formatCurrency(cpl)} CPL</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Commentary Generator
// ============================================================================

function generateCommentary(scenario: MediaScenario, forecast: MediaForecastResult): string {
  const { summary, byChannel } = forecast;

  // Find dominant channel
  const sortedChannels = [...byChannel].sort((a, b) => b.budget - a.budget);
  const topChannel = sortedChannels[0];

  if (!topChannel) {
    return 'Add channel allocations to see forecast results.';
  }

  const topChannelPct = ((topChannel.budget / summary.totalBudget) * 100).toFixed(0);

  let commentary = `This scenario emphasizes ${topChannel.channelLabel} (${topChannelPct}% of spend)`;

  if (summary.totalInstalls > 0) {
    commentary += ` and is expected to deliver ~${summary.totalInstalls.toLocaleString()} installs`;
    if (summary.blendedCPI) {
      commentary += ` at ~${formatCurrency(summary.blendedCPI)} CPA`;
    }
  } else if (summary.totalLeads > 0) {
    commentary += ` and is expected to generate ~${summary.totalLeads.toLocaleString()} leads`;
    if (summary.blendedCPL) {
      commentary += ` at ~${formatCurrency(summary.blendedCPL)} CPL`;
    }
  }

  commentary += '.';

  // Add goal comparison if applicable
  if (scenario.goal?.type === 'hit_target_cpa' && scenario.goal.targetValue && summary.blendedCPI) {
    const diff = summary.blendedCPI - scenario.goal.targetValue;
    if (diff > 0) {
      commentary += ` Current CPA is ${formatCurrency(diff)} above target.`;
    } else {
      commentary += ` Current CPA meets the target of ${formatCurrency(scenario.goal.targetValue)}.`;
    }
  }

  if (scenario.goal?.type === 'hit_target_volume' && scenario.goal.targetValue) {
    const actual = scenario.goal.metric === 'leads' ? summary.totalLeads : summary.totalInstalls;
    const diff = scenario.goal.targetValue - actual;
    if (diff > 0) {
      commentary += ` ${diff.toLocaleString()} more ${scenario.goal.metric || 'installs'} needed to hit target.`;
    } else {
      commentary += ` On track to exceed target of ${scenario.goal.targetValue.toLocaleString()}.`;
    }
  }

  return commentary;
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaScenarioForecastPanel({
  scenario,
  forecast,
  isLoading,
  error,
}: MediaScenarioForecastPanelProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Running forecast...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Forecast failed</span>
        </div>
        <p className="text-xs text-red-400/70 mt-1">{error}</p>
      </div>
    );
  }

  // No forecast yet - show cached summary if available
  if (!forecast) {
    if (scenario.forecastSummary) {
      return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Forecast Summary</h3>
            <span className="text-[10px] text-slate-500">
              Last run: {scenario.forecastSummary.generatedAt
                ? new Date(scenario.forecastSummary.generatedAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              label="Installs"
              value={scenario.forecastSummary.expectedInstalls?.toLocaleString() || '—'}
              highlight
            />
            <MetricCard
              label="Leads"
              value={scenario.forecastSummary.expectedLeads?.toLocaleString() || '—'}
            />
            <MetricCard
              label="CPA"
              value={scenario.forecastSummary.expectedCPA ? formatCurrency(scenario.forecastSummary.expectedCPA) : '—'}
            />
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            Click "Run Forecast" for updated projections
          </p>
        </div>
      );
    }

    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-400 mb-1">No forecast yet</p>
          <p className="text-xs text-slate-500">
            Set your budget and channel mix, then click "Run Forecast"
          </p>
        </div>
      </div>
    );
  }

  // Full forecast display
  const { summary, byChannel, warnings } = forecast;
  const maxSpend = Math.max(...byChannel.map(c => c.budget));

  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Forecast Results</h3>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricCard
            label="Installs"
            value={summary.totalInstalls.toLocaleString()}
            highlight
          />
          <MetricCard
            label="Leads"
            value={summary.totalLeads.toLocaleString()}
          />
          <MetricCard
            label="Calls"
            value={summary.totalCalls.toLocaleString()}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            label="CPA"
            value={summary.blendedCPI ? formatCurrency(summary.blendedCPI) : '—'}
          />
          <MetricCard
            label="CPL"
            value={summary.blendedCPL ? formatCurrency(summary.blendedCPL) : '—'}
          />
          <MetricCard
            label="Conv Rate"
            value={formatPercent(summary.blendedConvRate)}
          />
        </div>
      </div>

      {/* Channel breakdown */}
      {byChannel.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Channel Breakdown</h3>
          <div className="space-y-0">
            {byChannel.map((channel) => (
              <ChannelRow
                key={channel.channel}
                channelLabel={channel.channelLabel}
                channel={channel.channel}
                spend={channel.budget}
                installs={channel.installs}
                leads={channel.leads}
                cpl={channel.cpl}
                maxSpend={maxSpend}
              />
            ))}
          </div>
        </div>
      )}

      {/* Commentary */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Analysis</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {generateCommentary(scenario, forecast)}
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Warnings</h3>
          <ul className="space-y-1">
            {warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MediaScenarioForecastPanel;
