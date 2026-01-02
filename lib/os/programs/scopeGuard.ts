// lib/os/programs/scopeGuard.ts
// Scope Guardrails for Program-enforced Work Items
//
// Ensures work items stay within the scope defined by their Program template.
// - Validates workstream type is allowed
// - Enforces concurrent work limits
// - Provides escalation paths when scope is exceeded
//
// These guardrails are ONLY enforced for programs with scopeEnforced: true
// (typically bundle-instantiated programs).

import type { ScopeCheckResult } from '@/lib/types/programTemplate';
import type { PlanningProgram, WorkstreamType } from '@/lib/types/program';
import { WORKSTREAM_LABELS } from '@/lib/types/program';
import { PROGRAM_DOMAIN_LABELS } from '@/lib/types/programTemplate';

// ============================================================================
// Scope Check Functions
// ============================================================================

/**
 * Check if a work item's workstream type is allowed for the program
 *
 * Returns allowed: true if:
 * - Program doesn't have scope enforcement enabled
 * - Program doesn't have allowedWorkTypes defined
 * - Workstream type is in the allowed list
 */
export function checkWorkstreamScope(
  program: PlanningProgram,
  proposedWorkstream: WorkstreamType
): ScopeCheckResult {
  // Skip check if scope enforcement is disabled
  if (!program.scopeEnforced) {
    return { allowed: true, escalationRequired: false };
  }

  // Skip check if no allowed work types defined
  if (!program.allowedWorkTypes || program.allowedWorkTypes.length === 0) {
    return { allowed: true, escalationRequired: false };
  }

  // Check if workstream is allowed
  const isAllowed = program.allowedWorkTypes.includes(proposedWorkstream);

  if (isAllowed) {
    return { allowed: true, escalationRequired: false };
  }

  const workstreamLabel = WORKSTREAM_LABELS[proposedWorkstream] || proposedWorkstream;
  const domainLabel = program.domain ? PROGRAM_DOMAIN_LABELS[program.domain] : 'this program';
  const allowedLabels = program.allowedWorkTypes
    .map((ws) => WORKSTREAM_LABELS[ws] || ws)
    .join(', ');

  return {
    allowed: false,
    reason: `"${workstreamLabel}" is not within scope for ${domainLabel}. Allowed workstreams: ${allowedLabels}.`,
    escalationRequired: true,
  };
}

/**
 * Check if the program has reached its concurrent work limit
 *
 * Returns allowed: true if:
 * - Program doesn't have scope enforcement enabled
 * - Program doesn't have maxConcurrentWork defined
 * - Current work count is below the limit
 */
export function checkConcurrencyLimit(
  program: PlanningProgram,
  currentActiveWorkCount: number
): ScopeCheckResult {
  // Skip check if scope enforcement is disabled
  if (!program.scopeEnforced) {
    return { allowed: true, escalationRequired: false };
  }

  // Skip check if no limit defined
  if (program.maxConcurrentWork === undefined) {
    return { allowed: true, escalationRequired: false };
  }

  // Check if under limit
  if (currentActiveWorkCount < program.maxConcurrentWork) {
    return { allowed: true, escalationRequired: false };
  }

  const domainLabel = program.domain ? PROGRAM_DOMAIN_LABELS[program.domain] : 'This program';

  return {
    allowed: false,
    reason: `${domainLabel} has reached its concurrent work limit of ${program.maxConcurrentWork}. Complete or archive existing work before adding more.`,
    escalationRequired: true,
  };
}

/**
 * Validate that a work item can be created for a program
 *
 * Combines workstream and concurrency checks into a single validation.
 */
export function validateWorkItemForProgram(
  program: PlanningProgram,
  proposedWorkstream: WorkstreamType,
  currentActiveWorkCount: number
): ScopeCheckResult {
  // Check workstream scope first
  const workstreamCheck = checkWorkstreamScope(program, proposedWorkstream);
  if (!workstreamCheck.allowed) {
    return workstreamCheck;
  }

  // Then check concurrency
  const concurrencyCheck = checkConcurrencyLimit(program, currentActiveWorkCount);
  if (!concurrencyCheck.allowed) {
    return concurrencyCheck;
  }

  return { allowed: true, escalationRequired: false };
}

/**
 * Check if work requires a program (for programs that enforce this)
 *
 * This is used to ensure all work is traceable to a program.
 */
export function validateWorkHasProgram(
  programId: string | undefined | null,
  requireProgram: boolean = false
): ScopeCheckResult {
  if (!requireProgram) {
    return { allowed: true, escalationRequired: false };
  }

  if (!programId) {
    return {
      allowed: false,
      reason: 'Work items must be associated with a program. Select or create a program first.',
      escalationRequired: false,
    };
  }

  return { allowed: true, escalationRequired: false };
}

// ============================================================================
// Escalation Helpers
// ============================================================================

/**
 * Build a scope escalation message for out-of-scope work requests
 */
