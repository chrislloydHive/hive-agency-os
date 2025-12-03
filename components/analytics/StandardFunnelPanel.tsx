// components/analytics/StandardFunnelPanel.tsx
// ============================================================================
// Standard Funnel Panel - Reusable funnel visualization component
// ============================================================================
//
// This component provides the standard funnel UI pattern used across the app.
// Visual design based on the DMA funnel page layout.
//
// Usage:
//   <StandardFunnelPanel
//     title="Core Marketing Funnel"
//     subtitle="Homepage to form submission"
//     steps={[
//       { id: 'homepage', label: 'Homepage Views', count: 1200, rate: null },
//       { id: 'key_page', label: 'Key Page Views', count: 450, rate: 0.375, dropoffRate: 0.625 },
//       { id: 'cta_click', label: 'CTA Clicks', count: 120, rate: 0.267, dropoffRate: 0.733 },
//       { id: 'form_submit', label: 'Form Submissions', count: 45, rate: 0.375, dropoffRate: 0.625 },
//     ]}
//     overallConversionRate={0.0375}
//     totalSessions={1200}
//   />

'use client';

// ============================================================================
// Types
// ============================================================================

export interface FunnelStep {
  id: string;
  label: string;
  count: number | null;
  rate?: number | null;          // step conversion % (from previous step)
  dropoffRate?: number | null;   // drop-off from prior step
  isPrimary?: boolean;           // highlight this step
}

export interface StandardFunnelPanelProps {
  title: string;
  subtitle?: string;
  description?: string;
  dateRangeLabel?: string;
  steps: FunnelStep[];
  overallConversionRate?: number | null;
  totalSessions?: number | null;
  trendLabel?: string;           // e.g. "+12% vs last 30 days"
  emptyStateMessage?: string;    // shown if not enough data
  isLoading?: boolean;
  compact?: boolean;             // smaller card variant
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

function getBarWidth(count: number | null, maxCount: number): string {
  if (count === null || maxCount === 0) return '0%';
  const percentage = Math.max(5, (count / maxCount) * 100); // minimum 5% for visibility
  return `${percentage}%`;
}

function getStepColor(index: number, total: number): string {
  // Gradient from amber to emerald as funnel progresses
  if (index === 0) return 'bg-amber-500';
  if (index === total - 1) return 'bg-emerald-500';

  const colors = ['bg-amber-500', 'bg-amber-400', 'bg-yellow-400', 'bg-lime-400', 'bg-emerald-400', 'bg-emerald-500'];
  const colorIndex = Math.floor((index / (total - 1)) * (colors.length - 1));
  return colors[colorIndex] || 'bg-slate-500';
}

// ============================================================================
// Component
// ============================================================================

export function StandardFunnelPanel({
  title,
  subtitle,
  description,
  dateRangeLabel,
  steps,
  overallConversionRate,
  totalSessions,
  trendLabel,
  emptyStateMessage = 'Not enough data to display funnel.',
  isLoading = false,
  compact = false,
}: StandardFunnelPanelProps) {
  // Calculate max count for bar scaling
  const maxCount = Math.max(...steps.map(s => s.count ?? 0), 1);

  // Check if we have enough data
  const hasData = steps.some(s => s.count !== null && s.count > 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="h-5 w-32 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!hasData) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-6 text-center">
          <svg
            className="w-10 h-10 mx-auto text-slate-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <p className="text-sm text-slate-500">{emptyStateMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`border-b border-slate-800 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-slate-100 ${compact ? 'text-sm' : 'text-base'}`}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
            {description && (
              <p className="text-xs text-slate-400 mt-1">{description}</p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {dateRangeLabel && (
              <span className="text-xs text-slate-500">{dateRangeLabel}</span>
            )}
            {trendLabel && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                trendLabel.startsWith('+')
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : trendLabel.startsWith('-')
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-700 text-slate-400'
              }`}>
                {trendLabel}
              </span>
            )}
          </div>
        </div>

        {/* Summary KPIs */}
        {(overallConversionRate !== null || totalSessions !== null) && (
          <div className="flex items-center gap-4 mt-3">
            {totalSessions !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Sessions</span>
                <span className="text-sm font-mono text-slate-200">{formatNumber(totalSessions)}</span>
              </div>
            )}
            {overallConversionRate !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Conversion</span>
                <span className="text-sm font-mono text-emerald-400">{formatPercent(overallConversionRate)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Funnel Steps */}
      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id} className="group">
              <div className="flex items-center gap-3">
                {/* Step Number */}
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                  step.isPrimary
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {index + 1}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-slate-200 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                      {step.label}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-mono text-slate-100 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {formatNumber(step.count)}
                      </span>
                      {step.rate !== null && step.rate !== undefined && index > 0 && (
                        <span className={`font-mono ${compact ? 'text-[10px]' : 'text-xs'} ${
                          step.rate >= 0.5 ? 'text-emerald-400' :
                          step.rate >= 0.2 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {formatPercent(step.rate ?? null, 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getStepColor(index, steps.length)}`}
                      style={{ width: getBarWidth(step.count, maxCount) }}
                    />
                  </div>
                </div>
              </div>

              {/* Arrow connector (except for last step) */}
              {index < steps.length - 1 && !compact && (
                <div className="ml-2.5 h-3 border-l-2 border-slate-700 border-dashed" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default StandardFunnelPanel;
