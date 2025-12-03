'use client';

// components/media/StoreForecastGrid.tsx
// Store Forecast Grid for Media Lab
//
// Displays forecast results per store:
// - Store name and market info
// - Budget allocation and lead counts
// - Performance indicators (visibility, demand, conversion scores)
// - Sortable by any metric

import React, { useMemo, useState } from 'react';
import {
  type StoreForecast,
  type MediaForecastResult,
  formatCurrency,
} from '@/lib/media/forecastEngine';

// ============================================================================
// Types
// ============================================================================

interface StoreForecastGridProps {
  forecast: MediaForecastResult | null;
  className?: string;
}

type SortKey = 'storeName' | 'totalBudget' | 'totalLeads' | 'totalInstalls' | 'effectiveCPL' | 'visibilityScore' | 'demandScore' | 'conversionScore';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Helper Components
// ============================================================================

interface ScoreBarProps {
  score: number;
  label: string;
  color: 'blue' | 'purple' | 'emerald';
}

function ScoreBar({ score, label, color }: ScoreBarProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400 font-medium">{score}</span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

interface PerformanceBadgeProps {
  indicator: 'overperforming' | 'average' | 'underperforming';
}

function PerformanceBadge({ indicator }: PerformanceBadgeProps) {
  const config = {
    overperforming: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: 'Overperforming',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    average: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-400',
      label: 'Average',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>
      ),
    },
    underperforming: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: 'Underperforming',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
    },
  };

  const { bg, border, text, label, icon } = config[indicator];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${bg} ${border} ${text} border`}>
      {icon}
      {label}
    </span>
  );
}

interface MarketTypeBadgeProps {
  marketType: 'urban' | 'suburban' | 'rural';
}

function MarketTypeBadge({ marketType }: MarketTypeBadgeProps) {
  const config = {
    urban: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Urban' },
    suburban: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Suburban' },
    rural: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Rural' },
  };

  const { bg, text, label } = config[marketType];

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${bg} ${text}`}>
      {label}
    </span>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}

function SortHeader({ label, sortKey, currentSort, direction, onSort, align = 'left' }: SortHeaderProps) {
  const isActive = currentSort === sortKey;

  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium transition-colors ${
        isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
      } ${align === 'right' ? 'justify-end' : ''}`}
    >
      {label}
      {isActive && (
        <svg
          className={`w-3 h-3 transition-transform ${direction === 'desc' ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StoreForecastGrid({ forecast, className = '' }: StoreForecastGridProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalBudget');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showDetails, setShowDetails] = useState(false);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedStores = useMemo(() => {
    if (!forecast) return [];

    return [...forecast.byStore].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortKey) {
        case 'storeName':
          aVal = a.storeName;
          bVal = b.storeName;
          break;
        case 'totalBudget':
          aVal = a.totalBudget;
          bVal = b.totalBudget;
          break;
        case 'totalLeads':
          aVal = a.totalLeads;
          bVal = b.totalLeads;
          break;
        case 'totalInstalls':
          aVal = a.totalInstalls;
          bVal = b.totalInstalls;
          break;
        case 'effectiveCPL':
          aVal = a.effectiveCPL ?? Infinity;
          bVal = b.effectiveCPL ?? Infinity;
          break;
        case 'visibilityScore':
          aVal = a.visibilityScore;
          bVal = b.visibilityScore;
          break;
        case 'demandScore':
          aVal = a.demandScore;
          bVal = b.demandScore;
          break;
        case 'conversionScore':
          aVal = a.conversionScore;
          bVal = b.conversionScore;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [forecast, sortKey, sortDirection]);

  // Empty state
  if (!forecast || forecast.byStore.length === 0) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-sm font-medium text-slate-400 mb-1">No Store Data</h3>
          <p className="text-xs text-slate-500">Add stores to see location-level forecasts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Store Breakdown</h3>
          <p className="text-[10px] text-slate-500">{sortedStores.length} locations</p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          {showDetails ? 'Hide Scores' : 'Show Scores'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="py-2 px-2 text-left">
                <SortHeader
                  label="Store"
                  sortKey="storeName"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="py-2 px-2 text-right">
                <SortHeader
                  label="Budget"
                  sortKey="totalBudget"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-2 px-2 text-right">
                <SortHeader
                  label="Leads"
                  sortKey="totalLeads"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-2 px-2 text-right">
                <SortHeader
                  label="Installs"
                  sortKey="totalInstalls"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-2 px-2 text-right">
                <SortHeader
                  label="CPL"
                  sortKey="effectiveCPL"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-2 px-2 text-right">
                <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">
                  Status
                </span>
              </th>
              {showDetails && (
                <th className="py-2 px-2 text-center">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">
                    Scores
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedStores.map((store) => (
              <tr
                key={store.storeId}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-3 px-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-200">{store.storeName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{store.market}</span>
                      <MarketTypeBadge marketType={store.marketType} />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-sm font-medium text-slate-200">
                    {formatCurrency(store.totalBudget)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {Math.round(store.budgetPercent * 100)}% of total
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-sm font-bold text-amber-400">{store.totalLeads}</div>
                  <div className="text-[10px] text-slate-500">{store.totalCalls} calls</div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-sm font-medium text-emerald-400">{store.totalInstalls}</div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-sm font-medium text-slate-200">
                    {store.effectiveCPL ? formatCurrency(store.effectiveCPL) : '—'}
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <PerformanceBadge indicator={store.performanceIndicator} />
                </td>
                {showDetails && (
                  <td className="py-3 px-2">
                    <div className="w-32 space-y-1">
                      <ScoreBar score={store.visibilityScore} label="Visibility" color="blue" />
                      <ScoreBar score={store.demandScore} label="Demand" color="purple" />
                      <ScoreBar score={store.conversionScore} label="Conversion" color="emerald" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Budget</div>
            <div className="text-sm font-semibold text-slate-200">
              {formatCurrency(sortedStores.reduce((sum, s) => sum + s.totalBudget, 0))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Leads</div>
            <div className="text-sm font-bold text-amber-400">
              {sortedStores.reduce((sum, s) => sum + s.totalLeads, 0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Total Installs</div>
            <div className="text-sm font-semibold text-emerald-400">
              {sortedStores.reduce((sum, s) => sum + s.totalInstalls, 0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Avg CPL</div>
            <div className="text-sm font-semibold text-slate-200">
              {(() => {
                const stores = sortedStores.filter(s => s.effectiveCPL !== null);
                if (stores.length === 0) return '—';
                const avg = stores.reduce((sum, s) => sum + (s.effectiveCPL || 0), 0) / stores.length;
                return formatCurrency(avg);
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoreForecastGrid;
