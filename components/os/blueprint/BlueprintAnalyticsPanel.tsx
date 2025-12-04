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
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';

// ============================================================================
// Types
// ============================================================================

interface BlueprintAnalyticsPanelProps {
  companyId: string;
  summary: BlueprintAnalyticsSummary | null;
  insights?: AnalyticsStrategicInsight[];
  isLoading?: boolean;
  onSendInsightToWork?: (insight: AnalyticsStrategicInsight) => Promise<void>;
  /** 7-day performance pulse for anomaly detection */
  performancePulse?: PerformancePulse | null;
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
// Trend Chart Component (Full Width Area Chart with Hover Detail)
// ============================================================================

function TrendChart({ data, color = '#f59e0b' }: { data: number[]; color?: string }) {
  const [showDetail, setShowDetail] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  // Calculate stats
  const total = data.reduce((sum, v) => sum + v, 0);
  const avg = total / data.length;
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const trendPercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const isPositive = trendPercent >= 0;

  // Find best and worst days
  const maxIndex = data.indexOf(max);
  const minIndex = data.indexOf(min);

  // Week-over-week comparison (last 7 days vs previous 7 days)
  const last7 = data.slice(-7).reduce((sum, v) => sum + v, 0);
  const prev7 = data.slice(-14, -7).reduce((sum, v) => sum + v, 0);
  const wow = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;

  // Generate date labels
  const getDateLabel = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (data.length - 1 - daysAgo));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wide">30-Day Sessions Trend</span>
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            {showDetail ? 'Less' : 'More'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {formatNumber(lastValue)} today
          </span>
          <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{trendPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Mini Chart (always visible) */}
      <MiniTrendChart
        data={data}
        color={color}
        height={80}
        hoveredIndex={hoveredIndex}
        onHover={setHoveredIndex}
        getDateLabel={getDateLabel}
      />

      {/* Expanded Detail Panel */}
      {showDetail && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Total</p>
              <p className="text-sm font-semibold text-slate-200">{formatNumber(total)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Daily Avg</p>
              <p className="text-sm font-semibold text-slate-200">{formatNumber(Math.round(avg))}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Best Day</p>
              <p className="text-sm font-semibold text-emerald-400">{formatNumber(max)}</p>
              <p className="text-[10px] text-slate-500">{getDateLabel(maxIndex)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Worst Day</p>
              <p className="text-sm font-semibold text-red-400">{formatNumber(min)}</p>
              <p className="text-[10px] text-slate-500">{getDateLabel(minIndex)}</p>
            </div>
          </div>

          {/* Week over Week */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
            <div>
              <p className="text-xs text-slate-400">Week over Week</p>
              <p className="text-[10px] text-slate-500">Last 7 days vs previous 7 days</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${wow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {wow >= 0 ? '+' : ''}{wow.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500">
                {formatNumber(last7)} vs {formatNumber(prev7)}
              </p>
            </div>
          </div>

          {/* Larger Interactive Chart */}
          <div className="mt-4">
            <DetailTrendChart
              data={data}
              color={color}
              getDateLabel={getDateLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Mini chart component (the default view)
function MiniTrendChart({
  data,
  color,
  height,
  hoveredIndex,
  onHover,
  getDateLabel,
}: {
  data: number[];
  color: string;
  height: number;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  getDateLabel: (index: number) => string;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const paddingY = 8;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - paddingY - ((value - min) / range) * (height - 2 * paddingY);
    return { x, y, value };
  });

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1="0" y1={paddingY} x2="100" y2={paddingY} stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={height - paddingY} x2="100" y2={height - paddingY} stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />

        {/* Area fill */}
        <path d={areaPath} fill="url(#trendGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hover detection zones */}
        {points.map((point, index) => (
          <rect
            key={index}
            x={point.x - 100 / data.length / 2}
            y={0}
            width={100 / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => onHover(index)}
            style={{ cursor: 'crosshair' }}
          />
        ))}

        {/* Hovered point */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <>
            <line
              x1={points[hoveredIndex].x}
              y1={0}
              x2={points[hoveredIndex].x}
              y2={height}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="2,2"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={points[hoveredIndex].x}
              cy={points[hoveredIndex].y}
              r={5}
              fill={color}
              stroke="#1e293b"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* End point dot (when not hovering) */}
        {hoveredIndex === null && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute z-10 px-2 py-1 rounded bg-slate-800 border border-slate-700 shadow-lg pointer-events-none"
          style={{
            left: `${points[hoveredIndex].x}%`,
            top: points[hoveredIndex].y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-xs font-medium text-slate-200">{formatNumber(data[hoveredIndex])} sessions</p>
          <p className="text-[10px] text-slate-400">{getDateLabel(hoveredIndex)}</p>
        </div>
      )}

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-500 translate-y-full pt-1">
        <span>30d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// Detailed chart component (shown when expanded)
function DetailTrendChart({
  data,
  color,
  getDateLabel,
}: {
  data: number[];
  color: string;
  getDateLabel: (index: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 160;
  const paddingY = 12;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - paddingY - ((value - min) / range) * (height - 2 * paddingY);
    return { x, y, value };
  });

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;

  // Calculate 7-day moving average
  const movingAvg = data.map((_, index) => {
    const start = Math.max(0, index - 6);
    const slice = data.slice(start, index + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });

  const avgPoints = movingAvg.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - paddingY - ((value - min) / range) * (height - 2 * paddingY);
    return { x, y, value };
  });

  const avgLinePath = `M ${avgPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div className="relative w-full" style={{ height: height + 24 }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
        style={{ height }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="detailTrendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1="0"
            y1={paddingY + (height - 2 * paddingY) * pct}
            x2="100"
            y2={paddingY + (height - 2 * paddingY) * pct}
            stroke="#334155"
            strokeWidth="0.5"
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Vertical grid lines (weekly) */}
        {[7, 14, 21].map((day) => {
          const x = ((data.length - 1 - (30 - day)) / (data.length - 1)) * 100;
          return (
            <line
              key={day}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke="#334155"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#detailTrendGradient)" />

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* 7-day moving average line */}
        <path
          d={avgLinePath}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4,2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === index ? 5 : 2}
            fill={hoveredIndex === index ? color : 'transparent'}
            stroke={color}
            strokeWidth={hoveredIndex === index ? 2 : 1}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
            onMouseEnter={() => setHoveredIndex(index)}
          />
        ))}

        {/* Hover line */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <line
            x1={points[hoveredIndex].x}
            y1={0}
            x2={points[hoveredIndex].x}
            y2={height}
            stroke="#64748b"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute z-10 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl pointer-events-none"
          style={{
            left: `${Math.min(Math.max(points[hoveredIndex].x, 10), 90)}%`,
            top: Math.max(points[hoveredIndex].y - 60, 0),
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-sm font-semibold text-slate-100">{formatNumber(data[hoveredIndex])} sessions</p>
          <p className="text-xs text-slate-400">{getDateLabel(hoveredIndex)}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            7-day avg: {formatNumber(Math.round(movingAvg[hoveredIndex]))}
          </p>
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{getDateLabel(0)}</span>
        <span>{getDateLabel(Math.floor(data.length / 2))}</span>
        <span>{getDateLabel(data.length - 1)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 mt-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
          <span>Daily</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded bg-slate-500" style={{ borderTop: '1px dashed' }} />
          <span>7-day avg</span>
        </div>
      </div>
    </div>
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
  performancePulse,
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
      </div>

      {/* 30-Day Trend Chart */}
      {summary.trendline && summary.trendline.length > 1 && (
        <div className="bg-slate-800/30 rounded-lg p-4 mb-6">
          <TrendChart data={summary.trendline} color="#f59e0b" />
        </div>
      )}

      {/* 7-Day Pulse Card - Anomaly Detection */}
      {performancePulse?.hasAnomalies && performancePulse.anomalySummary && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-amber-300">7-Day Pulse</p>
              <span className="text-xs text-amber-400/60">Week-over-week</span>
            </div>
            <p className="text-sm text-amber-200/90">{performancePulse.anomalySummary}</p>
            {/* Quick metrics row */}
            <div className="flex items-center gap-4 mt-2 text-xs">
              {performancePulse.currentSessions !== null && performancePulse.trafficChange7d !== null && (
                <span className={getChangeColor(performancePulse.trafficChange7d)}>
                  Traffic: {formatChange(performancePulse.trafficChange7d)}
                </span>
              )}
              {performancePulse.currentConversions !== null && performancePulse.conversionsChange7d !== null && (
                <span className={getChangeColor(performancePulse.conversionsChange7d)}>
                  Conversions: {formatChange(performancePulse.conversionsChange7d)}
                </span>
              )}
              {performancePulse.currentClicks !== null && performancePulse.seoVisibilityChange7d !== null && (
                <span className={getChangeColor(performancePulse.seoVisibilityChange7d)}>
                  Search: {formatChange(performancePulse.seoVisibilityChange7d)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

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
