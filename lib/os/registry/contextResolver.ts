// lib/os/registry/contextResolver.ts
// Context Resolver: Unified data access layer for Strategy and Programs
//
// RESOLUTION RULES:
// 1. Prefer confirmed nodes (human-approved)
// 2. If none, allow proposed nodes (highest confidence)
// 3. If none, return missing
//
// SOURCE PRIORITY (default): user > lab > ai > strategy > import

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';
import {
  type ContextStrategyField,
  type FieldSource,
  type RequiredForDomain,
  REGISTRY_BY_KEY,
  getRegistryEntry,
  getFieldsRequiredFor,
  calculateWeightedReadiness,
} from './contextStrategyRegistry';

// ============================================================================
// Types
// ============================================================================

export type ResolutionStatus = 'confirmed' | 'proposed' | 'missing';

/**
 * Result of resolving a context value
 */
export interface ResolvedValue<T = unknown> {
  /** The resolved value (null if missing) */
  value: T | null;
  /** Resolution status */
  status: ResolutionStatus;
  /** Source of the value */
  source: FieldSource | null;
  /** Confidence level (0-1) */
  confidence: number | null;
  /** Last updated timestamp */
  updatedAt: string | null;
  /** The registry entry for this field */
  fieldEntry: ContextStrategyField | null;
  /** Whether this field has a pending proposal */
  hasPendingProposal: boolean;
  /** Pending proposal value (if different from current) */
  pendingProposalValue?: T;
}

/**
 * Batch resolution result
 */
export interface BatchResolutionResult {
  /** Resolved values by key */
  values: Map<string, ResolvedValue>;
  /** All confirmed values */
  confirmed: Map<string, ResolvedValue>;
  /** All proposed values */
  proposed: Map<string, ResolvedValue>;
  /** All missing fields */
  missing: ContextStrategyField[];
  /** Overall completeness (0-100) */
  completeness: number;
}

/**
 * Readiness result for a domain
 */
export interface ReadinessResult {
  /** Whether the domain requirements are met */
  isReady: boolean;
  /** Readiness score (0-100) */
  score: number;
  /** Missing critical fields */
  missingCritical: ContextStrategyField[];
  /** Missing recommended fields */
  missingRecommended: ContextStrategyField[];
  /** Blocking reason (if not ready) */
  blockReason: string | null;
  /** Fields that are proposed but not confirmed */
  pendingReview: ContextStrategyField[];
}

// ============================================================================
// Context Graph Value Extraction
// ============================================================================

/**
 * Get a nested value from the context graph using dot notation path
 */
function getGraphValue(graph: CompanyContextGraph, path: string): WithMetaType<unknown> | undefined {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  // Check if it's a WithMetaType wrapper
  if (current && typeof current === 'object' && 'value' in current) {
    return current as WithMetaType<unknown>;
  }

  return undefined;
}

/**
 * Extract status from provenance
 */
function extractStatus(provenance: Array<{ source: string; confirmedAt?: string }> | undefined): ResolutionStatus {
  if (!provenance || provenance.length === 0) {
    return 'missing';
  }

  const latest = provenance[0];
  // If there's a confirmedAt timestamp, it's confirmed
  if (latest.confirmedAt) {
    return 'confirmed';
  }

  // AI or lab sources without confirmation are proposed
  if (latest.source === 'ai' || latest.source === 'lab') {
    return 'proposed';
  }

  // User source is always confirmed
  if (latest.source === 'user') {
    return 'confirmed';
  }

  return 'proposed';
}

/**
 * Extract source from provenance
 */
function extractSource(provenance: Array<{ source: string }> | undefined): FieldSource | null {
  if (!provenance || provenance.length === 0) {
    return null;
  }
  return provenance[0].source as FieldSource;
}

/**
 * Extract confidence from provenance
 */
function extractConfidence(provenance: Array<{ confidence?: number }> | undefined): number | null {
  if (!provenance || provenance.length === 0) {
    return null;
  }
  return provenance[0].confidence ?? null;
}

/**
 * Extract updatedAt from provenance
 */
