// lib/brain/buildBrainSummary.ts
// Builder function for BrainSummary - aggregates context health, labs, and insights
//
// Used by QBR Story and Blueprint to consume Brain outputs in a standardized way.

import type {
  BrainSummary,
  BrainDomainHealth,
  BrainContextDelta,
  BrainLabSummary,
  BrainInsightsSummary,
  BrainInsightItem,
  LabStatus,
  InsightSeverity,
} from './summaryTypes';
import { computeContextHealthScore, type ContextHealthScore, type SectionScore } from '@/lib/contextGraph/health';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getSnapshotById, listSnapshotSummaries } from '@/lib/contextGraph/history';
import { diffGraphs, type GraphDiffItem } from '@/lib/contextGraph/uiHelpers';
import { listDiagnosticRunsForCompany, getToolLabel, type DiagnosticRun, type DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { queryInsights, getInsightStatistics } from '@/lib/insights/engine';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Domain Label Mapping
// ============================================================================

const DOMAIN_LABELS: Record<string, string> = {
  identity: 'Identity',
  audience: 'Audience',
  brand: 'Brand',
  website: 'Website',
  media: 'Media',
  creative: 'Creative',
  objectives: 'Objectives',
  constraints: 'Budget & Constraints',
  productOffer: 'Product/Offer',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  competitive: 'Competitive',
  historical: 'Historical',
  storeRisk: 'Store Risk',
};

// ============================================================================
// Lab Configuration
// ============================================================================

interface LabConfig {
  id: string;
  toolId: DiagnosticToolId;
  label: string;
  enrichesDomains: string[];
  href: (companyId: string) => string;
  staleThresholdDays: number;
}

const LAB_CONFIGS: LabConfig[] = [
  {
    id: 'competition',
    toolId: 'competitionLab',
    label: 'Competition Lab',
    enrichesDomains: ['competitive'],
    href: (companyId) => `/c/${companyId}/brain/labs/competition`,
    staleThresholdDays: 30,
  },
  {
    id: 'creative',
    toolId: 'creativeLab',
    label: 'Creative Lab',
    enrichesDomains: ['creative', 'brand'],
    href: (companyId) => `/c/${companyId}/labs/creative`,
    staleThresholdDays: 30,
  },
  {
    id: 'website',
    toolId: 'websiteLab',
    label: 'Website Lab',
    enrichesDomains: ['website'],
    href: (companyId) => `/c/${companyId}/brain/labs/website`,
    staleThresholdDays: 60,
  },
  {
    id: 'brand',
    toolId: 'brandLab',
    label: 'Brand Lab',
    enrichesDomains: ['brand', 'identity'],
    href: (companyId) => `/c/${companyId}/brain/labs/brand`,
    staleThresholdDays: 60,
  },
  {
    id: 'audience',
    toolId: 'audienceLab',
    label: 'Audience Lab',
    enrichesDomains: ['audience'],
    href: (companyId) => `/c/${companyId}/brain/labs/audience`,
    staleThresholdDays: 60,
  },
  {
    id: 'seo',
    toolId: 'seoLab',
    label: 'SEO Lab',
    enrichesDomains: ['seo', 'content'],
    href: (companyId) => `/c/${companyId}/diagnostics/seo`,
    staleThresholdDays: 30,
  },
];

// ============================================================================
// Main Builder
// ============================================================================

export interface BuildBrainSummaryArgs {
  companyId: string;
  /** Snapshot ID (default: "current" for live context) */
  snapshotId?: string;
  /** Compare to a previous snapshot for deltas (optional) */
  compareToSnapshotId?: string;
}

export async function buildBrainSummary(args: BuildBrainSummaryArgs): Promise<BrainSummary> {
  const { companyId, snapshotId = 'current', compareToSnapshotId } = args;

  // Load all data in parallel
  const [healthScore, diagnosticRuns, insights, insightStats] = await Promise.all([
    computeContextHealthScore(companyId),
    listDiagnosticRunsForCompany(companyId, { limit: 100 }).catch(() => [] as DiagnosticRun[]),
    queryInsights(companyId, { limit: 20 }).catch(() => [] as ClientInsight[]),
    getInsightStatistics(companyId).catch(() => ({ total: 0, byStatus: {} })),
  ]);

  // 1) Build domain health from section scores
  const domains = await loadDomainHealth(healthScore);

  // 2) Build context deltas if comparing snapshots
  const contextDeltas = await loadContextDeltas(companyId, snapshotId, compareToSnapshotId);

  // 3) Build lab summaries from diagnostic runs
  const labs = buildLabSummaries(companyId, diagnosticRuns);

  // 4) Build insights summary
  const insightsSummary = buildInsightsSummary(insights, insightStats);

  // 5) Compute data confidence score
  const dataConfidenceScore = computeDataConfidenceScore(healthScore, domains);

  return {
    companyId,
    snapshotId,
    dataConfidenceScore,
    domains,
    contextDeltas,
    labs,
    insights: insightsSummary,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Domain Health Loader
// ============================================================================

async function loadDomainHealth(healthScore: ContextHealthScore): Promise<BrainDomainHealth[]> {
  const domains: BrainDomainHealth[] = [];

  for (const sectionScore of healthScore.sectionScores) {
    // Map section to domain
    const domainId = sectionScore.section;
    const label = DOMAIN_LABELS[domainId] || sectionScore.label;

    // Calculate domain-level health score (weighted)
    const healthScoreValue = Math.round(
      sectionScore.criticalCoverage * 0.4 +
      sectionScore.completeness * 0.3 +
      sectionScore.freshness * 0.3
    );

    // Count issues
    const missingFields = sectionScore.totalFields - sectionScore.populatedFields;
    const lowConfidenceFields = Math.round(sectionScore.totalFields * 0.1); // Estimate
    const conflictedFields = 0; // Would need provenance analysis

    domains.push({
      id: domainId,
      label,
      healthScore: healthScoreValue,
      completion: sectionScore.completeness,
      freshness: sectionScore.freshness,
      conflictedFields,
      lowConfidenceFields,
      missingFields,
    });
  }

  // Sort by health score ascending (worst first)
  domains.sort((a, b) => a.healthScore - b.healthScore);

  return domains;
}

// ============================================================================
// Context Deltas Loader
// ============================================================================

async function loadContextDeltas(
  companyId: string,
  snapshotId: string,
  compareToSnapshotId?: string
): Promise<BrainContextDelta[]> {
  // If no comparison snapshot, return empty
  if (!compareToSnapshotId || snapshotId === 'current') {
    // Try to compare current to most recent snapshot
    try {
      const summaries = await listSnapshotSummaries(companyId);
      if (summaries.length < 1) return [];

      const currentGraph = await loadContextGraph(companyId);
      if (!currentGraph) return [];

      const previousSnapshot = await getSnapshotById(summaries[0].versionId);
      if (!previousSnapshot?.graph) return [];

      const diffs = diffGraphs(previousSnapshot.graph, currentGraph);
      return mapDiffsToDeltas(diffs);
    } catch (e) {
      console.warn('[buildBrainSummary] Could not compute deltas:', e);
      return [];
    }
  }

  // Compare two specific snapshots
  try {
    const [currentSnapshot, previousSnapshot] = await Promise.all([
      snapshotId === 'current'
        ? loadContextGraph(companyId)
        : getSnapshotById(snapshotId).then(s => s?.graph),
      getSnapshotById(compareToSnapshotId).then(s => s?.graph),
    ]);

    if (!currentSnapshot || !previousSnapshot) return [];

    const diffs = diffGraphs(previousSnapshot, currentSnapshot);
    return mapDiffsToDeltas(diffs);
  } catch (e) {
    console.warn('[buildBrainSummary] Could not compute deltas:', e);
    return [];
  }
}

function mapDiffsToDeltas(diffs: GraphDiffItem[]): BrainContextDelta[] {
  return diffs.slice(0, 20).map((diff, index) => {
    // Determine change type
    let changeType: BrainContextDelta['changeType'] = 'updated';
    if (diff.before === null && diff.after !== null) changeType = 'added';
    else if (diff.before !== null && diff.after === null) changeType = 'removed';

    // Estimate importance based on domain
    const criticalDomains = ['identity', 'audience', 'objectives', 'competitive'];
    const importance = criticalDomains.includes(diff.domain) ? 4 : 2;

    // Generate summary
    let summary = '';
    if (changeType === 'added') {
      summary = `Added: ${truncate(diff.after || '', 50)}`;
    } else if (changeType === 'removed') {
      summary = `Removed: ${truncate(diff.before || '', 50)}`;
    } else {
      summary = `Changed from "${truncate(diff.before || '', 25)}" to "${truncate(diff.after || '', 25)}"`;
    }

    return {
      id: `delta-${index}-${diff.path}`,
      label: diff.label,
      domainId: diff.domain,
      changeType,
      importance,
      summary,
    };
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ============================================================================
// Lab Summaries Builder
// ============================================================================

function buildLabSummaries(companyId: string, runs: DiagnosticRun[]): BrainLabSummary[] {
  const labs: BrainLabSummary[] = [];
  const now = new Date();

  for (const config of LAB_CONFIGS) {
    // Find most recent run for this lab
    const latestRun = runs
      .filter(r => r.toolId === config.toolId && r.status === 'complete')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    let status: LabStatus = 'not_run';
    let lastRunAt: string | undefined;
    let notes: string | undefined;

    if (latestRun) {
      lastRunAt = latestRun.createdAt;
      const runDate = new Date(latestRun.createdAt);
      const daysSinceRun = Math.floor((now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));

      status = daysSinceRun <= config.staleThresholdDays ? 'fresh' : 'stale';
      notes = latestRun.summary || undefined;
    }

    labs.push({
      id: config.id,
      label: config.label,
      lastRunAt,
      status,
      enrichesDomains: config.enrichesDomains,
      notes,
      href: config.href(companyId),
    });
  }

  return labs;
}

// ============================================================================
// Insights Summary Builder
// ============================================================================

function buildInsightsSummary(
  insights: ClientInsight[],
  stats: { total: number; byStatus?: Record<string, number> }
): BrainInsightsSummary {
  // Count by severity
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const insight of insights) {
    const severity = mapSeverityToInsightSeverity(insight.severity);
    if (severity === 'critical') criticalCount++;
    else if (severity === 'warning') warningCount++;
    else infoCount++;
  }

  // Build top insights
  const topInsights: BrainInsightItem[] = insights.slice(0, 5).map(insight => ({
    id: insight.id,
    title: insight.title,
    severity: mapSeverityToInsightSeverity(insight.severity),
    domainId: mapCategoryToDomain(insight.category),
    description: insight.body, // ClientInsight uses 'body', not 'description'
  }));

  return {
    totalInsights: stats.total || insights.length,
    criticalCount,
    warningCount,
    infoCount,
    topInsights,
  };
}

function mapSeverityToInsightSeverity(severity?: string): InsightSeverity {
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'medium' || severity === 'warning') return 'warning';
  return 'info';
}

function mapCategoryToDomain(category: string): string | undefined {
  const mapping: Record<string, string> = {
    competitive_threat: 'competitive',
    competitive_opportunity: 'competitive',
    market_positioning: 'competitive',
    audience_insight: 'audience',
    brand_perception: 'brand',
    content_gap: 'content',
    website_issue: 'website',
    seo_opportunity: 'seo',
    creative_insight: 'creative',
  };
  return mapping[category];
}

// ============================================================================
// Data Confidence Score
// ============================================================================

function computeDataConfidenceScore(
  healthScore: ContextHealthScore,
  domains: BrainDomainHealth[]
): number {
  // Base from overall health score
  let score = healthScore.overallScore;

  // Penalize for weak critical domains
  const criticalDomains = ['identity', 'audience', 'objectives'];
  for (const domainId of criticalDomains) {
    const domain = domains.find(d => d.id === domainId);
    if (domain && domain.healthScore < 50) {
      score -= 5; // Penalty for each weak critical domain
    }
  }

  // Penalize for high conflict/low confidence
  const totalConflicts = domains.reduce((sum, d) => sum + d.conflictedFields, 0);
  const totalLowConfidence = domains.reduce((sum, d) => sum + d.lowConfidenceFields, 0);

  if (totalConflicts > 5) score -= 5;
  if (totalLowConfidence > 10) score -= 5;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// Exports
// ============================================================================

export { type BrainSummary } from './summaryTypes';
