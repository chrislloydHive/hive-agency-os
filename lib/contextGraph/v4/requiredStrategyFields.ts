// lib/contextGraph/v4/requiredStrategyFields.ts
// V4 Strategy-Required Fields
//
// Maps the Strategy-Ready Minimum (SRM) fields to V4 paths.
// Used by both the UI (strategy blocked panel) and the propose-baseline endpoint.

import { SRM_FIELDS } from '../readiness/strategyReady';

/**
 * V4 strategy-required field definition
 */
export interface V4RequiredField {
  /** V4 field path (domain.field) */
  path: string;
  /** Domain name */
  domain: string;
  /** Field name */
  field: string;
  /** Human-readable label */
  label: string;
  /** Why this field is required */
  reason: string;
  /** Alternative paths that satisfy this requirement (OR logic) */
  alternatives?: string[];
}

/**
 * Convert SRM_FIELDS to V4 paths
 * V4 uses "domain.field" format (e.g., "identity.businessModel")
 */
export const V4_REQUIRED_STRATEGY_FIELDS: V4RequiredField[] = SRM_FIELDS.map((srmField) => {
  const alternatives = 'alternatives' in srmField ? srmField.alternatives : undefined;
  return {
    path: `${srmField.domain}.${srmField.field}`,
    domain: srmField.domain,
    field: srmField.field,
    label: srmField.label,
    reason: srmField.reason,
    // Handle alternatives: if already "domain.field" format, keep as-is; otherwise prefix with domain
    alternatives: alternatives?.map((alt: string) =>
      alt.includes('.') ? alt : `${srmField.domain}.${alt}`
    ),
  };
});

/**
 * Get all V4 paths that are required for strategy (including alternatives)
 */
export function getAllRequiredPaths(): Set<string> {
  const paths = new Set<string>();
  for (const field of V4_REQUIRED_STRATEGY_FIELDS) {
    paths.add(field.path);
    if (field.alternatives) {
      for (const alt of field.alternatives) {
        paths.add(alt);
      }
    }
  }
  return paths;
}

/**
 * Check if a required field is satisfied by confirmed/proposed fields
 * Uses OR logic for alternatives
 */
export function isFieldSatisfied(
  field: V4RequiredField,
  confirmedKeys: Set<string>,
  proposedKeys: Set<string>
): { satisfied: boolean; by?: 'confirmed' | 'proposed' } {
  // Check primary path
  if (confirmedKeys.has(field.path)) {
    return { satisfied: true, by: 'confirmed' };
  }
  if (proposedKeys.has(field.path)) {
    return { satisfied: true, by: 'proposed' };
  }

  // Check alternatives
  if (field.alternatives) {
    for (const alt of field.alternatives) {
      if (confirmedKeys.has(alt)) {
        return { satisfied: true, by: 'confirmed' };
      }
      if (proposedKeys.has(alt)) {
        return { satisfied: true, by: 'proposed' };
      }
    }
  }

  return { satisfied: false };
}

/**
 * Get missing required strategy fields
 */
export function getMissingRequiredV4(
  confirmedKeys: Set<string>,
  proposedKeys: Set<string>
): V4RequiredField[] {
  return V4_REQUIRED_STRATEGY_FIELDS.filter(
    (field) => !isFieldSatisfied(field, confirmedKeys, proposedKeys).satisfied
  );
}

/**
 * Get the count of satisfied required fields
 */
export function getRequiredFieldStats(
  confirmedKeys: Set<string>,
  proposedKeys: Set<string>
): {
  total: number;
  confirmed: number;
  proposed: number;
  missing: number;
  ready: boolean;
} {
  let confirmed = 0;
  let proposed = 0;
  let missing = 0;

  for (const field of V4_REQUIRED_STRATEGY_FIELDS) {
    const result = isFieldSatisfied(field, confirmedKeys, proposedKeys);
    if (!result.satisfied) {
      missing++;
    } else if (result.by === 'confirmed') {
      confirmed++;
    } else {
      proposed++;
    }
  }

  return {
    total: V4_REQUIRED_STRATEGY_FIELDS.length,
    confirmed,
    proposed,
    missing,
    ready: missing === 0 && proposed === 0,
  };
}
