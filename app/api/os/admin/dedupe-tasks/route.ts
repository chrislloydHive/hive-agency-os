// POST /api/os/admin/dedupe-tasks
// One-shot backfill: collapse duplicate tasks pointing at the same Gmail thread.
// Groups by (threadId, project), picks the most-recently-modified non-Done task
// as canonical, dismisses the rest.

import { NextRequest, NextResponse } from 'next/server';
import { getTasks, updateTask } from '@/lib/airtable/tasks';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface MergeEntry {
  canonicalId: string;
  canonicalTitle: string;
  dismissedIds: string[];
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_API_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const allTasks = await getTasks({});
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);

    const groups = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const tid = extractGmailThreadIdFromUrl(t.threadUrl);
      if (!tid) continue;
      const key = `${tid}::${t.project || ''}`;
      const arr = groups.get(key);
      if (arr) arr.push(t);
      else groups.set(key, [t]);
    }

    const merges: MergeEntry[] = [];
    let dismissedCount = 0;

    for (const [key, tasks] of Array.from(groups.entries())) {
      if (tasks.length <= 1) continue;

      const nonDone = tasks.filter((t) => t.status !== 'Done');
      const candidates = nonDone.length > 0 ? nonDone : tasks;
      candidates.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
      const canonical = candidates[0];
      const duplicates = tasks.filter((t) => t.id !== canonical.id);

      if (duplicates.length === 0) continue;

      console.log(
        `[admin/dedupe-tasks] group=${key} canonical=${canonical.id} ("${canonical.task.slice(0, 60)}") dismissing=${duplicates.length}`,
      );

      const entry: MergeEntry = {
        canonicalId: canonical.id,
        canonicalTitle: canonical.task,
        dismissedIds: [],
      };

      for (const dup of duplicates) {
        await updateTask(dup.id, {
          dismissedAt: now,
          status: 'Archive',
          view: 'archive',
          notes: dup.notes
            ? `${dup.notes}\n\n[dedupe merged into ${canonical.id} on ${dateStr}]`
            : `[dedupe merged into ${canonical.id} on ${dateStr}]`,
        });
        entry.dismissedIds.push(dup.id);
        dismissedCount++;
      }

      merges.push(entry);
    }

    console.log(
      `[admin/dedupe-tasks] complete: groups=${merges.length} dismissed=${dismissedCount}`,
    );

    return NextResponse.json({ groups: merges.length, dismissedCount, merges });
  } catch (err) {
    console.error('[admin/dedupe-tasks] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Dedupe failed' },
      { status: 500 },
    );
  }
}
