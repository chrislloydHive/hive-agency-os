// lib/os/writeContract/apply.ts
// Apply patches with lock checking
//
// Applies JSON Patch operations to a base state, skipping locked paths.

import type {
  JsonPointer,
  PatchOperation,
  ApplyResult,
  Proposal,
  LockEvaluationMeta,
} from './types';
import { deepClone } from './diff';
import { parsePointer, isPathLocked } from './locks';
import { generateRevisionId } from './revision';

// ============================================================================
// Patch Application
// ============================================================================

/**
 * Set a value at a JSON Pointer path in an object
 * Creates intermediate objects/arrays as needed
 */
function setValueAtPointer(obj: unknown, pointer: JsonPointer, value: unknown): unknown {
  if (!pointer || pointer === '/') {
    return value;
  }

  const segments = parsePointer(pointer);
  const result = deepClone(obj) || {};
  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    if (!(segment in current) || current[segment] === null || current[segment] === undefined) {
      // Create intermediate structure
      // If next segment is numeric, create array; otherwise create object
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1];
  current[lastSegment] = value;

  return result;
}

/**
 * Remove a value at a JSON Pointer path from an object
 */
function removeValueAtPointer(obj: unknown, pointer: JsonPointer): unknown {
  if (!pointer || pointer === '/') {
    return undefined;
  }

  const segments = parsePointer(pointer);
  const result = deepClone(obj);
  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];

    if (!(segment in current) || current[segment] === null || current[segment] === undefined) {
      // Path doesn't exist, nothing to remove
      return result;
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1];

  if (Array.isArray(current)) {
    const index = parseInt(lastSegment, 10);
    if (!isNaN(index)) {
      current.splice(index, 1);
    }
  } else {
    delete current[lastSegment];
  }

  return result;
}

/**
 * Apply a single patch operation to an object
 */
function applyOperation(obj: unknown, op: PatchOperation): unknown {
  switch (op.op) {
    case 'add':
    case 'replace':
      return setValueAtPointer(obj, op.path, op.value);
    case 'remove':
      return removeValueAtPointer(obj, op.path);
    default:
      throw new Error(`Unknown patch operation: ${(op as PatchOperation).op}`);
  }
}

// ============================================================================
// Proposal Application
// ============================================================================

/**
 * Apply a proposal's patch operations to a base state
 *
 * @param base - The current canonical state
 * @param proposal - The proposal to apply
 * @param options - Application options
 */
export function applyProposal(
  base: unknown,
  proposal: Proposal,
  options: {
    /** Only apply specific paths (for partial acceptance) */
    selectedPaths?: JsonPointer[];
    /** Lock metadata for re-validation */
    meta?: LockEvaluationMeta;
    /** Skip re-validation of locks (trust proposal's conflict detection) */
    trustProposal?: boolean;
  } = {}
): ApplyResult {
  const applied: JsonPointer[] = [];
  const skipped: ApplyResult['skipped'] = [];

  // Determine which operations to apply
  let operationsToApply = proposal.patch;

  if (options.selectedPaths) {
    const selectedSet = new Set(options.selectedPaths);
    operationsToApply = proposal.patch.filter(op => selectedSet.has(op.path));

    // Mark non-selected paths as skipped
    for (const op of proposal.patch) {
      if (!selectedSet.has(op.path)) {
        skipped.push({
          path: op.path,
          reason: 'not_selected',
          message: `Path not selected for application`,
        });
      }
    }
  }

  // Re-validate locks if meta provided and not trusting proposal
  if (options.meta && !options.trustProposal) {
    const validatedOperations: PatchOperation[] = [];

    for (const op of operationsToApply) {
      const lockStatus = isPathLocked(op.path, options.meta);

      if (lockStatus.locked) {
        skipped.push({
          path: op.path,
          reason: 'locked',
          message: `Path is locked: ${lockStatus.reason || 'unknown reason'}`,
        });
      } else {
        validatedOperations.push(op);
      }
    }

    operationsToApply = validatedOperations;
  }

  // Apply operations in order
  let result = base;

  for (const op of operationsToApply) {
    try {
      result = applyOperation(result, op);
      applied.push(op.path);
    } catch (error) {
      skipped.push({
        path: op.path,
        reason: 'validation_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Generate new revision ID
  const newRevisionId = generateRevisionId();

  return {
    success: applied.length > 0 || operationsToApply.length === 0,
    applied,
    skipped,
    newRevisionId,
    updatedState: result,
  };
}

/**
 * Apply arbitrary patch operations to a state (for user-initiated changes)
 *
 * Unlike applyProposal, this applies all operations without proposal context.
 * Used for direct user edits that bypass the proposal flow.
 */
export function applyPatch(
  base: unknown,
  operations: PatchOperation[],
  options: {
    /** Lock metadata - operations affecting locked paths will be skipped */
    meta?: LockEvaluationMeta;
  } = {}
): ApplyResult {
  const applied: JsonPointer[] = [];
  const skipped: ApplyResult['skipped'] = [];

  let operationsToApply = operations;

  // Validate against locks if meta provided
  if (options.meta) {
    const validatedOperations: PatchOperation[] = [];

    for (const op of operations) {
      const lockStatus = isPathLocked(op.path, options.meta);

      if (lockStatus.locked) {
        skipped.push({
          path: op.path,
          reason: 'locked',
          message: `Path is locked: ${lockStatus.reason || 'unknown reason'}`,
        });
      } else {
        validatedOperations.push(op);
      }
    }

    operationsToApply = validatedOperations;
  }

  // Apply operations
  let result = base;

  for (const op of operationsToApply) {
    try {
      result = applyOperation(result, op);
      applied.push(op.path);
    } catch (error) {
      skipped.push({
        path: op.path,
        reason: 'validation_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const newRevisionId = generateRevisionId();

  return {
    success: applied.length > 0 || operationsToApply.length === 0,
    applied,
    skipped,
    newRevisionId,
    updatedState: result,
  };
}

// ============================================================================
// Preview Application (for UI)
// ============================================================================

/**
 * Apply a proposal to base state for preview purposes
 * Returns the resulting state without side effects
 */
export function previewProposal(
  base: unknown,
  proposal: Proposal,
  selectedPaths?: JsonPointer[]
): unknown {
  let operations = proposal.patch;

  if (selectedPaths) {
    const selectedSet = new Set(selectedPaths);
    operations = proposal.patch.filter(op => selectedSet.has(op.path));
  }

  let result = base;

  for (const op of operations) {
    try {
      result = applyOperation(result, op);
    } catch {
      // Ignore errors in preview
    }
  }

  return result;
}

/**
 * Get the value that would result from applying an operation
 */
export function getProposedValue(
  base: unknown,
  operation: PatchOperation
): { before: unknown; after: unknown } {
  const before = operation.oldValue;

  switch (operation.op) {
    case 'add':
    case 'replace':
      return { before, after: operation.value };
    case 'remove':
      return { before, after: undefined };
    default:
      return { before, after: undefined };
  }
}
