// lib/contextGraph/freshness.ts
// Freshness & Decay Scoring (Phase 2)
//
// Provides field-level freshness scoring with time-based decay.
// Values become "stale" over time based on their validForDays setting.

import type { ProvenanceTag, WithMetaType } from './types';
import { DEFAULT_VALIDITY_DAYS, normalizeProvenance } from './types';

// ============================================================================
// Freshness Calculation
// ============================================================================

/**
 * Freshness score result for a single field
 */
export interface FreshnessScore {
  /** Freshness value 0-1 (1 = completely fresh, 0 = completely stale) */
  score: number;
  /** Age in days since last update */
  ageDays: number;
  /** Expected validity period in days */
  validForDays: number;
  /** Percentage of validity consumed */
  decayPercent: number;
  /** Human-readable freshness label */
  label: 'fresh' | 'aging' | 'stale' | 'expired';
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** Source that provided the value */
  source: string;
}

/**
 * Calculate freshness score for a provenance tag
 *
 * @param provenance - The provenance tag to score
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Freshness score details
 */
export function calculateFreshness(
  provenance: ProvenanceTag,
  referenceDate: Date = new Date()
): FreshnessScore {
  const normalized = normalizeProvenance(provenance);
  const updatedAt = new Date(normalized.updatedAt);
  const ageMs = referenceDate.getTime() - updatedAt.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));

  // Get validity period (use explicit value or default for source)
  const validForDays =
    normalized.validForDays ??
    DEFAULT_VALIDITY_DAYS[normalized.source as keyof typeof DEFAULT_VALIDITY_DAYS] ??
    90;

  // Calculate decay (linear decay over validity period)
  const decayPercent = Math.min(100, (ageDays / validForDays) * 100);
  const score = Math.max(0, Math.min(1, 1 - ageDays / validForDays));

  // Determine label
  let label: FreshnessScore['label'];
  if (score >= 0.75) {
    label = 'fresh';
  } else if (score >= 0.5) {
    label = 'aging';
  } else if (score > 0) {
    label = 'stale';
  } else {
    label = 'expired';
  }

  return {
    score: Math.round(score * 1000) / 1000,
    ageDays: Math.round(ageDays * 10) / 10,
    validForDays,
    decayPercent: Math.round(decayPercent * 10) / 10,
    label,
    lastUpdated: normalized.updatedAt,
    source: normalized.source,
  };
}

/**
 * Calculate freshness for a WithMeta field
 * Uses the most recent provenance entry
 */
export function getFieldFreshness<T>(
  field: WithMetaType<T>,
  referenceDate: Date = new Date()
): FreshnessScore | null {
  if (!field.provenance || field.provenance.length === 0) {
    return null;
  }

  // Find most recent provenance
  const sorted = [...field.provenance]
    .map(normalizeProvenance)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return calculateFreshness(sorted[0], referenceDate);
}

// ============================================================================
// Aggregate Freshness
// ============================================================================

/**
 * Aggregate freshness for a domain (collection of fields)
 */
export interface DomainFreshness {
  /** Average freshness across all fields */
  averageScore: number;
  /** Number of fresh fields (score >= 0.75) */
  freshCount: number;
  /** Number of aging fields (0.5 <= score < 0.75) */
  agingCount: number;
  /** Number of stale fields (0 < score < 0.5) */
  staleCount: number;
  /** Number of expired fields (score = 0) */
  expiredCount: number;
  /** Number of fields with no data */
  emptyCount: number;
  /** Total number of fields */
  totalFields: number;
  /** Fields that need immediate attention (expired or stale) */
  needsAttention: string[];
  /** Overall domain freshness label */
  overallLabel: 'healthy' | 'attention_needed' | 'critical';
}

/**
 * Calculate aggregate freshness for a domain object
 */
