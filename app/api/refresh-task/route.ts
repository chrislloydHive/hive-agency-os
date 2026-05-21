// POST /api/refresh-task
// Flat alias for thread refresh (body: { taskId } or query ?taskId=).
// Returns 410 { code: "thread_gone", error } when the source Gmail thread was deleted.

import { NextRequest } from 'next/server';
import { refreshTaskFromThreadHandler } from '@/lib/os/refreshTaskFromThreadHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let taskId = req.nextUrl.searchParams.get('taskId')?.trim() ?? '';
  if (!taskId) {
    try {
      const body = (await req.json()) as { taskId?: string };
      taskId = String(body.taskId ?? '').trim();
    } catch {
      /* empty body */
    }
  }
  return refreshTaskFromThreadHandler(taskId);
}
