// components/analytics/company/AnalyticsChartsSection.tsx
// Charts subtab for Company Analytics - time series visualizations
//
// Displays line charts for:
// - Sessions over time (GA4)
// - Search clicks over time (GSC)
// - Conversions over time (GA4)
// - DMA/GAP funnel events over time

'use client';

import { useMemo } from 'react';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';

interface AnalyticsChartsSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function AnalyticsChartsSection({
  snapshot,
  isLoading,
  error,
  onRetry,
}: AnalyticsChartsSectionProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 h-64 animate-pulse">
              <div className="h-4 w-32 bg-slate-700 rounded mb-4" />
              <div className="h-full bg-slate-800 rounded" />
            </div>
          ))}
        </div>
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

  // No data state
  if (!snapshot) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No analytics data available for charts.</p>
      </div>
    );
  }

  const ga4TimeSeries = snapshot.ga4?.timeSeries || [];
  const gscTimeSeries = snapshot.searchConsole?.timeSeries || [];
  const funnelTimeSeries = snapshot.funnels?.timeSeries || [];

  const hasGa4Data = ga4TimeSeries.length > 0;
  const hasGscData = gscTimeSeries.length > 0;
  const hasFunnelData = funnelTimeSeries.length > 0;

  if (!hasGa4Data && !hasGscData) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No time series data available for the selected period.</p>
        <p className="text-sm text-slate-500 mt-2">
          Connect GA4 or Search Console to see charts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions Chart */}
        {hasGa4Data && (
          <div id="metric-sessions">
            <SimpleLineChart
              title="Sessions"
              data={ga4TimeSeries.map(d => ({ date: d.date, value: d.sessions }))}
              color="emerald"
            />
          </div>
        )}

        {/* Users Chart */}
        {hasGa4Data && (
          <div id="metric-users">
            <SimpleLineChart
              title="Users"
              data={ga4TimeSeries.map(d => ({ date: d.date, value: d.users }))}
              color="blue"
            />
          </div>
        )}

        {/* Search Clicks Chart */}
        {hasGscData && (
          <div id="metric-searchClicks">
            <SimpleLineChart
              title="Search Clicks"
              data={gscTimeSeries.map(d => ({ date: d.date, value: d.clicks }))}
              color="amber"
            />
          </div>
        )}

        {/* Impressions Chart */}
        {hasGscData && (
          <div id="metric-impressions">
            <SimpleLineChart
              title="Search Impressions"
              data={gscTimeSeries.map(d => ({ date: d.date, value: d.impressions }))}
              color="purple"
            />
          </div>
        )}

        {/* Conversions Chart */}
        {hasGa4Data && (
          <div id="metric-conversions">
            <SimpleLineChart
              title="Conversions"
              data={ga4TimeSeries.map(d => ({ date: d.date, value: d.conversions }))}
              color="rose"
            />
          </div>
        )}

        {/* Avg Position Chart (inverted - lower is better) */}
        {hasGscData && (
          <div id="metric-avgPosition">
            <SimpleLineChart
              title="Avg Search Position"
              data={gscTimeSeries.map(d => ({ date: d.date, value: d.position }))}
              color="cyan"
              format="position"
            />
          </div>
        )}
      </div>

      {/* Funnel Charts */}
      {hasFunnelData && (
        <>
          <h3 className="text-lg font-semibold text-slate-200 mt-8 mb-4">Funnel Events</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DMA Funnel Events */}
            <SimpleLineChart
              title="DMA Audits"
              data={funnelTimeSeries.map(d => ({ date: d.date, value: d.dmaStarted + d.dmaCompleted }))}
              color="purple"
              secondaryData={funnelTimeSeries.map(d => ({ date: d.date, value: d.dmaCompleted }))}
              legend={['Started', 'Completed']}
            />

            {/* GAP-IA Funnel Events */}
            <SimpleLineChart
              title="GAP-IA Events"
              data={funnelTimeSeries.map(d => ({ date: d.date, value: d.gapIaStarted }))}
              color="amber"
              secondaryData={funnelTimeSeries.map(d => ({ date: d.date, value: d.gapIaCtaClicked }))}
              legend={['Started', 'CTA Clicked']}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Simple SVG line chart component (no external dependencies)
function SimpleLineChart({
  title,
  data,
  secondaryData,
  color,
  format = 'number',
  legend,
}: {
  title: string;
  data: { date: string; value: number }[];
  secondaryData?: { date: string; value: number }[];
  color: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'cyan';
  format?: 'number' | 'position';
  legend?: [string, string];
}) {
  const { pathD, secondaryPathD, points, secondaryPoints, minValue, maxValue, width, height, padding } = useMemo(() => {
    if (data.length === 0) return { pathD: '', points: [], minValue: 0, maxValue: 0, width: 300, height: 150, padding: 20 };

    const w = 300;
    const h = 150;
    const p = 20;

    const values = data.map(d => d.value);
    const secondaryValues = secondaryData?.map(d => d.value) || [];
    const allValues = [...values, ...secondaryValues];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const chartWidth = w - p * 2;
    const chartHeight = h - p * 2;

    const pts = data.map((d, i) => {
      const x = p + (i / (data.length - 1 || 1)) * chartWidth;
      const y = p + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, value: d.value, date: d.date };
    });

    const secondaryPts = secondaryData?.map((d, i) => {
      const x = p + (i / (secondaryData.length - 1 || 1)) * chartWidth;
      const y = p + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, value: d.value, date: d.date };
    }) || [];

    const path = pts.length > 0
      ? `M ${pts[0].x} ${pts[0].y} ${pts.slice(1).map(pt => `L ${pt.x} ${pt.y}`).join(' ')}`
      : '';

    const secondaryPath = secondaryPts.length > 0
      ? `M ${secondaryPts[0].x} ${secondaryPts[0].y} ${secondaryPts.slice(1).map(pt => `L ${pt.x} ${pt.y}`).join(' ')}`
      : '';

    return {
      pathD: path,
      secondaryPathD: secondaryPath,
      points: pts,
      secondaryPoints: secondaryPts,
      minValue: min,
      maxValue: max,
      width: w,
      height: h,
      padding: p,
    };
  }, [data, secondaryData]);

  const colorMap = {
    emerald: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.1)' },
    blue: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)' },
    amber: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.1)' },
    purple: { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.1)' },
    rose: { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.1)' },
    cyan: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.1)' },
  };

  const secondaryColorMap = {
    emerald: '#34d399',
    blue: '#60a5fa',
    amber: '#fbbf24',
    purple: '#c084fc',
    rose: '#fb7185',
    cyan: '#22d3ee',
  };

  const colors = colorMap[color];
  const secondaryColor = secondaryColorMap[color];

  const formatValue = (v: number) => {
    if (format === 'position') return v.toFixed(1);
    return v.toLocaleString();
  };

  // Calculate total for the period
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const avg = data.length > 0 ? total / data.length : 0;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-300">{title}</h4>
        <span className="text-xs text-slate-500">
          {format === 'position' ? `Avg: ${avg.toFixed(1)}` : `Total: ${formatValue(total)}`}
        </span>
      </div>

      {legend && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5" style={{ backgroundColor: colors.stroke }} />
            <span className="text-xs text-slate-400">{legend[0]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5" style={{ backgroundColor: secondaryColor }} />
            <span className="text-xs text-slate-400">{legend[1]}</span>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
          No data available
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {/* Y-axis labels */}
          <text x={padding - 4} y={padding + 4} className="text-[8px] fill-slate-500" textAnchor="end">
            {formatValue(maxValue)}
          </text>
          <text x={padding - 4} y={height - padding} className="text-[8px] fill-slate-500" textAnchor="end">
            {formatValue(minValue)}
          </text>

          {/* Area fill */}
          {pathD && (
            <path
              d={`${pathD} L ${points[points.length - 1]?.x || 0} ${height - padding} L ${padding} ${height - padding} Z`}
              fill={colors.fill}
            />
          )}

          {/* Secondary line */}
          {secondaryPathD && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 2"
            />
          )}

          {/* Main line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="2"
              fill={colors.stroke}
            />
          ))}
        </svg>
      )}

      {/* Date range */}
      {data.length > 0 && (
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{formatDateLabel(data[0].date)}</span>
          <span>{formatDateLabel(data[data.length - 1].date)}</span>
        </div>
      )}
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
