// lib/os/strategy/insights/generateInsights.ts
// Deterministic Insight Generation Engine
//
// Design principle: No AI, no ML, no probabilistic inference.
// All insights are derived from explicit rules applied to attribution and evolution data.
// Output ordering is stable and deterministic.

import type { StrategyEvolutionEvent, DiffRiskFlag } from '@/lib/types/strategyEvolution';
import type { EventAttribution, AttributionDirection } from '@/lib/types/strategyAttribution';
import type { OutcomeSignal } from '@/lib/types/outcomeSignal';
import type {
  StrategyInsight,
  StrategyInsightsResult,
  InsightsRollups,
  InsightsCoverage,
  InsightMetrics,
  InsightEvidence,
  RecommendedAction,
  ExpectedImpact,
  DriverLeaderboardEntry,
  DetectedPattern,
} from '@/lib/types/strategyInsights';
import {
  INSIGHT_THRESHOLDS,
  generateInsightId,
  sortInsightsByPriority,
} from '@/lib/types/strategyInsights';

/**
 * Generate a deterministic pattern ID
 */
function generatePatternId(type: string, ...keys: string[]): string {
  const combined = ['pattern', type, ...keys].join('|');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `pattern_${type}_${Math.abs(hash).toString(36)}`;
}

// ============================================================================
// Input Types
// ============================================================================

export interface GenerateInsightsInput {
  /** Evolution events with diff summaries */
  events: StrategyEvolutionEvent[];

  /** Attribution results keyed by eventId */
  attributions: Map<string, EventAttribution>;

  /** Optional outcome signals for additional context */
  signals?: OutcomeSignal[];

