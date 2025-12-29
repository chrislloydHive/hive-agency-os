// lib/types/strategyAttribution.ts
// Strategy Attribution Types - Linking Outcome Signals to Evolution Events
//
// Design principle: Deterministic, explainable attribution.
// No AI, no ML, no probabilistic inference.
// All scoring is based on explicit rules and auditable calculations.

import type { OutcomeSignal, OutcomeSignalType, OutcomeSignalConfidence } from './outcomeSignal';

// ============================================================================
// Attribution Window
// ============================================================================

/**
 * Time window for attribution analysis
 * preDays: days before event to consider as "before" baseline
 * postDays: days after event to measure outcome changes
 */
export interface AttributionWindow {
  /** Days before event for baseline signals */
  preDays: number;

  /** Days after event for outcome signals */
  postDays: number;
}

/**
 * Default attribution window (30 days before, 30 days after)
 */
export const DEFAULT_ATTRIBUTION_WINDOW: AttributionWindow = {
  preDays: 30,
  postDays: 30,
};

// ============================================================================
// Signal Delta - Pre/Post Comparison
// ============================================================================

/**
 * Key types for grouping signals
 */
export type SignalGroupKey = 'signalType' | 'source' | 'artifactType';

/**
 * Delta comparison for a specific signal category
 */
export interface SignalDelta {
  /** Key being compared (e.g., signal type, artifact type, source) */
  key: string;

  /** Type of grouping (signalType, source, artifactType) */
  groupBy: SignalGroupKey;

  /** Count of signals in pre-window */
  preCount: number;

  /** Count of signals in post-window */
  postCount: number;

  /** Raw count delta (post - pre) */
  delta: number;

  /** Weighted score before (accounting for signal quality) */
  preWeightedScore: number;

  /** Weighted score after */
  postWeightedScore: number;

  /** Delta in weighted score */
  deltaWeightedScore: number;

  /** Trend direction based on delta */
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ============================================================================
// Event Attribution
// ============================================================================

/**
 * Direction of outcome change
 */
export type AttributionDirection = 'positive' | 'neutral' | 'negative';

/**
 * A top driver contributing to outcome changes
 */
export interface TopDriver {
  /** Driver label (e.g., "completed", "high-impact", "work") */
  label: string;

  /** Type of driver */
  type: 'signalType' | 'source';

  /** Contribution to score change (0-100) */
  contribution: number;

  /** Direction of this driver's impact */
  direction: AttributionDirection;
}

/**
 * Attribution result for a single evolution event
 */
export interface EventAttribution {
  /** Evolution event ID */
  eventId: string;

  /** When the event was applied */
  appliedAt: string;

  /** Event title for display */
  eventTitle: string;

  /** Attribution window used */
  window: AttributionWindow;

  /** Overall attribution score (0-100) */
  attributionScore: number;

  /** Direction of outcome change */
  direction: AttributionDirection;

  /** Confidence in the attribution (0-100) */
  confidence: number;

  /** Top drivers of the outcome change */
  topDrivers: TopDriver[];

  /** Detailed deltas by signal category */
  deltas: SignalDelta[];

  /** Human-readable notes */
  notes: string[];

  /** Pre-window signal count */
  preSignalCount: number;

  /** Post-window signal count */
  postSignalCount: number;

  /** Pre-window weighted total */
  preWeightedTotal: number;

  /** Post-window weighted total */
  postWeightedTotal: number;
}

// ============================================================================
// Attribution Rollups
// ============================================================================

/**
 * Rollup summary of attributions
 */
export interface AttributionRollups {
  /** Events with positive outcome changes, sorted by score desc */
  topPositiveEvents: EventAttribution[];

  /** Events with negative outcome changes, sorted by score desc */
  topNegativeEvents: EventAttribution[];

  /** Most impactful signal types/sources */
  mostImpactfulDrivers: TopDriver[];

  /** Events with no signals in attribution window */
  noSignalEvents: EventAttribution[];

  /** Total events analyzed */
  totalEvents: number;

  /** Average attribution score */
  averageScore: number;

