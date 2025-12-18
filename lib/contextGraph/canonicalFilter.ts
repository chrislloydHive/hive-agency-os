// lib/contextGraph/canonicalFilter.ts
// Single source of truth for canonical node filtering
//
// This module provides reusable helpers for filtering out non-canonical nodes
// from the Context Map UI. It must be applied at:
// 1. Server-side (API routes returning nodes)
// 2. Client-side (defense in depth)
// 3. Hydration layer (earliest possible filtering)
//
// CANONICALIZATION DOCTRINE:
// - Context = durable, factual truth about the business
// - Objectives belong in Strategy (not Context)
// - Scores/evaluations belong in Diagnostics (not Context)
// - AI can only propose to empty canonical fields
// - Humans confirm, creating user-sourced revisions

import type { HydratedContextNode } from './nodes/hydration';
import { isRemovedField, REMOVED_FIELDS, isSchemaV2Key, CONTEXT_SCHEMA_V2_KEYS } from './unifiedRegistry';
import { isDeprecatedDomain, DEPRECATED_DOMAIN_NAMES, isCanonicalDomain } from './companyContextGraph';
import { FIELD_KEY_MAPPING } from './migration/v1ToV2';

// ============================================================================
// Core Filter Functions
// ============================================================================

/**
 * Check if a node key is canonical (safe to render in UI)
 *
 * BACKWARD COMPATIBLE: This function is permissive to ensure existing data
 * continues to display. It only filters out explicitly removed keys and
 * deprecated domains.
 *
 * A key is NON-canonical (filtered out) if:
 * 1. It's explicitly in REMOVED_FIELDS (legacy blocklist)
 * 2. Its domain is deprecated (objectives, website, content, seo)
 *
 * NOTE: DEPRECATED_FIELDS from migration is NOT checked here because those
 * fields may still have existing data that needs to be displayed. The migration
 * deprecation only affects NEW writes, not reading existing data.
 *
 * Everything else is allowed for backward compatibility.
 */
export function isCanonicalKey(key: string): boolean {
  // Check if explicitly removed in legacy registry
  // These are fields that should NEVER be shown (scores, evaluations, objectives)
  if (isRemovedField(key)) {
    return false;
  }

  // Check for deprecated domains
  // These entire domains are deprecated (objectives, website, content, seo)
  const domain = key.split('.')[0];
  if (isDeprecatedDomain(domain)) {
    return false;
  }

  // Allow everything else for backward compatibility
  // This includes:
  // - Schema V2 keys (businessReality.*, offer.*, etc.)
  // - Legacy keys (identity.*, productOffer.*, etc.)
  // - Migration-deprecated fields (brand.toneOfVoice, etc.) - still readable
  return true;
}

/**
 * Get the Schema V2 key for a given key (handles migration)
 * Returns the original key if no mapping exists
 */
export function getSchemaV2KeyFor(key: string): string {
  return FIELD_KEY_MAPPING[key] || key;
}

/**
 * Check if a node is canonical (safe to render in UI)
 *
 * Uses both the node's key and category to determine canonicality.
 */
export function isCanonicalNode(node: HydratedContextNode): boolean {
  // Check the node key
  if (!isCanonicalKey(node.key)) {
    return false;
  }

  // Double-check the category (domain) - some nodes might have mismatched key/category
  const category = node.category;
  if (category && isDeprecatedDomain(category)) {
    return false;
  }

  return true;
}

/**
 * Filter an array of nodes to only include canonical nodes
 */
export function filterCanonicalNodes<T extends HydratedContextNode>(nodes: T[]): T[] {
  return nodes.filter(isCanonicalNode);
}

/**
 * Filter an array of field keys to only include canonical keys
 */
export function filterCanonicalKeys(keys: string[]): string[] {
  return keys.filter(isCanonicalKey);
}

// ============================================================================
// Debug / Summary Functions
// ============================================================================

/**
 * Summary of filtered nodes for debugging
 */
