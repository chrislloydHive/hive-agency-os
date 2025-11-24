import Link from 'next/link';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';

export default async function GapPlansListPage() {
  const planRuns = await listRecentGapPlanRuns(50);

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
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
      cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      archived: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    };
    return statusMap[status.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">GAP Plans</h1>
            <p className="text-slate-400 mt-1">
              All growth acceleration plans across all companies (for internal use)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        {planRuns.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No GAP Plan Runs yet
          </div>
        ) : (
          <div className="space-y-4">
            {planRuns.map((run) => (
              <div
                key={run.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-base font-medium text-slate-200 truncate">
                        {run.domain || 'Unknown'}
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(run.status)}`}>
                        {run.status}
                      </span>
                      {run.overallScore && (
                        <span className="text-sm text-amber-500 font-semibold">
                          Score: {run.overallScore}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(run.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>Tip:</strong> This is a power-user view. Normally, you would access GAP plans from within a specific Company or Pipeline Opportunity.
        </p>
      </div>
    </div>
  );
}
