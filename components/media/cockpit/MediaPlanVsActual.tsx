'use client';

// components/media/cockpit/MediaPlanVsActual.tsx
// Plan vs Actual summary card for Media Lab cockpit
//
// Shows comparison between planned budget/leads and actual performance
// with variance indicators

import type { PlanVsActualSummary } from '@/lib/media/cockpit';

interface MediaPlanVsActualProps {
  data: PlanVsActualSummary;
  className?: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatVariance(value: number, pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: '—', color: 'text-slate-500' };

  const sign = value >= 0 ? '+' : '';
  const pctFormatted = `${sign}${pct.toFixed(1)}%`;

  // For budget: over is bad (red), under is good (green)
  // For leads: over is good (green), under is bad (red)
  return {
    label: pctFormatted,
    color: 'text-slate-400',
  };
}

function formatBudgetVariance(value: number, pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: '—', color: 'text-slate-500' };

  const sign = value >= 0 ? '+' : '';
  const pctFormatted = `${sign}${pct.toFixed(1)}%`;

  // Over budget = bad (red), under budget = good (green)
  if (value > 0) {
    return { label: pctFormatted, color: 'text-red-400' };
  } else if (value < 0) {
    return { label: pctFormatted, color: 'text-emerald-400' };
  }
  return { label: pctFormatted, color: 'text-slate-400' };
}

function formatLeadsVariance(value: number, pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: '—', color: 'text-slate-500' };

  const sign = value >= 0 ? '+' : '';
  const pctFormatted = `${sign}${pct.toFixed(1)}%`;

  // More leads = good (green), fewer leads = bad (red)
  if (value > 0) {
    return { label: pctFormatted, color: 'text-emerald-400' };
  } else if (value < 0) {
    return { label: pctFormatted, color: 'text-red-400' };
  }
  return { label: pctFormatted, color: 'text-slate-400' };
}

interface ComparisonRowProps {
  label: string;
  planned: string | number;
  actual: string | number;
  variance: { label: string; color: string };
}

function ComparisonRow({ label, planned, actual, variance }: ComparisonRowProps) {
  return (
    <div className="grid grid-cols-4 gap-2 py-2 border-b border-slate-800/50 last:border-0">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xs text-slate-300 tabular-nums text-right">{planned}</div>
      <div className="text-xs text-slate-100 font-medium tabular-nums text-right">{actual}</div>
      <div className={`text-xs font-medium tabular-nums text-right ${variance.color}`}>
        {variance.label}
      </div>
    </div>
  );
}

export function MediaPlanVsActual({ data, className = '' }: MediaPlanVsActualProps) {
  // No data state
  if (!data.hasPlanData && !data.hasActualData) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Plan vs Actual</h3>
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
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-xs text-slate-500">No plan or performance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Plan vs Actual</h3>
        {data.hasPlanData && data.hasActualData && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] text-blue-400 font-medium">Tracking</span>
          </span>
        )}
      </div>

      {/* Header Row */}
      <div className="grid grid-cols-4 gap-2 pb-2 border-b border-slate-700">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Metric</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 text-right">Plan</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 text-right">Actual</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 text-right">Var</div>
      </div>

      {/* Data Rows */}
      <ComparisonRow
        label="Spend"
        planned={formatCurrency(data.plannedBudget)}
        actual={formatCurrency(data.actualSpend)}
        variance={formatBudgetVariance(data.budgetVariance, data.budgetVariancePct)}
      />
      <ComparisonRow
        label="Leads"
        planned={data.plannedLeads.toLocaleString()}
        actual={data.actualLeads.toLocaleString()}
        variance={formatLeadsVariance(data.leadsVariance, data.leadsVariancePct)}
      />
      <ComparisonRow
        label="Installs"
        planned={data.plannedInstalls.toLocaleString()}
        actual={data.actualInstalls.toLocaleString()}
        variance={formatLeadsVariance(
          data.actualInstalls - data.plannedInstalls,
          data.plannedInstalls > 0
            ? ((data.actualInstalls - data.plannedInstalls) / data.plannedInstalls) * 100
            : null
        )}
      />
      <ComparisonRow
        label="CPL"
        planned={data.plannedCpl ? formatCurrency(data.plannedCpl) : '—'}
        actual={data.actualCpl ? formatCurrency(data.actualCpl) : '—'}
        variance={
          data.plannedCpl && data.actualCpl
            ? formatBudgetVariance(
                data.actualCpl - data.plannedCpl,
                ((data.actualCpl - data.plannedCpl) / data.plannedCpl) * 100
              )
            : { label: '—', color: 'text-slate-500' }
        }
      />

      {/* Summary indicator */}
      {data.hasPlanData && data.hasActualData && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs">
            {data.leadsVariancePct !== null && data.leadsVariancePct >= 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-400">On track to meet or exceed lead goals</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">Below lead target - review channel mix</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaPlanVsActual;
