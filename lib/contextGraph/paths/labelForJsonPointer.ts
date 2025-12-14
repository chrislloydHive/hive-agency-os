// lib/contextGraph/paths/labelForJsonPointer.ts
// JSON Pointer → Friendly Label Mapper
//
// Converts RFC 6901 JSON Pointers like "/identity/businessModel/value"
// into human-readable labels like "Identity → Business Model"

import { CONTEXT_FIELDS, getFieldDef, type ContextSectionId } from '../schema';

// ============================================================================
// Domain/Section Labels
// ============================================================================

/**
 * Human-readable labels for top-level domains
 */
export const DOMAIN_LABELS: Record<string, string> = {
  identity: 'Identity',
  audience: 'Audience',
  brand: 'Brand',
  website: 'Website',
  media: 'Media',
  creative: 'Creative',
  objectives: 'Objectives',
  constraints: 'Budget & Constraints',
  productOffer: 'Product/Offer',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  competitive: 'Competitive',
  historical: 'Historical',
  storeRisk: 'Store Risk',
  operationalConstraints: 'Operational Constraints',
  performanceMedia: 'Performance Media',
  budgetOps: 'Budget & Operations',
  digitalInfra: 'Digital Infrastructure',
  // Strategy domains
  strategyPillars: 'Strategy Pillars',
  companyReality: 'Company Reality',
  marketContext: 'Market Context',
  strategicNarrative: 'Strategic Narrative',
};

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a JSON Pointer into its segments
 * @example "/identity/businessModel/value" → ["identity", "businessModel", "value"]
 */
export function parseJsonPointer(pointer: string): string[] {
  if (!pointer || pointer === '/') return [];
  // Remove leading slash and split
  return pointer.replace(/^\//, '').split('/');
}

/**
 * Extract the domain (first segment) from a JSON Pointer
 * @example "/identity/businessModel/value" → "identity"
 */
export function getDomainFromPointer(pointer: string): string | null {
  const segments = parseJsonPointer(pointer);
  return segments[0] || null;
}

/**
 * Extract the field name from a JSON Pointer (second segment, or last non-metadata)
 * @example "/identity/businessModel/value" → "businessModel"
 */
export function getFieldFromPointer(pointer: string): string | null {
  const segments = parseJsonPointer(pointer);
  if (segments.length < 2) return null;
  // Skip metadata segments like "value", "provenance"
  const metadataSegments = ['value', 'provenance', 'updatedAt', 'confidence'];
  for (let i = segments.length - 1; i >= 1; i--) {
    if (!metadataSegments.includes(segments[i]) && isNaN(Number(segments[i]))) {
      return segments[i];
    }
  }
  return segments[1];
}

// ============================================================================
// Label Generation
// ============================================================================

/**
 * Convert a segment to title case
 * @example "businessModel" → "Business Model"
 */
export function toTitleCase(str: string): string {
  // Handle camelCase
  const spaced = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Handle snake_case
  const underscored = spaced.replace(/_/g, ' ');
  // Capitalize first letter of each word
  return underscored
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get a human-readable label for a domain
 */
export function getDomainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] || toTitleCase(domain);
}

/**
 * Get a human-readable label for a field within a domain
 * Uses CONTEXT_FIELDS registry if available, falls back to title case
 */
export function getFieldLabel(domain: string, field: string): string {
  // Try to find in CONTEXT_FIELDS registry
  const path = `${domain}.${field}`;
  const fieldDef = getFieldDef(path);
  if (fieldDef?.label) {
    return fieldDef.label;
  }
  // Fallback to title case
  return toTitleCase(field);
}

// ============================================================================
// Main Function
// ============================================================================

export interface LabelForPointerResult {
  /** Full friendly label: "Identity → Business Model" */
  fullLabel: string;
  /** Domain label: "Identity" */
  domainLabel: string;
  /** Field label: "Business Model" */
  fieldLabel: string;
  /** Raw domain: "identity" */
  domain: string;
  /** Raw field: "businessModel" */
  field: string;
  /** Whether the field was found in the schema registry */
  fromRegistry: boolean;
}

/**
 * Convert a JSON Pointer to a friendly label
 *
 * @example
 * labelForJsonPointer("/identity/businessModel/value")
 * // → { fullLabel: "Identity → Business Model", domainLabel: "Identity", ... }
 *
 * @example
 * labelForJsonPointer("/strategyPillars/0/decision")
 * // → { fullLabel: "Strategy Pillars → Decision", ... }
 */
export function labelForJsonPointer(pointer: string): LabelForPointerResult {
  const segments = parseJsonPointer(pointer);

  if (segments.length === 0) {
    return {
      fullLabel: 'Root',
      domainLabel: 'Root',
      fieldLabel: '',
      domain: '',
      field: '',
      fromRegistry: false,
    };
  }

  const domain = segments[0];
  const domainLabel = getDomainLabel(domain);

  // If only domain, return just domain label
  if (segments.length === 1) {
    return {
      fullLabel: domainLabel,
      domainLabel,
      fieldLabel: '',
      domain,
      field: '',
      fromRegistry: false,
    };
  }

  // Find the field (skip array indices and metadata)
  const field = getFieldFromPointer(pointer) || segments[1];
  const fieldLabel = getFieldLabel(domain, field);

  // Check if we found this in the registry
  const path = `${domain}.${field}`;
  const fromRegistry = !!getFieldDef(path);

  return {
    fullLabel: `${domainLabel} → ${fieldLabel}`,
    domainLabel,
    fieldLabel,
    domain,
    field,
    fromRegistry,
  };
}

/**
 * Get just the full label string for a JSON Pointer
 * Convenience function for simple use cases
 */
export function labelForPointer(pointer: string): string {
  return labelForJsonPointer(pointer).fullLabel;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Group operations by domain and return labels
 */
export function groupByDomain<T extends { path: string }>(
  items: T[]
): Map<string, { label: string; items: T[] }> {
  const groups = new Map<string, { label: string; items: T[] }>();

  for (const item of items) {
    const domain = getDomainFromPointer(item.path) || 'other';
    const existing = groups.get(domain);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(domain, {
        label: getDomainLabel(domain),
        items: [item],
      });
    }
  }

  return groups;
}

/**
 * Get all unique domains from a list of pointers
 */
export function getUniqueDomains(pointers: string[]): string[] {
  const domains = new Set<string>();
  for (const pointer of pointers) {
    const domain = getDomainFromPointer(pointer);
    if (domain) domains.add(domain);
  }
  return Array.from(domains);
}
