// lib/qbr/qbrOrchestrator.ts
// QBR Story Orchestrator
//
// Coordinates data gathering from multiple sources and AI narrative generation
// for the QBR Story View.

import {
  QbrStory,
  QbrDomain,
  DomainBundle,
  DomainBundleRoot,
  GlobalSummary,
  GlobalContextSummary,
  ContextIntegritySummary,
  ContextIntegrityItem,
  QBR_DOMAINS,
  domainToTitle,
  domainToStrategicRole,
  getQuarterDateRange,
  getCurrentQuarter,
  GraphDeltaItem,
  InsightItem,
  DomainKpiMetric,
  DomainWorkItem,
} from './qbrTypes';
import { loadQbrStory, saveQbrStory, updateQbrStoryBlocks } from './qbrStore';
import { generateNarrativeWithAi } from './qbrNarrativeAi';
import {
  createContextSnapshots,
  groupSnapshotsByDomain,
  getCriticalIdentityFields,
  type ContextFieldSnapshot,
} from './contextSnapshots';
import {
  computeDeltasFromCurrentState,
  groupDeltasByDomain,
  getFieldLabel,
} from './contextDeltas';

// Data source imports
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { listContextGraphVersions } from '@/lib/contextGraph/history';
import { getCompanyInsights } from '@/lib/airtable/clientBrain';
import { getWorkItems } from '@/lib/work/workItems';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { ContextGraphVersion } from '@/lib/contextGraph/history';
import type { ClientInsight } from '@/lib/types/clientBrain';
import type { WorkItem } from '@/lib/types/work';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Public API
// ============================================================================

/**
 * Get an existing QBR story (or null if none exists)
 */
export async function getQbrStory(args: {
  companyId: string;
  quarter: string;
}): Promise<QbrStory | null> {
  return loadQbrStory(args.companyId, args.quarter);
}

/**
 * Generate a new QBR story from all available data sources
 */
export async function generateQbrStory(args: {
  companyId: string;
  quarter: string;
  userId: string;
}): Promise<QbrStory> {
  const { companyId, quarter, userId } = args;

  console.log(`[QbrOrchestrator] Generating story for ${companyId}/${quarter}`);

  // Gather data from all sources
  const [contextGraph, versions, insights, workItems, diagnosticRuns] = await Promise.all([
    loadContextGraph(companyId),
    listContextGraphVersions(companyId, 20),
    getCompanyInsights(companyId, { limit: 100 }),
    getWorkItems(companyId),
    listDiagnosticRunsForCompany(companyId),
  ]);

  // Create context snapshots for integrity analysis
  const contextSnapshots = createContextSnapshots(contextGraph);

  // Build domain bundle for AI
  const domainBundle = buildDomainBundle({
    companyId,
    quarter,
    contextGraph,
    versions,
    insights,
    workItems,
    diagnosticRuns,
  });

  // Compute data confidence score with context integrity
  const dataConfidenceScore = computeDataConfidenceScore({
    contextGraph,
    versions,
    insights,
    workItems,
    diagnosticRuns,
    contextSnapshots,
  });

  console.log(`[QbrOrchestrator] Data confidence: ${dataConfidenceScore}%`);

  // Generate narrative with AI
  const draftStory = await generateNarrativeWithAi({
    companyId,
    quarter,
    domainBundle,
    dataConfidenceScore,
  });

  // Save the story
  const savedStory = await saveQbrStory({
    story: draftStory,
    generatedBy: 'ai',
    userId,
  });

  console.log(`[QbrOrchestrator] Story generated and saved for ${companyId}/${quarter}`);

  return savedStory;
}

/**
 * Regenerate parts of a QBR story
 */