  /** Attribution window used */
  window: {
    preDays: number;
    postDays: number;
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate deterministic insights from evolution events and attribution data
 */
export function generateInsights(input: GenerateInsightsInput): StrategyInsightsResult {
  const { events, attributions, window } = input;

  // Build event-attribution pairs
  const eventPairs = events.map((event) => ({
    event,
    attribution: attributions.get(event.id),
  }));

  // Generate insights by category
  const winInsights = generateWinInsights(eventPairs);
  const riskInsights = generateRiskInsights(eventPairs);
  const neutralInsights = generateNeutralInsights(eventPairs);
  const driverInsights = generateDriverInsights(eventPairs);

  // Combine and sort all insights
  const allInsights = sortInsightsByPriority([
    ...winInsights,
    ...riskInsights,
    ...neutralInsights,
    ...driverInsights,
  ]);

  // Generate rollups
  const driverLeaderboard = generateDriverLeaderboard(eventPairs);
  const patterns = detectPatterns(eventPairs);
  const recommendedActions = generateRecommendedActions(eventPairs, driverLeaderboard, patterns);
  const coverage = computeCoverage(events, attributions, allInsights);

  const rollups: InsightsRollups = {
    driverLeaderboard,
    patterns,
    recommendedActions,
    coverage,
  };

  return {
    insights: allInsights,
    rollups,
    window,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Win Insights
// ============================================================================

interface EventPair {
  event: StrategyEvolutionEvent;
  attribution?: EventAttribution;
}

/**
 * Generate insights for positive outcomes (wins)
 * Criteria: positive direction + score >= 65 + confidence >= 60
 */
function generateWinInsights(eventPairs: EventPair[]): StrategyInsight[] {
  const insights: StrategyInsight[] = [];

  // Filter to winning events
  const winningPairs = eventPairs.filter((pair) => {
    if (!pair.attribution) return false;
    return (
      pair.attribution.direction === 'positive' &&
      pair.attribution.attributionScore >= INSIGHT_THRESHOLDS.WIN_MIN_SCORE &&
      pair.attribution.confidence >= INSIGHT_THRESHOLDS.MIN_CONFIDENCE
    );
  });

  if (winningPairs.length === 0) return insights;

  // Group by top driver for aggregation
  const byDriver = new Map<string, EventPair[]>();
  for (const pair of winningPairs) {
    const topDriver = pair.attribution?.topDrivers[0]?.label || 'general';
    const existing = byDriver.get(topDriver) || [];
    existing.push(pair);
    byDriver.set(topDriver, existing);
  }

  // Create insight for each driver group
  const sortedDrivers = [...byDriver.entries()].sort((a, b) => {
    // Sort by total contribution (sum of scores)
    const aScore = a[1].reduce((sum, p) => sum + (p.attribution?.attributionScore || 0), 0);
    const bScore = b[1].reduce((sum, p) => sum + (p.attribution?.attributionScore || 0), 0);
    if (bScore !== aScore) return bScore - aScore;
    return a[0].localeCompare(b[0]); // Stable sort by driver name
  });

  for (const [driverKey, pairs] of sortedDrivers) {
    const metrics = computeMetrics(pairs);
    const evidence = computeEvidence(pairs, [driverKey]);

    const title = driverKey === 'general'
      ? `${pairs.length} Successful Strategy Changes`
      : `${driverKey} Driving Positive Outcomes`;

    const summary = driverKey === 'general'
      ? `${pairs.length} evolution events showed positive attribution with an average score of ${metrics.avgAttributionScore.toFixed(0)}%.`
      : `The "${driverKey}" signal type contributed to ${pairs.length} positive evolution events with ${metrics.confidence.toFixed(0)}% confidence.`;

    insights.push({
      id: generateInsightId('wins', driverKey, String(pairs.length)),
      category: 'wins',
      title,
      summary,
      evidence,
      metrics,
    });
  }

  return insights;
}

// ============================================================================
// Risk Insights
// ============================================================================

/**
 * Generate insights for negative outcomes (risks)
 * Criteria: negative direction + score <= 35 + confidence >= 60
 * Also incorporates diff risk flags
 */
function generateRiskInsights(eventPairs: EventPair[]): StrategyInsight[] {
  const insights: StrategyInsight[] = [];

  // Filter to risky events (by attribution)
  const riskyPairs = eventPairs.filter((pair) => {
    if (!pair.attribution) return false;
    return (
      pair.attribution.direction === 'negative' &&
      pair.attribution.attributionScore <= INSIGHT_THRESHOLDS.RISK_MAX_SCORE &&
      pair.attribution.confidence >= INSIGHT_THRESHOLDS.MIN_CONFIDENCE
    );
  });

  // Also include events with critical risk flags even without attribution
  const riskFlagPairs = eventPairs.filter((pair) => {
    const flags = pair.event.diffSummary.riskFlags;
    const hasCriticalFlags = flags.some((f) =>
      ['goal_changed', 'objective_removed', 'many_tactics_changed'].includes(f)
    );
    return hasCriticalFlags && !riskyPairs.includes(pair);
  });

  const allRiskyPairs = [...riskyPairs, ...riskFlagPairs];

  if (allRiskyPairs.length === 0) return insights;

  // Group by risk flag type for better organization
  const byRiskType = new Map<string, EventPair[]>();

  for (const pair of allRiskyPairs) {
    const riskFlags = pair.event.diffSummary.riskFlags;
    const riskKey = riskFlags.length > 0 ? riskFlags[0] : 'negative_attribution';
    const existing = byRiskType.get(riskKey) || [];
    existing.push(pair);
    byRiskType.set(riskKey, existing);
  }

  // Sort risk types by severity
  const riskSeverity: Record<string, number> = {
    goal_changed: 100,
    objective_removed: 90,
    many_tactics_changed: 80,
    pillar_removed: 70,
    negative_attribution: 60,
  };

  const sortedRisks = [...byRiskType.entries()].sort((a, b) => {
    const aSev = riskSeverity[a[0]] || 50;
    const bSev = riskSeverity[b[0]] || 50;
    if (bSev !== aSev) return bSev - aSev;
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0]);
  });

  for (const [riskKey, pairs] of sortedRisks) {
    const metrics = computeMetrics(pairs);
    const riskFlags = pairs.flatMap((p) => p.event.diffSummary.riskFlags);
    const uniqueFlags = [...new Set(riskFlags)] as DiffRiskFlag[];
    const evidence = computeEvidence(pairs, undefined, uniqueFlags);

    const title = getRiskTitle(riskKey, pairs.length);
    const summary = getRiskSummary(riskKey, pairs, metrics);

    // Generate recommended action for risks
    const recommendedAction = generateRiskAction(riskKey, pairs, evidence);

    insights.push({
      id: generateInsightId('risks', riskKey, String(pairs.length)),
      category: 'risks',
      title,
      summary,
      evidence,
      metrics,
      recommendedAction,
    });
  }

  return insights;
}

function getRiskTitle(riskKey: string, count: number): string {
  const titles: Record<string, string> = {
    goal_changed: 'Goal Statement Changed',
    objective_removed: `${count} Objective${count > 1 ? 's' : ''} Removed`,
    many_tactics_changed: 'High Tactic Churn Detected',
    pillar_removed: 'Strategic Pillar Removed',
    negative_attribution: 'Negative Outcome Attribution',
  };
  return titles[riskKey] || `Risk: ${riskKey}`;
}

function getRiskSummary(riskKey: string, pairs: EventPair[], metrics: InsightMetrics): string {
  const summaries: Record<string, string> = {
    goal_changed: `The strategy goal was changed, which may indicate scope creep or strategic drift. ${pairs.length} event${pairs.length > 1 ? 's' : ''} affected.`,
    objective_removed: `${pairs.length} objective${pairs.length > 1 ? 's were' : ' was'} removed from the strategy. Consider whether this represents intentional focus or concerning scope reduction.`,
    many_tactics_changed: `High volume of tactic changes detected across ${pairs.length} event${pairs.length > 1 ? 's' : ''}. This may indicate execution instability.`,
    pillar_removed: `A strategic pillar was removed. Ensure alignment with overall strategy goals.`,
    negative_attribution: `${pairs.length} evolution event${pairs.length > 1 ? 's' : ''} showed negative attribution with an average score of ${metrics.avgAttributionScore.toFixed(0)}%.`,
  };
  return summaries[riskKey] || `Risk pattern detected in ${pairs.length} events.`;
}

function generateRiskAction(
  riskKey: string,
  pairs: EventPair[],
  evidence: InsightEvidence
): RecommendedAction | undefined {
  const actionMap: Record<string, Partial<RecommendedAction>> = {
    goal_changed: {
      actionType: 'address_risk_flags',
      target: 'Goal Statement',
      why: 'Frequent goal changes can indicate strategic drift and reduce team alignment.',
      how: [
        'Review the goal change history to understand the pattern',
        'Validate the current goal with stakeholders',
        'Document the rationale for the change',
      ],
      guardrails: [
        'Avoid changing the goal more than once per quarter',
        'Ensure all objectives still align with the new goal',
      ],
      expectedImpact: 'moderate',
      confidence: 75,
    },
    objective_removed: {
      actionType: 'restore_or_replace_removed',
      target: 'Removed Objectives',
      why: 'Removing objectives without replacement may leave strategic gaps.',
      how: [
        'Review the removed objectives and their rationale',
        'Determine if they should be restored or replaced',
        'Ensure remaining objectives provide full coverage',
      ],
      guardrails: [
        'Document why objectives were removed',
        'Verify no orphaned tactics remain',
      ],
      expectedImpact: 'moderate',
      confidence: 70,
    },
    many_tactics_changed: {
      actionType: 'reduce_scope_churn',
      target: 'Tactics',
      why: 'High tactic churn can indicate execution uncertainty and reduce team focus.',
      how: [
        'Identify root causes of frequent tactic changes',
        'Establish a minimum "bake time" for new tactics',
        'Review tactics that were changed multiple times',
      ],
      guardrails: [
        'Limit tactic changes to planned review cycles',
        'Require evidence before removing tactics',
      ],
      expectedImpact: 'significant',
      confidence: 65,
    },
    negative_attribution: {
      actionType: 'investigate_low_confidence',
      target: 'Negative Attribution Events',
      why: 'Negative attribution may indicate strategy changes that are not producing desired outcomes.',
      how: [
        'Review the specific changes that led to negative attribution',
        'Analyze whether the changes aligned with evidence',
        'Consider reverting or adjusting the changes',
      ],
      guardrails: [
        'Wait for sufficient outcome data before acting',
        'Consider external factors that may have influenced outcomes',
      ],
      expectedImpact: 'moderate',
      confidence: 60,
    },
  };

  const template = actionMap[riskKey];
  if (!template) return undefined;

  return {
    actionType: template.actionType!,
    target: template.target!,
    why: template.why!,
    how: template.how!,
    guardrails: template.guardrails!,
    expectedImpact: template.expectedImpact as ExpectedImpact,
    confidence: template.confidence!,
    evidence: {
      eventIds: evidence.eventIds,
      driverKeys: evidence.driverKeys,
      signalIds: evidence.signalIds,
    },
  };
}

// ============================================================================
// Neutral Insights
// ============================================================================

/**
 * Generate insights for neutral outcomes
 * Criteria: neutral direction OR low confidence
 */
function generateNeutralInsights(eventPairs: EventPair[]): StrategyInsight[] {
  const insights: StrategyInsight[] = [];

  const neutralPairs = eventPairs.filter((pair) => {
    if (!pair.attribution) return false;
    return (
      pair.attribution.direction === 'neutral' ||
      pair.attribution.confidence < INSIGHT_THRESHOLDS.MIN_CONFIDENCE
    );
  });

  if (neutralPairs.length === 0) return insights;

  // Group by change type
  const byChangeType = new Map<string, EventPair[]>();
  for (const pair of neutralPairs) {
    const changeType = categorizeChangeType(pair.event);
    const existing = byChangeType.get(changeType) || [];
    existing.push(pair);
    byChangeType.set(changeType, existing);
  }

  // Only report if there are multiple neutral changes
  if (neutralPairs.length < INSIGHT_THRESHOLDS.MIN_PATTERN_SAMPLE) return insights;

  const sortedTypes = [...byChangeType.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0]);
  });

  for (const [changeType, pairs] of sortedTypes) {
    if (pairs.length < INSIGHT_THRESHOLDS.MIN_PATTERN_SAMPLE) continue;

    const metrics = computeMetrics(pairs);
    const evidence = computeEvidence(pairs);

    insights.push({
      id: generateInsightId('neutral', changeType, String(pairs.length)),
      category: 'neutral',
      title: `${pairs.length} ${changeType} Changes with Neutral Attribution`,
      summary: `${pairs.length} ${changeType.toLowerCase()} changes showed neutral or low-confidence attribution. Consider whether more outcome data is needed.`,
      evidence,
      metrics,
    });
  }

  return insights;
}

