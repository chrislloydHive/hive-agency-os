// lib/contextGraph/mutate.ts
// Mutation utilities for Company Context Graph
//
// DOMAIN AUTHORITY ENFORCEMENT:
// - Each context domain has a canonical authority (single source of truth)
// - Only allowed sources may write to a domain
// - User writes are always allowed (userCanOverride: true)
// - Empty values are never written

import { CompanyContextGraph, DomainName, ensureDomain } from './companyContextGraph';
import { ProvenanceTag, WithMetaType, WithMetaArrayType } from './types';
import { saveContextGraph } from './storage';
import {
  canSourceOverwrite,
  isHumanSource,
  type PriorityCheckResult,
} from './sourcePriority';
import { isValidFieldPath } from './schema';
import {
  getDomainForField,
  isSourceAllowedForDomain,
  validateWrite,
  type WriteSource,
  type DomainKey,
} from '@/lib/os/context/domainAuthority';
import {
  logWriteBlockedAuthority,
  logWriteBlockedHumanConfirmed,
} from '@/lib/observability/flowEvents';

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
  | 'fcb'            // Foundational Context Builder - auto-populates from website
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
  | 'competition_lab' // CANONICAL: Only authorized source for competitive.* fields
  | 'competitor_lab'  // DEPRECATED: Use competition_lab
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

// ============================================================================
// DOMAIN AUTHORITY WRITE GATE
// ============================================================================
// CRITICAL: Each domain has a canonical authority (single source of truth)
// This prevents pollution from competing sources

/**
 * Check if a source is authorized to write to a field
 * Uses the domain authority system
 */
function isAuthorizedToWrite(
  domain: string,
  field: string,
  source: string
): { authorized: boolean; reason?: string } {
  const fieldPath = `${domain}.${field}`;
  const validation = validateWrite(fieldPath, source as WriteSource);

  return {
    authorized: validation.allowed,
    reason: validation.reason,
  };
}

/**
 * Check if value is empty (should not be written)
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Strip empty fields from an object
 */
function stripEmptyFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isEmptyValue(value)) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

// Legacy function for backwards compatibility
function isCompetitiveField(domain: string, field: string): boolean {
  if (domain !== 'competitive') return false;
  return true;
}

// Legacy function for backwards compatibility
function isCompetitiveAuthorizedSource(source: string): boolean {
  return source === 'competition_lab' || source === 'user';
}

