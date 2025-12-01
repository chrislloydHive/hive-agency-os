'use client';

// components/os/funnel/FunnelTimeSeriesChart.tsx
// Time series line chart for funnel metrics

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FunnelTimePoint, FunnelStageId } from '@/lib/os/analytics/funnelTypes';

export interface FunnelTimeSeriesChartProps {
  timeSeries: FunnelTimePoint[];
  /** Which stage values to show (defaults to audits_started, audits_completed) */
  visibleStages?: FunnelStageId[];
  title?: string;
  height?: number;
  isLoading?: boolean;
}

// Stage display config
const STAGE_CONFIG: Record<FunnelStageId, { label: string; color: string }> = {
  sessions: { label: 'Sessions', color: '#94a3b8' },
  audits_started: { label: 'Started', color: '#f59e0b' },
  audits_completed: { label: 'Completed', color: '#10b981' },
  leads: { label: 'Leads', color: '#3b82f6' },
  gap_assessments: { label: 'Assessments', color: '#8b5cf6' },
  gap_plans: { label: 'Plans', color: '#ec4899' },
  custom: { label: 'Custom', color: '#64748b' },
};

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
      <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function FunnelTimeSeriesChart({
  timeSeries,
  visibleStages = ['audits_started', 'audits_completed'],
  title = 'Daily Funnel Performance',
  height = 300,
  isLoading = false,
}: FunnelTimeSeriesChartProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return timeSeries.map((point) => {
      const data: Record<string, any> = {
        date: new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      };

      // Add visible stage values with readable labels
      for (const stageId of visibleStages) {
        const config = STAGE_CONFIG[stageId];
        data[config.label] = point.values[stageId] || 0;
      }

      return data;
    });
  }, [timeSeries, visibleStages]);

  if (timeSeries.length === 0 && !isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100 mb-4">{title}</h2>
        <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
          No time series data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-800">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="h-56 sm:h-72 flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          </div>
        ) : (
          <div style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => (
                    <span className="text-slate-400 text-sm">{value}</span>
                  )}
                />
                {visibleStages.map((stageId) => {
                  const config = STAGE_CONFIG[stageId];
                  return (
                    <Line
                      key={stageId}
                      type="monotone"
                      dataKey={config.label}
                      stroke={config.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: config.color }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
