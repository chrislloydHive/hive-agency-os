// app/c/[companyId]/diagnostics/ops/page.tsx
// Ops Lab Diagnostics Page
//
// Displays Ops Lab V1 results with dimension cards, quick wins, projects,
// analytics snapshot, and ops stack signals. Uses ToolDiagnosticsPageClient for consistent UI.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';
import type { OpsLabResult } from '@/lib/diagnostics/ops-lab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function OpsDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('opsLab');
  if (!tool) {
    return notFound();
  }

  // Fetch all diagnostic runs for this tool (sorted by date desc)
  const allRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'opsLab',
    limit: 20,
  });
  const latestRun = allRuns.length > 0 ? allRuns[0] : null;

  // Cast rawJson to OpsLabResult
  const opsResult = latestRun?.rawJson as OpsLabResult | null;

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
      allRuns={allRuns}
      dataConfidence={opsResult?.dataConfidence}
      maturityStage={opsResult?.maturityStage}
    >
      {/* Ops Lab-specific content */}
      {opsResult && (
        <div className="space-y-6">
          {/* Company Type Badge (maturity & confidence now in hero) */}
          {opsResult.companyType && (
            <div className="flex flex-wrap gap-3">
              <CompanyTypeBadge companyType={opsResult.companyType} />
            </div>
          )}

          {/* Dimension Cards Grid */}
          {opsResult.dimensions && opsResult.dimensions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Ops Dimensions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {opsResult.dimensions.map((dimension) => (
                  <DimensionCard key={dimension.key} dimension={dimension} />
                ))}
              </div>
            </div>
          )}

          {/* Stack & Signals */}
          {opsResult.analyticsSnapshot && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Stack & Signals
              </h2>
              <OpsStackCard snapshot={opsResult.analyticsSnapshot} />
            </div>
          )}

          {/* Quick Wins */}
          {opsResult.quickWins && opsResult.quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 mb-3">
                Quick Wins ({opsResult.quickWins.length})
              </h2>
              <div className="space-y-3">
                {opsResult.quickWins.map((win, idx) => (
                  <QuickWinCard key={win.id || `qw-${idx}`} quickWin={win} />
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {opsResult.projects && opsResult.projects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-3">
                Strategic Projects ({opsResult.projects.length})
              </h2>
              <div className="space-y-3">
                {opsResult.projects.map((project, idx) => (
                  <ProjectCard key={project.id || `proj-${idx}`} project={project} />
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {opsResult.findings && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Key Findings
              </h2>
              <FindingsCard findings={opsResult.findings} />
            </div>
          )}

          {/* Issues List */}
          {opsResult.issues && opsResult.issues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400 mb-3">
                All Issues ({opsResult.issues.length})
              </h2>
              <div className="space-y-2">
                {opsResult.issues.map((issue, idx) => (
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

function DimensionCard({ dimension }: { dimension: OpsLabResult['dimensions'][0] }) {
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
      {/* Show evidence if available */}
      {dimension.evidence && (
        <div className="mt-2 space-y-1">
          {dimension.evidence.found?.slice(0, 2).map((item, i) => (
            <p key={i} className="text-[10px] text-emerald-400/70">+ {item}</p>
          ))}
          {dimension.evidence.missing?.slice(0, 2).map((item, i) => (
            <p key={i} className="text-[10px] text-red-400/70">- {item}</p>
          ))}
        </div>
      )}
      {issueCount > 0 && (
        <p className="text-[10px] text-slate-500 mt-2">
          {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function OpsStackCard({ snapshot }: { snapshot: NonNullable<OpsLabResult['analyticsSnapshot']> }) {
  const { trackingStack, hasGa4, hasGtm, hasFacebookPixel, hasLinkedinInsight, hasCrm, hasAutomationPlatform, utmUsageLevel } = snapshot;

  // Count detected vs total for summary
  const coreSignals = [
    { label: 'Google Analytics 4', active: hasGa4, description: 'Web analytics & conversion tracking' },
    { label: 'Google Search Console', active: snapshot.hasGsc, description: 'Search performance & indexing' },
    { label: 'Google Tag Manager', active: hasGtm, description: 'Tag deployment & governance' },
    { label: 'Facebook Pixel', active: hasFacebookPixel, description: 'Meta retargeting & attribution' },
    { label: 'LinkedIn Insight', active: hasLinkedinInsight, description: 'B2B retargeting & attribution' },
    { label: 'CRM Integration', active: hasCrm, description: 'Lead capture & pipeline tracking' },
    { label: 'Marketing Automation', active: hasAutomationPlatform, description: 'Email & journey automation' },
  ];

  const detectedCount = coreSignals.filter(s => s.active).length;
  const totalCount = coreSignals.length;

  const utmDescriptions: Record<string, { label: string; description: string; color: string }> = {
    none: { label: 'Not Detected', description: 'No UTM parameters found in links. Campaign attribution will be limited.', color: 'text-red-400' },
    basic: { label: 'Partial', description: 'Some UTM parameters detected but usage is inconsistent across campaigns.', color: 'text-amber-400' },
    consistent: { label: 'Consistent', description: 'UTM parameters are consistently used across campaigns for proper attribution.', color: 'text-emerald-400' },
  };

  const utmInfo = utmDescriptions[utmUsageLevel || 'none'];

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
      {/* Summary Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
        <div>
          <p className="text-sm font-medium text-slate-200">Marketing Stack Coverage</p>
          <p className="text-xs text-slate-500 mt-0.5">Core infrastructure signals detected on website</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold tabular-nums ${detectedCount === 0 ? 'text-red-400' : detectedCount < 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {detectedCount}/{totalCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Detected</p>
        </div>
      </div>

      {/* Detected Tools (if any) */}
      {trackingStack && trackingStack.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Active Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {trackingStack.map((tool, i) => (
              <span
                key={i}
                className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Signal Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coreSignals.map((signal, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 ${signal.active ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-slate-800/50 border border-slate-700/50'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${signal.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className={`text-xs font-medium ${signal.active ? 'text-emerald-300' : 'text-slate-400'}`}>
                {signal.label}
              </span>
            </div>
            <p className={`text-[10px] ml-4 ${signal.active ? 'text-emerald-400/60' : 'text-slate-600'}`}>
              {signal.description}
            </p>
          </div>
        ))}
      </div>

      {/* UTM Section */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${utmUsageLevel === 'consistent' ? 'bg-emerald-500/10' : utmUsageLevel === 'basic' ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
            <svg className={`w-4 h-4 ${utmInfo.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-200">UTM Parameter Usage</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${utmUsageLevel === 'consistent' ? 'bg-emerald-500/20 text-emerald-300' : utmUsageLevel === 'basic' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                {utmInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{utmInfo.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FindingsCard({ findings }: { findings: OpsLabResult['findings'] }) {
  // Group findings by category with icons and colors
  const categories = [
    {
      key: 'tracking',
      label: 'Tracking & Analytics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      tools: findings.trackingDetected?.tools || [],
      notes: findings.trackingDetected?.notes || [],
    },
    {
      key: 'crm',
      label: 'CRM & Pipeline',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      tools: findings.crmSignals?.tools || [],
      notes: findings.crmSignals?.notes || [],
    },
    {
      key: 'automation',
      label: 'Automation & Journeys',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      tools: findings.automationSignals?.tools || [],
      notes: findings.automationSignals?.notes || [],
    },
    {
      key: 'process',
      label: 'Data & Process',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      tools: [],
      notes: findings.processSignals?.notes || [],
    },
  ];

  // Filter to only show categories with content
  const activeCategories = categories.filter(cat => cat.tools.length > 0 || cat.notes.length > 0);

  if (activeCategories.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeCategories.map((category) => (
        <div
          key={category.key}
          className={`rounded-lg border ${category.borderColor} ${category.bgColor} p-4`}
        >
          {/* Category Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className={category.color}>{category.icon}</span>
            <h4 className={`text-sm font-medium ${category.color}`}>{category.label}</h4>
          </div>

          {/* Detected Tools */}
          {category.tools.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Detected</p>
              <div className="flex flex-wrap gap-1.5">
                {category.tools.map((tool, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-slate-800/50 border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {category.notes.length > 0 && (
            <div className="space-y-1.5">
              {category.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5 text-xs">•</span>
                  <p className="text-xs text-slate-300">{note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Empty state hint */}
          {category.tools.length === 0 && category.notes.length === 0 && (
            <p className="text-xs text-slate-500 italic">No signals detected in this category.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickWinCard({ quickWin }: { quickWin: OpsLabResult['quickWins'][0] }) {
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

function ProjectCard({ project }: { project: OpsLabResult['projects'][0] }) {
  const horizonLabels: Record<string, string> = {
    'near-term': 'Now',
    'mid-term': 'Next',
    'long-term': 'Later',
  };

  const horizonColors: Record<string, string> = {
    'near-term': 'bg-emerald-500/20 text-emerald-300',
    'mid-term': 'bg-cyan-500/20 text-cyan-300',
    'long-term': 'bg-slate-500/20 text-slate-300',
  };

  const impactColors: Record<string, string> = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  };

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {project.category && (
            <span className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-medium">
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

function IssueRow({ issue }: { issue: OpsLabResult['issues'][0] }) {
  const severityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-slate-400 bg-slate-500/10',
  };

  const categoryLabels: Record<string, string> = {
    tracking: 'Tracking',
    data: 'Data',
    crm: 'CRM',
    automation: 'Automation',
    experimentation: 'Experimentation',
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColors[issue.severity] || 'text-slate-400 bg-slate-500/10'}`}>
        {issue.severity || 'unknown'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-200">{issue.title || 'Issue'}</p>
          {issue.category && (
            <span className="text-[10px] text-slate-500">
              ({categoryLabels[issue.category] || issue.category})
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{issue.description || ''}</p>
      </div>
    </div>
  );
}
