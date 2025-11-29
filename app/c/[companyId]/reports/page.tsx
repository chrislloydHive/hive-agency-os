// app/c/[companyId]/reports/page.tsx
// Reports Hub - View all historical diagnostic runs for a company
//
// This is the canonical location for viewing report history.
// Each run can be viewed in detail at /c/[companyId]/reports/[runId]

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { getToolByDiagnosticId } from '@/lib/tools/registry';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ReportsHubPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch all diagnostic runs
  const runs = await listDiagnosticRunsForCompany(companyId);

  // Group runs by tool for summary stats
  const runsByTool = new Map<string, DiagnosticRun[]>();
  for (const run of runs) {
    const existing = runsByTool.get(run.toolId) || [];
    existing.push(run);
    runsByTool.set(run.toolId, existing);
  }

  const completedRuns = runs.filter((r) => r.status === 'complete');
  const failedRuns = runs.filter((r) => r.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/c/${companyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {company.name}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Reports</h1>
              <p className="mt-1 text-sm text-slate-400">
                Historical diagnostic runs for {company.name}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-slate-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wide">Completed</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {completedRuns.length}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-slate-400">
                <FileText className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Total Runs</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">{runs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Run List */}
      {runs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No reports yet</h3>
          <p className="text-sm text-slate-500 mb-4">
            Run diagnostic tools to generate reports for this company.
          </p>
          <Link
            href={`/c/${companyId}/tools`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Go to Tools
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <ReportRow key={run.id} run={run} companyId={companyId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Report Row Component
// ============================================================================

interface ReportRowProps {
  run: DiagnosticRun;
  companyId: string;
}

function ReportRow({ run, companyId }: ReportRowProps) {
  const tool = getToolByDiagnosticId(run.toolId);

  // Status styling
  const statusConfig = {
    complete: {
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      label: 'Complete',
    },
    running: {
      icon: Clock,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      label: 'Running',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'Failed',
    },
    pending: {
      icon: AlertCircle,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      label: 'Pending',
    },
  };

  const status = statusConfig[run.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Format date
  const date = new Date(run.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Score color
  const scoreColor =
    run.score == null
      ? 'text-slate-500'
      : run.score >= 80
        ? 'text-emerald-400'
        : run.score >= 60
          ? 'text-amber-400'
          : 'text-red-400';

  // Build view URL - use the tool's urlSlug if available
  const viewUrl = tool?.urlSlug
    ? `/c/${companyId}/diagnostics/${tool.urlSlug}/${run.id}`
    : `/c/${companyId}/reports/${run.id}`;

  return (
    <Link
      href={viewUrl}
      className="block rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition-all"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-200 truncate">
              {tool?.label || run.toolId}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bgColor} ${status.borderColor} border ${status.color}`}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          {run.summary && (
            <p className="mt-1 text-sm text-slate-400 line-clamp-1">{run.summary}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {formattedDate} at {formattedTime}
          </p>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
            {run.score ?? '—'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Score</p>
        </div>
      </div>
    </Link>
  );
}
