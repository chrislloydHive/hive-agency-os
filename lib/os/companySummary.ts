// lib/os/companySummary.ts
// ============================================================================
// Company Summary - Unified Data Model for Company Views
// ============================================================================
//
// This module provides a single, normalized view of a company by aggregating
// data from all relevant sources: Airtable tables, diagnostics, analytics,
// media, and brain systems.
//
// Design principles:
// 1. Pull from existing helpers and types - don't reinvent the wheel
// 2. All fields are optional/nullable - graceful degradation when data missing
// 3. Ready-to-render format - minimize client-side processing
// 4. Single source of truth for company state across all pages

import { cache } from 'react';
import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { getCompanyStrategySnapshot, type CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import { getRunsGroupedByTool, listDiagnosticRunsForCompany, getToolLabel, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { fetchBlueprintAnalytics, type BlueprintAnalyticsSummary } from '@/lib/os/analytics/blueprintDataFetcher';
import { getMediaLabSummary, type MediaLabSummary } from '@/lib/mediaLab';
import { evaluateCompanyHealth, type CompanyHealth, type CompanyActivitySnapshot, getMaxDate } from '@/lib/os/companies/health';
import { listClientInsightsForCompany } from '@/lib/airtable/clientInsights';
import { base } from '@/lib/airtable/client';

// Use the capitalized CompanyStage type that matches Airtable values
import type { CompanyStage } from '@/lib/os/companies/list';

// ============================================================================
// Types
// ============================================================================

/**
 * Core metadata about the company
 */
/**
 * Company type for industry-specific card rendering
 */
export type CompanyType = 'SaaS' | 'Services' | 'Marketplace' | 'eCom' | 'Local' | 'Other';

export interface CompanySummaryMeta {
  name: string;
  url?: string | null;
  domain?: string | null;
  stage?: CompanyStage | string | null;
  tier?: 'A' | 'B' | 'C' | string | null;
  companyType?: CompanyType | null;
  healthTag?: CompanyHealth | null;
  healthReasons: string[];
  labels: string[]; // Aggregated labels: stage, tier, health indicators
  pinned?: boolean;
  lastActivityAt?: string | null; // ISO timestamp
  lastActivityLabel?: string | null; // e.g., "2 days ago"
}

/**
 * Diagnostic scores from various labs
 */
export interface CompanySummaryScores {
  // Overall / Blueprint
  latestBlueprintScore?: number | null;
  blueprintScoreDate?: string | null;

  // Individual lab scores
  latestOpsScore?: number | null;
  opsScoreDate?: string | null;

  latestMediaScore?: number | null;
  mediaScoreDate?: string | null;

  latestBrandScore?: number | null;
  brandScoreDate?: string | null;

  latestContentScore?: number | null;
  contentScoreDate?: string | null;

  latestSeoScore?: number | null;
  seoScoreDate?: string | null;

  latestWebsiteScore?: number | null;
  websiteScoreDate?: string | null;

  latestDemandScore?: number | null;
  demandScoreDate?: string | null;

  // Confidence / maturity
  confidenceLabel?: 'Low' | 'Medium' | 'High' | string | null;
  maturityStage?: string | null;
}

/**
 * Score change tracking for dimension pills
 */
export interface DimensionScoreWithChange {
  key: string;
  label: string;
  score: number | null;
  previousScore?: number | null;
  change?: number | null;
}

/**
 * Recent work and diagnostic activity
 */
export interface CompanySummaryRecentWork {
  lastDiagnosticLabel?: string | null; // e.g., "Ran Website Lab"
  lastDiagnosticScore?: number | null;
  lastDiagnosticDate?: string | null;
  lastDiagnosticToolId?: string | null;
  lastDiagnosticRunId?: string | null;

  openTasksCount: number;
  inProgressTaskCount: number;

  // Key attention items from strategy snapshot
  topAttentionItem?: {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    area?: string;
  } | null;

  // Next recommended actions
  nextActions: Array<{
    title: string;
    area?: string;
  }>;
}

/**
 * Media program summary
 */
export interface CompanySummaryMedia {
  hasMediaProgram: boolean;
  mediaStatus?: 'none' | 'planning' | 'running' | 'paused' | string | null;
  monthlySpend?: number | null;
  primaryChannels?: string[];
  activePlanCount?: number;
  primaryObjective?: string | null;
}

/**
 * Analytics snapshot (7-30 day metrics)
 */
export interface CompanySummaryAnalytics {
  sessions?: number | null;
  sessionsChange?: number | null; // % change
  conversions?: number | null;
  conversionsChange?: number | null;
  clicks?: number | null;
  clicksChange?: number | null;
  trendLabel?: string | null; // e.g., "Up 25% vs prior period"
}

/**
 * Brain / insights summary
 */
export interface CompanySummaryBrain {
  insightCount: number;
  documentCount?: number;
  recentInsightCount?: number; // Last 30 days
  lastUpdatedAt?: string | null;
}

/**
 * Risk and status flags
 */
export interface CompanySummaryFlags {
  isAtRisk: boolean;
  hasOpenCriticalIssues: boolean;
  hasOverdueWork: boolean;
  hasBacklogWork: boolean;
  needsAttention: boolean; // Composite flag for UI highlighting
}

/**
 * Complete Company Summary
 *
 * This is the single source of truth for displaying company state
 * across all pages: My Companies, Blueprint, Dashboard, etc.
 */
export interface CompanySummary {
  companyId: string;
  slug?: string | null;

  meta: CompanySummaryMeta;
  scores: CompanySummaryScores;
  dimensionScores: DimensionScoreWithChange[];
  recentWork: CompanySummaryRecentWork;
  media: CompanySummaryMedia;
  analytics: CompanySummaryAnalytics;
  brain: CompanySummaryBrain;
  flags: CompanySummaryFlags;

  // Metadata
  fetchedAt: string; // ISO timestamp when this summary was generated
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize stage to standard values
 */
function normalizeStage(stage?: string | null): CompanyStage {
  if (!stage) return 'Prospect';
  const s = stage.trim();
  if (['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(s)) {
    return s as CompanyStage;
  }
  if (s === 'Lead') return 'Prospect';
  if (s === 'Churned') return 'Lost';
  if (s === 'Partner') return 'Client';
  return 'Prospect';
}

/**
 * Format relative time for last activity
 */
function formatLastActivityLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return null;
  }
}

/**
 * Build labels array from company attributes
 */
function buildLabels(
  stage: string | null | undefined,
  tier: string | null | undefined,
  health: CompanyHealth,
  flags: { isAtRisk: boolean; needsAttention: boolean }
): string[] {
  const labels: string[] = [];

  if (stage) labels.push(stage);
  if (tier) labels.push(`Tier ${tier}`);
  if (flags.isAtRisk) labels.push('At Risk');
  else if (health === 'Healthy') labels.push('Healthy');
  if (flags.needsAttention) labels.push('Needs Attention');

  return labels;
}

// ============================================================================
// Data Fetching Helpers
// ============================================================================

/**
 * Fetch latest diagnostic info for summary
 */
async function getLatestDiagnosticForSummary(
  companyId: string,
  diagnosticRuns: Record<string, DiagnosticRun[]>
): Promise<{
  label: string | null;
  score: number | null;
  date: string | null;
  toolId: string | null;
  runId: string | null;
}> {
  // Flatten all runs and find the most recent complete one
  const allRuns = Object.values(diagnosticRuns)
    .flat()
    .filter(r => r.status === 'complete')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const latestRun = allRuns[0];

  if (!latestRun) {
    return { label: null, score: null, date: null, toolId: null, runId: null };
  }

  const toolLabel = getToolLabel(latestRun.toolId);

  return {
    label: `Ran ${toolLabel}`,
    score: latestRun.score,
    date: latestRun.updatedAt,
    toolId: latestRun.toolId,
    runId: latestRun.id,
  };
}

/**
 * Extract dimension scores from diagnostic runs
 */
function extractDimensionScores(
  diagnosticRuns: Record<string, DiagnosticRun[]>
): DimensionScoreWithChange[] {
  const dimensionMap: Record<string, { label: string; key: string }> = {
    websiteLab: { label: 'UX', key: 'website' },
    seoLab: { label: 'SEO', key: 'seo' },
    contentLab: { label: 'Content', key: 'content' },
    brandLab: { label: 'Brand', key: 'brand' },
    opsLab: { label: 'Ops', key: 'ops' },
    demandLab: { label: 'Demand', key: 'demand' },
  };

  const dimensions: DimensionScoreWithChange[] = [];

  for (const [toolId, config] of Object.entries(dimensionMap)) {
    const runs = diagnosticRuns[toolId] || [];
    const completeRuns = runs.filter(r => r.status === 'complete');
    const latestRun = completeRuns[0];
    const previousRun = completeRuns[1];

    const score = latestRun?.score ?? null;
    const previousScore = previousRun?.score ?? null;
    const change = score !== null && previousScore !== null ? score - previousScore : null;

    dimensions.push({
      key: config.key,
      label: config.label,
      score,
      previousScore,
      change,
    });
  }

  return dimensions;
}

/**
 * Extract overall scores from diagnostic runs and strategy snapshot
 */
function extractScores(
  diagnosticRuns: Record<string, DiagnosticRun[]>,
  strategySnapshot: CompanyStrategicSnapshot | null
): CompanySummaryScores {
  const getLatestScore = (toolId: string): { score: number | null; date: string | null } => {
    const runs = diagnosticRuns[toolId] || [];
    const latestComplete = runs.find(r => r.status === 'complete');
    return {
      score: latestComplete?.score ?? null,
      date: latestComplete?.updatedAt ?? null,
    };
  };

  // Get GAP/Blueprint score from multiple possible sources
  const gapRuns = [
    ...(diagnosticRuns.gapPlan || []),
    ...(diagnosticRuns.gapSnapshot || []),
    ...(diagnosticRuns.gapHeavy || []),
  ].filter(r => r.status === 'complete');
  const latestGapRun = gapRuns[0];

  // Extract confidence from GAP run rawJson
  let confidenceLabel: string | null = null;
  if (latestGapRun?.rawJson) {
    const raw = latestGapRun.rawJson as any;
    confidenceLabel = raw.dataConfidence?.level ||
      raw.growthPlan?.dataConfidenceScore?.level ||
      raw.dataConfidenceScore?.level ||
      null;
  }

  const opsScore = getLatestScore('opsLab');
  const brandScore = getLatestScore('brandLab');
  const contentScore = getLatestScore('contentLab');
  const seoScore = getLatestScore('seoLab');
  const websiteScore = getLatestScore('websiteLab');
  const demandScore = getLatestScore('demandLab');

  return {
    latestBlueprintScore: latestGapRun?.score ?? strategySnapshot?.overallScore ?? null,
    blueprintScoreDate: latestGapRun?.updatedAt ?? null,

    latestOpsScore: opsScore.score,
    opsScoreDate: opsScore.date,

    latestMediaScore: null, // Media Lab doesn't produce a single score
    mediaScoreDate: null,

    latestBrandScore: brandScore.score,
    brandScoreDate: brandScore.date,

    latestContentScore: contentScore.score,
    contentScoreDate: contentScore.date,

    latestSeoScore: seoScore.score,
    seoScoreDate: seoScore.date,

    latestWebsiteScore: websiteScore.score,
    websiteScoreDate: websiteScore.date,

    latestDemandScore: demandScore.score,
    demandScoreDate: demandScore.date,

    confidenceLabel: confidenceLabel ?
      (confidenceLabel.charAt(0).toUpperCase() + confidenceLabel.slice(1)) as any : null,
    maturityStage: strategySnapshot?.maturityStage ?? null,
  };
}

/**
 * Extract attention items and next actions from strategy and diagnostics
 */
function extractAttentionAndActions(
  diagnosticRuns: Record<string, DiagnosticRun[]>,
  strategySnapshot: CompanyStrategicSnapshot | null
): {
  topAttentionItem: CompanySummaryRecentWork['topAttentionItem'];
  nextActions: CompanySummaryRecentWork['nextActions'];
} {
  let topAttentionItem: CompanySummaryRecentWork['topAttentionItem'] = null;
  const nextActions: CompanySummaryRecentWork['nextActions'] = [];

  // From strategy snapshot key gaps
  if (strategySnapshot?.keyGaps && strategySnapshot.keyGaps.length > 0) {
    topAttentionItem = {
      title: strategySnapshot.keyGaps[0],
      severity: 'high',
      area: 'Strategy',
    };
  }

  // Try to find issues from diagnostic runs if no strategy gaps
  if (!topAttentionItem) {
    for (const runs of Object.values(diagnosticRuns)) {
      const latestRun = runs.find(r => r.status === 'complete' && r.rawJson);
      if (!latestRun?.rawJson) continue;

      const rawJson = latestRun.rawJson as any;
      const issues = rawJson.issues || rawJson.criticalIssues || rawJson.siteAssessment?.issues || [];

      if (Array.isArray(issues) && issues.length > 0) {
        const topIssue = issues[0];
        topAttentionItem = {
          title: typeof topIssue === 'string' ? topIssue : topIssue.title || topIssue.issue || 'Issue found',
          severity: topIssue.severity === 'critical' ? 'critical' :
                    topIssue.severity === 'high' ? 'high' : 'medium',
          area: latestRun.toolId.replace('Lab', ''),
        };
        break;
      }
    }
  }

  // From strategy snapshot focus areas
  if (strategySnapshot?.focusAreas) {
    for (const area of strategySnapshot.focusAreas.slice(0, 2)) {
      nextActions.push({ title: area, area: 'Strategy' });
    }
  }

  // From GAP quick wins
  if (nextActions.length < 2) {
    const gapRuns = [
      ...(diagnosticRuns.gapPlan || []),
      ...(diagnosticRuns.gapSnapshot || []),
    ];
    const latestGap = gapRuns.find(r => r.status === 'complete' && r.rawJson);

    if (latestGap?.rawJson) {
      const rawJson = latestGap.rawJson as any;
      const quickWins = rawJson.growthPlan?.quickWins || rawJson.quickWins || [];

      for (const win of quickWins.slice(0, 2 - nextActions.length)) {
        const title = typeof win === 'string' ? win : win.title || win.action || 'Quick win';
        if (!nextActions.find(a => a.title === title)) {
          nextActions.push({ title, area: win.category || 'Quick Win' });
        }
      }
    }
  }

  return { topAttentionItem, nextActions: nextActions.slice(0, 2) };
}

/**
 * Fetch work items summary for a company
 */
async function getWorkSummaryForCompany(companyId: string): Promise<{
  openCount: number;
  inProgressCount: number;
  hasOverdue: boolean;
  hasBacklog: boolean;
  hasCritical: boolean;
}> {
  try {
    const records = await base('Work Items')
      .select({
        filterByFormula: `AND(NOT({Status} = 'Done'), FIND('${companyId}', ARRAYJOIN({Company}, ',')))`,
        fields: ['Title', 'Status', 'Severity', 'Due Date'],
      })
      .all();

    const now = new Date();
    let hasOverdue = false;
    let hasCritical = false;
    let inProgressCount = 0;
    let hasBacklog = false;

    for (const record of records) {
      const status = record.fields['Status'] as string;
      const severity = record.fields['Severity'] as string;
      const dueDate = record.fields['Due Date'] as string | undefined;

      if (status === 'In Progress') inProgressCount++;
      if (status === 'Backlog') hasBacklog = true;
      if (severity === 'Critical') hasCritical = true;

      if (dueDate) {
        const due = new Date(dueDate);
        if (due < now && status !== 'Done') {
          hasOverdue = true;
        }
      }
    }

    return {
      openCount: records.length,
      inProgressCount,
      hasOverdue,
      hasBacklog,
      hasCritical,
    };
  } catch (error) {
    console.warn('[CompanySummary] Failed to fetch work items:', error);
    return {
      openCount: 0,
      inProgressCount: 0,
      hasOverdue: false,
      hasBacklog: false,
      hasCritical: false,
    };
  }
}

/**
 * Fetch brain/insights summary for a company
 */
async function getBrainSummaryForCompany(companyId: string): Promise<CompanySummaryBrain> {
  try {
    const insights = await listClientInsightsForCompany(companyId, { limit: 500 });

    // Count recent insights (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = insights.filter(i =>
      i.createdAt && new Date(i.createdAt) > thirtyDaysAgo
    );

    // Find most recent update
    const sortedByDate = [...insights].sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || '';
      const bDate = b.updatedAt || b.createdAt || '';
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return {
      insightCount: insights.length,
      documentCount: 0, // Documents fetched separately if needed
      recentInsightCount: recentInsights.length,
      lastUpdatedAt: sortedByDate[0]?.updatedAt || sortedByDate[0]?.createdAt || null,
    };
  } catch (error) {
    console.warn('[CompanySummary] Failed to fetch brain data:', error);
    return {
      insightCount: 0,
      documentCount: 0,
      recentInsightCount: 0,
      lastUpdatedAt: null,
    };
  }
}

/**
 * Extract media summary from Media Lab data
 */
function extractMediaSummary(mediaLabSummary: MediaLabSummary | null): CompanySummaryMedia {
  if (!mediaLabSummary || mediaLabSummary.activePlanCount === 0) {
    return {
      hasMediaProgram: false,
      mediaStatus: 'none',
    };
  }

  return {
    hasMediaProgram: true,
    mediaStatus: mediaLabSummary.mediaStatus || 'none',
    monthlySpend: mediaLabSummary.totalActiveBudget || null,
    primaryChannels: [], // Would need to extract from plans
    activePlanCount: mediaLabSummary.activePlanCount,
    primaryObjective: mediaLabSummary.primaryObjective || null,
  };
}

/**
 * Extract analytics summary
 */
function extractAnalyticsSummary(
  analytics: BlueprintAnalyticsSummary | null
): CompanySummaryAnalytics {
  if (!analytics) {
    return {};
  }

  // Build trend label
  let trendLabel: string | null = null;
  if (analytics.sessionsChange !== null && analytics.sessionsChange !== undefined) {
    const sign = analytics.sessionsChange >= 0 ? '+' : '';
    const direction = analytics.sessionsChange > 5 ? 'Up' :
                      analytics.sessionsChange < -5 ? 'Down' : 'Flat';
    trendLabel = `${direction} ${sign}${Math.round(analytics.sessionsChange)}% vs prior`;
  }

  return {
    sessions: analytics.sessions ?? null,
    sessionsChange: analytics.sessionsChange ?? null,
    conversions: analytics.conversions ?? null,
    conversionsChange: analytics.conversionsChange ?? null,
    clicks: analytics.clicks ?? null,
    clicksChange: analytics.ctrChange ?? null,
    trendLabel,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get a comprehensive summary of a company from all data sources
 *
 * This is the primary function for loading company data across all pages.
 * It aggregates data from:
 * - Airtable Companies table
 * - Strategy Snapshots
 * - Diagnostic Runs (all labs)
 * - Analytics (GA4/GSC)
 * - Media Lab
 * - Work Items
 * - Client Brain insights
 *
 * @param companyId - The Airtable record ID of the company
 * @returns Complete CompanySummary or null if company not found
 */
export async function getCompanySummary(companyId: string): Promise<CompanySummary | null> {
  console.log('[CompanySummary] Fetching summary for company:', companyId);

  try {
    // Fetch all data in parallel
    const [
      company,
      strategySnapshot,
      diagnosticRuns,
      analyticsResult,
      mediaLabSummary,
      workSummary,
      brainSummary,
    ] = await Promise.all([
      getCompanyById(companyId),
      getCompanyStrategySnapshot(companyId).catch(() => null),
      getRunsGroupedByTool(companyId).catch(() => ({} as Record<string, DiagnosticRun[]>)),
      fetchBlueprintAnalytics(companyId, { preset: '7d' }).catch(() => ({ ok: false, summary: null })),
      getMediaLabSummary(companyId).catch(() => null),
      getWorkSummaryForCompany(companyId),
      getBrainSummaryForCompany(companyId),
    ]);

    if (!company) {
      console.warn('[CompanySummary] Company not found:', companyId);
      return null;
    }

    const analytics = analyticsResult.summary;
    const stage = normalizeStage(company.stage);

    // Get latest diagnostic info
    const latestDiagnostic = await getLatestDiagnosticForSummary(companyId, diagnosticRuns);

    // Extract scores
    const scores = extractScores(diagnosticRuns, strategySnapshot);
    const dimensionScores = extractDimensionScores(diagnosticRuns);

    // Build activity snapshot for health evaluation
    const lastActivityAt = getMaxDate(
      latestDiagnostic.date,
      workSummary.openCount > 0 ? new Date().toISOString() : null, // Proxy for work activity
      brainSummary.lastUpdatedAt
    );

    const activitySnapshot: CompanyActivitySnapshot = {
      lastGapAssessmentAt: scores.blueprintScoreDate || null,
      lastGapPlanAt: diagnosticRuns.gapPlan?.find(r => r.status === 'complete')?.createdAt || null,
      lastDiagnosticAt: latestDiagnostic.date,
      lastWorkActivityAt: null,
      lastAnyActivityAt: lastActivityAt,
    };

    // Evaluate health
    const { health, reasons: healthReasons } = evaluateCompanyHealth({
      stage,
      activity: activitySnapshot,
      latestGapScore: scores.latestBlueprintScore,
      hasOverdueWork: workSummary.hasOverdue,
      hasBacklogWork: workSummary.hasBacklog,
      healthOverride: company.healthOverride,
      atRiskFlag: company.atRiskFlag,
    });

    // Build flags
    const flags: CompanySummaryFlags = {
      isAtRisk: health === 'At Risk',
      hasOpenCriticalIssues: workSummary.hasCritical,
      hasOverdueWork: workSummary.hasOverdue,
      hasBacklogWork: workSummary.hasBacklog,
      needsAttention: health === 'At Risk' || workSummary.hasCritical || workSummary.hasOverdue,
    };

    // Extract attention and actions
    const { topAttentionItem, nextActions } = extractAttentionAndActions(diagnosticRuns, strategySnapshot);

    // Build labels
    const labels = buildLabels(stage, company.tier, health, flags);

    // Build final summary
    const summary: CompanySummary = {
      companyId: company.id,
      slug: company.domain || null,

      meta: {
        name: company.name,
        url: company.website || null,
        domain: company.domain || null,
        stage,
        tier: company.tier || null,
        companyType: company.companyType || null,
        healthTag: health,
        healthReasons,
        labels,
        pinned: false, // Client-side only
        lastActivityAt,
        lastActivityLabel: formatLastActivityLabel(lastActivityAt),
      },

      scores,
      dimensionScores,

      recentWork: {
        lastDiagnosticLabel: latestDiagnostic.label,
        lastDiagnosticScore: latestDiagnostic.score,
        lastDiagnosticDate: latestDiagnostic.date,
        lastDiagnosticToolId: latestDiagnostic.toolId,
        lastDiagnosticRunId: latestDiagnostic.runId,
        openTasksCount: workSummary.openCount,
        inProgressTaskCount: workSummary.inProgressCount,
        topAttentionItem,
        nextActions,
      },

      media: extractMediaSummary(mediaLabSummary),
      analytics: extractAnalyticsSummary(analytics),
      brain: brainSummary,
      flags,

      fetchedAt: new Date().toISOString(),
    };

    console.log('[CompanySummary] Generated summary for:', company.name, {
      stage,
      health,
      overallScore: scores.latestBlueprintScore,
      openTasks: workSummary.openCount,
      insightCount: brainSummary.insightCount,
    });

    return summary;
  } catch (error) {
    console.error('[CompanySummary] Error fetching summary:', companyId, error);
    return null;
  }
}

// ============================================================================
// Cached Version
// ============================================================================

/**
 * Cached version of getCompanySummary
 *
 * Uses React's cache() for request-level deduplication.
 * For longer TTLs, consider adding Vercel KV or similar.
 */
export const getCompanySummaryCached = cache(async (companyId: string): Promise<CompanySummary | null> => {
  return getCompanySummary(companyId);
});

// ============================================================================
// Batch Fetch
// ============================================================================

/**
 * Fetch summaries for multiple companies in parallel
 *
 * @param companyIds - Array of company IDs
 * @param pinnedIds - Optional array of pinned company IDs (for client-side merge)
 * @returns Array of CompanySummary objects (nulls filtered out)
 */
export async function getCompanySummaries(
  companyIds: string[],
  pinnedIds: string[] = []
): Promise<CompanySummary[]> {
  const results = await Promise.all(
    companyIds.map(id => getCompanySummaryCached(id))
  );

  // Filter nulls and set pinned status
  return results
    .filter((r): r is CompanySummary => r !== null)
    .map(summary => ({
      ...summary,
      meta: {
        ...summary.meta,
        pinned: pinnedIds.includes(summary.companyId),
      },
    }));
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  CompanyStage,
  CompanyHealth,
  // Note: CompanyType is already exported above at its definition
};
