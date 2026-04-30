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
} from '@/lib/airtable/tasks';
import type { TaskView, TaskStatus } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';

/** For POST: only pass URL fields into createTask so Airtable isn't written with empty / junk keys. */
function nonEmptyStringField(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
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

    const tasks = await getTasks({
      view: view || undefined,
      status: status || undefined,
      excludeDone,
    });

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

    const updated = await updateTask(id, patch);

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
