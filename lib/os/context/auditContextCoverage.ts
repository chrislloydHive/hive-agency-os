// lib/os/context/auditContextCoverage.ts
// Bindings Auditor - Compares Required Keys Registry vs Actual Context Nodes
//
// This auditor identifies:
// - presentKeys: Required keys that exist with values in the context graph
// - missingKeys: Required keys that do not exist as nodes
// - blockedByKeys: Required keys that are missing or not confirmed
// - mismatchedKeys: Keys that exist but with different naming (for migration)

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType, WithMetaArrayType } from '@/lib/contextGraph/types';
import {
  REQUIRED_CONTEXT_KEYS,
  type RequiredContextKey,
  getAllKeysForRequirement,
} from './requiredContextKeys';

// ============================================================================
// Types
// ============================================================================

/**
 * A present required field
 */
export interface PresentField {
  /** The required key definition */
  requiredKey: RequiredContextKey;
  /** The actual key that satisfied the requirement (may be an alternative) */
  actualKey: string;
  /** The value */
  value: unknown;
  /** Whether the value is confirmed (vs proposed) */
  isConfirmed: boolean;
  /** Confidence score if available */
  confidence?: number;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * A missing required field
 */
export interface MissingField {
  /** The required key definition */
  requiredKey: RequiredContextKey;
  /** All keys checked (primary + alternatives) */
  checkedKeys: string[];
  /** Closest match found (for fuzzy matching) */
  closestMatch?: {
    key: string;
    similarity: number;
  };
}

/**
 * A blocked-by field (missing or not confirmed)
 */
export interface BlockedByField {
  /** The required key definition */
  requiredKey: RequiredContextKey;
  /** Reason for blocking */
  reason: 'missing' | 'not_confirmed' | 'empty_value';
  /** The actual key if it exists but is blocked */
  actualKey?: string;
}

/**
 * Audit result
 */
export interface ContextCoverageAudit {
  /** Company ID audited */
  companyId: string;

  /** Keys that are present with values */
  presentKeys: PresentField[];

  /** Keys that are completely missing */
  missingKeys: MissingField[];

  /** Keys that block strategy (missing OR not confirmed) */
  blockedByKeys: BlockedByField[];

  /** Keys with potential naming mismatches */
  mismatchedKeys: Array<{
    expectedKey: string;
    closestMatch: string;
    similarity: number;
  }>;

  /** Summary stats */
  stats: {
    totalRequired: number;
    presentCount: number;
    missingCount: number;
    blockedCount: number;
    completenessPercent: number;
  };

  /** Timestamp of audit */
  auditedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a field value from the context graph by domain and field name
 */
function getField(
  graph: CompanyContextGraph,
  domain: string,
  fieldName: string
): WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined {
  const domainObj = (graph as Record<string, unknown>)[domain];
  if (!domainObj || typeof domainObj !== 'object') return undefined;
  return (domainObj as Record<string, unknown>)[fieldName] as
    | WithMetaType<unknown>
    | WithMetaArrayType<unknown>
    | undefined;
}

/**
 * Check if a field has a non-empty value
 */
function hasValue(field: WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined): boolean {
  if (!field) return false;
  if (field.value === null || field.value === undefined) return false;
  if (typeof field.value === 'string') return field.value.trim().length > 0;
  if (Array.isArray(field.value)) return field.value.length > 0;
  if (typeof field.value === 'object') return Object.keys(field.value).length > 0;
  return true;
}

/**
 * Get the source type from provenance to determine if confirmed
 * In our system, user-provided values are "confirmed"
 */
function isConfirmedValue(field: WithMetaType<unknown> | WithMetaArrayType<unknown>): boolean {
  if (!field.provenance || field.provenance.length === 0) return false;

  const primarySource = field.provenance[0]?.source;
  // User, manual, and high-confidence lab sources are considered confirmed
  const confirmedSources = ['user', 'manual', 'setup_wizard', 'airtable'];
  return confirmedSources.includes(primarySource);
}

/**
 * Parse a key like 'audience.icpDescription' into domain and fieldName
 */
function parseKey(key: string): { domain: string; fieldName: string } {
  const parts = key.split('.');
  return {
    domain: parts[0],
    fieldName: parts.slice(1).join('.'),
  };
}

/**
 * Simple string similarity (Levenshtein distance based)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  const longerLength = longer.length;
  if (longerLength === 0) return 1;

  // Simple Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= shorter.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= longer.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter.charAt(i - 1) === longer.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  const distance = matrix[shorter.length][longer.length];
  return (longerLength - distance) / longerLength;
}

/**
 * Find the closest matching field in the graph for a given key
 */
function findClosestMatch(
  graph: CompanyContextGraph,
  targetKey: string
): { key: string; similarity: number } | undefined {
  const allKeys: string[] = [];

  // Collect all keys from the graph
  const domains = Object.keys(graph).filter(k => k !== 'meta' && k !== 'companyId' && k !== 'companyName');
  for (const domain of domains) {
    const domainObj = (graph as Record<string, unknown>)[domain];
    if (domainObj && typeof domainObj === 'object') {
      for (const fieldName of Object.keys(domainObj as object)) {
        allKeys.push(`${domain}.${fieldName}`);
      }
    }
  }

  let bestMatch: { key: string; similarity: number } | undefined;
  for (const key of allKeys) {
    const similarity = stringSimilarity(targetKey, key);
    if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { key, similarity };
    }
  }

