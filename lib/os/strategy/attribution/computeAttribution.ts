// lib/os/strategy/attribution/computeAttribution.ts
// Strategy Attribution Engine - Link Outcome Signals to Evolution Events
//
// Design principle: Deterministic, explainable attribution.
// No AI, no ML, no probabilistic inference.
// All scoring is based on explicit rules and auditable calculations.

import type { OutcomeSignal } from '@/lib/types/outcomeSignal';
import type { StrategyEvolutionEvent } from '@/lib/types/strategyEvolution';
import type {
  AttributionWindow,
  EventAttribution,
  AttributionRollups,
  TopDriver,
} from '@/lib/types/strategyAttribution';
import {
  DEFAULT_ATTRIBUTION_WINDOW,
  sliceSignalsForEvent,
  calculateTotalWeightedScore,
  calculateSignalDeltas,
  extractTopDrivers,
  determineDirection,
  calculateAttributionScore,
  calculateAttributionConfidence,
  MIN_SAMPLE_SIZE,
} from '@/lib/types/strategyAttribution';
import { listEvolutionEvents } from '@/lib/airtable/strategyEvolutionEvents';

// ============================================================================
// Types
// ============================================================================

export interface ComputeAttributionInput {
  /** Strategy ID */
  strategyId: string;

  /** Company ID */
  companyId: string;

  /** All outcome signals for this company/strategy */
  signals: OutcomeSignal[];

  /** Attribution window (defaults to 30/30) */
  window?: AttributionWindow;

  /** Whether strategy is complete (affects confidence) */
  strategyComplete?: boolean;

  /** Maximum events to process */
  maxEvents?: number;
}

export interface ComputeAttributionResult {
  /** Attribution window used */
  window: AttributionWindow;

  /** All event attributions, sorted by date desc */
  attributions: EventAttribution[];

  /** Rollup summaries */
  rollups: AttributionRollups;

  /** Processing metadata */
  meta: {
    strategyId: string;
    companyId: string;
    totalEvents: number;
    totalSignals: number;
    processedAt: string;
  };
}

// ============================================================================
// Main Attribution Function
// ============================================================================

/**
 * Compute attributions for all evolution events of a strategy
 * Deterministic, explainable, no AI.
 */
