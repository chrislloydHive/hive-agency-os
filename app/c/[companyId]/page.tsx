// app/c/[companyId]/page.tsx
// Company Overview Page V4 - Engagement-Driven Entry Point
//
// This is the main landing page when viewing a company in Hive OS.
// Uses resolveOverviewState for explicit state handling - NO SILENT FALLBACKS.
//
// V4 ARCHITECTURE (Default):
// 1. Engagement Type Selector (Strategy vs Project path)
// 2. Project Type Selector (if project path)
// 3. Labs Selection (inline, Full GAP required)
// 4. Context Gathering Progress
// 5. Route to target after context approval
//
// Views available:
// - Default (V4): Engagement flow - CompanyOverviewV4.tsx
// - ?view=v3: Business Need flow - CompanyOverviewV3.tsx
// - ?view=v2: Classic dashboard - CompanyOverviewPage.tsx
// - ?view=legacy: Legacy mode (deprecated)
//
// Rendering modes: ready | empty | stale | error | legacy (explicit opt-in only)

import { resolveOverviewState, type OverviewViewModel } from '@/lib/os/overview/resolveOverviewState';
import { getInboundLeadById } from '@/lib/airtable/inboundLeads';
import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import { generateCompanyStatusNarrative } from '@/lib/os/contextAi/generateCompanyStatusNarrative';
import { getDiagnosticFindingsForCompany } from '@/lib/airtable/diagnosticDetails';
import { computeStatusHeader } from '@/lib/os/companies/companyStatus';
import { getProjectsForCompany } from '@/lib/os/projects';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { isStrategyReady } from '@/lib/contextGraph/readiness/strategyReady';
import { CompanyOverviewV3 } from '@/components/os/overview/CompanyOverviewV3';
import { CompanyOverviewV4 } from '@/components/os/overview/CompanyOverviewV4';
import { CompanyOverviewPage } from '@/components/os/CompanyOverviewPage';
import { DmaFullGapBanner } from '@/components/os/DmaFullGapBanner';
import { FullWorkupChecklist } from '@/components/os/FullWorkupChecklist';
import { StatusSummaryPanel } from '@/components/os/StatusSummaryPanel';
import { AlertCircle, FileQuestion, Clock, RefreshCw, Wrench, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Page Component
// ============================================================================

export default async function OsOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    from?: string;
    leadId?: string;
    gapRunId?: string;
    view?: string;  // 'v4' for engagement flow, 'legacy' for explicit legacy opt-in, 'v2' for old dashboard
  }>;
}) {
  const { companyId } = await params;
  const { from, leadId, gapRunId, view } = await searchParams;

  // V4 is the default, use ?view=v3 for business need flow, ?view=v2 for old dashboard, ?view=legacy for legacy mode
  const useV4 = view !== 'v3' && view !== 'v2' && view !== 'legacy';
  const useV3 = view === 'v3';
  const forceLegacy = view === 'legacy';

  // Check if coming from pipeline with a lead ID
  const isFromPipeline = from === 'pipeline' && !!leadId;

  // Resolve overview state - NO SILENT FALLBACKS
  const state = await resolveOverviewState({
    companyId,
    forceLegacy,
    leadId,
  });

  // ========================================================================
  // Render by State (Explicit Handling)
  // ========================================================================

  // ERROR STATE - Show error card with details toggle
  if (state.mode === 'error') {
    return (
      <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-300 mb-2">
              Failed to Load Overview
            </h2>
            <p className="text-red-200/80 mb-4">{state.message}</p>
            <div className="flex gap-3">
              <Link
                href={`/c/${companyId}`}
                className="px-4 py-2 bg-red-800/50 hover:bg-red-700/50 text-red-200 rounded-lg text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Retry
              </Link>
              <Link
                href={`/c/${companyId}?view=legacy`}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                <Wrench className="w-4 h-4 inline mr-2" />
                Try Legacy View
              </Link>
            </div>
            {state.details && process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-red-400/60 text-sm cursor-pointer hover:text-red-400">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-300/50 bg-red-950/50 p-3 rounded overflow-x-auto">
                  {state.details}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // EMPTY STATE - No diagnostics yet
  if (state.mode === 'empty') {
    // For V4: Show engagement flow even without diagnostics
    // The whole point is to guide users through GAP first
    if (useV4 && state.reason === 'no_runs') {
      // Fetch company name for V4 component
      const { getCompanyById } = await import('@/lib/airtable/companies');
      const company = await getCompanyById(companyId);

      if (company) {
        return (
          <div className="space-y-4">
            <CompanyOverviewV4
              companyId={companyId}
              companyName={company.name}
              company={company}
              strategy={null}
              strategySnapshot={null}
              recentDiagnostics={[]}
              alerts={[]}
              industry={company.industry}
              stage={company.stage}
              aiSnapshot={null}
              metrics={null}
            />

            {/* Links to switch views */}
            <div className="text-center pt-4 border-t border-slate-800/50 flex justify-center gap-4">
              <Link
                href={`/c/${companyId}?view=v3`}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Switch to V3 overview
              </Link>
              <Link
                href={`/c/${companyId}?view=v2`}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Switch to classic dashboard
              </Link>
            </div>
          </div>
        );
      }
    }

    // Default empty state for V2/V3 or if company not found
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <FileQuestion className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-200 mb-2">
          {state.reason === 'no_company' ? 'Company Not Found' : 'No Diagnostics Yet'}
        </h2>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          {state.reason === 'no_company'
            ? 'This company could not be found in the system.'
            : 'Run your first diagnostic to see an overview of this company\'s marketing health.'}
        </p>
        {state.reason !== 'no_company' && (
          <Link
            href={`/c/${companyId}/diagnostics`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Run Diagnostics
          </Link>
        )}
      </div>
    );
  }

  // LEGACY STATE - Explicit opt-in only
  if (state.mode === 'legacy') {
    return (
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Wrench className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-amber-300 mb-2">
              Legacy View Mode
            </h2>
            <p className="text-amber-200/80 mb-4">
              {state.reason}. This view is deprecated and will be removed in a future release.
            </p>
            <Link
              href={`/c/${companyId}`}
              className="px-4 py-2 bg-amber-800/50 hover:bg-amber-700/50 text-amber-200 rounded-lg text-sm transition-colors inline-block"
            >
              Switch to Modern View
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // STALE STATE - Show overview with stale banner
  if (state.mode === 'stale') {
    const { viewModel, lastRunAt } = state;
    const daysSinceRun = Math.floor(
      (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
      <div className="space-y-4">
        {/* Stale Banner */}
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-200 font-medium">
                  Data may be stale ({daysSinceRun} days since last run)
                </p>
                <p className="text-amber-200/60 text-sm">
                  Re-run diagnostics to get the latest insights.
                </p>
              </div>
            </div>
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="px-4 py-2 bg-amber-800/50 hover:bg-amber-700/50 text-amber-200 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Run Diagnostics
            </Link>
          </div>
        </div>

        {/* Render Overview with stale data */}
        {await renderReadyState(viewModel, companyId, isFromPipeline, useV4, useV3, leadId, gapRunId)}
      </div>
    );
  }

  // READY STATE - Render the canonical overview
  const { viewModel } = state;
  return renderReadyState(viewModel, companyId, isFromPipeline, useV4, useV3, leadId, gapRunId);
}

// ============================================================================
// Ready State Renderer
// ============================================================================

async function renderReadyState(
  viewModel: OverviewViewModel,
  companyId: string,
  isFromPipeline: boolean,
  useV4: boolean,
  useV3: boolean,
  leadId?: string,
  gapRunId?: string
) {
  // Fetch additional data for Status Panel (narrative)
  const [pipelineLead, topFindings, rawAnalyticsFindings] = await Promise.all([
    isFromPipeline && leadId ? getInboundLeadById(leadId).catch(() => null) : Promise.resolve(null),
    getCompanyFindings(companyId, { severities: ['high', 'critical'] }).catch(() => []),
    getDiagnosticFindingsForCompany(companyId, { labSlug: 'analytics' }).catch(() => []),
  ]);

  // Filter analytics findings
  const analyticsFindings = (rawAnalyticsFindings || [])
    .filter((f) => f.severity === 'high' || f.severity === 'medium')
    .slice(0, 3);

  // Generate AI narrative
  const narrative = viewModel.statusSummary && viewModel.analyticsSnapshot
    ? await generateCompanyStatusNarrative({
        companyId,
        companyName: viewModel.company.name,
        status: viewModel.statusSummary,
        analytics: viewModel.analyticsSnapshot,
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

  // DMA pipeline context
  const showDmaPipelineContext = isFromPipeline && pipelineLead && pipelineLead.leadSource === 'DMA Full GAP';

  // Log render
  console.log('[OVERVIEW_RENDER]', {
    companyId,
    componentName: useV4 ? 'CompanyOverviewV4' : useV3 ? 'CompanyOverviewV3' : 'CompanyOverviewPage',
    useV4,
    useV3,
    gapScore: viewModel.strategySnapshot?.overallScore ?? viewModel.statusSummary?.gapScore ?? null,
    sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });

  // V4: Engagement-driven entry point (Strategy vs Project paths)
  if (useV4) {
    // Compute situation metrics for header
    const situationMetrics = {
      sessions: viewModel.performancePulse?.currentSessions ?? null,
      sessionsChange: viewModel.performancePulse?.trafficChange7d ?? null,
      conversions: viewModel.performancePulse?.currentConversions ?? null,
      conversionsChange: viewModel.performancePulse?.conversionsChange7d ?? null,
      gapScore: viewModel.strategySnapshot?.overallScore ?? null,
      alertCount: viewModel.alerts.length,
      criticalAlertCount: viewModel.alerts.filter(a => a.severity === 'critical').length,
    };

    return (
      <div className="space-y-4">
        {/* DMA Full GAP Banner (keep for pipeline context) */}
        {showDmaPipelineContext && pipelineLead && (
          <DmaFullGapBanner
            lead={pipelineLead}
            gapRunId={gapRunId}
            companyId={companyId}
          />
        )}

        {/* V4 Overview: Engagement Type → Labs → Context Gathering → Route */}
        <CompanyOverviewV4
          companyId={companyId}
          companyName={viewModel.company.name}
          company={viewModel.companyRecord}
          strategy={viewModel.strategy}
          strategySnapshot={viewModel.strategySnapshot}
          recentDiagnostics={viewModel.recentDiagnostics}
          alerts={viewModel.alerts}
          industry={viewModel.company.industry}
          stage={viewModel.company.stage}
          aiSnapshot={narrative?.summary}
          metrics={situationMetrics}
        />

        {/* Links to switch views */}
        <div className="text-center pt-4 border-t border-slate-800/50 flex justify-center gap-4">
          <Link
            href={`/c/${companyId}?view=v3`}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Switch to V3 overview
          </Link>
          <Link
            href={`/c/${companyId}?view=v2`}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Switch to classic dashboard
          </Link>
        </div>
      </div>
    );
  }

  // V3: Business Need–First, Strategy-Aligned layout
  if (useV3) {
    return (
      <div className="space-y-4">
        {/* DMA Full GAP Banner (keep for pipeline context) */}
        {showDmaPipelineContext && pipelineLead && (
          <DmaFullGapBanner
            lead={pipelineLead}
            gapRunId={gapRunId}
            companyId={companyId}
          />
        )}

        {/* Full Workup Checklist (keep for pipeline context) */}
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

        {/* V3 Overview: Business Need → Strategy → Plays → AI Action → Signals */}
        <CompanyOverviewV3
          companyId={companyId}
          companyName={viewModel.company.name}
          strategy={viewModel.strategy}
          plays={viewModel.plays}
          strategySnapshot={viewModel.strategySnapshot}
          recentDiagnostics={viewModel.recentDiagnostics}
          alerts={viewModel.alerts}
          scoreTrends={viewModel.scoreTrends}
          workSummary={viewModel.workSummary}
          performancePulse={viewModel.performancePulse}
          contextCompleteness={viewModel.contextCompleteness}
        />

        {/* Links to switch views */}
        <div className="text-center pt-4 border-t border-slate-800/50 flex justify-center gap-4">
          <Link
            href={`/c/${companyId}`}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Switch to engagement flow
          </Link>
          <Link
            href={`/c/${companyId}?view=v2`}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Switch to classic dashboard
          </Link>
        </div>
      </div>
    );
  }

  // V2: Legacy diagnostic-centric dashboard
  // Compute status header for V2 view
  const [strategy, contextGraph, projects] = await Promise.all([
    getActiveStrategy(companyId).catch(() => null),
    loadContextGraph(companyId).catch(() => null),
    getProjectsForCompany(companyId).catch(() => []),
  ]);

  // Compute work counts from workSummary
  const workCounts = {
    inProgress: viewModel.workSummary.counts.inProgress,
    blocked: 0, // Not tracked separately in workSummary
    dueSoon: 0, // Not tracked separately in workSummary
    total: viewModel.workSummary.counts.active,
  };

  // Check context readiness
  let contextReadinessPercent: number | undefined;
  if (contextGraph) {
    const readiness = isStrategyReady(contextGraph as CompanyContextGraph);
    contextReadinessPercent = readiness.completenessPercent;
  }

  // Check strategy state
  const hasStrategy = !!strategy;
  const pillars = (strategy as any)?.pillars || [];
  const hasAcceptedBets = pillars.some((p: any) =>
    p.status === 'accepted' || p.status === 'active'
  );
  const hasTactics = pillars.some((p: any) => (p.tactics?.length || 0) > 0);

  // Check project state
  const activeProjects = projects.filter(p =>
    p.status === 'draft' || p.status === 'in_progress'
  );
  const hasActiveProject = activeProjects.length > 0;
  const hasProjectBrief = activeProjects.some(p => p.briefApproved);

  // Compute status header
  const statusHeader = computeStatusHeader({
    companyId,
    performancePulse: viewModel.performancePulse ? {
      hasGa4: viewModel.performancePulse.hasGa4,
      hasGsc: viewModel.performancePulse.hasGsc,
      currentSessions: viewModel.performancePulse.currentSessions,
      trafficChange7d: viewModel.performancePulse.trafficChange7d,
      currentConversions: viewModel.performancePulse.currentConversions,
      conversionsChange7d: viewModel.performancePulse.conversionsChange7d,
      currentClicks: viewModel.performancePulse.currentClicks,
      seoVisibilityChange7d: viewModel.performancePulse.seoVisibilityChange7d,
      hasAnomalies: viewModel.performancePulse.hasAnomalies,
      anomalySummary: viewModel.performancePulse.anomalySummary,
    } : null,
    workCounts,
    hasDiagnostics: viewModel.recentDiagnostics.some(d => d.status === 'complete'),
    contextReadinessPercent,
    hasStrategy,
    hasAcceptedBets,
    hasTactics,
    hasActiveProject,
    hasProjectBrief,
  });

  return (
    <div className="space-y-4">
      {/* Status Summary Panel */}
      {viewModel.statusSummary && viewModel.analyticsSnapshot && (
        <StatusSummaryPanel
          status={viewModel.statusSummary}
          analytics={viewModel.analyticsSnapshot}
          companyName={viewModel.company.name}
          narrative={narrative ?? undefined}
          analyticsFindings={analyticsFindings.length > 0 ? analyticsFindings : undefined}
        />
      )}

      {/* DMA Full GAP Banner */}
      {showDmaPipelineContext && pipelineLead && (
        <DmaFullGapBanner
          lead={pipelineLead}
          gapRunId={gapRunId}
          companyId={companyId}
        />
      )}

      {/* Full Workup Checklist */}
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
        company={viewModel.company}
        strategySnapshot={viewModel.strategySnapshot}
        recentDiagnostics={viewModel.recentDiagnostics}
        workSummary={viewModel.workSummary}
        scoreTrends={viewModel.scoreTrends}
        alerts={viewModel.alerts}
        performancePulse={viewModel.performancePulse}
        mediaLabSummary={viewModel.mediaLabSummary}
        statusSummary={viewModel.statusSummary}
        baselineStatus={viewModel.baselineStatus}
        qbrSummary={viewModel.qbrSummary}
        statusHeader={statusHeader}
      />

      {/* Link to switch to V3 */}
      <div className="text-center pt-4 border-t border-slate-800/50">
        <Link
          href={`/c/${companyId}`}
          className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Try the new strategy-first overview
        </Link>
      </div>
    </div>
  );
}
