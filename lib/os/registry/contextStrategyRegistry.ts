// lib/os/registry/contextStrategyRegistry.ts
// Context ↔ Strategy Linkage - Re-exports from Unified Registry
//
// IMPORTANT: All field definitions now live in lib/contextGraph/unifiedRegistry.ts
// This file provides backward-compatible re-exports and strategy-specific utilities.
//
// RULES:
// 1. Strategy Inputs UI and Context Map UI must both be driven from unified registry
// 2. AI proposes only (creates proposed nodes), humans confirm
// 3. Confirmed context is protected from AI overwrite
// 4. Strategy can read confirmed + proposed, but can only write proposals to Context

import type { ZoneId } from '@/components/context-map/types';

// Re-export types and functions from unified registry
export {
  type FieldSource,
  type FieldStatus,
  type FieldValueType,
  type StrategySection,
  type RequiredForDomain,
  type UnifiedFieldEntry,
  DEFAULT_SOURCE_PRIORITY,
  UNIFIED_FIELD_REGISTRY,
  REGISTRY_BY_KEY,
  REGISTRY_BY_LEGACY_PATH,
  REGISTRY_BY_GRAPH_PATH,
  getRegistryEntry,
  getRegistryEntryByLegacyPath,
  getRegistryEntryByGraphPath,
  getFieldsForDomain,
  getFieldsForZone,
  getFieldsForStrategySection,
  getFieldsRequiredFor,
  getCriticalFields,
  getAIProposableFields,
  getLabelForKey,
  getShortLabelForKey,
  validateFieldKeys,
  validateGraphPath,
  migrateLegacyKey,
  LEGACY_KEY_MIGRATION,
} from '@/lib/contextGraph/unifiedRegistry';

// ============================================================================
// Legacy Type Alias (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use UnifiedFieldEntry from lib/contextGraph/unifiedRegistry.ts
 */
export interface ContextStrategyField {
  // === Identity ===
  /** Canonical, stable key (e.g., 'identity.businessModel') */
  key: string;
  /** Human-readable label */
  label: string;
  /** Short label for compact displays */
  shortLabel?: string;

  // === Context Map Placement ===
  /** Domain/category for grouping */
  category: string;
  /** Zone ID where this field appears in Context Map */
  zoneId: ZoneId;

  // === Strategy Inputs Placement ===
  /** Strategy Inputs section (null = not in Strategy Inputs) */
  strategySection: import('@/lib/contextGraph/unifiedRegistry').StrategySection;
  /** Field name within the Strategy section (for mapping) */
  strategyField?: string;

  // === Data Shape ===
  /** Type of value */
  valueType: import('@/lib/contextGraph/unifiedRegistry').FieldValueType;
  /** Path in legacy CompanyContext object (dot notation) */
  legacyPath: string;
  /** Path in CompanyContextGraph (for resolver) */
  graphPath?: string;

  // === Defaults ===
  /** Default status for new entries */
  defaultStatus: import('@/lib/contextGraph/unifiedRegistry').FieldStatus;
  /** Default source */
  defaultSource: import('@/lib/contextGraph/unifiedRegistry').FieldSource;

  // === Requirements ===
  /** Domains that require this field */
  requiredFor: import('@/lib/contextGraph/unifiedRegistry').RequiredForDomain[];
  /** Is this critical (blocks strategy)? */
  isCritical?: boolean;
  /** Is this recommended but not critical? */
  isRecommended?: boolean;

  // === Resolution ===
  /** Source priority for resolution (higher = preferred) */
  sourcePriority?: import('@/lib/contextGraph/unifiedRegistry').FieldSource[];

  // === Readiness ===
  /** Weight for readiness calculation (0-1, higher = more important) */
  readinessWeight?: number;

  // === AI Generation ===
  /** Whether AI can propose values for this field */
  aiProposable?: boolean;
  /** Prompt hint for AI when generating proposals */
  aiPromptHint?: string;
}

// ============================================================================
// Legacy Registry Alias (for backward compatibility)
// ============================================================================

import {
  UNIFIED_FIELD_REGISTRY as _UNIFIED_REGISTRY,
  type UnifiedFieldEntry as _UnifiedFieldEntry,
} from '@/lib/contextGraph/unifiedRegistry';

/**
 * @deprecated Use UNIFIED_FIELD_REGISTRY from lib/contextGraph/unifiedRegistry.ts
 */
export const CONTEXT_STRATEGY_REGISTRY = _UNIFIED_REGISTRY as unknown as ContextStrategyField[];

// ============================================================================
// Strategy-Specific Helpers
// ============================================================================

import {
  getFieldsForStrategySection as _getFieldsForStrategySection,
  getFieldsRequiredFor as _getFieldsRequiredFor,
  type StrategySection as _StrategySection,
  type RequiredForDomain as _RequiredForDomain,
} from '@/lib/contextGraph/unifiedRegistry';

/**
 * Get the mapping from strategy field names to context keys
 * Used by Strategy Inputs to resolve values
 */
export function getStrategyToContextMapping(section: _StrategySection): Map<string, string> {
  const fields = _getFieldsForStrategySection(section);
  const mapping = new Map<string, string>();

  for (const field of fields) {
    if (field.strategyField) {
      mapping.set(field.strategyField, field.key);
    }
  }

  return mapping;
}

/**
 * Get context key for a strategy field
 */
export function getContextKeyForStrategyField(section: _StrategySection, strategyField: string): string | undefined {
  const fields = _getFieldsForStrategySection(section);
  const field = fields.find(f => f.strategyField === strategyField);
  return field?.key;
}

// ============================================================================
// Readiness Weight Helpers
// ============================================================================

/**
 * Calculate total weight for a domain
 */
export function getTotalWeightForDomain(domain: _RequiredForDomain): number {
  const fields = _getFieldsRequiredFor(domain);
  return fields.reduce((sum, field) => sum + (field.readinessWeight || 0.5), 0);
}

/**
 * Calculate weighted readiness score
 */
export function calculateWeightedReadiness(
  domain: _RequiredForDomain,
  values: Map<string, unknown>
): { score: number; missing: _UnifiedFieldEntry[]; present: _UnifiedFieldEntry[] } {
  const fields = _getFieldsRequiredFor(domain);
  const totalWeight = getTotalWeightForDomain(domain);

  const missing: _UnifiedFieldEntry[] = [];
  const present: _UnifiedFieldEntry[] = [];
  let presentWeight = 0;

  for (const field of fields) {
    const value = values.get(field.key);
    const hasValue = value !== null && value !== undefined &&
                     !(Array.isArray(value) && value.length === 0) &&
                     !(typeof value === 'string' && value.trim() === '');

    if (hasValue) {
      present.push(field);
      presentWeight += field.readinessWeight || 0.5;
    } else {
      missing.push(field);
    }
  }

  const score = totalWeight > 0 ? Math.round((presentWeight / totalWeight) * 100) : 0;

  return { score, missing, present };
}

/**
 * Get fields that are missing for a domain, given current values
 */
export function getMissingFieldsForDomain(
  domain: _RequiredForDomain,
  values: Map<string, unknown>
): _UnifiedFieldEntry[] {
  const required = _getFieldsRequiredFor(domain);
  return required.filter(field => {
    const value = values.get(field.key);
    return value === null || value === undefined ||
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'string' && value.trim() === '');
  });
}
