'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { CompanyDMARuns, DMARun, IntentLevel, DMARunType } from '@/lib/types/dma';

interface CompanyDMATimelineProps {
  companyId: string;
}

// Intent level colors
const INTENT_COLORS: Record<IntentLevel, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  None: { bg: 'bg-slate-700/30', text: 'text-slate-500', border: 'border-slate-700/30' },
};

// Run type colors
const RUN_TYPE_COLORS: Record<DMARunType, { bg: string; text: string; icon: string }> = {
  GAP_IA: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '◇' },
  GAP_FULL: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '◆' },
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
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format full date
function formatFullDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CompanyDMATimeline({ companyId }: CompanyDMATimelineProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompanyDMARuns | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/dma-runs`);
        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
            return;
          }
          throw new Error('Failed to fetch DMA runs');
        }

        const result: CompanyDMARuns = await response.json();
        setData(result);
      } catch (err) {
        console.error('[DMA Timeline] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="h-5 w-32 bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
      </div>
    );
  }

  // No data state
  if (!data || data.runs.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2 mb-4">
          <span className="text-purple-400">◉</span>
          DMA Activity
        </h3>
        <div className="py-6 text-center">
          <div className="text-slate-500 text-sm">No DMA activity recorded for this company.</div>
          <p className="text-xs text-slate-600 mt-2">
            GAP runs from DMA audits and Hive OS diagnostics will appear here.
          </p>
        </div>
      </div>
    );
  }

  const { summary, runs } = data;
  const displayedRuns = isExpanded ? runs : runs.slice(0, 5);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <span className="text-purple-400">◉</span>
          DMA Activity
        </h3>
        <span
          className={`px-2 py-0.5 text-xs rounded ${
            INTENT_COLORS[summary.intentLevel].bg
          } ${INTENT_COLORS[summary.intentLevel].text} ${
            INTENT_COLORS[summary.intentLevel].border
          }`}
        >
          {summary.intentLevel} Intent
        </span>
      </div>

      {/* Summary header */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-700/50">
        <div>
          <div className="text-xs text-slate-500">Last Run</div>
          <div className="text-sm text-slate-200 font-medium">
            {summary.lastRunType === 'GAP_FULL' ? 'Full GAP' : 'GAP-IA'}
          </div>
          <div className="text-xs text-slate-400">
            {summary.lastRunAt ? formatRelativeTime(summary.lastRunAt) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Total Runs</div>
          <div className="text-sm text-slate-200 font-medium">{summary.totalRuns}</div>
          <div className="text-xs text-slate-400">
            {summary.hasRecentRun ? 'Recent activity' : 'No recent'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Latest Score</div>
          <div className={`text-sm font-medium ${SCORE_BAND_COLORS[summary.latestScoreBand]}`}>
            {summary.latestScore !== null ? summary.latestScore : '—'}
          </div>
          <div className="text-xs text-slate-400">{summary.latestScoreBand}</div>
        </div>
      </div>

      {/* Intent reasons (collapsible) */}
      {summary.intentReasons.length > 0 && (
        <div className="mb-4 p-3 bg-slate-800/30 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Intent Signals</div>
          <div className="flex flex-wrap gap-2">
            {summary.intentReasons.map((reason, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {displayedRuns.map((run, index) => (
          <TimelineItem key={run.id} run={run} isFirst={index === 0} />
        ))}
      </div>

      {/* Expand/collapse */}
      {runs.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-4 py-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {isExpanded ? 'Show less' : `Show ${runs.length - 5} more runs`}
        </button>
      )}
    </div>
  );
}

// Timeline item component
function TimelineItem({ run, isFirst }: { run: DMARun; isFirst: boolean }) {
  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-700" />

      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
          RUN_TYPE_COLORS[run.runType].bg
        } ${RUN_TYPE_COLORS[run.runType].text}`}
      >
        {RUN_TYPE_COLORS[run.runType].icon}
      </div>

      {/* Content */}
      <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Run type badge */}
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  RUN_TYPE_COLORS[run.runType].bg
                } ${RUN_TYPE_COLORS[run.runType].text}`}
              >
                {run.runType === 'GAP_IA' ? 'GAP-IA' : 'Full GAP'}
              </span>

              {/* Rerun badge */}
              {run.isRerun && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Rerun
                </span>
              )}

              {/* Days since previous */}
              {run.daysSincePreviousRun !== null && (
                <span className="text-[10px] text-slate-500">
                  {run.daysSincePreviousRun}d after prev
                </span>
              )}
            </div>

            {/* Timestamp */}
            <div
              className="text-xs text-slate-400 mt-1"
              title={formatFullDate(run.createdAt)}
            >
              {formatRelativeTime(run.createdAt)}
            </div>

            {/* Source */}
            {run.source !== 'Unknown' && (
              <div className="text-[10px] text-slate-500 mt-1">
                Source: {run.source}
              </div>
            )}
          </div>

          {/* Score */}
          <div className="text-right">
            <div className={`text-lg font-medium ${SCORE_BAND_COLORS[run.scoreBand]}`}>
              {run.score !== null ? run.score : '—'}
            </div>
            <div className="text-[10px] text-slate-500">{run.scoreBand}</div>
          </div>
        </div>

        {/* Notes preview */}
        {run.notes && (
          <div className="mt-2 text-xs text-slate-400 line-clamp-2">
            {run.notes}
          </div>
        )}

        {/* View run link */}
        {run.runUrl && (
          <Link
            href={run.runUrl}
            className="mt-2 inline-flex items-center text-xs text-amber-400 hover:text-amber-300"
          >
            View details →
          </Link>
        )}
      </div>
    </div>
  );
}