export function getDomainFreshness(
  domain: Record<string, WithMetaType<unknown>>,
  referenceDate: Date = new Date()
): DomainFreshness {
  const fieldNames = Object.keys(domain);
  const scores: FreshnessScore[] = [];
  const needsAttention: string[] = [];
  let emptyCount = 0;

  for (const fieldName of fieldNames) {
    const field = domain[fieldName];
    if (!field || typeof field !== 'object' || !('provenance' in field)) {
      continue;
    }

    const freshness = getFieldFreshness(field as WithMetaType<unknown>, referenceDate);

    if (!freshness) {
      emptyCount++;
      continue;
    }

    scores.push(freshness);

    if (freshness.label === 'stale' || freshness.label === 'expired') {
      needsAttention.push(fieldName);
    }
  }

  const freshCount = scores.filter((s) => s.label === 'fresh').length;
  const agingCount = scores.filter((s) => s.label === 'aging').length;
  const staleCount = scores.filter((s) => s.label === 'stale').length;
  const expiredCount = scores.filter((s) => s.label === 'expired').length;

  const averageScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

  // Determine overall label
  let overallLabel: DomainFreshness['overallLabel'];
  const staleRatio = (staleCount + expiredCount) / Math.max(1, scores.length);

  if (staleRatio >= 0.5) {
    overallLabel = 'critical';
  } else if (staleRatio > 0.2 || expiredCount > 0) {
    overallLabel = 'attention_needed';
  } else {
    overallLabel = 'healthy';
  }

  return {
    averageScore: Math.round(averageScore * 1000) / 1000,
    freshCount,
    agingCount,
    staleCount,
    expiredCount,
    emptyCount,
    totalFields: fieldNames.length,
    needsAttention,
    overallLabel,
  };
}

// ============================================================================
// Graph-Level Freshness
// ============================================================================

/**
 * Complete freshness report for a context graph
 */
export interface GraphFreshnessReport {
  /** Overall freshness score (weighted average) */
  overallScore: number;
  /** Overall health label */
  overallLabel: 'healthy' | 'attention_needed' | 'critical';
  /** Freshness by domain */
  byDomain: Record<string, DomainFreshness>;
  /** All fields that need attention */
  allNeedsAttention: Array<{ domain: string; field: string; score: number }>;
  /** Timestamp of analysis */
  analyzedAt: string;
  /** Summary statistics */
  summary: {
    totalFields: number;
    freshFields: number;
    staleFields: number;
    emptyFields: number;
    freshPercent: number;
  };
}

/**
 * Get comprehensive freshness report for a context graph
 */
