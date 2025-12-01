'use client';

// components/os/funnel/FunnelChannelChart.tsx
// Bar chart showing channel performance

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FunnelChannelPerformance } from '@/lib/os/analytics/funnelTypes';

export interface FunnelChannelChartProps {
  channels: FunnelChannelPerformance[];
  title?: string;
  height?: number;
  isLoading?: boolean;
  maxChannels?: number;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
      <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
          {entry.name === 'Rate' ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

export function FunnelChannelChart({
  channels,
  title = 'Performance by Channel',
  height = 250,
  isLoading = false,
  maxChannels = 10,
}: FunnelChannelChartProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return channels.slice(0, maxChannels).map((ch) => ({
      name: ch.channel.length > 15 ? ch.channel.slice(0, 12) + '...' : ch.channel,
      fullName: ch.channel,
      Sessions: ch.sessions,
      Conversions: ch.conversions,
      Rate: Math.round(ch.conversionRate * 100),
    }));
  }, [channels, maxChannels]);

  if (channels.length === 0 && !isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100 mb-4">{title}</h2>
        <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
          No channel data available
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
          <div className="h-48 sm:h-64 flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          </div>
        ) : (
          <div style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => (
                    <span className="text-slate-400 text-sm">{value}</span>
                  )}
                />
                <Bar dataKey="Sessions" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Started" />
                <Bar dataKey="Conversions" fill="#10b981" radius={[0, 4, 4, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
