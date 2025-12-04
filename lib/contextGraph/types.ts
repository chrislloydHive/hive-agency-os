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
 * A provenance tag tracks the source and confidence of a field value.
 * This enables full traceability of where data came from.
 */
export const ProvenanceTag = z.object({
  /** Source system that provided this value */
  source: z.enum([
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
    'media_profile',   // Media Profile configuration
    'media_lab',       // Media Lab plan data
    'media_cockpit',   // Media Cockpit optimization
    'media_memory',    // Historical media performance
    'manual',          // Manual user entry
    'inferred',        // AI-inferred value
    'airtable',        // Direct Airtable field
  ]),
  /** Confidence score 0-1 (1 = highest confidence) */
  confidence: z.number().min(0).max(1),
  /** ISO timestamp when this provenance was recorded */
  timestamp: z.string().datetime(),
  /** Optional run ID for linking to source diagnostic */
  runId: z.string().optional(),
  /** Optional notes about the extraction */
  notes: z.string().optional(),
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
 */
export function createProvenance(
  source: ProvenanceTag['source'],
  confidence: number,
  runId?: string,
  notes?: string
): ProvenanceTag {
  return {
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
    timestamp: new Date().toISOString(),
    runId,
    notes,
  };
}

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
  return provenance.reduce((latest, current) =>
    new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
  );
}