function extractUpdatedAt(provenance: Array<{ updatedAt?: string }> | undefined): string | null {
  if (!provenance || provenance.length === 0) {
    return null;
  }
  return provenance[0].updatedAt ?? null;
}

// ============================================================================
// Single Value Resolution
// ============================================================================

/**
 * Resolve a single context value
 *
 * @param companyId - Company ID
 * @param key - Field key from registry
 * @param graph - Optional pre-loaded context graph
 * @returns Resolved value with metadata
 */
export async function resolveContextValue<T = unknown>(
  companyId: string,
  key: string,
  graph?: CompanyContextGraph | null
): Promise<ResolvedValue<T>> {
  // Get registry entry
  const fieldEntry = getRegistryEntry(key);
  if (!fieldEntry) {
    console.warn(`[ContextResolver] Unknown field key: ${key}`);
    return {
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
      fieldEntry: null,
      hasPendingProposal: false,
    };
  }

  // Load graph if not provided
  const contextGraph = graph ?? await loadContextGraph(companyId);
  if (!contextGraph) {
    return {
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
      fieldEntry,
      hasPendingProposal: false,
    };
  }

  // Get value from graph using graphPath or key
  const graphPath = fieldEntry.graphPath || key;
  const wrapped = getGraphValue(contextGraph, graphPath);

  if (!wrapped || wrapped.value === null || wrapped.value === undefined) {
    return {
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
      fieldEntry,
      hasPendingProposal: false,
    };
  }

  // Handle array values - check for empty arrays
  if (Array.isArray(wrapped.value) && wrapped.value.length === 0) {
    return {
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
      fieldEntry,
      hasPendingProposal: false,
    };
  }

  // Handle string values - check for empty strings
  if (typeof wrapped.value === 'string' && wrapped.value.trim() === '') {
    return {
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
      fieldEntry,
      hasPendingProposal: false,
    };
  }

  const provenance = wrapped.provenance as Array<{
    source: string;
    updatedAt?: string;
    confidence?: number;
    confirmedAt?: string;
  }> | undefined;

  return {
    value: wrapped.value as T,
    status: extractStatus(provenance),
    source: extractSource(provenance),
    confidence: extractConfidence(provenance),
    updatedAt: extractUpdatedAt(provenance),
    fieldEntry,
    hasPendingProposal: false, // TODO: Check proposal storage
  };
}

// ============================================================================
// Batch Resolution
// ============================================================================

/**
 * Resolve multiple context values in batch
 *
 * @param companyId - Company ID
 * @param keys - Array of field keys to resolve
 * @returns Batch resolution result
 */
export async function resolveContextValues(
  companyId: string,
  keys: string[]
): Promise<BatchResolutionResult> {
  // Load graph once
  const graph = await loadContextGraph(companyId);

  const values = new Map<string, ResolvedValue>();
  const confirmed = new Map<string, ResolvedValue>();
  const proposed = new Map<string, ResolvedValue>();
  const missing: ContextStrategyField[] = [];

  for (const key of keys) {
    const resolved = await resolveContextValue(companyId, key, graph);
    values.set(key, resolved);

    if (resolved.status === 'confirmed') {
      confirmed.set(key, resolved);
    } else if (resolved.status === 'proposed') {
      proposed.set(key, resolved);
    } else if (resolved.fieldEntry) {
      missing.push(resolved.fieldEntry);
    }
  }

  const total = keys.length;
  const presentCount = confirmed.size + proposed.size;
  const completeness = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  return {
    values,
    confirmed,
    proposed,
    missing,
    completeness,
  };
}

/**
 * Resolve all fields for a strategy section
 *
 * @param companyId - Company ID
 * @param section - Strategy section name
 * @returns Map of strategy field names to resolved values
 */
