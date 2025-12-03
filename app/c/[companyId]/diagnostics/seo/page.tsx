// app/c/[companyId]/diagnostics/seo/page.tsx
// SEO Diagnostics Page
//
// Uses the generic ToolDiagnosticsPageClient for consistent UI and AI insights.
// Displays SEO-specific content: dimension scores, issues, quick wins, projects.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';
import type { SeoLabReport } from '@/lib/os/diagnostics/seoLabTypes';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SeoDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('seoLab');
  if (!tool) {
    return notFound();
  }

  // Fetch all diagnostic runs for this tool (sorted by date desc)
  const allRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'seoLab',
    limit: 20,
  });
  const latestRun = allRuns.length > 0 ? allRuns[0] : null;

  // Cast rawJson to SeoLabReport
  const seoResult = latestRun?.rawJson as SeoLabReport | null;

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
      allRuns={allRuns}
      dataConfidence={seoResult?.dataConfidence}
      maturityStage={seoResult?.maturityStage}
    >
      {/* SEO Lab-specific content */}
      {seoResult && (
        <div className="space-y-6">
          {/* Split Scores */}
          {(seoResult.onSiteScore !== undefined || seoResult.searchPerformanceScore !== undefined) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {seoResult.onSiteScore !== undefined && (
                <ScoreCard
                  label="On-Site SEO"
                  score={seoResult.onSiteScore}
                  description="Technical SEO, content, and on-page optimization"
                />
              )}
              {seoResult.searchPerformanceScore !== null && seoResult.searchPerformanceScore !== undefined ? (
                <ScoreCard
                  label="Search Performance"
                  score={seoResult.searchPerformanceScore}
                  description="Actual traffic, rankings, and search visibility"
                />
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Search Performance</p>
                  <p className="text-xl font-bold text-slate-500">—</p>
                  <p className="text-xs text-slate-500 mt-1">Insufficient data to evaluate</p>
                </div>
              )}
            </div>
          )}

          {/* Subscores Grid */}
          {seoResult.subscores && seoResult.subscores.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                SEO Dimensions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {seoResult.subscores.map((subscore, idx) => (
                  <SubscoreCard key={idx} subscore={subscore} />
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Gaps */}
          {((seoResult.topStrengths && seoResult.topStrengths.length > 0) ||
            (seoResult.topGaps && seoResult.topGaps.length > 0)) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {seoResult.topStrengths && seoResult.topStrengths.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <h3 className="text-xs uppercase tracking-wide text-emerald-400 font-semibold mb-2">
                    Top Strengths
                  </h3>
                  <ul className="space-y-2">
                    {seoResult.topStrengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {seoResult.topGaps && seoResult.topGaps.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <h3 className="text-xs uppercase tracking-wide text-red-400 font-semibold mb-2">
                    Top Gaps
                  </h3>
                  <ul className="space-y-2">
                    {seoResult.topGaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-red-400 mt-0.5">!</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Quick Wins */}
          {seoResult.quickWins && seoResult.quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 mb-3">
                Quick Wins ({seoResult.quickWins.length})
              </h2>
              <div className="space-y-3">
                {seoResult.quickWins.map((win, idx) => (
                  <QuickWinCard key={idx} quickWin={win} />
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {seoResult.projects && seoResult.projects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-3">
                Strategic Projects ({seoResult.projects.length})
              </h2>
              <div className="space-y-3">
                {seoResult.projects.map((project, idx) => (
                  <ProjectCard key={idx} project={project} />
                ))}
              </div>
            </div>
          )}

          {/* Analytics Snapshot */}
          {seoResult.analyticsSnapshot && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Search Console Snapshot
              </h2>
              <AnalyticsSnapshotCard snapshot={seoResult.analyticsSnapshot} />
            </div>
          )}

          {/* Issues by Severity */}
          {seoResult.issues && seoResult.issues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400 mb-3">
                All Issues ({seoResult.issues.length})
              </h2>
              <IssuesList issues={seoResult.issues} />
            </div>
          )}
        </div>
      )}
    </ToolDiagnosticsPageClient>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function ScoreCard({ label, score, description }: { label: string; score: number; description: string }) {
  const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const borderColor = score >= 70 ? 'border-emerald-500/30' : score >= 50 ? 'border-amber-500/30' : 'border-red-500/30';
  const bgColor = score >= 70 ? 'bg-emerald-500/5' : score >= 50 ? 'bg-amber-500/5' : 'bg-red-500/5';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
  );
}

function SubscoreCard({ subscore }: { subscore: SeoLabReport['subscores'][0] }) {
  const statusColors: Record<string, string> = {
    strong: 'border-emerald-500/30 bg-emerald-500/5',
    ok: 'border-cyan-500/30 bg-cyan-500/5',
    weak: 'border-amber-500/30 bg-amber-500/5',
    critical: 'border-red-500/30 bg-red-500/5',
    not_evaluated: 'border-slate-700 bg-slate-800/50',
  };

  const scoreColors: Record<string, string> = {
    strong: 'text-emerald-400',
    ok: 'text-cyan-400',
    weak: 'text-amber-400',
    critical: 'text-red-400',
    not_evaluated: 'text-slate-500',
  };

  return (
    <div className={`rounded-xl border p-4 ${statusColors[subscore.status] || statusColors.not_evaluated}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-200">{subscore.label}</h3>
        <span className={`text-lg font-bold tabular-nums ${scoreColors[subscore.status] || scoreColors.not_evaluated}`}>
          {subscore.score !== null ? subscore.score : '—'}
        </span>
      </div>
      <p className="text-xs text-slate-400">{subscore.summary}</p>
    </div>
  );
}

function QuickWinCard({ quickWin }: { quickWin: SeoLabReport['quickWins'][0] }) {
  const impactColors: Record<string, string> = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  };

  const effortLabels: Record<string, string> = {
    low: 'Quick',
    medium: 'Moderate',
    high: 'Significant',
  };

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-200">{quickWin.title}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{quickWin.description}</p>
          {quickWin.reason && (
            <p className="text-[10px] text-amber-400/70 mt-1 italic">{quickWin.reason}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-medium ${impactColors[quickWin.impact] || 'text-slate-400'}`}>
            {quickWin.impact} impact
          </span>
          <span className="text-[10px] text-slate-500">{effortLabels[quickWin.effort] || quickWin.effort}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: SeoLabReport['projects'][0] }) {
  const horizonLabels: Record<string, string> = {
    now: 'Now',
    next: 'Next',
    later: 'Later',
  };

  const horizonColors: Record<string, string> = {
    now: 'bg-emerald-500/20 text-emerald-300',
    next: 'bg-blue-500/20 text-blue-300',
    later: 'bg-slate-500/20 text-slate-300',
  };

  const impactColors: Record<string, string> = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  };

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {project.theme && (
            <span className="text-[10px] uppercase tracking-wider text-blue-400/70 font-medium">
              {project.theme}
            </span>
          )}
          <h4 className="text-sm font-medium text-slate-200 mt-0.5">{project.title}</h4>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {project.timeHorizon && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${horizonColors[project.timeHorizon] || horizonColors.later}`}>
              {horizonLabels[project.timeHorizon] || project.timeHorizon}
            </span>
          )}
          {project.issueCount > 0 && (
            <span className="text-[10px] text-slate-500">{project.issueCount} issues</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">{project.description}</p>
      <p className={`text-[10px] mt-2 ${impactColors[project.impact] || 'text-slate-400'}`}>
        {project.impact} impact
      </p>
    </div>
  );
}

function AnalyticsSnapshotCard({ snapshot }: { snapshot: SeoLabReport['analyticsSnapshot'] }) {
  if (!snapshot) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
      {/* Period Label */}
      {snapshot.periodLabel && (
        <p className="text-xs text-slate-500">{snapshot.periodLabel}</p>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.clicks !== undefined && snapshot.clicks !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Clicks</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {snapshot.clicks.toLocaleString()}
            </p>
          </div>
        )}
        {snapshot.impressions !== undefined && snapshot.impressions !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Impressions</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {snapshot.impressions.toLocaleString()}
            </p>
          </div>
        )}
        {snapshot.ctr !== undefined && snapshot.ctr !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">CTR</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {(snapshot.ctr * 100).toFixed(2)}%
            </p>
          </div>
        )}
        {snapshot.avgPosition !== undefined && snapshot.avgPosition !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Avg Position</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {snapshot.avgPosition.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {/* Top Queries */}
      {snapshot.topQueries && snapshot.topQueries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Top Queries</p>
          <div className="space-y-1">
            {snapshot.topQueries.slice(0, 5).map((q, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-300 truncate max-w-[60%]">{q.query}</span>
                <span className="text-slate-400 tabular-nums">{q.clicks} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssuesList({ issues }: { issues: SeoLabReport['issues'] }) {
  // Group by severity
  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');
  const medium = issues.filter(i => i.severity === 'medium');
  const low = issues.filter(i => i.severity === 'low');

  const groups = [
    { label: 'Critical', items: critical, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    { label: 'High', items: high, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    { label: 'Medium', items: medium, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Low', items: low, color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
  ].filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className={`text-xs font-semibold ${group.color} mb-2`}>
            {group.label} ({group.items.length})
          </h3>
          <div className="space-y-2">
            {group.items.slice(0, 5).map((issue) => (
              <div key={issue.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${group.color} ${group.bgColor}`}>
                  {issue.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{issue.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{issue.description}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {issue.recommendedAction}
                  </p>
                </div>
              </div>
            ))}
            {group.items.length > 5 && (
              <p className="text-xs text-slate-600 text-center">
                +{group.items.length - 5} more {group.label.toLowerCase()} issues
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