function categorizeChangeType(event: StrategyEvolutionEvent): string {
  const summary = event.diffSummary;
  if (summary.added > summary.modified && summary.added > summary.removed) {
    return 'Additive';
  }
  if (summary.removed > summary.modified && summary.removed > summary.added) {
    return 'Reductive';
  }
  return 'Modification';
}

// ============================================================================
// Driver Insights
// ============================================================================

/**
 * Generate insights highlighting top drivers
 */
function generateDriverInsights(eventPairs: EventPair[]): StrategyInsight[] {
  const insights: StrategyInsight[] = [];

  // Aggregate drivers across all events
  const driverStats = new Map<string, {
    totalContribution: number;
    eventCount: number;
    directions: AttributionDirection[];
    eventIds: string[];
  }>();

  for (const pair of eventPairs) {
    if (!pair.attribution) continue;

    for (const driver of pair.attribution.topDrivers) {
      const existing = driverStats.get(driver.label) || {
        totalContribution: 0,
        eventCount: 0,
        directions: [],
        eventIds: [],
      };

      existing.totalContribution += driver.contribution;
      existing.eventCount += 1;
      existing.directions.push(driver.direction);
      existing.eventIds.push(pair.event.id);

      driverStats.set(driver.label, existing);
    }
  }

  // Find the most impactful driver
  const sortedDrivers = [...driverStats.entries()]
    .filter(([, stats]) => stats.eventCount >= INSIGHT_THRESHOLDS.MIN_DRIVER_APPEARANCES)
    .sort((a, b) => {
      if (b[1].totalContribution !== a[1].totalContribution) {
        return b[1].totalContribution - a[1].totalContribution;
      }
      if (b[1].eventCount !== a[1].eventCount) {
        return b[1].eventCount - a[1].eventCount;
      }
      return a[0].localeCompare(b[0]);
    });

  // Create insight for top driver if significant
  if (sortedDrivers.length > 0) {
    const [topDriver, stats] = sortedDrivers[0];

    if (stats.totalContribution >= 50) {
      const predominantDirection = getPredominantDirection(stats.directions);

      insights.push({
        id: generateInsightId('drivers', topDriver, String(stats.eventCount)),
        category: 'drivers',
        title: `"${topDriver}" is the Top Contributing Factor`,
        summary: `The "${topDriver}" signal type appeared in ${stats.eventCount} events with a total contribution of ${stats.totalContribution.toFixed(0)}. ${
          predominantDirection === 'positive'
            ? 'This is primarily driving positive outcomes.'
            : predominantDirection === 'negative'
            ? 'This is primarily associated with negative outcomes.'
            : 'The impact direction is mixed.'
        }`,
        evidence: {
          eventIds: stats.eventIds,
          driverKeys: [topDriver],
        },
        metrics: {
          avgAttributionScore: stats.totalContribution / stats.eventCount,
          confidence: Math.min(90, 50 + stats.eventCount * 10),
          impactScoreAvg: 0,
          sampleSize: stats.eventCount,
        },
      });
    }
  }

  return insights;
}

