'use client';

// components/reports/ReportStatsStrip.tsx
// Report Stats Strip - Bold unified stats band for diagnostics summary
//
// Features:
// - Section title + description (left)
// - Compact stat pills (middle/right)
// - CTA link to Diagnostics page

import Link from 'next/link';
import { Activity, Calendar, TrendingUp, ArrowRight } from 'lucide-react';
import type { DiagnosticRunSummary } from './DiagnosticsSection';

// ============================================================================
// Types
// ============================================================================

export interface ReportStatsStripProps {
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
      const matches = run.scoreSummary.match(/(\d+)/g);
      if (matches) {
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

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return 'border-slate-700';
  if (score >= 70) return 'border-emerald-500/30';
  if (score >= 50) return 'border-amber-500/30';
  return 'border-red-500/30';
}

// ============================================================================
// Stat Pill Component
// ============================================================================

interface StatPillProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  borderColor?: string;
}

function StatPill({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  valueColor = 'text-slate-50',
  borderColor = 'border-slate-800',
}: StatPillProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${borderColor} bg-slate-900/80`}>
      <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <div className={`text-base font-medium ${valueColor} tabular-nums`}>
          {value}
        </div>
        <div className="text-xs text-slate-400">
          {label}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportStatsStrip({
  companyId,
  runs,
}: ReportStatsStripProps) {
  const { totalRuns, latestRun, avgScore } = computeStats(runs);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 shadow-sm p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Title + Description */}
        <div className="flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">Diagnostics Summary</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quick overview of diagnostic activity.
          </p>
        </div>

        {/* Middle: Stats */}
        <div className="flex flex-wrap items-center gap-3">
          <StatPill
            icon={Activity}
            iconColor="text-purple-400"
            iconBg="bg-purple-500/10"
            label="Total Runs"
            value={totalRuns}
          />

          <StatPill
            icon={Calendar}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
            label="Latest Run"
            value={latestRun ? formatDate(latestRun) : '\u2014'}
          />

          <StatPill
            icon={TrendingUp}
            iconColor={getScoreColor(avgScore)}
            iconBg={avgScore !== null ? (
              avgScore >= 70 ? 'bg-emerald-500/10' :
              avgScore >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'
            ) : 'bg-slate-800'}
            label="Avg Score"
            value={avgScore !== null ? `${avgScore}%` : '\u2014'}
            valueColor={getScoreColor(avgScore)}
            borderColor={getScoreBorderColor(avgScore)}
          />
        </div>

        {/* Right: CTA */}
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors"
        >
          View Diagnostics
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
