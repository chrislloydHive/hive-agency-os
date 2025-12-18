// lib/observability/flowEvents.ts
// Flow system observability - structured event logging for flow blocks and operations
//
// This module provides structured logging for the flow system:
// - Domain authority blocks
// - Human confirmation locks
// - Flow readiness gates
// - Lab import operations

import { logHiveEvent, logHiveEventImmediate } from '@/lib/telemetry/events';

// ============================================================================
// Flow Event Types
// ============================================================================

export const FLOW_EVENT_TYPES = {
  // Flow readiness events
  FLOW_BLOCKED_MISSING_DOMAINS: 'flow_blocked_missing_domains',
  FLOW_PROCEEDED_MISSING_DOMAINS: 'flow_proceeded_missing_domains',

  // Write block events
  WRITE_BLOCKED_AUTHORITY: 'write_blocked_authority',
  WRITE_BLOCKED_HUMAN_CONFIRMED: 'write_blocked_human_confirmed',
  WRITE_FORCED_OVERRIDE: 'write_forced_override',

  // Lab import events
  LAB_IMPORT_COMPLETED: 'lab_import_completed',
  LAB_IMPORT_FAILED: 'lab_import_failed',
} as const;

export type FlowEventType = typeof FLOW_EVENT_TYPES[keyof typeof FLOW_EVENT_TYPES];

// ============================================================================
// Flow Event Payload
// ============================================================================

export interface FlowEventPayload {
  /** Company ID the event relates to */
  companyId: string;
  /** Actor triggering the event */
  actor?: 'user' | 'ai' | 'system';
  /** Flow type if applicable */
  flowType?: 'strategy' | 'gap_ia' | 'gap_full' | 'programs' | 'website_optimization';
  /** Missing domains that blocked/were skipped */
  missingDomains?: string[];
  /** Missing lab keys that could fill domains */
  missingLabs?: string[];
  /** Domain attempted to write to */
  attemptedDomain?: string;
  /** Field path attempted (e.g., 'brand.positioning') */
  attemptedFieldPath?: string;
  /** Source that attempted the operation */
  source?: string;
  /** Reason for block/action */
  reason?: string;
  /** Lab key for import events */
  labKey?: string;
  /** Number of fields updated (for imports) */
  fieldsUpdated?: number;
  /** Error message if applicable */
  error?: string;
  /** Timestamp (auto-filled if not provided) */
  ts?: string;
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log a flow event (buffered)
 * Use for non-critical events like successful operations
 */
export function logFlowEvent(
  type: FlowEventType,
  payload: FlowEventPayload
): void {
  const metadata: Record<string, unknown> = {
    ...payload,
    flowEventType: type,
    ts: payload.ts || new Date().toISOString(),
  };

  // Remove undefined values
  Object.keys(metadata).forEach((key) => {
    if (metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  logHiveEvent({
    type: type as any, // Flow events are added to HiveEventType
    companyId: payload.companyId,
    metadata,
  });
}

/**
 * Log a flow event immediately (bypass buffer)
 * Use for critical events like blocks and failures
 */
export async function logFlowEventImmediate(
  type: FlowEventType,
  payload: FlowEventPayload
): Promise<void> {
  const metadata: Record<string, unknown> = {
    ...payload,
    flowEventType: type,
    ts: payload.ts || new Date().toISOString(),
  };

  // Remove undefined values
  Object.keys(metadata).forEach((key) => {
    if (metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  await logHiveEventImmediate({
    type: type as any,
    companyId: payload.companyId,
    metadata,
  });
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Log when a flow is blocked due to missing domains
 */
export function logFlowBlockedMissingDomains(
  companyId: string,
  flowType: FlowEventPayload['flowType'],
  missingDomains: string[],
  missingLabs: string[]
): Promise<void> {
  return logFlowEventImmediate(FLOW_EVENT_TYPES.FLOW_BLOCKED_MISSING_DOMAINS, {
    companyId,
    flowType,
    missingDomains,
    missingLabs,
    actor: 'system',
    reason: `Flow '${flowType}' blocked: missing critical domains`,
  });
}

/**
 * Log when user proceeds despite missing domains
 */
export function logFlowProceededMissingDomains(
  companyId: string,
  flowType: FlowEventPayload['flowType'],
  missingDomains: string[],
  reason?: string
): void {
  logFlowEvent(FLOW_EVENT_TYPES.FLOW_PROCEEDED_MISSING_DOMAINS, {
    companyId,
    flowType,
    missingDomains,
    actor: 'user',
    reason: reason || 'User acknowledged and proceeded',
  });
}

/**
 * Log when a write is blocked by domain authority
 */
export function logWriteBlockedAuthority(
  companyId: string,
  domain: string,
  field: string,
  source: string,
  allowedSources: string[]
): void {
  logFlowEvent(FLOW_EVENT_TYPES.WRITE_BLOCKED_AUTHORITY, {
    companyId,
    attemptedDomain: domain,
    attemptedFieldPath: `${domain}.${field}`,
    source,
    actor: 'ai',
    reason: `Source '${source}' not authorized for domain '${domain}'. Allowed: ${allowedSources.join(', ')}`,
  });
}

/**
 * Log when a write is blocked by humanConfirmed lock
 */
export function logWriteBlockedHumanConfirmed(
  companyId: string,
  domain: string,
  field: string,
  source: string
): void {
  logFlowEvent(FLOW_EVENT_TYPES.WRITE_BLOCKED_HUMAN_CONFIRMED, {
    companyId,
    attemptedDomain: domain,
    attemptedFieldPath: `${domain}.${field}`,
    source,
    actor: 'ai',
    reason: `Field '${domain}.${field}' is human-confirmed and cannot be overwritten by '${source}'`,
  });
}

/**
 * Log when a forced override is performed
 */
export function logWriteForcedOverride(
  companyId: string,
  domain: string,
  field: string,
  source: string,
  reason: string
): void {
  logFlowEvent(FLOW_EVENT_TYPES.WRITE_FORCED_OVERRIDE, {
    companyId,
    attemptedDomain: domain,
    attemptedFieldPath: `${domain}.${field}`,
    source,
    actor: 'user',
    reason,
  });
}

/**
 * Log when a lab import completes successfully
 */
export function logLabImportCompleted(
  companyId: string,
  labKey: string,
  fieldsUpdated: number
): void {
  logFlowEvent(FLOW_EVENT_TYPES.LAB_IMPORT_COMPLETED, {
    companyId,
    labKey,
    fieldsUpdated,
    actor: 'system',
    reason: `Lab '${labKey}' imported ${fieldsUpdated} fields`,
  });
}

/**
 * Log when a lab import fails
 */
export function logLabImportFailed(
  companyId: string,
  labKey: string,
  error: string
): Promise<void> {
  return logFlowEventImmediate(FLOW_EVENT_TYPES.LAB_IMPORT_FAILED, {
    companyId,
    labKey,
    error,
    actor: 'system',
    reason: `Lab '${labKey}' import failed: ${error}`,
  });
}

// ============================================================================
// Event Querying (for debug panel)
// ============================================================================

/**
 * Flow event filter for querying Hive Events table
 */
export const FLOW_EVENT_TYPE_VALUES = Object.values(FLOW_EVENT_TYPES);

/**
 * Check if an event type is a flow event
 */
export function isFlowEventType(type: string): type is FlowEventType {
  return FLOW_EVENT_TYPE_VALUES.includes(type as FlowEventType);
}
