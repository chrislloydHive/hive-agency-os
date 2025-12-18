// lib/contextGraph/migration/v1ToV2.ts
// Migration utilities for Context Schema V1 → V2
//
// Handles:
// 1. Converting string values to lists
// 2. Converting string values to select options
// 3. Removing deprecated fields
// 4. Mapping old field names to new field names

import {
  isSchemaV2Key,
  getSchemaV2Entry,
  type ContextSchemaV2Key,
} from '../unifiedRegistry';

// ============================================================================
// Types
// ============================================================================

export interface MigrationResult {
  /** Migrated data with Schema V2 keys */
  data: Record<string, unknown>;
  /** Keys that were removed (deprecated) */
  removed: string[];
  /** Keys that were migrated (type converted or renamed) */
  migrated: { key: string; reason: string }[];
  /** Keys that were kept as-is */
  unchanged: string[];
  /** Errors encountered during migration */
  errors: { key: string; error: string }[];
}

// ============================================================================
// Deprecated Fields (to be removed in V2)
// ============================================================================

/**
 * Fields that are deprecated and should be removed in Schema V2
 */
export const DEPRECATED_FIELDS = new Set<string>([
  // Free-form dumping grounds
  'ops.notes',
  'ops.other',
  'identity.other',
  'audience.other',
  'brand.other',
  'productOffer.other',
  'competitive.other',

  // Tone of Voice (replaced by brandAttributes)
  'brand.toneOfVoice',

  // Positioning (moved to strategy, not context)
  'brand.positioning',

  // Duplicate/redundant fields
  'identity.competitiveLandscape', // Use competitive domain instead
  'identity.marketPosition', // Derived from strategy
]);

// ============================================================================
// Field Mapping (V1 → V2)
// ============================================================================

/**
 * Mapping of old field keys to new field keys
 * Handles both key renames and domain prefix changes
 */
export const FIELD_KEY_MAPPING: Record<string, ContextSchemaV2Key> = {
  // ============================================================================
  // Identity → Business Reality
  // ============================================================================
  'identity.industry': 'businessReality.industry',
  'identity.marketMaturity': 'businessReality.marketStage',
  'identity.marketStage': 'businessReality.marketStage',
  'identity.businessModel': 'businessReality.businessModel',
  'identity.seasonalityNotes': 'businessReality.seasonalityNotes',
  'identity.geographicFootprint': 'businessReality.geoFocus',
  'identity.serviceArea': 'businessReality.geoFocus',

  // ============================================================================
  // Audience (mostly unchanged, some field renames)
  // ============================================================================
  'audience.painPoints': 'audience.customerPainPoints',
  'audience.icpDescription': 'audience.primaryAudience', // ICP maps to primary audience

  // ============================================================================
  // ProductOffer → Offer
  // ============================================================================
  'productOffer.primaryProducts': 'offer.productsServices',
  'productOffer.productsServices': 'offer.productsServices',
  'productOffer.valueProposition': 'offer.coreOutcome',
  'productOffer.differentiators': 'offer.differentiatorsObserved',
  'productOffer.primaryConversionAction': 'gtm.conversionAction',

  // ============================================================================
  // Competitive (field renames)
  // ============================================================================
  'competitive.competitorsNotes': 'competitive.competitiveNotes',
  'competitive.primaryCompetitors': 'competitive.competitors',

  // ============================================================================
  // OperationalConstraints → Constraints
  // ============================================================================
  'operationalConstraints.minBudget': 'constraints.minBudget',
  'operationalConstraints.maxBudget': 'constraints.maxBudget',
  'operationalConstraints.geoRestrictions': 'constraints.geoRestrictions',
  'ops.minBudget': 'constraints.minBudget',
  'ops.maxBudget': 'constraints.maxBudget',
  'ops.budgetMin': 'constraints.minBudget',
  'ops.budgetMax': 'constraints.maxBudget',
};

// ============================================================================
// Type Conversion Utilities
// ============================================================================

/**
 * Convert a string to a list by splitting on common delimiters
 */
export function stringToList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }

  if (typeof value !== 'string') {
    return [];
  }

  // Split on newlines, semicolons, or comma followed by space
  const items = value
    .split(/[\n;]|,\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return items;
}

/**
 * Convert a value to the closest matching select option
 */
export function stringToSelectOption(
  value: unknown,
  validOptions: string[],
  defaultValue: string = 'unknown'
): string {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();

  // Exact match
  const exactMatch = validOptions.find(opt => opt === normalized);
  if (exactMatch) return exactMatch;

  // Case-insensitive match
  const caseMatch = validOptions.find(opt => opt.toLowerCase() === normalized);
  if (caseMatch) return caseMatch;

  // Partial match (contains)
  const partialMatch = validOptions.find(opt =>
    normalized.includes(opt.toLowerCase()) || opt.toLowerCase().includes(normalized)
  );
  if (partialMatch) return partialMatch;

  return defaultValue;
}

// ============================================================================
// Value Type Migration
// ============================================================================

/**
 * Migrate a single value to Schema V2 type
 */