export async function regenerateQbrStory(args: {
  companyId: string;
  quarter: string;
  mode: 'full_rewrite' | 'clarity' | 'shorter' | 'longer';
  domain?: QbrDomain | 'all';
  userId: string;
}): Promise<QbrStory> {
  const { companyId, quarter, mode, domain, userId } = args;

  console.log(`[QbrOrchestrator] Regenerating story: ${companyId}/${quarter} (${mode}, domain: ${domain || 'all'})`);

  const existing = await loadQbrStory(companyId, quarter);
  if (!existing) {
    throw new Error('No QBR story exists yet. Generate one first.');
  }

  // For full rewrite, rebuild the domain bundle
  const domainBundle = await rebuildDomainBundleForRegeneration(
    companyId,
    quarter,
    domain
  );

  // Generate updated narrative
  const updatedStory = await generateNarrativeWithAi({
    companyId,
    quarter,
    domainBundle,
    dataConfidenceScore: existing.meta.dataConfidenceScore,
    existingStory: existing,
    regenerationMode: mode,
    targetDomain: domain,
  });

  // Save the updated story
  const saved = await updateQbrStoryBlocks({
    story: updatedStory,
    userId,
    regenerationMode: mode,
    targetDomain: domain,
  });

  console.log(`[QbrOrchestrator] Story regenerated for ${companyId}/${quarter}`);

  return saved;
}

// ============================================================================
// Domain Bundle Building
// ============================================================================

interface BuildDomainBundleArgs {
  companyId: string;
  quarter: string;
  contextGraph: CompanyContextGraph | null;
  versions: ContextGraphVersion[];
  insights: ClientInsight[];
  workItems: WorkItem[];
  diagnosticRuns: DiagnosticRun[];
}

function buildDomainBundle(args: BuildDomainBundleArgs): DomainBundleRoot {
  const { companyId, quarter, contextGraph, versions, insights, workItems, diagnosticRuns } = args;

  const { start: quarterStart, end: quarterEnd } = getQuarterDateRange(quarter);

  // Filter data to quarter
  const quarterInsights = insights.filter((i) => {
    const date = new Date(i.createdAt);
    return date >= quarterStart && date <= quarterEnd;
  });

  const quarterWorkItems = workItems.filter((w) => {
    // Work items don't have reliable date filtering, include all recent ones
    return true;
  });

  const quarterRuns = diagnosticRuns.filter((r) => {
    const date = new Date(r.createdAt);
    return date >= quarterStart && date <= quarterEnd;
  });

  // Compute context deltas from versions
  const contextDeltas = computeContextDeltas(versions, quarterStart, quarterEnd);

  // Create context snapshots for integrity analysis
  const contextSnapshots = createContextSnapshots(contextGraph);
  const snapshotsByDomain = groupSnapshotsByDomain(contextSnapshots);

  // Compute global context summary
  const globalContextSummary = computeGlobalContextSummary(contextSnapshots);

  // Build global summary with context integrity
  const global = buildGlobalSummary(quarterInsights, contextGraph, globalContextSummary);

  // Build per-domain bundles with context integrity
  const domains = QBR_DOMAINS.map((domain) =>
    buildSingleDomainBundle(
      domain,
      contextGraph,
      contextDeltas,
      quarterInsights,
      quarterWorkItems,
      quarterRuns,
      snapshotsByDomain.get(domain) || []
    )
  );

  return { global, domains };
}

/**
 * Compute global context integrity summary across all domains
 */
function computeGlobalContextSummary(
  snapshots: ContextFieldSnapshot[]
): GlobalContextSummary {
  return {
    totalConflicted: snapshots.filter(s => s.status === 'conflicted').length,
    totalOverrides: snapshots.filter(s => s.isHumanOverride).length,
    totalStale: snapshots.filter(s => s.freshness < 60).length,
    totalLowConfidence: snapshots.filter(s => s.confidence < 70).length,
  };
}

/**
 * Compute context integrity summary for a domain
 */