  /** Events by direction */
  countByDirection: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

// ============================================================================
// Scoring Constants
// ============================================================================

/**
 * Weights for signal types (positive signals score higher)
 */
export const SIGNAL_TYPE_WEIGHTS: Record<OutcomeSignalType, number> = {
  'high-impact': 10,
  'completed': 8,
  'learning': 5,
  'low-impact': -3,
  'abandoned': -5,
};

/**
 * Confidence multipliers (higher confidence = more weight)
 */
export const CONFIDENCE_MULTIPLIERS: Record<OutcomeSignalConfidence, number> = {
  'high': 1.5,
  'medium': 1.0,
  'low': 0.5,
};

/**
 * Direction thresholds
 * deltaWeightedScore > POSITIVE_THRESHOLD = positive
 * deltaWeightedScore < NEGATIVE_THRESHOLD = negative
 * otherwise = neutral
 */
export const DIRECTION_THRESHOLDS = {
  POSITIVE: 5, // Delta > 5 is positive
  NEGATIVE: -5, // Delta < -5 is negative
};

/**
 * Minimum sample size for meaningful attribution
 */
export const MIN_SAMPLE_SIZE = 3;

/**
 * Maximum attribution score
 */
export const MAX_ATTRIBUTION_SCORE = 100;

// ============================================================================
// Helper Functions - Scoring
// ============================================================================

/**
 * Calculate weighted score for a single signal
 * Weight = signalTypeWeight * confidenceMultiplier
 */
export function calculateSignalWeight(signal: OutcomeSignal): number {
  const typeWeight = SIGNAL_TYPE_WEIGHTS[signal.signalType];
  const confidenceMultiplier = CONFIDENCE_MULTIPLIERS[signal.confidence];
  return typeWeight * confidenceMultiplier;
}

/**
 * Calculate total weighted score for an array of signals
 */
export function calculateTotalWeightedScore(signals: OutcomeSignal[]): number {
  return signals.reduce((sum, signal) => sum + calculateSignalWeight(signal), 0);
}

/**
 * Determine direction from delta
 */
export function determineDirection(deltaWeightedScore: number): AttributionDirection {
  if (deltaWeightedScore > DIRECTION_THRESHOLDS.POSITIVE) return 'positive';
  if (deltaWeightedScore < DIRECTION_THRESHOLDS.NEGATIVE) return 'negative';
  return 'neutral';
}

/**
 * Calculate attribution score from delta (0-100)
 * Uses absolute delta, normalized to 0-100 range
 */
export function calculateAttributionScore(
  deltaWeightedScore: number,
  totalSignals: number
): number {
  if (totalSignals === 0) return 0;

  // Normalize delta by sample size to get per-signal impact
  const normalizedDelta = Math.abs(deltaWeightedScore) / Math.max(1, totalSignals);

  // Scale to 0-100 (max expected delta per signal is ~15 for high-impact with high confidence)
  const scaled = (normalizedDelta / 15) * 100;

  // Clamp to 0-100
  return Math.min(MAX_ATTRIBUTION_SCORE, Math.max(0, Math.round(scaled)));
}

/**
 * Calculate confidence in attribution based on sample size
 * More signals = higher confidence
 */
export function calculateAttributionConfidence(
  preCount: number,
  postCount: number,
  strategyComplete: boolean = true
): number {
  const totalSamples = preCount + postCount;

  // Base confidence from sample size
  let confidence = 0;
  if (totalSamples >= 20) {
    confidence = 90;
  } else if (totalSamples >= 10) {
    confidence = 70;
  } else if (totalSamples >= MIN_SAMPLE_SIZE) {
    confidence = 50;
  } else if (totalSamples > 0) {
    confidence = 25;
  }

  // Penalty for incomplete strategy
  if (!strategyComplete) {
    confidence = Math.min(confidence, 60);
  }

  // Penalty for imbalanced samples
  const ratio = Math.min(preCount, postCount) / Math.max(preCount, postCount, 1);
  if (ratio < 0.3) {
    confidence = Math.round(confidence * 0.8);
  }

  return Math.max(0, Math.min(100, confidence));
}

// ============================================================================
// Helper Functions - Grouping & Comparison
// ============================================================================

/**
 * Group signals by a key
 */
export function groupSignalsBy(
  signals: OutcomeSignal[],
  groupBy: SignalGroupKey
): Map<string, OutcomeSignal[]> {
  const groups = new Map<string, OutcomeSignal[]>();

  for (const signal of signals) {
    let key: string;
    switch (groupBy) {
      case 'signalType':
        key = signal.signalType;
        break;
      case 'source':
        key = signal.source;
        break;
      case 'artifactType':
        key = signal.artifactType || 'unknown';
        break;
    }

    const group = groups.get(key) || [];
    group.push(signal);
    groups.set(key, group);
  }

  return groups;
}

/**
 * Calculate signal deltas between pre and post windows
 */
export function calculateSignalDeltas(
  preSignals: OutcomeSignal[],
  postSignals: OutcomeSignal[],
  groupBy: SignalGroupKey
): SignalDelta[] {
  const preGroups = groupSignalsBy(preSignals, groupBy);
  const postGroups = groupSignalsBy(postSignals, groupBy);

  // Get all unique keys
  const allKeys = new Set([...preGroups.keys(), ...postGroups.keys()]);
  const deltas: SignalDelta[] = [];

  for (const key of allKeys) {
    const preSigs = preGroups.get(key) || [];
    const postSigs = postGroups.get(key) || [];

    const preCount = preSigs.length;
    const postCount = postSigs.length;
    const delta = postCount - preCount;

    const preWeightedScore = calculateTotalWeightedScore(preSigs);
    const postWeightedScore = calculateTotalWeightedScore(postSigs);
    const deltaWeightedScore = postWeightedScore - preWeightedScore;

    let trend: SignalDelta['trend'] = 'stable';
    if (deltaWeightedScore > 2) trend = 'increasing';
    else if (deltaWeightedScore < -2) trend = 'decreasing';

    deltas.push({
      key,
      groupBy,
      preCount,
      postCount,
      delta,
      preWeightedScore,
      postWeightedScore,
      deltaWeightedScore,
      trend,
    });
  }

  // Sort by absolute delta (most change first)
  return deltas.sort((a, b) => Math.abs(b.deltaWeightedScore) - Math.abs(a.deltaWeightedScore));
}

/**
 * Extract top drivers from deltas
 */
export function extractTopDrivers(
  deltas: SignalDelta[],
  maxDrivers: number = 3
): TopDriver[] {
  const drivers: TopDriver[] = [];

  // Get the most impactful deltas
  const sortedDeltas = [...deltas]
    .sort((a, b) => Math.abs(b.deltaWeightedScore) - Math.abs(a.deltaWeightedScore))
    .slice(0, maxDrivers);

  for (const d of sortedDeltas) {
    if (Math.abs(d.deltaWeightedScore) < 1) continue;

    drivers.push({
      label: d.key,
      type: d.groupBy === 'signalType' ? 'signalType' : 'source',
      contribution: Math.min(100, Math.abs(Math.round(d.deltaWeightedScore * 5))),
      direction: determineDirection(d.deltaWeightedScore),
    });
  }

  return drivers;
}

// ============================================================================
// Helper Functions - Window Slicing
// ============================================================================

/**
 * Slice signals into a time window
 */
export function sliceSignalsToWindow(
  signals: OutcomeSignal[],
  referenceDate: Date,
  offsetDays: number,
  windowDays: number
): OutcomeSignal[] {
  const startMs = referenceDate.getTime() + offsetDays * 24 * 60 * 60 * 1000;
  const endMs = startMs + windowDays * 24 * 60 * 60 * 1000;

  return signals.filter((signal) => {
    const signalMs = new Date(signal.createdAt).getTime();
    return signalMs >= startMs && signalMs < endMs;
  });
}

/**
 * Slice signals into pre and post windows relative to an event
 */
export function sliceSignalsForEvent(
  signals: OutcomeSignal[],
  eventDate: Date,
  window: AttributionWindow
): { preSignals: OutcomeSignal[]; postSignals: OutcomeSignal[] } {
  const preSignals = sliceSignalsToWindow(
    signals,
    eventDate,
    -window.preDays,
    window.preDays
  );

  const postSignals = sliceSignalsToWindow(
    signals,
    eventDate,
    0,
    window.postDays
  );

  return { preSignals, postSignals };
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get color class for attribution direction
 */
export function getDirectionColorClass(direction: AttributionDirection): string {
  const colors: Record<AttributionDirection, string> = {
    'positive': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'neutral': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    'negative': 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[direction];
}

/**
 * Get color class for attribution score
 */
export function getScoreColorClass(score: number): string {
  if (score >= 70) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  if (score >= 40) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  if (score >= 20) return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  return 'bg-slate-800/50 text-slate-500 border-slate-700/50';
}

/**
 * Get color class for confidence
 */
export function getConfidenceColorClass(confidence: number): string {
  if (confidence >= 70) return 'text-emerald-400';
  if (confidence >= 40) return 'text-amber-400';
  return 'text-slate-500';
}

/**
 * Get human-readable direction label
 */
export function getDirectionLabel(direction: AttributionDirection): string {
  const labels: Record<AttributionDirection, string> = {
    'positive': 'Positive Impact',
    'neutral': 'Neutral',
    'negative': 'Negative Impact',
  };
  return labels[direction];
}

/**
 * Get icon name for direction
 */
export function getDirectionIcon(
  direction: AttributionDirection
): 'trending-up' | 'minus' | 'trending-down' {
  const icons: Record<AttributionDirection, 'trending-up' | 'minus' | 'trending-down'> = {
    'positive': 'trending-up',
    'neutral': 'minus',
    'negative': 'trending-down',
  };
  return icons[direction];
}

/**
 * Format attribution score for display
 */
export function formatAttributionScore(score: number): string {
  if (score === 0) return 'No Data';
  return `${score}%`;
}

/**
 * Format confidence for display
 */
export function formatConfidence(confidence: number): string {
  if (confidence >= 70) return 'High';
  if (confidence >= 40) return 'Medium';
  if (confidence > 0) return 'Low';
  return 'Insufficient Data';
}
