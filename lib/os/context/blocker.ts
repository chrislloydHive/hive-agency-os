// lib/os/context/blocker.ts
// Strategy Blocker Logic
//
// Determines if strategy/program workflows should be blocked
// based on missing required context fields.
//
// RULES:
// - Block ONLY on required fields
// - Block ONLY if status === 'missing' (value is null)
// - proposed/confirmed fields do NOT block
//
// UNIFIED STRATEGY BLOCKERS:
// This module exports `getStrategyBlockers(context)` - the single source of truth
// for both Strategy and Context Map UIs. Competitive context is a hard blocker.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import { DOMAIN_WEIGHTS, DOMAIN_REQUIRED_FIELDS } from '@/lib/contextGraph/companyContextGraph';
import {
  type CanonicalFieldKey,
  type WorkflowType,
  type ContextFieldStatus,
  CANONICAL_FIELD_DEFINITIONS,
} from './schema';

// ============================================================================
// Types
// ============================================================================

export interface MissingField {
  key: CanonicalFieldKey;
  label: string;
  dimension: string;
  /** Deep link path to the field editor */
  editPath: string;
}

export interface BlockerResult {
  /** Whether the workflow is blocked */
  blocked: boolean;
  /** Human-readable message */
  message: string;
  /** Missing fields causing the block */
  missingFields: MissingField[];
  /** Completeness percentage (0-100) */
  completenessPercent: number;
}

// ============================================================================
// Field Status Detection
// ============================================================================

/**
 * Get the status of a field in the context graph
 */
function getFieldStatus(
  graph: CompanyContextGraph,
  key: CanonicalFieldKey
): ContextFieldStatus {
  const def = CANONICAL_FIELD_DEFINITIONS[key];
  if (!def?.contextGraphPath) return 'missing';

  const [domain, ...fieldParts] = def.contextGraphPath.split('.');

  // Navigate to field
  let target: unknown = (graph as Record<string, unknown>)[domain];
  if (!target || typeof target !== 'object') return 'missing';

  for (const part of fieldParts) {
    target = (target as Record<string, unknown>)[part];
    if (!target || typeof target !== 'object') return 'missing';
  }

  const fieldObj = target as { value?: unknown; provenance?: Array<{ source?: string }> };

  // Check value
  if (fieldObj.value === null || fieldObj.value === undefined) {
    return 'missing';
  }

  // Empty string counts as missing
  if (typeof fieldObj.value === 'string' && fieldObj.value.trim() === '') {
    return 'missing';
  }

  // Empty array counts as missing
  if (Array.isArray(fieldObj.value) && fieldObj.value.length === 0) {
    return 'missing';
  }

  // Empty object {} counts as missing
  if (
    typeof fieldObj.value === 'object' &&
    !Array.isArray(fieldObj.value) &&
    Object.keys(fieldObj.value as object).length === 0
  ) {
    return 'missing';
  }

  // Check if user-confirmed
  const latestSource = fieldObj.provenance?.[0]?.source;
  if (latestSource === 'user') {
    return 'confirmed';
  }

  return 'proposed';
}

// ============================================================================
// Main Blocker Logic
// ============================================================================

/**
 * Check if a workflow is blocked due to missing context
 *
 * @param companyId - Company to check
 * @param workflow - Workflow type (strategy, programs, briefs, work)
 * @returns Blocker result with missing fields
 */
export async function checkWorkflowBlocker(
  companyId: string,
  workflow: WorkflowType
): Promise<BlockerResult> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    // No context graph - all required fields are missing
    const requiredFields = Object.entries(CANONICAL_FIELD_DEFINITIONS)
      .filter(([_, def]) => def.requiredFor.includes(workflow))
      .map(([key, def]) => ({
        key: key as CanonicalFieldKey,
        label: def.label,
        dimension: def.dimension,
        editPath: `/c/${companyId}/context?field=${key}`,
      }));

    return {
      blocked: requiredFields.length > 0,
      message: `Strategy blocked — missing: ${requiredFields.map(f => f.label).join(', ')}`,
      missingFields: requiredFields,
      completenessPercent: 0,
    };
  }

  return checkWorkflowBlockerWithGraph(companyId, graph, workflow);
}

