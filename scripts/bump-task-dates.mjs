#!/usr/bin/env node
/**
 * Bumps any 2025 Due date in the Tasks table forward by one year.
 * Dry-run by default. Pass --apply to actually write.
 *
 * Usage:
 *   node scripts/bump-task-dates.mjs           # dry run
 *   node scripts/bump-task-dates.mjs --apply   # write changes
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local manually since dotenv defaults to .env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID;
const TABLE_ID = 'tblf7wEI0KBwysrQz'; // Tasks
const APPLY = process.argv.includes('--apply');

if (!API_KEY || !BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or base id');
  process.exit(1);
}

const api = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const headers = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function listAll() {
  const records = [];
  let offset;
  do {
    const url = new URL(api);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function bumpYear(dateStr) {
  // Airtable date fields come as 'YYYY-MM-DD'
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${Number(y) + 1}-${mo}-${d}`;
}

async function patch(batch) {
  const res = await fetch(api, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ records: batch, typecast: false }),
  });
  if (!res.ok) throw new Error(`Patch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  const all = await listAll();
  console.log(`Fetched ${all.length} tasks`);

  const toUpdate = [];
  for (const r of all) {
    const due = r.fields.Due;
    if (!due) continue;
    if (due.startsWith('2025-')) {
      const newDue = bumpYear(due);
      toUpdate.push({
        id: r.id,
        fields: { Due: newDue },
        _preview: { task: r.fields.Task, from: due, to: newDue },
      });
    }
  }

  console.log(`\n${toUpdate.length} tasks with 2025 due dates:\n`);
  for (const u of toUpdate) {
    console.log(`  ${u._preview.from} -> ${u._preview.to}  ${u._preview.task}`);
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write changes.');
    return;
  }

  // Airtable: max 10 records per PATCH
  const batches = [];
  for (let i = 0; i < toUpdate.length; i += 10) {
    batches.push(toUpdate.slice(i, i + 10).map(({ id, fields }) => ({ id, fields })));
  }
  for (const [i, b] of batches.entries()) {
    await patch(b);
    console.log(`Patched batch ${i + 1}/${batches.length}`);
  }
  console.log('\nDone.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
