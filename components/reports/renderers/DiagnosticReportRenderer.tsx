'use client';

// components/reports/renderers/DiagnosticReportRenderer.tsx
// Main renderer that switches between Lab and GAP report renderers

import { useState } from 'react';
import {
  type ReportDetail,
  getKindLabel,
  getStatusColor,
  formatDuration,
  formatScore,
} from '@/lib/reports/diagnosticReports';
import { LabReportRenderer } from './LabReportRenderer';
import { GapReportRenderer } from './GapReportRenderer';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Code,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface DiagnosticReportRendererProps {
  report: ReportDetail;
  companyId: string;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { icon: React.ReactNode; class: string; label: string }> = {
    complete: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      class: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
      label: 'Complete',
    },
    running: {
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      class: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
      label: 'Running',
    },
    failed: {
      icon: <XCircle className="w-4 h-4" />,
      class: 'bg-red-600/20 text-red-400 border-red-600/30',
      label: 'Failed',
    },
    pending: {
      icon: <Clock className="w-4 h-4" />,
      class: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
      label: 'Pending',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${config.class}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ============================================================================
// Score Display Component
// ============================================================================

function ScoreDisplay({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBackground = (s: number) => {
    if (s >= 80) return 'bg-emerald-600/10 border-emerald-600/30';
    if (s >= 60) return 'bg-amber-600/10 border-amber-600/30';
    return 'bg-red-600/10 border-red-600/30';
  };

  return (
    <div
      className={`px-6 py-4 rounded-xl border ${getScoreBackground(score)}`}
    >
      <div className="text-sm text-slate-400 mb-1">Overall Score</div>
      <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
        {Math.round(score)}
        <span className="text-lg text-slate-500">/100</span>
      </div>
    </div>
  );
}

// ============================================================================
// Report Header Component
// ============================================================================

function ReportHeader({ report }: { report: ReportDetail }) {
  const createdDate = new Date(report.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const formattedDate = format(createdDate, 'MMM d, yyyy h:mm a');

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Left: Meta info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={report.status} />
            <span className="text-sm text-slate-400">
              {getKindLabel(report.kind)}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{formattedDate}</span>
              <span className="text-slate-600">({timeAgo})</span>
            </div>

            {report.durationMs && (
              <div className="text-slate-500">
                Duration: {formatDuration(report.durationMs)}
              </div>
            )}
          </div>

          {report.summary && (
            <p className="mt-4 text-slate-300">{report.summary}</p>
          )}
        </div>

        {/* Right: Score */}
        <ScoreDisplay score={report.score} />
      </div>
    </div>
  );
}

// ============================================================================
// Raw JSON Toggle Component
// ============================================================================

function RawJsonToggle({ data }: { data: unknown }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  return (
    <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-400">
          <Code className="w-4 h-4" />
          <span className="text-sm font-medium">View Raw JSON</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 p-4">
          <pre className="text-xs text-slate-400 overflow-x-auto max-h-96 overflow-y-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Renderer Component
// ============================================================================

export function DiagnosticReportRenderer({
  report,
  companyId,
}: DiagnosticReportRendererProps) {
  // Render header for all reports
  return (
    <div>
      <ReportHeader report={report} />

      {/* Conditional renderer based on report kind */}
      {report.kind === 'lab' ? (
        <LabReportRenderer report={report} />
      ) : (
        <GapReportRenderer report={report} />
      )}

      {/* Raw JSON toggle at bottom */}
      <RawJsonToggle data={report.data} />
    </div>
  );
}
