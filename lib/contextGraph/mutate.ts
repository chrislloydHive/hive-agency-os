// lib/contextGraph/mutate.ts
// Mutation utilities for Company Context Graph

import { CompanyContextGraph, DomainName } from './companyContextGraph';
import { ProvenanceTag, WithMetaType, WithMetaArrayType } from './types';
import { saveContextGraph } from './storage';
import {
  canSourceOverwrite,
  isHumanSource,
  type PriorityCheckResult,
} from './sourcePriority';
import { isValidFieldPath } from './schema';

// ============================================================================
// Runtime Validation Configuration
// ============================================================================

/**
 * Whether to log warnings for unknown paths (enable in dev)
 */
const WARN_UNKNOWN_PATHS = process.env.NODE_ENV === 'development';

/**
 * Source types for provenance tracking
 */
export type ProvenanceSource =
  | 'user'           // Direct user edit via UI - HIGHEST PRIORITY
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
  | 'ux_lab'
  | 'manual'
  | 'inferred'
  | 'airtable'
  | 'analytics_ga4'
  | 'analytics_gsc'
  | 'analytics_gads'
  | 'analytics_lsa'
  | 'analytics_gbp'
  | 'external_enrichment'
  | 'setup_wizard'
  | 'qbr'
  | 'strategy'
  | 'import';

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
 * Options for field setting with priority checks
 */
export interface SetFieldOptions {
  /** If true, bypass source priority checks (use with caution) */
  force?: boolean;
  /** If true, log priority decisions for debugging */
  debug?: boolean;
}

/**
 * Result of a field set operation
 */
export interface SetFieldResult {
  /** Whether the field was updated */
  updated: boolean;
  /** Reason for the decision */
  reason?: PriorityCheckResult['reason'];
  /** The field path that was targeted */
  path: string;
}

/**
 * Set a field value with less strict typing
 * Used by diagnostic mappers where field names come from external data
 *
 * IMPORTANT: Respects source priority rules:
 * - Human overrides (user, manual, qbr, strategy) can NEVER be stomped by automation
 * - Higher priority sources can overwrite lower priority
 * - Use options.force to bypass priority checks (for migrations, etc.)
 */
export function setFieldUntyped(
  graph: CompanyContextGraph,
  domain: string,
  field: string,
  value: unknown,
  provenance: ProvenanceTag,
  options?: SetFieldOptions
): CompanyContextGraph {
  const path = `${domain}.${field}`;

  // Runtime validation: warn if path is not in schema
  if (WARN_UNKNOWN_PATHS && !isValidFieldPath(path)) {
    console.warn(
      `[Context Graph] Unknown path written: '${path}' by '${provenance.source}'. ` +
      `Add this field to CONTEXT_FIELDS in schema.ts if it's intentional.`
    );
  }

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

  // Check source priority unless forced
  if (!options?.force) {
    const priorityCheck = canSourceOverwrite(
      domain as DomainName,
      fieldData.provenance || [],
      provenance.source,
      provenance.confidence
    );

    if (!priorityCheck.canOverwrite) {
      if (options?.debug) {
        console.log(
          `[setFieldUntyped] Blocked: ${domain}.${field} - ${priorityCheck.reason}`,
          `(existing: ${fieldData.provenance?.[0]?.source}, new: ${provenance.source})`
        );
      }
      return graph;
    }

    if (options?.debug) {
      console.log(
        `[setFieldUntyped] Allowed: ${domain}.${field} - ${priorityCheck.reason}`,
        `(new: ${provenance.source})`
      );
    }
  }

  domainObj[field] = {
    value,
    provenance: [provenance, ...(fieldData.provenance || []).slice(0, 4)],
  };

  graph.meta.updatedAt = new Date().toISOString();
  return graph;
}

/**
 * Set a field value with priority check result returned
 * Use this when you need to know if the write was blocked
 */
export function setFieldUntypedWithResult(
  graph: CompanyContextGraph,
  domain: string,
  field: string,
  value: unknown,
  provenance: ProvenanceTag,
  options?: SetFieldOptions
): { graph: CompanyContextGraph; result: SetFieldResult } {
  const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
  const path = `${domain}.${field}`;

  // Runtime validation: warn if path is not in schema
  if (WARN_UNKNOWN_PATHS && !isValidFieldPath(path)) {
    console.warn(
      `[Context Graph] Unknown path written: '${path}' by '${provenance.source}'. ` +
      `Add this field to CONTEXT_FIELDS in schema.ts if it's intentional.`
    );
  }

  if (!domainObj || typeof domainObj !== 'object') {
    return {
      graph,
      result: { updated: false, path, reason: 'blocked_source' },
    };
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    return {
      graph,
      result: { updated: false, path, reason: 'blocked_source' },
    };
  }

  // Check source priority unless forced
  if (!options?.force) {
    const priorityCheck = canSourceOverwrite(
      domain as DomainName,
      fieldData.provenance || [],
      provenance.source,
      provenance.confidence
    );

    if (!priorityCheck.canOverwrite) {
      return {
        graph,
        result: { updated: false, path, reason: priorityCheck.reason },
      };
    }
  }

  domainObj[field] = {
    value,
    provenance: [provenance, ...(fieldData.provenance || []).slice(0, 4)],
  };

  graph.meta.updatedAt = new Date().toISOString();

  return {
    graph,
    result: { updated: true, path },
  };
}

