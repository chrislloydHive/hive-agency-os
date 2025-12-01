'use client';

// components/os/funnel/FunnelStageCards.tsx
// KPI cards showing funnel stage metrics with conversion arrows

import type { FunnelStageSummary } from '@/lib/os/analytics/funnelTypes';

export interface FunnelStageCardsProps {
  stages: FunnelStageSummary[];
  isLoading?: boolean;
  compact?: boolean;
}

export function FunnelStageCards({
  stages,
  isLoading = false,
  compact = false,
}: FunnelStageCardsProps) {
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatChange = (current: number, prev: number) => {
    const change = ((current - prev) / prev) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
      isPositive: change >= 0,
    };
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-2">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-400 truncate">{stage.label}</div>
              <div className="text-lg font-bold text-slate-100">
                {isLoading ? '...' : formatNumber(stage.value)}
              </div>
            </div>
            {idx < stages.length - 1 && stage.conversionFromPrevious !== null && (
              <div className="flex items-center text-xs text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {stages.map((stage, idx) => (
        <div key={stage.id} className="relative">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 sm:p-6 overflow-hidden">
            <div className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-2 truncate">
              {stage.label}
            </div>
            <div className="text-xl sm:text-3xl font-bold text-slate-100 truncate">
              {isLoading ? '...' : formatNumber(stage.value)}
            </div>

            {/* Change vs previous period */}
            {stage.prevValue !== null && stage.prevValue > 0 && !isLoading && (
              <div className="mt-2">
                {(() => {
                  const change = formatChange(stage.value, stage.prevValue);
                  return (
                    <span className={`text-xs ${change.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {change.value} vs prev
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Conversion rate from previous stage */}
            {idx > 0 && stages[idx - 1].value > 0 && !isLoading && (
              <div className="mt-1">
                <span className="text-xs text-blue-400">
                  {formatPercent(stage.value / stages[idx - 1].value)} from prev
                </span>
              </div>
            )}
          </div>

          {/* Arrow between cards (hidden on small screens) */}
          {idx < stages.length - 1 && (
            <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
