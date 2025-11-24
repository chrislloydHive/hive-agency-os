import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';

export default async function CompanyGapPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <p className="text-slate-400">Company not found.</p>
      </div>
    );
  }

  // Fetch GAP runs for this company
  const [iaRuns, planRuns] = await Promise.all([
    getGapIaRunsForCompany(companyId, 10),
    getGapPlanRunsForCompany(companyId, 10),
  ]);

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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      running: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      pending: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      error: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return statusMap[status.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          GAP for {company.name}
        </h2>
        <p className="text-slate-400 text-sm">
          Growth Acceleration Plans and assessments for this company
        </p>
      </div>

      {/* Run GAP Assessment Button */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Run GAP Assessment
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Generate a comprehensive growth acceleration assessment for {company.name}
            </p>
          </div>
          <Link
            href={`/gap-ia?companyId=${companyId}&domain=${encodeURIComponent(company.website || '')}`}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Run Assessment
          </Link>
        </div>
      </div>

      {/* GAP History */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            GAP History
          </h3>
          <div className="flex gap-2">
            <Link
              href="/os/gap/ia"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all assessments →
            </Link>
            <span className="text-slate-600">|</span>
            <Link
              href="/os/gap/plans"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all plans →
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {/* Initial Assessments Section */}
          <div>
            <div className="text-sm font-medium text-slate-300 mb-2">
              Initial Assessments (GAP-IA)
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              {iaRuns.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 px-4">
                  No GAP-IA runs for this company yet
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {iaRuns.map((run) => (
                    <div key={run.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-200">
                              {run.domain || 'Assessment'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(run.status)}`}>
                              {run.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{formatDate(run.createdAt)}</span>
                            {run.core?.overallScore && (
                              <>
                                <span>•</span>
                                <span className="text-amber-500 font-semibold">
                                  Score: {run.core.overallScore}/10
                                </span>
                              </>
                            )}
                            {run.source && (
                              <>
                                <span>•</span>
                                <span>Source: {run.source}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/gap-ia-result?runId=${run.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
                        >
                          View Report →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Plans Section */}
          <div>
            <div className="text-sm font-medium text-slate-300 mb-2">
              Growth Acceleration Plans
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              {planRuns.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 px-4">
                  No GAP Plans for this company yet
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {planRuns.map((run) => (
                    <div key={run.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-200">
                              {run.domain || 'Growth Plan'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(run.status || 'completed')}`}>
                              {run.status || 'completed'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{formatDate(run.createdAt)}</span>
                            {run.overallScore && (
                              <>
                                <span>•</span>
                                <span className="text-amber-500 font-semibold">
                                  Score: {run.overallScore}/10
                                </span>
                              </>
                            )}
                            {run.maturityStage && (
                              <>
                                <span>•</span>
                                <span>{run.maturityStage}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/gap-plan-result?planId=${run.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
                        >
                          View Plan →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        {iaRuns.length === 0 && planRuns.length === 0 && (
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Tip:</strong> Click "Run Assessment" above to generate your first GAP assessment for {company.name}.
              All assessments and plans will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/gap-plan?companyId=${companyId}&domain=${encodeURIComponent(company.website || '')}`}
          className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 hover:border-amber-500/50 transition-colors"
        >
          <div className="text-sm font-medium text-slate-100 mb-1">
            Create Growth Plan
          </div>
          <div className="text-xs text-slate-400 mb-3">
            Generate a 90-day growth acceleration plan
          </div>
          <span className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
            Generate Plan →
          </span>
        </Link>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 opacity-50">
          <div className="text-sm font-medium text-slate-100 mb-1">
            Heavy Analysis
          </div>
          <div className="text-xs text-slate-400 mb-3">
            Run deep diagnostic analysis
          </div>
          <span className="text-sm text-slate-400">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