// ============================================================================
// Driver Leaderboard
// ============================================================================

/**
 * Generate driver leaderboard with stable sorting
 */
export function generateDriverLeaderboard(eventPairs: EventPair[]): DriverLeaderboardEntry[] {
  const driverStats = new Map<string, {
    type: 'signalType' | 'source';
    totalContribution: number;
    eventCount: number;
    directions: AttributionDirection[];
    eventIds: string[];
  }>();

  for (const pair of eventPairs) {
    if (!pair.attribution) continue;

    for (const driver of pair.attribution.topDrivers) {
      const existing = driverStats.get(driver.label) || {
        type: driver.type,
        totalContribution: 0,
        eventCount: 0,
        directions: [],
        eventIds: [],
      };

      existing.totalContribution += driver.contribution;
      existing.eventCount += 1;
      existing.directions.push(driver.direction);
      if (!existing.eventIds.includes(pair.event.id)) {
        existing.eventIds.push(pair.event.id);
      }

      driverStats.set(driver.label, existing);
    }
  }

  const entries: DriverLeaderboardEntry[] = [];

  for (const [label, stats] of driverStats) {
    if (stats.eventCount < INSIGHT_THRESHOLDS.MIN_DRIVER_APPEARANCES) continue;

    entries.push({
      label,
      type: stats.type,
      totalContribution: stats.totalContribution,
      avgContribution: stats.totalContribution / stats.eventCount,
      eventCount: stats.eventCount,
      predominantDirection: getPredominantDirection(stats.directions),
      eventIds: [...stats.eventIds].sort(),
    });
  }

  // Stable sort by total contribution, then event count, then label
  return entries.sort((a, b) => {
    if (b.totalContribution !== a.totalContribution) {
      return b.totalContribution - a.totalContribution;
    }
    if (b.eventCount !== a.eventCount) {
      return b.eventCount - a.eventCount;
    }
    return a.label.localeCompare(b.label);
  });
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect patterns across events
 */
export function detectPatterns(eventPairs: EventPair[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Pattern 1: Repeating drivers
  const driverCounts = new Map<string, number>();
  for (const pair of eventPairs) {
    if (!pair.attribution) continue;
    for (const driver of pair.attribution.topDrivers) {
      driverCounts.set(driver.label, (driverCounts.get(driver.label) || 0) + 1);
    }
  }

  for (const [driver, count] of driverCounts) {
    if (count >= 3) {
      const strength = Math.min(100, 30 + count * 15);
      if (strength >= INSIGHT_THRESHOLDS.MIN_PATTERN_STRENGTH) {
        const eventIds = eventPairs
          .filter((p) => p.attribution?.topDrivers.some((d) => d.label === driver))
          .map((p) => p.event.id);

        patterns.push({
          id: generatePatternId('repeating_driver', driver),
          type: 'repeating_driver',
          description: `"${driver}" appears as a top driver in ${count} events`,
          strength,
          eventIds,
        });
      }
    }
  }

  // Pattern 2: Risk clusters
  const riskFlagCounts = new Map<DiffRiskFlag, string[]>();
  for (const pair of eventPairs) {
    for (const flag of pair.event.diffSummary.riskFlags) {
      const existing = riskFlagCounts.get(flag) || [];
      existing.push(pair.event.id);
      riskFlagCounts.set(flag, existing);
    }
  }

  for (const [flag, eventIds] of riskFlagCounts) {
    if (eventIds.length >= 2) {
      const strength = Math.min(100, 40 + eventIds.length * 20);
      if (strength >= INSIGHT_THRESHOLDS.MIN_PATTERN_STRENGTH) {
        patterns.push({
          id: generatePatternId('risk_cluster', flag),
          type: 'risk_cluster',
          description: `Risk flag "${flag}" occurred in ${eventIds.length} events`,
          strength,
          eventIds,
        });
      }
    }
  }

  // Pattern 3: Direction trend
  const directions = eventPairs
    .filter((p) => p.attribution)
    .map((p) => p.attribution!.direction);

  if (directions.length >= 3) {
    const positiveCount = directions.filter((d) => d === 'positive').length;
    const negativeCount = directions.filter((d) => d === 'negative').length;
    const total = directions.length;

    if (positiveCount / total >= 0.7) {
      patterns.push({
        id: generatePatternId('direction_trend', 'positive'),
        type: 'direction_trend',
        description: `${Math.round(positiveCount / total * 100)}% of events show positive attribution`,
        strength: Math.round(positiveCount / total * 100),
        eventIds: eventPairs.filter((p) => p.attribution?.direction === 'positive').map((p) => p.event.id),
      });
    } else if (negativeCount / total >= 0.5) {
      patterns.push({
        id: generatePatternId('direction_trend', 'negative'),
        type: 'direction_trend',
        description: `${Math.round(negativeCount / total * 100)}% of events show negative attribution`,
        strength: Math.round(negativeCount / total * 100),
        eventIds: eventPairs.filter((p) => p.attribution?.direction === 'negative').map((p) => p.event.id),
      });
    }
  }

  // Pattern 4: Scope churn
  const highChangeEvents = eventPairs.filter((p) =>
    p.event.diffSummary.impactScore >= 70 ||
    p.event.diffSummary.riskFlags.includes('many_tactics_changed')
  );

  if (highChangeEvents.length >= 2) {
    const strength = Math.min(100, 35 + highChangeEvents.length * 20);
    if (strength >= INSIGHT_THRESHOLDS.MIN_PATTERN_STRENGTH) {
      patterns.push({
        id: generatePatternId('scope_churn', String(highChangeEvents.length)),
        type: 'scope_churn',
        description: `${highChangeEvents.length} high-impact changes detected, indicating potential scope churn`,
        strength,
        eventIds: highChangeEvents.map((p) => p.event.id),
      });
    }
  }

  // Sort patterns by strength for stable output
  return patterns.sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    return a.id.localeCompare(b.id);
  });
}

