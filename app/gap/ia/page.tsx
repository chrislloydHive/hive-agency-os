import Link from 'next/link';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import GapRecordRow from '@/components/os/GapRecordRow';

export default async function GapIaListPage() {
  const iaRuns = await listRecentGapIaRuns(50);

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
            <h1 className="text-3xl font-bold text-slate-100">GAP Initial Assessments</h1>
            <p className="text-slate-400 mt-1">
              All GAP-IA runs across all companies (for internal use)
            </p>
          </div>
          <Link
            href="/gap-ia"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Run New Assessment
          </Link>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Domain
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Score
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Created
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {iaRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No GAP-IA runs yet. Run your first assessment to get started.
                  </td>
                </tr>
              ) : (
                iaRuns.map((run) => (
                  <GapRecordRow key={run.id} recordId={run.id} table="GAP-IA Runs">
                    <td className="px-4 py-3 text-slate-200 text-xs font-medium">
                      {run.domain}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-800 text-slate-300 border-slate-700">
                        {run.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {run.core.overallScore ? (
                        <span className="text-amber-500 font-semibold">
                          {run.core.overallScore}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">
                      {formatDate(run.createdAt)}
                    </td>
                  </GapRecordRow>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>Tip:</strong> This is a power-user view. Normally, you would access GAP assessments from within a specific Company or Pipeline Opportunity.
        </p>
      </div>
    </div>
  );
}
