// lib/contextGraph/readiness/strategyReady.ts
// Strategy-Ready Minimum (SRM) Checker
//
// Determines if a Context Graph has sufficient data to generate quality strategy.
// This is NOT about completeness - it's about having the MINIMUM required for
// strategy generation to be meaningful.
//
// SRM is explicit and hardcoded - no vertical-specific logic, no dynamic rules.

import type { CompanyContextGraph } from '../companyContextGraph';
import type { WithMetaType, WithMetaArrayType } from '../types';
import { getFieldFreshness, type FreshnessScore } from '../freshness';

// ============================================================================
// Types
// ============================================================================

/**
 * A missing SRM field with context
 */
export interface MissingSrmField {
  /** Domain name (e.g., "identity", "audience") */
  domain: string;
  /** Field path within domain (e.g., "businessModel") */
  fieldPath: string;
  /** Human-readable reason why this field is required */
  reason: string;
  /** Human-readable label for display */
  label: string;
}

/**
 * A stale SRM field that needs review
 */
export interface StaleSrmField {
  /** Domain name */
  domain: string;
  /** Field path within domain */
  fieldPath: string;
  /** Human-readable label */
  label: string;
  /** Freshness score details */
  freshness: FreshnessScore;
}

/**
 * Strategy readiness result
 */
export interface StrategyReadinessResult {
  /** Whether the context is strategy-ready */
  ready: boolean;
  /** Missing required fields */
  missing: MissingSrmField[];
  /** Stale fields that need review (not missing, but outdated) */
  stale: StaleSrmField[];
  /** Count of fields that are present and fresh */
  presentCount: number;
  /** Total SRM fields required */
  totalRequired: number;
  /** Percentage of SRM fields present (0-100) */
  completenessPercent: number;
}

// ============================================================================
// SRM Field Definitions (Hardcoded)
// ============================================================================

/**
 * Strategy-Ready Minimum field definitions
 *
 * These are the REQUIRED fields for generating quality strategy.
 * Each field specifies:
 * - domain: The context graph domain
 * - field: The field name within the domain
 * - label: Human-readable display name
 * - reason: Why this field is required for strategy
 * - isArray: Whether this is an array field (requires ≥1 item)
 * - alternatives: Alternative fields that satisfy this requirement (OR logic)
 */
export const SRM_FIELDS = [
  {
    domain: 'identity',
    field: 'businessModel',
    label: 'Business Model',
    reason: 'Strategy must understand how the business makes money',
    isArray: false,
  },
  {
    domain: 'productOffer',
    field: 'primaryProducts',
    label: 'Primary Products/Services',
    reason: 'Strategy needs to know what is being sold',
    isArray: true,
    alternatives: ['heroProducts', 'productLines'],
  },
  {
    domain: 'audience',
    field: 'primaryAudience',
    label: 'Primary Audience',
    reason: 'Strategy must target a defined audience',
    isArray: false,
    alternatives: ['coreSegments'],
  },
  {
    domain: 'audience',
    field: 'icpDescription',
    label: 'Audience Description',
    reason: 'Strategy needs audience context beyond just a name',
    isArray: false,
    alternatives: ['demographics'],
  },
  {
    domain: 'productOffer',
    field: 'valueProposition',
    label: 'Value Proposition',
    reason: 'Strategy must articulate why customers choose you',
    isArray: false,
  },
  // NOTE: objectives.primaryObjective REMOVED per canonicalization doctrine
  // Goals/objectives are set IN Strategy, not as Context inputs
  {
    domain: 'operationalConstraints',
    field: 'budgetCapsFloors',
    label: 'Budget Constraints',
    reason: 'Strategy must operate within budget realities',
    isArray: true,
    alternatives: ['minBudget', 'maxBudget'],
  },
  {
    domain: 'competitive',
    field: 'competitors',
    label: 'Competitors',
    reason: 'Strategy needs competitive context',
    isArray: true,
  },
  {
    domain: 'brand',
    field: 'positioning',
    label: 'Brand Positioning',
    reason: 'Strategy must align with brand positioning',
    isArray: false,
    alternatives: ['valueProps'],
  },
] as const;

/**
 * Human-readable labels for SRM fields
 */