/**
 * Set a field value with less strict typing
 * Used by diagnostic mappers where field names come from external data
 *
 * IMPORTANT: Respects source priority rules:
 * - Human overrides (user, manual, qbr, strategy) can NEVER be stomped by automation
 * - Higher priority sources can overwrite lower priority
 * - Use options.force to bypass priority checks (for migrations, etc.)
 *
 * DOMAIN AUTHORITY GATE: Each domain has authorized sources
 * EMPTY VALUE GATE: Empty values are never written
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

  // EMPTY VALUE GATE: Never write empty values
  if (!options?.force && isEmptyValue(value)) {
    if (options?.debug) {
      console.log(`[setFieldUntyped] Skipping empty value for ${path}`);
    }
    return graph;
  }

  // DOMAIN AUTHORITY GATE: Check if source is authorized for this domain
  const authCheck = isAuthorizedToWrite(domain, field, provenance.source);
  if (!authCheck.authorized) {
    console.warn(
      `[setFieldUntyped] BLOCKED: ${path} - ${authCheck.reason}`
    );
    // Log flow event for authority block
    logWriteBlockedAuthority(
      graph.companyId,
      domain,
      field,
      provenance.source,
      [] // allowedSources not available from authCheck
    );
    return graph;
  }

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

  // HUMAN CONFIRMED GATE: Prevent AI/Lab overwrites of human-confirmed fields
  if (!options?.force) {
    const latestProvenance = fieldData.provenance?.[0];
    if (latestProvenance?.humanConfirmed) {
      // Only user/manual sources can update human-confirmed fields
      const isUserSource = provenance.source === 'user' || provenance.source === 'manual';
      if (!isUserSource) {
        console.warn(
          `[setFieldUntyped] BLOCKED (humanConfirmed): ${domain}.${field} - ` +
          `Field is human-confirmed, source '${provenance.source}' cannot overwrite. ` +
          `Use force=true or user source to update.`
        );
        // Log flow event for humanConfirmed block
        logWriteBlockedHumanConfirmed(
          graph.companyId,
          domain,
          field,
          provenance.source
        );
        return graph;
      }
    }
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
 *
 * DOMAIN AUTHORITY GATE: Each domain has authorized sources
 * EMPTY VALUE GATE: Empty values are never written
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

  // EMPTY VALUE GATE: Never write empty values
  if (!options?.force && isEmptyValue(value)) {
    return {
      graph,
      result: { updated: false, path, reason: 'empty_value' as PriorityCheckResult['reason'] },
    };
  }

  // DOMAIN AUTHORITY GATE: Check if source is authorized for this domain
  const authCheck = isAuthorizedToWrite(domain, field, provenance.source);
  if (!authCheck.authorized) {
    console.warn(
      `[setFieldUntypedWithResult] BLOCKED: ${path} - ${authCheck.reason}`
    );
    // Log flow event for authority block
    logWriteBlockedAuthority(
      graph.companyId,
      domain,
      field,
      provenance.source,
      []
    );
    return {
      graph,
      result: { updated: false, path, reason: 'blocked_source' },
    };
  }

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

  // HUMAN CONFIRMED GATE: Prevent AI/Lab overwrites of human-confirmed fields
  if (!options?.force) {
    const latestProvenance = fieldData.provenance?.[0];
    if (latestProvenance?.humanConfirmed) {
      const isUserSource = provenance.source === 'user' || provenance.source === 'manual';
      if (!isUserSource) {
        console.warn(
          `[setFieldUntypedWithResult] BLOCKED (humanConfirmed): ${path} - ` +
          `Field is human-confirmed, source '${provenance.source}' cannot overwrite.`
        );
        // Log flow event for humanConfirmed block
        logWriteBlockedHumanConfirmed(
          graph.companyId,
          domain,
          field,
          provenance.source
        );
        return {
          graph,
          result: { updated: false, path, reason: 'human_confirmed' as PriorityCheckResult['reason'] },
        };
      }
    }
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
  // Ensure domain exists (may have been stripped during storage load)
  ensureDomain(graph, domain);

  // Handle case where field doesn't exist (stripped during storage load)
  const fieldData = (graph[domain][field] as WithMetaType<unknown>) || { value: null, provenance: [] };
  const existingProvenance = fieldData.provenance || [];

  // Check source priority unless forced
  if (!options?.force) {
    const priorityCheck = canSourceOverwrite(
      domain,
      existingProvenance,
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
    provenance: [provenance, ...existingProvenance.slice(0, 4)], // Keep last 5 provenances
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
 * DOMAIN AUTHORITY GATE: Each domain has authorized sources
 * EMPTY VALUE GATE: Empty values are never written
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
  // Ensure domain exists (may have been stripped during storage load)
  ensureDomain(graph, domain);

  // Strip empty fields unless forced
  const filteredFields = options?.force ? fields : stripEmptyFields(fields as Record<string, unknown>);

  if (Object.keys(filteredFields).length === 0) {
    if (options?.debug) {
      console.log(`[setDomainFields] All fields empty for ${domain}, skipping`);
    }
    return graph;
  }

  for (const [key, value] of Object.entries(filteredFields)) {
    if (value === undefined) continue;

    // DOMAIN AUTHORITY GATE: Check per-field authorization
    const authCheck = isAuthorizedToWrite(domain, key, provenance.source);
    if (!authCheck.authorized) {
      console.warn(`[setDomainFields] BLOCKED: ${domain}.${key} - ${authCheck.reason}`);
      // Log flow event for authority block
      logWriteBlockedAuthority(
        graph.companyId,
        domain,
        key,
        provenance.source,
        []
      );
      continue;
    }

    const fieldKey = key as keyof CompanyContextGraph[D];
    const rawFieldData = graph[domain][fieldKey] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;

    // Initialize field if it doesn't exist (stripped during storage load)
    const fieldData = rawFieldData || { value: null, provenance: [] };
    const existingProvenance = fieldData.provenance || [];

    // Check source priority unless forced
    if (!options?.force) {
      const priorityCheck = canSourceOverwrite(
        domain,
        existingProvenance,
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

    // Check if this is an array field (based on value type)
    const isArrayField = Array.isArray(fieldData.value) || Array.isArray(value);

    if (isArrayField) {
      (graph[domain][fieldKey] as WithMetaArrayType<unknown>) = {
        value: value as unknown[],
        provenance: [provenance, ...existingProvenance.slice(0, 4)],
      };
    } else {
      (graph[domain][fieldKey] as WithMetaType<unknown>) = {
        value,
        provenance: [provenance, ...existingProvenance.slice(0, 4)],
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
  // Ensure domain exists (may have been stripped during storage load)
  ensureDomain(graph, domain);

  // Strip empty fields unless forced
  const filteredFields = options?.force ? fields : stripEmptyFields(fields as Record<string, unknown>);

  if (Object.keys(filteredFields).length === 0) {
    return {
      graph,
      result: { updated: 0, blocked: 0, blockedPaths: [] },
    };
  }

  let updated = 0;
  let blocked = 0;
  const blockedPaths: string[] = [];

  for (const [key, value] of Object.entries(filteredFields)) {
    if (value === undefined) continue;

    // DOMAIN AUTHORITY GATE: Check per-field authorization
    const authCheck = isAuthorizedToWrite(domain, key, provenance.source);
    if (!authCheck.authorized) {
      blocked++;
      blockedPaths.push(`${domain}.${key}`);
      // Log flow event for authority block
      logWriteBlockedAuthority(
        graph.companyId,
        domain,
        key,
        provenance.source,
        []
      );
      continue;
    }

    const fieldKey = key as keyof CompanyContextGraph[D];
    const rawFieldData = graph[domain][fieldKey] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;

    // Initialize field if it doesn't exist (stripped during storage load)
    const fieldData = rawFieldData || { value: null, provenance: [] };
    const existingProvenance = fieldData.provenance || [];

    // Check source priority unless forced
    if (!options?.force) {
      const priorityCheck = canSourceOverwrite(
        domain,
        existingProvenance,
        provenance.source,
        provenance.confidence
      );

      if (!priorityCheck.canOverwrite) {
        blocked++;
        blockedPaths.push(`${domain}.${key}`);
        continue;
      }
    }

    // Check if this is an array field (based on value type)
    const isArrayField = Array.isArray(fieldData.value) || Array.isArray(value);

    if (isArrayField) {
      (graph[domain][fieldKey] as WithMetaArrayType<unknown>) = {
        value: value as unknown[],
        provenance: [provenance, ...existingProvenance.slice(0, 4)],
      };
    } else {
      (graph[domain][fieldKey] as WithMetaType<unknown>) = {
        value,
        provenance: [provenance, ...existingProvenance.slice(0, 4)],
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

// ============================================================================
// Human Confirmation
// ============================================================================

/**
 * Mark a field as human-confirmed
 *
 * Human-confirmed fields cannot be overwritten by AI/Lab sources
 * unless force=true is used. Only 'user' or 'manual' sources can
 * update confirmed fields.
 *
 * @param graph - The context graph
 * @param domain - Domain name (e.g., 'brand', 'identity')
 * @param field - Field name within the domain
 * @param confirmedBy - Optional user ID for audit trail
 * @returns Updated graph with humanConfirmed flag set
 */
