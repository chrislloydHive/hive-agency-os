'use client';

// components/labs/analytics/AnalyticsTrendsChart.tsx
// Simple sparkline/trend chart component

import { useMemo } from 'react';
import type { AnalyticsTimeSeriesPoint } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsTrendsChartProps {
  data: AnalyticsTimeSeriesPoint[];
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red';
  label?: string;
  formatValue?: (value: number) => string;
}

// ============================================================================
// Color Mappings
// ============================================================================

const colorClasses: Record<NonNullable<AnalyticsTrendsChartProps['color']>, {
  stroke: string;
  fill: string;
  text: string;
}> = {
  blue: {
    stroke: 'stroke-blue-400',
    fill: 'fill-blue-400/10',
    text: 'text-blue-400',
  },
  emerald: {
    stroke: 'stroke-emerald-400',
    fill: 'fill-emerald-400/10',
    text: 'text-emerald-400',
  },
  amber: {
    stroke: 'stroke-amber-400',
    fill: 'fill-amber-400/10',
    text: 'text-amber-400',
  },
  purple: {
    stroke: 'stroke-purple-400',
    fill: 'fill-purple-400/10',
    text: 'text-purple-400',
  },
  red: {
    stroke: 'stroke-red-400',
    fill: 'fill-red-400/10',
    text: 'text-red-400',
  },
};

// ============================================================================
// Component
// ============================================================================

export function AnalyticsTrendsChart({
  data,
  color = 'blue',
  label,
  formatValue,
}: AnalyticsTrendsChartProps) {
  const colors = colorClasses[color];

  // Filter valid data points
  const validData = useMemo(() => {
    return data.filter((d) => d.value !== null);
  }, [data]);

  // Calculate chart dimensions and scaling
  const { pathD, areaD, stats } = useMemo(() => {
    if (validData.length < 2) {
      return { pathD: '', areaD: '', stats: null };
    }

    const values = validData.map((d) => d.value as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // SVG dimensions (viewBox)
    const width = 100;
    const height = 40;
    const padding = 2;

    // Calculate points
    const points = validData.map((d, i) => {
      const x = padding + (i / (validData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value as number - min) / range) * (height - padding * 2);
      return { x, y };
    });

    // Create path for line
    const pathCommands = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`));
    const pathD = pathCommands.join(' ');

    // Create path for area fill
    const areaCommands = [
      ...pathCommands,
      `L ${points[points.length - 1].x} ${height}`,
      `L ${points[0].x} ${height}`,
      'Z',
    ];
    const areaD = areaCommands.join(' ');

    // Calculate stats
    const latest = values[values.length - 1];
    const first = values[0];
    const change = first > 0 ? Math.round(((latest - first) / first) * 100) : 0;
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    return {
      pathD,
      areaD,
      stats: {
        latest,
        min,
        max,
        avg,
        change,
      },
    };
  }, [validData]);

  // Handle empty data
  if (validData.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-slate-500">Not enough data for chart</p>
      </div>
    );
  }

  const defaultFormatValue = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const format = formatValue || defaultFormatValue;

  return (
    <div className="h-full flex flex-col">
      {/* Header with label and latest value */}
      {(label || stats) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-xs text-slate-500">{label}</span>
          )}
          {stats && (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${colors.text}`}>
                {format(stats.latest)}
              </span>
              <span className={`text-xs ${stats.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.change >= 0 ? '+' : ''}{stats.change}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* SVG Chart */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox="0 0 100 40"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Area fill */}
          <path
            d={areaD}
            className={colors.fill}
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            className={colors.stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Min/Max labels */}
      {stats && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-600">
            Min: {format(stats.min)}
          </span>
          <span className="text-[10px] text-slate-600">
            Max: {format(stats.max)}
          </span>
        </div>
      )}
    </div>
  );
}
