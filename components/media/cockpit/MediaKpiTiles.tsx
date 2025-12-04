'use client';

// components/media/cockpit/MediaKpiTiles.tsx
// High-level KPI tiles for Media Lab cockpit
//
// Displays key metrics at a glance:
// - Total Spend, Leads, Installs, Calls
// - Blended CPL, CPC
// - Active plans/flights count

import type { MediaCockpitData } from '@/lib/media/cockpit';

interface MediaKpiTilesProps {
  data: MediaCockpitData;
  className?: string;
}

function formatCurrency(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface KpiTileProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function KpiTile({ label, value, subValue, icon, highlight, size = 'md' }: KpiTileProps) {
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const valueClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div
      className={`rounded-lg border ${
        highlight
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-slate-800/50 border-slate-700/50'
      } ${sizeClasses[size]}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div
        className={`font-bold tabular-nums ${highlight ? 'text-amber-400' : 'text-slate-100'} ${valueClasses[size]}`}
      >
        {value}
      </div>
      {subValue && <div className="text-[10px] text-slate-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

export function MediaKpiTiles({ data, className = '' }: MediaKpiTilesProps) {
  const hasData = data.totalSpend > 0 || data.totalLeads > 0;

  // Empty state
  if (!hasData) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Performance Overview</h3>
        <div className="text-center py-6">
          <svg
            className="w-10 h-10 mx-auto mb-2 text-slate-600"
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
          <p className="text-xs text-slate-500">No performance data for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Performance Overview</h3>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {data.activePlanCount > 0 && (
            <span>
              {data.activePlanCount} plan{data.activePlanCount !== 1 ? 's' : ''}
            </span>
          )}
          {data.activeFlightCount > 0 && (
            <span className="text-slate-600">|</span>
          )}
          {data.activeFlightCount > 0 && (
            <span>
              {data.activeFlightCount} flight{data.activeFlightCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KpiTile
          label="Spend"
          value={formatCurrency(data.totalSpend)}
          size="lg"
          highlight
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <KpiTile label="Impressions" value={formatCompact(data.totalImpressions)} />
        <KpiTile label="Clicks" value={formatCompact(data.totalClicks)} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KpiTile
          label="Leads"
          value={data.totalLeads.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
        />
        <KpiTile
          label="Calls"
          value={data.totalCalls.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          }
        />
        <KpiTile
          label="Installs"
          value={data.totalInstalls.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Cost Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Blended CPL" value={formatCurrency(data.avgCpl)} size="sm" />
        <KpiTile label="Blended CPC" value={formatCurrency(data.avgCpc)} size="sm" />
      </div>

      {/* Store count for multi-location */}
      {data.storeCount > 1 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Data from {data.storeCount} stores</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaKpiTiles;
