// lib/contextGraph/types.ts
// Core types for the Company Context Graph system
//
// The Context Graph is a unified, typed, structured representation of
// everything known about a company across all diagnostic and operational tools.

import { z } from 'zod';

// ============================================================================
// Provenance Tracking
// ============================================================================

/**
 * Context source enum - all possible data sources
 */
export const ContextSource = z.enum([
  'brain',           // Company Brain / Client Brain
  'gap_ia',          // GAP Initial Assessment
  'gap_full',        // Full GAP Report
  'gap_heavy',       // Heavy GAP Worker
  'website_lab',     // Website Lab diagnostic
  'brand_lab',       // Brand Lab diagnostic
  'content_lab',     // Content Lab diagnostic
  'seo_lab',         // SEO Lab diagnostic
  'demand_lab',      // Demand Lab diagnostic
  'ops_lab',         // Ops Lab diagnostic
  'audience_lab',    // Audience Lab - curated audience model
  'audience_personas', // Audience Personas - human-centered personas from segments
  'media_profile',   // Media Profile configuration
  'media_lab',       // Media Lab plan data
  'media_cockpit',   // Media Cockpit optimization
  'media_memory',    // Historical media performance
  'creative_lab',    // Creative Lab diagnostic
  'manual',          // Manual user entry
  'user',            // Direct user input (highest priority)
  'inferred',        // AI-inferred value
  'airtable',        // Direct Airtable field
  'analytics_ga4',   // GA4 analytics data
  'analytics_gsc',   // Google Search Console data
  'analytics_gads',  // Google Ads data
  'analytics_lsa',   // Local Services Ads data
  'analytics_gbp',   // Google Business Profile data
  'external_enrichment', // External data enrichment
]);

export type ContextSource = z.infer<typeof ContextSource>;

/**
 * A provenance tag tracks the source and confidence of a field value.
 * This enables full traceability of where data came from.
 */
export const ProvenanceTag = z.object({
  /** Source system that provided this value */
  source: ContextSource,
  /** Optional source run ID for linking to specific diagnostic run */
  sourceRunId: z.string().optional(),
  /** Confidence score 0-1 (1 = highest confidence) */
  confidence: z.number().min(0).max(1),
  /** ISO timestamp when this provenance was recorded (P2: renamed from timestamp for clarity) */
  updatedAt: z.string(),
  /** Optional run ID for linking to source diagnostic (P1 compat - use sourceRunId) */
  runId: z.string().optional(),
  /** Optional notes about the extraction */
  notes: z.string().optional(),
  /** How many days this value is expected to remain valid (P2: freshness decay) */
  validForDays: z.number().optional(),
});

export type ProvenanceTag = z.infer<typeof ProvenanceTag>;

// ============================================================================
// WithMeta Wrapper
// ============================================================================

/**
 * WithMeta wraps any value with provenance tracking.
 * This is the core building block of the Context Graph.
 *
 * @example
 * {
 *   value: "Lead Generation",
 *   provenance: [
 *     { source: "gap_ia", confidence: 0.9, timestamp: "2024-01-15T..." },
 *     { source: "brain", confidence: 0.85, timestamp: "2024-01-10T..." }
 *   ]
 * }
 */
export function WithMeta<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    /** The actual value */
    value: valueSchema.nullable(),
    /** Array of provenance tags, ordered by most recent first */
    provenance: z.array(ProvenanceTag).default([]),
  });
}

/**
 * WithMetaArray wraps an array value with provenance tracking.
 * Used for fields that are naturally arrays (segments, channels, etc.)
 */
export function WithMetaArray<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    /** The array value */
    value: z.array(itemSchema).default([]),
    /** Array of provenance tags */
    provenance: z.array(ProvenanceTag).default([]),
  });
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Infer the TypeScript type of a WithMeta field
 */
export type WithMetaType<T> = {
  value: T | null;
  provenance: ProvenanceTag[];
};

/**
 * Infer the TypeScript type of a WithMetaArray field
 */
export type WithMetaArrayType<T> = {
  value: T[];
  provenance: ProvenanceTag[];
};

/**
 * Create an empty WithMeta field
 */
