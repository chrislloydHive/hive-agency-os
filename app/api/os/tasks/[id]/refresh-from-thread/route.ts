// POST /api/os/tasks/:id/refresh-from-thread
// Re-evaluates task fields against the current Gmail thread (and cross-thread hints).

import { refreshTaskFromThreadHandler } from '@/lib/os/refreshTaskFromThreadHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return refreshTaskFromThreadHandler(id);
}
