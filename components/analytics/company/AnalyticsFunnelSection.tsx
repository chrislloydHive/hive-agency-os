'use client';

// components/analytics/company/AnalyticsFunnelSection.tsx
// Full funnel view for Company Analytics using unified funnel components

import { useMemo } from 'react';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';
import type { FunnelDataset, FunnelStageSummary, FunnelTimePoint, FunnelChannelPerformance } from '@/lib/os/analytics/funnelTypes';
import {
  FunnelStageCards,
  FunnelTimeSeriesChart,
  FunnelChannelChart,
  FunnelChannelTable,
  FunnelAIPanel,
} from '@/components/os/funnel';

interface AnalyticsFunnelSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  companyId?: string;
  companyName?: string;
}

export function AnalyticsFunnelSection({
  snapshot,
  isLoading,
  error,
  onRetry,
  companyId,
  companyName,
}: AnalyticsFunnelSectionProps) {
  // Transform company snapshot to unified FunnelDataset
  const dataset = useMemo((): FunnelDataset | null => {
    if (!snapshot || !snapshot.funnels) return null;

    const funnels = snapshot.funnels;
    const comparison = snapshot.comparison?.funnels;

    // Build stages from DMA + GAP funnel data
    const stages: FunnelStageSummary[] = [];

    // DMA stages
    stages.push({
      id: 'audits_started',
      label: 'DMA Started',
      value: funnels.metrics.dma.auditsStarted,
      prevValue: null, // Would need previous period data
      conversionFromPrevious: null,
    });

    stages.push({
      id: 'audits_completed',
      label: 'DMA Completed',
      value: funnels.metrics.dma.auditsCompleted,
      prevValue: null,
      conversionFromPrevious: funnels.metrics.dma.auditsStarted > 0
        ? funnels.metrics.dma.completionRate
        : null,
    });

    // GAP-IA stages (if data exists)
    if (funnels.metrics.gapIa.started > 0) {
      stages.push({
        id: 'gap_assessments',
        label: 'GAP-IA Started',
        value: funnels.metrics.gapIa.started,
        prevValue: null,
        conversionFromPrevious: funnels.metrics.dma.auditsCompleted > 0
          ? funnels.metrics.gapIa.started / funnels.metrics.dma.auditsCompleted
          : null,
      });

      stages.push({
        id: 'custom',
        label: 'GAP-IA CTA Clicked',
        value: funnels.metrics.gapIa.ctaClicked,
        prevValue: null,
        conversionFromPrevious: funnels.metrics.gapIa.started > 0
          ? funnels.metrics.gapIa.viewToCtaRate
          : null,
      });
    }

    // Full GAP stages (if data exists)
    if (funnels.metrics.gapFull.gapStarted > 0) {
      stages.push({
        id: 'gap_plans',
        label: 'Full GAP Complete',
        value: funnels.metrics.gapFull.gapComplete,
        prevValue: null,
        conversionFromPrevious: funnels.metrics.gapFull.gapStarted > 0
          ? funnels.metrics.gapFull.startToCompleteRate
          : null,
      });

      stages.push({
        id: 'custom',
        label: 'Review CTA Clicked',
        value: funnels.metrics.gapFull.gapReviewCtaClicked,
        prevValue: null,
        conversionFromPrevious: funnels.metrics.gapFull.gapComplete > 0
          ? funnels.metrics.gapFull.completeToReviewRate
          : null,
      });
    }

    // Build time series
    const timeSeries: FunnelTimePoint[] = funnels.timeSeries.map((point) => ({
      date: point.date,
      values: {
        sessions: 0,
        audits_started: point.dmaStarted,
        audits_completed: point.dmaCompleted,
        leads: 0,
        gap_assessments: point.gapIaStarted + point.gapFullStarted,
        gap_plans: point.gapFullComplete,
        custom: point.gapFullReviewCtaClicked,
      },
    }));

    // Build channels from bySource
    const channels: FunnelChannelPerformance[] = funnels.bySource.map((src) => ({
      channel: `${src.source} / ${src.medium}`,
      sessions: src.dmaStarted,
      conversions: src.dmaCompleted,
      conversionRate: src.dmaStarted > 0 ? src.dmaCompleted / src.dmaStarted : 0,
      values: {
        audits_started: src.dmaStarted,
        audits_completed: src.dmaCompleted,
        gap_assessments: src.gapIaStarted + src.gapFullStarted,
        gap_plans: src.gapFullComplete,
      },
    }));

    // Calculate summary
    const totalSessions = funnels.metrics.dma.auditsStarted;
    const totalConversions = funnels.metrics.gapFull.gapReviewCtaClicked || funnels.metrics.dma.auditsCompleted;
    const overallConversionRate = totalSessions > 0 ? totalConversions / totalSessions : 0;

    return {
      context: 'company',
      contextId: snapshot.companyId,
      range: {
        startDate: snapshot.range.startDate,
        endDate: snapshot.range.endDate,
        preset: snapshot.range.preset === 'custom' ? undefined : snapshot.range.preset,
      },
      generatedAt: snapshot.generatedAt,
      summary: {
        totalSessions,
        totalConversions,
        overallConversionRate,
        topChannel: channels.length > 0 ? channels[0].channel : null,
        topCampaign: null,
        periodChange: comparison?.dmaCompletionRateChange ?? null,
      },
      stages,
      timeSeries,
      channels,
      campaigns: [],
    };
  }, [snapshot]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 animate-pulse">
              <div className="h-3 w-16 bg-slate-700 rounded mb-2" />
              <div className="h-8 w-20 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-slate-900/70 border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // No funnel data
  if (!dataset || dataset.stages.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto text-slate-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Funnel Data Available</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Funnel events (DMA audits, GAP assessments) haven't been tracked for this company yet.
          Configure GA4 event tracking to enable funnel analytics.
        </p>
      </div>
    );
  }

  // Generate cache key
  const cacheKey = `${companyId}_${dataset.range.startDate}_${dataset.range.endDate}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Funnel Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Stage Cards */}
        <FunnelStageCards stages={dataset.stages} isLoading={isLoading} />

        {/* Time Series Chart */}
        {dataset.timeSeries.length > 0 && (
          <FunnelTimeSeriesChart
            timeSeries={dataset.timeSeries}
            visibleStages={['audits_started', 'audits_completed']}
            title="DMA Funnel Over Time"
            isLoading={isLoading}
          />
        )}

        {/* Channel Performance */}
        {dataset.channels.length > 0 && (
          <>
            <FunnelChannelChart
              channels={dataset.channels}
              title="Funnel by Source"
              isLoading={isLoading}
            />
            <FunnelChannelTable
              channels={dataset.channels}
              isLoading={isLoading}
            />
          </>
        )}

        {/* Detailed Funnel Metrics (legacy display) */}
        {snapshot?.funnels && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Detailed Funnel Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* DMA Funnel */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-amber-400">DMA Audit</h4>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Started</span>
                    <span className="text-slate-200 font-mono">{snapshot.funnels.metrics.dma.auditsStarted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completed</span>
                    <span className="text-emerald-400 font-mono">{snapshot.funnels.metrics.dma.auditsCompleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rate</span>
                    <span className="text-slate-200 font-mono">{(snapshot.funnels.metrics.dma.completionRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* GAP-IA Funnel */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-blue-400">GAP-IA</h4>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Started</span>
                    <span className="text-slate-200 font-mono">{snapshot.funnels.metrics.gapIa.started}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completed</span>
                    <span className="text-emerald-400 font-mono">{snapshot.funnels.metrics.gapIa.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CTA Clicked</span>
                    <span className="text-purple-400 font-mono">{snapshot.funnels.metrics.gapIa.ctaClicked}</span>
                  </div>
                </div>
              </div>

              {/* Full GAP Funnel */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-purple-400">Full GAP</h4>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Started</span>
                    <span className="text-slate-200 font-mono">{snapshot.funnels.metrics.gapFull.gapStarted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Complete</span>
                    <span className="text-emerald-400 font-mono">{snapshot.funnels.metrics.gapFull.gapComplete}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Review CTA</span>
                    <span className="text-purple-400 font-mono">{snapshot.funnels.metrics.gapFull.gapReviewCtaClicked}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Panel */}
      <div className="space-y-6">
        <FunnelAIPanel
          dataset={dataset}
          cacheContext="company-funnel"
          cacheKey={cacheKey}
          companyId={companyId}
          companyName={companyName || snapshot?.companyName}
          apiEndpoint="/api/os/funnel/insights"
          showWorkItemButtons={true}
          showExperimentButtons={true}
        />
      </div>
    </div>
  );
}
