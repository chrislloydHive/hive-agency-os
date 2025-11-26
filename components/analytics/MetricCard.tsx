'use client';

// components/analytics/MetricCard.tsx
// Reusable chart card component that renders metrics based on blueprint config
// Now includes ability to create Work items from metrics

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { AnalyticsMetricConfig, AnalyticsMetricData } from '@/lib/analytics/blueprintTypes';
import type { MetricWorkSuggestion } from '@/lib/types/work';

// ============================================================================
// Props
// ============================================================================

interface MetricCardProps {
  data: AnalyticsMetricData;
  loading?: boolean;
  companyId?: string;
  companyName?: string;
  websiteUrl?: string;
  onWorkCreated?: (workItemId: string) => void;
}

// ============================================================================
// Color Palette
// ============================================================================

const COLORS = {
  primary: '#f59e0b', // Amber-500
  primaryLight: '#fbbf24', // Amber-400
  positive: '#10b981', // Emerald-500
  negative: '#ef4444', // Red-500
  neutral: '#6b7280', // Gray-500
  grid: '#374151', // Gray-700
  text: '#e5e7eb', // Gray-200
  textMuted: '#9ca3af', // Gray-400
  background: 'rgba(30, 41, 59, 0.7)', // Slate-800/70
};

const PIE_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

// ============================================================================
// Main Component
// ============================================================================

