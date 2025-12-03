// lib/companies/getCompanyCardData.ts
// Unified data loader for enhanced company cards (V3)
// Fetches and normalizes data from Blueprint, Analytics, Media, and Work sources

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { getCompanyStrategySnapshot, type CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import { getRunsGroupedByTool, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { fetchBlueprintAnalytics, type BlueprintAnalyticsSummary } from '@/lib/os/analytics/blueprintDataFetcher';
import { getMediaLabSummary, type MediaLabSummary } from '@/lib/mediaLab';
import { evaluateCompanyHealth, type CompanyHealth, type CompanyActivitySnapshot } from '@/lib/os/companies/health';
import { base } from '@/lib/airtable/client';
import { getWorkItemsForCompany, type WorkItemRecord } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

// Company type for card customization
export type CompanyType = 'SaaS' | 'Services' | 'Marketplace' | 'eCom' | 'Local' | 'Other' | null;

export interface DimensionScore {
  label: string;
  key: string;
  toolId: string; // For linking to diagnostic page
  score: number | null;
  previousScore?: number | null;
  change?: number | null;
  direction?: 'up' | 'down' | 'flat' | null;
}

export interface TrendMetric {
  label: string;
  value: number | null;
  change: number | null;
  direction: 'up' | 'down' | 'flat' | null;
}

export interface AttentionItem {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  area?: string;
}

export interface NextAction {
  title: string;
  area?: string;
  workItemId?: string; // Link to work item if exists
}

export interface MediaStatus {
  hasProgram: boolean;
  monthlySpend?: number | null;
  cpl?: number | null;
  bestChannel?: string | null;
  mediaScore?: number | null;
  status?: string;
}

// Last worked on item
export interface LastWorkedItem {
  id: string;
  title: string;
  status: 'In Progress' | 'Done' | 'Planned' | 'Backlog';
  relativeDate: string;
  date: string | null;
  area?: string;
}

// Auto-tailored risk indicator
export interface RiskIndicator {
  key: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  icon?: string;
}

export interface CompanyCardData {
  // Core info
  id: string;
  name: string;
  domain?: string | null;
  website?: string | null;
  stage: string;
  tier?: string | null;
  faviconUrl?: string | null;
  companyType: CompanyType;

  // Health & Risk
  health: CompanyHealth;
  healthReasons: string[];
  riskLevel: 'healthy' | 'warning' | 'critical';
  riskIndicator: RiskIndicator | null; // Top priority risk

  // Scores
  overallScore: number | null;
  dataConfidence?: 'low' | 'medium' | 'high' | null;
  maturityStage?: string | null;
  dimensionScores: DimensionScore[];

  // Analytics Pulse (7-day trends)
  trendMetrics: TrendMetric[];
  hasAnalyticsConnected: boolean;

  // Last Worked On
  lastWorkedItem: LastWorkedItem | null;

  // Attention & Actions
  topAttentionItem: AttentionItem | null;
  nextActions: NextAction[];
  totalActionCount: number; // For "View All" link

  // Media
  media: MediaStatus;

  // Activity Context
  lastActivityLabel: string;
  lastActivityDate: string | null;
  openWorkCount: number;

  // Pinning
  isPinned: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapStage(stage?: string): string {
  if (!stage) return 'Prospect';
  const normalizedStage = stage.trim();
  if (['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(normalizedStage)) {
    return normalizedStage;
  }
  if (normalizedStage === 'Lead') return 'Prospect';
  if (normalizedStage === 'Churned') return 'Lost';
  return 'Prospect';
}

function formatLastActivity(dateStr: string | null): string {
  if (!dateStr) return 'No activity';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return 'Unknown';
  }
}

function getTrendDirection(change: number | null): 'up' | 'down' | 'flat' | null {
  if (change === null) return null;
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'flat';
}

function getRiskLevel(health: CompanyHealth, overallScore: number | null): 'healthy' | 'warning' | 'critical' {
  if (health === 'At Risk') return 'critical';
  if (overallScore !== null && overallScore < 40) return 'critical';
  if (overallScore !== null && overallScore < 60) return 'warning';
  if (health === 'Unknown') return 'warning';
  return 'healthy';
}

function getFaviconUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  // Use Google's favicon service
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// ============================================================================
// Data Extraction Functions
// ============================================================================

function getScoreDirection(change: number | null): 'up' | 'down' | 'flat' | null {
  if (change === null) return null;
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function extractDimensionScores(
  diagnosticRuns: Record<string, DiagnosticRun[]>,
  strategySnapshot: CompanyStrategicSnapshot | null
): DimensionScore[] {
  const dimensions: DimensionScore[] = [];

  // Map toolId to display info with diagnostic page slug
  const dimensionMap: Record<string, { label: string; key: string; toolId: string }> = {
    websiteLab: { label: 'UX', key: 'website', toolId: 'website-lab' },
    seoLab: { label: 'SEO', key: 'seo', toolId: 'seo-lab' },
    contentLab: { label: 'Content', key: 'content', toolId: 'content-lab' },
    brandLab: { label: 'Brand', key: 'brand', toolId: 'brand-lab' },
    opsLab: { label: 'Ops', key: 'ops', toolId: 'ops-lab' },
  };

  for (const [runToolId, config] of Object.entries(dimensionMap)) {
    const runs = diagnosticRuns[runToolId] || [];
    const completedRuns = runs.filter(r => r.status === 'complete');
    const latestRun = completedRuns[0];
    const previousRun = completedRuns[1];

    const score = latestRun?.score ?? null;
    const previousScore = previousRun?.score ?? null;
    const change = score !== null && previousScore !== null ? score - previousScore : null;

    dimensions.push({
      label: config.label,
      key: config.key,
      toolId: config.toolId,
      score,
      previousScore,
      change,
      direction: getScoreDirection(change),
    });
  }

  return dimensions;
}

function extractTrendMetrics(analytics: BlueprintAnalyticsSummary | null): TrendMetric[] {
  if (!analytics) {
    return [
      { label: 'Sessions', value: null, change: null, direction: null },
      { label: 'Conversions', value: null, change: null, direction: null },
      { label: 'Clicks', value: null, change: null, direction: null },
    ];
  }

  return [
    {
      label: 'Sessions',
      value: analytics.sessions ?? null,
      change: analytics.sessionsChange ?? null,
      direction: getTrendDirection(analytics.sessionsChange ?? null),
    },
    {
      label: 'Conversions',
      value: analytics.conversions ?? null,
      change: analytics.conversionsChange ?? null,
      direction: getTrendDirection(analytics.conversionsChange ?? null),
    },
    {
      label: 'Clicks',
      value: analytics.clicks ?? null,
      change: analytics.ctrChange ?? null, // Using CTR change as proxy for search performance
      direction: getTrendDirection(analytics.ctrChange ?? null),
    },
  ];
}

function extractTopAttentionItem(
  diagnosticRuns: Record<string, DiagnosticRun[]>,
  strategySnapshot: CompanyStrategicSnapshot | null
): AttentionItem | null {
  // First check strategy snapshot for key gaps
  if (strategySnapshot?.keyGaps && strategySnapshot.keyGaps.length > 0) {
    return {
      title: strategySnapshot.keyGaps[0],
      severity: 'high',
      area: 'Strategy',
    };
  }

  // Check diagnostic runs for issues in rawJson
  for (const [toolId, runs] of Object.entries(diagnosticRuns)) {
    const latestRun = runs.find(r => r.status === 'complete' && r.rawJson);
    if (!latestRun?.rawJson) continue;

    const rawJson = latestRun.rawJson as any;

    // Try to extract issues from various formats
    const issues = rawJson.issues || rawJson.criticalIssues || rawJson.siteAssessment?.issues || [];
    if (Array.isArray(issues) && issues.length > 0) {
      const topIssue = issues[0];
      return {
        title: typeof topIssue === 'string' ? topIssue : topIssue.title || topIssue.issue || 'Issue found',
        severity: topIssue.severity === 'critical' ? 'critical' : topIssue.severity === 'high' ? 'high' : 'medium',
        area: toolId.replace('Lab', ''),
      };
    }
  }

  return null;
}

function extractNextActions(
  strategySnapshot: CompanyStrategicSnapshot | null,
  diagnosticRuns: Record<string, DiagnosticRun[]>
): NextAction[] {
  const actions: NextAction[] = [];

  // From strategy snapshot focus areas
  if (strategySnapshot?.focusAreas) {
    for (const area of strategySnapshot.focusAreas.slice(0, 2)) {
      actions.push({ title: area, area: 'Strategy' });
    }
  }

  // From GAP quick wins
  const gapRuns = [
    ...(diagnosticRuns.gapPlan || []),
    ...(diagnosticRuns.gapSnapshot || []),
  ];
  const latestGap = gapRuns.find(r => r.status === 'complete' && r.rawJson);

  if (latestGap?.rawJson && actions.length < 2) {
    const rawJson = latestGap.rawJson as any;
    const quickWins = rawJson.growthPlan?.quickWins || rawJson.quickWins || [];

    for (const win of quickWins.slice(0, 2 - actions.length)) {
      const title = typeof win === 'string' ? win : win.title || win.action || 'Quick win';
      if (!actions.find(a => a.title === title)) {
        actions.push({ title, area: win.category || 'Quick Win' });
      }
    }
  }

  return actions.slice(0, 2);
}

function extractMediaStatus(mediaLabSummary: MediaLabSummary | null): MediaStatus {
  if (!mediaLabSummary || mediaLabSummary.activePlanCount === 0) {
    return { hasProgram: false };
  }

  return {
    hasProgram: true,
    monthlySpend: mediaLabSummary.totalActiveBudget || null,
    status: mediaLabSummary.mediaStatus || undefined,
    // CPL and bestChannel would need to be calculated from performance data
    cpl: null,
    bestChannel: null,
    mediaScore: null,
  };
}

/**
 * Extract the most recent worked item for "Last Worked On" section
 */
function extractLastWorkedItem(workItems: WorkItemRecord[]): LastWorkedItem | null {
  // Priority: In Progress first, then Done, then by date
  const sortedItems = [...workItems].sort((a, b) => {
    // In Progress comes first
    if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
    if (b.status === 'In Progress' && a.status !== 'In Progress') return 1;

    // Then sort by last touched or updated date
    const dateA = a.lastTouchedAt || a.updatedAt || a.createdAt || '';
    const dateB = b.lastTouchedAt || b.updatedAt || b.createdAt || '';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const item = sortedItems[0];
  if (!item) return null;

  const date = item.lastTouchedAt || item.updatedAt || item.createdAt || null;

  return {
    id: item.id,
    title: item.title,
    status: item.status || 'Backlog',
    relativeDate: formatLastActivity(date),
    date,
    area: item.area,
  };
}

/**
 * Extract auto-tailored risk indicator
 * Priority: GBP > No GA4 > Low SEO > Low Ops
 */
function extractRiskIndicator(
  company: CompanyRecord,
  analytics: BlueprintAnalyticsSummary | null,
  dimensionScores: DimensionScore[]
): RiskIndicator | null {
  // Check for missing Google Business Profile (for local businesses)
  const isLocalBusiness = company.companyType === 'Local' || company.companyType === 'Services';
  // For now, we assume GBP check would come from ops-lab or a dedicated field
  // This is a placeholder - in a real implementation you'd check company fields

  // Check for no GA4 connected
  if (!company.ga4PropertyId && !company.ga4Linked) {
    return {
      key: 'no_ga4',
      title: 'No GA4 Analytics Connected',
      severity: 'high',
    };
  }

  // Check for low SEO score
  const seoScore = dimensionScores.find(d => d.key === 'seo')?.score;
  if (seoScore !== null && seoScore !== undefined && seoScore < 40) {
    return {
      key: 'low_seo',
      title: 'Critical Organic Visibility Issues',
      severity: 'critical',
    };
  }

  // Check for low ops score (missing analytics infrastructure)
  const opsScore = dimensionScores.find(d => d.key === 'ops')?.score;
  if (opsScore !== null && opsScore !== undefined && opsScore < 40) {
    return {
      key: 'low_ops',
      title: 'Missing Analytics Infrastructure',
      severity: 'high',
    };
  }

  // Check for very low website score
  const uxScore = dimensionScores.find(d => d.key === 'website')?.score;
  if (uxScore !== null && uxScore !== undefined && uxScore < 30) {
    return {
      key: 'low_ux',
      title: 'Critical Website UX Issues',
      severity: 'critical',
    };
  }

  return null;
}

/**
 * Extract next actions with work item links
 */
function extractNextActionsWithWork(
  strategySnapshot: CompanyStrategicSnapshot | null,
  diagnosticRuns: Record<string, DiagnosticRun[]>,
  workItems: WorkItemRecord[]
): { actions: NextAction[]; total: number } {
  const actions: NextAction[] = [];
  let totalCount = 0;

  // First, add in-progress work items
  const inProgressItems = workItems.filter(w => w.status === 'In Progress');
  for (const item of inProgressItems.slice(0, 2)) {
    actions.push({
      title: item.title,
      area: item.area || 'Work',
      workItemId: item.id,
    });
  }
  totalCount += inProgressItems.length;

  // From strategy snapshot focus areas
  if (strategySnapshot?.focusAreas && actions.length < 2) {
    for (const area of strategySnapshot.focusAreas.slice(0, 2 - actions.length)) {
      actions.push({ title: area, area: 'Strategy' });
      totalCount++;
    }
  }

  // From GAP quick wins
  const gapRuns = [
    ...(diagnosticRuns.gapPlan || []),
    ...(diagnosticRuns.gapSnapshot || []),
  ];
  const latestGap = gapRuns.find(r => r.status === 'complete' && r.rawJson);

  if (latestGap?.rawJson && actions.length < 2) {
    const rawJson = latestGap.rawJson as any;
    const quickWins = rawJson.growthPlan?.quickWins || rawJson.quickWins || [];

    for (const win of quickWins.slice(0, 2 - actions.length)) {
      const title = typeof win === 'string' ? win : win.title || win.action || 'Quick win';
      if (!actions.find(a => a.title === title)) {
        actions.push({ title, area: win.category || 'Quick Win' });
        totalCount++;
      }
    }
  }

  // Add backlog work items to total count
  totalCount += workItems.filter(w => w.status === 'Backlog' || w.status === 'Planned').length;

  return { actions: actions.slice(0, 2), total: totalCount };
}

// ============================================================================
// Main Function
// ============================================================================

export async function getCompanyCardData(
  companyId: string,
  pinnedIds: string[] = []
): Promise<CompanyCardData | null> {
  try {
    // Fetch all data in parallel
    const [
      company,
      strategySnapshot,
      diagnosticRuns,
      analyticsResult,
      mediaLabSummary,
      workItems,
    ] = await Promise.all([
      getCompanyById(companyId),
      getCompanyStrategySnapshot(companyId).catch(() => null),
      getRunsGroupedByTool(companyId).catch(() => ({} as Record<string, DiagnosticRun[]>)),
      fetchBlueprintAnalytics(companyId, { preset: '7d' }).catch(() => ({ ok: false, summary: null })),
      getMediaLabSummary(companyId).catch(() => null),
      getWorkItemsForCompany(companyId).catch(() => [] as WorkItemRecord[]),
    ]);

    if (!company) return null;

    const stage = mapStage(company.stage);
    const analytics = analyticsResult.summary;

    // Get latest GAP score
    const gapRuns = [
      ...(diagnosticRuns.gapPlan || []),
      ...(diagnosticRuns.gapSnapshot || []),
      ...(diagnosticRuns.gapHeavy || []),
    ];
    const latestGapRun = gapRuns.find(r => r.status === 'complete');
    const overallScore = latestGapRun?.score ?? strategySnapshot?.overallScore ?? null;

    // Build activity snapshot for health evaluation
    const lastDiagnosticDate = Object.values(diagnosticRuns)
      .flat()
      .filter(r => r.status === 'complete')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.updatedAt || null;

    // Get last work activity date
    const lastWorkDate = workItems[0]?.lastTouchedAt || workItems[0]?.updatedAt || workItems[0]?.createdAt || null;

    const activitySnapshot: CompanyActivitySnapshot = {
      lastGapAssessmentAt: latestGapRun?.createdAt || null,
      lastGapPlanAt: diagnosticRuns.gapPlan?.find(r => r.status === 'complete')?.createdAt || null,
      lastDiagnosticAt: lastDiagnosticDate,
      lastWorkActivityAt: lastWorkDate,
      lastAnyActivityAt: lastDiagnosticDate || lastWorkDate,
    };

    const openWorkCount = workItems.filter(w => w.status !== 'Done').length;

    const { health, reasons: healthReasons } = evaluateCompanyHealth({
      stage: stage as any,
      activity: activitySnapshot,
      latestGapScore: overallScore,
      hasOverdueWork: false,
      hasBacklogWork: openWorkCount > 0,
      healthOverride: company.healthOverride,
      atRiskFlag: company.atRiskFlag,
    });

    // Extract all card data
    const dimensionScores = extractDimensionScores(diagnosticRuns, strategySnapshot);
    const trendMetrics = extractTrendMetrics(analytics);
    const topAttentionItem = extractTopAttentionItem(diagnosticRuns, strategySnapshot);
    const { actions: nextActions, total: totalActionCount } = extractNextActionsWithWork(strategySnapshot, diagnosticRuns, workItems);
    const media = extractMediaStatus(mediaLabSummary);
    const lastWorkedItem = extractLastWorkedItem(workItems);
    const riskIndicator = extractRiskIndicator(company, analytics, dimensionScores);

    // Extract data confidence from GAP run
    let dataConfidence: 'low' | 'medium' | 'high' | null = null;
    if (latestGapRun?.rawJson) {
      const rawJson = latestGapRun.rawJson as any;
      const confidence = rawJson.dataConfidence?.level ||
        rawJson.growthPlan?.dataConfidenceScore?.level ||
        rawJson.dataConfidenceScore?.level;
      if (confidence && ['low', 'medium', 'high'].includes(confidence)) {
        dataConfidence = confidence;
      }
    }

    // Determine if analytics is connected
    const hasAnalyticsConnected = !!(company.ga4PropertyId || company.ga4Linked || analytics?.hasGa4);

    return {
      // Core info
      id: company.id,
      name: company.name,
      domain: company.domain || null,
      website: company.website || null,
      stage,
      tier: company.tier || null,
      faviconUrl: getFaviconUrl(company.domain),
      companyType: company.companyType || null,

      // Health & Risk
      health,
      healthReasons,
      riskLevel: getRiskLevel(health, overallScore),
      riskIndicator,

      // Scores
      overallScore,
      dataConfidence,
      maturityStage: strategySnapshot?.maturityStage || null,
      dimensionScores,

      // Analytics Pulse
      trendMetrics,
      hasAnalyticsConnected,

      // Last Worked On
      lastWorkedItem,

      // Attention & Actions
      topAttentionItem,
      nextActions,
      totalActionCount,

      // Media
      media,

      // Activity Context
      lastActivityLabel: formatLastActivity(lastDiagnosticDate || lastWorkDate),
      lastActivityDate: lastDiagnosticDate || lastWorkDate,
      openWorkCount,

      // Pinning
      isPinned: pinnedIds.includes(companyId),
    };
  } catch (error) {
    console.error('[getCompanyCardData] Error for company:', companyId, error);
    return null;
  }
}

/**
 * Batch fetch card data for multiple companies
 */
export async function getCompanyCardsData(
  companyIds: string[],
  pinnedIds: string[] = []
): Promise<CompanyCardData[]> {
  const results = await Promise.all(
    companyIds.map(id => getCompanyCardData(id, pinnedIds))
  );
  return results.filter((r): r is CompanyCardData => r !== null);
}
