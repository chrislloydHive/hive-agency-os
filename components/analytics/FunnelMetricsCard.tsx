// components/analytics/FunnelMetricsCard.tsx
// Displays DMA, GAP-IA, and Full GAP funnel metrics from CompanyAnalyticsSnapshot
//
// This component visualizes the marketing funnels:
// - DMA: audit_started → dma_audit_complete
// - GAP-IA: gap_ia_started → gap_ia_complete → gap_ia_report_viewed → gap_ia_cta_clicked
// - Full GAP: gap_started → gap_processing_started → gap_complete → gap_review_cta_clicked

'use client';

import type { FunnelMetrics } from '@/lib/analytics/types';

interface FunnelMetricsCardProps {
  funnels: FunnelMetrics | null | undefined;
  isLoading?: boolean;
  comparison?: {
    dmaCompletionRateChange?: number;
    gapIaCtaRateChange?: number;
    gapFullCompleteRateChange?: number;
    gapFullReviewRateChange?: number;
  } | null;
}

export function FunnelMetricsCard({ funnels, isLoading, comparison }: FunnelMetricsCardProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Funnel Performance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="h-32 bg-slate-800 rounded-lg" />
          <div className="h-32 bg-slate-800 rounded-lg" />
          <div className="h-32 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!funnels) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Funnel Performance
        </h3>
        <p className="text-sm text-slate-500">
          No funnel data available. Ensure GA4 is tracking DMA, GAP-IA, and Full GAP events.
        </p>
      </div>
    );
  }

  const { dma, gapIa, gapFull } = funnels;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
        Funnel Performance
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* DMA Funnel */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h4 className="text-sm font-medium text-slate-200">DMA Funnel</h4>
          </div>

          <div className="space-y-3">
            {/* Funnel stages */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Audits Started</span>
              <span className="text-lg font-bold text-slate-100">
                {dma.auditsStarted.toLocaleString()}
              </span>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Audits Completed</span>
              <span className="text-lg font-bold text-slate-100">
                {dma.auditsCompleted.toLocaleString()}
              </span>
            </div>

            {/* Completion Rate */}
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Completion Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-purple-400">
                    {(dma.completionRate * 100).toFixed(1)}%
                  </span>
                  {comparison?.dmaCompletionRateChange !== undefined && (
                    <ChangeIndicator change={comparison.dmaCompletionRateChange} />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(dma.completionRate * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* GAP-IA Funnel */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h4 className="text-sm font-medium text-slate-200">GAP-IA Funnel</h4>
          </div>

          <div className="space-y-2">
            {/* Funnel stages with mini bars */}
            <FunnelStage label="Started" value={gapIa.started} total={gapIa.started} color="amber" />
            <FunnelStage label="Completed" value={gapIa.completed} total={gapIa.started} color="amber" />
            <FunnelStage label="Report Viewed" value={gapIa.reportViewed} total={gapIa.started} color="amber" />
            <FunnelStage label="CTA Clicked" value={gapIa.ctaClicked} total={gapIa.started} color="amber" />

            {/* Conversion rates */}
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Start → Complete</span>
                <span className="text-amber-400 font-medium">
                  {(gapIa.startToCompleteRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">View → CTA</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-medium">
                    {(gapIa.viewToCtaRate * 100).toFixed(1)}%
                  </span>
                  {comparison?.gapIaCtaRateChange !== undefined && (
                    <ChangeIndicator change={comparison.gapIaCtaRateChange} small />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full GAP Funnel */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h4 className="text-sm font-medium text-slate-200">Full GAP Funnel</h4>
          </div>

          <div className="space-y-2">
            {/* Funnel stages with mini bars */}
            <FunnelStage label="GAP Started" value={gapFull.gapStarted} total={gapFull.gapStarted} color="emerald" />
            <FunnelStage label="Processing Started" value={gapFull.gapProcessingStarted} total={gapFull.gapStarted} color="emerald" />
            <FunnelStage label="Complete" value={gapFull.gapComplete} total={gapFull.gapStarted} color="emerald" />
            <FunnelStage label="Review CTA Clicked" value={gapFull.gapReviewCtaClicked} total={gapFull.gapStarted} color="emerald" />

            {/* Conversion rates */}
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Start → Complete</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-medium">
                    {(gapFull.startToCompleteRate * 100).toFixed(1)}%
                  </span>
                  {comparison?.gapFullCompleteRateChange !== undefined && (
                    <ChangeIndicator change={comparison.gapFullCompleteRateChange} small />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Complete → Review CTA</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-medium">
                    {(gapFull.completeToReviewRate * 100).toFixed(1)}%
                  </span>
                  {comparison?.gapFullReviewRateChange !== undefined && (
                    <ChangeIndicator change={comparison.gapFullReviewRateChange} small />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for funnel stage visualization
function FunnelStage({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'amber' | 'purple' | 'emerald';
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const colorMap = {
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
  };
  const bgColor = colorMap[color];

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">{label}</span>
          <span className="text-xs font-medium text-slate-200">{value.toLocaleString()}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${bgColor} rounded-full transition-all`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for change indicators
function ChangeIndicator({ change, small = false }: { change: number; small?: boolean }) {
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  if (isNeutral) {
    return (
      <span className={`${small ? 'text-[10px]' : 'text-xs'} text-slate-500`}>
        ~0%
      </span>
    );
  }

  return (
    <span
      className={`${small ? 'text-[10px]' : 'text-xs'} ${
        isPositive ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      {isPositive ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}