export function MetricCard({
  data,
  loading = false,
  companyId,
  companyName,
  websiteUrl,
  onWorkCreated,
}: MetricCardProps) {
  const { metric, points, currentValue, previousValue, changePercent } = data;

  // Work creation state
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<MetricWorkSuggestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate change direction
  const isPositiveChange = changePercent !== undefined ? changePercent >= 0 : undefined;
  const isGoodChange = isPositiveChange !== undefined
    ? (metric.targetDirection === 'up' ? isPositiveChange : !isPositiveChange)
    : undefined;

  // Check if work creation is enabled
  const canCreateWork = !!companyId && !!companyName;

  // Handle Create Work button click
  const handleCreateClick = async () => {
    if (!companyId || !companyName) return;

    setError(null);
    setIsCreating(true);

    try {
      const res = await fetch(`/api/analytics/${companyId}/metric-to-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: data.metric,
          points: data.points,
          companyName,
          websiteUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to generate suggestion');
      }

      setSuggestion(json.suggestion);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error generating work suggestion:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle confirm create work item
  const handleConfirmCreate = async () => {
    if (!suggestion || !companyId) return;

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/analytics/${companyId}/create-work-from-metric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: data.metric,
          suggestion,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to create work item');
      }

      setSuccess(true);
      onWorkCreated?.(json.workItem.id);

      // Close modal after short delay to show success
      setTimeout(() => {
        setIsModalOpen(false);
        setSuggestion(null);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error creating work item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work item');
    } finally {
      setIsSaving(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSuggestion(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-slate-100 truncate">
              {metric.label}
            </h3>
            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
              {metric.description}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
              metric.source === 'ga4'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-green-500/20 text-green-300'
            }`}>
              {metric.source.toUpperCase()}
            </span>
            {canCreateWork && (
              <button
                onClick={handleCreateClick}
                disabled={isCreating || loading}
                className="text-[10px] uppercase font-medium px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-600 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Create work item from this metric"
              >
                {isCreating ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Thinking...</span>
                  </span>
                ) : (
                  '+ Work'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && !isModalOpen && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          </div>
        )}

        {/* Chart Area */}
        {!loading && (
          <div className="h-40">
            {metric.chartType === 'timeseries' && (
              <TimeseriesChart points={points} />
            )}

            {metric.chartType === 'bar' && (
              <VerticalBarChart points={points} />
            )}

            {metric.chartType === 'horizontalBar' && (
              <HorizontalBarChart points={points} />
            )}

            {metric.chartType === 'pie' && (
              <PieChartComponent points={points} />
            )}

            {metric.chartType === 'singleValue' && (
              <SingleValueDisplay
                points={points}
                currentValue={currentValue}
                changePercent={changePercent}
                isGoodChange={isGoodChange}
              />
            )}
          </div>
        )}

        {/* Footer with change indicator */}
        {!loading && changePercent !== undefined && metric.chartType !== 'singleValue' && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">vs. previous period</span>
            <span className={`text-sm font-medium ${
              isGoodChange ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {isPositiveChange ? '+' : ''}{changePercent.toFixed(1)}%
              <span className="ml-1">{isGoodChange ? '↑' : '↓'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Work Creation Modal */}
      {isModalOpen && suggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Create Work Item
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  From: {metric.label} ({metric.source.toUpperCase()})
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Title
                </label>
                <div className="text-sm font-medium text-slate-100 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  {suggestion.title}
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Summary
                </label>
                <div className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  {suggestion.summary}
                </div>
              </div>

              {/* How to Implement */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  How to Implement
                </label>
                <div className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg p-3 prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{suggestion.howToImplement}</div>
                </div>
              </div>

              {/* Expected Impact */}
              {suggestion.expectedImpact && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Expected Impact
                  </label>
                  <div className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    {suggestion.expectedImpact}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Work item created successfully!
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={handleCloseModal}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={isSaving || success}
                className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : success ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Created!
                  </>
                ) : (
                  'Create Work Item'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Chart Components
// ============================================================================

interface ChartProps {
  points: { date?: string; label?: string; value: number }[];
}

function TimeseriesChart({ points }: ChartProps) {
  if (points.length === 0) {
    return <EmptyState message="No time series data" />;
  }

  // Format dates for display
  const formattedData = points.map((p) => ({
    ...p,
    displayDate: p.date ? formatDate(p.date) : '',
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formattedData}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => formatNumber(v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: COLORS.text }}
          itemStyle={{ color: COLORS.primary }}
          formatter={(value: number) => [formatNumber(value), 'Value']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={COLORS.primary}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VerticalBarChart({ points }: ChartProps) {
  if (points.length === 0) {
    return <EmptyState message="No data available" />;
  }

  // Take top 10 and truncate labels
  const topData = points.slice(0, 10).map((p) => ({
    ...p,
    displayLabel: truncateLabel(p.label || '', 15),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          type="category"
          dataKey="displayLabel"
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: COLORS.text }}
          formatter={(value: number) => [formatNumber(value), 'Value']}
        />
        <Bar dataKey="value" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ points }: ChartProps) {
  if (points.length === 0) {
    return <EmptyState message="No data available" />;
  }

  // Take top 8 for horizontal bars
  const topData = points.slice(0, 8).map((p) => ({
    ...p,
    displayLabel: truncateLabel(p.label || '', 20),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topData}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="displayLabel"
          tick={{ fill: COLORS.textMuted, fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={35}
          tickFormatter={(v) => formatNumber(v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: COLORS.text }}
          formatter={(value: number) => [formatNumber(value), 'Value']}
        />
        <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartComponent({ points }: ChartProps) {
  if (points.length === 0) {
    return <EmptyState message="No data available" />;
  }

  // Take top 6 for pie chart
  const pieData = points.slice(0, 6).map((p) => ({
    name: truncateLabel(p.label || 'Unknown', 15),
    value: p.value,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={30}
          outerRadius={55}
          paddingAngle={2}
        >
          {pieData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatNumber(value), 'Value']}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface SingleValueProps {
  points: { date?: string; label?: string; value: number }[];
  currentValue?: number;
  changePercent?: number;
  isGoodChange?: boolean;
}

function SingleValueDisplay({ points, currentValue, changePercent, isGoodChange }: SingleValueProps) {
  const displayValue = currentValue ?? (points.length > 0 ? points[points.length - 1].value : null);

  return (
    <div className="flex items-center gap-4 h-full">
      {/* Main Value */}
      <div className="flex flex-col justify-center">
        <div className="text-3xl font-bold text-slate-100">
          {displayValue !== null ? formatNumber(displayValue) : '—'}
        </div>
        {changePercent !== undefined && (
          <div className={`text-sm font-medium mt-1 ${
            isGoodChange ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
            <span className="text-slate-500 ml-1">vs prev</span>
          </div>
        )}
      </div>

      {/* Mini Sparkline */}
      {points.length > 1 && (
        <div className="flex-1 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (value % 1 !== 0) {
    return value.toFixed(2);
  }
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

// ============================================================================
// Export Types
// ============================================================================

export type { MetricCardProps };