/**
 * Check blocker with an already-loaded graph
 */
export function checkWorkflowBlockerWithGraph(
  companyId: string,
  graph: CompanyContextGraph,
  workflow: WorkflowType
): BlockerResult {
  const requiredFields = Object.entries(CANONICAL_FIELD_DEFINITIONS)
    .filter(([_, def]) => def.requiredFor.includes(workflow));

  const missingFields: MissingField[] = [];
  let presentCount = 0;

  for (const [key, def] of requiredFields) {
    const status = getFieldStatus(graph, key as CanonicalFieldKey);

    if (status === 'missing') {
      missingFields.push({
        key: key as CanonicalFieldKey,
        label: def.label,
        dimension: def.dimension,
        editPath: `/c/${companyId}/context?field=${key}`,
      });
    } else {
      presentCount++;
    }
  }

  const totalRequired = requiredFields.length;
  const completenessPercent = totalRequired > 0
    ? Math.round((presentCount / totalRequired) * 100)
    : 100;

  const blocked = missingFields.length > 0;

  // Build message
  let message: string;
  if (!blocked) {
    message = 'All required context present';
  } else if (missingFields.length === 1) {
    message = `Strategy blocked — missing: ${missingFields[0].label}`;
  } else if (missingFields.length <= 3) {
    message = `Strategy blocked — missing:\n${missingFields.map(f => `• ${f.label}`).join('\n')}`;
  } else {
    const shown = missingFields.slice(0, 3).map(f => `• ${f.label}`).join('\n');
    message = `Strategy blocked — missing:\n${shown}\n• +${missingFields.length - 3} more`;
  }

  return {
    blocked,
    message,
    missingFields,
    completenessPercent,
  };
}

// ============================================================================
// Quick Checks
// ============================================================================

/**
 * Quick check if strategy is blocked
 */
export async function isStrategyBlocked(companyId: string): Promise<boolean> {
  const result = await checkWorkflowBlocker(companyId, 'strategy');
  return result.blocked;
}

/**
 * Quick check if programs are blocked
 */
export async function areProgramsBlocked(companyId: string): Promise<boolean> {
  const result = await checkWorkflowBlocker(companyId, 'programs');
  return result.blocked;
}

/**
 * Get missing fields for UI display (deep links to editors)
 */
export async function getMissingFieldsForUI(
  companyId: string,
  workflow: WorkflowType = 'strategy'
): Promise<MissingField[]> {
  const result = await checkWorkflowBlocker(companyId, workflow);
  return result.missingFields;
}

// ============================================================================
// Completeness Calculation
// ============================================================================

/**
 * Calculate overall context completeness for a company
 * Counts only required fields for the specified workflow
 */
export async function calculateCompleteness(
  companyId: string,
  workflow: WorkflowType = 'strategy'
): Promise<{
  percent: number;
  present: number;
  total: number;
  missing: CanonicalFieldKey[];
}> {
  const result = await checkWorkflowBlocker(companyId, workflow);

  const requiredFields = Object.entries(CANONICAL_FIELD_DEFINITIONS)
    .filter(([_, def]) => def.requiredFor.includes(workflow));

  return {
    percent: result.completenessPercent,
    present: requiredFields.length - result.missingFields.length,
    total: requiredFields.length,
    missing: result.missingFields.map(f => f.key),
  };
}

// ============================================================================
// UNIFIED STRATEGY BLOCKERS
// ============================================================================
//
// Single source of truth for both Strategy and Context Map.
// Uses DOMAIN_WEIGHTS and DOMAIN_REQUIRED_FIELDS from companyContextGraph.ts

/**
 * A missing required field that blocks strategy
 */
export interface StrategyBlocker {
  /** Domain containing the field */
  domain: DomainName;
  /** Field name within the domain */
  field: string;
  /** Full path (domain.field) */
  path: string;
  /** Human-readable label */
  label: string;
  /** Why this field is required */
  reason: string;
  /** Domain weight for prioritization */
  weight: number;
  /** Deep link to edit */
  editPath?: string;
}

