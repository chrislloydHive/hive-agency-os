'use client';

// app/analytics/dma/DmaFunnelClientV2.tsx
// DMA Funnel Analytics Client using unified funnel components

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FunnelLayout,
  FunnelAIPanel,
} from '@/components/os/funnel';
import type { FunnelDataset } from '@/lib/os/analytics/funnelTypes';
import { transformDmaSnapshotToDataset } from '@/lib/os/analytics/funnelTypes';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

interface DmaFunnelClientV2Props {
  initialSnapshot: AuditFunnelSnapshot;
  initialRange: { startDate: string; endDate: string };
}

type DateRangeOption = '7d' | '30d' | '90d';

// Type for company funnel breakdown data
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

export default function DmaFunnelClientV2({
  initialSnapshot,
  initialRange,
}: DmaFunnelClientV2Props) {
  // Transform initial snapshot to unified dataset
  const getPresetFromRange = (start: string, end: string): DateRangeOption => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 7) return '7d';
    if (diffDays <= 30) return '30d';
    return '90d';
  };

  const initialPreset = getPresetFromRange(initialRange.startDate, initialRange.endDate);
  const initialDataset = transformDmaSnapshotToDataset(initialSnapshot, initialRange, initialPreset);

  // State
  const [dataset, setDataset] = useState<FunnelDataset>(initialDataset);
  const [dateRange, setDateRange] = useState<DateRangeOption>(initialPreset);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep legacy snapshot for per-company breakdown
  const [_snapshot, setSnapshot] = useState<AuditFunnelSnapshot>(initialSnapshot);

  // Per-company breakdown state (keeping this from legacy)
  const [companyBreakdown, setCompanyBreakdown] = useState<CompanyFunnelBreakdown[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Fetch company breakdown
  const fetchCompanyBreakdown = useCallback(async () => {
    setLoadingBreakdown(true);
    try {
      const response = await fetch(`/api/analytics/v2/workspace?range=${dateRange}`);
      const data = await response.json();
      if (data.ok && data.summary?.companyFunnelBreakdown) {
        setCompanyBreakdown(data.summary.companyFunnelBreakdown);
      }
    } catch (err) {
      console.error('Error fetching company breakdown:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [dateRange]);

  // Fetch on mount
  useEffect(() => {
    fetchCompanyBreakdown();
  }, [fetchCompanyBreakdown]);

  // Handle date range change
  const handleDateRangeChange = async (range: DateRangeOption) => {
    setDateRange(range);
    setIsLoading(true);
    setError(null);

    try {
      const today = new Date();
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - (days - 1));

      const start = startDate.toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];

      const response = await fetch(`/api/os/dma/metrics?start=${start}&end=${end}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);

      // Transform to unified dataset
      const newDataset = transformDmaSnapshotToDataset(
        data.snapshot,
        { startDate: start, endDate: end },
        range
      );
      setDataset(newDataset);

      // Also refresh company breakdown
      fetchCompanyBreakdown();
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  // Retry handler
  const handleRetry = () => {
    handleDateRangeChange(dateRange);
  };

  // Generate cache key for AI insights
  const cacheKey = `${dataset.range.startDate}_${dataset.range.endDate}`;

  // Custom section: Per-company funnel breakdown
  const companyBreakdownSection = (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-800">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100">Per-Company Funnel Performance</h2>
        <p className="text-xs text-slate-500 mt-1">
          DMA and Full GAP funnel metrics across all companies
        </p>
      </div>
      {loadingBreakdown ? (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
          <p className="text-slate-400 text-sm mt-3">Loading company data...</p>
        </div>
      ) : companyBreakdown.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Company</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Started</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Complete</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">DMA Rate</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">GAP Started</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">GAP Complete</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Review CTA</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">CTA Rate</th>
              </tr>
            </thead>
            <tbody>
              {companyBreakdown.map((company) => (
                <tr key={company.companyId} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/c/${company.companyId}/analytics`}
                      className="text-slate-200 hover:text-amber-400 transition-colors font-medium"
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
                    company.dmaCompletionRate < 0.3 && company.dmaStarted >= 10
                      ? 'text-red-400'
                      : company.dmaCompletionRate >= 0.5
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                  }`}>
                    {(company.dmaCompletionRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">
                    {company.gapFullStarted.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                    {company.gapFullComplete.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-purple-400 font-mono">
                    {company.gapFullReviewCtaClicked.toLocaleString()}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${
                    company.gapReviewCtaRate < 0.05 && company.gapFullComplete >= 5
                      ? 'text-red-400'
                      : company.gapReviewCtaRate >= 0.15
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                  }`}>
                    {(company.gapReviewCtaRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 text-sm">
          No company funnel data available. Configure GA4 for your companies to see metrics.
        </div>
      )}
    </div>
  );

  // AI Panel
  const aiPanel = (
    <FunnelAIPanel
      dataset={dataset}
      cacheContext="dma-funnel"
      cacheKey={cacheKey}
      apiEndpoint="/api/os/funnel/insights"
      showWorkItemButtons={true}
      showExperimentButtons={true}
    />
  );

  return (
    <FunnelLayout
      dataset={dataset}
      headerProps={{
        title: "DMA Funnel",
        subtitle: (
          <>
            Performance of the <span className="text-amber-400">DigitalMarketingAudit.ai</span> acquisition funnel.
          </>
        ),
        breadcrumb: {
          label: "Part of Workspace Analytics",
          href: "/analytics/os",
        },
        dateRange,
        onDateRangeChange: handleDateRangeChange,
      }}
      timeSeriesDays={7}
      aiPanel={aiPanel}
      timeSeriesStages={['audits_started', 'audits_completed']}
      showCampaigns={true}
      showChannelChart={true}
      customSection={companyBreakdownSection}
      isLoading={isLoading}
      error={error}
      onRetry={handleRetry}
    />
  );
}
