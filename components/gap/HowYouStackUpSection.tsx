'use client';

import React, { useEffect, useState } from 'react';
import type { GapBenchmarkSummary, MetricBenchmark } from '@/lib/gap/benchmarks';

interface HowYouStackUpSectionProps {
  gapRunId: string;
}

/**
 * Get percentile badge info based on percentile value
 */
function getPercentileBadge(percentile: number | null): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (percentile === null) {
    return {
      label: 'Insufficient data',
      color: 'text-slate-400',
      bgColor: 'bg-slate-800/50',
    };
  }

  if (percentile >= 67) {
    return {
      label: 'Ahead of peers',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  }

  if (percentile >= 34) {
    return {
      label: 'On par with peers',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    };
  }

  return {
    label: 'Behind peers',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
  };
}

/**
 * Metric card component - renders a single dimension comparison
 */
function MetricCard({
  title,
  metric,
  peerCount,
  hasEnoughData,
}: {
  title: string;
  metric: MetricBenchmark;
  peerCount: number;
  hasEnoughData: boolean;
}) {
  const { value, median, topQuartile, percentile } = metric;

  // If no value, show placeholder
  if (value === null || value === undefined) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">{title}</h4>
        <p className="text-xs text-slate-500">No data available</p>
      </div>
    );
  }

  const badge = getPercentileBadge(percentile);

  // Calculate bar positions (0-100 scale)
  const valuePosition = Math.max(0, Math.min(100, value));
  const medianPosition = median !== null ? Math.max(0, Math.min(100, median)) : null;
  const topQuartilePosition = topQuartile !== null ? Math.max(0, Math.min(100, topQuartile)) : null;

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      {/* Card header */}
      <h4 className="text-sm font-semibold text-slate-300 mb-4">{title}</h4>

      {/* Header metrics - comparison numbers */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">You</span>
          <span className="text-2xl font-bold text-amber-500">{Math.round(value)}</span>
        </div>

        {hasEnoughData && median !== null && (
          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-400 mb-1">Median</span>
            <span className="text-lg font-semibold text-slate-300">{Math.round(median)}</span>
          </div>
        )}

        {hasEnoughData && topQuartile !== null && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-400 mb-1">Top Performers</span>
            <span className="text-lg font-semibold text-slate-300">{Math.round(topQuartile)}</span>
          </div>
        )}
      </div>

      {/* Comparison bar with multi-markers */}
      {hasEnoughData ? (
        <div className="relative h-10 mb-4">
          {/* Background track */}
          <div className="absolute inset-0 bg-slate-800 rounded-full"></div>

          {/* Median marker (vertical line) */}
          {medianPosition !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-500"
              style={{ left: `${medianPosition}%` }}
              title={`Median: ${Math.round(median!)}`}
            >
              {/* Small triangle indicator at top */}
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-500"
              />
            </div>
          )}

          {/* Top quartile marker (vertical line) */}
          {topQuartilePosition !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
              style={{ left: `${topQuartilePosition}%` }}
              title={`Top Performers: ${Math.round(topQuartile!)}`}
            >
              {/* Small triangle indicator at top */}
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-400"
              />
            </div>
          )}

          {/* Your score indicator (prominent dot) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500 rounded-full border-2 border-slate-900 shadow-lg z-10"
            style={{ left: `calc(${valuePosition}% - 8px)` }}
            title={`Your score: ${Math.round(value)}`}
          >
            {/* Pulse animation for "you" marker */}
            <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-75"></div>
          </div>
        </div>
      ) : (
        <div className="relative h-10 mb-4">
          {/* Background track */}
          <div className="absolute inset-0 bg-slate-800 rounded-full"></div>

          {/* Your score indicator only */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500 rounded-full border-2 border-slate-900 shadow-lg z-10"
            style={{ left: `calc(${valuePosition}% - 8px)` }}
            title={`Your score: ${Math.round(value)}`}
          />
        </div>
      )}

      {/* Percentile badge */}
      {hasEnoughData && percentile !== null && (
        <div className="flex items-center justify-center mb-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bgColor}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${badge.color.replace('text-', 'bg-')}`}></div>
            <span className={`text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-xs text-slate-400">
              ({percentile}th percentile)
            </span>
          </div>
        </div>
      )}

      {/* Low data message */}
      {!hasEnoughData && (
        <div className="text-center">
          <p className="text-xs text-slate-500 italic">
            Not enough data in this category yet — showing limited comparisons
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * HowYouStackUpSection - Client Component
 *
 * Fetches and displays benchmark data for a GAP run
 */
export default function HowYouStackUpSection({
  gapRunId,
}: HowYouStackUpSectionProps) {
  const [benchmarks, setBenchmarks] = useState<GapBenchmarkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch benchmarks from API
    async function fetchBenchmarks() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/gap-runs/${gapRunId}/benchmarks`);

        if (!response.ok) {
          // Handle 404 specifically (run not found in GAP-Plan Run table)
          if (response.status === 404) {
            setError('Benchmarking is only available for full GAP runs. Generate a full Growth Acceleration Plan to see how you compare.');
            setLoading(false);
            return;
          }
          throw new Error(`Failed to fetch benchmarks: ${response.statusText}`);
        }

        const data: GapBenchmarkSummary = await response.json();
        setBenchmarks(data);
      } catch (err) {
        console.error('[HowYouStackUpSection] Error fetching benchmarks:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (gapRunId) {
      fetchBenchmarks();
    }
  }, [gapRunId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          How You Stack Up
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
          <span>Loading benchmark data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !benchmarks) {
    return (
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          How You Stack Up
        </h3>
        <p className="text-sm text-slate-400">
          {error || 'Benchmark data unavailable for this GAP run.'}
        </p>
      </div>
    );
  }

  const { peerCount, category, benchmarkCohortUsed, cohortType } = benchmarks;
  const hasEnoughData = peerCount >= 3;

  // Determine the subtitle based on cohort type
  const getSubtitle = () => {
    if (!hasEnoughData) {
      return `We're still collecting enough data${benchmarkCohortUsed ? ` in your segment (${benchmarkCohortUsed})` : ''} to show full benchmarks`;
    }

    switch (cohortType) {
      case 'exact':
        return `Compared to ${peerCount} other ${benchmarkCohortUsed || 'companies'} companies in our database`;

      case 'broaderCategory':
        return (
          <span>
            We don't have many peers in your exact segment yet. This view compares you to {peerCount} other companies in your broader category.
            {benchmarkCohortUsed && (
              <span className="block mt-1 text-xs text-slate-500">
                Benchmark group: {benchmarkCohortUsed} (all tiers)
              </span>
            )}
          </span>
        );

      case 'global':
        return `Early days for this category — for now, we're comparing you to ${peerCount} companies across our full dataset`;

      default:
        return `Compared to ${peerCount} other ${category ? `${category} ` : ''}companies in our database`;
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          How You Stack Up
        </h3>
        <div className="text-sm text-slate-400">
          {getSubtitle()}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Overall" metric={benchmarks.overall} peerCount={peerCount} hasEnoughData={hasEnoughData} />
        <MetricCard title="Website" metric={benchmarks.website} peerCount={peerCount} hasEnoughData={hasEnoughData} />
        <MetricCard title="Brand" metric={benchmarks.brand} peerCount={peerCount} hasEnoughData={hasEnoughData} />
        <MetricCard title="Content" metric={benchmarks.content} peerCount={peerCount} hasEnoughData={hasEnoughData} />
        <MetricCard title="SEO" metric={benchmarks.seo} peerCount={peerCount} hasEnoughData={hasEnoughData} />
        <MetricCard title="Authority" metric={benchmarks.authority} peerCount={peerCount} hasEnoughData={hasEnoughData} />
      </div>
    </div>
  );
}
