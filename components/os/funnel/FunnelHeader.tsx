'use client';

// components/os/funnel/FunnelHeader.tsx
// Shared header component for funnel views

import Link from 'next/link';
import type { FunnelDataset } from '@/lib/os/analytics/funnelTypes';

export interface FunnelHeaderProps {
  dataset: FunnelDataset;
  title: string;
  subtitle?: string;
  breadcrumb?: {
    label: string;
    href: string;
  };
  dateRange: '7d' | '30d' | '90d';
  onDateRangeChange: (range: '7d' | '30d' | '90d') => void;
  isLoading?: boolean;
  actions?: React.ReactNode;
}

export function FunnelHeader({
  dataset,
  title,
  subtitle,
  breadcrumb,
  dateRange,
  onDateRangeChange,
  isLoading = false,
  actions,
}: FunnelHeaderProps) {
  const formatDateRange = () => {
    const start = new Date(dataset.range.startDate);
    const end = new Date(dataset.range.endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="mb-2">
          <Link
            href={breadcrumb.href}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {breadcrumb.label}
          </Link>
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1">{title}</h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-slate-400">{subtitle}</p>
          )}
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {formatDateRange()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => onDateRangeChange(range)}
                disabled={isLoading}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Custom Actions */}
          {actions}
        </div>
      </div>

      {/* Data Sources Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <span className="text-xs text-slate-400">
            {dataset.context === 'dma' ? 'GA4 Events' :
             dataset.context === 'workspace' ? 'Workspace Data' :
             'Company Data'}
          </span>
        </div>
        {dataset.summary.topChannel && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Top channel:</span>
            <span className="text-xs text-amber-400">{dataset.summary.topChannel}</span>
          </div>
        )}
        {dataset.summary.periodChange !== null && (
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${dataset.summary.periodChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {dataset.summary.periodChange >= 0 ? '+' : ''}{dataset.summary.periodChange.toFixed(1)}% vs prev period
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
