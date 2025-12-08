// app/c/[companyId]/page.tsx
// Company Overview Page - Strategic Dashboard
//
// This is the main landing page when viewing a company in Hive OS.
// It surfaces the company's Strategic Snapshot (scores, focus areas, 90-day plan),
// active work, score trends, alerts, and recent diagnostic activity.
//
// MEDIA PROGRAM: Shows Media Lab summary (derived from plans) + operational media status

import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import { getCompanyWorkSummary } from '@/lib/os/companies/workSummary';
import { getCompanyAlerts } from '@/lib/os/companies/alerts';
import {
  getRecentRunsForCompany,
  getCompanyScoreTrends,
  getToolLabel,
  type DiagnosticRun,
} from '@/lib/os/diagnostics/runs';
import { getPerformancePulse } from '@/lib/os/analytics/performancePulse';
import { getBaselineStatus } from '@/lib/contextGraph/baseline';
import { getMediaLabSummary } from '@/lib/mediaLab';
import { CompanyOverviewPage } from '@/components/os/CompanyOverviewPage';

// ============================================================================
// Tool Slug Mapping (for report paths)
// ============================================================================

const toolIdToSlug: Record<string, string> = {
  gapSnapshot: 'gap-ia',
  gapPlan: 'gap-plan',
  gapHeavy: 'gap-heavy',
  websiteLab: 'website-lab',
  brandLab: 'brand-lab',
  contentLab: 'content-lab',
  seoLab: 'seo-lab',
  demandLab: 'demand-lab',
  opsLab: 'ops-lab',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function OsOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  // Fetch all data in parallel
  const [
    company,
    strategySnapshot,
    recentRuns,
    workSummary,
    scoreTrends,
    alerts,
    performancePulse,
    mediaLabSummary,
    baselineStatus,
  ] = await Promise.all([
    getCompanyById(companyId),
    getCompanyStrategySnapshot(companyId).catch(() => null),
    getRecentRunsForCompany(companyId, 5).catch(() => []),
    getCompanyWorkSummary(companyId).catch(() => ({
      active: [],
      doneRecently: [],
      counts: { active: 0, inProgress: 0, doneRecently: 0 },
    })),
    getCompanyScoreTrends(companyId).catch(() => ({
      overall: [],
      website: [],
      seo: [],
      brand: [],
    })),
    getCompanyAlerts(companyId).catch(() => []),
    getPerformancePulse().catch(() => null),
    getMediaLabSummary(companyId).catch(() => null),
    getBaselineStatus(companyId).catch(() => null),
  ]);

  if (!company) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <p className="text-slate-400">Company not found.</p>
      </div>
    );
  }

  // Transform recent runs into the format expected by CompanyOverviewPage
  const recentDiagnostics = recentRuns.map((run: DiagnosticRun) => {
    const slug = toolIdToSlug[run.toolId] || run.toolId;
    return {
      id: run.id,
      toolId: run.toolId,
      toolLabel: getToolLabel(run.toolId),
      status: run.status,
      score: run.score,
      completedAt: run.status === 'complete' ? run.updatedAt : null,
      reportPath:
        run.status === 'complete'
          ? `/c/${companyId}/diagnostics/${slug}/${run.id}`
          : null,
    };
  });

  // Check if company has an active media program
  const hasMediaProgram = companyHasMediaProgram(company);

  return (
    <CompanyOverviewPage
      company={{
        id: company.id,
        name: company.name,
        website: company.website,
        industry: company.industry,
        stage: company.stage,
        companyType: company.companyType,
        sizeBand: company.sizeBand,
        owner: company.owner,
        hasMediaProgram,
      }}
      strategySnapshot={strategySnapshot}
      recentDiagnostics={recentDiagnostics}
      workSummary={workSummary}
      scoreTrends={scoreTrends}
      alerts={alerts}
      performancePulse={performancePulse}
      mediaLabSummary={mediaLabSummary}
      baselineStatus={baselineStatus}
    />
  );
}