export async function resolveStrategySection(
  companyId: string,
  section: 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities'
): Promise<Map<string, ResolvedValue>> {
  const fields = Array.from(REGISTRY_BY_KEY.values())
    .filter(f => f.strategySection === section);

  const graph = await loadContextGraph(companyId);
  const result = new Map<string, ResolvedValue>();

  for (const field of fields) {
    const resolved = await resolveContextValue(companyId, field.key, graph);
    // Use strategy field name as key for easier mapping
    const mapKey = field.strategyField || field.key;
    result.set(mapKey, resolved);
  }

  return result;
}

// ============================================================================
// Readiness Computation
// ============================================================================

/**
 * Compute readiness for a domain (strategy, websiteProgram, etc.)
 *
 * This is the SINGLE source of truth for readiness gating.
 * Strategy and Programs MUST use this function.
 *
 * @param companyId - Company ID
 * @param domain - Domain to check readiness for
 * @returns Readiness result
 */
export async function computeReadiness(
  companyId: string,
  domain: RequiredForDomain
): Promise<ReadinessResult> {
  const requiredFields = getFieldsRequiredFor(domain);
  const keys = requiredFields.map(f => f.key);

  // Resolve all required values
  const { values, missing } = await resolveContextValues(companyId, keys);

  // Calculate weighted readiness
  const valuesMap = new Map<string, unknown>();
  for (const [key, resolved] of values) {
    valuesMap.set(key, resolved.value);
  }
  const { score } = calculateWeightedReadiness(domain, valuesMap);

  // Separate critical vs recommended
  const missingCritical = missing.filter(f => f.isCritical);
  const missingRecommended = missing.filter(f => f.isRecommended && !f.isCritical);

  // Find fields that are proposed but not confirmed
  const pendingReview = requiredFields.filter(f => {
    const resolved = values.get(f.key);
    return resolved?.status === 'proposed';
  });

  // Determine if ready
  // Ready if no critical fields are missing
  const isReady = missingCritical.length === 0;

  // Build block reason
  let blockReason: string | null = null;
  if (!isReady) {
    const criticalLabels = missingCritical.slice(0, 3).map(f => f.shortLabel || f.label);
    const remaining = missingCritical.length - 3;
    blockReason = `Missing: ${criticalLabels.join(', ')}`;
    if (remaining > 0) {
      blockReason += ` (+${remaining} more)`;
    }
  }

  return {
    isReady,
    score,
    missingCritical,
    missingRecommended,
    blockReason,
    pendingReview,
  };
}

/**
 * Check if strategy is ready to synthesize
 */
export async function isStrategyReady(companyId: string): Promise<{
  ready: boolean;
  score: number;
  blockers: string[];
}> {
  const result = await computeReadiness(companyId, 'strategy');
  return {
    ready: result.isReady,
    score: result.score,
    blockers: result.missingCritical.map(f => f.shortLabel || f.label),
  };
}

/**
 * Check if Website Program can be generated
 */
export async function isWebsiteProgramReady(companyId: string): Promise<{
  ready: boolean;
  score: number;
  blockers: string[];
}> {
  const result = await computeReadiness(companyId, 'websiteProgram');
  return {
    ready: result.isReady,
    score: result.score,
    blockers: result.missingCritical.map(f => f.shortLabel || f.label),
  };
}

// ============================================================================
// Context Deep Link Helpers
// ============================================================================

/**
 * Get deep link to Context page for a specific field
 *
 * @param companyId - Company ID
 * @param key - Field key
 * @returns URL to Context page with focus on the field
 */
export function getContextDeepLink(companyId: string, key: string): string {
  const field = getRegistryEntry(key);
  if (!field) {
    return `/c/${companyId}/context`;
  }

  // Use focusKey for specific field, zone as fallback
  return `/c/${companyId}/context?focusKey=${encodeURIComponent(key)}&zone=${encodeURIComponent(field.zoneId)}`;
}

/**
 * Get fix link for a missing field
 * Returns link to Context page focused on the field
 */
export function getFixLink(companyId: string, key: string): {
  href: string;
  label: string;
  fieldLabel: string;
} {
  const field = getRegistryEntry(key);
  return {
    href: getContextDeepLink(companyId, key),
    label: 'Fix in Context',
    fieldLabel: field?.shortLabel || field?.label || key,
  };
}
