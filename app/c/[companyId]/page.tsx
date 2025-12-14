// app/c/[companyId]/page.tsx
// Company Overview Page - Strategic Dashboard
//
// This is the main landing page when viewing a company in Hive OS.
// It surfaces the company's Strategic Snapshot (scores, focus areas, 90-day plan),
// active work, score trends, alerts, and recent diagnostic activity.
//
// STATUS VIEW: Shows "Where we are", "What's working", "What's not" at the top
// MEDIA PROGRAM: Shows Media Lab summary (derived from plans) + operational media status
// DMA PIPELINE: Shows DMA banner + Full Workup checklist when coming from Pipeline

import { promises as fs } from 'fs';
import path from 'path';
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
import { getCompanyPerformancePulse } from '@/lib/os/analytics/companyPerformancePulse';
import { getBaselineStatus } from '@/lib/contextGraph/baseline';
import { getMediaLabSummary } from '@/lib/mediaLab';
import { loadQBRData, getQBRSummary, calculateOverallHealthScore } from '@/lib/os/reports/qbrData';
import { getInboundLeadById } from '@/lib/airtable/inboundLeads';
import { getCompanyStatusSummary } from '@/lib/os/companies/companyStatus';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import { generateCompanyStatusNarrative } from '@/lib/os/contextAi/generateCompanyStatusNarrative';
import { getDiagnosticFindingsForCompany } from '@/lib/airtable/diagnosticDetails';
import { CompanyOverviewPage, type CompanyOverviewPageProps } from '@/components/os/CompanyOverviewPage';
import { DmaFullGapBanner } from '@/components/os/DmaFullGapBanner';
import { FullWorkupChecklist } from '@/components/os/FullWorkupChecklist';
import { StatusSummaryPanel } from '@/components/os/StatusSummaryPanel';
import type { PrimaryIntent } from '@/components/os/IntentSelector';

// ============================================================================
// Intent Helper
// ============================================================================

const DATA_DIR = process.env.CONTEXT_GRAPH_DATA_DIR || './data/context-graphs';

async function loadCompanyIntent(companyId: string): Promise<PrimaryIntent | null> {
  try {
    const filePath = path.join(DATA_DIR, companyId, 'intent.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.intent || null;
  } catch {
    return null;
  }
}

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
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ from?: string; leadId?: string; gapRunId?: string }>;
}) {
  const { companyId } = await params;
  const { from, leadId, gapRunId } = await searchParams;

  // Check if coming from pipeline with a lead ID
  const isFromPipeline = from === 'pipeline' && !!leadId;

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
    qbrData,
    pipelineLead,
    statusSummary,
    analyticsSnapshot,
    topFindings,
    rawAnalyticsFindings,
    primaryIntent,
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
    getCompanyPerformancePulse(companyId).catch(() => null),
    getMediaLabSummary(companyId).catch(() => null),
    getBaselineStatus(companyId).catch(() => null),
    loadQBRData(companyId).catch(() => null),
    // Fetch pipeline lead if coming from pipeline
    isFromPipeline && leadId ? getInboundLeadById(leadId).catch(() => null) : Promise.resolve(null),
    // Status View data
    getCompanyStatusSummary({ companyId, leadId }).catch(() => null),
    getCompanyAnalyticsSnapshot({ companyId }).catch(() => null),
    // Fetch top findings for AI context (high severity only)
    getCompanyFindings(companyId, { severities: ['high', 'critical'] }).catch(() => []),
    // Fetch analytics-specific findings for Status Panel
    getDiagnosticFindingsForCompany(companyId, { labSlug: 'analytics' }).catch(() => []),
    // Fetch company intent (for decision entry point)
    loadCompanyIntent(companyId),
  ]);

  // Filter analytics findings for high/medium severity (top 3 for Status Panel)
  const analyticsFindings = (rawAnalyticsFindings || [])
    .filter((f) => f.severity === 'high' || f.severity === 'medium')
    .slice(0, 3);

  // Compute QBR summary if data is available
  const qbrSummary = qbrData ? {
    ...getQBRSummary(qbrData),
    overallHealthScore: calculateOverallHealthScore(qbrData),
  } : null;

  // Generate AI narrative for Status View (if we have status and analytics data)
  const narrative = statusSummary && analyticsSnapshot
    ? await generateCompanyStatusNarrative({
        companyId,
        companyName: company?.name,
        status: statusSummary,
        analytics: analyticsSnapshot,
        existingFindings: topFindings?.slice(0, 10).map((f) => ({
          title: f.description || '',
          severity: f.severity || 'medium',
          labSlug: f.labSlug,
        })),
      }).catch((error) => {
        console.error('[CompanyOverview] Failed to generate narrative:', error);
        return null;
      })
    : null;

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

  // Determine if we should show DMA pipeline context
  const showDmaPipelineContext = isFromPipeline && pipelineLead && pipelineLead.leadSource === 'DMA Full GAP';

  return (
    <div className="space-y-4">
      {/* Status Summary Panel - always shown at top */}
      {statusSummary && analyticsSnapshot && (
        <StatusSummaryPanel
          status={statusSummary}
          analytics={analyticsSnapshot}
          companyName={company.name}
          narrative={narrative ?? undefined}
          analyticsFindings={analyticsFindings.length > 0 ? analyticsFindings : undefined}
        />
      )}

      {/* DMA Full GAP Banner - shown when coming from pipeline */}
      {showDmaPipelineContext && pipelineLead && (
        <DmaFullGapBanner
          lead={pipelineLead}
          gapRunId={gapRunId}
          companyId={companyId}
        />
      )}

      {/* Full Workup Checklist - shown when coming from pipeline */}
      {showDmaPipelineContext && pipelineLead && (
        <FullWorkupChecklist
          leadId={pipelineLead.id}
          companyId={companyId}
          initialValues={{
            qbrReviewed: pipelineLead.qbrReviewed ?? false,
            mediaLabReviewed: pipelineLead.mediaLabReviewed ?? false,
            seoLabReviewed: pipelineLead.seoLabReviewed ?? false,
            competitionLabReviewed: pipelineLead.competitionLabReviewed ?? false,
            workPlanDrafted: pipelineLead.workPlanDrafted ?? false,
          }}
        />
      )}

      {/* Main Company Overview */}
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
        qbrSummary={qbrSummary}
        primaryIntent={primaryIntent}
      />
    </div>
  );
}
