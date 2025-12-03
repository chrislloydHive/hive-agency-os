// app/c/[companyId]/diagnostics/demand/page.tsx
// Demand Lab Diagnostics Page
//
// Displays Demand Lab results with dimension cards, quick wins, projects,
// and analytics snapshot. Uses ToolDiagnosticsPageClient for consistent UI.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';
import type { DemandLabResult } from '@/lib/diagnostics/demand-lab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function DemandDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('demandLab');
  if (!tool) {
    return notFound();
  }

  // Fetch all diagnostic runs for this tool (sorted by date desc)
  const allRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'demandLab',
    limit: 20,
  });
  const latestRun = allRuns.length > 0 ? allRuns[0] : null;

  // Cast rawJson to DemandLabResult
  const demandResult = latestRun?.rawJson as DemandLabResult | null;

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
      allRuns={allRuns}
      dataConfidence={demandResult?.dataConfidence}
      maturityStage={demandResult?.maturityStage}
    >
      {/* Demand Lab-specific content */}
      {demandResult && (
        <div className="space-y-6">
          {/* Company Type Badge (maturity & confidence now in hero) */}
          {demandResult.companyType && (
            <div className="flex flex-wrap gap-3">
              <CompanyTypeBadge companyType={demandResult.companyType} />
            </div>
          )}

          {/* Dimension Cards Grid */}
          {demandResult.dimensions && demandResult.dimensions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Demand Dimensions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demandResult.dimensions.map((dimension) => (
                  <DimensionCard key={dimension.key} dimension={dimension} />
                ))}
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {demandResult.quickWins && demandResult.quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 mb-3">
                Quick Wins ({demandResult.quickWins.length})
              </h2>
              <div className="space-y-3">
                {demandResult.quickWins.map((win, idx) => (
                  <QuickWinCard key={win.id || `qw-${idx}`} quickWin={win} />
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {demandResult.projects && demandResult.projects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-3">
                Strategic Projects ({demandResult.projects.length})
              </h2>
              <div className="space-y-3">
                {demandResult.projects.map((project, idx) => (
                  <ProjectCard key={project.id || `proj-${idx}`} project={project} />
                ))}
              </div>
            </div>
          )}

          {/* Analytics Snapshot */}
          {demandResult.analyticsSnapshot && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Analytics Snapshot
              </h2>
              <AnalyticsSnapshotCard snapshot={demandResult.analyticsSnapshot} />
            </div>
          )}

          {/* Issues List */}
          {demandResult.issues && demandResult.issues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400 mb-3">
                All Issues ({demandResult.issues.length})
              </h2>
              <div className="space-y-2">
                {demandResult.issues.map((issue, idx) => (
                  <IssueRow key={issue.id || `issue-${idx}`} issue={issue} />
                ))}
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

function DimensionCard({ dimension }: { dimension: DemandLabResult['dimensions'][0] }) {
  const statusColors: Record<string, string> = {
    strong: 'border-emerald-500/30 bg-emerald-500/5',
    moderate: 'border-amber-500/30 bg-amber-500/5',
    weak: 'border-red-500/30 bg-red-500/5',
  };

  const scoreColors: Record<string, string> = {
    strong: 'text-emerald-400',
    moderate: 'text-amber-400',
    weak: 'text-red-400',
  };

  const issueCount = dimension.issues?.length ?? 0;

  return (
    <div className={`rounded-xl border p-4 ${statusColors[dimension.status] || 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-200">{dimension.label}</h3>
        <span className={`text-lg font-bold tabular-nums ${scoreColors[dimension.status] || 'text-slate-400'}`}>
          {dimension.score}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{dimension.summary}</p>
      {issueCount > 0 && (
        <p className="text-[10px] text-slate-500">
          {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function QuickWinCard({ quickWin }: { quickWin: DemandLabResult['quickWins'][0] }) {
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

function ProjectCard({ project }: { project: DemandLabResult['projects'][0] }) {
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

function AnalyticsSnapshotCard({ snapshot }: { snapshot: NonNullable<DemandLabResult['analyticsSnapshot']> }) {
  // V2 uses sessionVolume/paidShare, V1 used totalSessions/paidTrafficShare
  // Support both for backwards compatibility
  const sessions = snapshot.sessionVolume ?? snapshot.totalSessions;
  const paidShare = snapshot.paidShare ?? snapshot.paidTrafficShare;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sessions !== undefined && sessions !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sessions</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {sessions.toLocaleString()}
            </p>
          </div>
        )}
        {snapshot.conversionRate !== null && snapshot.conversionRate !== undefined && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Conversion Rate</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {(snapshot.conversionRate * 100).toFixed(1)}%
            </p>
          </div>
        )}
        {paidShare !== null && paidShare !== undefined && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Paid Traffic</p>
            <p className="text-lg font-semibold text-slate-200 tabular-nums">
              {(paidShare * 100).toFixed(1)}%
            </p>
          </div>
        )}
        {snapshot.topChannels && snapshot.topChannels.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Top Channels</p>
            <p className="text-sm text-slate-300">
              {snapshot.topChannels.slice(0, 3).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: DemandLabResult['issues'][0] }) {
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
