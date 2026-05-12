// app/api/os/tasks/route.ts
// API routes for Hive task management (CRUD)

import { NextRequest, NextResponse } from 'next/server';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  parseRecurrenceFromRequestBody,
  parseSuggestedResolutionPatchInput,
  sanitizeTaskUpdateFromJsonBody,
  WAITING_ON_TYPES,
} from '@/lib/airtable/tasks';
import type { TaskView, TaskStatus, TaskRecord } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';

/** For POST: only pass URL fields into createTask so Airtable isn't written with empty / junk keys. */
function nonEmptyStringField(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function enrichTasksWithBlocks(tasks: TaskRecord[]): (TaskRecord & { blocks: string[] })[] {
  const blocksMap = new Map<string, string[]>();
  for (const t of tasks) {
    for (const blockerId of t.blockedBy) {
      const arr = blocksMap.get(blockerId);
      if (arr) arr.push(t.id);
      else blocksMap.set(blockerId, [t.id]);
    }
  }
  return tasks.map((t) => ({
    ...t,
    blocks: blocksMap.get(t.id) || [],
  }));
}

const WAITING_ON_TYPE_SET = new Set<string>(WAITING_ON_TYPES);

function validateBlockedBy(body: Record<string, unknown>, taskId: string) {
  if (!Object.prototype.hasOwnProperty.call(body, 'blockedBy')) return null;
  const bb = body.blockedBy;
  if (bb === null || bb === undefined) return null;
  if (!Array.isArray(bb) || bb.some((v: unknown) => typeof v !== 'string')) {
    return NextResponse.json({ error: 'blockedBy must be an array of strings' }, { status: 400 });
  }
  if (bb.includes(taskId)) {
    return NextResponse.json({ error: 'blockedBy cannot include self-reference' }, { status: 400 });
  }
  return null;
}

function validateWaitingFields(body: Record<string, unknown>) {
  if (Object.prototype.hasOwnProperty.call(body, 'waitingOnType')) {
    const wt = body.waitingOnType;
    if (wt !== null && wt !== undefined && !WAITING_ON_TYPE_SET.has(wt as string)) {
      return NextResponse.json(
        { error: `Invalid waitingOnType. Allowed: ${WAITING_ON_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'waitingUntil')) {
    const wu = body.waitingUntil;
    if (wu !== null && wu !== undefined && isNaN(Date.parse(wu as string))) {
      return NextResponse.json({ error: 'waitingUntil must be a valid ISO 8601 date' }, { status: 400 });
    }
  }
  return null;
}

async function fireAndForgetUnblockDetection(completedTask: TaskRecord): Promise<void> {
  try {
    const allTasks = await getTasks({});
    const dependents = allTasks.filter(
      (t) => t.blockedBy.includes(completedTask.id) && t.status !== 'Done',
    );
    if (dependents.length === 0) return;

    let unblockedSuggestions = 0;
    for (const dep of dependents) {
      const remainingOpenBlockers = dep.blockedBy.filter((bid) => {
        if (bid === completedTask.id) return false;
        const blocker = allTasks.find((t) => t.id === bid);
        return blocker && blocker.status !== 'Done';
      });
      const hasActiveWait =
        dep.waitingOnType !== null &&
        (dep.waitingUntil === null || new Date(dep.waitingUntil) > new Date());

      if (remainingOpenBlockers.length === 0 && !hasActiveWait) {
        if (dep.suggestedResolution) continue;
        await updateTask(dep.id, {
          suggestedResolution: {
            action: 'unblocked',
            confidence: 'high',
            byTaskId: completedTask.id,
            byTaskTitle: completedTask.task,
            reasoning: `Blocker "${completedTask.task}" was marked Done; this task is ready to advance.`,
            suggestedAt: new Date().toISOString(),
          },
        });
        unblockedSuggestions++;
      }
    }
    if (unblockedSuggestions > 0) {
      console.log(
        `[sync unblock] completed-task=${completedTask.id} dependents=${dependents.length} unblocked-suggestions=${unblockedSuggestions}`,
      );
    }
  } catch (err) {
    console.error('[unblock-detection] error:', err);
  }
}

/**
 * GET /api/os/tasks
 * Fetch tasks with optional filters: ?view=inbox&status=Next&excludeDone=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') as TaskView | null;
    const status = searchParams.get('status') as TaskStatus | null;
    const excludeDone = searchParams.get('excludeDone') === 'true';

    const rawTasks = await getTasks({
      view: view || undefined,
      status: status || undefined,
      excludeDone,
    });
    const tasks = enrichTasksWithBlocks(rawTasks);

    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('[Tasks API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/tasks
 * Create a new task. Body: { task, priority?, due?, from?, project?, nextAction?, status?, view? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.task || typeof body.task !== 'string') {
      return NextResponse.json(
        { error: 'Task description is required' },
        { status: 400 }
      );
    }

    const rec = parseRecurrenceFromRequestBody(body as Record<string, unknown>);
    if (!rec.ok) {
      return NextResponse.json({ error: rec.error }, { status: 400 });
    }

    const threadUrl = nonEmptyStringField(body.threadUrl);
    const calendarEventUrl = nonEmptyStringField(body.calendarEventUrl);
    const draftUrl = nonEmptyStringField(body.draftUrl);
    const attachUrl = nonEmptyStringField(body.attachUrl);

    if (body.blockedBy !== undefined) {
      if (!Array.isArray(body.blockedBy) || body.blockedBy.some((v: unknown) => typeof v !== 'string')) {
        return NextResponse.json({ error: 'blockedBy must be an array of strings' }, { status: 400 });
      }
    }
    if (body.waitingOnType !== undefined && body.waitingOnType !== null) {
      if (!WAITING_ON_TYPE_SET.has(body.waitingOnType)) {
        return NextResponse.json(
          { error: `Invalid waitingOnType. Allowed: ${WAITING_ON_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
    }
    if (body.waitingUntil !== undefined && body.waitingUntil !== null) {
      if (isNaN(Date.parse(body.waitingUntil))) {
        return NextResponse.json({ error: 'waitingUntil must be a valid ISO 8601 date' }, { status: 400 });
      }
    }

    const created = await createTask({
      task: body.task,
      priority: body.priority,
      due: body.due,
      from: body.from,
      project: body.project,
      nextAction: body.nextAction,
      status: body.status || 'Inbox',
      view: body.view || 'inbox',
      ...(threadUrl !== undefined ? { threadUrl } : {}),
      ...(calendarEventUrl !== undefined ? { calendarEventUrl } : {}),
      ...(draftUrl !== undefined ? { draftUrl } : {}),
      ...(attachUrl !== undefined ? { attachUrl } : {}),
      done: body.done,
      notes: body.notes,
      ...(rec.present ? { recurrence: rec.value } : {}),
      ...(body.blockedBy !== undefined ? { blockedBy: body.blockedBy } : {}),
      ...(body.waitingOnType !== undefined ? { waitingOnType: body.waitingOnType } : {}),
      ...(body.waitingOnDescription !== undefined ? { waitingOnDescription: body.waitingOnDescription } : {}),
      ...(body.waitingUntil !== undefined ? { waitingUntil: body.waitingUntil } : {}),
    });

    return NextResponse.json({ task: created }, { status: 201 });
  } catch (error) {
    console.error('[Tasks API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/tasks
 * Update an existing task. Body: { id, ...fields }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    const { id, ...fields } = body as { id: string } & Record<string, unknown>;
    const fieldsRec = fields as Record<string, unknown>;
    const bodyRec = parseRecurrenceFromRequestBody(fieldsRec);
    if (!bodyRec.ok) {
      return NextResponse.json({ error: bodyRec.error }, { status: 400 });
    }
    const patch = sanitizeTaskUpdateFromJsonBody(fieldsRec);
    if (bodyRec.present) {
      patch.recurrence = bodyRec.value;
    } else {
      delete patch.recurrence;
    }
    if (Object.prototype.hasOwnProperty.call(fieldsRec, 'suggestedResolution')) {
      const sr = parseSuggestedResolutionPatchInput(fieldsRec.suggestedResolution);
      if (!sr.ok) {
        return NextResponse.json({ error: sr.error }, { status: 400 });
      }
      patch.suggestedResolution = sr.value;
    } else {
      delete patch.suggestedResolution;
    }

    const blockedByValidation = validateBlockedBy(fieldsRec, id);
    if (blockedByValidation) return blockedByValidation;
    const waitingValidation = validateWaitingFields(fieldsRec);
    if (waitingValidation) return waitingValidation;

    const updated = await updateTask(id, patch);

    if (patch.status === 'Done' || patch.done === true) {
      fireAndForgetUnblockDetection(updated).catch(() => {});
    }

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('[Tasks API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/tasks
 * Delete a task. Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    await deleteTask(body.id);

    return NextResponse.json({ success: true, deletedId: body.id });
  } catch (error) {
    console.error('[Tasks API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    );
  }
}
