/**
 * One-off: any task with status Done but View ≠ archive gets View=archive.
 *
 * Run after deploy (requires Airtable env vars):
 *   npx tsx scripts/backfill-done-tasks-to-archive.ts
 *
 * Safe to run multiple times — only patches rows that still need it.
 */
import 'dotenv/config';
import { getTasks, updateTask } from '../lib/airtable/tasks';

async function main() {
  const all = await getTasks({});
  const needsBackfill = all.filter((t) => t.status === 'Done' && t.view !== 'archive');

  console.log(`[backfill] Done tasks total: ${all.filter((t) => t.status === 'Done').length}`);
  console.log(`[backfill] To fix (Done but view ≠ archive): ${needsBackfill.length}`);

  for (const t of needsBackfill) {
    await updateTask(t.id, { view: 'archive' });
    console.log(`[backfill] OK: ${t.task.slice(0, 72)}${t.task.length > 72 ? '…' : ''}`);
  }

  console.log('[backfill] complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