export function emptyMeta<T>(defaultValue: T | null = null): WithMetaType<T> {
  return {
    value: defaultValue,
    provenance: [],
  };
}

/**
 * Create an empty WithMetaArray field
 */
export function emptyMetaArray<T>(): WithMetaArrayType<T> {
  return {
    value: [],
    provenance: [],
  };
}

/**
 * Create a provenance tag for a given source
 *
 * @param source - The data source
 * @param confidence - Confidence score 0-1
 * @param options - Additional options
 */
export function createProvenance(
  source: ContextSource,
  confidence: number,
  options?: {
    runId?: string;
    sourceRunId?: string;
    notes?: string;
    validForDays?: number;
  }
): ProvenanceTag {
  return {
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
    updatedAt: new Date().toISOString(),
    runId: options?.runId,
    sourceRunId: options?.sourceRunId,
    notes: options?.notes,
    validForDays: options?.validForDays,
  };
}

/**
 * Default validity periods by source type (in days)
 * Used when validForDays is not explicitly set
 */
export const DEFAULT_VALIDITY_DAYS: Record<ContextSource, number> = {
  user: 365,              // User input stays valid for a year
  manual: 365,            // Manual entries stay valid for a year
  media_lab: 180,         // Media plans valid for 6 months
  media_cockpit: 90,      // Optimization data valid for 3 months
  media_memory: 180,      // Historical media data valid for 6 months
  media_profile: 180,     // Media profiles valid for 6 months
  creative_lab: 90,       // Creative analysis valid for 3 months
  audience_lab: 120,      // Audience model valid for 4 months
  audience_personas: 120, // Audience personas valid for 4 months
  gap_heavy: 120,         // Heavy analysis valid for 4 months
  gap_full: 90,           // Full GAP valid for 3 months
  gap_ia: 60,             // Initial assessment valid for 2 months
  website_lab: 60,        // Website analysis valid for 2 months
  brand_lab: 120,         // Brand analysis valid for 4 months
  content_lab: 90,        // Content analysis valid for 3 months
  seo_lab: 60,            // SEO analysis valid for 2 months
  demand_lab: 60,         // Demand analysis valid for 2 months
  ops_lab: 90,            // Ops analysis valid for 3 months
  brain: 90,              // Brain insights valid for 3 months
  analytics_ga4: 30,      // Analytics data valid for 1 month
  analytics_gsc: 30,      // Search Console data valid for 1 month
  analytics_gads: 30,     // Ads data valid for 1 month
  analytics_lsa: 30,      // LSA data valid for 1 month
  analytics_gbp: 30,      // GBP data valid for 1 month
  airtable: 365,          // CRM data valid for a year
  inferred: 30,           // AI inferences valid for 1 month
  external_enrichment: 60, // External data valid for 2 months
};

/**
 * Get the highest confidence provenance from an array
 */
export function getHighestConfidence(provenance: ProvenanceTag[]): ProvenanceTag | undefined {
  if (provenance.length === 0) return undefined;
  return provenance.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

/**
 * Get the most recent provenance from an array
 */
export function getMostRecent(provenance: ProvenanceTag[]): ProvenanceTag | undefined {
  if (provenance.length === 0) return undefined;
  return provenance.reduce((latest, current) => {
    // Support both updatedAt (P2) and timestamp (P1 compat)
    const currentTime = current.updatedAt || (current as any).timestamp;
    const latestTime = latest.updatedAt || (latest as any).timestamp;
    return new Date(currentTime) > new Date(latestTime) ? current : latest;
  });
}

/**
 * Normalize a provenance tag to P2 format
 * Converts P1 `timestamp` field to P2 `updatedAt`
 */
export function normalizeProvenance(tag: ProvenanceTag | any): ProvenanceTag {
  // Handle P1 format with `timestamp` instead of `updatedAt`
  if (!tag.updatedAt && tag.timestamp) {
    return {
      ...tag,
      updatedAt: tag.timestamp,
    };
  }
  return tag;
}

/**
 * Normalize all provenance tags in an array
 */
export function normalizeProvenanceArray(tags: (ProvenanceTag | any)[]): ProvenanceTag[] {
  return tags.map(normalizeProvenance);
}
