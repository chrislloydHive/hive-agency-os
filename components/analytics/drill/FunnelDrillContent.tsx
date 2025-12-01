// components/analytics/drill/FunnelDrillContent.tsx
// Deep-dive content for funnel step modals
//
// Shows event details for a specific funnel step including:
// - Event count and rate
// - Recent events list (from Activity Timeline)
// - Source/medium breakdown if available

'use client';

import { StatRow } from './AnalyticsDrillModal';
import type { FunnelMetrics, CompanyActivityItem } from '@/lib/analytics/types';

export type FunnelStepType =
  | 'dma_started'
  | 'dma_completed'
  | 'gap_ia_started'
  | 'gap_ia_completed'
  | 'gap_ia_report_viewed'
  | 'gap_ia_cta_clicked'
  | 'gap_started'
  | 'gap_processing_started'
  | 'gap_complete'
  | 'gap_review_cta_clicked';

interface FunnelDrillContentProps {
  stepType: FunnelStepType;
  funnels: FunnelMetrics;
  activityItems?: CompanyActivityItem[];
  dateRange?: string;
}

export function FunnelDrillContent({
  stepType,
  funnels,
  activityItems = [],
  dateRange = '30d',
}: FunnelDrillContentProps) {
  const stepInfo = getStepInfo(stepType, funnels);

  // Filter activity items to match this funnel step
  const relevantActivities = filterActivitiesByStep(activityItems, stepType);

  return (
    <div className="space-y-4">
      {/* Step summary */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-3 h-3 rounded-full ${stepInfo.color}`}
          />
          <span className="text-sm font-medium text-slate-200">
            {stepInfo.funnelName}
          </span>
        </div>

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl font-bold text-slate-100">
            {stepInfo.count.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400">
            {stepInfo.label} in {dateRange}
          </span>
        </div>

        {/* Rate info */}
        {stepInfo.rate !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{stepInfo.rateLabel}:</span>
            <span className={`font-medium ${stepInfo.rateColor}`}>
              {(stepInfo.rate * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Funnel position context */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Funnel Position
        </div>
        <FunnelVisualization stepType={stepType} funnels={funnels} />
      </div>

      {/* Related metrics */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Related Metrics
        </div>
        <div className="space-y-0">
          {stepInfo.relatedStats.map((stat, idx) => (
            <StatRow key={idx} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>

      {/* Recent events */}
      {relevantActivities.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Recent Events
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {relevantActivities.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${stepInfo.color}`}
                  />
                  <span className="text-sm text-slate-300">
                    {activity.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relevantActivities.length === 0 && (
        <div className="bg-slate-800/30 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-500">
            No individual events recorded for this step in the Activity Timeline.
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Event data is aggregated from GA4 custom events.
          </p>
        </div>
      )}
    </div>
  );
}

