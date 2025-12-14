// lib/contextGraph/nodes/applyProposal.ts
// Apply accepted proposals to the context graph
//
// When a proposal is accepted, this module applies the value to the
// canonical context graph with proper provenance tracking.

import type { CompanyContextGraph } from '../companyContextGraph';
import type { ProvenanceTag, ContextSource } from '../types';

/**
 * A context field with value and provenance
 * (Local type alias matching the WithMeta pattern from companyContextGraph)
 */
interface ContextField<T = unknown> {
  value: T | null;
  provenance?: ProvenanceTag[];
}

// ============================================================================
// Apply Proposal to Context Graph
// ============================================================================

/**
 * Apply a proposal value to the context graph
 *
 * @param graph - The current context graph
 * @param fieldPath - The field path (e.g., 'identity.businessModel')
 * @param value - The value to set
 * @param source - Who confirmed this value ('user' for confirmed values)
 * @returns Updated context graph
 */
export async function applyProposalToContextGraph(
  graph: CompanyContextGraph,
  fieldPath: string,
  value: unknown,
  source: string
): Promise<CompanyContextGraph> {
  const parts = fieldPath.split('.');
  if (parts.length < 2) {
    console.warn(`[applyProposalToContextGraph] Invalid field path: ${fieldPath}`);
    return graph;
  }

  const [domain, fieldName, ...rest] = parts;

  // Create a deep copy to avoid mutation
  const updatedGraph = JSON.parse(JSON.stringify(graph)) as CompanyContextGraph;

  // Get the domain object
  const domainObj = (updatedGraph as any)[domain];
  if (!domainObj) {
    console.warn(`[applyProposalToContextGraph] Unknown domain: ${domain}`);
    return graph;
  }

  // Handle nested paths (e.g., 'competitive.topCompetitors.0.name')
  if (rest.length > 0) {
    const nestedPath = [fieldName, ...rest].join('.');
    setNestedValue(domainObj, nestedPath, value, source);
  } else {
    // Direct field access
    const field = domainObj[fieldName];
    if (field && typeof field === 'object' && 'value' in field) {
      // It's a ContextField - update with provenance
      (field as ContextField<unknown>).value = value;

      // Create new provenance entry for user confirmation
      const newProvenance: ProvenanceTag = {
        source: source as ContextSource,
        confidence: 1, // User-confirmed = full confidence
        updatedAt: new Date().toISOString(),
        notes: 'Confirmed from AI proposal',
      };

      // Prepend new provenance (most recent first)
      if (!field.provenance) {
        (field as ContextField<unknown>).provenance = [];
      }
      (field as ContextField<unknown>).provenance = [
        newProvenance,
        ...((field as ContextField<unknown>).provenance || []),
      ];
    } else {
      // Field doesn't exist yet - create it
      domainObj[fieldName] = createContextField(value, source);
    }
  }

  // Update graph metadata
  updatedGraph.meta.updatedAt = new Date().toISOString();

  return updatedGraph;
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
  source: string
): void {
  const parts = path.split('.');
  let current: any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];

    // Handle array indices
    if (/^\d+$/.test(key)) {
      const index = parseInt(key, 10);
      if (!Array.isArray(current)) {
        console.warn(`[setNestedValue] Expected array at ${parts.slice(0, i).join('.')}`);
        return;
      }
      if (current[index] === undefined) {
        current[index] = {};
      }
      current = current[index];
    } else {
      // Handle ContextField wrapper
      if (current[key] && typeof current[key] === 'object' && 'value' in current[key]) {
        // Navigate into the value
        if (!current[key].value) {
          current[key].value = {};
        }
        current = current[key].value;
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }
  }

  const lastKey = parts[parts.length - 1];

  // Check if we're setting a ContextField
  if (current[lastKey] && typeof current[lastKey] === 'object' && 'value' in current[lastKey]) {
    (current[lastKey] as ContextField<unknown>).value = value;

    const newProvenance: ProvenanceTag = {
      source: source as ContextSource,
      confidence: 1,
      updatedAt: new Date().toISOString(),
      notes: 'Confirmed from AI proposal',
    };

    (current[lastKey] as ContextField<unknown>).provenance = [
      newProvenance,
      ...((current[lastKey] as ContextField<unknown>).provenance || []),
    ];
  } else {
    // Simple value assignment
    current[lastKey] = value;
  }
}

/**
 * Create a new ContextField with initial provenance
 */
function createContextField<T>(value: T, source: string): ContextField<T> {
  return {
    value,
    provenance: [
      {
        source: source as ContextSource,
        confidence: 1,
        updatedAt: new Date().toISOString(),
        notes: 'Confirmed from AI proposal',
      },
    ],
  };
}

// ============================================================================
// Batch Apply
// ============================================================================

/**
 * Apply multiple proposals to a context graph
 */
export async function applyMultipleProposals(
  graph: CompanyContextGraph,
  proposals: Array<{
    fieldPath: string;
    value: unknown;
    source: string;
  }>
): Promise<CompanyContextGraph> {
  let updatedGraph = graph;

  for (const proposal of proposals) {
    updatedGraph = await applyProposalToContextGraph(
      updatedGraph,
      proposal.fieldPath,
      proposal.value,
      proposal.source
    );
  }

  return updatedGraph;
}