/**
 * Set a single field value with provenance
 *
 * IMPORTANT: Respects source priority rules:
 * - Human overrides can NEVER be stomped by automation
 * - Use options.force to bypass priority checks
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
  provenance: ProvenanceTag,
  options?: SetFieldOptions
): CompanyContextGraph {
  const fieldData = graph[domain][field] as WithMetaType<unknown>;

  // Check source priority unless forced
  if (!options?.force) {
    const priorityCheck = canSourceOverwrite(
      domain,
      fieldData.provenance || [],
      provenance.source,
      provenance.confidence
    );

    if (!priorityCheck.canOverwrite) {
      if (options?.debug) {
        console.log(
          `[setField] Blocked: ${domain}.${String(field)} - ${priorityCheck.reason}`
        );
      }
      return graph;
    }
  }

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
 * Result of setDomainFields operation
 */
export interface SetDomainFieldsResult {
  /** Number of fields that were updated */
  updated: number;
  /** Number of fields that were blocked by priority rules */
  blocked: number;
  /** Paths of fields that were blocked */
  blockedPaths: string[];
}

/**
 * Set multiple fields at once from a partial domain update
 *
 * IMPORTANT: Respects source priority rules per field.
 * Fields with human overrides will be skipped unless force=true.
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
  provenance: ProvenanceTag,
  options?: SetFieldOptions
): CompanyContextGraph {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    const fieldKey = key as keyof CompanyContextGraph[D];
    const fieldData = graph[domain][fieldKey] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;

    // Skip if field doesn't exist in the domain schema
    if (!fieldData || typeof fieldData !== 'object' || !('provenance' in fieldData)) {
      console.warn(`[setDomainFields] Skipping unknown field ${domain}.${key}`);
      continue;
    }

    // Check source priority unless forced
    if (!options?.force) {
      const priorityCheck = canSourceOverwrite(
        domain,
        fieldData.provenance || [],
        provenance.source,
        provenance.confidence
      );

      if (!priorityCheck.canOverwrite) {
        if (options?.debug) {
          console.log(
            `[setDomainFields] Blocked: ${domain}.${key} - ${priorityCheck.reason}`
          );
        }
        continue;
      }
    }

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
 * Set multiple fields with result tracking
 * Returns information about which fields were updated vs blocked
 */
export function setDomainFieldsWithResult<D extends DomainName>(
  graph: CompanyContextGraph,
  domain: D,
  fields: Partial<{
    [K in keyof CompanyContextGraph[D]]: CompanyContextGraph[D][K] extends WithMetaType<infer T>
      ? T
      : CompanyContextGraph[D][K] extends WithMetaArrayType<infer T>
      ? T[]
      : never;
  }>,
  provenance: ProvenanceTag,
  options?: SetFieldOptions
): { graph: CompanyContextGraph; result: SetDomainFieldsResult } {
  let updated = 0;
  let blocked = 0;
  const blockedPaths: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    const fieldKey = key as keyof CompanyContextGraph[D];
    const fieldData = graph[domain][fieldKey] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;

    // Skip if field doesn't exist in the domain schema
    if (!fieldData || typeof fieldData !== 'object' || !('provenance' in fieldData)) {
      continue;
    }

    // Check source priority unless forced
    if (!options?.force) {
      const priorityCheck = canSourceOverwrite(
        domain,
        fieldData.provenance || [],
        provenance.source,
        provenance.confidence
      );

      if (!priorityCheck.canOverwrite) {
        blocked++;
        blockedPaths.push(`${domain}.${key}`);
        continue;
      }
    }

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

    updated++;
  }

  graph.meta.updatedAt = new Date().toISOString();

  return {
    graph,
    result: { updated, blocked, blockedPaths },
  };
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
 * Update a single field and persist with summary recalculation
 * This is the main entry point for UI edits and Lab writes
 *
 * @returns Updated graph and summary info
 */
export async function updateFieldAndSave(
  companyId: string,
  path: string,
  value: unknown,
  provenance: ProvenanceTag
): Promise<{
  graph: CompanyContextGraph;
  summary: { health: number; completeness: number } | null;
}> {
  // Lazy import to avoid circular dependency
  const { loadContextGraph } = await import('./storage');
  const { calculateGraphSummary } = await import('./sectionSummary');

  const graph = await loadContextGraph(companyId);
  if (!graph) {
    throw new Error(`No context graph found for company ${companyId}`);
  }

  // Parse path
  const [domain, ...fieldParts] = path.split('.');
  const field = fieldParts.join('.');

  if (!field) {
    throw new Error(`Invalid path: ${path}`);
  }

  // Update the field
  setFieldUntyped(graph, domain, field, value, provenance);

  // Save the graph
  await saveContextGraph(graph);

  // Calculate updated summary
  const summary = calculateGraphSummary(graph);

  // Log for debugging
  console.log(`[MergeField] Updated ${path} for ${companyId}: health=${Math.round(summary.health * 100)}%, completeness=${Math.round(summary.completeness * 100)}%`);

  return {
    graph,
    summary: {
      health: summary.health,
      completeness: summary.completeness,
    },
  };
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
