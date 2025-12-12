// lib/os/writeContract/locks.ts
// Lock evaluation for the Write Contract system
//
// Determines which paths are locked based on provenance metadata.
// Locked paths cannot be modified by AI - they can only be changed
// through explicit user action.

import type {
  JsonPointer,
  LockStatus,
  LockReason,
  LockEvaluationMeta,
  ContextFieldSource,
  ContextField,
  FieldSource,
  FieldProvenance,
} from './types';

// ============================================================================
// JSON Pointer Utilities
// ============================================================================

/**
 * Parse a JSON Pointer into path segments
 * "/foo/bar/0" => ["foo", "bar", "0"]
 */
export function parsePointer(pointer: JsonPointer): string[] {
  if (!pointer || pointer === '/') return [];
  // Remove leading slash and split
  return pointer.slice(1).split('/').map(segment =>
    // Unescape JSON Pointer escape sequences
    segment.replace(/~1/g, '/').replace(/~0/g, '~')
  );
}

/**
 * Build a JSON Pointer from path segments
 * ["foo", "bar", "0"] => "/foo/bar/0"
 */
export function buildPointer(segments: string[]): JsonPointer {
  if (segments.length === 0) return '';
  return '/' + segments.map(segment =>
    // Escape JSON Pointer special characters
    segment.replace(/~/g, '~0').replace(/\//g, '~1')
  ).join('/');
}

/**
 * Get a value from an object using a JSON Pointer
 */
export function getValueAtPointer(obj: unknown, pointer: JsonPointer): unknown {
  if (!pointer || pointer === '/') return obj;

  const segments = parsePointer(pointer);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Check if a path matches a pattern (supports * and ** wildcards)
 * Pattern: "/companyReality/* /value" matches "/companyReality/businessModel/value"
 * Pattern: "/strategyPillars/** " matches "/strategyPillars/0/decision"
 */
export function pathMatchesPattern(path: JsonPointer, pattern: JsonPointer): boolean {
  const pathSegments = parsePointer(path);
  const patternSegments = parsePointer(pattern);

  let pi = 0; // path index
  let pti = 0; // pattern index

  while (pi < pathSegments.length && pti < patternSegments.length) {
    const patternSeg = patternSegments[pti];

    if (patternSeg === '**') {
      // ** matches zero or more segments
      if (pti === patternSegments.length - 1) {
        // ** at end matches everything
        return true;
      }
      // Try to match the rest of the pattern
      const nextPattern = buildPointer(patternSegments.slice(pti + 1));
      for (let i = pi; i <= pathSegments.length; i++) {
        const remainingPath = buildPointer(pathSegments.slice(i));
        if (pathMatchesPattern(remainingPath, nextPattern)) {
          return true;
        }
      }
      return false;
    } else if (patternSeg === '*') {
      // * matches exactly one segment
      pi++;
      pti++;
    } else if (patternSeg === pathSegments[pi]) {
      // Exact match
      pi++;
      pti++;
    } else {
      return false;
    }
  }

  // Check if we consumed both completely
  // Allow pattern to end with ** that consumed rest
  if (pti < patternSegments.length && patternSegments[pti] === '**') {
    return true;
  }

  return pi === pathSegments.length && pti === patternSegments.length;
}

/**
 * Check if a path is a child of another path
 */
export function isChildPath(parent: JsonPointer, child: JsonPointer): boolean {
  if (!parent) return true; // Root is parent of all
  return child.startsWith(parent + '/');
}

// ============================================================================
// Lock Evaluation
// ============================================================================

/**
 * Sources that indicate a locked field
 */
const LOCKED_SOURCES: Set<ContextFieldSource | FieldSource> = new Set([
  'User',
  // Note: 'Lab' and 'Imported' require needsReview=false to be locked
]);

/**
 * Determine if a Context field is locked based on its provenance
 */
export function isContextFieldLocked(field: ContextField<unknown> | undefined): boolean {
  if (!field?.meta) return false;

  // User-set fields are always locked
  if (field.meta.source === 'User') {
    return true;
  }

  // Lab/Imported fields are locked if they've been reviewed
  if ((field.meta.source === 'Lab' || field.meta.source === 'Imported') && !field.meta.needsReview) {
    return true;
  }

  return false;
}

/**
 * Determine lock reason from Context field
 */
export function getContextLockReason(field: ContextField<unknown>): LockReason | undefined {
  if (!field?.meta) return undefined;

  if (field.meta.source === 'User') {
    return 'user_confirmed';
  }
  if (field.meta.source === 'Lab' && !field.meta.needsReview) {
    return 'lab_confirmed';
  }
  if (field.meta.source === 'Imported' && !field.meta.needsReview) {
    return 'user_confirmed';
  }

  return undefined;
}

/**
 * Determine if a Strategy field is locked based on its provenance
 */
export function isStrategyFieldLocked(provenance: FieldProvenance | undefined): boolean {
  if (!provenance) return false;
  return provenance.source === 'User';
}

/**
 * Determine lock reason from Strategy provenance
 */
export function getStrategyLockReason(provenance: FieldProvenance): LockReason | undefined {
  if (!provenance) return undefined;
  if (provenance.source === 'User') {
    return 'user_set';
  }
  return undefined;
}

/**
 * Check if a specific path is locked given the evaluation metadata
 */
export function isPathLocked(path: JsonPointer, meta: LockEvaluationMeta): LockStatus {
  // Check system-locked paths first
  if (meta.systemLockedPaths?.some(pattern => pathMatchesPattern(path, pattern))) {
    return {
      path,
      locked: true,
      reason: 'immutable',
    };
  }

  // Check explicit locked paths
  const exactLock = meta.lockedPaths.get(path);
  if (exactLock) {
    return exactLock;
  }

  // Check if any parent path is locked
  for (const [lockedPath, lockStatus] of meta.lockedPaths) {
    if (isChildPath(lockedPath, path) && lockStatus.locked) {
      return {
        path,
        locked: true,
        reason: lockStatus.reason,
        lockedAt: lockStatus.lockedAt,
        lockedBy: lockStatus.lockedBy,
      };
    }
  }

  return { path, locked: false };
}

// ============================================================================
// Lock Extraction from Objects
// ============================================================================

/**
 * Extract locked paths from a Context V2 object
 */
export function extractContextLocks(context: Record<string, unknown>): Map<JsonPointer, LockStatus> {
  const locks = new Map<JsonPointer, LockStatus>();

  // Walk the context object looking for ContextField structures
  function walkObject(obj: unknown, currentPath: string[]): void {
    if (!obj || typeof obj !== 'object') return;

    const record = obj as Record<string, unknown>;

    // Check if this is a ContextField (has value and meta)
    if ('value' in record && 'meta' in record && record.meta && typeof record.meta === 'object') {
      const field = record as unknown as ContextField<unknown>;
      if (isContextFieldLocked(field)) {
        const pointer = buildPointer(currentPath);
        locks.set(pointer, {
          path: pointer,
          locked: true,
          reason: getContextLockReason(field),
          confirmedValue: field.value,
          lockedAt: field.meta.lastUpdated,
        });
      }
      return; // Don't recurse into field value
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(record)) {
      if (key === 'meta' || key === 'value') continue; // Skip ContextField internals
      walkObject(value, [...currentPath, key]);
    }
  }

  walkObject(context, []);
  return locks;
}

/**
 * Extract locked paths from a Strategy V2 object
 */
export function extractStrategyLocks(
  strategy: Record<string, unknown>,
  provenance?: Record<string, FieldProvenance>
): Map<JsonPointer, LockStatus> {
  const locks = new Map<JsonPointer, LockStatus>();

  if (!provenance) return locks;

  // Check each provenance entry
  for (const [fieldKey, fieldProvenance] of Object.entries(provenance)) {
    if (isStrategyFieldLocked(fieldProvenance)) {
      // Convert dot-notation to JSON Pointer
      const pointer = '/' + fieldKey.replace(/\./g, '/');
      const value = getValueAtPointer(strategy, pointer);

      locks.set(pointer, {
        path: pointer,
        locked: true,
        reason: getStrategyLockReason(fieldProvenance),
        confirmedValue: value,
        lockedAt: fieldProvenance.updatedAt,
      });
    }
  }

  return locks;
}

/**
 * Extract locked paths from a Competition object
 * Manual competitors and user notes are locked
 */
export function extractCompetitionLocks(competition: Record<string, unknown>): Map<JsonPointer, LockStatus> {
  const locks = new Map<JsonPointer, LockStatus>();

  // Check for competitors array
  const competitors = competition.competitors;
  if (Array.isArray(competitors)) {
    competitors.forEach((competitor, index) => {
      if (competitor && typeof competitor === 'object') {
        const comp = competitor as Record<string, unknown>;

        // Manual competitors are fully locked
        if (comp.isManual === true) {
          const basePath = `/competitors/${index}`;
          locks.set(basePath, {
            path: basePath,
            locked: true,
            reason: 'manual_entry',
            confirmedValue: competitor,
          });
        }

        // User notes are locked
        if (comp.userNotes) {
          const notesPath = `/competitors/${index}/userNotes`;
          locks.set(notesPath, {
            path: notesPath,
            locked: true,
            reason: 'user_set',
            confirmedValue: comp.userNotes,
          });
        }
      }
    });
  }

  return locks;
}

/**
 * Build LockEvaluationMeta for an entity
 */
export function buildLockMeta(
  entityType: LockEvaluationMeta['entityType'],
  entity: Record<string, unknown>,
  provenance?: Record<string, FieldProvenance>
): LockEvaluationMeta {
  let lockedPaths: Map<JsonPointer, LockStatus>;

  switch (entityType) {
    case 'context':
      lockedPaths = extractContextLocks(entity);
      break;
    case 'strategy':
      lockedPaths = extractStrategyLocks(entity, provenance);
      break;
    case 'competition':
      lockedPaths = extractCompetitionLocks(entity);
      break;
    case 'lab_result':
      // Lab results: user-confirmed results are locked
      lockedPaths = new Map(); // TODO: Implement when lab result structure is defined
      break;
    default:
      lockedPaths = new Map();
  }

  // System-locked paths that should never change
  const systemLockedPaths: JsonPointer[] = [
    '/id',
    '/companyId',
    '/createdAt',
  ];

  return {
    entityType,
    lockedPaths,
    systemLockedPaths,
  };
}
