// lib/os/writeContract/types.ts
// Core types for the Write Contract system
//
// This system ensures AI cannot overwrite user-confirmed data.
// All AI outputs become Proposals that require explicit user acceptance.

// ============================================================================
// JSON Patch Types (RFC 6902)
// ============================================================================

/**
 * JSON Pointer path (RFC 6901)
 * Examples: "/companyReality/businessModel/value", "/strategyPillars/0/decision"
 */
export type JsonPointer = string;

/**
 * JSON Patch operation types (RFC 6902)
 */
export type PatchOpType = 'add' | 'remove' | 'replace';

/**
 * A single JSON Patch operation
 */
export interface PatchOperation {
  op: PatchOpType;
  path: JsonPointer;
  value?: unknown;
  /** For 'remove' operations, store the old value for UI display */
  oldValue?: unknown;
}

// ============================================================================
// Lock Types
// ============================================================================

/**
 * Why a field is locked
 */
export type LockReason =
  | 'user_confirmed'   // User explicitly confirmed this value
  | 'user_set'         // User directly set this value
  | 'manual_entry'     // Manually entered data (e.g., manual competitor)
  | 'lab_confirmed'    // Lab result that user reviewed and accepted
  | 'immutable';       // System-level immutable field (e.g., IDs)

/**
 * Lock status for a specific path
 */
export interface LockStatus {
  path: JsonPointer;
  locked: boolean;
  reason?: LockReason;
  /** The confirmed value that cannot be changed */
  confirmedValue?: unknown;
  /** When the lock was established */
  lockedAt?: string;
  /** Who established the lock */
  lockedBy?: string;
}

/**
 * Metadata used to evaluate locks
 * This is extracted from the base object's provenance data
 */
export interface LockEvaluationMeta {
  /** Type of entity being evaluated */
  entityType: 'context' | 'strategy' | 'competition' | 'lab_result';
  /** Map of path patterns to lock reasons (pre-computed from provenance) */
  lockedPaths: Map<JsonPointer, LockStatus>;
  /** Fields that are always locked regardless of provenance */
  systemLockedPaths?: JsonPointer[];
}

// ============================================================================
// Proposal Types
// ============================================================================

/**
 * A conflict where AI tried to change a locked field
 */
export interface ProposalConflict {
  path: JsonPointer;
  operation: PatchOperation;
  lockStatus: LockStatus;
  /** Human-readable explanation */
  message: string;
}

/**
 * Summary of what a proposal would change
 */
export interface ProposalSummary {
  totalChanges: number;
  applicableChanges: number;
  conflicts: number;
  /** Grouped by top-level section for UI */
  sectionBreakdown: Record<string, {
    adds: number;
    removes: number;
    replaces: number;
    conflicts: number;
  }>;
}

/**
 * A proposal representing AI-suggested changes
 * This is the core output of computeProposalForAI
 */
export interface Proposal {
  id: string;
  /** Company this proposal is for */
  companyId: string;
  /** What type of entity this proposal modifies */
  entityType: 'context' | 'strategy' | 'competition' | 'lab_result';
  /** ID of the entity being modified (or 'new' for creation) */
  entityId: string;

  // The patch content
  /** All operations that CAN be applied (no lock conflicts) */
  patch: PatchOperation[];
  /** Operations that conflict with locked fields */
  conflicts: ProposalConflict[];

  // Summary for UI
  summary: ProposalSummary;

  // Revision tracking
  /** Revision ID of the base state when proposal was created */
  baseRevisionId: string;

  // Lifecycle
  status: 'pending' | 'accepted' | 'partially_accepted' | 'rejected' | 'expired' | 'superseded';
  createdAt: string;
  createdBy: string;  // 'ai:strategy-gen', 'ai:context-sync', etc.
  expiresAt: string;

  // Review tracking
  reviewedAt?: string;
  reviewedBy?: string;
  /** Which paths were accepted (for partial acceptance) */
  acceptedPaths?: JsonPointer[];
  /** Which paths were rejected (for partial acceptance) */
  rejectedPaths?: JsonPointer[];
}

// ============================================================================
// Apply Result Types
// ============================================================================

/**
 * Result of applying a proposal
 */
export interface ApplyResult {
  success: boolean;
  /** Paths that were successfully applied */
  applied: JsonPointer[];
  /** Paths that were skipped (conflicts or not selected) */
  skipped: Array<{
    path: JsonPointer;
    reason: 'locked' | 'not_selected' | 'validation_failed';
    message: string;
  }>;
  /** The new revision ID after applying */
  newRevisionId: string;
  /** The updated state (if successful) */
  updatedState?: unknown;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Violation types for WriteContractViolation
 */
export type ViolationType = 'LOCKED_FIELD' | 'STALE_REVISION' | 'SCHEMA' | 'INVALID_OPERATION';

/**
 * A single conflict in a violation
 */
export interface ViolationConflict {
  path: JsonPointer;
  type: ViolationType;
  message: string;
  currentValue?: unknown;
  attemptedValue?: unknown;
  lockReason?: LockReason;
}

/**
 * Machine-readable error for write contract violations
 */
export class WriteContractViolation extends Error {
  readonly type: ViolationType;
  readonly conflicts: ViolationConflict[];
  readonly baseRevisionId?: string;
  readonly currentRevisionId?: string;

  constructor(
    type: ViolationType,
    conflicts: ViolationConflict[],
    options?: {
      baseRevisionId?: string;
      currentRevisionId?: string;
    }
  ) {
    const message = `Write contract violation: ${type}. ${conflicts.length} conflict(s).`;
    super(message);
    this.name = 'WriteContractViolation';
    this.type = type;
    this.conflicts = conflicts;
    this.baseRevisionId = options?.baseRevisionId;
    this.currentRevisionId = options?.currentRevisionId;
  }

  toJSON() {
    return {
      type: this.type,
      conflicts: this.conflicts,
      baseRevisionId: this.baseRevisionId,
      currentRevisionId: this.currentRevisionId,
    };
  }
}

// ============================================================================
// Input Types for Main API
// ============================================================================

/**
 * Input for computing a proposal from AI output
 */
export interface ComputeProposalInput {
  /** The current canonical state */
  base: unknown;
  /** The AI-generated candidate state */
  candidate: unknown;
  /** Lock evaluation metadata (provenance info) */
  meta: LockEvaluationMeta;
  /** Current revision ID for optimistic concurrency */
  baseRevisionId: string;
  /** Who is creating this proposal */
  createdBy: string;
  /** Company ID */
  companyId: string;
  /** Entity ID (or 'new') */
  entityId: string;
}

/**
 * Input for applying a user-accepted proposal
 */
export interface ApplyProposalInput {
  /** The current canonical state */
  base: unknown;
  /** The proposal to apply */
  proposal: Proposal;
  /** Optional: only apply specific paths */
  selectedPaths?: JsonPointer[];
  /** Current revision ID (must match proposal's baseRevisionId) */
  currentRevisionId: string;
  /** Who is applying this proposal */
  appliedBy: string;
}
