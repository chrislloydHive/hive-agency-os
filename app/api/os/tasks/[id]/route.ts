// app/api/os/tasks/[id]/route.ts
// Per-task GET + PATCH. Thin wrappers around lib/airtable/tasks.

import { NextRequest, NextResponse } from 'next/server';
import { getTasks, updateTask } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';

// GET /api/os/tasks/:id — fetch one task by Airtable record id
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    // No direct by-id helper; filter from list. Cheap for current Tasks table size.
    const all = await getTasks({});
    const task = all.find(t => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task });
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
    const body = await request.json();
    const updated = await updateTask(id, body);
    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error('[Tasks/:id] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update task' },
      { status: 500 },
    );
  }
}
