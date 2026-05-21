// lib/os/gmailThreadGone.ts
// Detect Gmail threads deleted/pruned after a task was created.

export const THREAD_GONE_CODE = 'thread_gone' as const;

/** Gmail API 404 / "Requested entity was not found" on threads.get */
export function isGmailThreadNotFoundError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('requested entity was not found');
}

export function primaryThreadGoneMessage(err: unknown): string {
  const detail = err instanceof Error ? err.message : 'unknown';
  return `Could not load primary Gmail thread: ${detail}`;
}

export function targetThreadGoneMessage(threadId: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : 'unknown';
  return `Could not load target Gmail thread ${threadId}: ${detail}`;
}

/** Client + route: recognize thread-gone from new 410 or legacy 502 body. */
export function isThreadGoneRefreshResponse(
  status: number,
  body: { code?: string; error?: string } | null | undefined,
): boolean {
  if (body?.code === THREAD_GONE_CODE) return true;
  if (status !== 410 && status !== 502) return false;
  const err = String(body?.error ?? '');
  if (!err.includes('Could not load') || !err.includes('Gmail thread')) return false;
  return (
    err.includes('Requested entity was not found') ||
    /not found/i.test(err)
  );
}
