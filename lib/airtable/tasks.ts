/**
 * Tasks - Airtable helper
 *
 * Manages the Tasks table for Hive team task tracking.
 * Supports inbox triage, brain dump, projects, and archive views.
 */

import { z } from 'zod';
import { fetchWithRetry } from './client';
import { resolveTasksBaseId } from './bases';
import { logEventAsync, summarizeTaskUpdate, type ActivityAction } from './activityLog';

// ============================================================================
// Constants
// ============================================================================

/**
 * Long-text JSON column for AI suggested resolution (POST /api/os/auto-resolve, thread refresh).
 * Override if the Airtable column name differs: AIRTABLE_TASKS_FIELD_SUGGESTED_RESOLUTION.
 */
export const suggestedResolutionJsonFieldName =
  process.env.AIRTABLE_TASKS_FIELD_SUGGESTED_RESOLUTION?.trim() || 'Suggested Resolution';

/**
 * Table name or table ID (tbl...) for the Tasks table.
 * Table IDs are base-specific — a hardcoded tbl from another base causes 403.
 * Set AIRTABLE_TASKS_TABLE_ID to your table id, or AIRTABLE_TASKS_TABLE to an exact name.
 * Default: "Tasks"
 */
function getTasksTableIdentifier(): string {
  return (
    process.env.AIRTABLE_TASKS_TABLE_ID?.trim() ||
    process.env.AIRTABLE_TASKS_TABLE?.trim() ||
    'Tasks'
  );
}

function tasksBaseIdOrThrow(): string {
  const id = resolveTasksBaseId();
  if (!id) {
    throw new Error(
      'Airtable base not configured for Tasks. Set AIRTABLE_OS_BASE_ID or AIRTABLE_BASE_ID, or AIRTABLE_TASKS_BASE_ID if Tasks live in another base.',
    );
  }
  return id;
}

/**
 * Tasks table field names (matching Airtable schema exactly)
 */
const TASK_FIELDS = {
  TASK: 'Task',
  PRIORITY: 'Priority',
  DUE: 'Due',
  FROM: 'From',
  PROJECT: 'Project',
  NEXT_ACTION: 'Next Action',
  STATUS: 'Status',
  VIEW: 'View',
  THREAD_URL: 'Thread URL',
  DRAFT_URL: 'Draft URL',
  ATTACHMENT_URL: 'Attachment URL',
  DONE: 'Done',
  NOTES: 'Notes',
  ASSIGNED_TO: 'Assigned To',
  CREATED_AT: 'Created At',
  LAST_MODIFIED: 'Last Modified',
  // Auto-task provenance (populated by /api/os/sync/auto-tasks).
  // Source + SourceRef uniquely identify an auto-created task so the sync can
  // upsert instead of spamming duplicates. DismissedAt is soft-archive state.
  SOURCE: 'Source',
  SOURCE_REF: 'SourceRef',
  AUTO_CREATED: 'AutoCreated',
  DISMISSED_AT: 'DismissedAt',
  // Thread-activity tracking (populated by /api/os/sync/auto-tasks for active
  // email-tied tasks). LAST_SEEN_AT is what the user has acknowledged;
  // LATEST_INBOUND_AT is updated when a newer non-self / non-auto inbound
  // message lands in the thread. UI shows a "new reply" pill when the latter
  // is later than the former.
  LAST_SEEN_AT: 'Last Seen At',
  LATEST_INBOUND_AT: 'Latest Inbound At',
  /** Single select: daily | weekdays | weekly | biweekly | monthly (lowercase). */
  RECURRENCE: 'Recurrence',
  /** Long text: JSON {@link SuggestedResolution} from auto-resolve; cleared via PATCH null. */
  SUGGESTED_RESOLUTION: suggestedResolutionJsonFieldName,
  /** Google Calendar event web URL (htmlLink) for meeting-style tasks. */
  CALENDAR_EVENT_URL: 'CalendarEventUrl',
  /** ISO datetime: last Gmail thread refresh / auto-resolve sync for this task. */
  LAST_SYNCED_AT:
    process.env.AIRTABLE_TASKS_FIELD_LAST_SYNCED_AT?.trim() || 'Last Synced At',
  /** Gmail message id of the latest thread message when we last evaluated (skip if unchanged). */
  THREAD_REFRESH_MESSAGE_ID:
    process.env.AIRTABLE_TASKS_FIELD_THREAD_REFRESH_MESSAGE_ID?.trim() ||
    'Thread Refresh Message Id',
} as const;