/**
 * Result from getStrategyBlockers
 */
export interface StrategyBlockersResult {
  /** Whether strategy is blocked */
  blocked: boolean;
  /** List of blocking fields */
  blockers: StrategyBlocker[];
  /** Human-readable summary */
  message: string;
  /** Weighted completeness (0-100) */
  completenessPercent: number;
  /** Per-domain coverage breakdown */
  domainCoverage: Record<string, number>;
  /** Whether competitive context specifically is missing (hard blocker) */
  competitiveBlocked: boolean;
}

/**
 * Human-readable labels for domain fields
 */
const DOMAIN_FIELD_LABELS: Record<string, Record<string, string>> = {
  identity: {
    businessName: 'Business Name',
    industry: 'Industry',
    businessModel: 'Business Model',
  },
  brand: {
    positioning: 'Brand Positioning',
    valueProps: 'Value Props',
    differentiators: 'Differentiators',
  },
  audience: {
    primaryAudience: 'Primary Audience',
  },
  productOffer: {
    valueProposition: 'Value Proposition',
    primaryProducts: 'Primary Products',
  },
  competitive: {
    competitors: 'Competitors',
    positionSummary: 'Competitive Position Summary',
    primaryCompetitors: 'Primary Competitors',
  },
};

/**
 * Check if a domain field has a meaningful value
 */
function hasDomainFieldValue(
  graph: CompanyContextGraph,
  domain: DomainName,
  field: string
): boolean {
  const domainObj = graph[domain];
  if (!domainObj) return false;

  const fieldObj = (domainObj as Record<string, unknown>)[field];
  if (!fieldObj || typeof fieldObj !== 'object') return false;

  // Handle WithMeta wrapper
  const value = (fieldObj as { value?: unknown }).value;
  if (value === null || value === undefined) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'string' && value.trim() === '') return false;

  return true;
}

/**
 * Get strategy blockers for a context graph.
 *
 * SINGLE SOURCE OF TRUTH for both Strategy and Context Map UIs.
 *
 * Uses DOMAIN_REQUIRED_FIELDS to determine what's missing:
 * - identity: atLeast 2 of (businessName, industry, businessModel)
 * - brand: required (positioning) + anyOf (valueProps, differentiators)
 * - audience: required (primaryAudience)
 * - productOffer: anyOf (valueProposition, primaryProducts)
 * - competitive: required (competitors, positionSummary) <- HARD BLOCKER
 *
 * @param graph - The Company Context Graph to check
 * @param companyId - Optional company ID for deep links
 * @returns Strategy blockers result
 */
