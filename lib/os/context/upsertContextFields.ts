// lib/os/context/upsertContextFields.ts
// Upsert Canonical Context Fields to CompanyContextGraph
//
// This module provides the persistence layer for canonical context fields.
// It writes extracted fields to the appropriate CompanyContextGraph domains
// with proper provenance tracking.

import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph, ensureDomain } from '@/lib/contextGraph/companyContextGraph';
import { createProvenance } from '@/lib/contextGraph/types';
import type { ProvenanceTag, ContextSource } from '@/lib/contextGraph/types';
import type {
  CanonicalFieldKey,
  ContextFieldCandidate,
  ContextFieldRecord,
  ContextFieldStatus,
} from './schema';
import {
  CANONICAL_FIELD_DEFINITIONS,
  getContextGraphPath,
  validateFieldValue,
} from './schema';

// ============================================================================
// Types
// ============================================================================

export interface UpsertResult {
  success: boolean;
  fieldsUpserted: number;
  fieldsSkipped: number;
  updatedPaths: string[];
  skippedPaths: string[];
  errors: string[];
}

export interface UpsertOptions {
  /** Override existing values even if they have higher confidence */
  forceOverwrite?: boolean;
  /** Skip fields that already have values */
  skipExisting?: boolean;
  /** Source identifier for provenance tracking */
  source?: ContextSource;
  /** Skip quality validation (not recommended, use for user input only) */
  skipValidation?: boolean;
}

// ============================================================================
// Field to Context Graph Path Mapping
// ============================================================================

/**
 * Map canonical field key to context graph domain and field.
 * Returns [domain, fieldPath] tuple.
 */
function getGraphLocation(key: CanonicalFieldKey): [string, string] | null {
  const path = getContextGraphPath(key);
  if (!path) return null;

  const parts = path.split('.');
  if (parts.length < 2) return null;

  return [parts[0], parts.slice(1).join('.')];
}

/**
 * Map lab source type to ContextSource enum.
 */