/** Allowed `recurrence` values for OS APIs and Airtable single-select. */
export const TASK_RECURRENCE_VALUES = [
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCE_VALUES)[number];

const TASK_RECURRENCE_SET = new Set<string>(TASK_RECURRENCE_VALUES);

// --- Suggested resolution (long-text JSON on Tasks) -------------------------------------------

export type SuggestedResolutionAction = 'close' | 'update_nextAction' | 'leave' | 'update_full';
export type SuggestedResolutionConfidence = 'high' | 'medium' | 'low';

const suggestedResolutionCloseSchema = z
  .object({
    action: z.literal('close'),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']),
    suggestedAt: z.string().min(1),
  })
  .strict();

const suggestedResolutionLeaveSchema = z
  .object({
    action: z.literal('leave'),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']),
    suggestedAt: z.string().min(1),
  })
  .strict();

const suggestedResolutionUpdateNextSchema = z
  .object({
    action: z.literal('update_nextAction'),
    newNextAction: z.string().min(1),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']),
    suggestedAt: z.string().min(1),
  })
  .strict();

const suggestedResolutionUpdateFullSchema = z
  .object({
    action: z.literal('update_full'),
    proposal: z.record(z.string(), z.unknown()),
    fields: z.array(z.string().min(1)).min(1),
    changeSummary: z.string().min(1),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']),
    suggestedAt: z.string().min(1),
  })
  .strict();

/** Stored in Airtable "Suggested Resolution" and returned on GET /tasks. */
export type SuggestedResolution =
  | z.infer<typeof suggestedResolutionCloseSchema>
  | z.infer<typeof suggestedResolutionLeaveSchema>
  | z.infer<typeof suggestedResolutionUpdateNextSchema>
  | z.infer<typeof suggestedResolutionUpdateFullSchema>;

export const suggestedResolutionStoredSchema = z.discriminatedUnion('action', [
  suggestedResolutionCloseSchema,
  suggestedResolutionLeaveSchema,
  suggestedResolutionUpdateNextSchema,
  suggestedResolutionUpdateFullSchema,
]);

/** Read Airtable cell → typed object or null if empty / invalid JSON / schema mismatch. */
export function parseSuggestedResolutionFromAirtable(raw: unknown): SuggestedResolution | null {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const obj = JSON.parse(t) as unknown;
    const r = suggestedResolutionStoredSchema.safeParse(obj);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * Validate PATCH body value for `suggestedResolution`: `null` clears; object must match schema.
 */
export function parseSuggestedResolutionPatchInput(
  v: unknown,
): { ok: true; value: SuggestedResolution | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== 'object' || Array.isArray(v)) {
    return { ok: false, error: 'suggestedResolution must be null or an object' };
  }
  const r = suggestedResolutionStoredSchema.safeParse(v);
  if (!r.success) {
    const flat = r.error.flatten();
    const detail = [...flat.formErrors, ...Object.values(flat.fieldErrors).flat()].filter(Boolean).join('; ');
    return { ok: false, error: detail || 'Invalid suggestedResolution' };
  }
  return { ok: true, value: r.data };
}

/**
 * Parse `recurrence` from a JSON body (PATCH/POST).
 * - Field omitted → present: false (PATCH should not change Airtable).
 * - null or "" → present: true, value: null (clear recurrence).
 * - Otherwise must be one of TASK_RECURRENCE_VALUES (case-sensitive).
 */
