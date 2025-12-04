// lib/contextGraph/mutate.ts
// Mutation utilities for Company Context Graph

import { CompanyContextGraph, DomainName } from './companyContextGraph';
import { ProvenanceTag, WithMetaType, WithMetaArrayType } from './types';
import { saveContextGraph } from './storage';

/**
 * Source types for provenance tracking
 */
export type ProvenanceSource =
  | 'brain'
  | 'gap_ia'
  | 'gap_full'
  | 'gap_heavy'
  | 'website_lab'
  | 'brand_lab'
  | 'content_lab'
  | 'seo_lab'
  | 'demand_lab'
  | 'ops_lab'
  | 'audience_lab'
  | 'audience_personas'
  | 'media_profile'
  | 'media_lab'
  | 'media_cockpit'
  | 'media_memory'
  | 'creative_lab'
  | 'manual'
  | 'inferred'
  | 'airtable'
  | 'analytics_ga4'
  | 'analytics_gsc'
  | 'analytics_gads'
  | 'analytics_lsa'
  | 'analytics_gbp'
  | 'external_enrichment';

/**
 * Create a provenance tag
 */
export function createProvenance(
  source: ProvenanceSource,
  options?: {
    confidence?: number;
    runId?: string;
    sourceRunId?: string;
    notes?: string;
    validForDays?: number;
  }
): ProvenanceTag {
  return {
    source: source as ProvenanceTag['source'],
    confidence: options?.confidence ?? 0.8,
    updatedAt: new Date().toISOString(),
    runId: options?.runId,
    sourceRunId: options?.sourceRunId,
    notes: options?.notes,
    validForDays: options?.validForDays,
  };
}

/**
 * Set a field value with less strict typing
 * Used by diagnostic mappers where field names come from external data
 */
export function setFieldUntyped(
  graph: CompanyContextGraph,
  domain: string,
  field: string,
  value: unknown,
  provenance: ProvenanceTag
): CompanyContextGraph {
  const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
  if (!domainObj || typeof domainObj !== 'object') {
    console.warn(`[setFieldUntyped] Domain ${domain} not found`);
    return graph;
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    console.warn(`[setFieldUntyped] Field ${domain}.${field} not found`);
    return graph;
  }

  domainObj[field] = {
    value,
    provenance: [provenance, ...(fieldData.provenance || []).slice(0, 4)],
  };

  graph.meta.updatedAt = new Date().toISOString();
  return graph;
}

/**
 * Set a single field value with provenance
 *
 * Usage:
 * ```typescript
 * setField(graph, 'identity', 'companyName', 'Acme Inc', createProvenance('brain'));
 * ```
 */
export function setField<
  D extends DomainName,
  K extends keyof CompanyContextGraph[D]
>(
  graph: CompanyContextGraph,
  domain: D,
  field: K,
  value: CompanyContextGraph[D][K] extends WithMetaType<infer T> ? T : never,
  provenance: ProvenanceTag
): CompanyContextGraph {
  const fieldData = graph[domain][field] as WithMetaType<unknown>;

  // Replace value and add provenance to front of array
  (graph[domain][field] as WithMetaType<unknown>) = {
    value,
    provenance: [provenance, ...fieldData.provenance.slice(0, 4)], // Keep last 5 provenances
  };

  // Update graph metadata
  graph.meta.updatedAt = new Date().toISOString();

  return graph;
}

/**
 * Merge a field value with existing (for arrays)
 *
 * Usage:
 * ```typescript
 * mergeField(graph, 'identity', 'competitors', ['New Competitor'], createProvenance('gap_ia'));
 * ```
 */
export function mergeField<
  D extends DomainName,
  K extends keyof CompanyContextGraph[D]
>(
  graph: CompanyContextGraph,
  domain: D,
  field: K,
  values: CompanyContextGraph[D][K] extends WithMetaArrayType<infer T> ? T[] : never,
  provenance: ProvenanceTag,
  options?: {
    dedupe?: boolean; // If true, dedupe by value for strings
    prepend?: boolean; // If true, add to front instead of end
  }
): CompanyContextGraph {
  const fieldData = graph[domain][field] as WithMetaArrayType<unknown>;
  const existingValues = fieldData.value || [];

  let newValues: unknown[];

  if (options?.prepend) {
    newValues = [...values, ...existingValues];
  } else {
    newValues = [...existingValues, ...values];
  }

  // Dedupe strings if requested
  if (options?.dedupe) {
    const seen = new Set<string>();
    newValues = newValues.filter((v) => {
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      }
      return true;
    });
  }

  (graph[domain][field] as WithMetaArrayType<unknown>) = {
    value: newValues,
    provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
  };

  graph.meta.updatedAt = new Date().toISOString();

  return graph;
}

