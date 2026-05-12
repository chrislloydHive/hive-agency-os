// app/api/os/tasks/[id]/route.ts
// Per-task GET + PATCH. Thin wrappers around lib/airtable/tasks.

import { NextRequest, NextResponse } from 'next/server';
import {
  getTasks,
  updateTask,
  parseRecurrenceFromRequestBody,
  parseSuggestedResolutionPatchInput,
  sanitizeTaskUpdateFromJsonBody,
  WAITING_ON_TYPES,
} from '@/lib/airtable/tasks';
import type { TaskRecord } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';

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

// GET /api/os/tasks/:id — fetch one task by Airtable record id
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const all = await getTasks({});
    const task = all.find(t => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const blocks = all.filter((t) => t.blockedBy.includes(id)).map((t) => t.id);
    return NextResponse.json({ task: { ...task, blocks } });
  } catch (err) {
    console.error('[Tasks/:id] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch task' },
      { status: 500 },
    );
  }
}

// PATCH /api/os/tasks/:id — body is partial UpdateTaskInput
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const body = (await request.json()) as Record<string, unknown>;
    const bodyRec = parseRecurrenceFromRequestBody(body);
    if (!bodyRec.ok) {
      return NextResponse.json({ error: bodyRec.error }, { status: 400 });
    }
    const patch = sanitizeTaskUpdateFromJsonBody(body);
    if (bodyRec.present) {
      patch.recurrence = bodyRec.value;
    } else {
      delete patch.recurrence;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'suggestedResolution')) {
      const sr = parseSuggestedResolutionPatchInput(body.suggestedResolution);
      if (!sr.ok) {
        return NextResponse.json({ error: sr.error }, { status: 400 });
      }
      patch.suggestedResolution = sr.value;
    } else {
      delete patch.suggestedResolution;
    }

    // Validate blockedBy
    if (Object.prototype.hasOwnProperty.call(body, 'blockedBy')) {
      const bb = body.blockedBy;
      if (bb !== null && bb !== undefined) {
        if (!Array.isArray(bb) || bb.some((v: unknown) => typeof v !== 'string')) {
          return NextResponse.json({ error: 'blockedBy must be an array of strings' }, { status: 400 });
        }
        if (bb.includes(id)) {
          return NextResponse.json({ error: 'blockedBy cannot include self-reference' }, { status: 400 });
        }
        const allTasks = await getTasks({});
        const validIds = new Set(allTasks.map((t) => t.id));
        for (const bid of bb as string[]) {
          if (!validIds.has(bid)) {
            return NextResponse.json({ error: `invalid blockedBy id: ${bid}` }, { status: 400 });
          }
        }
      }
    }
    // Validate waitingOnType
    if (Object.prototype.hasOwnProperty.call(body, 'waitingOnType')) {
      const wt = body.waitingOnType;
      if (wt !== null && wt !== undefined) {
        const wtSet = new Set<string>(WAITING_ON_TYPES);
        if (!wtSet.has(wt as string)) {
          return NextResponse.json(
            { error: `Invalid waitingOnType. Allowed: ${WAITING_ON_TYPES.join(', ')}` },
            { status: 400 },
          );
        }
      }
    }
    // Validate waitingUntil
    if (Object.prototype.hasOwnProperty.call(body, 'waitingUntil')) {
      const wu = body.waitingUntil;
      if (wu !== null && wu !== undefined && isNaN(Date.parse(wu as string))) {
        return NextResponse.json({ error: 'waitingUntil must be a valid ISO 8601 date' }, { status: 400 });
      }
    }

    const updated = await updateTask(id, patch);

    if (patch.status === 'Done' || patch.done === true) {
      fireAndForgetUnblockDetection(updated).catch(() => {});
    }

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error('[Tasks/:id] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update task' },
      { status: 500 },
    );
  }
}
