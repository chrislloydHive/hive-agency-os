// lib/hooks/useMediaTimeRange.ts
// Time range state hook for Media Lab cockpit
//
// Provides shared time range state with URL sync for:
// - Time range preset selection
// - Custom date range
// - Store filtering (for multi-location companies)

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { MediaDateRange } from '@/lib/types/media';
import { type TimeRangePreset, getTimeRange } from '@/lib/media/cockpit';

export interface MediaTimeRangeState {
  // Current preset
  preset: TimeRangePreset;
  // Computed date range
  dateRange: MediaDateRange;
  // Store filter (null = all stores)
  storeId: string | null;
}

export interface UseMediaTimeRangeReturn extends MediaTimeRangeState {
  // Actions
  setPreset: (preset: TimeRangePreset) => void;
  setStoreId: (storeId: string | null) => void;
  setCustomRange: (start: Date, end: Date) => void;
  // URL param helpers
  getSearchParams: () => URLSearchParams;
}

const DEFAULT_PRESET: TimeRangePreset = 'last30';

export function useMediaTimeRange(): UseMediaTimeRangeReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read from URL
  const preset = (searchParams.get('range') as TimeRangePreset) || DEFAULT_PRESET;
  const storeId = searchParams.get('store') || null;

  // Custom date range from URL (for future use)
  const customStart = searchParams.get('from');
  const customEnd = searchParams.get('to');

  // Compute date range
  const dateRange = useMemo(() => {
    if (customStart && customEnd) {
      return {
        start: new Date(customStart),
        end: new Date(customEnd),
      };
    }
    return getTimeRange(preset);
  }, [preset, customStart, customEnd]);

  // Update URL helper
  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const newUrl = `${pathname}?${params.toString()}`;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setPreset = useCallback(
    (newPreset: TimeRangePreset) => {
      updateUrl({
        range: newPreset === DEFAULT_PRESET ? null : newPreset,
        from: null,
        to: null,
      });
    },
    [updateUrl]
  );

  const setStoreId = useCallback(
    (newStoreId: string | null) => {
      updateUrl({ store: newStoreId });
    },
    [updateUrl]
  );

  const setCustomRange = useCallback(
    (start: Date, end: Date) => {
      updateUrl({
        range: null,
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      });
    },
    [updateUrl]
  );

  const getSearchParams = useCallback(() => {
    const params = new URLSearchParams();
    if (preset !== DEFAULT_PRESET) params.set('range', preset);
    if (storeId) params.set('store', storeId);
    if (customStart) params.set('from', customStart);
    if (customEnd) params.set('to', customEnd);
    return params;
  }, [preset, storeId, customStart, customEnd]);

  return {
    preset,
    dateRange,
    storeId,
    setPreset,
    setStoreId,
    setCustomRange,
    getSearchParams,
  };
}

export default useMediaTimeRange;