export function parseRecurrenceFromRequestBody(body: Record<string, unknown>):
  | { ok: true; present: false }
  | { ok: true; present: true; value: TaskRecurrence | null }
  | { ok: false; error: string } {
  const hasLower = Object.prototype.hasOwnProperty.call(body, 'recurrence');
  const hasPascal = Object.prototype.hasOwnProperty.call(body, 'Recurrence');
  if (!hasLower && !hasPascal) return { ok: true, present: false };
  const v = hasLower ? body.recurrence : body.Recurrence;
  if (v === null || v === undefined || v === '') {
    return { ok: true, present: true, value: null };
  }
  if (typeof v !== 'string') {
    return { ok: false, error: 'recurrence must be a string, null, or empty string' };
  }
  if (!TASK_RECURRENCE_SET.has(v)) {
    return {
      ok: false,
      error: `Invalid recurrence "${v}". Allowed: ${TASK_RECURRENCE_VALUES.join(', ')}`,
    };
  }
  return { ok: true, present: true, value: v as TaskRecurrence };
}

/**
 * Own-keys from JSON PATCH bodies that map to {@link UpdateTaskInput}.
 * `recurrence` is omitted — HTTP routes merge it after {@link parseRecurrenceFromRequestBody}.
 */
export const TASK_HTTP_PATCH_KEYS = [
  'task',
  'priority',
  'due',
  'from',
  'project',
  'nextAction',
  'status',
  'view',
  'threadUrl',
  'calendarEventUrl',
  'draftUrl',
  'attachUrl',
  'done',
  'notes',
  'assignedTo',
  'source',
  'sourceRef',
  'autoCreated',
  'dismissedAt',
  'lastSeenAt',
  'latestInboundAt',
  'suggestedResolution',
] as const satisfies readonly (keyof UpdateTaskInput)[];

/** Allow-listed patch fields from a client JSON body (excludes `recurrence`). */
export function sanitizeTaskUpdateFromJsonBody(raw: Record<string, unknown>): UpdateTaskInput {
  const out: UpdateTaskInput = {};
  for (const key of TASK_HTTP_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      (out as Record<string, unknown>)[key] = raw[key];
    }
  }
  return out;
}

/** Source of an auto-created task. `manual` = user-created (default). */
export type TaskSource =
  | 'manual'
  | 'commitment'
  | 'meeting-follow-up'
  | 'email-triage'
  | 'website-submission'
  | 'voice-capture';

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TaskStatus = 'Inbox' | 'Next' | 'Waiting' | 'Done' | 'Archive';
export type TaskView = 'inbox' | 'braindump' | 'projects' | 'archive';

export interface TaskRecord {
  id: string;
  task: string;
  priority: TaskPriority | null;
  due: string | null;
  from: string;
  project: string;
  nextAction: string;
  status: TaskStatus;
  view: TaskView;
  threadUrl: string | null;
  /** Google Calendar event page (htmlLink), when the task is meeting-related. */
  calendarEventUrl: string | null;
  draftUrl: string | null;
  attachUrl: string | null;
  done: boolean;
  notes: string;
  assignedTo: string;
  createdAt: string | null;
  lastModified: string | null;
  /** Provenance for auto-created tasks. null/undefined on manual tasks. */
  source: TaskSource | null;
  sourceRef: string | null;
  autoCreated: boolean;
  dismissedAt: string | null;
  /** Thread-activity tracking. See field constants above. */
  lastSeenAt: string | null;
  latestInboundAt: string | null;
  /** Repeating schedule; null = does not repeat. */
  recurrence: TaskRecurrence | null;
  /** AI classifier output pending user review; null if none. */
  suggestedResolution: SuggestedResolution | null;
  /** Last time Gmail thread refresh / auto-resolve sync evaluated this task. */
  lastSyncedAt: string | null;
  /** Gmail id of the latest thread message at last refresh (skip re-run if unchanged). */
  threadRefreshMessageId: string | null;
}

