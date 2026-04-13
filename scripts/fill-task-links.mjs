#!/usr/bin/env node
// fill-task-links.mjs — One-time script to populate Thread URL and Draft URL
// for tasks matched to Gmail threads during the inbox triage session.
//
// Usage:  node scripts/fill-task-links.mjs
// (run from the hive-agency-os directory so .env.local is accessible)

import 'dotenv/config';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_OS_BASE_ID || 'appVLDjqK2q4IJhGz';
const TABLE_ID = 'tblf7wEI0KBwysrQz';

// ── Gmail links found during inbox triage ──────────────────────────────────
// Format: { taskSubstring, threadUrl, draftUrl? }
const LINK_MATCHES = [
  {
    taskSubstring: "D'Nisha Missing Assets",
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d7464fd240b7f0',
    draftUrl: null, // drafts were found but draft URLs use a different format
  },
  {
    taskSubstring: 'Eric financials',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d21cb6ea54d541',
  },
  {
    taskSubstring: 'GeoFence sign-off',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d6a58c78785bd5',
  },
  {
    taskSubstring: 'Creative Rotation',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d690ba1a4667d2',
  },
  {
    taskSubstring: 'Brkthru media',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d747eff2613603',
  },
  {
    taskSubstring: 'Geofence Recs',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d786b081008c6a',
  },
  {
    taskSubstring: 'Adam Weil',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d3f9b25461f8d0',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

async function airtableFetch(path, options = {}) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching tasks from Airtable...');

  // Fetch all non-Done tasks
  let allRecords = [];
  let offset = undefined;
  do {
    const params = new URLSearchParams();
    params.set('fields[]', 'Task');
    params.append('fields[]', 'Thread URL');
    params.append('fields[]', 'Draft URL');
    params.append('fields[]', 'Status');
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);

    const data = await airtableFetch(`?${params.toString()}`);
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  console.log(`Found ${allRecords.length} total records.`);

  // Filter to non-Done tasks and match against our link data
  const updates = [];
  for (const match of LINK_MATCHES) {
    const record = allRecords.find((r) => {
      const task = r.fields?.Task || '';
      const status = r.fields?.Status || '';
      if (status === 'Done') return false;
      return task.toLowerCase().includes(match.taskSubstring.toLowerCase());
    });

    if (!record) {
      console.log(`⚠  No match found for: "${match.taskSubstring}"`);
      continue;
    }

    const existing = record.fields;
    if (existing['Thread URL']) {
      console.log(`✓  Already has Thread URL: "${existing.Task?.substring(0, 50)}"`);
      continue;
    }

    const fields = {};
    if (match.threadUrl) fields['Thread URL'] = match.threadUrl;
    if (match.draftUrl) fields['Draft URL'] = match.draftUrl;

    updates.push({
      id: record.id,
      fields,
      taskName: existing.Task,
    });
  }

  if (updates.length === 0) {
    console.log('\n✅ All tasks already have links or no matches found. Nothing to update.');
    return;
  }

  console.log(`\nUpdating ${updates.length} tasks:\n`);
  for (const u of updates) {
    console.log(`  → ${u.taskName?.substring(0, 60)}`);
    console.log(`    Thread URL: ${u.fields['Thread URL'] || '(none)'}`);
    if (u.fields['Draft URL']) console.log(`    Draft URL: ${u.fields['Draft URL']}`);
  }

  // Airtable batch update (up to 10 at a time)
  const batches = [];
  for (let i = 0; i < updates.length; i += 10) {
    batches.push(updates.slice(i, i + 10));
  }

  for (const batch of batches) {
    const body = {
      records: batch.map((u) => ({
        id: u.id,
        fields: u.fields,
      })),
    };

    await airtableFetch('', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  console.log(`\n✅ Successfully updated ${updates.length} tasks with Gmail links.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
