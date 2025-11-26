import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getLatestOsFullReportForCompany,
  getOsFullReportsForCompany,
  computeScoreTrend,
  parseFullReportToOsResult,
} from '@/lib/airtable/fullReports';
import { getPillarScore } from '@/lib/diagnostics/types';
import type { Priority, Impact, Effort } from '@/lib/diagnostics/types';
import RunOsDiagnosticsButton from '@/components/os/RunOsDiagnosticsButton';
import { CompanyMetaPanel } from '@/components/os/CompanyMetaPanel';
import { getLatestRunForCompanyAndTool, type DiagnosticRun } from '@/lib/os/diagnostics/runs';

export default async function OsOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  // Fetch Company record
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
        <p className="text-slate-400">Company not found.</p>
      </div>
    );
  }

  // Fetch latest OS Full Report (legacy)
  const latestReportRecord = await getLatestOsFullReportForCompany(companyId);
  const osResult = latestReportRecord
    ? parseFullReportToOsResult(latestReportRecord)
    : null;

  // Fetch recent OS Full Reports for trend analysis
  const recentReports = await getOsFullReportsForCompany(companyId, 5);

  // Fetch latest GAP Plan run from DiagnosticRuns (new system)
  const latestGapPlan = await getLatestRunForCompanyAndTool(companyId, 'gapPlan');
  const latestGapSnapshot = await getLatestRunForCompanyAndTool(companyId, 'gapSnapshot');
  // Use GAP Plan if available, otherwise fall back to GAP Snapshot
  const latestGapRun = latestGapPlan || latestGapSnapshot;

  // Compute trends
  const overallTrend = computeScoreTrend(recentReports, 'Overall Score');
  const websiteUxTrend = computeScoreTrend(recentReports, 'Website UX Score');

  // Extract status from latest report
  const status = latestReportRecord
    ? ((latestReportRecord.fields['Status'] as string) ?? 'Unknown')
    : 'No Data';

  // Extract top 3 cross-pillar priorities from osResult
  const allPriorities = osResult?.priorities || [];
  const topPriorities = [...allPriorities]
    .sort((a, b) => {
      // Sort by impact (high → low), then effort (low → high)
      const impactToNum = (impact: Impact | string) =>
        impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
      const effortToNum = (effort: Effort | string) =>
        effort === 'low' ? 1 : effort === 'medium' ? 2 : 3;

      return (
        impactToNum(b.impact) - impactToNum(a.impact) ||
        effortToNum(a.effort) - effortToNum(b.effort)
      );
    })
    .slice(0, 3);

  // Extract pillar scores
  const pillars = [
    { name: 'Brand', pillar: 'brand' as const, color: 'purple' },
    { name: 'Content', pillar: 'content' as const, color: 'orange' },
    { name: 'SEO', pillar: 'seo' as const, color: 'indigo' },
    { name: 'Website/UX', pillar: 'websiteUx' as const, color: 'green' },
    { name: 'Funnel', pillar: 'funnel' as const, color: 'blue' },
  ];

  const pillarScores = pillars
    .map((p) => ({
      ...p,
      score: osResult ? getPillarScore(osResult, p.pillar) : null,
    }))
    .filter((p) => p.score !== null);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Company Header Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-slate-100">
                {company.name}
              </h1>
              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  status === 'OK'
                    ? 'bg-green-500/20 text-green-300'
                    : status === 'Needs Attention'
                      ? 'bg-orange-500/20 text-orange-300'
                      : status === 'Critical'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-slate-500/20 text-slate-300'
                }`}
              >
                {status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {company.website}
                </a>
              )}
              {company.industry && <span>{company.industry}</span>}
              {company.stage && <span>{company.stage}</span>}
              {company.companyType && <span>{company.companyType}</span>}
              {company.sizeBand && <span>{company.sizeBand}</span>}
              {company.owner && <span>Owner: {company.owner}</span>}
            </div>
          </div>
          <div className="flex-shrink-0">
            <RunOsDiagnosticsButton
              companyId={company.id}
              companyName={company.name}
              websiteUrl={company.website}
            />
          </div>
        </div>
      </div>

      {/* Company Meta Panel */}
      <CompanyMetaPanel company={company} />

      {/* Latest GAP Assessment */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-100">Latest Assessment</h2>
          <Link
            href={`/c/${companyId}/diagnostics`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all diagnostics →
          </Link>
        </div>
        {latestGapRun && latestGapRun.status === 'complete' ? (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-slate-200 font-medium">
                  {latestGapRun.toolId === 'gapPlan' ? 'GAP Plan' : 'GAP Snapshot'}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  latestGapRun.status === 'complete'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : latestGapRun.status === 'running'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-red-500/20 text-red-300'
                }`}>
                  {latestGapRun.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(latestGapRun.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {latestGapRun.summary && (
                <p className="mt-2 text-sm text-slate-400 line-clamp-2">
                  {latestGapRun.summary}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {latestGapRun.score != null && (
                <div className="text-right">
                  <p className={`text-3xl font-bold tabular-nums ${
                    latestGapRun.score >= 80 ? 'text-emerald-400' :
                    latestGapRun.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {latestGapRun.score}
                  </p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Score</p>
                </div>
              )}
              <Link
                href={`/c/${companyId}/diagnostics/${latestGapRun.toolId === 'gapPlan' ? 'gap-plan' : 'gap-snapshot'}/${latestGapRun.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all text-sm font-medium"
              >
                View Report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        ) : latestGapRun && latestGapRun.status === 'running' ? (
          <div className="flex items-center gap-3 text-amber-400">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Assessment in progress...</span>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm mb-3">No GAP assessment yet.</p>
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Run First Assessment
            </Link>
          </div>
        )}
      </div>

      {/* Overall Score + Trend */}
      {osResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-100 mb-1">
                Overall Marketing Health
              </h2>
              <p className="text-xs text-slate-400">
                Based on the latest OS diagnostics
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-slate-50">
                {osResult.overallScore.toFixed(1)}/10
              </div>
              {/* Trend Indicators */}
              {recentReports.length > 1 && overallTrend.delta !== null && (
                <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                  <span
                    className={
                      overallTrend.direction === 'up'
                        ? 'text-emerald-400'
                        : overallTrend.direction === 'down'
                          ? 'text-red-400'
                          : 'text-slate-400'
                    }
                  >
                    {overallTrend.direction === 'up'
                      ? 'Improving'
                      : overallTrend.direction === 'down'
                        ? 'Declining'
                        : 'Flat'}
                  </span>
                  <span
                    className={
                      overallTrend.direction === 'up'
                        ? 'text-emerald-400'
                        : overallTrend.direction === 'down'
                          ? 'text-red-400'
                          : 'text-slate-400'
                    }
                  >
                    {overallTrend.delta > 0 ? '+' : ''}
                    {overallTrend.delta.toFixed(1)}
                  </span>
                </div>
              )}
              {recentReports.length === 1 && (
                <div className="mt-1 text-xs text-slate-400">First OS run</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Diagnostics Fallback */}
      {!osResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <p className="text-slate-400">
            No OS diagnostics available yet. Click "Run OS Diagnostics" to get
            started.
          </p>
        </div>
      )}

      {/* Pillar Scores Grid */}
      {pillarScores.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-100">
              Pillar Scores
            </h3>
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View full diagnostics →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {pillarScores.map((pillar) => (
              <Link
                key={pillar.pillar}
                href={`/c/${companyId}/diagnostics`}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
              >
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      pillar.score! >= 7
                        ? 'text-green-400'
                        : pillar.score! >= 4
                          ? 'text-orange-400'
                          : 'text-red-400'
                    }`}
                  >
                    {pillar.score!.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {pillar.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top Priorities */}
      {topPriorities.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Top Cross-Pillar Priorities
            </h3>
            <Link
              href={`/c/${companyId}/priorities`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all priorities →
            </Link>
          </div>
          <div className="space-y-3">
            {topPriorities.map((priority: Priority) => (
              <div
                key={priority.id}
                className="border border-slate-800 rounded-lg p-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-200">
                        {priority.title}
                      </span>
                      {/* Pillar tag */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300">
                        {priority.pillar}
                      </span>
                    </div>
                    {(priority.rationale || priority.description) && (
                      <p className="text-xs text-slate-400">
                        {priority.description || priority.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    {/* Impact badge */}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        priority.impact === 'high'
                          ? 'bg-green-500/20 text-green-300'
                          : priority.impact === 'medium'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-slate-500/20 text-slate-300'
                      }`}
                    >
                      {priority.impact}
                    </span>
                    {/* Effort badge */}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        priority.effort === 'low'
                          ? 'bg-green-500/20 text-green-300'
                          : priority.effort === 'medium'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {priority.effort}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links to Deeper Views */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
        >
          <div className="text-sm font-medium text-slate-100 mb-1">
            Diagnostics
          </div>
          <div className="text-xs text-slate-400">
            Detailed issues and analysis per pillar
          </div>
        </Link>
        <Link
          href={`/c/${companyId}/priorities`}
          className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
        >
          <div className="text-sm font-medium text-slate-100 mb-1">
            Priorities
          </div>
          <div className="text-xs text-slate-400">
            All prioritized actions sorted by impact
          </div>
        </Link>
        <Link
          href={`/c/${companyId}/plan`}
          className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
        >
          <div className="text-sm font-medium text-slate-100 mb-1">
            Growth Plan
          </div>
          <div className="text-xs text-slate-400">
            Quick wins and strategic initiatives
          </div>
        </Link>
      </div>
    </div>
  );
}