function migrateValue(
  key: string,
  value: unknown,
  targetKey: ContextSchemaV2Key
): { value: unknown; migrated: boolean; reason?: string } {
  const entry = getSchemaV2Entry(targetKey);
  if (!entry) {
    return { value, migrated: false };
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { value, migrated: false };
  }

  switch (entry.valueType) {
    case 'select': {
      if (typeof value === 'string' && entry.options) {
        const validValues = entry.options.map(o => o.value);
        if (!validValues.includes(value)) {
          const converted = stringToSelectOption(value, validValues);
          return {
            value: converted,
            migrated: converted !== value,
            reason: `Converted "${value}" to select option "${converted}"`,
          };
        }
      }
      break;
    }

    case 'multi-select': {
      // Convert string to array if needed
      if (typeof value === 'string') {
        const list = stringToList(value);
        // Filter to valid options if custom values not allowed
        if (entry.options && !entry.allowCustomOptions) {
          const validValues = entry.options.map(o => o.value);
          const filtered = list.filter(v => validValues.includes(v));
          return {
            value: filtered,
            migrated: true,
            reason: `Converted string to multi-select array`,
          };
        }
        return {
          value: list,
          migrated: true,
          reason: `Converted string to array`,
        };
      }
      break;
    }

    case 'list':
    case 'string[]':
    case 'array': {
      // Convert string to list if needed
      if (typeof value === 'string') {
        const list = stringToList(value);
        return {
          value: list,
          migrated: true,
          reason: `Converted string to list`,
        };
      }
      break;
    }

    case 'url': {
      // Basic URL normalization
      if (typeof value === 'string') {
        let url = value.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
          return {
            value: url,
            migrated: true,
            reason: `Added https:// prefix to URL`,
          };
        }
      }
      break;
    }

    case 'number': {
      // Parse string to number if needed
      if (typeof value === 'string') {
        const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) {
          return {
            value: num,
            migrated: true,
            reason: `Converted string to number`,
          };
        }
      }
      break;
    }
  }

  return { value, migrated: false };
}

// ============================================================================
// Main Migration Function
// ============================================================================

/**
 * Migrate context data from V1 to V2 schema
 *
 * @param v1Data - Raw context data in V1 format
 * @returns Migration result with V2 data and migration report
 */
export function migrateContextV1ToV2(
  v1Data: Record<string, unknown>
): MigrationResult {
  const result: MigrationResult = {
    data: {},
    removed: [],
    migrated: [],
    unchanged: [],
    errors: [],
  };

  for (const [key, value] of Object.entries(v1Data)) {
    try {
      // 1. Check if deprecated
      if (DEPRECATED_FIELDS.has(key)) {
        result.removed.push(key);
        continue;
      }

      // 2. Check if key needs to be renamed
      let targetKey = key;
      if (FIELD_KEY_MAPPING[key]) {
        targetKey = FIELD_KEY_MAPPING[key];
        result.migrated.push({
          key,
          reason: `Renamed to ${targetKey}`,
        });
      }

      // 3. Check if target key is valid in Schema V2
      if (!isSchemaV2Key(targetKey)) {
        // Keep non-schema fields but log them as unchanged
        // (they may be system fields or legacy data)
        result.unchanged.push(key);
        result.data[key] = value;
        continue;
      }

      // 4. Migrate value type if needed
      const { value: migratedValue, migrated, reason } = migrateValue(
        key,
        value,
        targetKey as ContextSchemaV2Key
      );

      if (migrated && reason) {
        result.migrated.push({ key, reason });
      } else if (!result.migrated.find(m => m.key === key)) {
        result.unchanged.push(key);
      }

      result.data[targetKey] = migratedValue;

    } catch (error) {
      result.errors.push({
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      // Keep original value on error
      result.data[key] = value;
    }
  }

  return result;
}

/**
 * Get a summary of the migration for logging
 */
export function getMigrationSummary(result: MigrationResult): string {
  const lines: string[] = [
    `Migration Summary:`,
    `- Removed: ${result.removed.length} deprecated fields`,
    `- Migrated: ${result.migrated.length} fields (type converted or renamed)`,
    `- Unchanged: ${result.unchanged.length} fields`,
    `- Errors: ${result.errors.length} fields`,
  ];

  if (result.removed.length > 0) {
    lines.push(`\nRemoved fields: ${result.removed.join(', ')}`);
  }

  if (result.migrated.length > 0) {
    lines.push(`\nMigrated fields:`);
    for (const m of result.migrated) {
      lines.push(`  - ${m.key}: ${m.reason}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push(`\nErrors:`);
    for (const e of result.errors) {
      lines.push(`  - ${e.key}: ${e.error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if data needs migration
 * Returns true if any deprecated fields or old field names are found
 */
export function needsMigration(data: Record<string, unknown>): boolean {
  for (const key of Object.keys(data)) {
    if (DEPRECATED_FIELDS.has(key)) return true;
    if (FIELD_KEY_MAPPING[key]) return true;
  }
  return false;
}
