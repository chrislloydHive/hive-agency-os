/**
 * One-off: tasks that are done or dismissed but still view=inbox.
 *
 * Run: npx tsx scripts/backfill-stuck-inbox-tasks.ts
 */
import 'dotenv/config';
import { getTasks, updateTask } from '../lib/airtable/tasks';

const DONE_STUCK = [
  'rec3xiM48qU2D4Aub',
  'rec7aaYSiYfrKQ7dq',
  'recgTe8Eq9qhSZEG7',
  'recm9AmWqaoFVQf8a',
];

const DISMISSED_STUCK = [
  'recYMcaFhJD3a0HDJ',
  'recyrtiI2cKSIct5f',
  'recUNl4u8iKtlF1JA',
  'recjc3UC52Lp62FfX',
];

async function main() {
  const all = await getTasks({});
  const byId = new Map(all.map((t) => [t.id, t]));

  for (const id of DONE_STUCK) {
    const t = byId.get(id);
    if (!t) {
      console.warn(`[backfill] missing ${id}`);
      continue;
    }
    if (t.view === 'archive') {
      console.log(`[backfill] skip done ${id} (already archive)`);
      continue;
    }
    await updateTask(id, { view: 'archive', done: true, status: 'Done' });
    console.log(`[backfill] archived done task ${id}`);
  }

  for (const id of DISMISSED_STUCK) {
    const t = byId.get(id);
    if (!t) {
      console.warn(`[backfill] missing ${id}`);
      continue;
    }
    if (t.view === 'archive' && t.dismissedAt) {
      console.log(`[backfill] skip dismissed ${id} (already archive)`);
      continue;
    }
    await updateTask(id, {
      view: 'archive',
      ...(t.dismissedAt ? {} : { dismissedAt: new Date().toISOString() }),
    });
    console.log(`[backfill] archived dismissed task ${id}`);
  }

  console.log('[backfill] complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