export function confirmField(
  graph: CompanyContextGraph,
  domain: string,
  field: string,
  confirmedBy?: string
): CompanyContextGraph {
  const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
  if (!domainObj || typeof domainObj !== 'object') {
    console.warn(`[confirmField] Domain ${domain} not found`);
    return graph;
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    console.warn(`[confirmField] Field ${domain}.${field} not found`);
    return graph;
  }

  const latestProvenance = fieldData.provenance?.[0];
  if (!latestProvenance) {
    console.warn(`[confirmField] Field ${domain}.${field} has no provenance`);
    return graph;
  }

  // Update provenance with humanConfirmed flag
  const now = new Date().toISOString();
  domainObj[field] = {
    ...fieldData,
    provenance: [
      {
        ...latestProvenance,
        humanConfirmed: true,
        confirmedAt: now,
        confirmedBy,
      },
      ...fieldData.provenance.slice(1),
    ],
  };

  graph.meta.updatedAt = now;
  return graph;
}

/**
 * Remove human-confirmed flag from a field
 *
 * @param graph - The context graph
 * @param domain - Domain name
 * @param field - Field name
 * @returns Updated graph with humanConfirmed flag removed
 */
export function unconfirmField(
  graph: CompanyContextGraph,
  domain: string,
  field: string
): CompanyContextGraph {
  const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
  if (!domainObj || typeof domainObj !== 'object') {
    return graph;
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    return graph;
  }

  const latestProvenance = fieldData.provenance?.[0];
  if (!latestProvenance) {
    return graph;
  }

  // Remove humanConfirmed flag
  const { humanConfirmed, confirmedAt, confirmedBy, ...restProvenance } = latestProvenance;

  domainObj[field] = {
    ...fieldData,
    provenance: [
      restProvenance,
      ...fieldData.provenance.slice(1),
    ],
  };

  graph.meta.updatedAt = new Date().toISOString();
  return graph;
}

/**
 * Check if a field is human-confirmed
 *
 * @param graph - The context graph
 * @param domain - Domain name
 * @param field - Field name
 * @returns true if field is human-confirmed
 */
export function isFieldConfirmed(
  graph: CompanyContextGraph,
  domain: string,
  field: string
): boolean {
  const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
  if (!domainObj || typeof domainObj !== 'object') {
    return false;
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    return false;
  }

  return fieldData.provenance?.[0]?.humanConfirmed === true;
}
