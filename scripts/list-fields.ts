// scripts/list-fields.ts
// Run with: npx tsx scripts/list-fields.ts
// Lists all field names from your Airtable tables

import { config } from 'dotenv';
config({ path: '.env.local' });

import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID!
);

const TABLES = [
  process.env.AIRTABLE_COMPANIES_TABLE || 'Companies',
  process.env.AIRTABLE_INBOUND_LEADS_TABLE || 'Inbound Leads',
  process.env.AIRTABLE_OPPORTUNITIES_TABLE || 'Opportunities',
  process.env.AIRTABLE_ACTIVITIES_TABLE || 'Activities',
];

async function listFields() {
  for (const tableName of TABLES) {
    console.log(`\n=== ${tableName} ===`);
    try {
      // Get multiple records to find all fields
      const records = await base(tableName).select({ maxRecords: 20 }).all();
      const allFields = new Set<string>();

      for (const record of records) {
        Object.keys(record.fields).forEach((f) => allFields.add(f));
      }

      if (allFields.size > 0) {
        Array.from(allFields).sort().forEach((f) => console.log(`  - ${f}`));
      } else {
        console.log('  (no records - cannot detect fields)');
      }
      console.log(`  (${records.length} records scanned)`);
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

listFields();
