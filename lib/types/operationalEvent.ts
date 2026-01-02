// lib/types/operationalEvent.ts
// Operational event types for Program Template System observability
//
// Events track bundle instantiation, work creation, and scope violations
// for audit trail and analytics.

import { z } from 'zod';
import type { ProgramDomain, IntensityLevel } from './programTemplate';
import type { WorkstreamType } from './program';
import type { ScopeViolationCode } from '@/lib/os/programs/scopeGuard';

// ============================================================================
// Event Type Constants
// ============================================================================

export const OPERATIONAL_EVENT_TYPES = {
  BUNDLE_INSTANTIATED: 'bundle_instantiated',
  WORK_CREATED: 'work_created',
  WORK_CREATION_SKIPPED: 'work_creation_skipped',
  SCOPE_VIOLATION: 'scope_violation',
  // Governance change log events
  PROGRAM_INTENSITY_CHANGED: 'program_intensity_changed',
  PROGRAM_STATUS_CHANGED: 'program_status_changed',
  // Recurrence job events
  RECURRENCE_JOB_STARTED: 'recurrence_job_started',
  RECURRENCE_JOB_COMPLETED: 'recurrence_job_completed',
  RECURRENCE_JOB_FAILED: 'recurrence_job_failed',
  // Runbook events
  RUNBOOK_ITEM_COMPLETED: 'runbook_item_completed',
} as const;

export type OperationalEventType =
  typeof OPERATIONAL_EVENT_TYPES[keyof typeof OPERATIONAL_EVENT_TYPES];

// ============================================================================
// Debug ID Generation
// ============================================================================

/**
 * Generate a unique debug ID for tracing events across UI and logs
 * Format: EVT-{timestamp}-{random}
 */
export function generateDebugId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `EVT-${timestamp}-${random}`;
}

// ============================================================================
// Bundle Instantiation Event
// ============================================================================

export const BundleInstantiationEventPayloadSchema = z.object({
  presetId: z.string(),
  presetName: z.string(),
  domains: z.array(z.string() as z.ZodType<ProgramDomain>),
  intensity: z.string() as z.ZodType<IntensityLevel>,
  startDate: z.string(),
  strategyId: z.string(),
  createdPrograms: z.array(
    z.object({
      programId: z.string(),
      title: z.string(),
      domain: z.string() as z.ZodType<ProgramDomain>,
      status: z.enum(['created', 'already_exists', 'failed']),
    })
  ),
  createdDeliverables: z.number(),
  summary: z.object({
    created: z.number(),
    skipped: z.number(),
    failed: z.number(),
  }),
});

export type BundleInstantiationEventPayload = z.infer<
  typeof BundleInstantiationEventPayloadSchema
>;

// ============================================================================
// Work Creation Event
// ============================================================================

export const WorkCreationEventPayloadSchema = z.object({
  workItemId: z.string(),
  title: z.string(),
  workstream: z.string() as z.ZodType<WorkstreamType>,
  programId: z.string().optional(),
  programTitle: z.string().optional(),
  deliverableId: z.string().optional(),
  deliverableTitle: z.string().optional(),
  sourceContext: z
    .enum(['deliverable_conversion', 'manual_creation', 'ai_suggestion', 'adhoc'])
    .optional(),
  status: z.enum(['created', 'already_exists']),
  existingWorkItemId: z.string().optional(),
});

export type WorkCreationEventPayload = z.infer<typeof WorkCreationEventPayloadSchema>;

// ============================================================================
// Scope Violation Event
// ============================================================================

export const ScopeViolationEventPayloadSchema = z.object({
  code: z.string() as z.ZodType<ScopeViolationCode>,
  programId: z.string(),
  programTitle: z.string(),
  domain: z.string().nullable(),
  blockedAction: z.object({
    type: z.enum(['create_work', 'modify_scope', 'change_status']),
    description: z.string(),
  }),
  attemptedWorkstream: z.string().optional(),
  currentCount: z.number().optional(),
  limit: z.number().optional(),
  recommendedActions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['primary', 'secondary', 'link']),
    })
  ),
});