// Mini funnel visualization showing the current step highlighted
function FunnelVisualization({
  stepType,
  funnels,
}: {
  stepType: FunnelStepType;
  funnels: FunnelMetrics;
}) {
  const steps = getFunnelSteps(stepType, funnels);

  return (
    <div className="space-y-1">
      {steps.map((step, idx) => {
        const isActive = step.type === stepType;
        const percentage = step.total > 0 ? (step.value / step.total) * 100 : 0;

        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-24 text-xs text-slate-400 truncate">{step.label}</div>
            <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all ${
                  isActive ? step.activeColor : step.color
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div
              className={`w-12 text-right text-xs font-mono ${
                isActive ? 'text-slate-100 font-medium' : 'text-slate-400'
              }`}
            >
              {step.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to get step information
function getStepInfo(stepType: FunnelStepType, funnels: FunnelMetrics) {
  const { dma, gapIa, gapFull } = funnels;

  const stepMap: Record<
    FunnelStepType,
    {
      count: number;
      label: string;
      funnelName: string;
      color: string;
      rate?: number;
      rateLabel?: string;
      rateColor: string;
      relatedStats: { label: string; value: string | number }[];
    }
  > = {
    dma_started: {
      count: dma.auditsStarted,
      label: 'DMA audits started',
      funnelName: 'DMA Funnel',
      color: 'bg-purple-500',
      relatedStats: [
        { label: 'Completed', value: dma.auditsCompleted },
        { label: 'Completion Rate', value: `${(dma.completionRate * 100).toFixed(1)}%` },
      ],
      rateColor: 'text-purple-400',
    },
    dma_completed: {
      count: dma.auditsCompleted,
      label: 'DMA audits completed',
      funnelName: 'DMA Funnel',
      color: 'bg-purple-500',
      rate: dma.completionRate,
      rateLabel: 'Completion Rate',
      rateColor: 'text-purple-400',
      relatedStats: [
        { label: 'Started', value: dma.auditsStarted },
        { label: 'Drop-off', value: dma.auditsStarted - dma.auditsCompleted },
      ],
    },
    gap_ia_started: {
      count: gapIa.started,
      label: 'GAP-IA assessments started',
      funnelName: 'GAP-IA Funnel',
      color: 'bg-amber-500',
      relatedStats: [
        { label: 'Completed', value: gapIa.completed },
        { label: 'Report Viewed', value: gapIa.reportViewed },
        { label: 'CTA Clicked', value: gapIa.ctaClicked },
      ],
      rateColor: 'text-amber-400',
    },
    gap_ia_completed: {
      count: gapIa.completed,
      label: 'GAP-IA assessments completed',
      funnelName: 'GAP-IA Funnel',
      color: 'bg-amber-500',
      rate: gapIa.startToCompleteRate,
      rateLabel: 'Start → Complete Rate',
      rateColor: 'text-amber-400',
      relatedStats: [
        { label: 'Started', value: gapIa.started },
        { label: 'Report Viewed', value: gapIa.reportViewed },
      ],
    },
    gap_ia_report_viewed: {
      count: gapIa.reportViewed,
      label: 'GAP-IA reports viewed',
      funnelName: 'GAP-IA Funnel',
      color: 'bg-amber-500',
      relatedStats: [
        { label: 'Completed', value: gapIa.completed },
        { label: 'CTA Clicked', value: gapIa.ctaClicked },
        {
          label: 'View → CTA Rate',
          value: `${(gapIa.viewToCtaRate * 100).toFixed(1)}%`,
        },
      ],
      rateColor: 'text-amber-400',
    },
    gap_ia_cta_clicked: {
      count: gapIa.ctaClicked,
      label: 'GAP-IA CTAs clicked',
      funnelName: 'GAP-IA Funnel',
      color: 'bg-amber-500',
      rate: gapIa.viewToCtaRate,
      rateLabel: 'View → CTA Rate',
      rateColor: 'text-amber-400',
      relatedStats: [
        { label: 'Report Viewed', value: gapIa.reportViewed },
        { label: 'Started', value: gapIa.started },
      ],
    },
    gap_started: {
      count: gapFull.gapStarted,
      label: 'Full GAP assessments started',
      funnelName: 'Full GAP Funnel',
      color: 'bg-emerald-500',
      relatedStats: [
        { label: 'Processing Started', value: gapFull.gapProcessingStarted },
        { label: 'Completed', value: gapFull.gapComplete },
        { label: 'Review CTA Clicked', value: gapFull.gapReviewCtaClicked },
      ],
      rateColor: 'text-emerald-400',
    },
    gap_processing_started: {
      count: gapFull.gapProcessingStarted,
      label: 'Full GAP processing started',
      funnelName: 'Full GAP Funnel',
      color: 'bg-emerald-500',
      relatedStats: [
        { label: 'Started', value: gapFull.gapStarted },
        { label: 'Completed', value: gapFull.gapComplete },
        { label: 'Errors', value: gapFull.gapError },
      ],
      rateColor: 'text-emerald-400',
    },
    gap_complete: {
      count: gapFull.gapComplete,
      label: 'Full GAP assessments completed',
      funnelName: 'Full GAP Funnel',
      color: 'bg-emerald-500',
      rate: gapFull.startToCompleteRate,
      rateLabel: 'Start → Complete Rate',
      rateColor: 'text-emerald-400',
      relatedStats: [
        { label: 'Started', value: gapFull.gapStarted },
        { label: 'Review CTA Clicked', value: gapFull.gapReviewCtaClicked },
        {
          label: 'Complete → Review Rate',
          value: `${(gapFull.completeToReviewRate * 100).toFixed(1)}%`,
        },
      ],
    },
    gap_review_cta_clicked: {
      count: gapFull.gapReviewCtaClicked,
      label: 'Full GAP review CTAs clicked',
      funnelName: 'Full GAP Funnel',
      color: 'bg-emerald-500',
      rate: gapFull.completeToReviewRate,
      rateLabel: 'Complete → Review Rate',
      rateColor: 'text-emerald-400',
      relatedStats: [
        { label: 'Completed', value: gapFull.gapComplete },
        { label: 'Started', value: gapFull.gapStarted },
      ],
    },
  };

  return stepMap[stepType];
}

// Helper to get funnel steps for visualization
function getFunnelSteps(stepType: FunnelStepType, funnels: FunnelMetrics) {
  const { dma, gapIa, gapFull } = funnels;

  // Determine which funnel we're in
  if (stepType.startsWith('dma_')) {
    return [
      {
        type: 'dma_started' as FunnelStepType,
        label: 'Started',
        value: dma.auditsStarted,
        total: dma.auditsStarted,
        color: 'bg-purple-500/50',
        activeColor: 'bg-purple-500',
      },
      {
        type: 'dma_completed' as FunnelStepType,
        label: 'Completed',
        value: dma.auditsCompleted,
        total: dma.auditsStarted,
        color: 'bg-purple-500/50',
        activeColor: 'bg-purple-500',
      },
    ];
  }

  if (stepType.startsWith('gap_ia_')) {
    return [
      {
        type: 'gap_ia_started' as FunnelStepType,
        label: 'Started',
        value: gapIa.started,
        total: gapIa.started,
        color: 'bg-amber-500/50',
        activeColor: 'bg-amber-500',
      },
      {
        type: 'gap_ia_completed' as FunnelStepType,
        label: 'Completed',
        value: gapIa.completed,
        total: gapIa.started,
        color: 'bg-amber-500/50',
        activeColor: 'bg-amber-500',
      },
      {
        type: 'gap_ia_report_viewed' as FunnelStepType,
        label: 'Report Viewed',
        value: gapIa.reportViewed,
        total: gapIa.started,
        color: 'bg-amber-500/50',
        activeColor: 'bg-amber-500',
      },
      {
        type: 'gap_ia_cta_clicked' as FunnelStepType,
        label: 'CTA Clicked',
        value: gapIa.ctaClicked,
        total: gapIa.started,
        color: 'bg-amber-500/50',
        activeColor: 'bg-amber-500',
      },
    ];
  }

  // Full GAP funnel
  return [
    {
      type: 'gap_started' as FunnelStepType,
      label: 'Started',
      value: gapFull.gapStarted,
      total: gapFull.gapStarted,
      color: 'bg-emerald-500/50',
      activeColor: 'bg-emerald-500',
    },
    {
      type: 'gap_processing_started' as FunnelStepType,
      label: 'Processing',
      value: gapFull.gapProcessingStarted,
      total: gapFull.gapStarted,
      color: 'bg-emerald-500/50',
      activeColor: 'bg-emerald-500',
    },
    {
      type: 'gap_complete' as FunnelStepType,
      label: 'Complete',
      value: gapFull.gapComplete,
      total: gapFull.gapStarted,
      color: 'bg-emerald-500/50',
      activeColor: 'bg-emerald-500',
    },
    {
      type: 'gap_review_cta_clicked' as FunnelStepType,
      label: 'Review CTA',
      value: gapFull.gapReviewCtaClicked,
      total: gapFull.gapStarted,
      color: 'bg-emerald-500/50',
      activeColor: 'bg-emerald-500',
    },
  ];
}

// Map FunnelStepType to primary activity filter type
const stepToActivityType: Record<FunnelStepType, string> = {
  dma_started: 'dma_audit',
  dma_completed: 'dma_audit',
  gap_ia_started: 'gap_ia',
  gap_ia_completed: 'gap_ia',
  gap_ia_report_viewed: 'gap_ia',
  gap_ia_cta_clicked: 'gap_ia',
  gap_started: 'gap_full',
  gap_processing_started: 'gap_full',
  gap_complete: 'gap_full',
  gap_review_cta_clicked: 'gap_review_cta',
};

/**
 * Get the activity type to filter by for a given funnel step
 */
export function getActivityTypeForStep(stepType: FunnelStepType): string {
  return stepToActivityType[stepType] || 'gap_full';
}

// Helper to filter activities by step type
function filterActivitiesByStep(
  activities: CompanyActivityItem[],
  stepType: FunnelStepType
): CompanyActivityItem[] {
  const typeMap: Record<FunnelStepType, string[]> = {
    dma_started: ['dma_audit'],
    dma_completed: ['dma_audit'],
    gap_ia_started: ['gap_ia'],
    gap_ia_completed: ['gap_ia'],
    gap_ia_report_viewed: ['gap_ia'],
    gap_ia_cta_clicked: ['gap_ia'],
    gap_started: ['gap_full'],
    gap_processing_started: ['gap_full'],
    gap_complete: ['gap_full'],
    gap_review_cta_clicked: ['gap_review_cta', 'gap_full'],
  };

  const relevantTypes = typeMap[stepType] || [];
  return activities.filter((a) => relevantTypes.includes(a.type));
}

// Helper to format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
