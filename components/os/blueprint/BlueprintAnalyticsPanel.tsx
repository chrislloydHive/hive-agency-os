'use client';

// components/os/blueprint/BlueprintAnalyticsPanel.tsx
// Analytics & Performance Panel for Blueprint Page
//
// Displays a strategic summary of analytics data including:
// - Key metrics (sessions, users, conversions, CTR)
// - Mini sparkline chart
// - Top channels breakdown
// - Strategic insights with "Send to Work" capability
// - Link to full Analytics Deep Dive

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type {
  BlueprintAnalyticsSummary,
  AnalyticsStrategicInsight,
} from '@/lib/os/analytics/blueprintDataFetcher';

// ============================================================================
// Types
// ============================================================================

interface BlueprintAnalyticsPanelProps {
  companyId: string;
  summary: BlueprintAnalyticsSummary | null;
  insights?: AnalyticsStrategicInsight[];
  isLoading?: boolean;
  onSendInsightToWork?: (insight: AnalyticsStrategicInsight) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
}

function formatPosition(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(1);
}

function getChangeColor(value: number | null): string {
  if (value === null) return 'text-slate-400';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

function formatChange(value: number | null): string {
  if (value === null) return '';
  if (value === 0) return '0%';
  return value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

function getInsightColor(type: 'strength' | 'warning' | 'opportunity'): string {
  switch (type) {
    case 'strength':
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    case 'warning':
      return 'bg-red-500/10 border-red-500/30 text-red-300';
    case 'opportunity':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
  }
}

function getInsightIcon(type: 'strength' | 'warning' | 'opportunity') {
  switch (type) {
    case 'strength':
      return (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'opportunity':
      return (
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ============================================================================
// Mini Sparkline Component
// ============================================================================

function Sparkline({ data, color = '#f59e0b' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 120;
  const height = 32;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BlueprintAnalyticsPanel({
  companyId,
  summary,
  insights = [],
  isLoading = false,
  onSendInsightToWork,
}: BlueprintAnalyticsPanelProps) {
  const [sendingInsights, setSendingInsights] = useState<Set<number>>(new Set());
  const [sentInsights, setSentInsights] = useState<Set<number>>(new Set());

  // Handle sending an insight to work
  const handleSendToWork = useCallback(
    async (insight: AnalyticsStrategicInsight, index: number) => {
      if (!onSendInsightToWork) return;

      setSendingInsights((prev) => new Set(prev).add(index));

      try {
        await onSendInsightToWork(insight);
        setSentInsights((prev) => new Set(prev).add(index));
      } catch (error) {
        console.error('[BlueprintAnalyticsPanel] Failed to send to work:', error);
      } finally {
        setSendingInsights((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [onSendInsightToWork]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading analytics...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-16 mb-2" />
              <div className="h-6 bg-slate-700 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No data state
  if (!summary) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Analytics & Performance
          </h2>
        </div>
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 mx-auto text-slate-600 mb-3"
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
          <p className="text-sm text-slate-500 mb-4">
            Connect GA4 or Search Console to see analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Analytics & Performance
          </h2>
          <span className="text-xs text-slate-500">
            {summary.dateRange.preset === '7d'
              ? 'Last 7 days'
              : summary.dateRange.preset === '90d'
              ? 'Last 90 days'
              : 'Last 30 days'}
          </span>
        </div>
        <Link
          href={`/c/${companyId}/analytics/deep-dive`}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          View Full Analytics
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Metrics Row + Sparkline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Sessions */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-slate-100">
              {formatNumber(summary.sessions)}
            </span>
            {summary.sessionsChange !== null && (
              <span className={`text-xs font-medium ${getChangeColor(summary.sessionsChange)}`}>
                {formatChange(summary.sessionsChange)}
              </span>
            )}
          </div>
        </div>

        {/* Users */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-slate-100">
              {formatNumber(summary.users)}
            </span>
            {summary.usersChange !== null && (
              <span className={`text-xs font-medium ${getChangeColor(summary.usersChange)}`}>
                {formatChange(summary.usersChange)}
              </span>
            )}
          </div>
        </div>

        {/* Conversions */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Conversions</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-slate-100">
              {formatNumber(summary.conversions)}
            </span>
            {summary.conversionsChange !== null && (
              <span className={`text-xs font-medium ${getChangeColor(summary.conversionsChange)}`}>
                {formatChange(summary.conversionsChange)}
              </span>
            )}
          </div>
        </div>

        {/* CTR + Position */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            CTR / Avg Pos
          </p>
          <div className="flex items-end justify-between">
            <span className="text-lg font-bold tabular-nums text-slate-100">
              {formatPercent(summary.ctr)} / {formatPosition(summary.avgPosition)}
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col justify-between">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">30d Trend</p>
          <div className="flex items-center justify-center">
            <Sparkline data={summary.trendline} color="#f59e0b" />
          </div>
        </div>
      </div>

      {/* Channel Breakdown */}
      {summary.topChannels.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Top Channels</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summary.topChannels.map((channel, index) => (
              <div
                key={channel.channel}
                className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200">{channel.channel}</span>
                  <span className="text-xs text-slate-400">{channel.percent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(channel.percent, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatNumber(channel.sessions)} sessions</span>
                  <span>{channel.conversionRate.toFixed(1)}% conv</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Insights */}
      {insights.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            What This Means for Strategy
          </p>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight, index) => {
              const isSending = sendingInsights.has(index);
              const isSent = sentInsights.has(index);

              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">{getInsightIcon(insight.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{insight.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {insight.value && (
                      <span className="text-sm font-bold tabular-nums">
                        {insight.value}
                      </span>
                    )}
                    {onSendInsightToWork && !isSent && (
                      <button
                        onClick={() => handleSendToWork(insight, index)}
                        disabled={isSending}
                        className="px-2 py-1 text-[10px] font-medium rounded bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
                        title="Create work item from this insight"
                      >
                        {isSending ? '...' : '+ Work'}
                      </button>
                    )}
                    {isSent && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Added
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deep Dive CTA */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <Link
          href={`/c/${companyId}/analytics/deep-dive`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          View Full Analytics Deep Dive
        </Link>
      </div>
    </div>
  );
}

export default BlueprintAnalyticsPanel;