export async function computeAttribution(
  input: ComputeAttributionInput
): Promise<ComputeAttributionResult> {
  const {
    strategyId,
    companyId,
    signals,
    window = DEFAULT_ATTRIBUTION_WINDOW,
    strategyComplete = true,
    maxEvents = 50,
  } = input;

  // Load evolution events for this strategy
  const events = await listEvolutionEvents(strategyId, {
    limit: maxEvents,
    includeRolledBack: false,
  });

  // Filter signals to this strategy only
  const strategySignals = signals.filter(
    (s) => s.strategyId === strategyId || !s.strategyId
  );

  // Compute attribution for each event
  const attributions: EventAttribution[] = [];

  for (const event of events) {
    const attribution = computeEventAttribution(
      event,
      strategySignals,
      window,
      strategyComplete
    );
    attributions.push(attribution);
  }

  // Sort by date (newest first) - stable sort
  attributions.sort((a, b) => {
    const dateCompare = new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.eventId.localeCompare(b.eventId); // Stable tie-breaker
  });

  // Generate rollups
  const rollups = generateRollups(attributions);

  return {
    window,
    attributions,
    rollups,
    meta: {
      strategyId,
      companyId,
      totalEvents: events.length,
      totalSignals: strategySignals.length,
      processedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Single Event Attribution
// ============================================================================

/**
 * Compute attribution for a single evolution event
 */
export function computeEventAttribution(
  event: StrategyEvolutionEvent,
  signals: OutcomeSignal[],
  window: AttributionWindow,
  strategyComplete: boolean
): EventAttribution {
  const eventDate = new Date(event.createdAt);

  // Slice signals into pre and post windows
  const { preSignals, postSignals } = sliceSignalsForEvent(
    signals,
    eventDate,
    window
  );

  // Calculate weighted scores
  const preWeightedTotal = calculateTotalWeightedScore(preSignals);
  const postWeightedTotal = calculateTotalWeightedScore(postSignals);
  const deltaWeightedScore = postWeightedTotal - preWeightedTotal;

  // Determine direction
  const direction = determineDirection(deltaWeightedScore);

  // Calculate signal deltas by type
  const signalTypeDeltas = calculateSignalDeltas(preSignals, postSignals, 'signalType');
  const sourceDeltas = calculateSignalDeltas(preSignals, postSignals, 'source');

  // Combine deltas (signal types first, then sources)
  const allDeltas = [...signalTypeDeltas, ...sourceDeltas];

  // Extract top drivers
  const topDrivers = extractTopDrivers(allDeltas);

  // Calculate attribution score
  const totalSignals = preSignals.length + postSignals.length;
  const attributionScore = calculateAttributionScore(deltaWeightedScore, totalSignals);

  // Calculate confidence
  const confidence = calculateAttributionConfidence(
    preSignals.length,
    postSignals.length,
    strategyComplete
  );

  // Generate notes
  const notes = generateAttributionNotes(
    preSignals.length,
    postSignals.length,
    direction,
    confidence,
    topDrivers
  );

  return {
    eventId: event.id,
    appliedAt: event.createdAt,
    eventTitle: event.title,
    window,
    attributionScore,
    direction,
    confidence,
    topDrivers,
    deltas: allDeltas,
    notes,
    preSignalCount: preSignals.length,
    postSignalCount: postSignals.length,
    preWeightedTotal,
    postWeightedTotal,
  };
}

// ============================================================================
// Rollups Generation
// ============================================================================

/**
 * Generate rollup summaries from attributions
 */
export function generateRollups(attributions: EventAttribution[]): AttributionRollups {
  // Separate by direction
  const positive = attributions.filter((a) => a.direction === 'positive');
  const negative = attributions.filter((a) => a.direction === 'negative');
  const neutral = attributions.filter((a) => a.direction === 'neutral');
  const noSignal = attributions.filter(
    (a) => a.preSignalCount === 0 && a.postSignalCount === 0
  );

  // Sort by score (desc) with stable secondary sort
  const sortByScoreDesc = (a: EventAttribution, b: EventAttribution) => {
    const scoreDiff = b.attributionScore - a.attributionScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.eventId.localeCompare(b.eventId);
  };

  // Top positive events (up to 5)
  const topPositiveEvents = [...positive].sort(sortByScoreDesc).slice(0, 5);

  // Top negative events (up to 5, sorted by score desc since higher score = more impact)
  const topNegativeEvents = [...negative].sort(sortByScoreDesc).slice(0, 5);

  // Aggregate drivers across all attributions
  const driverMap = new Map<string, { total: number; count: number; direction: number }>();

  for (const attr of attributions) {
    for (const driver of attr.topDrivers) {
      const existing = driverMap.get(driver.label) || { total: 0, count: 0, direction: 0 };
      existing.total += driver.contribution;
      existing.count += 1;
      existing.direction += driver.direction === 'positive' ? 1 : driver.direction === 'negative' ? -1 : 0;
      driverMap.set(driver.label, existing);
    }
  }

  // Convert to TopDriver array and sort by impact
  const mostImpactfulDrivers: TopDriver[] = Array.from(driverMap.entries())
    .map(([label, data]) => ({
      label,
      type: 'signalType' as const,
      contribution: Math.round(data.total / data.count),
      direction: (data.direction > 0 ? 'positive' : data.direction < 0 ? 'negative' : 'neutral') as TopDriver['direction'],
    }))
    .sort((a, b) => {
      const contribDiff = b.contribution - a.contribution;
      if (contribDiff !== 0) return contribDiff;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 5);

  // Calculate average score
  const totalScore = attributions.reduce((sum, a) => sum + a.attributionScore, 0);
  const averageScore = attributions.length > 0 ? Math.round(totalScore / attributions.length) : 0;

  return {
    topPositiveEvents,
    topNegativeEvents,
    mostImpactfulDrivers,
    noSignalEvents: noSignal,
    totalEvents: attributions.length,
    averageScore,
    countByDirection: {
      positive: positive.length,
      neutral: neutral.length,
      negative: negative.length,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate human-readable notes for an attribution
 */
function generateAttributionNotes(
  preCount: number,
  postCount: number,
  direction: EventAttribution['direction'],
  confidence: number,
  topDrivers: TopDriver[]
): string[] {
  const notes: string[] = [];

  // Sample size note
  const totalSamples = preCount + postCount;
  if (totalSamples === 0) {
    notes.push('No signals in attribution window. Unable to assess impact.');
    return notes;
  }

  if (totalSamples < MIN_SAMPLE_SIZE) {
    notes.push(`Limited data: only ${totalSamples} signals available.`);
  }

  // Pre/post balance note
  if (preCount === 0) {
    notes.push('No baseline signals before this change.');
  } else if (postCount === 0) {
    notes.push('No outcome signals after this change yet.');
  } else {
    const ratio = Math.min(preCount, postCount) / Math.max(preCount, postCount);
    if (ratio < 0.3) {
      notes.push('Imbalanced sample sizes may affect accuracy.');
    }
  }

  // Direction-specific notes
  if (direction === 'positive' && topDrivers.length > 0) {
    const positiveDrivers = topDrivers.filter((d) => d.direction === 'positive');
    if (positiveDrivers.length > 0) {
      notes.push(
        `Key positive drivers: ${positiveDrivers.map((d) => d.label).join(', ')}.`
      );
    }
  } else if (direction === 'negative' && topDrivers.length > 0) {
    const negativeDrivers = topDrivers.filter((d) => d.direction === 'negative');
    if (negativeDrivers.length > 0) {
      notes.push(
        `Areas of concern: ${negativeDrivers.map((d) => d.label).join(', ')}.`
      );
    }
  }

  // Confidence note
  if (confidence < 40) {
    notes.push('Low confidence: consider collecting more outcome data.');
  }

  return notes;
}

/**
 * Filter signals by strategy (with fallback for unlinked signals)
 */
export function filterSignalsByStrategy(
  signals: OutcomeSignal[],
  strategyId: string
): OutcomeSignal[] {
  return signals.filter(
    (s) => s.strategyId === strategyId || !s.strategyId
  );
}

/**
 * Get a single event attribution by ID
 */
export async function getEventAttributionById(
  eventId: string,
  strategyId: string,
  signals: OutcomeSignal[],
  window: AttributionWindow = DEFAULT_ATTRIBUTION_WINDOW,
  strategyComplete: boolean = true
): Promise<EventAttribution | null> {
  const events = await listEvolutionEvents(strategyId, {
    limit: 100,
    includeRolledBack: true,
  });

  const event = events.find((e) => e.id === eventId);
  if (!event) return null;

  const strategySignals = filterSignalsByStrategy(signals, strategyId);
  return computeEventAttribution(event, strategySignals, window, strategyComplete);
}

// ============================================================================
// Attribution Summary for UI
// ============================================================================

export interface AttributionSummary {
  hasData: boolean;
  totalEvents: number;
  eventsWithSignals: number;
  overallTrend: 'positive' | 'neutral' | 'negative';
  averageScore: number;
  topPositiveChange: EventAttribution | null;
  topNegativeChange: EventAttribution | null;
}

/**
 * Generate a quick summary for UI display
 */
export function generateAttributionSummary(
  result: ComputeAttributionResult
): AttributionSummary {
  const { attributions, rollups } = result;

  const eventsWithSignals = attributions.filter(
    (a) => a.preSignalCount > 0 || a.postSignalCount > 0
  ).length;

  // Determine overall trend from direction counts
  let overallTrend: 'positive' | 'neutral' | 'negative' = 'neutral';
  const { positive, negative } = rollups.countByDirection;
  if (positive > negative + 2) {
    overallTrend = 'positive';
  } else if (negative > positive + 2) {
    overallTrend = 'negative';
  }

  return {
    hasData: attributions.length > 0 && eventsWithSignals > 0,
    totalEvents: attributions.length,
    eventsWithSignals,
    overallTrend,
    averageScore: rollups.averageScore,
    topPositiveChange: rollups.topPositiveEvents[0] || null,
    topNegativeChange: rollups.topNegativeEvents[0] || null,
  };
}
