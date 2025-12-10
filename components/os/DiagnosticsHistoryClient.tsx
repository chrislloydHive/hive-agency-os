'use client';

// components/os/DiagnosticsHistoryClient.tsx
// Simple chronological list of diagnostic runs
//
// Features:
// - Clean list grouped by month
// - Lab name, status badge, score, timestamp
// - Links to full report

import Link from 'next/link';
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticHistoryItem {
  id: string;
  toolId: string;
  toolLabel: string;
  status: 'complete' | 'running' | 'failed' | 'pending';
  score: number | null;
  createdAt: string;
  reportPath: string | null;
}

interface DiagnosticsHistoryClientProps {
  companyId: string;
  runs: DiagnosticHistoryItem[];
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function getMonthKey(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function groupByMonth(runs: DiagnosticHistoryItem[]): Map<string, DiagnosticHistoryItem[]> {
  const groups = new Map<string, DiagnosticHistoryItem[]>();

  for (const run of runs) {
    const monthKey = getMonthKey(run.createdAt);
    const existing = groups.get(monthKey) || [];
    existing.push(run);
    groups.set(monthKey, existing);
  }

  return groups;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Main Component
// ============================================================================

export function DiagnosticsHistoryClient({ companyId, runs }: DiagnosticsHistoryClientProps) {
  const grouped = groupByMonth(runs);

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">No Diagnostics Yet</h2>
          <p className="text-sm text-slate-400 mb-4">
            Run your first diagnostic to see results here.
          </p>
          <Link
            href={`/c/${companyId}/blueprint`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors"
          >
            Run Diagnostics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Diagnostics History</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {runs.length} diagnostic run{runs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/c/${companyId}/blueprint`}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg transition-colors"
        >
          Run New Diagnostic
        </Link>
      </div>

      {/* Grouped List */}
      {Array.from(grouped.entries()).map(([month, monthRuns]) => (
        <div key={month}>
          {/* Month Header */}
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-1">
            {month}
          </h3>

          {/* Runs */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800/50">
            {monthRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Run Row Component
// ============================================================================

function RunRow({ run }: { run: DiagnosticHistoryItem }) {
  const statusConfig = {
    complete: { icon: CheckCircle, color: 'text-emerald-400', label: 'Complete' },
    running: { icon: Loader2, color: 'text-amber-400', label: 'Running', spin: true },
    failed: { icon: AlertCircle, color: 'text-red-400', label: 'Failed' },
    pending: { icon: Clock, color: 'text-slate-400', label: 'Pending' },
  };

  const status = statusConfig[run.status];
  const StatusIcon = status.icon;
  const isComplete = run.status === 'complete';

  const content = (
    <div className={`flex items-center gap-4 px-4 py-3 ${isComplete ? 'hover:bg-slate-800/50' : ''} transition-colors`}>
      {/* Lab Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{run.toolLabel}</p>
        <p className="text-xs text-slate-500">{formatDate(run.createdAt)}</p>
      </div>

      {/* Score */}
      {run.score !== null && (
        <div className="text-right">
          <span className={`text-lg font-semibold tabular-nums ${getScoreColor(run.score)}`}>
            {run.score}
          </span>
          <span className="text-xs text-slate-500 ml-0.5">/100</span>
        </div>
      )}

      {/* Status Badge */}
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${(status as any).spin ? 'animate-spin' : ''}`} />
        <span>{status.label}</span>
      </div>

      {/* Arrow */}
      {isComplete && run.reportPath && (
        <span className="text-slate-500 text-sm">View</span>
      )}
    </div>
  );

  if (isComplete && run.reportPath) {
    return <Link href={run.reportPath}>{content}</Link>;
  }

  return content;
}

export default DiagnosticsHistoryClient;
