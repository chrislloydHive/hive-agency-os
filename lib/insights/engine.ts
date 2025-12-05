// lib/insights/engine.ts
// Brain Insights Engine - Central coordinator for insight extraction and management

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { ClientInsight } from '@/lib/types/clientBrain';
import { extractInsightsFromRun, hasIngestor } from './ingestors';
import {
  getRankedInsightsForCompany,
  getInsightsForCompany,
  getInsightStats,
  type InsightFilters,
} from './repo';
import { getInsightUIGroup, type InsightUIGroup } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

export interface InsightExtractionResult {
  success: boolean;
  insightsCreated: number;
  insightsSkipped: number;
  error?: string;
  duration: number;
}

export interface GroupedInsights {
  growthOpportunities: ClientInsight[];
  competitiveSignals: ClientInsight[];
  strategicRecommendations: ClientInsight[];
}

export interface InsightsDashboard {
  stats: {
    open: number;
    inProgress: number;
    resolved: number;
    dismissed: number;
    total: number;
  };
  topInsights: ClientInsight[];
  groupedInsights: GroupedInsights;
  recentInsights: ClientInsight[];
}

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract insights from a completed diagnostic run
 *
 * This is the main entry point called after a diagnostic completes.
 * It handles:
 * - Checking if the tool has an ingestor
 * - Running the extraction
 * - Logging timing and results
 */
export async function processCompletedDiagnostic(
  companyId: string,
  run: DiagnosticRun
): Promise<InsightExtractionResult> {
  const startTime = Date.now();

  console.log('[InsightsEngine] Processing completed diagnostic', {
    companyId,
    toolId: run.toolId,
    runId: run.id,
  });

  // Check if we have an ingestor for this tool
  if (!hasIngestor(run.toolId)) {
    console.log(`[InsightsEngine] No ingestor for ${run.toolId}, skipping`);
    return {
      success: true,
      insightsCreated: 0,
      insightsSkipped: 0,
      duration: Date.now() - startTime,
    };
  }

  // Skip if run didn't complete successfully
  if (run.status !== 'complete') {
    console.log(`[InsightsEngine] Run status is ${run.status}, skipping`);
    return {
      success: true,
      insightsCreated: 0,
      insightsSkipped: 0,
      duration: Date.now() - startTime,
    };
  }

  // Run extraction
  const result = await extractInsightsFromRun(companyId, run);

  const duration = Date.now() - startTime;
  console.log('[InsightsEngine] Extraction complete', {
    companyId,
    toolId: run.toolId,
    created: result.insightsCreated,
    skipped: result.insightsSkipped,
    durationMs: duration,
  });

  return {
    ...result,
    duration,
  };
}

/**
 * Process diagnostic completion asynchronously (fire and forget)
 */
export function processCompletedDiagnosticAsync(
  companyId: string,
  run: DiagnosticRun
): void {
  processCompletedDiagnostic(companyId, run).catch((error) => {
    console.error('[InsightsEngine] Async processing failed:', error);
  });
}

// ============================================================================
// Query
// ============================================================================

/**
 * Get all insights for a company grouped by UI category
 */
export async function getGroupedInsights(
  companyId: string
): Promise<GroupedInsights> {
  const insights = await getRankedInsightsForCompany(companyId);

  const groups: GroupedInsights = {
    growthOpportunities: [],
    competitiveSignals: [],
    strategicRecommendations: [],
  };

  for (const insight of insights) {
    const group = getInsightUIGroup(insight.category);
    switch (group) {
      case 'growth_opportunities':
        groups.growthOpportunities.push(insight);
        break;
      case 'competitive_signals':
        groups.competitiveSignals.push(insight);
        break;
      case 'strategic_recommendations':
        groups.strategicRecommendations.push(insight);
        break;
    }
  }

  return groups;
}

/**
 * Get complete insights dashboard data for Brain UI
 */
export async function getInsightsDashboard(
  companyId: string
): Promise<InsightsDashboard> {
  // Run queries in parallel
  const [stats, rankedInsights] = await Promise.all([
    getInsightStats(companyId),
    getRankedInsightsForCompany(companyId),
  ]);

  // Group insights
  const groupedInsights: GroupedInsights = {
    growthOpportunities: [],
    competitiveSignals: [],
    strategicRecommendations: [],
  };

  for (const insight of rankedInsights) {
    const group = getInsightUIGroup(insight.category);
    switch (group) {
      case 'growth_opportunities':
        groupedInsights.growthOpportunities.push(insight);
        break;
      case 'competitive_signals':
        groupedInsights.competitiveSignals.push(insight);
        break;
      case 'strategic_recommendations':
        groupedInsights.strategicRecommendations.push(insight);
        break;
    }
  }

  // Get top 5 most important insights
  const topInsights = rankedInsights.slice(0, 5);

  // Get recent insights (last 10, sorted by date)
  const recentInsights = [...rankedInsights]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return {
    stats,
    topInsights,
    groupedInsights,
    recentInsights,
  };
}

/**
 * Get insights filtered by various criteria
 */
export async function queryInsights(
  companyId: string,
  filters: InsightFilters
): Promise<ClientInsight[]> {
  return getInsightsForCompany(companyId, filters);
}

/**
 * Get insight statistics for a company
 */
export async function getInsightStatistics(companyId: string) {
  return getInsightStats(companyId);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a tool supports insight extraction
 */
export function supportsInsightExtraction(toolId: string): boolean {
  return hasIngestor(toolId);
}

/**
 * Get insights by UI group
 */
export async function getInsightsByGroup(
  companyId: string,
  group: InsightUIGroup
): Promise<ClientInsight[]> {
  const insights = await getRankedInsightsForCompany(companyId);
  return insights.filter((insight) => getInsightUIGroup(insight.category) === group);
}
