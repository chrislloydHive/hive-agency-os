// lib/contextGraph/performanceDeltas.ts
// Closed-Loop Learning Hooks (Phase 2)
//
// Tracks performance deltas between context graph snapshots to enable
// learning and optimization. Compares predicted vs actual performance.

import type { ContextGraphSnapshot } from './history';
import type { CompanyContextGraph } from './companyContextGraph';

// ============================================================================
// Delta Types
// ============================================================================

/**
 * A single metric delta (change between two points)
 */
export interface MetricDelta {
  /** Metric identifier */
  metricName: string;
  /** Value at the earlier snapshot */
  previousValue: number | null;
  /** Value at the later snapshot */
  currentValue: number | null;
  /** Absolute change */
  absoluteDelta: number | null;
  /** Percentage change */
  percentDelta: number | null;
  /** Direction of change */
  direction: 'improved' | 'declined' | 'unchanged' | 'unknown';
  /** Timestamp of earlier snapshot */
  previousAt: string;
  /** Timestamp of later snapshot */
  currentAt: string;
}

/**
 * Performance delta report between two versions
 */
export interface PerformanceDeltaReport {
  /** Company ID */
  companyId: string;
  /** Earlier version ID */
  previousVersionId: string;
  /** Later version ID */
  currentVersionId: string;
  /** Time period covered */
  period: {
    start: string;
    end: string;
    durationDays: number;
  };
  /** Performance metric deltas */
  performanceDeltas: {
    cpa: MetricDelta | null;
    roas: MetricDelta | null;
    ctr: MetricDelta | null;
    conversionRate: MetricDelta | null;
    impressionShare: MetricDelta | null;
  };
  /** Budget metric deltas */
  budgetDeltas: {
    mediaSpend: MetricDelta | null;
    cpaTarget: MetricDelta | null;
    roasTarget: MetricDelta | null;
  };
  /** Audience/reach deltas */
  audienceDeltas: {
    activeChannels: MetricDelta | null;
    geoCount: MetricDelta | null;
  };
  /** Overall summary */
  summary: {
    totalMetrics: number;
    improved: number;
    declined: number;
    unchanged: number;
    overallTrend: 'positive' | 'negative' | 'neutral' | 'mixed';
  };
  /** Generated timestamp */
  generatedAt: string;
}

/**
 * Learning insight derived from deltas
 */
export interface LearningInsight {
  /** Insight type */
  type: 'performance_correlation' | 'budget_efficiency' | 'channel_impact' | 'warning';
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Human-readable insight */
  insight: string;
  /** Metrics involved */
  metrics: string[];
  /** Confidence in this insight (0-1) */
  confidence: number;
  /** Actionable recommendation */
  recommendation: string | null;
}

// ============================================================================
// Delta Calculation
// ============================================================================

/**
 * Calculate a single metric delta
 */
function calculateMetricDelta(
  metricName: string,
  previousValue: number | null | undefined,
  currentValue: number | null | undefined,
  previousAt: string,
  currentAt: string,
  higherIsBetter: boolean = true
): MetricDelta {
  const prev = previousValue ?? null;
  const curr = currentValue ?? null;

  let absoluteDelta: number | null = null;
  let percentDelta: number | null = null;
  let direction: MetricDelta['direction'] = 'unknown';

  if (prev !== null && curr !== null) {
    absoluteDelta = curr - prev;
    percentDelta = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;

    if (Math.abs(absoluteDelta) < 0.001) {
      direction = 'unchanged';
    } else if (higherIsBetter) {
      direction = absoluteDelta > 0 ? 'improved' : 'declined';
    } else {
      // Lower is better (e.g., CPA)
      direction = absoluteDelta < 0 ? 'improved' : 'declined';
    }
  }

  return {
    metricName,
    previousValue: prev,
    currentValue: curr,
    absoluteDelta: absoluteDelta !== null ? Math.round(absoluteDelta * 100) / 100 : null,
    percentDelta: percentDelta !== null ? Math.round(percentDelta * 10) / 10 : null,
    direction,
    previousAt,
    currentAt,
  };
}

