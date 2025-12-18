'use client';

// components/os/funnel/FunnelLayout.tsx
// Complete funnel view layout that composes all funnel components

import { FunnelHeader, type FunnelHeaderProps } from './FunnelHeader';
import { FunnelStageCards } from './FunnelStageCards';
import { FunnelTimeSeriesChart } from './FunnelTimeSeriesChart';
import { FunnelChannelChart } from './FunnelChannelChart';
import { FunnelChannelTable } from './FunnelChannelTable';
import { FunnelCampaignTable } from './FunnelCampaignTable';
import type { FunnelDataset, FunnelStageId } from '@/lib/os/analytics/funnelTypes';

export interface FunnelLayoutProps {
  dataset: FunnelDataset;
  headerProps: Omit<FunnelHeaderProps, 'dataset'>;
  /** AI panel to render in the sidebar */
  aiPanel?: React.ReactNode;
  /** Which stages to show in time series chart */
  timeSeriesStages?: FunnelStageId[];
  /** Limit time series chart to last N days (default: show all) */
  timeSeriesDays?: number;
  /** Show campaign table */
  showCampaigns?: boolean;
  /** Show channel chart alongside table */
  showChannelChart?: boolean;
  /** Custom section to render after channels */
  customSection?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function FunnelLayout({
  dataset,
  headerProps,
  aiPanel,
  timeSeriesStages = ['audits_started', 'audits_completed'],
  timeSeriesDays,
  showCampaigns = true,
  showChannelChart = true,
  customSection,
  isLoading = false,
  error = null,
  onRetry,
}: FunnelLayoutProps) {
  // Filter time series to last N calendar days if specified
  const filteredTimeSeries = (() => {
    if (!timeSeriesDays) return dataset.timeSeries;

    // Calculate the cutoff date (N days ago from today)
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - timeSeriesDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

    // Filter to only include dates >= cutoff
    return dataset.timeSeries.filter(point => {
      // Handle both YYYYMMDD and YYYY-MM-DD formats
      const dateStr = point.date.replace(/-/g, '');
      return dateStr >= cutoffStr;
    });
  })();
  // Error state
  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-900/20 border border-red-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Funnel</h2>
          <p className="text-slate-300">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <FunnelHeader dataset={dataset} {...headerProps} isLoading={isLoading} />

      {/* Main Content */}
      <div className={`mt-6 ${aiPanel ? 'grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6' : ''}`}>
        {/* Left Column: Metrics */}
        <div className={`${aiPanel ? 'lg:col-span-2' : ''} space-y-4 sm:space-y-6`}>
          {/* Stage KPI Cards */}
          <FunnelStageCards stages={dataset.stages} isLoading={isLoading} />

          {/* Time Series Chart - always show, even if empty */}
          <FunnelTimeSeriesChart
            timeSeries={filteredTimeSeries}
            visibleStages={timeSeriesStages}
            title={
              timeSeriesDays
                ? `Daily Funnel Performance (Last ${timeSeriesDays} Days)`
                : undefined
            }
            isLoading={isLoading}
          />

          {/* Channel Performance */}
          {dataset.channels.length > 0 && (
            <>
              {showChannelChart && (
                <FunnelChannelChart
                  channels={dataset.channels}
                  isLoading={isLoading}
                />
              )}
              <FunnelChannelTable
                channels={dataset.channels}
                title={showChannelChart ? undefined : 'Channel Performance'}
                isLoading={isLoading}
              />
            </>
          )}

          {/* Campaign Performance */}
          {showCampaigns && dataset.campaigns.length > 0 && (
            <FunnelCampaignTable
              campaigns={dataset.campaigns}
              isLoading={isLoading}
            />
          )}

          {/* Custom Section */}
          {customSection}
        </div>

        {/* Right Column: AI Panel */}
        {aiPanel && (
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {aiPanel}
          </div>
        )}
      </div>
    </div>
  );
}