/**
 * Set multiple fields at once from a partial domain update
 *
 * Usage:
 * ```typescript
 * setDomainFields(graph, 'identity', {
 *   companyName: 'Acme Inc',
 *   industry: 'SaaS',
 * }, createProvenance('brain'));
 * ```
 */
export function setDomainFields<D extends DomainName>(
  graph: CompanyContextGraph,
  domain: D,
  fields: Partial<{
    [K in keyof CompanyContextGraph[D]]: CompanyContextGraph[D][K] extends WithMetaType<infer T>
      ? T
      : CompanyContextGraph[D][K] extends WithMetaArrayType<infer T>
      ? T[]
      : never;
  }>,
  provenance: ProvenanceTag
): CompanyContextGraph {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    const fieldKey = key as keyof CompanyContextGraph[D];
    const fieldData = graph[domain][fieldKey] as WithMetaType<unknown> | WithMetaArrayType<unknown>;

    // Check if this is an array field
    const isArrayField = Array.isArray(fieldData.value) || (fieldData.value === null && Array.isArray(value));

    if (isArrayField) {
      (graph[domain][fieldKey] as WithMetaArrayType<unknown>) = {
        value: value as unknown[],
        provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
      };
    } else {
      (graph[domain][fieldKey] as WithMetaType<unknown>) = {
        value,
        provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
      };
    }
  }

  graph.meta.updatedAt = new Date().toISOString();

  return graph;
}

/**
 * Batch update: applies multiple domain updates and saves
 *
 * Usage:
 * ```typescript
 * await batchUpdate(graph, [
 *   { domain: 'identity', fields: { companyName: 'Acme' }, provenance },
 *   { domain: 'brand', fields: { brandVoice: 'Professional' }, provenance },
 * ]);
 * ```
 */
export async function batchUpdate(
  graph: CompanyContextGraph,
  updates: Array<{
    domain: DomainName;
    fields: Record<string, unknown>;
    provenance: ProvenanceTag;
  }>
): Promise<CompanyContextGraph> {
  for (const update of updates) {
    setDomainFields(
      graph,
      update.domain,
      update.fields as any,
      update.provenance
    );
  }

  // Save the updated graph
  await saveContextGraph(graph);

  return graph;
}

/**
 * Get the most confident value for a field
 * Returns the value with the highest confidence provenance
 */
export function getMostConfidentValue<T>(
  field: WithMetaType<T>
): { value: T | null; confidence: number; source: ProvenanceSource | null } {
  if (field.value === null) {
    return { value: null, confidence: 0, source: null };
  }

  const topProvenance = field.provenance[0];
  return {
    value: field.value,
    confidence: topProvenance?.confidence ?? 0,
    source: (topProvenance?.source as ProvenanceSource) ?? null,
  };
}

/**
 * Check if a field has a value from a specific source
 */
export function hasValueFromSource<T>(
  field: WithMetaType<T> | WithMetaArrayType<T>,
  source: ProvenanceSource
): boolean {
  return field.provenance.some((p: ProvenanceTag) => p.source === source);
}

/**
 * Get the latest provenance for a field
 */
export function getLatestProvenance<T>(
  field: WithMetaType<T> | WithMetaArrayType<T>
): ProvenanceTag | null {
  return field.provenance[0] ?? null;
}

/**
 * Clear a field (set to null/empty with provenance)
 */
export function clearField<
  D extends DomainName,
  K extends keyof CompanyContextGraph[D]
>(
  graph: CompanyContextGraph,
  domain: D,
  field: K,
  provenance: ProvenanceTag
): CompanyContextGraph {
  const fieldData = graph[domain][field] as WithMetaType<unknown> | WithMetaArrayType<unknown>;

  // Check if this is an array field
  const isArrayField = Array.isArray(fieldData.value);

  if (isArrayField) {
    (graph[domain][field] as WithMetaArrayType<unknown>) = {
      value: [],
      provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
    };
  } else {
    (graph[domain][field] as WithMetaType<unknown>) = {
      value: null,
      provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
    };
  }

  graph.meta.updatedAt = new Date().toISOString();

  return graph;
}

/**
 * Mark last fusion timestamp
 */
export function markFusionComplete(
  graph: CompanyContextGraph,
  runId: string
): CompanyContextGraph {
  graph.meta.lastFusionAt = new Date().toISOString();
  graph.meta.lastFusionRunId = runId;
  graph.meta.updatedAt = new Date().toISOString();
  return graph;
}