function computeDomainContextIntegrity(
  snapshots: ContextFieldSnapshot[]
): ContextIntegritySummary {
  const conflicted = snapshots.filter(s => s.status === 'conflicted');
  const overrides = snapshots.filter(s => s.isHumanOverride);
  const stale = snapshots.filter(s => s.freshness < 60);
  const lowConfidence = snapshots.filter(s => s.confidence < 70);

  // Combine all problematic fields
  const problematicSet = new Set<string>();
  const problematicFields: ContextIntegrityItem[] = [];

  for (const snapshot of [...conflicted, ...overrides, ...stale, ...lowConfidence]) {
    if (!problematicSet.has(snapshot.key)) {
      problematicSet.add(snapshot.key);
      problematicFields.push({
        key: snapshot.key,
        label: getFieldLabel(snapshot.key),
        status: snapshot.status,
        confidence: snapshot.confidence,
        freshness: snapshot.freshness,
        isHumanOverride: snapshot.isHumanOverride,
      });
    }
  }

  return {
    conflicted: conflicted.length,
    overrides: overrides.length,
    stale: stale.length,
    lowConfidence: lowConfidence.length,
    problematicFields,
  };
}

function buildGlobalSummary(
  insights: ClientInsight[],
  contextGraph: CompanyContextGraph | null,
  globalContextSummary?: GlobalContextSummary
): GlobalSummary {
  // Extract top wins (insights with positive sentiment or high severity marked as opportunities)
  const wins = insights
    .filter((i) =>
      i.category === 'growth_opportunity' ||
      i.category === 'audience' ||
      (i.severity === 'high' && i.status === 'resolved')
    )
    .slice(0, 5)
    .map((i) => i.title);

  // Extract top risks (critical/high severity issues)
  const risks = insights
    .filter((i) =>
      (i.severity === 'critical' || i.severity === 'high') &&
      i.status !== 'resolved' &&
      i.status !== 'dismissed'
    )
    .slice(0, 5)
    .map((i) => i.title);

  return {
    topWins: wins,
    topRisks: risks,
    headlineMetrics: [], // TODO: Wire to real KPI data when available
    globalContextSummary,
  };
}

function buildSingleDomainBundle(
  domain: QbrDomain,
  contextGraph: CompanyContextGraph | null,
  contextDeltas: Map<string, GraphDeltaItem[]>,
  insights: ClientInsight[],
  workItems: WorkItem[],
  diagnosticRuns: DiagnosticRun[],
  domainSnapshots: ContextFieldSnapshot[]
): DomainBundle {
  // Map QBR domains to context graph domains and insight categories
  const domainMappings: Record<QbrDomain, {
    contextDomains: string[];
    insightCategories: string[];
    toolIds: string[];
    workAreas: string[];
  }> = {
    strategy: {
      contextDomains: ['objectives', 'identity'],
      insightCategories: ['strategy', 'growth_opportunity'],
      toolIds: ['gapSnapshot', 'gapPlan', 'gapHeavy'],
      workAreas: ['Strategy'],
    },
    website: {
      contextDomains: ['website', 'digitalInfra'],
      insightCategories: ['conversion', 'ux'],
      toolIds: ['websiteLab'],
      workAreas: ['Website UX'],
    },
    seo: {
      contextDomains: ['seo'],
      insightCategories: ['seo', 'visibility'],
      toolIds: ['seoLab'],
      workAreas: ['SEO'],
    },
    content: {
      contextDomains: ['content', 'creative'],
      insightCategories: ['content', 'messaging'],
      toolIds: ['contentLab', 'creativeLab'],
      workAreas: ['Content'],
    },
    brand: {
      contextDomains: ['brand'],
      insightCategories: ['brand', 'trust'],
      toolIds: ['brandLab'],
      workAreas: ['Brand'],
    },
    audience: {
      contextDomains: ['audience'],
      insightCategories: ['audience', 'persona'],
      toolIds: ['audienceLab'],
      workAreas: ['Funnel'],
    },
    media: {
      contextDomains: ['performanceMedia', 'budgetOps'],
      insightCategories: ['media', 'ads', 'demand'],
      toolIds: ['mediaLab', 'demandLab'],
      workAreas: ['Strategy'],
    },
    analytics: {
      contextDomains: ['ops', 'historical'],
      insightCategories: ['analytics', 'measurement'],
      toolIds: ['opsLab'],
      workAreas: ['Other'],
    },
    competitive: {
      contextDomains: ['competitive'],
      insightCategories: ['competitive', 'competitor', 'threat', 'positioning'],
      toolIds: ['competitorLab', 'competitionLab'],
      workAreas: ['Strategy'],
    },
  };

  const mapping = domainMappings[domain];

  // Filter insights for this domain
  const domainInsights = insights
    .filter((i) => mapping.insightCategories.some((cat) => i.category?.includes(cat)))
    .slice(0, 6)
    .map((i): InsightItem => ({
      id: i.id,
      title: i.title,
      summary: i.body?.slice(0, 200) || '',
      severity: i.severity as 'low' | 'medium' | 'high' | undefined,
      impactArea: domain,
      whyItMatters: i.rationale || '',
    }));

  // Filter work items for this domain
  const domainWorkItems = workItems
    .filter((w) => mapping.workAreas.some((area) => w.area?.includes(area)))
    .slice(0, 5)
    .map((w): DomainWorkItem => ({
      id: w.id,
      title: w.title,
      status: w.status === 'Done' ? 'done' : w.status === 'In Progress' ? 'in_progress' : 'planned',
    }));

  // Filter diagnostic runs for this domain
  const domainRuns = diagnosticRuns
    .filter((r) => mapping.toolIds.includes(r.toolId))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      toolSlug: r.toolId,
      completedAt: r.updatedAt,
      summary: r.summary || undefined,
    }));

  // Get context deltas for this domain
  const domainDeltas: GraphDeltaItem[] = [];
  for (const contextDomain of mapping.contextDomains) {
    const deltas = contextDeltas.get(contextDomain) || [];
    domainDeltas.push(...deltas);
  }

  // Calculate completed vs created work items
  const completedCount = domainWorkItems.filter((w) => w.status === 'done').length;
  const createdCount = domainWorkItems.length;

  // Compute context integrity for this domain
  const contextIntegrity = computeDomainContextIntegrity(domainSnapshots);

  return {
    domain,
    strategicRole: domainToStrategicRole(domain),
    scoreBefore: undefined, // TODO: Wire to real score data
    scoreAfter: undefined,
    contextDeltas: domainDeltas,
    topInsights: domainInsights,
    kpiSummary: {
      keyMetrics: [], // TODO: Wire to real KPI data
    },
    workSummary: {
      completed: completedCount,
      created: createdCount,
      keyWorkItems: domainWorkItems,
    },
    gapAndLabsSummary: {
      runs: domainRuns,
    },
    contextIntegrity,
  };
}

