'use client';

// components/analytics/WorkspaceFunnelView.tsx
// Unified workspace funnel view using shared components

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FunnelStageCards,
  FunnelTimeSeriesChart,
  FunnelChannelChart,
  FunnelChannelTable,
  FunnelAIPanel,
} from '@/components/os/funnel';
import type { FunnelDataset, FunnelStageSummary, FunnelTimePoint, FunnelChannelPerformance } from '@/lib/os/analytics/funnelTypes';

interface WorkspaceFunnelViewProps {
  initialDateRange?: '7d' | '30d' | '90d';
}

interface CompanyFunnelBreakdown {
  companyId: string;
  companyName: string;
  dmaStarted: number;
  dmaCompleted: number;
  dmaCompletionRate: number;
  gapFullStarted: number;
  gapFullComplete: number;
  gapFullReviewCtaClicked: number;
  gapReviewCtaRate: number;
}

interface WorkspaceFunnelData {
  range: {
    startDate: string;
    endDate: string;
    preset: '7d' | '30d' | '90d';
  };
  funnel: {
    stages: Array<{
      label: string;
      value: number;
      prevValue: number | null;
    }>;
  };
  companyFunnelBreakdown: CompanyFunnelBreakdown[];
}

export function WorkspaceFunnelView({ initialDateRange = '30d' }: WorkspaceFunnelViewProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>(initialDateRange);
  const [data, setData] = useState<WorkspaceFunnelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspace funnel data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/v2/workspace?range=${dateRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace funnel data');
      }

      const result = await response.json();
      if (result.ok) {
        setData({
          range: result.range,
          funnel: result.funnel,
          companyFunnelBreakdown: result.summary?.companyFunnelBreakdown || [],
        });
      } else {
        throw new Error(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error fetching workspace funnel:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform to FunnelDataset
  const dataset: FunnelDataset | null = data ? transformToDataset(data, dateRange) : null;

  // Handle date range change
  const handleDateRangeChange = (range: '7d' | '30d' | '90d') => {
    setDateRange(range);
  };

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
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
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-400">No workspace funnel data available.</p>
      </div>
    );
  }

  const cacheKey = `workspace_${dateRange}_${dataset.range.startDate}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Workspace Funnel</h2>
            <p className="text-sm text-slate-400">
              Sessions → DMA → Leads → GAP Assessments → GAP Plans
            </p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleDateRangeChange(range)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } ${isLoading ? 'opacity-50' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Funnel Stages */}
          <FunnelStageCards stages={dataset.stages} isLoading={isLoading} />

          {/* Time Series (if available) */}
          {dataset.timeSeries.length > 0 && (
            <FunnelTimeSeriesChart
              timeSeries={dataset.timeSeries}
              visibleStages={['audits_started', 'audits_completed']}
              title="Daily Funnel Activity"
              isLoading={isLoading}
            />
          )}

          {/* Per-Company Breakdown */}
          {data?.companyFunnelBreakdown && data.companyFunnelBreakdown.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-800">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">
                  Per-Company Funnel Performance
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  DMA and Full GAP funnel metrics by company
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Company</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Started</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Complete</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Rate</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">GAP Complete</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Review CTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companyFunnelBreakdown.map((company) => (
                      <tr key={company.companyId} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <Link
                            href={`/c/${company.companyId}/analytics`}
                            className="text-slate-200 hover:text-amber-400 font-medium"
                          >
                            {company.companyName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300 font-mono">
                          {company.dmaStarted.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                          {company.dmaCompleted.toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono ${
                          company.dmaCompletionRate >= 0.5 ? 'text-emerald-400' :
                          company.dmaCompletionRate < 0.3 && company.dmaStarted >= 10 ? 'text-red-400' :
                          'text-slate-400'
                        }`}>
                          {(company.dmaCompletionRate * 100).toFixed(0)}%
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                          {company.gapFullComplete.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-400 font-mono">
                          {company.gapFullReviewCtaClicked.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Link to DMA Funnel */}
          <div className="text-center">
            <Link
              href="/analytics/dma"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
            >
              View detailed DMA Funnel analytics
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* AI Panel */}
        <div>
          <FunnelAIPanel
            dataset={dataset}
            cacheContext="workspace-funnel"
            cacheKey={cacheKey}
            apiEndpoint="/api/os/funnel/insights"
            showWorkItemButtons={true}
            showExperimentButtons={true}
          />
        </div>
      </div>
    </div>
  );
}

// Transform workspace data to FunnelDataset
function transformToDataset(data: WorkspaceFunnelData, dateRange: '7d' | '30d' | '90d'): FunnelDataset {
  // Map legacy stage labels to IDs
  const stageIdMap: Record<string, FunnelStageSummary['id']> = {
    'Sessions': 'sessions',
    'DMA Audits': 'audits_started',
    'Leads': 'leads',
    'GAP Assessments': 'gap_assessments',
    'GAP Plans': 'gap_plans',
  };

  const stages: FunnelStageSummary[] = data.funnel.stages.map((stage, idx, arr) => {
    const prevStage = idx > 0 ? arr[idx - 1] : null;
    const conversionFromPrevious = prevStage && prevStage.value > 0
      ? stage.value / prevStage.value
      : null;

    return {
      id: stageIdMap[stage.label] || 'custom',
      label: stage.label,
      value: stage.value,
      prevValue: stage.prevValue,
      conversionFromPrevious,
    };
  });

  // Calculate summary
  const sessionsStage = stages.find(s => s.id === 'sessions');
  const plansStage = stages.find(s => s.id === 'gap_plans');
  const totalSessions = sessionsStage?.value ?? 0;
  const totalConversions = plansStage?.value ?? 0;

  return {
    context: 'workspace',
    range: {
      startDate: data.range.startDate,
      endDate: data.range.endDate,
      preset: dateRange,
    },
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions,
      totalConversions,
      overallConversionRate: totalSessions > 0 ? totalConversions / totalSessions : 0,
      topChannel: null,
      topCampaign: null,
      periodChange: null,
    },
    stages,
    timeSeries: [], // Would need to fetch from DMA funnel
    channels: [], // Would need to aggregate from company data
    campaigns: [],
  };
}