export interface CreateTaskInput {
  task: string;
  priority?: TaskPriority;
  due?: string;
  from?: string;
  project?: string;
  nextAction?: string;
  status?: TaskStatus;
  view?: TaskView;
  threadUrl?: string;
  calendarEventUrl?: string | null;
  draftUrl?: string;
  attachUrl?: string;
  done?: boolean;
  notes?: string;
  assignedTo?: string;
  source?: TaskSource;
  sourceRef?: string;
  autoCreated?: boolean;
  dismissedAt?: string | null;
  lastSeenAt?: string | null;
  latestInboundAt?: string | null;
  recurrence?: TaskRecurrence | null;
  suggestedResolution?: SuggestedResolution | null;
  lastSyncedAt?: string | null;
  threadRefreshMessageId?: string | null;
}

export interface UpdateTaskInput {
  task?: string;
  priority?: TaskPriority;
  due?: string | null;
  from?: string;
  project?: string;
  nextAction?: string;
  status?: TaskStatus;
  view?: TaskView;
  threadUrl?: string | null;
  calendarEventUrl?: string | null;
  draftUrl?: string | null;
  attachUrl?: string | null;
  done?: boolean;
  notes?: string;
  assignedTo?: string | null;
  source?: TaskSource | null;
  sourceRef?: string | null;
  autoCreated?: boolean;
  /** ISO datetime; null clears the dismissal (re-surfaces in Command Center). */
  dismissedAt?: string | null;
  /** ISO datetime; null leaves unchanged when omitted. */
  lastSeenAt?: string | null;
  /** ISO datetime; null leaves unchanged when omitted. */
  latestInboundAt?: string | null;
  recurrence?: TaskRecurrence | null;
  /** null clears pending suggestion; object sets/replaces (validated by route). */
  suggestedResolution?: SuggestedResolution | null;
  lastSyncedAt?: string | null;
  threadRefreshMessageId?: string | null;
}

/** Map Airtable record → TaskRecord (includes recurrence). */
export function deserializeTaskFromAirtable(record: {
  id: string;
  fields?: Record<string, unknown>;
}): TaskRecord {
  return mapRecordToTask(record);
}

/** Map create/update input → Airtable `fields` payload. */
export function serializeTaskFieldsForAirtable(
  input: CreateTaskInput | UpdateTaskInput,
): Record<string, unknown> {
  return mapInputToFields(input);
}

// ============================================================================
// Helpers
// ============================================================================

function mapRecordToTask(record: any): TaskRecord {
  const f = record.fields || {};
  return {
    id: record.id,
    task: f[TASK_FIELDS.TASK] || '',
    priority: f[TASK_FIELDS.PRIORITY] || null,
    due: f[TASK_FIELDS.DUE] || null,
    from: f[TASK_FIELDS.FROM] || '',
    project: f[TASK_FIELDS.PROJECT] || '',
    nextAction: f[TASK_FIELDS.NEXT_ACTION] || '',
    status: f[TASK_FIELDS.STATUS] || 'Inbox',
    view: f[TASK_FIELDS.VIEW] || 'inbox',
    threadUrl: f[TASK_FIELDS.THREAD_URL] || null,
    calendarEventUrl: (f[TASK_FIELDS.CALENDAR_EVENT_URL] as string) || null,
    draftUrl: f[TASK_FIELDS.DRAFT_URL] || null,
    attachUrl: f[TASK_FIELDS.ATTACHMENT_URL] || null,
    done: f[TASK_FIELDS.DONE] || false,
    notes: f[TASK_FIELDS.NOTES] || '',
    assignedTo: f[TASK_FIELDS.ASSIGNED_TO] || '',
    createdAt: f[TASK_FIELDS.CREATED_AT] || null,
    lastModified: f[TASK_FIELDS.LAST_MODIFIED] || null,
    source: (f[TASK_FIELDS.SOURCE] as TaskSource) || null,
    sourceRef: f[TASK_FIELDS.SOURCE_REF] || null,
    autoCreated: f[TASK_FIELDS.AUTO_CREATED] || false,
    dismissedAt: f[TASK_FIELDS.DISMISSED_AT] || null,
    lastSeenAt: f[TASK_FIELDS.LAST_SEEN_AT] || null,
    latestInboundAt: f[TASK_FIELDS.LATEST_INBOUND_AT] || null,
    recurrence: normalizeRecurrenceFromAirtable(f[TASK_FIELDS.RECURRENCE]),
    suggestedResolution: parseSuggestedResolutionFromAirtable(f[TASK_FIELDS.SUGGESTED_RESOLUTION]),
    lastSyncedAt: (f[TASK_FIELDS.LAST_SYNCED_AT] as string) || null,
    threadRefreshMessageId: (f[TASK_FIELDS.THREAD_REFRESH_MESSAGE_ID] as string) || null,
  };
}

