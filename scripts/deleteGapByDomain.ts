// scripts/deleteGapByDomain.ts
// One-time script to delete GAP records by domain

import { config } from 'dotenv';
// Load both .env and .env.local
config({ path: '.env' });
config({ path: '.env.local' });

import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY/AIRTABLE_ACCESS_TOKEN or AIRTABLE_BASE_ID');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('AIRTABLE')));
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);

async function main() {
  const domain = process.argv[2] || 'hiveadagency';
  console.log(`Searching for GAP records with domain containing: ${domain}\n`);

  const tablesToSearch = [
    { name: 'GAP-Plan Run', urlField: 'URL' },
    { name: 'GAP-IA Run', urlField: 'Website URL' },
  ];

  let totalDeleted = 0;

  for (const { name, urlField } of tablesToSearch) {
    console.log(`\n--- ${name} ---`);

    try {
      const records = await base(name)
        .select({
          filterByFormula: `FIND("${domain}", {${urlField}})`,
        })
        .all();

      console.log(`Found ${records.length} record(s)`);

      for (const record of records) {
        const url = record.fields[urlField] as string || 'unknown';
        console.log(`  Deleting ${record.id} (${url})...`);

        try {
          await base(name).destroy(record.id);
          console.log(`    ✓ Deleted`);
          totalDeleted++;
        } catch (deleteError) {
          console.log(`    ✗ Failed: ${deleteError}`);
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (tableError) {
      console.log(`  ⚠ Error querying table: ${tableError}`);
    }
  }

  console.log(`\n=== Done! Deleted ${totalDeleted} GAP record(s) ===`);
}

main().catch(console.error);
