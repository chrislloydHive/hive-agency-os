// app/c/[companyId]/gap/page.tsx
// GAP Tab - Growth Acceleration Plan quick actions and history
//
// Shows GAP-specific runs (GAP IA, GAP Plan, GAP Heavy) with links
// to the Tools hub for running and Reports hub for viewing.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { Zap, FileText, Layers, ArrowRight, Clock, CheckCircle, XCircle } from 'lucide-react';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CompanyGapPage({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return notFound();
  }

  // Fetch GAP runs from both legacy tables and unified diagnostic runs
  const [iaRuns, planRuns, diagnosticRuns] = await Promise.all([
    getGapIaRunsForCompany(companyId, 5),
    getGapPlanRunsForCompany(companyId, 5),
    listDiagnosticRunsForCompany(companyId),
  ]);

  // Filter diagnostic runs for GAP-related tools
  const gapDiagnosticRuns = diagnosticRuns.filter(
    (run) => run.toolId === 'gapSnapshot' || run.toolId === 'gapPlan' || run.toolId === 'gapHeavy'
  );

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'completed' || normalized === 'complete' || normalized === 'ready') {
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
    if (normalized === 'running' || normalized === 'processing') {
      return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
    }
    if (normalized === 'error' || normalized === 'failed') {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  const totalRuns = iaRuns.length + planRuns.length + gapDiagnosticRuns.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">GAP</h1>
            <p className="mt-1 text-sm text-slate-400">
              Growth Acceleration Plans for {company.name}
            </p>
          </div>
          <Link
            href={`/c/${companyId}/tools`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            Run GAP Tool
          </Link>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GAP IA */}
        <Link
          href={`/gap/ia?companyId=${companyId}&domain=${encodeURIComponent(company.website || company.domain || '')}`}
          className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-amber-500/50 hover:bg-slate-900/70 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-500 transition-colors" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mb-1">GAP Initial Assessment</h3>
          <p className="text-xs text-slate-400">
            Quick 5-minute marketing assessment
          </p>
        </Link>

        {/* GAP Plan */}
        <Link
          href={`/gap/plans?companyId=${companyId}&domain=${encodeURIComponent(company.website || company.domain || '')}`}
          className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-blue-500/50 hover:bg-slate-900/70 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mb-1">GAP Growth Plan</h3>
          <p className="text-xs text-slate-400">
            90-day strategic growth plan
          </p>
        </Link>

        {/* GAP Heavy (Coming Soon) */}
        <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-5 opacity-60">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Layers className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mb-1">GAP Deep Analysis</h3>
          <p className="text-xs text-slate-400">
            Comprehensive diagnostic (Coming soon)
          </p>
        </div>
      </div>

      {/* History Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent GAP Runs
          </h2>
          <Link
            href={`/c/${companyId}/reports`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all reports →
          </Link>
        </div>

        {totalRuns === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <Zap className="w-12 h-12 text-slate-600 mx-auto" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">No GAP runs yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Run a GAP assessment or growth plan to see results here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Legacy GAP-IA Runs */}
            {iaRuns.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Initial Assessments
                </p>
                <div className="space-y-2">
                  {iaRuns.slice(0, 3).map((run) => (
                    <Link
                      key={run.id}
                      href={`/gap-ia-result?runId=${run.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {run.domain || 'GAP Assessment'}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(run.createdAt)}</p>
                          </div>
                        </div>
                        {run.core?.overallScore && (
                          <span className="text-sm font-bold text-amber-500 tabular-nums">
                            {run.core.overallScore}/10
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy GAP Plan Runs */}
            {planRuns.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Growth Plans
                </p>
                <div className="space-y-2">
                  {planRuns.slice(0, 3).map((run) => (
                    <Link
                      key={run.id}
                      href={`/gap-plan-result?planId=${run.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status || 'completed')}
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {run.domain || 'Growth Plan'}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(run.createdAt)}</p>
                          </div>
                        </div>
                        {run.overallScore && (
                          <span className="text-sm font-bold text-amber-500 tabular-nums">
                            {run.overallScore}/10
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Unified Diagnostic Runs for GAP tools */}
            {gapDiagnosticRuns.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Diagnostic Runs
                </p>
                <div className="space-y-2">
                  {gapDiagnosticRuns.slice(0, 3).map((run) => (
                    <Link
                      key={run.id}
                      href={`/c/${companyId}/reports/${run.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {run.toolId === 'gapSnapshot'
                                ? 'GAP Snapshot'
                                : run.toolId === 'gapPlan'
                                  ? 'GAP Plan'
                                  : 'GAP Heavy'}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(run.createdAt)}</p>
                          </div>
                        </div>
                        {run.score != null && (
                          <span className="text-sm font-bold text-amber-500 tabular-nums">
                            {run.score}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