export interface FilterSummary {
  /** Total nodes before filtering */
  totalBefore: number;
  /** Total nodes after filtering */
  totalAfter: number;
  /** Number of nodes filtered out */
  filteredCount: number;
  /** Sample of filtered-out keys (for debugging) */
  filteredSamples: string[];
  /** Breakdown by reason */
  byReason: {
    removedField: number;
    deprecatedDomain: number;
  };
}

/**
 * Summarize what was filtered out (for dev logging)
 */
export function summarizeFiltered(nodes: HydratedContextNode[]): FilterSummary {
  const filteredOut: { key: string; reason: 'removedField' | 'deprecatedDomain' }[] = [];

  for (const node of nodes) {
    if (isRemovedField(node.key)) {
      filteredOut.push({ key: node.key, reason: 'removedField' });
    } else {
      const domain = node.key.split('.')[0];
      if (isDeprecatedDomain(domain)) {
        filteredOut.push({ key: node.key, reason: 'deprecatedDomain' });
      }
    }
  }

  const removedFieldCount = filteredOut.filter(f => f.reason === 'removedField').length;
  const deprecatedDomainCount = filteredOut.filter(f => f.reason === 'deprecatedDomain').length;

  return {
    totalBefore: nodes.length,
    totalAfter: nodes.length - filteredOut.length,
    filteredCount: filteredOut.length,
    filteredSamples: filteredOut.slice(0, 5).map(f => f.key),
    byReason: {
      removedField: removedFieldCount,
      deprecatedDomain: deprecatedDomainCount,
    },
  };
}

/**
 * Log filter summary to console (dev only)
 */
export function logFilterSummary(nodes: HydratedContextNode[], context: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  const summary = summarizeFiltered(nodes);
  if (summary.filteredCount > 0) {
    console.log(`[canonicalFilter:${context}] Filtered ${summary.filteredCount} non-canonical nodes:`, {
      before: summary.totalBefore,
      after: summary.totalAfter,
      samples: summary.filteredSamples,
      byReason: summary.byReason,
    });
  }
}

// ============================================================================
// Constants Export (for reference)
// ============================================================================

export { REMOVED_FIELDS, DEPRECATED_DOMAIN_NAMES };

// ============================================================================
// CANONICAL KEYS ALLOWLIST (SCHEMA V2)
// These are the ONLY 47 keys that should exist in Context.
// Everything else is either deprecated or belongs in Labs/Diagnostics/Strategy.
// ============================================================================

/**
 * The complete list of canonical Context keys (Schema V2).
 * Context stores facts and constraints, NOT outputs or evaluations.
 *
 * SCHEMA V2 defines exactly 47 fields across 8 zones.
 * See CONTEXT_SCHEMA_V2_KEYS in unifiedRegistry.ts for the authoritative list.
 */
export const CANONICAL_KEYS = CONTEXT_SCHEMA_V2_KEYS;

export type CanonicalKey = typeof CANONICAL_KEYS[number];

/**
 * Check if a key is in the explicit canonical allowlist (Schema V2)
 * This is stricter than isCanonicalKey() which also handles migration
 */
export function isInCanonicalAllowlist(key: string): boolean {
  return isSchemaV2Key(key);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that a key exists in the canonical registry
 * Returns the reason it's non-canonical if invalid
 */
export function validateCanonicalKey(key: string): { valid: boolean; reason?: string } {
  if (isRemovedField(key)) {
    return {
      valid: false,
      reason: `Field "${key}" has been removed from canonical Context. See docs/context/reuse-affirmation.md`,
    };
  }

  const domain = key.split('.')[0];
  if (isDeprecatedDomain(domain)) {
    return {
      valid: false,
      reason: `Domain "${domain}" is deprecated. ${getDomainDeprecationReason(domain)}`,
    };
  }

  return { valid: true };
}

/**
 * Get human-readable reason for why a domain is deprecated
 */
function getDomainDeprecationReason(domain: string): string {
  switch (domain) {
    case 'objectives':
      return 'Objectives belong in Strategy, not Context.';
    case 'website':
    case 'content':
    case 'seo':
      return 'Scores and evaluations belong in Diagnostics, not Context.';
    default:
      return 'Domain is no longer part of canonical Context.';
  }
}
