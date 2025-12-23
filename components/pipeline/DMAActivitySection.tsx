'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  DMARun,
  DMARunType,
  IntentLevel,
  DMAActivityResponse,
} from '@/lib/types/dma';

interface DMAActivitySectionProps {
  /** Selected intent level filter (controlled) */
  selectedIntentLevel?: IntentLevel | null;
  /** Callback when intent level is clicked */
  onIntentClick?: (level: IntentLevel, companyIds: string[]) => void;
}

// Intent level colors
const INTENT_COLORS: Record<IntentLevel, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  None: { bg: 'bg-slate-700/30', text: 'text-slate-500', border: 'border-slate-700/30' },
};

// Run type colors
const RUN_TYPE_COLORS: Record<DMARunType, { bg: string; text: string }> = {
  GAP_IA: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  GAP_FULL: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

// Score band colors
const SCORE_BAND_COLORS: Record<string, string> = {
  High: 'text-emerald-400',
  Mid: 'text-amber-400',
  Low: 'text-red-400',
  NA: 'text-slate-500',
};

// Format relative time
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format full date for tooltip
function formatFullDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type TimeframeOption = '7d' | '30d';
type FilterOption = 'all' | 'GAP_IA' | 'GAP_FULL' | 'high_intent';

export function DMAActivitySection({
  selectedIntentLevel,
  onIntentClick,
}: DMAActivitySectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<DMARun[]>([]);
  const [countByType, setCountByType] = useState<{ GAP_IA: number; GAP_FULL: number }>({ GAP_IA: 0, GAP_FULL: 0 });
  const [countByIntent, setCountByIntent] = useState<Record<IntentLevel, number>>({ High: 0, Medium: 0, Low: 0, None: 0 });
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [timeframe, setTimeframe] = useState<TimeframeOption>('7d');
  const [filter, setFilter] = useState<FilterOption>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const days = timeframe === '7d' ? 7 : 30;
      let runType: string = 'all';
      let intentLevel: string = 'all';

      if (filter === 'GAP_IA' || filter === 'GAP_FULL') {
        runType = filter;
      } else if (filter === 'high_intent') {
        intentLevel = 'High';
      }

      const params = new URLSearchParams({
        days: String(days),
        runType,
        intentLevel,
        limit: '20',
      });

      const response = await fetch(`/api/os/pipeline/dma-activity?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch DMA activity');
      }

      const data: DMAActivityResponse = await response.json();

      setRuns(data.runs);
      setCountByType(data.countByType);
      setCountByIntent(data.countByIntent);
      setTotalCount(data.totalCount);
    } catch (err) {
      console.error('[DMA Activity] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load DMA activity');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle intent badge click
  const handleIntentClick = (level: IntentLevel) => {
    if (onIntentClick) {
      // Get company IDs for this intent level
      const companyIds = runs
        .filter(r => r.companyId)
        .map(r => r.companyId!)
        .filter((v, i, a) => a.indexOf(v) === i); // unique
      onIntentClick(level, companyIds);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-slate-700 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
            <div className="h-8 w-24 bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-slate-900/70 border border-red-500/20 rounded-xl p-6">
        <div className="text-red-400 text-sm">{error}</div>
        <button
          onClick={fetchData}
          className="mt-2 text-xs text-amber-400 hover:text-amber-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <span className="text-purple-400">◉</span>
          DMA Activity
        </h3>
        <div className="flex items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            {(['7d', '30d'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-slate-700 text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          {/* Filter selector */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="all">All</option>
            <option value="GAP_FULL">Full GAP</option>
            <option value="GAP_IA">IA only</option>
            <option value="high_intent">High Intent</option>
          </select>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
          {countByType.GAP_IA} IA
        </span>
        <span className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
          {countByType.GAP_FULL} Full GAP
        </span>
        <span className="w-px h-4 bg-slate-700" />
        {Object.entries(countByIntent).map(([level, count]) => (
          count > 0 && (
            <button
              key={level}
              onClick={() => handleIntentClick(level as IntentLevel)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors hover:opacity-80 ${
                INTENT_COLORS[level as IntentLevel].bg
              } ${INTENT_COLORS[level as IntentLevel].text} ${
                INTENT_COLORS[level as IntentLevel].border
              } ${selectedIntentLevel === level ? 'ring-1 ring-white/30' : ''}`}
            >
              {count} {level}
            </button>
          )
        ))}
      </div>

      {/* Activity list */}
      {runs.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-slate-500 text-sm">No DMA activity in the selected timeframe.</div>
          <button
            onClick={() => {
              setTimeframe('30d');
              setFilter('all');
            }}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300"
          >
            Try expanding the timeframe
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Company name */}
                    {run.companyId ? (
                      <Link
                        href={`/c/${run.companyId}`}
                        className="text-sm font-medium text-slate-200 hover:text-amber-400 truncate"
                      >
                        {run.companyName || run.domain || 'Unknown'}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 truncate">
                        {run.companyName || run.domain || 'Unlinked'}
                      </span>
                    )}

                    {/* Run type badge */}
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded ${
                        RUN_TYPE_COLORS[run.runType].bg
                      } ${RUN_TYPE_COLORS[run.runType].text}`}
                    >
                      {run.runType === 'GAP_IA' ? 'IA' : 'Full'}
                    </span>

                    {/* Rerun badge */}
                    {run.isRerun && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Rerun
                      </span>
                    )}
                  </div>

                  {/* Website URL */}
                  {run.websiteUrl && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {run.domain || run.websiteUrl}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Score */}
                  <div className="text-right">
                    <div className={`text-sm font-medium ${SCORE_BAND_COLORS[run.scoreBand]}`}>
                      {run.score !== null ? run.score : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">{run.scoreBand}</div>
                  </div>

                  {/* Timestamp */}
                  <div
                    className="text-xs text-slate-500 w-16 text-right"
                    title={formatFullDate(run.createdAt)}
                  >
                    {formatRelativeTime(run.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Show more link */}
          {totalCount > runs.length && (
            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">
                Showing {runs.length} of {totalCount} runs
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