// ============================================================================
// Context Delta Computation
// ============================================================================

function computeContextDeltas(
  versions: ContextGraphVersion[],
  quarterStart: Date,
  quarterEnd: Date
): Map<string, GraphDeltaItem[]> {
  const deltas = new Map<string, GraphDeltaItem[]>();

  // Filter versions to this quarter
  const quarterVersions = versions.filter((v) => {
    const date = new Date(v.versionAt);
    return date >= quarterStart && date <= quarterEnd;
  });

  if (quarterVersions.length < 2) {
    // Not enough data for meaningful deltas
    return deltas;
  }

  // Sort by date (oldest first)
  const sorted = [...quarterVersions].sort(
    (a, b) => new Date(a.versionAt).getTime() - new Date(b.versionAt).getTime()
  );

  const firstVersion = sorted[0];
  const lastVersion = sorted[sorted.length - 1];

  // Compare completeness scores between first and last
  const firstScore = firstVersion.completenessScore || 0;
  const lastScore = lastVersion.completenessScore || 0;

  // Create a simple delta for the overall graph
  if (firstScore !== lastScore) {
    deltas.set('overall', [{
      nodeId: 'completeness',
      label: 'Context Completeness',
      category: 'overall',
      changeType: lastScore > firstScore ? 'strengthened' : 'weakened',
      beforeScore: firstScore,
      afterScore: lastScore,
      delta: lastScore - firstScore,
      comment: `Graph completeness ${lastScore > firstScore ? 'improved' : 'decreased'} from ${firstScore}% to ${lastScore}%`,
    }]);
  }

  // TODO: Implement more detailed per-domain delta computation
  // by comparing graph.identity, graph.brand, etc. between versions

  return deltas;
}

