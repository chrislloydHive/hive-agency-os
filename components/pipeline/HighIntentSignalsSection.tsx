'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DMAActivityResponse, DMARun, IntentLevel } from '@/lib/types/dma';

// Intent level badge colors
const INTENT_COLORS: Record<IntentLevel, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  None: { bg: 'bg-slate-700/30', text: 'text-slate-500', border: 'border-slate-700/30' },
};

// Format relative time
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface HighIntentSignal {
  companyId: string;
  companyName: string;
  domain: string | null;
  reason: string;
  lastRunAt: string;
  lastRunType: 'GAP_IA' | 'GAP_FULL';
  score: number | null;
  totalRuns: number;
}

export function HighIntentSignalsSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [signals, setSignals] = useState<HighIntentSignal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHighIntent() {
      try {
        // Fetch high intent only
        const response = await fetch('/api/os/pipeline/dma-activity?days=14&intentLevel=High&limit=10');
        if (!response.ok) {
          throw new Error('Failed to fetch high intent signals');
        }

        const data: DMAActivityResponse = await response.json();

        // Group runs by company and build signals
        const companyMap = new Map<string, DMARun[]>();
        for (const run of data.runs) {
          const key = run.companyId || run.domain || run.id;
          if (!companyMap.has(key)) {
            companyMap.set(key, []);
          }
          companyMap.get(key)!.push(run);
        }

        // Build signal objects
        const signalList: HighIntentSignal[] = [];
        for (const [key, runs] of companyMap) {
          const sortedRuns = [...runs].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          const latest = sortedRuns[0];

          // Determine reason
          let reason = 'High engagement';
          if (latest.runType === 'GAP_FULL') {
            reason = 'Full GAP run';
          } else if (sortedRuns.length >= 2) {
            reason = `${sortedRuns.length} runs in 14 days`;
          } else if (latest.scoreBand === 'Low') {
            reason = 'Low score with recent activity';
          }

          signalList.push({
            companyId: latest.companyId || key,
            companyName: latest.companyName || latest.domain || 'Unknown',
            domain: latest.domain,
            reason,
            lastRunAt: latest.createdAt,
            lastRunType: latest.runType,
            score: latest.score,
            totalRuns: sortedRuns.length,
          });
        }

        // Sort by most recent
        signalList.sort((a, b) =>
          new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime()
        );

        setSignals(signalList);
      } catch (err) {
        console.error('[High Intent] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHighIntent();
  }, []);

  // Don't render if loading or no signals
  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-red-500/20 rounded-xl p-6">
        <div className="h-5 w-48 bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || signals.length === 0) {
    return null; // Hide if no high intent signals
  }

  return (
    <div className="bg-slate-900/70 border border-red-500/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <span className="text-red-400">🎯</span>
          High-Intent DMA Signals
        </h3>
        <span className={`px-2 py-0.5 text-xs rounded ${INTENT_COLORS.High.bg} ${INTENT_COLORS.High.text} ${INTENT_COLORS.High.border}`}>
          {signals.length} signals
        </span>
      </div>

      <div className="space-y-2">
        {signals.map((signal) => (
          <Link
            key={signal.companyId}
            href={`/c/${signal.companyId}`}
            className="block p-3 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">
                  {signal.companyName}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-red-400">{signal.reason}</span>
                  {signal.totalRuns > 1 && (
                    <span className="text-[10px] text-slate-500">
                      ({signal.totalRuns} runs)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {signal.score !== null && (
                  <span className={`text-sm font-medium ${
                    signal.score >= 75 ? 'text-emerald-400' :
                    signal.score >= 55 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {signal.score}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(signal.lastRunAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <Link
          href="/pipeline/opportunities"
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          View all opportunities →
        </Link>
      </div>
    </div>
  );
}
