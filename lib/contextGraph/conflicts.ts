// lib/contextGraph/conflicts.ts
// Conflict Resolution Engine (Phase 2)
//
// Provides deterministic resolution when multiple sources disagree on a field value.
// Uses source priority, recency, and confidence to pick the winning value.

import type { ProvenanceTag, WithMetaType } from './types';
import { ContextSource, DEFAULT_VALIDITY_DAYS, normalizeProvenance } from './types';

// ============================================================================
// Source Priority Configuration
// ============================================================================

/**
 * Source priority order (higher = more authoritative)
 * User edits always win, followed by verified sources, then inferred/automated.
 */
export const SOURCE_PRIORITY: Record<string, number> = {
  // Highest priority - user input
  user: 100,
  manual: 95,

  // High priority - verified sources
  airtable: 85,
  media_profile: 80,

  // Medium-high priority - diagnostic tools
  gap_heavy: 75,
  gap_full: 70,
  gap_ia: 65,
  website_lab: 60,
  brand_lab: 60,
  content_lab: 60,
  seo_lab: 60,
  demand_lab: 60,
  ops_lab: 60,

  // Medium priority - media systems
  media_lab: 55,
  media_cockpit: 55,
  media_memory: 50,

  // Lower priority - analytics (frequently changing)
  analytics_ga4: 40,
  analytics_gads: 40,
  analytics_gbp: 40,

  // Lowest priority - AI/inferred
  brain: 35,
  inferred: 30,
  external_enrichment: 25,
};

/**
 * Get priority for a source, with fallback for unknown sources
 */
export function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 20;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Configuration for conflict resolution
 */
export interface ConflictResolutionConfig {
  /** Weight for source priority (0-1) */
  priorityWeight: number;
  /** Weight for recency (0-1) */
  recencyWeight: number;
  /** Weight for confidence (0-1) */
  confidenceWeight: number;
  /** Maximum age in days before a value is considered stale */
  maxAgeDays: number;
}

/**
 * Default conflict resolution config
 */
export const DEFAULT_CONFLICT_CONFIG: ConflictResolutionConfig = {
  priorityWeight: 0.4,
  recencyWeight: 0.35,
  confidenceWeight: 0.25,
  maxAgeDays: 365,
};

/**
 * Result of conflict resolution
 */
export interface ConflictResolutionResult<T> {
  /** The winning value */
  value: T | null;
  /** The winning provenance */
  provenance: ProvenanceTag;
  /** Score that determined the winner */
  score: number;
  /** Whether there was actually a conflict (multiple different values) */
  hadConflict: boolean;
  /** All candidates that were considered */
  candidates: Array<{
    value: T | null;
    provenance: ProvenanceTag;
    score: number;
  }>;
}

/**
 * Calculate a composite score for a provenance entry
 * Higher score = more likely to win
 */
