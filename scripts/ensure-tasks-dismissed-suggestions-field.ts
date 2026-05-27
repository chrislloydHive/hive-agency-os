// scripts/ensure-tasks-dismissed-suggestions-field.ts
// Adds the Tasks "Dismissed Suggestions" long-text column if missing (Meta API).
//
// Run: npx tsx scripts/ensure-tasks-dismissed-suggestions-field.ts

import './_loadDotenv';
import { resolveTasksBaseId } from '@/lib/airtable/bases';

const FIELD_NAME = 'Dismissed Suggestions';

function tasksTableIdentifier(): string {
  return (
    process.env.AIRTABLE_TASKS_TABLE_ID?.trim() ||
    process.env.AIRTABLE_TASKS_TABLE?.trim() ||
    'Tasks'
  );
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY?.trim();
  if (!apiKey) throw new Error('AIRTABLE_API_KEY is required');

  const baseId = resolveTasksBaseId();
  if (!baseId) {
    throw new Error(
      'Tasks base not configured. Set AIRTABLE_OS_BASE_ID or AIRTABLE_TASKS_BASE_ID.',
    );
  }

  const tableRef = tasksTableIdentifier();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers,
  });
  if (!tablesRes.ok) {
    throw new Error(`Meta API list tables failed (${tablesRes.status}): ${await tablesRes.text()}`);
  }

  const { tables } = (await tablesRes.json()) as {
    tables?: Array<{ id: string; name: string; fields?: Array<{ name: string }> }>;
  };
  const table = tables?.find((t) => t.id === tableRef || t.name === tableRef);
  if (!table) {
    throw new Error(`Tasks table not found in base ${baseId}: ${tableRef}`);
  }

  const exists = (table.fields ?? []).some((f) => f.name === FIELD_NAME);
  if (exists) {
    console.log(`✓ "${FIELD_NAME}" already exists on ${table.name} (${table.id})`);
    return;
  }

  const createRes = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: FIELD_NAME,
        type: 'multilineText',
        description:
          'JSON array of dismissed AI suggestion fingerprints — prevents sync from re-proposing the same action.',
      }),
    },
  );

  if (!createRes.ok) {
    throw new Error(
      `Meta API create field failed (${createRes.status}): ${await createRes.text()}`,
    );
  }

  const created = (await createRes.json()) as { id: string; name: string };
  console.log(`✓ Created "${created.name}" (${created.id}) on ${table.name}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
