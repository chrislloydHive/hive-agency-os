// lib/os/insights/insightEngine.ts
// Main Insight Engine that orchestrates pattern detection and insight generation

import type {
  Insight,
  InsightType,
  InsightTheme,
  InsightSeverity,
  WeeklyInsightDigest,
  DigestSummary,
  DigestStat,
  HealthTrend,
  DimensionTrend,
  InsightEngineConfig,
} from './insightTypes';
import { DEFAULT_ENGINE_CONFIG } from './insightTypes';
import {
  ALL_PATTERNS,
  buildInsightFromMatch,
  type PatternContext,
  type PatternDefinition,
} from './insightPatterns';
import {
  extractAllInsightData,
  extractFindingsByLab,
  getSeverityDistribution,
} from './insightExtractors';

// ============================================================================
// Main Engine Functions
// ============================================================================

/**
 * Generate insights for a company
 * This is the main entry point for the Insight Engine
 */
export async function generateInsights(
  companyId: string,
  config: Partial<InsightEngineConfig> = {}
): Promise<Insight[]> {
  const fullConfig: InsightEngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    ...config,
  };

  console.log('[insightEngine] Generating insights for company:', companyId);

  // 1. Extract all relevant data
  const data = await extractAllInsightData(companyId);

  // 2. Build pattern context
  const context: PatternContext = {
    companyId,
    currentSnapshot: data.currentSnapshot,
    previousSnapshot: data.previousSnapshot,
    scoreHistory: data.scoreHistory,
    findings: data.findings,
    contextHealth: data.contextHealth,  // Context Graph health for pattern detection
    config: fullConfig,
    now: new Date(),
  };

  // 3. Run pattern detection
  const insights: Insight[] = [];

  for (const pattern of ALL_PATTERNS) {
    // Skip disabled patterns
    if (!fullConfig.enabledTypes.includes(pattern.type)) {
      continue;
    }

    try {
      const match = pattern.check(context);
      if (match && match.confidence >= fullConfig.minConfidence) {
        const insight = buildInsightFromMatch(match, companyId);
        insights.push(insight);
      }
    } catch (error) {
      console.error(`[insightEngine] Error running pattern ${pattern.id}:`, error);
    }
  }

  // 4. Sort by severity and confidence
  insights.sort((a, b) => {
    const severityOrder: Record<InsightSeverity, number> = {
      critical: 0,
      warning: 1,
      positive: 2,
      info: 3,
    };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  // 5. Limit results
  const limited = insights.slice(0, fullConfig.maxInsightsPerDigest);

  console.log('[insightEngine] Generated', limited.length, 'insights');
  return limited;
}

/**
 * Generate a weekly digest of insights
 */
export async function generateWeeklyDigest(
  companyId: string,
  config?: Partial<InsightEngineConfig>
): Promise<WeeklyInsightDigest> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  // Generate insights
  const insights = await generateInsights(companyId, config);

  // Group by theme
  const byTheme: Record<InsightTheme, Insight[]> = {
    performance: [],
    visibility: [],
    brand: [],
    content: [],
    local: [],
    social: [],
    competition: [],
    overall: [],
  };

  for (const insight of insights) {
    byTheme[insight.theme].push(insight);
  }

  // Extract top priority (critical and warning)
  const topPriority = insights.filter(i =>
    i.severity === 'critical' || i.severity === 'warning'
  );

  // Extract quick wins (opportunities)
  const quickWins = insights.filter(i =>
    i.type === 'opportunity' || i.severity === 'positive'
  );

  // Build health trend
  const healthTrend = await buildHealthTrend(companyId);

  // Build summary
  const summary = buildDigestSummary(insights, healthTrend);

  return {
    companyId,
    weekStart: weekStart.toISOString(),
    weekEnd: now.toISOString(),
    generatedAt: now.toISOString(),
    summary,
    insights,
    byTheme,
    topPriority,
    quickWins,
    healthTrend,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function buildHealthTrend(companyId: string): Promise<HealthTrend> {
  const data = await extractAllInsightData(companyId);

  const currentScore = data.currentSnapshot?.overallScore ?? null;
  const previousScore = data.previousSnapshot?.overallScore ?? null;

  let change: number | null = null;
  let direction: HealthTrend['direction'] = 'unknown';

  if (currentScore !== null && previousScore !== null) {
    change = currentScore - previousScore;
    if (change > 2) direction = 'improving';
    else if (change < -2) direction = 'declining';
    else direction = 'stable';
  } else if (currentScore !== null) {
    direction = 'stable';
  }

  // Build dimension trends
  const dimensions: DimensionTrend[] = [];
  if (data.currentSnapshot) {
    for (const [dim, current] of Object.entries(data.currentSnapshot.dimensions)) {
      const previous = data.previousSnapshot?.dimensions[dim] ?? null;
      let dimChange: number | null = null;
      let dimDirection: DimensionTrend['direction'] = 'unknown';

      if (current !== null && previous !== null) {
        dimChange = current - previous;
        if (dimChange > 2) dimDirection = 'improving';
        else if (dimChange < -2) dimDirection = 'declining';
        else dimDirection = 'stable';
      } else if (current !== null) {
        dimDirection = 'stable';
      }

      dimensions.push({
        dimension: dim,
        currentScore: current,
        previousScore: previous,
        change: dimChange,
        direction: dimDirection,
      });
    }
  }

  return {
    currentScore,
    previousScore,
    change,
    direction,
    dimensions,
  };
}

function buildDigestSummary(insights: Insight[], healthTrend: HealthTrend): DigestSummary {
  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  const opportunityCount = insights.filter(i => i.type === 'opportunity').length;
  const positiveCount = insights.filter(i => i.severity === 'positive').length;

  // Determine sentiment
  let sentiment: DigestSummary['sentiment'] = 'neutral';
  if (criticalCount > 0 || (warningCount >= 3)) {
    sentiment = 'concerning';
  } else if (positiveCount >= 2 || healthTrend.direction === 'improving') {
    sentiment = 'positive';
  }

  // Build headline
  let headline: string;
  if (criticalCount > 0) {
    headline = `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require${criticalCount === 1 ? 's' : ''} attention`;
  } else if (healthTrend.direction === 'improving' && healthTrend.change !== null) {
    headline = `Score improved ${healthTrend.change.toFixed(0)} points this week`;
  } else if (healthTrend.direction === 'declining' && healthTrend.change !== null) {
    headline = `Score declined ${Math.abs(healthTrend.change).toFixed(0)} points - review needed`;
  } else if (opportunityCount > 0) {
    headline = `${opportunityCount} improvement opportunit${opportunityCount > 1 ? 'ies' : 'y'} identified`;
  } else {
    headline = 'Digital health is stable this week';
  }

  // Build key stats
  const keyStats: DigestStat[] = [];

  if (healthTrend.currentScore !== null) {
    keyStats.push({
      label: 'Overall Score',
      value: healthTrend.currentScore,
      change: healthTrend.change ?? undefined,
      trend: healthTrend.direction === 'improving' ? 'up' :
             healthTrend.direction === 'declining' ? 'down' : 'stable',
    });
  }

  keyStats.push({
    label: 'Total Insights',
    value: insights.length,
  });

  if (criticalCount + warningCount > 0) {
    keyStats.push({
      label: 'Issues',
      value: criticalCount + warningCount,
    });
  }

  if (opportunityCount > 0) {
    keyStats.push({
      label: 'Opportunities',
      value: opportunityCount,
    });
  }

  return {
    headline,
    keyStats,
    sentiment,
    criticalCount,
    opportunityCount,
  };
}

// ============================================================================
// Filtered Insight Queries
// ============================================================================

/**
 * Get insights filtered by theme
 */
export async function getInsightsByTheme(
  companyId: string,
  theme: InsightTheme
): Promise<Insight[]> {
  const insights = await generateInsights(companyId);
  return insights.filter(i => i.theme === theme);
}

/**
 * Get insights filtered by type
 */
export async function getInsightsByType(
  companyId: string,
  type: InsightType
): Promise<Insight[]> {
  const insights = await generateInsights(companyId);
  return insights.filter(i => i.type === type);
}

/**
 * Get only critical and warning insights
 */
export async function getCriticalInsights(companyId: string): Promise<Insight[]> {
  const insights = await generateInsights(companyId);
  return insights.filter(i => i.severity === 'critical' || i.severity === 'warning');
}

/**
 * Get only positive insights (opportunities, milestones)
 */
export async function getPositiveInsights(companyId: string): Promise<Insight[]> {
  const insights = await generateInsights(companyId);
  return insights.filter(i => i.severity === 'positive');
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './insightTypes';
export { extractAllInsightData, extractFindingsByLab, getSeverityDistribution } from './insightExtractors';