export function calculateProvenanceScore(
  provenance: ProvenanceTag,
  config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG
): number {
  const normalized = normalizeProvenance(provenance);
  const now = Date.now();
  const updatedAt = new Date(normalized.updatedAt).getTime();
  const ageMs = now - updatedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Source priority score (0-1)
  const priorityScore = getSourcePriority(normalized.source) / 100;

  // Recency score (0-1, decays over time)
  const recencyScore = Math.max(0, 1 - ageDays / config.maxAgeDays);

  // Confidence score (already 0-1)
  const confidenceScore = normalized.confidence;

  // Weighted composite score
  const score =
    priorityScore * config.priorityWeight +
    recencyScore * config.recencyWeight +
    confidenceScore * config.confidenceWeight;

  return Math.round(score * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Resolve a conflict between multiple provenance entries for the same field
 *
 * @param candidates - Array of value/provenance pairs to consider
 * @param config - Resolution configuration
 * @returns The winning value with its provenance
 */
export function resolveFieldConflict<T>(
  candidates: Array<{ value: T | null; provenance: ProvenanceTag }>,
  config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG
): ConflictResolutionResult<T> {
  if (candidates.length === 0) {
    throw new Error('Cannot resolve conflict with no candidates');
  }

  if (candidates.length === 1) {
    const [only] = candidates;
    return {
      value: only.value,
      provenance: normalizeProvenance(only.provenance),
      score: calculateProvenanceScore(only.provenance, config),
      hadConflict: false,
      candidates: [
        {
          value: only.value,
          provenance: normalizeProvenance(only.provenance),
          score: calculateProvenanceScore(only.provenance, config),
        },
      ],
    };
  }

  // Score all candidates
  const scored = candidates.map((c) => ({
    value: c.value,
    provenance: normalizeProvenance(c.provenance),
    score: calculateProvenanceScore(c.provenance, config),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Check if there's actually a conflict (different values)
  const uniqueValues = new Set(scored.map((c) => JSON.stringify(c.value)));
  const hadConflict = uniqueValues.size > 1;

  const winner = scored[0];

  return {
    value: winner.value,
    provenance: winner.provenance,
    score: winner.score,
    hadConflict,
    candidates: scored,
  };
}

/**
 * Resolve conflict from a WithMeta field's provenance array
 * Each provenance entry represents a different source's claim on the value
 */
export function resolveFromProvenance<T>(
  field: WithMetaType<T>,
  config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG
): ConflictResolutionResult<T> {
  if (field.provenance.length === 0) {
    // No provenance, return empty result
    return {
      value: field.value,
      provenance: {
        source: 'inferred' as any,
        confidence: 0,
        updatedAt: new Date().toISOString(),
      },
      score: 0,
      hadConflict: false,
      candidates: [],
    };
  }

  // For a single field with multiple provenance entries,
  // they all claim the same value but from different sources
  const candidates = field.provenance.map((p) => ({
    value: field.value,
    provenance: p,
  }));

  return resolveFieldConflict(candidates, config);
}

// ============================================================================
// Multi-Source Merge
// ============================================================================

/**
 * Merge values from multiple sources into a single WithMeta field
 * This is used when combining data from different diagnostic runs
 *
 * @param sources - Array of source contributions
 * @param config - Resolution configuration
 * @returns Merged field with winning value and all provenance
 */
export function mergeSourceValues<T>(
  sources: Array<{ value: T | null; provenance: ProvenanceTag }>,
  config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG
): WithMetaType<T> {
  if (sources.length === 0) {
    return {
      value: null,
      provenance: [],
    };
  }

  // Filter out null values for resolution (but keep provenance)
  const nonNullSources = sources.filter((s) => s.value !== null);

  if (nonNullSources.length === 0) {
    // All values are null, keep provenance anyway
    return {
      value: null,
      provenance: sources.map((s) => normalizeProvenance(s.provenance)),
    };
  }

  // Resolve which value wins
  const resolution = resolveFieldConflict(nonNullSources, config);

  // Collect all provenance, sorted by score
  const allProvenance = sources
    .map((s) => ({
      provenance: normalizeProvenance(s.provenance),
      score: calculateProvenanceScore(s.provenance, config),
    }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.provenance);

  return {
    value: resolution.value,
    provenance: allProvenance,
  };
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect if a field has conflicting values from different sources
 */
export interface ConflictInfo {
  hasConflict: boolean;
  conflictingSources: string[];
  confidenceSpread: number; // Difference between highest and lowest confidence
  recommendedResolution: 'auto' | 'manual_review';
}

/**
 * Analyze a field for conflicts
 */
export function detectConflict<T>(
  candidates: Array<{ value: T | null; provenance: ProvenanceTag }>
): ConflictInfo {
  if (candidates.length <= 1) {
    return {
      hasConflict: false,
      conflictingSources: [],
      confidenceSpread: 0,
      recommendedResolution: 'auto',
    };
  }

  // Group by value
  const valueGroups = new Map<string, ProvenanceTag[]>();
  for (const c of candidates) {
    const key = JSON.stringify(c.value);
    const existing = valueGroups.get(key) || [];
    existing.push(c.provenance);
    valueGroups.set(key, existing);
  }

  const hasConflict = valueGroups.size > 1;

  if (!hasConflict) {
    return {
      hasConflict: false,
      conflictingSources: [],
      confidenceSpread: 0,
      recommendedResolution: 'auto',
    };
  }

  // Get all conflicting sources
  const conflictingSources = candidates.map((c) => c.provenance.source);

  // Calculate confidence spread
  const confidences = candidates.map((c) => c.provenance.confidence);
  const maxConf = Math.max(...confidences);
  const minConf = Math.min(...confidences);
  const confidenceSpread = maxConf - minConf;

  // Recommend manual review if:
  // - High confidence sources disagree
  // - User source is being overridden
  const hasHighConfidenceDisagreement = candidates.some(
    (c) => c.provenance.confidence >= 0.8
  );
  const hasUserSource = candidates.some(
    (c) => c.provenance.source === 'user' || c.provenance.source === 'manual'
  );

  const recommendedResolution =
    hasHighConfidenceDisagreement || hasUserSource ? 'manual_review' : 'auto';

  return {
    hasConflict,
    conflictingSources,
    confidenceSpread,
    recommendedResolution,
  };
}

// ============================================================================
// Batch Conflict Resolution
// ============================================================================

/**
 * Resolve conflicts across an entire domain object
 */
export function resolveDomainsConflicts(
  domain: Record<string, WithMetaType<unknown>>,
  config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG
): Record<string, ConflictResolutionResult<unknown>> {
  const results: Record<string, ConflictResolutionResult<unknown>> = {};

  for (const [fieldName, field] of Object.entries(domain)) {
    if (field && typeof field === 'object' && 'provenance' in field) {
      results[fieldName] = resolveFromProvenance(field, config);
    }
  }

  return results;
}
