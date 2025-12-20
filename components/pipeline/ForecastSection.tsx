'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  PipelineForecastData,
  ForecastBucket,
  ForecastTimeWindow,
} from '@/lib/types/pipeline';
import {
  getForecastBucketLabel,
  getForecastBucketColorClasses,
  getTimeWindowLabel,
} from '@/lib/types/pipeline';

// Format currency
const formatCurrency = (num: number) => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
};

// Bucket icons
const BUCKET_ICONS: Record<ForecastBucket, string> = {
  likely: '\\u2705', // checkmark
  possible: '\\u26A0\\uFE0F', // warning
  unlikely: '\\u274C', // X
  dormant: '\\u23F8\\uFE0F', // pause
};

interface ForecastSectionProps {
  /** Optional callback when a bucket is clicked */
  onBucketClick?: (bucket: ForecastBucket, opportunityIds: string[]) => void;
}

export function ForecastSection({ onBucketClick }: ForecastSectionProps) {
  const [forecast, setForecast] = useState<PipelineForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<ForecastBucket | null>(null);

  // Fetch forecast data
  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        const response = await fetch('/api/os/pipeline/forecast');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch forecast');
        }

        setForecast(data.forecast);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load forecast');
      } finally {
        setLoading(false);
      }
    }

    fetchForecast();
  }, []);

  // Handle bucket click
  const handleBucketClick = useCallback(
    (bucket: ForecastBucket, opportunityIds: string[]) => {
      setSelectedBucket(selectedBucket === bucket ? null : bucket);
      onBucketClick?.(bucket, opportunityIds);
    },
    [selectedBucket, onBucketClick]
  );

  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-slate-700 rounded w-32 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/70 border border-red-500/30 rounded-xl p-6">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!forecast) return null;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Pipeline Forecast
        </h3>
        <div className="text-right">
          <div className="text-xl font-bold text-amber-500">
            {formatCurrency(forecast.totalOpenValue)}
          </div>
          <div className="text-xs text-slate-500">
            {forecast.totalOpenCount} open opportunities
          </div>
        </div>
      </div>

      {/* Bucket Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecast.buckets.map((bucket) => {
          const isSelected = selectedBucket === bucket.bucket;
          return (
            <button
              key={bucket.bucket}
              onClick={() => handleBucketClick(bucket.bucket, bucket.opportunityIds)}
              className={`text-left p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'ring-2 ring-amber-500/50 ' + getForecastBucketColorClasses(bucket.bucket)
                  : getForecastBucketColorClasses(bucket.bucket) + ' hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {getForecastBucketLabel(bucket.bucket)}
                </span>
                <span className="text-xs px-2 py-0.5 bg-black/20 rounded">
                  {bucket.count}
                </span>
              </div>
              <div className="text-lg font-bold">
                {formatCurrency(bucket.totalValue)}
              </div>
              {bucket.bucket === 'likely' && (
                <div className="text-xs mt-1 text-slate-500">
                  On track · next step due soon
                </div>
              )}
              {bucket.bucket === 'possible' && (
                <div className="text-xs mt-1 text-slate-500">
                  Active deals still shaping
                </div>
              )}
              {bucket.bucket === 'unlikely' && (
                <div className="text-xs mt-1 text-slate-500">
                  Stalled or missing momentum
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time Window Breakdown */}
      <div>
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          By Expected Close Date
        </h4>
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50">
                <th className="text-left px-4 py-2 text-slate-400 font-medium">
                  Time Window
                </th>
                <th className="text-right px-4 py-2 text-slate-400 font-medium">
                  Count
                </th>
                <th className="text-right px-4 py-2 text-slate-400 font-medium">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {forecast.byTimeWindow.map((tw) => (
                <tr key={tw.timeWindow} className="border-t border-slate-800">
                  <td className="px-4 py-2 text-slate-200">
                    {getTimeWindowLabel(tw.timeWindow)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">
                    {tw.count}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-400 font-medium">
                    {formatCurrency(tw.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dormant Section */}
      {forecast.dormant.count > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Dormant</span>
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
                {forecast.dormant.count}
              </span>
            </div>
            <div className="text-slate-400">
              {formatCurrency(forecast.dormant.totalValue)}
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Paused / intentionally inactive
          </div>
        </div>
      )}

      {/* View All Link */}
      <div className="pt-2">
        <Link
          href="/pipeline/opportunities"
          className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
        >
          View all opportunities &rarr;
        </Link>
      </div>
    </div>
  );
}
