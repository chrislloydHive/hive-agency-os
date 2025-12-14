// lib/contextGraph/nodes/protection.ts
// Protection Logic for Confirmed Context Nodes
//
// Core Rules:
// - AI proposes, never persists directly
// - Human confirmation required for all AI proposals
// - Confirmed values are protected from AI overwrite
// - AI may only suggest new proposals alongside confirmed values

import type { CompanyContextGraph } from '../companyContextGraph';
import type { ProvenanceTag } from '../types';

/**
 * A context field with value and provenance
 * (Local type alias matching the WithMeta pattern from companyContextGraph)
 */
interface ContextField<T = unknown> {
  value: T | null;
  provenance?: ProvenanceTag[];
}
import type { ContextNodeStatus } from './types';

// ============================================================================
// Field Status Detection
// ============================================================================

/**
 * Determine if a context field is confirmed (protected from AI overwrite)
 *
 * A field is confirmed if:
 * - It has provenance with source = 'user', 'manual', or 'setup_wizard'
 * - It has a confidence of 1 from a user action
 */
export function isFieldConfirmed(field: ContextField<unknown> | undefined | null): boolean {
  if (!field?.provenance?.length) {
    return false;
  }

  const latestProvenance = field.provenance[0];

  // User sources are always confirmed
  if (
    latestProvenance.source === 'user' ||
    latestProvenance.source === 'manual' ||
    latestProvenance.source === 'setup_wizard'
  ) {
    return true;
  }

  return false;
}

/**
 * Get the status of a context field
 */
export function getFieldStatus(field: ContextField<unknown> | undefined | null): ContextNodeStatus {
  return isFieldConfirmed(field) ? 'confirmed' : 'proposed';
}

/**
 * Check if a field has any value (null, undefined, empty string, empty array all count as "no value")
 */
export function hasFieldValue(field: ContextField<unknown> | undefined | null): boolean {
  if (!field) return false;
  if (field.value === null || field.value === undefined) return false;
  if (typeof field.value === 'string' && field.value.trim() === '') return false;
  if (Array.isArray(field.value) && field.value.length === 0) return false;
  return true;
}

// ============================================================================
// Protection Checks
// ============================================================================

/**
 * Check if AI can propose a value for a field
 *
 * Returns:
 * - { canPropose: true } if AI can propose (empty field, or field is proposed status)
 * - { canPropose: true, isOverride: true } if AI can propose but it would override a confirmed value
 * - { canPropose: false, reason: string } if AI cannot propose
 */
export function canAIPropose(
  field: ContextField<unknown> | undefined | null
): {
  canPropose: boolean;
  isOverride?: boolean;
  reason?: string;
} {
  // Empty fields can always receive proposals
  if (!hasFieldValue(field)) {
    return { canPropose: true };
  }

  // Proposed fields can be updated by AI
  if (!isFieldConfirmed(field)) {
    return { canPropose: true };
  }

  // Confirmed fields: AI can propose, but it's an override that requires explicit user action
  return {
    canPropose: true,
    isOverride: true,
    reason: 'Field has a confirmed value. AI proposal will be shown alongside for user review.',
  };
}

/**
 * Get all confirmed field paths in a context graph
 */
export function getConfirmedFieldPaths(graph: CompanyContextGraph): string[] {
  const confirmedPaths: string[] = [];

  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs',
  ] as const;

  for (const domain of domains) {
    const domainData = (graph as any)[domain];
    if (!domainData || typeof domainData !== 'object') continue;

    for (const [fieldKey, fieldValue] of Object.entries(domainData)) {
      if (!fieldValue || typeof fieldValue !== 'object') continue;
      if (!('value' in (fieldValue as object)) && !('provenance' in (fieldValue as object))) continue;

      const field = fieldValue as ContextField<unknown>;
      if (isFieldConfirmed(field) && hasFieldValue(field)) {
        confirmedPaths.push(`${domain}.${fieldKey}`);
      }
    }
  }

  return confirmedPaths;
}

/**
 * Get protection summary for a context graph
 */
export function getProtectionSummary(graph: CompanyContextGraph): {
  confirmedCount: number;
  proposedCount: number;
  emptyCount: number;
  confirmedPaths: string[];
} {
  const confirmedPaths: string[] = [];
  let proposedCount = 0;
  let emptyCount = 0;

  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs',
  ] as const;

  for (const domain of domains) {
    const domainData = (graph as any)[domain];
    if (!domainData || typeof domainData !== 'object') continue;

    for (const [fieldKey, fieldValue] of Object.entries(domainData)) {
      if (!fieldValue || typeof fieldValue !== 'object') continue;
      if (!('value' in (fieldValue as object)) && !('provenance' in (fieldValue as object))) continue;

      const field = fieldValue as ContextField<unknown>;
      const fieldPath = `${domain}.${fieldKey}`;

      if (!hasFieldValue(field)) {
        emptyCount++;
      } else if (isFieldConfirmed(field)) {
        confirmedPaths.push(fieldPath);
      } else {
        proposedCount++;
      }
    }
  }

  return {
    confirmedCount: confirmedPaths.length,
    proposedCount,
    emptyCount,
    confirmedPaths,
  };
}

// ============================================================================
// Proposal Filtering
// ============================================================================

/**
 * Filter proposals to respect protection rules
 *
 * Returns proposals that are safe to create, with metadata about overrides
 */
export function filterProposalsForProtection(
  graph: CompanyContextGraph,
  proposals: Array<{
    fieldPath: string;
    proposedValue: unknown;
    reasoning: string;
    confidence: number;
  }>
): Array<{
  fieldPath: string;
  proposedValue: unknown;
  reasoning: string;
  confidence: number;
  isOverride: boolean;
  currentValue: unknown | null;
}> {
  return proposals.map((proposal) => {
    const field = getFieldFromPath(graph, proposal.fieldPath);
    const protectionCheck = canAIPropose(field);

    return {
      ...proposal,
      isOverride: protectionCheck.isOverride || false,
      currentValue: field?.value ?? null,
    };
  });
}

/**
 * Get a field from the context graph by path
 */
export function getFieldFromPath(
  graph: CompanyContextGraph,
  fieldPath: string
): ContextField<unknown> | null {
  const parts = fieldPath.split('.');
  if (parts.length < 2) return null;

  const [domain, fieldName] = parts;
  const domainData = (graph as any)[domain];

  if (!domainData || typeof domainData !== 'object') return null;

  const field = domainData[fieldName];
  if (!field || typeof field !== 'object') return null;
  if (!('value' in field) && !('provenance' in field)) return null;

  return field as ContextField<unknown>;
}

/**
 * Mark a field as confirmed in the context graph
 *
 * This updates the provenance to indicate user confirmation
 */
export function markFieldAsConfirmed(
  field: ContextField<unknown>,
  confirmedBy: string = 'user'
): ContextField<unknown> {
  const newProvenance: ProvenanceTag = {
    source: 'user',
    confidence: 1,
    updatedAt: new Date().toISOString(),
    notes: `Confirmed by ${confirmedBy}`,
  };

  return {
    ...field,
    provenance: [newProvenance, ...(field.provenance || [])],
  };
}
