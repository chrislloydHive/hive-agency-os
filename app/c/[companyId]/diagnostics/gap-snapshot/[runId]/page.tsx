// app/c/[companyId]/diagnostics/gap-snapshot/[runId]/page.tsx
// GAP Snapshot View Page - Displays the results of a GAP Snapshot run

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getDiagnosticRun } from '@/lib/os/diagnostics/runs';

interface GapSnapshotPageProps {
  params: Promise<{ companyId: string; runId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function GapSnapshotPage({ params }: GapSnapshotPageProps) {
  const { companyId, runId } = await params;

  const [company, run] = await Promise.all([
    getCompanyById(companyId),
    getDiagnosticRun(runId),
  ]);

  if (!company || !run) {
    notFound();
  }

  // Parse the raw JSON data
  const data = run.rawJson as Record<string, unknown> | undefined;
  const ia = data?.initialAssessment || data || {};

  // Extract scores
  const overallScore = run.score ?? (ia as Record<string, unknown>).overallScore;
  const scores = (ia as Record<string, unknown>).scores as Record<string, number> | undefined;

  // Extract key data
  const maturityStage = (ia as Record<string, unknown>).maturityStage as string | undefined;
  const executiveSummary = (ia as Record<string, unknown>).executiveSummary as string | undefined;
  const strengths = (ia as Record<string, unknown>).strengths as Array<string | { title?: string; description?: string }> | undefined;
  const gaps = (ia as Record<string, unknown>).gaps as Array<string | { title?: string; description?: string; priority?: string }> | undefined;
  const weaknesses = (ia as Record<string, unknown>).weaknesses as Array<string | { title?: string; description?: string }> | undefined;
  const quickWins = (ia as Record<string, unknown>).quickWins as Array<{ title?: string; description?: string; impact?: string; effort?: string }> | undefined;
  const recommendations = (ia as Record<string, unknown>).recommendations as Array<string | { title?: string; description?: string }> | undefined;

  // Helper to extract text from string or object
  const getText = (item: string | { title?: string; description?: string; name?: string }): string => {
    if (typeof item === 'string') return item;
    return item.title || item.name || item.description || JSON.stringify(item);
  };

  // Score color helper
  const getScoreColor = (score: number | undefined | null): string => {
    if (score == null) return 'text-slate-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="text-sm text-slate-400 hover:text-slate-300 mb-4 inline-block"
        >
          ← Back to Diagnostics
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">GAP Snapshot</h1>
            <p className="mt-1 text-sm text-slate-400">
              Initial Assessment for {company.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Run on {new Date(run.createdAt).toLocaleDateString()} at{' '}
              {new Date(run.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Overall Score</p>
            <p className={`text-4xl font-bold tabular-nums ${getScoreColor(overallScore as number)}`}>
              {overallScore ?? '—'}
            </p>
            {maturityStage && (
              <span className="mt-2 inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-xs font-medium">
                {maturityStage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      {scores && Object.keys(scores).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Score Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(scores).map(([key, value]) => (
              <div
                key={key}
                className="bg-slate-800/50 rounded-lg p-4 text-center"
              >
                <div className={`text-2xl font-bold ${getScoreColor(value)}`}>
                  {value !== undefined ? Math.round(value) : '—'}
                </div>
                <div className="text-xs text-slate-400 mt-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive Summary */}
      {(executiveSummary || run.summary) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Executive Summary</h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {executiveSummary || run.summary}
          </p>
        </div>
      )}

      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-emerald-400 mb-4">
            Strengths ({strengths.length})
          </h2>
          <ul className="space-y-3">
            {strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
                  ✓
                </span>
                <span className="text-slate-300">{getText(strength)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps / Weaknesses */}
      {((gaps && gaps.length > 0) || (weaknesses && weaknesses.length > 0)) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">
            Gaps & Weaknesses ({(gaps?.length || 0) + (weaknesses?.length || 0)})
          </h2>
          <ul className="space-y-3">
            {gaps?.map((gap, idx) => (
              <li key={`gap-${idx}`} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-medium">
                  !
                </span>
                <div className="flex-1">
                  <span className="text-slate-300">{getText(gap)}</span>
                  {typeof gap === 'object' && gap.priority && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      gap.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      gap.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {gap.priority}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {weaknesses?.map((weakness, idx) => (
              <li key={`weakness-${idx}`} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-medium">
                  !
                </span>
                <span className="text-slate-300">{getText(weakness)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Wins */}
      {quickWins && quickWins.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-blue-400 mb-4">
            Quick Wins ({quickWins.length})
          </h2>
          <div className="grid gap-4">
            {quickWins.map((win, idx) => (
              <div
                key={idx}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-200">{win.title || `Quick Win ${idx + 1}`}</h3>
                  <div className="flex gap-2">
                    {win.impact && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        win.impact === 'high' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        win.impact === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}>
                        {win.impact} impact
                      </span>
                    )}
                    {win.effort && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {win.effort}
                      </span>
                    )}
                  </div>
                </div>
                {win.description && (
                  <p className="text-sm text-slate-400">{win.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">
            Recommendations ({recommendations.length})
          </h2>
          <ul className="space-y-3">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-medium">
                  {idx + 1}
                </span>
                <span className="text-slate-300">{getText(rec)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw Data (collapsed by default) */}
      {data && (
        <details className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <summary className="p-6 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
            View Raw Data
          </summary>
          <div className="px-6 pb-6">
            <pre className="text-xs text-slate-500 overflow-auto max-h-96 bg-slate-950 rounded-lg p-4">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
        >
          ← Back to Diagnostics
        </Link>
        <Link
          href={`/c/${companyId}/plan`}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition-colors"
        >
          Generate Full GAP Plan →
        </Link>
      </div>
    </div>
  );
}
