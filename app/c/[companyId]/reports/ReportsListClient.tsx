'use client';

// app/c/[companyId]/reports/ReportsListClient.tsx
// Client component for the Reports list with filtering

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  type ReportListItem,
  type ReportKind,
  type ReportStatus,
  getKindLabel,
  getStatusColor,
  getKindColor,
  formatDuration,
  formatScore,
} from '@/lib/reports/diagnosticReports.shared';
import {
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface ReportsListClientProps {
  companyId: string;
  initialReports: ReportListItem[];
  initialFilters?: {
    kind?: ReportKind;
    status?: ReportStatus;
    labKey?: string;
  };
}

// ============================================================================
// Filter Options
// ============================================================================

const KIND_OPTIONS: { value: ReportKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'lab', label: 'Labs' },
  { value: 'gap_ia', label: 'GAP IA' },
  { value: 'gap_full', label: 'GAP Full' },
];

const STATUS_OPTIONS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'complete', label: 'Complete' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

// ============================================================================
// Status Icon Component
// ============================================================================

function StatusIcon({ status }: { status: ReportStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-slate-400" />;
    default:
      return null;
  }
}

// ============================================================================
// Report Row Component
// ============================================================================

function ReportRow({
  report,
  companyId,
}: {
  report: ReportListItem;
  companyId: string;
}) {
  const timeAgo = formatDistanceToNow(new Date(report.createdAt), {
    addSuffix: true,
  });

  return (
    <Link
      href={`/c/${companyId}/reports/${report.id}`}
      className="block bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-lg p-4 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <StatusIcon status={report.status} />

          {/* Title and Meta */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{report.title}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${getKindColor(report.kind)}`}
              >
                {getKindLabel(report.kind)}
              </span>
            </div>
            <div className="text-sm text-slate-400 mt-1" suppressHydrationWarning>
              {timeAgo}
              {report.durationMs && (
                <span className="ml-2 text-slate-500">
                  ({formatDuration(report.durationMs)})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Score */}
          {report.score !== null && report.score !== undefined && (
            <div className="text-right">
              <div className="text-lg font-semibold text-white">
                {formatScore(report.score)}
              </div>
              <div className="text-xs text-slate-500">Score</div>
            </div>
          )}

          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Summary */}
      {report.summary && (
        <p className="mt-3 text-sm text-slate-400 line-clamp-2">
          {report.summary}
        </p>
      )}
    </Link>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportsListClient({
  companyId,
  initialReports,
  initialFilters,
}: ReportsListClientProps) {
  const [kindFilter, setKindFilter] = useState<ReportKind | 'all'>(
    initialFilters?.kind || 'all'
  );
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>(
    initialFilters?.status || 'all'
  );

  // Filter reports
  const filteredReports = useMemo(() => {
    return initialReports.filter((report) => {
      if (kindFilter !== 'all' && report.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      return true;
    });
  }, [initialReports, kindFilter, statusFilter]);

  // Group reports by section
  const { labReports, gapReports } = useMemo(() => {
    const labs = filteredReports.filter((r) => r.kind === 'lab');
    const gaps = filteredReports.filter(
      (r) => r.kind === 'gap_ia' || r.kind === 'gap_full'
    );
    return { labReports: labs, gapReports: gaps };
  }, [filteredReports]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">Filter:</span>

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as ReportKind | 'all')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReportStatus | 'all')
          }
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-slate-500">
          {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Reports Found</h3>
          <p className="text-slate-400">
            {initialReports.length === 0
              ? 'Run a diagnostic to generate your first report.'
              : 'No reports match the selected filters.'}
          </p>
        </div>
      )}

      {/* GAP Reports Section */}
      {(kindFilter === 'all' || kindFilter === 'gap_ia' || kindFilter === 'gap_full') &&
        gapReports.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">GAP Assessments</h2>
              <span className="text-sm text-slate-500">({gapReports.length})</span>
            </div>
            <div className="space-y-3">
              {gapReports.map((report) => (
                <ReportRow key={report.id} report={report} companyId={companyId} />
              ))}
            </div>
          </div>
        )}

      {/* Lab Reports Section */}
      {(kindFilter === 'all' || kindFilter === 'lab') && labReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Lab Reports</h2>
            <span className="text-sm text-slate-500">({labReports.length})</span>
          </div>
          <div className="space-y-3">
            {labReports.map((report) => (
              <ReportRow key={report.id} report={report} companyId={companyId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
