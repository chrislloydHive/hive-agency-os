// app/api/os/tasks/sync-gmail/route.ts
// Lightweight endpoint that checks Gmail for untriaged emails and auto-creates
// tasks for them. Called fire-and-forget from My Day on mount so new emails
// appear as tasks without needing to visit Command Center first.
//
// Dedup: an in-memory lock prevents concurrent runs, and the batch processor
// tracks thread URLs created within a single run to avoid intra-batch dupes.

import { NextResponse } from 'next/server';
import { getTasks } from '@/lib/airtable/tasks';
import { buildTriageThreadDedupFromTasks } from '@/lib/airtable/taskThreadDedup';
import { getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { getEffectiveImportantDomains } from '@/lib/personalContext';
import { fetchTriageInbox } from '@/lib/os/commandCenterGoogle';
import { batchAutoCreateTasks } from '@/lib/os/autoTriageTask';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── In-memory mutex ─────────────────────────────────────────────────────
// Prevents duplicate runs when multiple clients fire sync at the same time.
let syncInProgress = false;
let lastSyncAt = 0;
const MIN_SYNC_INTERVAL_MS = 30_000; // minimum 30s between syncs

export async function POST() {
  // Guard: reject concurrent or too-frequent calls
  const now = Date.now();
  if (syncInProgress) {
    return NextResponse.json({ synced: 0, message: 'Sync already in progress', skipped: true });
  }
  if (now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return NextResponse.json({ synced: 0, message: 'Synced recently, skipping', skipped: true });
  }

  syncInProgress = true;
  try {
    // 1. Get ALL tasks (including Done/archived) to know which threads are tracked.
    //    Any task — active, completed, or archived — means the thread is handled.
    //    This prevents completed tasks from coming back as zombies.
    const tasks = await getTasks({ excludeDone: false });
    const threadDedup = buildTriageThreadDedupFromTasks(tasks);

    // 2. Get Google access token
    const refreshToken = await getAnyGoogleRefreshToken();
    if (!refreshToken) {
      return NextResponse.json({ synced: 0, message: 'No Google token' });
    }
    const accessToken = await refreshAccessToken(refreshToken);

    // 3. Fetch triage inbox
    const importantDomains = await getEffectiveImportantDomains();
    const triageItems = await fetchTriageInbox(accessToken, threadDedup, 14, importantDomains);

    // 4. Auto-create tasks for items without existing tasks.
    //    Deduplicate by threadId within this batch to prevent intra-run dupes.
    const seenThreadIds = new Set<string>();
    const toCreate = triageItems
      .filter(t => {
        if (t.hasExistingTask) return false;
        if (seenThreadIds.has(t.threadId)) return false;
        seenThreadIds.add(t.threadId);
        return true;
      })
      .map(t => ({ messageId: t.id, threadId: t.threadId }));

    if (toCreate.length === 0) {
      return NextResponse.json({ synced: 0, message: 'All emails already have tasks' });
    }

    const results = await batchAutoCreateTasks(accessToken, toCreate, 3);
    const created = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    console.log(`[sync-gmail] Auto-created ${created}/${toCreate.length} tasks`);
    if (failed.length > 0) {
      console.warn('[sync-gmail] Failures:', failed.map(f => f.error));
    }

    lastSyncAt = Date.now();
    return NextResponse.json({
      synced: created,
      total: toCreate.length,
      failures: failed.length,
    });
  } catch (err) {
    console.error('[sync-gmail] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    );
  } finally {
    syncInProgress = false;
  }
}