export type ScopeViolationEventPayload = z.infer<typeof ScopeViolationEventPayloadSchema>;

// ============================================================================
// Governance Change Log Events
// ============================================================================

export const ProgramIntensityChangedPayloadSchema = z.object({
  programId: z.string(),
  programTitle: z.string(),
  domain: z.string().nullable(),
  fromIntensity: z.string() as z.ZodType<IntensityLevel>,
  toIntensity: z.string() as z.ZodType<IntensityLevel>,
  reason: z.string().optional(),
  affectsDeliverables: z.boolean(),
  nextDeliverableDate: z.string().optional(),
});

export type ProgramIntensityChangedPayload = z.infer<typeof ProgramIntensityChangedPayloadSchema>;

export const ProgramStatusChangedPayloadSchema = z.object({
  programId: z.string(),
  programTitle: z.string(),
  domain: z.string().nullable(),
  fromStatus: z.string(),
  toStatus: z.string(),
  reason: z.string().optional(),
});

export type ProgramStatusChangedPayload = z.infer<typeof ProgramStatusChangedPayloadSchema>;

// ============================================================================
// Recurrence Job Events
// ============================================================================

export const RecurrenceJobStartedPayloadSchema = z.object({
  jobType: z.enum(['daily', 'on_demand']),
  companiesCount: z.number().optional(),
  triggeredBy: z.string().optional(),
});

export type RecurrenceJobStartedPayload = z.infer<typeof RecurrenceJobStartedPayloadSchema>;

export const RecurrenceJobCompletedPayloadSchema = z.object({
  jobType: z.enum(['daily', 'on_demand']),
  companiesProcessed: z.number(),
  deliverablesCreated: z.number(),
  deliverablesSkipped: z.number(),
  errors: z.number(),
  durationMs: z.number().optional(),
});

export type RecurrenceJobCompletedPayload = z.infer<typeof RecurrenceJobCompletedPayloadSchema>;

export const RecurrenceJobFailedPayloadSchema = z.object({
  jobType: z.enum(['daily', 'on_demand']),
  error: z.string(),
  companiesProcessed: z.number().optional(),
});

export type RecurrenceJobFailedPayload = z.infer<typeof RecurrenceJobFailedPayloadSchema>;

// ============================================================================
// Runbook Events
// ============================================================================

export const RunbookItemCompletedPayloadSchema = z.object({
  itemId: z.string(),
  itemTitle: z.string(),
  domain: z.string(),
  weekKey: z.string(),
  status: z.enum(['completed', 'skipped']),
  notes: z.string().optional(),
});

export type RunbookItemCompletedPayload = z.infer<typeof RunbookItemCompletedPayloadSchema>;

// ============================================================================
// Unified Operational Event
// ============================================================================

export interface OperationalEvent<T = unknown> {
  id: string;
  debugId: string;
  type: OperationalEventType;
  companyId: string;
  actorId?: string;
  timestamp: string;
  payload: T;
}

export type BundleInstantiationEvent = OperationalEvent<BundleInstantiationEventPayload>;
export type WorkCreationEvent = OperationalEvent<WorkCreationEventPayload>;
export type ScopeViolationEvent = OperationalEvent<ScopeViolationEventPayload>;

// ============================================================================
// Event Creation Input Types
// ============================================================================

export interface CreateOperationalEventInput<T> {
  type: OperationalEventType;
  companyId: string;
  actorId?: string;
  payload: T;
}

// ============================================================================
// Event Query Types
// ============================================================================

export interface OperationalEventQuery {
  companyId: string;
  types?: OperationalEventType[];
  since?: string;
  until?: string;
  limit?: number;
}

export interface OperationalEventStats {
  type: OperationalEventType;
  count: number;
}

export interface ScopeViolationAggregate {
  code: ScopeViolationCode;
  count: number;
  programIds: string[];
  domains: string[];
  topRecommendedActions: Array<{ id: string; count: number }>;
}
