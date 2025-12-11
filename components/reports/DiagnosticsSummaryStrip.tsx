'use client';

// components/reports/DiagnosticsSummaryStrip.tsx
// Diagnostics Summary Strip - Compact stats overview for the Reports hub
//
// Shows key metrics at a glance:
// - Total diagnostic runs
// - Latest run date
// - Average score
// - Link to Diagnostics tab

import Link from 'next/link';
import { Activity, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import type { DiagnosticRunSummary } from './DiagnosticsSection';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticsSummaryStripProps {
  companyId: string;
  runs: DiagnosticRunSummary[];
}

// ============================================================================
// Utilities
// ============================================================================

function computeStats(runs: DiagnosticRunSummary[]) {
  const totalRuns = runs.length;

  // Latest run date
  let latestRun: Date | null = null;
  if (runs.length > 0) {
    const sorted = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    latestRun = new Date(sorted[0].createdAt);
  }

  // Average score from scoreSummary strings (e.g., "Score: 75")
  const scores: number[] = [];
  for (const run of runs) {
    if (run.scoreSummary) {
      // Extract number from "Score: 75" or "Overall: 80 / Website: 70"
      const matches = run.scoreSummary.match(/(\d+)/g);
      if (matches) {
        // Take first number if multiple
        const num = parseInt(matches[0], 10);
        if (!isNaN(num)) {
          scores.push(num);
        }
      }
    }
  }
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : null;

  return { totalRuns, latestRun, avgScore };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Main Component
// ============================================================================

export function DiagnosticsSummaryStrip({
  companyId,
  runs,
}: DiagnosticsSummaryStripProps) {
  const { totalRuns, latestRun, avgScore } = computeStats(runs);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 md:p-5">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Diagnostics Summary</h2>
          <p className="text-[11px] text-muted-foreground">
            Quick overview of diagnostic activity.
          </p>
        </div>
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          View Diagnostics
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total Runs */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100 tabular-nums">
              {totalRuns}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">
              Total Runs
            </div>
          </div>
        </div>

        {/* Latest Run */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {latestRun ? formatDate(latestRun) : '—'}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">
              Latest Run
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100 tabular-nums">
              {avgScore !== null ? (
                <>
                  {avgScore}
                  <span className="text-sm text-slate-500">%</span>
                </>
              ) : (
                '—'
              )}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">
              Avg Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