// ============================================================================
// Recommended Actions
// ============================================================================

/**
 * Generate recommended actions based on insights and patterns
 */
export function generateRecommendedActions(
  eventPairs: EventPair[],
  leaderboard: DriverLeaderboardEntry[],
  patterns: DetectedPattern[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // Action 1: Expand success pattern (if positive pattern detected)
  const positiveDriver = leaderboard.find(
    (d) => d.predominantDirection === 'positive' && d.totalContribution >= 50
  );

  if (positiveDriver) {
    actions.push({
      actionType: 'expand_success_pattern',
      target: positiveDriver.label,
      why: `"${positiveDriver.label}" is consistently driving positive outcomes across ${positiveDriver.eventCount} events.`,
      how: [
        `Identify what makes "${positiveDriver.label}" successful`,
        'Apply similar patterns to other areas of the strategy',
        'Document best practices for team alignment',
      ],
      guardrails: [
        'Ensure the pattern is applicable in other contexts',
        'Monitor for diminishing returns',
      ],
      expectedImpact: 'significant',
      confidence: Math.min(90, 50 + positiveDriver.eventCount * 10),
      evidence: {
        eventIds: positiveDriver.eventIds,
        driverKeys: [positiveDriver.label],
      },
    });
  }

  // Action 2: Reduce scope churn (if scope churn pattern detected)
  const scopeChurnPattern = patterns.find((p) => p.type === 'scope_churn');
  if (scopeChurnPattern && scopeChurnPattern.strength >= 50) {
    actions.push({
      actionType: 'reduce_scope_churn',
      target: 'Strategy Scope',
      why: `${scopeChurnPattern.eventIds.length} high-impact changes suggest execution instability.`,
      how: [
        'Review recent high-impact changes for necessity',
        'Establish change management protocols',
        'Set minimum "bake time" before further changes',
      ],
      guardrails: [
        'Balance stability with necessary adaptation',
        'Ensure critical changes are not blocked',
      ],
      expectedImpact: 'moderate',
      confidence: Math.min(80, scopeChurnPattern.strength),
      evidence: {
        eventIds: scopeChurnPattern.eventIds,
      },
    });
  }

  // Action 3: Add measurement loop (if low confidence across events)
  const lowConfidenceEvents = eventPairs.filter(
    (p) => p.attribution && p.attribution.confidence < 50
  );

  if (lowConfidenceEvents.length >= 2) {
    actions.push({
      actionType: 'add_measurement_loop',
      target: 'Outcome Tracking',
      why: `${lowConfidenceEvents.length} events have low attribution confidence, indicating insufficient outcome data.`,
      how: [
        'Define clearer success metrics for each tactic',
        'Increase frequency of outcome signal collection',
        'Add leading indicators to supplement lagging metrics',
      ],
      guardrails: [
        'Avoid measurement overhead that slows execution',
        'Focus on metrics that inform decisions',
      ],
      expectedImpact: 'moderate',
      confidence: 65,
      evidence: {
        eventIds: lowConfidenceEvents.map((p) => p.event.id),
      },
    });
  }

  // Action 4: Consolidate neutral changes (if many neutral events)
  const neutralEvents = eventPairs.filter(
    (p) => p.attribution?.direction === 'neutral'
  );

  if (neutralEvents.length >= 3) {
    actions.push({
      actionType: 'consolidate_neutral_changes',
      target: 'Neutral-Impact Changes',
      why: `${neutralEvents.length} changes showed neutral attribution, suggesting they may not be impactful.`,
      how: [
        'Review neutral changes for actual necessity',
        'Consider consolidating similar changes',
        'Prioritize changes with clearer outcome expectations',
      ],
      guardrails: [
        'Some changes may be foundational and not show immediate impact',
        'Wait for sufficient outcome data before removing',
      ],
      expectedImpact: 'minor',
      confidence: 55,
      evidence: {
        eventIds: neutralEvents.map((p) => p.event.id),
      },
    });
  }

  // Sort actions by confidence then expected impact
  const impactOrder: Record<ExpectedImpact, number> = {
    significant: 3,
    moderate: 2,
    minor: 1,
  };

  return actions.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (impactOrder[b.expectedImpact] !== impactOrder[a.expectedImpact]) {
      return impactOrder[b.expectedImpact] - impactOrder[a.expectedImpact];
    }
    return a.actionType.localeCompare(b.actionType);
  });
}

