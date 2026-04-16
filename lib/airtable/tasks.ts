/**
 * Tasks - Airtable helper
 *
 * Manages the Tasks table for Hive team task tracking.
 * Supports inbox triage, brain dump, projects, and archive views.
 */

import { fetchWithRetry } from './client';
import { resolveTasksBaseId } from './bases';
import { logEventAsync, summarizeTaskUpdate, type ActivityAction } from './activityLog';

// ============================================================================
// Constants
// ============================================================================

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
  CREATED_AT: 'Created At',
  LAST_MODIFIED: 'Last Modified',
} as const;

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
  draftUrl: string | null;
  attachUrl: string | null;
  done: boolean;
  notes: string;
  createdAt: string | null;
  lastModified: string | null;
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
  draftUrl?: string;
  attachUrl?: string;
  done?: boolean;
  notes?: string;
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
  draftUrl?: string | null;
  attachUrl?: string | null;
  done?: boolean;
  notes?: string;
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
    draftUrl: f[TASK_FIELDS.DRAFT_URL] || null,
    attachUrl: f[TASK_FIELDS.ATTACHMENT_URL] || null,
    done: f[TASK_FIELDS.DONE] || false,
    notes: f[TASK_FIELDS.NOTES] || '',
    createdAt: f[TASK_FIELDS.CREATED_AT] || null,
    lastModified: f[TASK_FIELDS.LAST_MODIFIED] || null,
  };
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
  if ('draftUrl' in input) fields[TASK_FIELDS.DRAFT_URL] = input.draftUrl || null;
  if ('attachUrl' in input) fields[TASK_FIELDS.ATTACHMENT_URL] = input.attachUrl || null;
  if ('done' in input && input.done !== undefined) fields[TASK_FIELDS.DONE] = input.done;
  if ('notes' in input && input.notes !== undefined) fields[TASK_FIELDS.NOTES] = input.notes;

  return fields;
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
    body: JSON.stringify({ fields }),
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
  const fields = mapInputToFields(input);

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;

  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
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
  if (typeof input.status === 'string') {
    action = input.status === 'Done' ? 'task.completed' : 'task.status-changed';
  }

  const { summary, changedFields } = summarizeTaskUpdate(task.task, input as Record<string, unknown>);

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
      input,
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
