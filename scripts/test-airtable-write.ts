// scripts/test-airtable-write.ts
// Quick test to verify Airtable write permissions

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local (Next.js style)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
const baseId = process.env.AIRTABLE_BASE_ID || '';

console.log('API Key preview:', apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '(empty)');
console.log('Base ID:', baseId || '(empty)');

if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);

async function test() {
  try {
    // Read test
    console.log('\n1. Testing READ...');
    const records = await base('Companies').select({ maxRecords: 1 }).firstPage();
    if (records.length === 0) {
      console.error('No records found in Companies table');
      process.exit(1);
    }
    console.log('✅ Read works, record:', records[0].id);
    console.log('   Company Name:', records[0].fields['Company Name']);

    // Write test - update with same value (no-op but tests permissions)
    console.log('\n2. Testing WRITE...');
    const name = (records[0].fields['Company Name'] as string) || 'Test';
    await base('Companies').update(records[0].id, { 'Company Name': name });
    console.log('✅ Write works!');

  } catch (e: any) {
    console.error('❌ Error:', e.message);
    if (e.error) {
      console.error('   Airtable error:', e.error);
    }
    if (e.statusCode) {
      console.error('   Status code:', e.statusCode);
    }
  }
}

test();
