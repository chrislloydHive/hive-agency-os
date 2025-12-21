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
 * Options for applying a proposal to the context graph
 */
export interface ApplyProposalOptions {
  /** True if the human modified the proposed value (not just accepted as-is) */
  isEdited?: boolean;
}

/**
 * Apply a proposal value to the context graph
 *
 * @param graph - The current context graph
 * @param fieldPath - The field path (e.g., 'identity.businessModel')
 * @param value - The value to set
 * @param source - Who confirmed this value ('user' for confirmed values)
 * @param options - Additional options (isEdited flag)
 * @returns Updated context graph
 */
export async function applyProposalToContextGraph(
  graph: CompanyContextGraph,
  fieldPath: string,
  value: unknown,
  source: string,
  options?: ApplyProposalOptions
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
    setNestedValue(domainObj, nestedPath, value, source, options?.isEdited ?? false);
  } else {
    // Direct field access
    const field = domainObj[fieldName];
    if (field && typeof field === 'object' && 'value' in field) {
      // It's a ContextField - update with provenance
      (field as ContextField<unknown>).value = value;

      // Create new provenance entry for user confirmation
      const isEdited = options?.isEdited ?? false;
      const now = new Date().toISOString();
      const newProvenance: ProvenanceTag = {
        source: source as ContextSource,
        confidence: 1, // User-confirmed = full confidence
        updatedAt: now,
        notes: isEdited ? 'Edited from AI proposal' : 'Confirmed from AI proposal',
        humanConfirmed: true,
        confirmedAt: now,
        humanEdited: isEdited,
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
      domainObj[fieldName] = createContextField(value, source, options?.isEdited ?? false);
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
  source: string,
  isEdited: boolean
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

    const now = new Date().toISOString();
    const newProvenance: ProvenanceTag = {
      source: source as ContextSource,
      confidence: 1,
      updatedAt: now,
      notes: isEdited ? 'Edited from AI proposal' : 'Confirmed from AI proposal',
      humanConfirmed: true,
      confirmedAt: now,
      humanEdited: isEdited,
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
function createContextField<T>(value: T, source: string, isEdited: boolean): ContextField<T> {
  const now = new Date().toISOString();
  return {
    value,
    provenance: [
      {
        source: source as ContextSource,
        confidence: 1,
        updatedAt: now,
        notes: isEdited ? 'Edited from AI proposal' : 'Confirmed from AI proposal',
        humanConfirmed: true,
        confirmedAt: now,
        humanEdited: isEdited,
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
    isEdited?: boolean;
  }>
): Promise<CompanyContextGraph> {
  let updatedGraph = graph;

  for (const proposal of proposals) {
    updatedGraph = await applyProposalToContextGraph(
      updatedGraph,
      proposal.fieldPath,
      proposal.value,
      proposal.source,
      { isEdited: proposal.isEdited }
    );
  }

  return updatedGraph;
}