function normalizeRecurrenceFromAirtable(raw: unknown): TaskRecurrence | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string' && TASK_RECURRENCE_SET.has(raw)) {
    return raw as TaskRecurrence;
  }
  return null;
}

/**
 * Centralizes Done ↔ archive view so any PATCH path (checkbox, TaskEditPanel,
 * apply-decision) keeps Status, Done checkbox, and View in sync.
 *
 * Rules:
 * - Status `Done` → always `done: true`, `view: 'archive'`
 * - Status `Archive` (dismissed / filed) → `view: 'archive'`
 * - Leaving `Done` for another active status → `done: false`, restore `view`
 *   from the patch or default `inbox`
 * - Bare `done: true` without status → treat as complete → Done + archive
 */
export function mergeTaskUpdateWithArchiveRules(
  current: TaskRecord,
  input: UpdateTaskInput,
): UpdateTaskInput {
  const out: UpdateTaskInput = { ...input };
  const curStatus = current.status;
  const nextStatus: TaskStatus = input.status !== undefined ? input.status : current.status;

  // Unchecking without a new status — must run before `nextStatus === 'Done'` (nextStatus would still be Done)
  if (curStatus === 'Done' && input.done === false && input.status === undefined) {
    out.done = false;
    out.view = input.view !== undefined ? input.view : 'inbox';
    out.status = 'Inbox';
    return out;
  }

  if (nextStatus === 'Done') {
    out.status = 'Done';
    out.done = true;
    out.view = 'archive';
    return out;
  }

  if (nextStatus === 'Archive') {
    out.status = 'Archive';
    out.view = 'archive';
    return out;
  }

  // Leaving Done for an active status (Next / Inbox / Waiting)
  if (curStatus === 'Done') {
    out.status = nextStatus;
    out.done = false;
    out.view = input.view !== undefined ? input.view : 'inbox';
    return out;
  }

  // Leaving dismissed "Archive" status for an active workflow status
  if (
    curStatus === 'Archive' &&
    (nextStatus === 'Inbox' || nextStatus === 'Next' || nextStatus === 'Waiting')
  ) {
    out.status = nextStatus;
    out.view = input.view !== undefined ? input.view : 'inbox';
    return out;
  }

  if (input.done === true && input.status === undefined) {
    out.status = 'Done';
    out.done = true;
    out.view = 'archive';
    return out;
  }

  return out;
}