function mapLabToContextSource(lab: string): ContextSource {
  const mapping: Record<string, ContextSource> = {
    'brand': 'brand_lab',
    'audience': 'audience_lab',
    'competitor': 'competition_lab',
    'website': 'website_lab',
    'content': 'content_lab',
    'seo': 'seo_lab',
    'demand': 'demand_lab',
    'ops': 'ops_lab',
    'media': 'media_lab',
    'creative': 'creative_lab',
    'gap': 'gap_full',
  };
  return mapping[lab] || 'inferred';
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert canonical context fields to the CompanyContextGraph.
 *
 * Uses confidence arbitration:
 * - If no existing value, always write
 * - If existing value has lower confidence, overwrite
 * - If existing value has higher or equal confidence, skip (unless forceOverwrite)
 */
export async function upsertContextFields(
  companyId: string,
  companyName: string,
  fields: ContextFieldCandidate[],
  options: UpsertOptions = {}
): Promise<UpsertResult> {
  const result: UpsertResult = {
    success: false,
    fieldsUpserted: 0,
    fieldsSkipped: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  try {
    // Load existing context graph or create new
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = createEmptyContextGraph(companyId, companyName);
    }

    // Process each field
    for (const field of fields) {
      const writeResult = writeFieldToGraph(graph, field, options);

      if (writeResult.written) {
        result.fieldsUpserted++;
        result.updatedPaths.push(writeResult.path);
      } else {
        result.fieldsSkipped++;
        result.skippedPaths.push(writeResult.path);
        if (writeResult.reason) {
          result.errors.push(`${field.key}: ${writeResult.reason}`);
        }
      }
    }

    // Save updated graph
    if (result.fieldsUpserted > 0) {
      await saveContextGraph(graph, options.source || 'inferred');
    }

    result.success = true;
    console.log(`[UpsertContextFields] Upserted ${result.fieldsUpserted}/${fields.length} fields for ${companyId}`);

  } catch (error) {
    console.error('[UpsertContextFields] Error:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Write a single field to the context graph.
 * Returns whether the field was written and the path.
 */
function writeFieldToGraph(
  graph: CompanyContextGraph,
  field: ContextFieldCandidate,
  options: UpsertOptions
): { written: boolean; path: string; reason?: string } {
  const location = getGraphLocation(field.key);
  const path = getContextGraphPath(field.key) || field.key;

  if (!location) {
    return {
      written: false,
      path,
      reason: `No graph path mapping for ${field.key}`,
    };
  }

  // Quality validation (skip for user input if requested)
  if (!options.skipValidation) {
    const valueStr = typeof field.value === 'string'
      ? field.value
      : JSON.stringify(field.value);
    const validation = validateFieldValue(field.key, valueStr);
    if (!validation.valid) {
      console.log(`[UpsertContextFields] Rejected ${field.key}: ${validation.reason}`);
      return {
        written: false,
        path,
        reason: `Quality validation failed: ${validation.reason}`,
      };
    }
  }

  const [domain, fieldPath] = location;

  // Ensure domain exists (may have been stripped during save)
  ensureDomain(graph, domain as DomainName);

  // Get domain object
  const domainObj = (graph as any)[domain];
  if (!domainObj) {
    return {
      written: false,
      path,
      reason: `Domain ${domain} not found in graph`,
    };
  }

  // Navigate to the field (handle nested paths)
  const fieldParts = fieldPath.split('.');
  let target = domainObj;
  for (let i = 0; i < fieldParts.length - 1; i++) {
    target = target[fieldParts[i]];
    if (!target) {
      return {
        written: false,
        path,
        reason: `Path ${fieldPath} not found in domain ${domain}`,
      };
    }
  }

  const finalField = fieldParts[fieldParts.length - 1];
  const existing = target[finalField];

  // Check if we should skip due to skipExisting option
  if (options.skipExisting && existing?.value !== null && existing?.value !== undefined) {
    return {
      written: false,
      path,
      reason: 'skipExisting option set and value exists',
    };
  }

  // Check confidence arbitration (unless forceOverwrite)
  if (!options.forceOverwrite && existing?.provenance?.length > 0) {
    const existingConfidence = existing.provenance[0]?.confidence || 0;
    if (existingConfidence >= field.confidence) {
      return {
        written: false,
        path,
        reason: `Existing confidence (${existingConfidence}) >= new confidence (${field.confidence})`,
      };
    }
  }

  // Build provenance from sources
  const provenance: ProvenanceTag[] = field.sources.map((source) => {
    const contextSource = source.type === 'lab'
      ? mapLabToContextSource(source.lab)
      : source.type === 'gap'
        ? 'gap_full'
        : 'user';

    // Extract runId based on source type (not present on UserFieldSource)
    const runId = source.type === 'lab' || source.type === 'gap'
      ? source.runId
      : undefined;

    return createProvenance(contextSource, field.confidence, {
      runId,
      sourceRunId: runId,
      notes: source.evidence,
    });
  });

  // Write the field with provenance
  target[finalField] = {
    value: field.value,
    provenance: [
      ...provenance,
      ...(existing?.provenance || []),
    ].slice(0, 5), // Keep only last 5 provenance entries
  };

  return {
    written: true,
    path,
  };
}

/**
 * Convert canonical field candidates to ContextFieldRecords.
 * Used for UI display and status tracking.
 */
export function candidatesToRecords(
  candidates: ContextFieldCandidate[],
  status: ContextFieldStatus = 'proposed'
): ContextFieldRecord[] {
  return candidates.map((c) => {
    const def = CANONICAL_FIELD_DEFINITIONS[c.key];
    return {
      key: c.key,
      dimension: def?.dimension || 'BusinessReality',
      label: def?.label || c.key,
      value: c.value,
      confidence: c.confidence,
      status,
      sources: c.sources,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Read current canonical field values from context graph.
 * Returns populated fields with their current status.
 */
export async function readCanonicalFields(
  companyId: string
): Promise<ContextFieldRecord[]> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return [];

  const records: ContextFieldRecord[] = [];

  for (const [key, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    const location = getGraphLocation(key as CanonicalFieldKey);
    if (!location) continue;

    const [domain, fieldPath] = location;
    const domainObj = (graph as any)[domain];
    if (!domainObj) continue;

    // Navigate to field
    const fieldParts = fieldPath.split('.');
    let target = domainObj;
    for (const part of fieldParts.slice(0, -1)) {
      target = target?.[part];
      if (!target) break;
    }

    const finalField = fieldParts[fieldParts.length - 1];
    const fieldData = target?.[finalField];

    if (fieldData?.value !== null && fieldData?.value !== undefined) {
      // Determine status from provenance
      const latestProvenance = fieldData.provenance?.[0];
      const status: ContextFieldStatus = latestProvenance?.source === 'user'
        ? 'confirmed'
        : 'proposed';

      records.push({
        key: key as CanonicalFieldKey,
        dimension: def.dimension,
        label: def.label,
        value: typeof fieldData.value === 'string'
          ? fieldData.value
          : JSON.stringify(fieldData.value),
        confidence: latestProvenance?.confidence || 0,
        status,
        sources: fieldData.provenance?.map((p: ProvenanceTag) => ({
          type: p.source === 'user' ? 'user' : p.source?.includes('lab') ? 'lab' : 'gap',
          lab: p.source?.replace('_lab', ''),
          runId: p.runId || p.sourceRunId || '',
          evidence: p.notes,
        })) || [],
        updatedAt: latestProvenance?.updatedAt || new Date().toISOString(),
      });
    }
  }

  return records;
}
