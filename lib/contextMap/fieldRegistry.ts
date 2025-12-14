// lib/contextMap/fieldRegistry.ts
// Context Map field registry - wraps unified registry for backward compatibility
//
// IMPORTANT: All new fields should be added to lib/contextGraph/unifiedRegistry.ts
// This file adapts the unified registry to the FieldRegistryEntry format.

import type { ZoneId } from '@/components/context-map/types';
import {
  UNIFIED_FIELD_REGISTRY,
  type UnifiedFieldEntry,
  type FieldSource as UnifiedFieldSource,
  type FieldStatus as UnifiedFieldStatus,
  getFieldsForZone as getUnifiedFieldsForZone,
  getRegistryEntry as getUnifiedRegistryEntry,
  getRegistryEntryByLegacyPath as getUnifiedRegistryEntryByLegacyPath,
  getCriticalFields as getUnifiedCriticalFields,
} from '@/lib/contextGraph/unifiedRegistry';
import { isCanonicalKey } from '@/lib/contextGraph/canonicalFilter';

// ============================================================================
// Types (re-export for backward compatibility)
// ============================================================================

export type FieldSource = UnifiedFieldSource;
export type FieldStatus = UnifiedFieldStatus;

/**
 * Legacy field registry entry format
 * @deprecated Use UnifiedFieldEntry from lib/contextGraph/unifiedRegistry.ts
 */
export interface FieldRegistryEntry {
  /** Unique key for this field (used as node key) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Category/domain for grouping (maps to zone) */
  category: string;
  /** Zone ID where this field should appear */
  zoneId: ZoneId;
  /** Path in legacy CompanyContext object (dot notation for nested) */
  legacyPath: string;
  /** Default status for this field */
  defaultStatus: FieldStatus;
  /** Default source for this field */
  defaultSource: FieldSource;
  /** Whether this is a critical field for strategy */
  isCritical?: boolean;
  /** Whether this is a recommended field */
  isRecommended?: boolean;
  /** Type hint for value formatting */
  valueType?: 'string' | 'number' | 'array' | 'competitors';
}

/**
 * Convert unified entry to legacy format
 */
function toFieldRegistryEntry(entry: UnifiedFieldEntry): FieldRegistryEntry {
  return {
    key: entry.key,
    label: entry.label,
    category: entry.category,
    zoneId: entry.zoneId,
    legacyPath: entry.legacyPath,
    defaultStatus: entry.defaultStatus,
    defaultSource: entry.defaultSource,
    isCritical: entry.isCritical,
    isRecommended: entry.isRecommended,
    valueType: entry.valueType === 'string[]' ? 'array' :
               entry.valueType === 'object' ? 'string' :
               entry.valueType as 'string' | 'number' | 'array' | 'competitors',
  };
}

// ============================================================================
// Unified Field Registry (adapted for backward compatibility)
// ============================================================================

/**
 * Complete registry of all fields that appear in the Context Map.
 * Derived from the unified registry, filtered to:
 * - showInMap !== false
 * - isCanonicalKey(entry.key) === true (excludes deprecated domains and removed fields)
 */
export const FIELD_REGISTRY: FieldRegistryEntry[] = UNIFIED_FIELD_REGISTRY
  .filter(entry => entry.showInMap !== false)
  .filter(entry => isCanonicalKey(entry.key)) // CANONICALIZATION: Only canonical fields
  .map(toFieldRegistryEntry);

// ============================================================================
// Registry Lookup Utilities
// ============================================================================

/**
 * Map of field key to registry entry for quick lookup
 */
export const FIELD_REGISTRY_MAP = new Map<string, FieldRegistryEntry>(
  FIELD_REGISTRY.map(entry => [entry.key, entry])
);

/**
 * Map of legacy path to registry entry for hydration
 */
export const LEGACY_PATH_MAP = new Map<string, FieldRegistryEntry>(
  FIELD_REGISTRY.map(entry => [entry.legacyPath, entry])
);

/**
 * Get registry entry by field key
 */
export function getFieldEntry(key: string): FieldRegistryEntry | undefined {
  const entry = getUnifiedRegistryEntry(key);
  return entry ? toFieldRegistryEntry(entry) : undefined;
}

/**
 * Get registry entry by legacy path
 */
export function getFieldEntryByLegacyPath(legacyPath: string): FieldRegistryEntry | undefined {
  const entry = getUnifiedRegistryEntryByLegacyPath(legacyPath);
  return entry ? toFieldRegistryEntry(entry) : undefined;
}

/**
 * Get all fields for a specific zone
 */
export function getFieldsForZone(zoneId: ZoneId): FieldRegistryEntry[] {
  return getUnifiedFieldsForZone(zoneId)
    .filter(entry => entry.showInMap !== false)
    .map(toFieldRegistryEntry);
}

/**
 * Get all critical fields
 */
export function getCriticalFields(): FieldRegistryEntry[] {
  return getUnifiedCriticalFields().map(toFieldRegistryEntry);
}

/**
 * Get all recommended fields
 */
export function getRecommendedFields(): FieldRegistryEntry[] {
  return FIELD_REGISTRY.filter(entry => entry.isRecommended);
}

/**
 * Log warning for unmapped category
 */
export function logUnmappedCategory(category: string, fieldKey: string): void {
  console.warn(
    `[ContextMap:FieldRegistry] Unmapped category "${category}" for field "${fieldKey}". ` +
    `Add to lib/contextGraph/unifiedRegistry.ts or it will appear in "Other" zone.`
  );
}
