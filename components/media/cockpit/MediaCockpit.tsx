'use client';

// components/media/cockpit/MediaCockpit.tsx
// Main Media Lab cockpit client component
//
// Orchestrates the cockpit view with:
// - Time range selection
// - Store filtering (for multi-location)
// - KPI tiles, Plan vs Actual, Channel breakdown
// - Data fetching via SWR

import useSWR from 'swr';
import { useMediaTimeRange } from '@/lib/hooks/useMediaTimeRange';
import { TimeRangeSelector } from './TimeRangeSelector';
import { MediaKpiTiles } from './MediaKpiTiles';
import { MediaPlanVsActual } from './MediaPlanVsActual';
import { MediaChannelBreakdown } from './MediaChannelBreakdown';
import { MediaStoreSelector } from './MediaStoreSelector';
import type { MediaCockpitData, MediaStoreOption } from '@/lib/media/cockpit';

interface MediaCockpitProps {
  companyId: string;
  initialData?: MediaCockpitData;
  stores?: MediaStoreOption[];
  className?: string;
}

// Fetcher for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch cockpit data');
  return res.json();
};

export function MediaCockpit({
  companyId,
  initialData,
  stores = [],
  className = '',
}: MediaCockpitProps) {
  const { preset, storeId, setPreset, setStoreId, getSearchParams } = useMediaTimeRange();

  // Build API URL with params
  const params = getSearchParams();
  const apiUrl = `/api/media/cockpit/${companyId}?${params.toString()}`;

  // Fetch data with SWR (use initial data for first render)
  const { data, error, isLoading } = useSWR<MediaCockpitData>(apiUrl, fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    refreshInterval: 60000, // Refresh every minute
  });

  // Loading state
  if (isLoading && !data) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
          <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-3 gap-4">
          <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">Failed to load media data</p>
            <p className="text-xs text-red-400/70 mt-0.5">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state (shouldn't normally happen with initial data)
  if (!data) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Media Overview</h2>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Updating...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={preset} onChange={setPreset} />
          <MediaStoreSelector
            stores={stores}
            selectedStoreId={storeId}
            onChange={setStoreId}
          />
        </div>
      </div>

      {/* Main cockpit grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: KPI Tiles */}
        <MediaKpiTiles data={data} />

        {/* Column 2: Plan vs Actual */}
        <MediaPlanVsActual data={data.planVsActual} />

        {/* Column 3: Channel/Provider Breakdown */}
        <MediaChannelBreakdown byChannel={data.byChannel} byProvider={data.byProvider} />
      </div>
    </div>
  );
}

export default MediaCockpit;