// ============================================================================
// Coverage Computation
// ============================================================================

/**
 * Compute coverage statistics
 */
export function computeCoverage(
  events: StrategyEvolutionEvent[],
  attributions: Map<string, EventAttribution>,
  insights: StrategyInsight[]
): InsightsCoverage {
  const totalEvents = events.length;
  const eventsWithAttribution = events.filter((e) => attributions.has(e.id)).length;

  // Events that appear in at least one insight
  const eventIdsInInsights = new Set<string>();
  for (const insight of insights) {
    for (const eventId of insight.evidence.eventIds) {
      eventIdsInInsights.add(eventId);
    }
  }
  const eventsInInsights = eventIdsInInsights.size;

  const coveragePercent = totalEvents > 0
    ? Math.round((eventsInInsights / totalEvents) * 100)
    : 0;

  return {
    totalEvents,
    eventsWithAttribution,
    eventsInInsights,
    coveragePercent,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function computeMetrics(pairs: EventPair[]): InsightMetrics {
  const withAttribution = pairs.filter((p) => p.attribution);

  if (withAttribution.length === 0) {
    return {
      avgAttributionScore: 0,
      confidence: 0,
      impactScoreAvg: pairs.reduce((sum, p) => sum + p.event.diffSummary.impactScore, 0) / pairs.length,
      sampleSize: pairs.length,
    };
  }

  const avgAttributionScore =
    withAttribution.reduce((sum, p) => sum + p.attribution!.attributionScore, 0) /
    withAttribution.length;

  const avgConfidence =
    withAttribution.reduce((sum, p) => sum + p.attribution!.confidence, 0) /
    withAttribution.length;

  const impactScoreAvg =
    pairs.reduce((sum, p) => sum + p.event.diffSummary.impactScore, 0) / pairs.length;

  return {
    avgAttributionScore,
    confidence: avgConfidence,
    impactScoreAvg,
    sampleSize: pairs.length,
  };
}

function computeEvidence(
  pairs: EventPair[],
  driverKeys?: string[],
  diffRiskFlags?: DiffRiskFlag[]
): InsightEvidence {
  const eventIds = pairs.map((p) => p.event.id).sort();

  // Collect signal IDs from attributions
  const signalIds: string[] = [];
  // Note: Would need signal IDs to be present in attribution data

  return {
    eventIds,
    driverKeys: driverKeys?.sort(),
    signalIds: signalIds.length > 0 ? signalIds : undefined,
    diffRiskFlags: diffRiskFlags && diffRiskFlags.length > 0 ? diffRiskFlags : undefined,
  };
}

function getPredominantDirection(directions: AttributionDirection[]): AttributionDirection {
  const counts: Record<AttributionDirection, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  for (const dir of directions) {
    counts[dir]++;
  }

  if (counts.positive > counts.negative && counts.positive > counts.neutral) {
    return 'positive';
  }
  if (counts.negative > counts.positive && counts.negative > counts.neutral) {
    return 'negative';
  }
  return 'neutral';
}