export function getStrategyBlockers(
  graph: CompanyContextGraph,
  companyId?: string
): StrategyBlockersResult {
  const blockers: StrategyBlocker[] = [];
  const domainCoverage: Record<string, number> = {};
  let competitiveBlocked = false;

  // Check each weighted domain for required fields
  for (const [domain, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    if (weight === undefined || weight <= 0) continue;

    const spec = DOMAIN_REQUIRED_FIELDS[domain as DomainName];
    if (!spec) {
      domainCoverage[domain] = 0;
      continue;
    }

    let domainPresent = 0;
    let domainTotal = 0;

    // Handle "atLeast" rule (e.g., identity needs 2 of 3)
    if (spec.atLeast) {
      const { count, fields } = spec.atLeast;
      const presentCount = fields.filter(f =>
        hasDomainFieldValue(graph, domain as DomainName, f)
      ).length;

      domainTotal += 1;
      if (presentCount >= count) {
        domainPresent += 1;
      } else {
        // Add blockers for missing fields in this rule
        const missingFields = fields.filter(f =>
          !hasDomainFieldValue(graph, domain as DomainName, f)
        );
        // Only add as blocker if we're below the threshold
        if (presentCount < count) {
          const needMore = count - presentCount;
          for (const field of missingFields.slice(0, needMore)) {
            blockers.push({
              domain: domain as DomainName,
              field,
              path: `${domain}.${field}`,
              label: DOMAIN_FIELD_LABELS[domain]?.[field] || field,
              reason: `Need at least ${count} of ${fields.length} identity fields`,
              weight: weight as number,
              editPath: companyId ? `/c/${companyId}/context?field=${domain}.${field}` : undefined,
            });
          }
        }
      }
    }

    // Handle required fields (all must be present)
    if (spec.required) {
      for (const field of spec.required) {
        domainTotal += 1;
        if (hasDomainFieldValue(graph, domain as DomainName, field)) {
          domainPresent += 1;
        } else {
          // Mark competitive as hard blocker
          if (domain === 'competitive') {
            competitiveBlocked = true;
          }

          blockers.push({
            domain: domain as DomainName,
            field,
            path: `${domain}.${field}`,
            label: DOMAIN_FIELD_LABELS[domain]?.[field] || field,
            reason: `${field} is required for strategy`,
            weight: weight as number,
            editPath: companyId ? `/c/${companyId}/context?field=${domain}.${field}` : undefined,
          });
        }
      }
    }

    // Handle anyOf fields (at least one must be present)
    if (spec.anyOf && spec.anyOf.length > 0) {
      domainTotal += 1;
      const hasAny = spec.anyOf.some(f =>
        hasDomainFieldValue(graph, domain as DomainName, f)
      );

      if (hasAny) {
        domainPresent += 1;
      } else {
        // Add the first missing field as blocker
        const firstMissing = spec.anyOf[0];
        blockers.push({
          domain: domain as DomainName,
          field: firstMissing,
          path: `${domain}.${firstMissing}`,
          label: DOMAIN_FIELD_LABELS[domain]?.[firstMissing] || firstMissing,
          reason: `Need at least one of: ${spec.anyOf.join(' or ')}`,
          weight: weight as number,
          editPath: companyId ? `/c/${companyId}/context?field=${domain}.${firstMissing}` : undefined,
        });
      }
    }

    // Calculate domain coverage
    domainCoverage[domain] = domainTotal > 0
      ? Math.round((domainPresent / domainTotal) * 100)
      : 0;
  }

  // Calculate weighted completeness
  let weightedScore = 0;
  let totalWeight = 0;
  for (const [domain, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    if (weight === undefined || weight <= 0) continue;
    const coverage = domainCoverage[domain] ?? 0;
    weightedScore += (coverage / 100) * weight;
    totalWeight += weight;
  }
  const completenessPercent = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 0;

  // Sort blockers by weight (highest first)
  blockers.sort((a, b) => b.weight - a.weight);

  // Build message
  let message: string;
  const blocked = blockers.length > 0;

  if (!blocked) {
    message = 'All required context present';
  } else if (competitiveBlocked) {
    message = 'Strategy blocked — missing competitive context (run Competition Lab)';
  } else if (blockers.length === 1) {
    message = `Strategy blocked — missing: ${blockers[0].label}`;
  } else if (blockers.length <= 3) {
    message = `Strategy blocked — missing:\n${blockers.map(b => `• ${b.label}`).join('\n')}`;
  } else {
    const shown = blockers.slice(0, 3).map(b => `• ${b.label}`).join('\n');
    message = `Strategy blocked — missing:\n${shown}\n• +${blockers.length - 3} more`;
  }

  return {
    blocked,
    blockers,
    message,
    completenessPercent,
    domainCoverage,
    competitiveBlocked,
  };
}

/**
 * Async wrapper for getStrategyBlockers that loads the context graph
 */
export async function getStrategyBlockersForCompany(
  companyId: string
): Promise<StrategyBlockersResult> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    // No context graph - all domains are missing
    return {
      blocked: true,
      blockers: [],
      message: 'Strategy blocked — no context available',
      completenessPercent: 0,
      domainCoverage: {},
      competitiveBlocked: true,
    };
  }

  return getStrategyBlockers(graph, companyId);
}
