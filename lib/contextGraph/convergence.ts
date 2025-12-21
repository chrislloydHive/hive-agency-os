// lib/contextGraph/convergence.ts
// Convergence & Confidence Scoring
//
// Computes agreement scores across provenance sources.
// Boosts confidence for human-edited values and multi-source agreement.

import type { ProvenanceTag, WithMetaType } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Convergence score for a field based on provenance analysis
 */
export interface ConvergenceScore {
  /** Base confidence from latest provenance */
  baseConfidence: number;
  /** Number of unique sources that contributed */
  sourceCount: number;
  /** Whether value was human-edited */
  humanEdited: boolean;
  /** Whether value was human-confirmed */
  humanConfirmed: boolean;
  /** Computed convergence boost (0-0.3) */
  convergenceBoost: number;
  /** Final confidence after boost (capped at 1.0) */
  finalConfidence: number;
}

/**
 * Aggregate convergence metrics for a graph
 */
export interface GraphConvergenceMetrics {
  /** Average final confidence across all fields */
  averageConfidence: number;
  /** Count of human-edited fields */
  humanEditedCount: number;
  /** Count of human-confirmed fields */
  humanConfirmedCount: number;
  /** Count of fields with multiple sources */
  multiSourceCount: number;
  /** Total fields analyzed */
  totalFields: number;
  /** Convergence quality rating */
  qualityRating: 'high' | 'medium' | 'low';
}

// ============================================================================
// Constants
// ============================================================================

/** Confidence boost for human-edited values */
const HUMAN_EDITED_BOOST = 0.15;

/** Confidence boost for human-confirmed (not edited) values */
const HUMAN_CONFIRMED_BOOST = 0.10;

/** Confidence boost per additional source (max 3 sources = 0.15) */
const MULTI_SOURCE_BOOST_PER = 0.05;

/** Maximum boost from multi-source agreement */
const MULTI_SOURCE_BOOST_MAX = 0.15;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Compute convergence score for a single field
 *
 * Boosting rules:
 * - humanEdited: +0.15 (human took time to modify)
 * - humanConfirmed: +0.10 (human validated, if not edited)
 * - Multiple sources agree: +0.05 per additional source (max +0.15)
 *
 * Final confidence capped at 1.0
 */
export function computeConvergenceScore(
  field: WithMetaType<unknown>
): ConvergenceScore {
  const provenance = field.provenance || [];

  // Empty provenance = no confidence
  if (provenance.length === 0) {
    return {
      baseConfidence: 0,
      sourceCount: 0,
      humanEdited: false,
      humanConfirmed: false,
      convergenceBoost: 0,
      finalConfidence: 0,
    };
  }

  const latest = provenance[0];
  const baseConfidence = latest.confidence ?? 0.5;

  // Count unique sources
  const uniqueSources = new Set(provenance.map(p => p.source));
  const sourceCount = uniqueSources.size;

  const humanEdited = latest.humanEdited ?? false;
  const humanConfirmed = latest.humanConfirmed ?? false;

  // Calculate boosts
  let convergenceBoost = 0;

  // Human edit boost (highest priority)
  if (humanEdited) {
    convergenceBoost += HUMAN_EDITED_BOOST;
  } else if (humanConfirmed) {
    // Human confirmation boost (only if not edited)
    convergenceBoost += HUMAN_CONFIRMED_BOOST;
  }

  // Multi-source agreement boost
  if (sourceCount > 1) {
    const extraSources = sourceCount - 1;
    convergenceBoost += Math.min(
      MULTI_SOURCE_BOOST_MAX,
      extraSources * MULTI_SOURCE_BOOST_PER
    );
  }

  const finalConfidence = Math.min(1.0, baseConfidence + convergenceBoost);

  return {
    baseConfidence,
    sourceCount,
    humanEdited,
    humanConfirmed,
    convergenceBoost,
    finalConfidence,
  };
}

/**
 * Compute convergence scores for all fields in a domain
 */
export function computeDomainConvergence(
  domain: Record<string, unknown>
): Map<string, ConvergenceScore> {
  const scores = new Map<string, ConvergenceScore>();

  for (const [field, data] of Object.entries(domain)) {
    if (isWithMetaField(data)) {
      scores.set(field, computeConvergenceScore(data as WithMetaType<unknown>));
    }
  }

  return scores;
}

/**
 * Compute aggregate convergence metrics for an entire graph
 */
export function computeGraphConvergence(
  graph: Record<string, unknown>
): GraphConvergenceMetrics {
  let totalConfidence = 0;
  let humanEditedCount = 0;
  let humanConfirmedCount = 0;
  let multiSourceCount = 0;
  let totalFields = 0;

  // Iterate through all domains
  for (const domain of Object.values(graph)) {
    if (!domain || typeof domain !== 'object') continue;

    // Iterate through fields in domain
    for (const field of Object.values(domain)) {
      if (!isWithMetaField(field)) continue;

      const score = computeConvergenceScore(field as WithMetaType<unknown>);
      totalFields++;
      totalConfidence += score.finalConfidence;

      if (score.humanEdited) humanEditedCount++;
      if (score.humanConfirmed) humanConfirmedCount++;
      if (score.sourceCount > 1) multiSourceCount++;
    }
  }

  const averageConfidence = totalFields > 0 ? totalConfidence / totalFields : 0;

  // Determine quality rating
  let qualityRating: 'high' | 'medium' | 'low';
  if (averageConfidence >= 0.8 && humanConfirmedCount >= totalFields * 0.5) {
    qualityRating = 'high';
  } else if (averageConfidence >= 0.5) {
    qualityRating = 'medium';
  } else {
    qualityRating = 'low';
  }

  return {
    averageConfidence,
    humanEditedCount,
    humanConfirmedCount,
    multiSourceCount,
    totalFields,
    qualityRating,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a value is a WithMeta field (has value and provenance)
 */
function isWithMetaField(field: unknown): boolean {
  return (
    field !== null &&
    typeof field === 'object' &&
    'value' in field &&
    'provenance' in field
  );
}

/**
 * Get the effective confidence for a field (with convergence boost applied)
 */
export function getEffectiveConfidence(field: WithMetaType<unknown>): number {
  return computeConvergenceScore(field).finalConfidence;
}

/**
 * Check if a field has high convergence (confidence >= 0.8)
 */
export function hasHighConvergence(field: WithMetaType<unknown>): boolean {
  return computeConvergenceScore(field).finalConfidence >= 0.8;
}

/**
 * Get fields sorted by convergence (highest first)
 */
export function sortByConvergence(
  fields: Map<string, WithMetaType<unknown>>
): Array<{ path: string; score: ConvergenceScore }> {
  const scored = Array.from(fields.entries()).map(([path, field]) => ({
    path,
    score: computeConvergenceScore(field),
  }));

  return scored.sort((a, b) => b.score.finalConfidence - a.score.finalConfidence);
}

/**
 * Get summary of convergence for a list of fields
 */
export function getConvergenceSummary(
  fields: Map<string, WithMetaType<unknown>>
): {
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  averageBoost: number;
} {
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let totalBoost = 0;
  let count = 0;

  for (const field of fields.values()) {
    const score = computeConvergenceScore(field);
    count++;
    totalBoost += score.convergenceBoost;

    if (score.finalConfidence >= 0.8) {
      highConfidence++;
    } else if (score.finalConfidence >= 0.5) {
      mediumConfidence++;
    } else {
      lowConfidence++;
    }
  }

  return {
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageBoost: count > 0 ? totalBoost / count : 0,
  };
}
