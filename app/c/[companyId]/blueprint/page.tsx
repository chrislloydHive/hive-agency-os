// app/c/[companyId]/blueprint/page.tsx
// Blueprint - The Strategic Hub for a Company
//
// Blueprint is the heart of Hive OS for a company. It displays:
// - Strategic Overview (latest diagnostics + health score + maturity stage)
// - Key Focus Areas (prioritized areas: UX, SEO, brand, content, demand gen, ops)
// - 90-Day Plan (AI-generated from Brain + latest diagnostics)
// - Insights (from GAP, labs, analytics, Brain memories tagged strategy/insight)
// - Diagnostics & Tools (consolidated list of all tools with status)
// - Analytics Summary (traffic, search, funnel metrics)

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import { getCompanyAlerts } from '@/lib/os/companies/alerts';
import { getRecentRunsForCompany, getToolLabel, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { getPerformancePulse } from '@/lib/os/analytics/performancePulse';
import { getInsightsSummary } from '@/lib/airtable/clientBrain';
import {
  runBlueprintPipeline,
  synthesizeStrategy,
  getRecommendedToolsForBlueprint,
} from '@/lib/blueprint';
import {
  fetchBlueprintAnalytics,
  generateAnalyticsInsights,
} from '@/lib/os/analytics/blueprintDataFetcher';
import { BlueprintClient } from './BlueprintClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Blueprint | ${company.name} | Hive OS`,
    description: `Strategic blueprint and growth plan for ${company.name}`,
  };
}

// Tool slug mapping for report paths
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

export default async function BlueprintPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all data in parallel
  const [
    company,
    strategySnapshot,
    recentRuns,
    alerts,
    performancePulse,
    brainSummary,
    pipelineData,
    analyticsResult,
  ] = await Promise.all([
    getCompanyById(companyId),
    getCompanyStrategySnapshot(companyId).catch(() => null),
    getRecentRunsForCompany(companyId, 10).catch(() => []),
    getCompanyAlerts(companyId).catch(() => []),
    getPerformancePulse().catch(() => null),
    getInsightsSummary(companyId).catch(() => null),
    runBlueprintPipeline(companyId).catch(() => null),
    fetchBlueprintAnalytics(companyId, { preset: '30d' }).catch(() => ({ ok: false, summary: null })),
  ]);

  if (!company) {
    notFound();
  }

  // Generate strategy synthesis from pipeline data
  let strategySynthesis = null;
  if (pipelineData) {
    try {
      strategySynthesis = await synthesizeStrategy(pipelineData, { useAI: true });
    } catch (error) {
      console.error('[Blueprint] Strategy synthesis failed:', error);
    }
  }

  // Generate analytics insights
  const analyticsSummary = analyticsResult.summary;
  const analyticsInsights = analyticsSummary
    ? generateAnalyticsInsights(analyticsSummary)
    : [];

  // Generate tool recommendations
  const hasWebsite = Boolean(company.website || company.domain);
  const recommendedTools = await getRecommendedToolsForBlueprint({
    companyId,
    pipelineData,
    strategySynthesis,
    hasWebsite,
  }).catch(() => []);

  // Transform recent runs for display
  const recentDiagnostics = recentRuns.map((run: DiagnosticRun) => {
    const slug = toolIdToSlug[run.toolId] || run.toolId;
    return {
      id: run.id,
      toolId: run.toolId,
      toolLabel: getToolLabel(run.toolId),
      status: run.status,
      score: run.score,
      completedAt: run.status === 'complete' ? run.updatedAt : null,
      reportPath: run.status === 'complete' ? `/c/${companyId}/diagnostics/${slug}/${run.id}` : null,
      createdAt: run.createdAt,
    };
  });

  // Serialize recommended tools for client (strip functions)
  const serializedRecommendedTools = recommendedTools.map(rt => ({
    toolId: rt.toolId,
    scoreImpact: rt.scoreImpact,
    urgency: rt.urgency,
    reason: rt.reason,
    blueprintMeta: rt.blueprintMeta,
    hasRecentRun: rt.hasRecentRun,
    lastRunAt: rt.lastRunAt,
    lastScore: rt.lastScore,
    daysSinceRun: rt.daysSinceRun,
    // Tool definition (without functions)
    toolLabel: rt.tool.label,
    toolDescription: rt.tool.description,
    toolCategory: rt.tool.category,
    toolIcon: rt.tool.icon,
    runApiPath: rt.tool.runApiPath,
    urlSlug: rt.tool.urlSlug,
    requiresWebsite: rt.tool.requiresWebsite,
    estimatedMinutes: rt.tool.estimatedMinutes,
  }));

  return (
    <BlueprintClient
      company={{
        id: company.id,
        name: company.name,
        website: company.website,
        domain: company.domain,
        industry: company.industry,
        ga4PropertyId: company.ga4PropertyId,
        searchConsoleSiteUrl: company.searchConsoleSiteUrl,
      }}
      strategySnapshot={strategySnapshot}
      recentDiagnostics={recentDiagnostics}
      alerts={alerts}
      performancePulse={performancePulse}
      brainSummary={brainSummary}
      pipelineData={pipelineData}
      strategySynthesis={strategySynthesis}
      analyticsSummary={analyticsSummary}
      analyticsInsights={analyticsInsights}
      recommendedTools={serializedRecommendedTools}
    />
  );
}