// CANONICALIZATION: Removed objectives.* entries
export const SRM_FIELD_LABELS: Record<string, string> = {
  'identity.businessModel': 'Business Model',
  'productOffer.primaryProducts': 'Primary Products/Services',
  'productOffer.heroProducts': 'Hero Products',
  'productOffer.productLines': 'Product Lines',
  'productOffer.valueProposition': 'Value Proposition',
  'audience.primaryAudience': 'Primary Audience',
  'audience.icpDescription': 'ICP Description',
  'audience.coreSegments': 'Core Segments',
  'audience.demographics': 'Demographics',
  // NOTE: objectives.* REMOVED - objectives belong in Strategy
  'operationalConstraints.budgetCapsFloors': 'Budget Constraints',
  'operationalConstraints.minBudget': 'Minimum Budget',
  'operationalConstraints.maxBudget': 'Maximum Budget',
  'competitive.competitors': 'Competitors',
  'brand.positioning': 'Brand Positioning',
  'brand.valueProps': 'Value Props',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a WithMeta field has a value
 */
function hasValue<T>(field: WithMetaType<T> | undefined): boolean {
  if (!field) return false;
  if (field.value === null || field.value === undefined) return false;
  if (typeof field.value === 'string') return field.value.trim().length > 0;
  return true;
}

/**
 * Check if a WithMetaArray field has at least one item
 */
function hasArrayValue<T>(field: WithMetaArrayType<T> | undefined): boolean {
  if (!field) return false;
  if (!Array.isArray(field.value)) return false;
  return field.value.length > 0;
}

/**
 * Get a field from the graph by domain and field name
 */
function getField(
  graph: CompanyContextGraph,
  domain: string,
  field: string
): WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined {
  const domainObj = graph[domain as keyof CompanyContextGraph];
  if (!domainObj || typeof domainObj !== 'object') return undefined;
  return (domainObj as Record<string, unknown>)[field] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;
}

/**
 * Check if a field or any of its alternatives has a value
 */
function fieldOrAlternativesHasValue(
  graph: CompanyContextGraph,
  domain: string,
  field: string,
  isArray: boolean,
  alternatives?: readonly string[]
): { hasValue: boolean; usedField: string } {
  // Check primary field
  const primaryField = getField(graph, domain, field);
  if (isArray ? hasArrayValue(primaryField as WithMetaArrayType<unknown>) : hasValue(primaryField as WithMetaType<unknown>)) {
    return { hasValue: true, usedField: `${domain}.${field}` };
  }

  // Check alternatives
  if (alternatives) {
    for (const alt of alternatives) {
      // Alternative might be in format "domain.field" or just "field" (same domain)
      const [altDomain, altField] = alt.includes('.') ? alt.split('.') : [domain, alt];
      const altFieldObj = getField(graph, altDomain, altField);

      // Determine if alternative is array based on the field type
      const altIsArray = altField.endsWith('s') || ['coreSegments', 'valueProps', 'heroProducts', 'productLines'].includes(altField);

      if (altIsArray ? hasArrayValue(altFieldObj as WithMetaArrayType<unknown>) : hasValue(altFieldObj as WithMetaType<unknown>)) {
        return { hasValue: true, usedField: `${altDomain}.${altField}` };
      }
    }
  }

  return { hasValue: false, usedField: `${domain}.${field}` };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Check if a Context Graph is strategy-ready
 *
 * @param graph - The Company Context Graph to check
 * @returns Strategy readiness result with missing fields
 */
export function isStrategyReady(graph: CompanyContextGraph): StrategyReadinessResult {
  const missing: MissingSrmField[] = [];
  const stale: StaleSrmField[] = [];
  let presentCount = 0;

  for (const srmField of SRM_FIELDS) {
    const { domain, field, label, reason, isArray } = srmField;
    const alternatives = 'alternatives' in srmField ? srmField.alternatives : undefined;

    const result = fieldOrAlternativesHasValue(
      graph,
      domain,
      field,
      isArray,
      alternatives
    );

    if (!result.hasValue) {
      missing.push({
        domain,
        fieldPath: field,
        reason,
        label,
      });
    } else {
      presentCount++;

      // Check freshness for present fields
      const [usedDomain, usedField] = result.usedField.split('.');
      const fieldObj = getField(graph, usedDomain, usedField);

      if (fieldObj) {
        const freshness = getFieldFreshness(fieldObj as WithMetaType<unknown>);
        if (freshness && (freshness.label === 'stale' || freshness.label === 'expired')) {
          stale.push({
            domain: usedDomain,
            fieldPath: usedField,
            label: SRM_FIELD_LABELS[result.usedField] || label,
            freshness,
          });
        }
      }
    }
  }

  const totalRequired = SRM_FIELDS.length;
  const completenessPercent = Math.round((presentCount / totalRequired) * 100);

  return {
    ready: missing.length === 0,
    missing,
    stale,
    presentCount,
    totalRequired,
    completenessPercent,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a human-readable summary of strategy readiness
 */
export function getReadinessSummary(result: StrategyReadinessResult): string {
  if (result.ready && result.stale.length === 0) {
    return 'Strategy-Ready';
  }

  if (result.ready && result.stale.length > 0) {
    return `Strategy-Ready (${result.stale.length} field${result.stale.length > 1 ? 's' : ''} need${result.stale.length === 1 ? 's' : ''} review)`;
  }

  const missingLabels = result.missing.map(m => m.label).join(', ');
  return `Not Ready - Missing: ${missingLabels}`;
}

/**
 * Get SRM field paths for a specific domain
 */
export function getSrmFieldsForDomain(domain: string): string[] {
  return SRM_FIELDS
    .filter(f => f.domain === domain)
    .map(f => f.field);
}

/**
 * Check if a field path is an SRM field
 */
export function isSrmField(domain: string, field: string): boolean {
  return SRM_FIELDS.some(f => {
    if (f.domain !== domain) return false;
    if (f.field === field) return true;
    const alts = 'alternatives' in f ? (f.alternatives as readonly string[]) : undefined;
    return alts?.includes(field) ?? false;
  });
}

/**
 * Get all SRM field paths as "domain.field" strings
 */
export function getAllSrmFieldPaths(): string[] {
  const paths: string[] = [];
  for (const f of SRM_FIELDS) {
    paths.push(`${f.domain}.${f.field}`);
    const alts = 'alternatives' in f ? f.alternatives : undefined;
    if (alts) {
      for (const alt of alts) {
        if (alt.includes('.')) {
          paths.push(alt);
        } else {
          paths.push(`${f.domain}.${alt}`);
        }
      }
    }
  }
  return [...new Set(paths)];
}

// ============================================================================
// Strategy Regen Recommendation
// ============================================================================

/**
 * SRM field names in CompanyContext (flat structure) for regen tracking
 * CANONICALIZATION: Removed 'objectives' - belongs in Strategy, not Context
 */
export const CONTEXT_SRM_FIELD_NAMES = [
  'businessModel',
  'primaryAudience',
  'icpDescription',
  'valueProposition',
  // NOTE: 'objectives' REMOVED - belongs in Strategy
  'budget',
  'competitors',
] as const;

export type ContextSrmFieldName = typeof CONTEXT_SRM_FIELD_NAMES[number];

/**
 * Check if a field name is an SRM field (for CompanyContext)
 */
export function isContextSrmField(fieldName: string): fieldName is ContextSrmFieldName {
  return CONTEXT_SRM_FIELD_NAMES.includes(fieldName as ContextSrmFieldName);
}

/**
 * Regen recommendation result
 */
export interface RegenRecommendation {
  /** Whether strategy regen is recommended */
  recommended: boolean;
  /** Fields that changed and triggered the recommendation */
  changedFields: string[];
  /** Human-readable message */
  message: string;
}

/**
 * Check if any SRM fields have changed between old and new context
 * Returns a regen recommendation if SRM fields were modified
 */
export function checkRegenRecommendation(
  oldContext: Record<string, unknown>,
  newContext: Record<string, unknown>
): RegenRecommendation {
  const changedFields: string[] = [];

  for (const field of CONTEXT_SRM_FIELD_NAMES) {
    const oldVal = oldContext[field];
    const newVal = newContext[field];

    // Compare values (simple comparison, handles strings, arrays, objects)
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);

    if (oldStr !== newStr) {
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) {
    return {
      recommended: false,
      changedFields: [],
      message: '',
    };
  }

  const fieldLabels = changedFields.map(f => SRM_FIELD_LABELS[`context.${f}`] || f);
  const message = changedFields.length === 1
    ? `${fieldLabels[0]} changed — strategy regen recommended`
    : `${changedFields.length} SRM fields changed — strategy regen recommended`;

  return {
    recommended: true,
    changedFields,
    message,
  };
}