/**
 * Extract a numeric value from a WithMeta field
 */
function extractNumeric(field: unknown): number | null {
  if (!field || typeof field !== 'object') return null;
  const f = field as { value?: unknown };
  if (typeof f.value === 'number') return f.value;
  return null;
}

/**
 * Extract array length from a WithMeta field
 */
function extractArrayLength(field: unknown): number | null {
  if (!field || typeof field !== 'object') return null;
  const f = field as { value?: unknown };
  if (Array.isArray(f.value)) return f.value.length;
  return null;
}

// ============================================================================
// Main Delta Functions
// ============================================================================

/**
 * Calculate performance deltas between two context graph snapshots
 */
export function calculatePerformanceDeltas(
  previousVersion: ContextGraphSnapshot,
  currentVersion: ContextGraphSnapshot
): PerformanceDeltaReport {
  const prev = previousVersion.graph as CompanyContextGraph;
  const curr = currentVersion.graph as CompanyContextGraph;

  const previousAt = previousVersion.versionAt;
  const currentAt = currentVersion.versionAt;

  // Calculate period
  const startDate = new Date(previousAt);
  const endDate = new Date(currentAt);
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  // Performance deltas
  const performanceDeltas = {
    cpa: calculateMetricDelta(
      'cpa',
      extractNumeric(prev.performanceMedia?.blendedCpa),
      extractNumeric(curr.performanceMedia?.blendedCpa),
      previousAt,
      currentAt,
      false // Lower CPA is better
    ),
    roas: calculateMetricDelta(
      'roas',
      extractNumeric(prev.performanceMedia?.blendedRoas),
      extractNumeric(curr.performanceMedia?.blendedRoas),
      previousAt,
      currentAt,
      true // Higher ROAS is better
    ),
    ctr: calculateMetricDelta(
      'ctr',
      extractNumeric(prev.performanceMedia?.blendedCtr),
      extractNumeric(curr.performanceMedia?.blendedCtr),
      previousAt,
      currentAt,
      true
    ),
    conversionRate: calculateMetricDelta(
      'conversionRate',
      null, // Not in current schema
      null,
      previousAt,
      currentAt,
      true
    ),
    impressionShare: calculateMetricDelta(
      'impressionShare',
      null, // Not in current schema
      null,
      previousAt,
      currentAt,
      true
    ),
  };

  // Budget deltas
  const budgetDeltas = {
    mediaSpend: calculateMetricDelta(
      'mediaSpend',
      extractNumeric(prev.budgetOps?.mediaSpendBudget),
      extractNumeric(curr.budgetOps?.mediaSpendBudget),
      previousAt,
      currentAt,
      true // Context-dependent, defaulting to higher
    ),
    cpaTarget: calculateMetricDelta(
      'cpaTarget',
      extractNumeric(prev.budgetOps?.cpaTarget),
      extractNumeric(curr.budgetOps?.cpaTarget),
      previousAt,
      currentAt,
      false // Lower target CPA is more aggressive
    ),
    roasTarget: calculateMetricDelta(
      'roasTarget',
      extractNumeric(prev.budgetOps?.roasTarget),
      extractNumeric(curr.budgetOps?.roasTarget),
      previousAt,
      currentAt,
      true
    ),
  };

  // Audience deltas
  const audienceDeltas = {
    activeChannels: calculateMetricDelta(
      'activeChannels',
      extractArrayLength(prev.performanceMedia?.activeChannels),
      extractArrayLength(curr.performanceMedia?.activeChannels),
      previousAt,
      currentAt,
      true
    ),
    geoCount: calculateMetricDelta(
      'geoCount',
      extractArrayLength(prev.audience?.geos),
      extractArrayLength(curr.audience?.geos),
      previousAt,
      currentAt,
      true
    ),
  };

  // Summary
  const allDeltas = [
    ...Object.values(performanceDeltas),
    ...Object.values(budgetDeltas),
    ...Object.values(audienceDeltas),
  ].filter((d): d is MetricDelta => d !== null);

  const improved = allDeltas.filter((d) => d.direction === 'improved').length;
  const declined = allDeltas.filter((d) => d.direction === 'declined').length;
  const unchanged = allDeltas.filter((d) => d.direction === 'unchanged').length;

  let overallTrend: PerformanceDeltaReport['summary']['overallTrend'];
  if (improved > declined * 2) {
    overallTrend = 'positive';
  } else if (declined > improved * 2) {
    overallTrend = 'negative';
  } else if (improved > 0 && declined > 0) {
    overallTrend = 'mixed';
  } else {
    overallTrend = 'neutral';
  }

  return {
    companyId: curr.companyId,
    previousVersionId: previousVersion.versionId,
    currentVersionId: currentVersion.versionId,
    period: {
      start: previousAt,
      end: currentAt,
      durationDays: Math.round(durationDays * 10) / 10,
    },
    performanceDeltas,
    budgetDeltas,
    audienceDeltas,
    summary: {
      totalMetrics: allDeltas.length,
      improved,
      declined,
      unchanged,
      overallTrend,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate deltas directly from two graphs (without snapshots)
 */
export function calculateGraphDeltas(
  previousGraph: CompanyContextGraph,
  currentGraph: CompanyContextGraph,
  previousAt?: string,
  currentAt?: string
): PerformanceDeltaReport {
  // Create temporary versions for calculation
  const now = new Date().toISOString();
  const previousVersion: ContextGraphSnapshot = {
    versionId: 'temp-prev',
    companyId: previousGraph.companyId,
    companyName: previousGraph.companyName,
    changeReason: 'diagnostic_run',
    versionAt: previousAt || previousGraph.meta.updatedAt || now,
    graph: previousGraph,
    completenessScore: previousGraph.meta.completenessScore,
  };

  const currentVersion: ContextGraphSnapshot = {
    versionId: 'temp-curr',
    companyId: currentGraph.companyId,
    companyName: currentGraph.companyName,
    changeReason: 'diagnostic_run',
    versionAt: currentAt || currentGraph.meta.updatedAt || now,
    graph: currentGraph,
    completenessScore: currentGraph.meta.completenessScore,
  };

  return calculatePerformanceDeltas(previousVersion, currentVersion);
}

// ============================================================================
// Learning Insights
// ============================================================================

/**
 * Generate learning insights from performance deltas
 */
export function generateLearningInsights(
  deltaReport: PerformanceDeltaReport
): LearningInsight[] {
  const insights: LearningInsight[] = [];

  const { performanceDeltas, budgetDeltas, summary } = deltaReport;

  // CPA vs Budget correlation
  if (
    performanceDeltas.cpa?.direction === 'improved' &&
    budgetDeltas.mediaSpend?.direction === 'improved'
  ) {
    insights.push({
      type: 'budget_efficiency',
      priority: 'high',
      insight:
        'Increased budget led to improved CPA efficiency - scaling is working well',
      metrics: ['cpa', 'mediaSpend'],
      confidence: 0.75,
      recommendation: 'Consider gradual budget increases to maintain efficiency gains',
    });
  }

  if (
    performanceDeltas.cpa?.direction === 'declined' &&
    budgetDeltas.mediaSpend?.direction === 'improved'
  ) {
    insights.push({
      type: 'warning',
      priority: 'high',
      insight:
        'Budget increase led to worse CPA - possible diminishing returns or audience saturation',
      metrics: ['cpa', 'mediaSpend'],
      confidence: 0.8,
      recommendation: 'Review audience targeting and consider audience expansion before further budget increases',
    });
  }

  // ROAS improvement
  if (performanceDeltas.roas?.direction === 'improved') {
    const percentImproved = performanceDeltas.roas.percentDelta || 0;
    if (percentImproved > 20) {
      insights.push({
        type: 'performance_correlation',
        priority: 'high',
        insight: `ROAS improved by ${Math.round(percentImproved)}% - significant efficiency gain`,
        metrics: ['roas'],
        confidence: 0.85,
        recommendation: 'Document current strategy and targeting for replication',
      });
    }
  }

  // Channel impact
  if (
    deltaReport.audienceDeltas.activeChannels?.direction === 'improved' &&
    performanceDeltas.roas?.direction === 'improved'
  ) {
    insights.push({
      type: 'channel_impact',
      priority: 'medium',
      insight: 'Channel expansion correlated with ROAS improvement',
      metrics: ['activeChannels', 'roas'],
      confidence: 0.65,
      recommendation: 'New channels appear effective - consider further diversification',
    });
  }

  // Overall trend warnings
  if (summary.overallTrend === 'negative') {
    insights.push({
      type: 'warning',
      priority: 'high',
      insight: `Performance trending negative: ${summary.declined} metrics declined vs ${summary.improved} improved`,
      metrics: [],
      confidence: 0.9,
      recommendation: 'Schedule performance review to identify root causes',
    });
  }

  // CTR decline warning
  if (performanceDeltas.ctr?.direction === 'declined') {
    insights.push({
      type: 'warning',
      priority: 'medium',
      insight: 'Click-through rate declining - possible creative fatigue or audience mismatch',
      metrics: ['ctr'],
      confidence: 0.7,
      recommendation: 'Review ad creative freshness and audience relevance',
    });
  }

  return insights;
}

// ============================================================================
// Historical Trend Analysis
// ============================================================================

/**
 * Trend data point for time series
 */
export interface TrendDataPoint {
  versionId: string;
  versionAt: string;
  value: number | null;
}

/**
 * Extract a metric trend across multiple snapshots
 */
export function extractMetricTrend(
  versions: ContextGraphSnapshot[],
  metricPath: string
): TrendDataPoint[] {
  // Sort by date ascending
  const sorted = [...versions].sort(
    (a, b) => new Date(a.versionAt).getTime() - new Date(b.versionAt).getTime()
  );

  return sorted.map((version) => {
    const graph = version.graph as CompanyContextGraph;
    let value: number | null = null;

    // Parse path like "performanceMedia.blendedCpa"
    const parts = metricPath.split('.');
    let current: unknown = graph;

    for (const part of parts) {
      if (!current || typeof current !== 'object') break;
      current = (current as Record<string, unknown>)[part];
    }

    // Extract value from WithMeta
    if (current && typeof current === 'object' && 'value' in current) {
      const v = (current as { value: unknown }).value;
      if (typeof v === 'number') value = v;
    }

    return {
      versionId: version.versionId,
      versionAt: version.versionAt,
      value,
    };
  });
}

/**
 * Calculate trend direction and velocity
 */
export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  averageChange: number;
  dataPoints: number;
  firstValue: number | null;
  lastValue: number | null;
  overallChange: number | null;
}

export function analyzeTrend(dataPoints: TrendDataPoint[]): TrendAnalysis {
  const values = dataPoints
    .map((d) => d.value)
    .filter((v): v is number => v !== null);

  if (values.length < 2) {
    return {
      direction: 'stable',
      averageChange: 0,
      dataPoints: values.length,
      firstValue: values[0] ?? null,
      lastValue: values[values.length - 1] ?? null,
      overallChange: null,
    };
  }

  // Calculate changes between consecutive points
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i] - values[i - 1]);
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const overallChange = values[values.length - 1] - values[0];

  // Check volatility (high variance in changes)
  const variance =
    changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length;
  const isVolatile = Math.sqrt(variance) > Math.abs(avgChange) * 2;

  let direction: TrendAnalysis['direction'];
  if (isVolatile) {
    direction = 'volatile';
  } else if (Math.abs(avgChange) < 0.01 * Math.abs(values[0] || 1)) {
    direction = 'stable';
  } else if (avgChange > 0) {
    direction = 'increasing';
  } else {
    direction = 'decreasing';
  }

  return {
    direction,
    averageChange: Math.round(avgChange * 100) / 100,
    dataPoints: values.length,
    firstValue: values[0],
    lastValue: values[values.length - 1],
    overallChange: Math.round(overallChange * 100) / 100,
  };
}
