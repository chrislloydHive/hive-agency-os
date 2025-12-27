// lib/contextGraph/materializeV4.ts
// Context Graph V4: Materialization Layer
//
// This module syncs confirmed V4 fields to the existing Context Graph
// for backward compatibility with Strategy and Work surfaces.
//
// When a user confirms a field in V4, it materializes to the existing
// Context Graph with humanConfirmed=true so it's locked from AI overwrites.

import { loadContextGraph, saveContextGraph } from './storage';
import { getOrCreateContextGraph } from './storage';
import { setFieldUntyped, createProvenance } from './mutate';
import { loadContextFieldsV4, getConfirmedFieldsV4 } from './fieldStoreV4';
import { ContextFieldV4, isContextV4Enabled } from '@/lib/types/contextField';
import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';

// ============================================================================
// Materialization
// ============================================================================

/**
 * Materialize all confirmed V4 fields into the existing Context Graph.
 *
 * This ensures backward compatibility with Strategy and Work surfaces
 * that read from the existing Context Graph format.
 *
 * Fields are written with:
 * - source: 'user' (treated as human source)
 * - humanConfirmed: true (locked from AI overwrites)
 * - confidence: 1.0 (highest priority)
 */
export async function materializeConfirmedToGraph(
  companyId: string
): Promise<{
  materialized: number;
  failed: number;
  errors: string[];
}> {
  if (!isContextV4Enabled()) {
    console.warn('[MaterializeV4] V4 not enabled, skipping');
    return { materialized: 0, failed: 0, errors: ['V4 not enabled'] };
  }

  const errors: string[] = [];
  let materialized = 0;
  let failed = 0;

  try {
    // Load V4 confirmed fields
    const confirmedFields = await getConfirmedFieldsV4(companyId);
    if (confirmedFields.length === 0) {
      console.log('[MaterializeV4] No confirmed fields to materialize');
      return { materialized: 0, failed: 0, errors: [] };
    }

    // Load or create the existing context graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      // Get company name from first field's evidence or default
      const companyName = 'Company'; // Will be updated by graph itself
      graph = await getOrCreateContextGraph(companyId, companyName);
    }

    // Materialize each confirmed field
    for (const field of confirmedFields) {
      try {
        const result = materializeFieldToGraph(graph, field);
        if (result.success) {
          materialized++;
        } else {
          failed++;
          errors.push(`${field.key}: ${result.reason}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`${field.key}: ${error.message}`);
      }
    }

    // Save the updated graph
    if (materialized > 0) {
      await saveContextGraph(graph, 'v4_confirmed');
      console.log(`[MaterializeV4] Materialized ${materialized} fields for ${companyId}`);
    }

    return { materialized, failed, errors };
  } catch (error: any) {
    console.error(`[MaterializeV4] Failed to materialize for ${companyId}:`, error);
    return { materialized: 0, failed: 0, errors: [error.message] };
  }
}

/**
 * Materialize a single V4 field to the existing graph.
 *
 * Uses setFieldUntyped with force=true to bypass priority checks,
 * since V4 confirmed fields have already passed user review.
 */
function materializeFieldToGraph(
  graph: CompanyContextGraph,
  field: ContextFieldV4
): { success: boolean; reason?: string } {
  const [domain, ...fieldParts] = field.key.split('.');
  const fieldName = fieldParts.join('.');

  if (!domain || !fieldName) {
    return { success: false, reason: 'Invalid key format' };
  }

  // Create provenance with humanConfirmed flag
  const provenance: ProvenanceTag = {
    source: 'user', // Treat as user source for priority
    confidence: 1.0,
    updatedAt: field.updatedAt,
    humanConfirmed: true, // Lock from AI overwrites
    humanEdited: field.humanEdited ?? false, // Track if user modified the value
    confirmedAt: field.lockedAt,
    confirmedBy: field.lockedBy,
    sourceRunId: field.evidence?.runId,
    notes: `Confirmed via V4 review (original source: ${field.source})${field.humanEdited ? ', human edited' : ''}`,
  };

  // Write to graph with force=true to bypass checks
  // V4 confirmed fields have already been user-approved
  setFieldUntyped(graph, domain, fieldName, field.value, provenance, {
    force: true, // Bypass priority checks - user has confirmed
    debug: false,
  });

  return { success: true };
}

/**
 * Materialize a specific set of fields (called after confirm/update).
 *
 * More efficient than full materialization when only a few fields changed.
 */
export async function materializeFieldsToGraph(
  companyId: string,
  keys: string[]
): Promise<{
  materialized: number;
  failed: number;
  errors: string[];
}> {
  if (!isContextV4Enabled()) {
    return { materialized: 0, failed: 0, errors: ['V4 not enabled'] };
  }

  const errors: string[] = [];
  let materialized = 0;
  let failed = 0;

  try {
    // Load V4 store
    const store = await loadContextFieldsV4(companyId);
    if (!store) {
      return { materialized: 0, failed: 0, errors: ['No V4 store found'] };
    }

    // Get only the confirmed fields from the specified keys
    const fieldsToMaterialize: ContextFieldV4[] = [];
    for (const key of keys) {
      const field = store.fields[key];
      if (field?.status === 'confirmed') {
        fieldsToMaterialize.push(field);
      }
    }

    if (fieldsToMaterialize.length === 0) {
      return { materialized: 0, failed: 0, errors: [] };
    }

    // Load or create graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = await getOrCreateContextGraph(companyId, 'Company');
    }

    // Materialize each field
    for (const field of fieldsToMaterialize) {
      try {
        const result = materializeFieldToGraph(graph, field);
        if (result.success) {
          materialized++;
        } else {
          failed++;
          errors.push(`${field.key}: ${result.reason}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`${field.key}: ${error.message}`);
      }
    }

    // Save
    if (materialized > 0) {
      await saveContextGraph(graph, 'v4_confirmed');
    }

    return { materialized, failed, errors };
  } catch (error: any) {
    return { materialized: 0, failed: 0, errors: [error.message] };
  }
}

/**
 * Check if a field exists in both V4 store and Context Graph.
 * Used for verification after materialization.
 */
export async function verifyMaterialization(
  companyId: string,
  key: string
): Promise<{
  inV4: boolean;
  inGraph: boolean;
  v4Value: unknown;
  graphValue: unknown;
  match: boolean;
}> {
  const store = await loadContextFieldsV4(companyId);
  const graph = await loadContextGraph(companyId);

  const v4Field = store?.fields[key];
  const [domain, ...fieldParts] = key.split('.');
  const fieldName = fieldParts.join('.');

  let graphValue: unknown = undefined;
  if (graph && domain && fieldName) {
    const domainObj = (graph as any)[domain];
    if (domainObj && domainObj[fieldName]) {
      graphValue = domainObj[fieldName].value;
    }
  }

  const v4Value = v4Field?.value;

  return {
    inV4: !!v4Field,
    inGraph: graphValue !== undefined,
    v4Value,
    graphValue,
    match: JSON.stringify(v4Value) === JSON.stringify(graphValue),
  };
}