export function buildScopeEscalationMessage(
  program: PlanningProgram,
  requestedWorkstream: WorkstreamType,
  reason: string
): string {
  const lines: string[] = [];

  lines.push('## Scope Escalation Required');
  lines.push('');
  lines.push(`**Program:** ${program.title}`);
  if (program.domain) {
    lines.push(`**Domain:** ${PROGRAM_DOMAIN_LABELS[program.domain]}`);
  }
  if (program.intensity) {
    lines.push(`**Intensity:** ${program.intensity}`);
  }
  lines.push('');
  lines.push('### Issue');
  lines.push(reason);
  lines.push('');
  lines.push('### Options');
  lines.push('1. **Request scope expansion** - Contact the account manager to discuss adding this workstream to the engagement.');
  lines.push('2. **Use a different workstream** - Find an equivalent approach using an allowed workstream.');
  lines.push('3. **Create ad-hoc work** - Create work outside of this program (will not be scope-enforced).');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build a concurrency escalation message
 */
export function buildConcurrencyEscalationMessage(
  program: PlanningProgram,
  currentCount: number,
  maxCount: number
): string {
  const lines: string[] = [];

  lines.push('## Concurrent Work Limit Reached');
  lines.push('');
  lines.push(`**Program:** ${program.title}`);
  lines.push(`**Current Active Work:** ${currentCount}`);
  lines.push(`**Maximum Allowed:** ${maxCount}`);
  lines.push('');
  lines.push('### Resolution');
  lines.push('Before adding new work, please:');
  lines.push('1. Complete in-progress work items');
  lines.push('2. Archive or cancel blocked work items');
  lines.push('3. Request a capacity increase from the account manager');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Enhanced Scope Violation Response (for UX)
// ============================================================================

export type ScopeViolationCode =
  | 'WORKSTREAM_NOT_ALLOWED'
  | 'CONCURRENCY_LIMIT_REACHED'
  | 'PROGRAM_REQUIRED'
  | 'PROGRAM_ARCHIVED';

export interface RecommendedAction {
  id: string;
  label: string;
  description: string;
  /** Action type for UI handling */
  type: 'primary' | 'secondary' | 'link';
  /** Optional URL for link-type actions */
  href?: string;
}

/**
 * Enhanced scope violation response for rich UX rendering
 */
export interface ScopeViolationResponse {
  /** Machine-readable error code */
  code: ScopeViolationCode;
  /** Human-readable summary message */
  message: string;
  /** What action was blocked */
  blockedAction: {
    type: 'create_work' | 'modify_scope' | 'change_status';
    description: string;
  };
  /** Context about the scope constraints */
  context: {
    programId: string;
    programTitle: string;
    domain: string | null;
    intensity: string | null;
    /** Workstreams allowed for this program */
    allowedWorkstreams: WorkstreamType[];
    /** Human-readable workstream labels */
    allowedWorkstreamLabels: string[];
    /** Current active work count */
    currentCount?: number;
    /** Maximum concurrent work limit */
    limit?: number;
  };
  /** Suggested actions to resolve the violation */
  recommendedActions: RecommendedAction[];
  /** Full escalation message (markdown) for detailed view */
  escalationMarkdown: string;
}

/**
 * Build a scope violation response for workstream violations
 */
export function buildWorkstreamViolationResponse(
  program: PlanningProgram,
  attemptedWorkstream: WorkstreamType,
  reason: string
): ScopeViolationResponse {
  const workstreamLabel = WORKSTREAM_LABELS[attemptedWorkstream] || attemptedWorkstream;
  const allowedWorkstreams = program.allowedWorkTypes || [];
  const allowedLabels = allowedWorkstreams.map((ws) => WORKSTREAM_LABELS[ws] || ws);

  return {
    code: 'WORKSTREAM_NOT_ALLOWED',
    message: `Cannot create ${workstreamLabel} work in this program. Only ${allowedLabels.join(', ')} work is allowed.`,
    blockedAction: {
      type: 'create_work',
      description: `Create ${workstreamLabel} work item`,
    },
    context: {
      programId: program.id,
      programTitle: program.title,
      domain: program.domain ? PROGRAM_DOMAIN_LABELS[program.domain] : null,
      intensity: program.intensity || null,
      allowedWorkstreams,
      allowedWorkstreamLabels: allowedLabels,
    },
    recommendedActions: [
      {
        id: 'use_allowed_workstream',
        label: 'Use allowed workstream',
        description: `Create work using ${allowedLabels[0] || 'an allowed workstream'} instead`,
        type: 'primary',
      },
      {
        id: 'create_adhoc',
        label: 'Create ad-hoc work',
        description: 'Create work outside of this program (not scope-enforced)',
        type: 'secondary',
      },
      {
        id: 'request_expansion',
        label: 'Request scope expansion',
        description: 'Contact account manager to add this workstream to the engagement',
        type: 'link',
      },
    ],
    escalationMarkdown: buildScopeEscalationMessage(program, attemptedWorkstream, reason),
  };
}

/**
 * Build a scope violation response for concurrency limit violations
 */
export function buildConcurrencyViolationResponse(
  program: PlanningProgram,
  currentCount: number
): ScopeViolationResponse {
  const maxCount = program.maxConcurrentWork || 0;
  const allowedWorkstreams = program.allowedWorkTypes || [];
  const allowedLabels = allowedWorkstreams.map((ws) => WORKSTREAM_LABELS[ws] || ws);

  return {
    code: 'CONCURRENCY_LIMIT_REACHED',
    message: `This program has ${currentCount} active work items, reaching its limit of ${maxCount}. Complete existing work before adding more.`,
    blockedAction: {
      type: 'create_work',
      description: 'Create new work item',
    },
    context: {
      programId: program.id,
      programTitle: program.title,
      domain: program.domain ? PROGRAM_DOMAIN_LABELS[program.domain] : null,
      intensity: program.intensity || null,
      allowedWorkstreams,
      allowedWorkstreamLabels: allowedLabels,
      currentCount,
      limit: maxCount,
    },
    recommendedActions: [
      {
        id: 'view_active_work',
        label: 'View active work',
        description: 'See what work is currently in progress for this program',
        type: 'primary',
      },
      {
        id: 'complete_work',
        label: 'Complete existing work',
        description: 'Mark in-progress items as done to free up capacity',
        type: 'secondary',
      },
      {
        id: 'archive_blocked',
        label: 'Archive blocked items',
        description: 'Archive or cancel work items that are blocked',
        type: 'secondary',
      },
      {
        id: 'request_capacity',
        label: 'Request capacity increase',
        description: 'Contact account manager to increase concurrent work limit',
        type: 'link',
      },
    ],
    escalationMarkdown: buildConcurrencyEscalationMessage(program, currentCount, maxCount),
  };
}

// ============================================================================
// Scope Check for API Use
// ============================================================================

export interface ScopeCheckInput {
  program: PlanningProgram;
  proposedWorkstream?: WorkstreamType;
  currentActiveWorkCount?: number;
}

export interface ScopeCheckOutput {
  allowed: boolean;
  checks: {
    workstream?: ScopeCheckResult;
    concurrency?: ScopeCheckResult;
  };
  escalationMessage?: string;
  /** Enhanced violation response for UX rendering */
  violation?: ScopeViolationResponse;
}

/**
 * Comprehensive scope check for API endpoints
 *
 * Use this in work item creation APIs to validate scope.
 */
export function performScopeCheck(input: ScopeCheckInput): ScopeCheckOutput {
  const { program, proposedWorkstream, currentActiveWorkCount } = input;
  const checks: ScopeCheckOutput['checks'] = {};

  // Check workstream if provided
  if (proposedWorkstream) {
    checks.workstream = checkWorkstreamScope(program, proposedWorkstream);
  }

  // Check concurrency if count provided
  if (currentActiveWorkCount !== undefined) {
    checks.concurrency = checkConcurrencyLimit(program, currentActiveWorkCount);
  }

  // Determine if allowed
  const workstreamAllowed = checks.workstream?.allowed ?? true;
  const concurrencyAllowed = checks.concurrency?.allowed ?? true;
  const allowed = workstreamAllowed && concurrencyAllowed;

  // Build escalation message and violation response if needed
  let escalationMessage: string | undefined;
  let violation: ScopeViolationResponse | undefined;

  if (!allowed) {
    if (!workstreamAllowed && proposedWorkstream) {
      const reason = checks.workstream?.reason || 'Workstream not allowed';
      escalationMessage = buildScopeEscalationMessage(program, proposedWorkstream, reason);
      violation = buildWorkstreamViolationResponse(program, proposedWorkstream, reason);
    } else if (!concurrencyAllowed && currentActiveWorkCount !== undefined) {
      escalationMessage = buildConcurrencyEscalationMessage(
        program,
        currentActiveWorkCount,
        program.maxConcurrentWork || 0
      );
      violation = buildConcurrencyViolationResponse(program, currentActiveWorkCount);
    }
  }

  return {
    allowed,
    checks,
    escalationMessage,
    violation,
  };
}

// ============================================================================
// Scope Summary for UI
// ============================================================================

/**
 * Get scope summary for displaying in UI
 */
export function getScopeSummary(program: PlanningProgram): {
  enforced: boolean;
  allowedWorkstreams: string[];
  maxConcurrentWork: number | null;
  domain: string | null;
  intensity: string | null;
} {
  return {
    enforced: program.scopeEnforced,
    allowedWorkstreams: (program.allowedWorkTypes || []).map(
      (ws) => WORKSTREAM_LABELS[ws] || ws
    ),
    maxConcurrentWork: program.maxConcurrentWork ?? null,
    domain: program.domain ? PROGRAM_DOMAIN_LABELS[program.domain] : null,
    intensity: program.intensity || null,
  };
}