export function getGraphFreshnessReport(
  graph: Record<string, unknown>,
  referenceDate: Date = new Date()
): GraphFreshnessReport {
  const byDomain: Record<string, DomainFreshness> = {};
  const allNeedsAttention: Array<{ domain: string; field: string; score: number }> = [];

  // Domain weights for overall score (more important domains weighted higher)
  const domainWeights: Record<string, number> = {
    identity: 1.2,
    objectives: 1.3,
    audience: 1.1,
    budgetOps: 1.2,
    performanceMedia: 1.3,
    digitalInfra: 1.0,
    brand: 0.9,
    content: 0.8,
    seo: 0.9,
    website: 0.9,
    ops: 0.8,
    storeRisk: 0.7,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  let totalFields = 0;
  let freshFields = 0;
  let staleFields = 0;
  let emptyFields = 0;

  for (const [domainName, domain] of Object.entries(graph)) {
    // Skip meta and non-object fields
    if (
      domainName === 'meta' ||
      domainName === 'companyId' ||
      domainName === 'companyName' ||
      typeof domain !== 'object' ||
      domain === null
    ) {
      continue;
    }

    const domainFreshness = getDomainFreshness(
      domain as Record<string, WithMetaType<unknown>>,
      referenceDate
    );

    byDomain[domainName] = domainFreshness;

    // Add to weighted average
    const weight = domainWeights[domainName] ?? 1.0;
    totalWeight += weight;
    weightedSum += domainFreshness.averageScore * weight;

    // Collect needs attention
    for (const field of domainFreshness.needsAttention) {
      const fieldObj = (domain as Record<string, WithMetaType<unknown>>)[field];
      const freshness = fieldObj ? getFieldFreshness(fieldObj, referenceDate) : null;
      allNeedsAttention.push({
        domain: domainName,
        field,
        score: freshness?.score ?? 0,
      });
    }

    // Aggregate stats
    totalFields += domainFreshness.totalFields;
    freshFields += domainFreshness.freshCount;
    staleFields += domainFreshness.staleCount + domainFreshness.expiredCount;
    emptyFields += domainFreshness.emptyCount;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Determine overall label
  let overallLabel: GraphFreshnessReport['overallLabel'];
  const criticalDomains = Object.values(byDomain).filter(
    (d) => d.overallLabel === 'critical'
  ).length;

  if (criticalDomains >= 2 || overallScore < 0.3) {
    overallLabel = 'critical';
  } else if (criticalDomains >= 1 || overallScore < 0.6) {
    overallLabel = 'attention_needed';
  } else {
    overallLabel = 'healthy';
  }

  // Sort needs attention by score (most urgent first)
  allNeedsAttention.sort((a, b) => a.score - b.score);

  return {
    overallScore: Math.round(overallScore * 1000) / 1000,
    overallLabel,
    byDomain,
    allNeedsAttention,
    analyzedAt: referenceDate.toISOString(),
    summary: {
      totalFields,
      freshFields,
      staleFields,
      emptyFields,
      freshPercent:
        totalFields > 0
          ? Math.round((freshFields / (totalFields - emptyFields)) * 100)
          : 0,
    },
  };
}

// ============================================================================
// Freshness Utilities
// ============================================================================

/**
 * Check if a field is fresh (score >= threshold)
 */
export function isFresh<T>(
  field: WithMetaType<T>,
  threshold: number = 0.5
): boolean {
  const freshness = getFieldFreshness(field);
  return freshness !== null && freshness.score >= threshold;
}

/**
 * Check if a field is stale (score < threshold)
 */
export function isStale<T>(
  field: WithMetaType<T>,
  threshold: number = 0.5
): boolean {
  const freshness = getFieldFreshness(field);
  return freshness === null || freshness.score < threshold;
}

/**
 * Get estimated days until a field becomes stale
 */
export function daysUntilStale<T>(
  field: WithMetaType<T>,
  staleThreshold: number = 0.5
): number | null {
  const freshness = getFieldFreshness(field);
  if (!freshness) return null;

  // Calculate how many more days until score drops below threshold
  // score = 1 - ageDays/validForDays
  // threshold = 1 - (ageDays + remainingDays)/validForDays
  // remainingDays = validForDays * (score - threshold)

  const remainingDays = freshness.validForDays * (freshness.score - staleThreshold);
  return Math.max(0, Math.round(remainingDays));
}

/**
 * Format freshness for display
 */
export function formatFreshness(freshness: FreshnessScore): string {
  const percentage = Math.round(freshness.score * 100);

  if (freshness.label === 'fresh') {
    return `Fresh (${percentage}%)`;
  } else if (freshness.label === 'aging') {
    return `Aging (${percentage}%) - Updated ${Math.round(freshness.ageDays)} days ago`;
  } else if (freshness.label === 'stale') {
    return `Stale (${percentage}%) - Needs refresh`;
  } else {
    return `Expired - Last updated ${Math.round(freshness.ageDays)} days ago`;
  }
}

/**
 * Stale field info
 */
export interface StaleFieldInfo {
  /** Path to the field (domain.field) */
  path: string;
  /** Freshness score 0-1 */
  score: number;
  /** Days since last update */
  ageDays: number;
  /** The source that provided the value */
  source: string;
}

/**
 * Get list of stale fields from a context graph
 *
 * Returns fields with freshness score below threshold, sorted by staleness
 */
export function getStaleFields(
  graph: Record<string, unknown>,
  threshold: number = 0.5,
  referenceDate: Date = new Date()
): StaleFieldInfo[] {
  const report = getGraphFreshnessReport(graph, referenceDate);
  const staleFields: StaleFieldInfo[] = [];

  for (const [domainName, domainFreshness] of Object.entries(report.byDomain)) {
    const domain = graph[domainName] as Record<string, WithMetaType<unknown>> | undefined;
    if (!domain) continue;

    for (const fieldName of domainFreshness.needsAttention) {
      const field = domain[fieldName];
      if (!field) continue;

      const freshness = getFieldFreshness(field, referenceDate);
      if (freshness && freshness.score < threshold) {
        staleFields.push({
          path: `${domainName}.${fieldName}`,
          score: freshness.score,
          ageDays: freshness.ageDays,
          source: freshness.source,
        });
      }
    }
  }

  // Sort by score ascending (most stale first)
  staleFields.sort((a, b) => a.score - b.score);

  return staleFields;
}
