'use client';

// components/media/ForecastSummary.tsx
// Forecast Summary Card for Media Lab
//
// Displays key forecast metrics in a compact grid:
// - Total Budget, Impressions, Clicks
// - Leads, Calls, Installs
// - Blended CPC, CPL, Conversion Rate
// - Last updated timestamp

import { useMemo } from 'react';
import {
  type MediaForecastResult,
  type ForecastWarning,
  formatCurrency,
  formatCompact,
  formatPercent,
} from '@/lib/media/forecastEngine';

// ============================================================================
// Types
// ============================================================================

interface ForecastSummaryProps {
  forecast: MediaForecastResult | null;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatTileProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function StatTile({ label, value, subValue, icon, highlight, size = 'md' }: StatTileProps) {
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
      <div className={`font-bold tabular-nums ${highlight ? 'text-amber-400' : 'text-slate-100'} ${valueClasses[size]}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-slate-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

function WarningBanner({ warnings }: { warnings: ForecastWarning[] }) {
  if (warnings.length === 0) return null;

  const errorWarnings = warnings.filter(w => w.severity === 'error');
  const warningWarnings = warnings.filter(w => w.severity === 'warning');
  const infoWarnings = warnings.filter(w => w.severity === 'info');

  return (
    <div className="space-y-1">
      {errorWarnings.map((w, i) => (
        <div key={`error-${i}`} className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {w.message}
        </div>
      ))}
      {warningWarnings.map((w, i) => (
        <div key={`warning-${i}`} className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {w.message}
        </div>
      ))}
      {infoWarnings.map((w, i) => (
        <div key={`info-${i}`} className="flex items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {w.message}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ForecastSummary({ forecast, className = '' }: ForecastSummaryProps) {
  const formattedTime = useMemo(() => {
    if (!forecast) return '';
    const date = new Date(forecast.generatedAt);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [forecast]);

  // Empty state
  if (!forecast || forecast.summary.totalBudget === 0) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-sm font-medium text-slate-400 mb-1">No Forecast Available</h3>
          <p className="text-xs text-slate-500">Set a budget to see projected results</p>
        </div>
        {forecast && <WarningBanner warnings={forecast.warnings} />}
      </div>
    );
  }

  const { summary } = forecast;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Forecast Summary</h3>
          <p className="text-[10px] text-slate-500">
            {forecast.seasonLabel} • Updated {formattedTime}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* Warnings */}
      {forecast.warnings.length > 0 && (
        <div className="mb-4">
          <WarningBanner warnings={forecast.warnings} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatTile
          label="Budget"
          value={formatCurrency(summary.totalBudget)}
          size="lg"
          highlight
        />
        <StatTile
          label="Impressions"
          value={formatCompact(summary.totalImpressions)}
        />
        <StatTile
          label="Clicks"
          value={formatCompact(summary.totalClicks)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatTile
          label="Leads"
          value={summary.totalLeads.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatTile
          label="Calls"
          value={summary.totalCalls.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <StatTile
          label="Installs"
          value={summary.totalInstalls.toLocaleString()}
          icon={
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Cost Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Blended CPC"
          value={formatCurrency(summary.blendedCPC)}
          size="sm"
        />
        <StatTile
          label="Blended CPL"
          value={summary.blendedCPL ? formatCurrency(summary.blendedCPL) : '—'}
          size="sm"
        />
        <StatTile
          label="Conv. Rate"
          value={formatPercent(summary.blendedConvRate)}
          size="sm"
        />
      </div>

      {/* CPI if available */}
      {summary.blendedCPI && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Est. Cost Per Install</span>
            <span className="text-lg font-bold text-emerald-400">{formatCurrency(summary.blendedCPI)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ForecastSummary;