  return bestMatch;
}

// ============================================================================
// Main Audit Function
// ============================================================================

/**
 * Audit context coverage for a company
 *
 * Compares the required keys registry against actual context nodes
 * to identify what's present, missing, and blocking strategy.
 *
 * @param companyId - The company ID
 * @param graph - The company's context graph
 * @returns Audit result with present, missing, and blocked keys
 */
export function auditContextCoverage(
  companyId: string,
  graph: CompanyContextGraph
): ContextCoverageAudit {
  const presentKeys: PresentField[] = [];
  const missingKeys: MissingField[] = [];
  const blockedByKeys: BlockedByField[] = [];
  const mismatchedKeys: ContextCoverageAudit['mismatchedKeys'] = [];

  for (const requiredKey of REQUIRED_CONTEXT_KEYS) {
    // Get all keys that can satisfy this requirement (primary + alternatives)
    const allKeys = getAllKeysForRequirement(requiredKey.key);

    let found = false;
    let foundKey: string | undefined;
    let foundField: WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;

    // Check primary key and alternatives
    for (const key of allKeys) {
      const { domain, fieldName } = parseKey(key);
      const field = getField(graph, domain, fieldName);

      if (hasValue(field)) {
        found = true;
        foundKey = key;
        foundField = field;
        break;
      }
    }

    if (found && foundField && foundKey) {
      // Field is present with a value
      const isConfirmed = isConfirmedValue(foundField);

      presentKeys.push({
        requiredKey,
        actualKey: foundKey,
        value: foundField.value,
        isConfirmed,
        confidence: foundField.provenance?.[0]?.confidence,
        lastUpdated: foundField.provenance?.[0]?.updatedAt,
      });

      // If not confirmed, it's still a blocker
      if (!isConfirmed) {
        blockedByKeys.push({
          requiredKey,
          reason: 'not_confirmed',
          actualKey: foundKey,
        });
      }
    } else {
      // Field is missing
      const closestMatch = findClosestMatch(graph, requiredKey.key);

      missingKeys.push({
        requiredKey,
        checkedKeys: allKeys,
        closestMatch,
      });

      blockedByKeys.push({
        requiredKey,
        reason: 'missing',
      });

      // Track potential naming mismatches for migration
      if (closestMatch && closestMatch.similarity > 0.6) {
        mismatchedKeys.push({
          expectedKey: requiredKey.key,
          closestMatch: closestMatch.key,
          similarity: closestMatch.similarity,
        });
      }
    }
  }

  const totalRequired = REQUIRED_CONTEXT_KEYS.length;
  const presentCount = presentKeys.length;
  const missingCount = missingKeys.length;
  const blockedCount = blockedByKeys.length;
  const completenessPercent = Math.round((presentCount / totalRequired) * 100);

  const result: ContextCoverageAudit = {
    companyId,
    presentKeys,
    missingKeys,
    blockedByKeys,
    mismatchedKeys,
    stats: {
      totalRequired,
      presentCount,
      missingCount,
      blockedCount,
      completenessPercent,
    },
    auditedAt: new Date().toISOString(),
  };

  // Log for debugging
  console.log(`[AuditContextCoverage] Company ${companyId}:`, {
    present: presentCount,
    missing: missingCount,
    blocked: blockedCount,
    completeness: `${completenessPercent}%`,
    missingKeys: missingKeys.map(m => m.requiredKey.key),
  });

  return result;
}

/**
 * Get just the blocked-by keys for a company
 * This is the simplified version for UI display
 */
export function getBlockedByKeys(
  companyId: string,
  graph: CompanyContextGraph
): BlockedByField[] {
  const audit = auditContextCoverage(companyId, graph);
  return audit.blockedByKeys;
}

/**
 * Get a human-readable summary of what's blocking strategy
 */
export function getBlockedBySummary(
  companyId: string,
  graph: CompanyContextGraph
): {
  isBlocked: boolean;
  blockedLabels: string[];
  blockedKeys: string[];
  message: string;
} {
  const blockedByKeys = getBlockedByKeys(companyId, graph);

  if (blockedByKeys.length === 0) {
    return {
      isBlocked: false,
      blockedLabels: [],
      blockedKeys: [],
      message: 'Strategy-Ready',
    };
  }

  const blockedLabels = blockedByKeys.map(b => b.requiredKey.shortLabel || b.requiredKey.label);
  const blockedKeys = blockedByKeys.map(b => b.requiredKey.key);

  return {
    isBlocked: true,
    blockedLabels,
    blockedKeys,
    message: `Blocked by: ${blockedLabels.join(', ')}`,
  };
}

/**
 * Check if strategy is ready (no blockers)
 */
export function isStrategyReadyByAudit(
  companyId: string,
  graph: CompanyContextGraph
): boolean {
  const blockedByKeys = getBlockedByKeys(companyId, graph);
  return blockedByKeys.length === 0;
}