async function fetchTaskByRecordId(recordId: string): Promise<TaskRecord> {
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;
  const response = await fetchWithRetry(url, { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error fetching task (${response.status}): ${errorText}`);
  }
  const record = await response.json();
  return mapRecordToTask(record);
}

function mapInputToFields(input: CreateTaskInput | UpdateTaskInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if ('task' in input && input.task !== undefined) fields[TASK_FIELDS.TASK] = input.task;
  if ('priority' in input && input.priority !== undefined) fields[TASK_FIELDS.PRIORITY] = input.priority;
  if ('due' in input) fields[TASK_FIELDS.DUE] = input.due || null;
  if ('from' in input && input.from !== undefined) fields[TASK_FIELDS.FROM] = input.from;
  if ('project' in input && input.project !== undefined) fields[TASK_FIELDS.PROJECT] = input.project;
  if ('nextAction' in input && input.nextAction !== undefined) fields[TASK_FIELDS.NEXT_ACTION] = input.nextAction;
  if ('status' in input && input.status !== undefined) fields[TASK_FIELDS.STATUS] = input.status;
  if ('view' in input && input.view !== undefined) fields[TASK_FIELDS.VIEW] = input.view;
  if ('threadUrl' in input) fields[TASK_FIELDS.THREAD_URL] = input.threadUrl || null;
  if ('calendarEventUrl' in input) {
    fields[TASK_FIELDS.CALENDAR_EVENT_URL] = input.calendarEventUrl || null;
  }
  if ('draftUrl' in input) fields[TASK_FIELDS.DRAFT_URL] = input.draftUrl || null;
  if ('attachUrl' in input) fields[TASK_FIELDS.ATTACHMENT_URL] = input.attachUrl || null;
  if ('done' in input && input.done !== undefined) fields[TASK_FIELDS.DONE] = input.done;
  if ('notes' in input && input.notes !== undefined) fields[TASK_FIELDS.NOTES] = input.notes;
  if ('assignedTo' in input) fields[TASK_FIELDS.ASSIGNED_TO] = input.assignedTo || null;
  if ('source' in input) fields[TASK_FIELDS.SOURCE] = input.source || null;
  if ('sourceRef' in input) fields[TASK_FIELDS.SOURCE_REF] = input.sourceRef || null;
  if ('autoCreated' in input && input.autoCreated !== undefined) fields[TASK_FIELDS.AUTO_CREATED] = input.autoCreated;
  if ('dismissedAt' in input) fields[TASK_FIELDS.DISMISSED_AT] = input.dismissedAt || null;
  if ('lastSeenAt' in input) fields[TASK_FIELDS.LAST_SEEN_AT] = input.lastSeenAt || null;
  if ('latestInboundAt' in input) fields[TASK_FIELDS.LATEST_INBOUND_AT] = input.latestInboundAt || null;
  if (Object.prototype.hasOwnProperty.call(input, 'recurrence')) {
    fields[TASK_FIELDS.RECURRENCE] =
      input.recurrence === null || input.recurrence === undefined ? null : input.recurrence;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'suggestedResolution')) {
    const sr = (input as UpdateTaskInput & CreateTaskInput).suggestedResolution;
    if (sr === null || sr === undefined) {
      fields[TASK_FIELDS.SUGGESTED_RESOLUTION] = null;
    } else if (typeof sr === 'object' && !Array.isArray(sr)) {
      fields[TASK_FIELDS.SUGGESTED_RESOLUTION] = JSON.stringify(sr);
    }
  }
  if ('lastSyncedAt' in input) {
    fields[TASK_FIELDS.LAST_SYNCED_AT] = input.lastSyncedAt || null;
  }
  if ('threadRefreshMessageId' in input) {
    fields[TASK_FIELDS.THREAD_REFRESH_MESSAGE_ID] = input.threadRefreshMessageId || null;
  }

  return fields;
}

// ============================================================================
// Auto-task helpers: find / upsert by (Source, SourceRef)
// ============================================================================

/**
 * Find an existing task by its Thread URL — used as a fallback when
 * findTaskBySourceRef misses because older tasks pre-date the Source/SourceRef
 * schema. Lets us adopt legacy tasks and refresh their preview instead of
 * creating duplicates.
 */
export async function findTaskByThreadUrl(threadUrl: string): Promise<TaskRecord | null> {
  if (!threadUrl) return null;
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();
  const safeUrl = threadUrl.replace(/'/g, "\\'");
  const filter = `{${TASK_FIELDS.THREAD_URL}} = '${safeUrl}'`;
  const params = new URLSearchParams();
  params.set('filterByFormula', filter);
  params.set('maxRecords', '1');

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
  const response = await fetchWithRetry(url, { method: 'GET' });
  if (!response.ok) {
    if (response.status === 422) return null;
    throw new Error(`Airtable API error looking up task by thread URL (${response.status})`);
  }
  const data = await response.json();
  const record = (data.records || [])[0];
  return record ? mapRecordToTask(record) : null;
}

/**
 * Find an existing auto-created task keyed by (source, sourceRef).
 * Returns null if none found.
 */
export async function findTaskBySourceRef(
  source: TaskSource,
  sourceRef: string,
): Promise<TaskRecord | null> {
  if (!sourceRef) return null;
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();

  // Airtable formula: AND({Source} = 'email-triage', {SourceRef} = 'abc')
  // Single-quote-escape `sourceRef` in case it contains quotes.
  const safeRef = sourceRef.replace(/'/g, "\\'");
  const filter = `AND({${TASK_FIELDS.SOURCE}} = '${source}', {${TASK_FIELDS.SOURCE_REF}} = '${safeRef}')`;
  const params = new URLSearchParams();
  params.set('filterByFormula', filter);
  params.set('maxRecords', '1');

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
  const response = await fetchWithRetry(url, { method: 'GET' });

  if (!response.ok) {
    // If the Airtable schema doesn't yet have Source/SourceRef columns we'll
    // get a 422 "Unknown field names" response. Swallow it — caller treats
    // null as "no existing task" and will try to create one (which will also
    // 422 until the columns exist). The log is enough breadcrumb to debug.
    if (response.status === 422) {
      console.warn(
        '[findTaskBySourceRef] Airtable 422 — Source/SourceRef columns may not exist yet. ' +
          'Add the schema fields per the docs; auto-tasks will start working after.',
      );
      return null;
    }
    const errorText = await response.text();
    throw new Error(`Airtable API error looking up task by source ref (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const record = (data.records || [])[0];
  return record ? mapRecordToTask(record) : null;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Server-side filters only. Never put `excludeDone` in Airtable formulas: bases differ
 * (no {Done} checkbox, Status name/value mismatches), which produced recurring 422
 * INVALID_FILTER_BY_FORMULA "Unknown field names: done". Completed rows are dropped
 * in memory after mapRecordToTask instead.
 */
function buildTaskFilterConditions(
  options: { view?: TaskView; status?: TaskStatus; excludeDone?: boolean } | undefined,
): string[] {
  const conditions: string[] = [];
  if (options?.view) {
    conditions.push(`{${TASK_FIELDS.VIEW}} = '${options.view}'`);
  }
  if (options?.status) {
    conditions.push(`{${TASK_FIELDS.STATUS}} = '${options.status}'`);
  }
  return conditions;
}

function conditionsToFormula(conditions: string[]): string {
  if (conditions.length === 0) return '';
  if (conditions.length === 1) return conditions[0];
  return `AND(${conditions.join(', ')})`;
}

/** Bump when list-fetch behavior changes (helps confirm deploy vs stale logs). */
export const TASKS_LIST_FETCH_REVISION = '2026-04-15v4-no-airtable-sort';

async function fetchTaskRecordPages(
  baseId: string,
  tableId: string,
  filterFormula: string | undefined,
): Promise<any[]> {
  const allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (filterFormula) params.set('filterByFormula', filterFormula);
    // Intentionally no server-side sort: avoids dependency on a "Priority" column and
    // keeps the request minimal (filter is the only formula). Sort runs in getTasks().
    if (offset) params.set('offset', offset);

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 422) {
        console.error('[getTasks] Airtable 422 — list fetch context', {
          revision: TASKS_LIST_FETCH_REVISION,
          hadFilterByFormula: Boolean(filterFormula),
          filterFormulaPreview: filterFormula ? filterFormula.slice(0, 200) : null,
          tableId,
          baseIdPrefix: `${baseId.slice(0, 12)}…`,
        });
      }
      throw new Error(`Airtable API error fetching tasks (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * Fetch all tasks, optionally filtered by view or status.
 * Returns tasks sorted by priority (P0 first) then due date.
 *
 * `excludeDone` is applied in memory only (never via filterByFormula), so Airtable
 * schema differences cannot break the request.
 */
export async function getTasks(options?: {
  view?: TaskView;
  status?: TaskStatus;
  excludeDone?: boolean;
}): Promise<TaskRecord[]> {
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();

  const filterFormula = conditionsToFormula(buildTaskFilterConditions(options));

  const allRecords = await fetchTaskRecordPages(baseId, tableId, filterFormula || undefined);

  // Priority + due date (all client-side; Airtable list request does not use sort[] params)
  const priorityOrder = ['P0', 'P1', 'P2', 'P3'];
  let tasks = allRecords.map(mapRecordToTask);
  if (options?.excludeDone) {
    tasks = tasks.filter((t) => t.status !== 'Done');
  }
  tasks.sort((a, b) => {
    const pa = priorityOrder.indexOf(a.priority || 'P3');
    const pb = priorityOrder.indexOf(b.priority || 'P3');
    if (pa !== pb) return pa - pb;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
  return tasks;
}

/**
 * Create a new task.
 */
export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();
  const fields = mapInputToFields(input);

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error creating task (${response.status}): ${errorText}`);
  }

  const record = await response.json();
  const task = mapRecordToTask(record);

  // Fire-and-forget: never blocks the mutation return.
  const summaryParts: string[] = [];
  if (task.priority) summaryParts.push(task.priority);
  if (task.due) summaryParts.push(`due ${task.due}`);
  if (task.project) summaryParts.push(task.project);
  const summaryTail = summaryParts.length ? ` (${summaryParts.join(', ')})` : '';
  logEventAsync({
    actorType: 'system',
    actor: 'api',
    action: 'task.created',
    entityType: 'task',
    entityId: task.id,
    entityTitle: task.task,
    summary: `Task created: ${task.task}${summaryTail}`,
    metadata: {
      priority: task.priority,
      due: task.due,
      status: task.status,
      view: task.view,
      project: task.project,
      from: task.from,
    },
    source: 'lib/airtable/tasks#createTask',
  });

  return task;
}

/**
 * Update an existing task by record ID.
 */
export async function updateTask(recordId: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();
  const current = await fetchTaskByRecordId(recordId);
  const mergedInput = mergeTaskUpdateWithArchiveRules(current, input);
  const fields = mapInputToFields(mergedInput);

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;

  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error updating task (${response.status}): ${errorText}`);
  }

  const record = await response.json();
  const task = mapRecordToTask(record);

  // Pick the most descriptive action for the event stream:
  //   status → Done  ⇒ task.completed
  //   status changed ⇒ task.status-changed
  //   otherwise      ⇒ task.updated
  let action: ActivityAction = 'task.updated';
  if (typeof mergedInput.status === 'string') {
    action = mergedInput.status === 'Done' ? 'task.completed' : 'task.status-changed';
  }

  const { summary, changedFields } = summarizeTaskUpdate(task.task, mergedInput as Record<string, unknown>);

  logEventAsync({
    actorType: 'system',
    actor: 'api',
    action,
    entityType: 'task',
    entityId: task.id,
    entityTitle: task.task,
    summary,
    metadata: {
      changedFields,
      input: mergedInput,
      after: {
        priority: task.priority,
        due: task.due,
        status: task.status,
        project: task.project,
      },
    },
    source: 'lib/airtable/tasks#updateTask',
  });

  return task;
}

/**
 * Delete a task by record ID.
 *
 * Best-effort fetch first so the event-log row includes the task title.
 * If the GET fails (race, permission glitch), we still proceed with the
 * delete and log without a title — the deletion itself is what matters.
 */
export async function deleteTask(recordId: string): Promise<void> {
  const baseId = tasksBaseIdOrThrow();
  const tableId = getTasksTableIdentifier();
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;

  // Pre-fetch title for the audit log. Never fail the delete over a read error.
  let priorTitle: string | undefined;
  try {
    const pre = await fetchWithRetry(url, { method: 'GET' });
    if (pre.ok) {
      const rec = await pre.json();
      priorTitle = rec?.fields?.[TASK_FIELDS.TASK] || undefined;
    }
  } catch {
    // swallow — title is a nice-to-have
  }

  const response = await fetchWithRetry(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error deleting task (${response.status}): ${errorText}`);
  }

  logEventAsync({
    actorType: 'system',
    actor: 'api',
    action: 'task.deleted',
    entityType: 'task',
    entityId: recordId,
    entityTitle: priorTitle,
    summary: priorTitle
      ? `Task deleted: "${priorTitle}"`
      : `Task deleted: ${recordId}`,
    source: 'lib/airtable/tasks#deleteTask',
  });
}
