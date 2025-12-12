// lib/os/writeContract/diff.ts
// JSON Patch (RFC 6902) diff computation
//
// Computes the minimal set of operations to transform base into candidate.

import type { JsonPointer, PatchOperation, PatchOpType } from './types';
import { buildPointer } from './locks';

// ============================================================================
// Deep Equality
// ============================================================================

/**
 * Deep equality check for JSON values
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Deep clone a value
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deepClone) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    result[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return result as T;
}

// ============================================================================
// JSON Patch Computation
// ============================================================================

/**
 * Compute JSON Patch operations to transform base into candidate
 *
 * @param base - The original state
 * @param candidate - The desired state
 * @param path - Current path (for recursion)
 * @returns Array of patch operations
 */
export function computeDiff(
  base: unknown,
  candidate: unknown,
  path: string[] = []
): PatchOperation[] {
  const operations: PatchOperation[] = [];

  // Handle null/undefined cases
  if (candidate === undefined && base !== undefined) {
    operations.push({
      op: 'remove',
      path: buildPointer(path),
      oldValue: base,
    });
    return operations;
  }

  if (base === undefined && candidate !== undefined) {
    operations.push({
      op: 'add',
      path: buildPointer(path),
      value: candidate,
    });
    return operations;
  }

  // If types differ, replace
  if (typeof base !== typeof candidate || Array.isArray(base) !== Array.isArray(candidate)) {
    if (candidate !== undefined) {
      operations.push({
        op: 'replace',
        path: buildPointer(path),
        value: candidate,
        oldValue: base,
      });
    }
    return operations;
  }

  // Handle arrays
  if (Array.isArray(base) && Array.isArray(candidate)) {
    return computeArrayDiff(base, candidate, path);
  }

  // Handle objects
  if (base !== null && typeof base === 'object' && candidate !== null && typeof candidate === 'object') {
    return computeObjectDiff(
      base as Record<string, unknown>,
      candidate as Record<string, unknown>,
      path
    );
  }

  // Handle primitives
  if (base !== candidate) {
    operations.push({
      op: 'replace',
      path: buildPointer(path),
      value: candidate,
      oldValue: base,
    });
  }

  return operations;
}

/**
 * Compute diff for objects
 */
function computeObjectDiff(
  base: Record<string, unknown>,
  candidate: Record<string, unknown>,
  path: string[]
): PatchOperation[] {
  const operations: PatchOperation[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(candidate)]);

  for (const key of allKeys) {
    const baseValue = base[key];
    const candidateValue = candidate[key];

    if (!(key in candidate) && key in base) {
      // Key removed
      operations.push({
        op: 'remove',
        path: buildPointer([...path, key]),
        oldValue: baseValue,
      });
    } else if (key in candidate && !(key in base)) {
      // Key added
      operations.push({
        op: 'add',
        path: buildPointer([...path, key]),
        value: candidateValue,
      });
    } else if (!deepEqual(baseValue, candidateValue)) {
      // Key changed - recurse for nested diffs
      const nestedOps = computeDiff(baseValue, candidateValue, [...path, key]);
      operations.push(...nestedOps);
    }
  }

  return operations;
}

/**
 * Compute diff for arrays
 *
 * Uses a simple approach: if arrays differ, generate operations for each position.
 * For better diffs on arrays with IDs, use computeArrayDiffById.
 */
function computeArrayDiff(
  base: unknown[],
  candidate: unknown[],
  path: string[]
): PatchOperation[] {
  const operations: PatchOperation[] = [];

  // Check if arrays have identifiable objects (with 'id' field)
  const hasIds = base.every(item => item && typeof item === 'object' && 'id' in (item as object)) &&
    candidate.every(item => item && typeof item === 'object' && 'id' in (item as object));

  if (hasIds) {
    return computeArrayDiffById(
      base as Array<{ id: string } & Record<string, unknown>>,
      candidate as Array<{ id: string } & Record<string, unknown>>,
      path
    );
  }

  // Simple positional diff
  const maxLength = Math.max(base.length, candidate.length);

  for (let i = 0; i < maxLength; i++) {
    const baseItem = base[i];
    const candidateItem = candidate[i];

    if (i >= candidate.length) {
      // Item removed
      operations.push({
        op: 'remove',
        path: buildPointer([...path, String(i)]),
        oldValue: baseItem,
      });
    } else if (i >= base.length) {
      // Item added
      operations.push({
        op: 'add',
        path: buildPointer([...path, String(i)]),
        value: candidateItem,
      });
    } else if (!deepEqual(baseItem, candidateItem)) {
      // Item changed - recurse
      const nestedOps = computeDiff(baseItem, candidateItem, [...path, String(i)]);
      operations.push(...nestedOps);
    }
  }

  return operations;
}

/**
 * Compute diff for arrays with identifiable objects (by 'id' field)
 * Produces more meaningful diffs for reordered/modified arrays
 */
function computeArrayDiffById(
  base: Array<{ id: string } & Record<string, unknown>>,
  candidate: Array<{ id: string } & Record<string, unknown>>,
  path: string[]
): PatchOperation[] {
  const operations: PatchOperation[] = [];

  const baseMap = new Map(base.map((item, index) => [item.id, { item, index }]));
  const candidateMap = new Map(candidate.map((item, index) => [item.id, { item, index }]));

  // Find removed items
  for (const [id, { item, index }] of baseMap) {
    if (!candidateMap.has(id)) {
      operations.push({
        op: 'remove',
        path: buildPointer([...path, String(index)]),
        oldValue: item,
      });
    }
  }

  // Find added items and changed items
  for (const [id, { item: candidateItem, index: candidateIndex }] of candidateMap) {
    const baseEntry = baseMap.get(id);

    if (!baseEntry) {
      // New item
      operations.push({
        op: 'add',
        path: buildPointer([...path, String(candidateIndex)]),
        value: candidateItem,
      });
    } else {
      // Existing item - check for changes
      const baseItem = baseEntry.item;
      if (!deepEqual(baseItem, candidateItem)) {
        // Generate nested diffs for the item
        const nestedOps = computeDiff(baseItem, candidateItem, [...path, String(candidateIndex)]);
        operations.push(...nestedOps);
      }
    }
  }

  return operations;
}

// ============================================================================
// Patch Utilities
// ============================================================================

/**
 * Get the top-level section from a path
 * "/companyReality/businessModel/value" => "companyReality"
 */
export function getTopLevelSection(path: JsonPointer): string {
  if (!path || path === '/') return '';
  const segments = path.slice(1).split('/');
  return segments[0] || '';
}

/**
 * Group operations by top-level section
 */
export function groupOperationsBySection(
  operations: PatchOperation[]
): Map<string, PatchOperation[]> {
  const groups = new Map<string, PatchOperation[]>();

  for (const op of operations) {
    const section = getTopLevelSection(op.path);
    const existing = groups.get(section) || [];
    existing.push(op);
    groups.set(section, existing);
  }

  return groups;
}

/**
 * Create a human-readable description of an operation
 */
export function describeOperation(op: PatchOperation): string {
  const pathParts = op.path.slice(1).split('/');
  const fieldName = pathParts[pathParts.length - 1];

  switch (op.op) {
    case 'add':
      return `Add "${fieldName}"`;
    case 'remove':
      return `Remove "${fieldName}"`;
    case 'replace':
      return `Change "${fieldName}"`;
    default:
      return `${op.op} "${fieldName}"`;
  }
}