// ============================================================================
// Data Confidence Score
// ============================================================================

interface ConfidenceInputs {
  contextGraph: CompanyContextGraph | null;
  versions: ContextGraphVersion[];
  insights: ClientInsight[];
  workItems: WorkItem[];
  diagnosticRuns: DiagnosticRun[];
  contextSnapshots?: ContextFieldSnapshot[];
}

/**
 * Compute data confidence score based on Context Graph integrity.
 *
 * NEW RULES:
 * - Start at base 70
 * - Subtract penalties for conflicts, stale fields, low confidence
 * - Add bonuses for fresh, high-quality data
 */
function computeDataConfidenceScore(inputs: ConfidenceInputs): number {
  const { contextGraph, contextSnapshots = [] } = inputs;

  // Start at base 70
  let score = 70;

  // If no context graph, apply heavy penalty
  if (!contextGraph) {
    return 20;
  }

  // Analyze snapshots if available
  if (contextSnapshots.length > 0) {
    // Count problematic fields
    const conflictedFields = contextSnapshots.filter(s => s.status === 'conflicted');
    const staleFields = contextSnapshots.filter(s => s.freshness < 60);
    const lowConfidenceFields = contextSnapshots.filter(s => s.confidence < 70);
    const humanOverrides = contextSnapshots.filter(s => s.isHumanOverride);

    // Check critical identity fields for conflicts
    const criticalFields = getCriticalIdentityFields();
    const criticalConflicts = conflictedFields.filter(f =>
      criticalFields.some(cf => f.key.startsWith(cf))
    );

    // Subtract penalties
    // -3 points for each conflicted field (max -20)
    score -= Math.min(20, conflictedFields.length * 3);

    // -2 points for each stale field (max -15)
    score -= Math.min(15, staleFields.length * 2);

    // -1 to -5 points if many fields have low confidence
    if (lowConfidenceFields.length > 10) {
      score -= 5;
    } else if (lowConfidenceFields.length > 5) {
      score -= 3;
    } else if (lowConfidenceFields.length > 0) {
      score -= 1;
    }

    // -5 points if any critical identity fields are conflicted
    if (criticalConflicts.length > 0) {
      score -= 5;
    }

    // -5 points if more than 3 human overrides this quarter
    if (humanOverrides.length > 3) {
      score -= 5;
    }

    // Add bonuses for fresh data
    const veryFreshFields = contextSnapshots.filter(s => s.freshness > 85);
    const freshnessRatio = veryFreshFields.length / contextSnapshots.length;

    // Up to +10 if most fields are very fresh
    if (freshnessRatio > 0.8) {
      score += 10;
    } else if (freshnessRatio > 0.6) {
      score += 7;
    } else if (freshnessRatio > 0.4) {
      score += 4;
    }
  } else {
    // Fallback to completeness-based score if no snapshots
    const completeness = contextGraph.meta?.completenessScore || 0;
    if (completeness < 30) {
      score -= 20;
    } else if (completeness < 50) {
      score -= 10;
    } else if (completeness > 80) {
      score += 10;
    }
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// Regeneration Support
// ============================================================================

async function rebuildDomainBundleForRegeneration(
  companyId: string,
  quarter: string,
  targetDomain?: QbrDomain | 'all'
): Promise<DomainBundleRoot> {
  // Fetch fresh data
  const [contextGraph, versions, insights, workItems, diagnosticRuns] = await Promise.all([
    loadContextGraph(companyId),
    listContextGraphVersions(companyId, 20),
    getCompanyInsights(companyId, { limit: 100 }),
    getWorkItems(companyId),
    listDiagnosticRunsForCompany(companyId),
  ]);

  const fullBundle = buildDomainBundle({
    companyId,
    quarter,
    contextGraph,
    versions,
    insights,
    workItems,
    diagnosticRuns,
  });

  // If targeting a specific domain, filter
  if (targetDomain && targetDomain !== 'all') {
    return {
      global: fullBundle.global,
      domains: fullBundle.domains.filter((d) => d.domain === targetDomain),
    };
  }

  return fullBundle;
}
