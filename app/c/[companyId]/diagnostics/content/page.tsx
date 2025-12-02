// app/c/[companyId]/diagnostics/content/page.tsx
// Content Lab Diagnostics Page
//
// Displays Content Lab results with dimension cards, quick wins, projects,
// and analytics snapshot. Uses ToolDiagnosticsPageClient for consistent UI.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';
import type { ContentLabResult } from '@/lib/diagnostics/content-lab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ContentDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('contentLab');
  if (!tool) {
    return notFound();
  }

  // Fetch all diagnostic runs for this tool (sorted by date desc)
  const allRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'contentLab',
    limit: 20,
  });
  const latestRun = allRuns.length > 0 ? allRuns[0] : null;

  // Cast rawJson to ContentLabResult
  const contentResult = latestRun?.rawJson as ContentLabResult | null;

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
      allRuns={allRuns}
    >
      {/* Content Lab-specific content */}
      {contentResult && (
        <div className="space-y-6">
          {/* Maturity, Confidence & Company Type Badges */}
          <div className="flex flex-wrap gap-3">
            {contentResult.maturityStage && (
              <MaturityBadge stage={contentResult.maturityStage} />
            )}
            {contentResult.dataConfidence && (
              <DataConfidenceBadge confidence={contentResult.dataConfidence} />
            )}
            {contentResult.companyType && (
              <CompanyTypeBadge companyType={contentResult.companyType} />
            )}
          </div>

          {/* Dimension Cards Grid */}
          {contentResult.dimensions && contentResult.dimensions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Content Dimensions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {contentResult.dimensions.map((dimension) => (
                  <DimensionCard key={dimension.key} dimension={dimension} />
                ))}
              </div>
            </div>
          )}

          {/* Topics / Findings */}
          {contentResult.findings?.topics && contentResult.findings.topics.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Identified Topics ({contentResult.findings.topics.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {contentResult.findings.topics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {contentResult.quickWins && contentResult.quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 mb-3">
                Quick Wins ({contentResult.quickWins.length})
              </h2>
              <div className="space-y-3">
                {contentResult.quickWins.map((win, idx) => (
                  <QuickWinCard key={win.id || `qw-${idx}`} quickWin={win} />
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {contentResult.projects && contentResult.projects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-3">
                Strategic Projects ({contentResult.projects.length})
              </h2>
              <div className="space-y-3">
                {contentResult.projects.map((project, idx) => (
                  <ProjectCard key={project.id || `proj-${idx}`} project={project} />
                ))}
              </div>
            </div>
          )}

          {/* Analytics Snapshot */}
          {contentResult.analyticsSnapshot && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Content Search Performance
              </h2>
              <ContentAnalyticsSnapshotCard snapshot={contentResult.analyticsSnapshot} />
            </div>
          )}

          {/* Issues List */}
          {contentResult.issues && contentResult.issues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400 mb-3">
                All Issues ({contentResult.issues.length})
              </h2>
              <div className="space-y-2">
                {contentResult.issues.map((issue, idx) => (
                  <IssueRow key={issue.id || `issue-${idx}`} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Content Inventory */}
          {contentResult.findings?.articleTitles && contentResult.findings.articleTitles.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Content Inventory ({contentResult.findings.articleTitles.length} articles)
              </h2>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 max-h-64 overflow-y-auto">
                <ul className="space-y-2">
                  {contentResult.findings.articleTitles.slice(0, 20).map((title, idx) => (
                    <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-600">•</span>
                      {title}
                    </li>
                  ))}
                  {contentResult.findings.articleTitles.length > 20 && (
                    <li className="text-xs text-slate-500 italic">
                      +{contentResult.findings.articleTitles.length - 20} more articles
                    </li>
                  )}
                </ul>
              </div>
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

function MaturityBadge({ stage }: { stage: ContentLabResult['maturityStage'] }) {
  const colors: Record<string, string> = {
    unproven: 'bg-red-500/20 text-red-300 border-red-500/30',
    emerging: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    scaling: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    established: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  const labels: Record<string, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };

  if (!stage) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${colors[stage] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Maturity:</span>
      {labels[stage] || stage}
    </span>
  );
}

function DataConfidenceBadge({ confidence }: { confidence: ContentLabResult['dataConfidence'] }) {
  const colors: Record<string, string> = {
    high: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    low: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  if (!confidence || !confidence.level) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${colors[confidence.level] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Data:</span>
      {confidence.level} ({confidence.score ?? 0}%)
    </span>
  );
}

function CompanyTypeBadge({ companyType }: { companyType: string }) {
  const labels: Record<string, string> = {
    b2b_services: 'B2B Services',
    local_service: 'Local Service',
    ecommerce: 'E-commerce',
    saas: 'SaaS',
    other: 'Other',
    unknown: 'Unknown',
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-700/50 px-3 py-1 text-xs font-medium text-slate-300">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Type:</span>
      {labels[companyType] || companyType}
    </span>
  );
}

function DimensionCard({ dimension }: { dimension: ContentLabResult['dimensions'][0] }) {
  const statusColors: Record<string, string> = {
    strong: 'border-emerald-500/30 bg-emerald-500/5',
    moderate: 'border-amber-500/30 bg-amber-500/5',
    weak: 'border-red-500/30 bg-red-500/5',
    not_evaluated: 'border-slate-600/30 bg-slate-800/30',
  };

  const scoreColors: Record<string, string> = {
    strong: 'text-emerald-400',
    moderate: 'text-amber-400',
    weak: 'text-red-400',
    not_evaluated: 'text-slate-500',
  };

  const issueCount = dimension.issues?.length ?? 0;
  const isNotEvaluated = dimension.status === 'not_evaluated' || dimension.score === null;

  return (
    <div className={`rounded-xl border p-4 ${statusColors[dimension.status] || 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-200">{dimension.label}</h3>
        <span className={`text-lg font-bold tabular-nums ${scoreColors[dimension.status] || 'text-slate-400'}`}>
          {isNotEvaluated ? '—' : dimension.score}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{dimension.summary}</p>
      {isNotEvaluated && (
        <p className="text-[10px] text-slate-500 italic">Not evaluated</p>
      )}
      {!isNotEvaluated && issueCount > 0 && (
        <p className="text-[10px] text-slate-500">
          {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function QuickWinCard({ quickWin }: { quickWin: ContentLabResult['quickWins'][0] }) {
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
          {quickWin.category && (
            <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">
              {quickWin.category}
            </span>
          )}
          <p className="text-sm text-slate-200 mt-0.5">{quickWin.action}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-medium ${impactColors[quickWin.expectedImpact] || 'text-slate-400'}`}>
            {quickWin.expectedImpact} impact
          </span>
          <span className="text-[10px] text-slate-500">{effortLabels[quickWin.effortLevel] || quickWin.effortLevel}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ContentLabResult['projects'][0] }) {
  const horizonLabels: Record<string, string> = {
    'near-term': 'Now',
    'mid-term': 'Next',
    'long-term': 'Later',
  };

  const horizonColors: Record<string, string> = {
    'near-term': 'bg-emerald-500/20 text-emerald-300',
    'mid-term': 'bg-blue-500/20 text-blue-300',
    'long-term': 'bg-slate-500/20 text-slate-300',
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
          {project.category && (
            <span className="text-[10px] uppercase tracking-wider text-blue-400/70 font-medium">
              {project.category}
            </span>
          )}
          <h4 className="text-sm font-medium text-slate-200 mt-0.5">{project.title}</h4>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {project.timeHorizon && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${horizonColors[project.timeHorizon] || 'bg-slate-500/20 text-slate-300'}`}>
              {horizonLabels[project.timeHorizon] || project.timeHorizon}
            </span>
          )}
          {project.impact && (
            <span className={`text-[10px] font-medium ${impactColors[project.impact] || 'text-slate-400'}`}>
              {project.impact} impact
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">{project.description}</p>
    </div>
  );
}

function ContentAnalyticsSnapshotCard({ snapshot }: { snapshot: NonNullable<ContentLabResult['analyticsSnapshot']> }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.impressions !== undefined && snapshot.impressions !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Impressions</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {snapshot.impressions.toLocaleString()}
            </p>
          </div>
        )}
        {snapshot.clicks !== undefined && snapshot.clicks !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Clicks</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {snapshot.clicks.toLocaleString()}
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
    </div>
  );
}

function IssueRow({ issue }: { issue: ContentLabResult['issues'][0] }) {
  const severityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-slate-400 bg-slate-500/10',
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColors[issue.severity] || 'text-slate-400 bg-slate-500/10'}`}>
        {issue.severity || 'unknown'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200">{issue.title || 'Issue'}</p>
        <p className="text-xs text-slate-400 mt-0.5">{issue.description || ''}</p>
      </div>
    </div>
  );
}
