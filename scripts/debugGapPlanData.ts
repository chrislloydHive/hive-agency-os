#!/usr/bin/env npx tsx
// scripts/debugGapPlanData.ts
// Debug script to examine GAP Plan run data structure
//
// Usage: npx tsx scripts/debugGapPlanData.ts <companyId>

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getTableName } from '../lib/airtable/tables';

async function main() {
  const companyId = process.argv[2] || 'recsLaV1ScPnfeYU8';

  console.log('\n=== GAP PLAN DATA DEBUG ===\n');
  console.log('Company ID:', companyId);

  const tableName = getTableName('GAP_PLAN_RUN', 'AIRTABLE_GAP_PLAN_RUN_TABLE');
  console.log('Table:', tableName);

  // Use Airtable SDK directly to get full record with Data JSON
  const { base } = await import('../lib/airtable/client');

  const allRecords = await base(tableName)
    .select({
      maxRecords: 100,
      sort: [{ field: 'Created At', direction: 'desc' }],
    })
    .firstPage();

  console.log('Total GAP Plan records:', allRecords.length);

  // Filter for matching company
  const matchedRecords = allRecords.filter((record) => {
    const fields = record.fields;
    const companyField = fields['Company'];
    const companyIdField = fields['Company ID'] as string | undefined;

    return (Array.isArray(companyField) && companyField.includes(companyId)) ||
           (companyIdField && companyIdField === companyId);
  });

  console.log('Matched records for company:', matchedRecords.length);

  if (matchedRecords.length === 0) {
    console.log('No GAP Plan records found for this company');
    return;
  }

  // Analyze the first record with Data JSON
  for (const record of matchedRecords.slice(0, 2)) {
    console.log('\n--- Record', record.id, '---');
    const fields = record.fields;

    console.log('Status:', fields['Status']);
    console.log('Created At:', fields['Created At']);
    console.log('Overall Score:', fields['Overall Score']);
    console.log('URL:', fields['URL']);

    const dataJson = fields['Data JSON'] as string | undefined;
    if (dataJson) {
      console.log('Data JSON length:', dataJson.length, 'chars');

      try {
        const parsed = JSON.parse(dataJson);
        console.log('\n=== Data JSON Structure ===');
        console.log('Top-level keys:', Object.keys(parsed));

        // Print key subsections
        if (parsed.companyName) console.log('companyName:', parsed.companyName);
        if (parsed.url) console.log('url:', parsed.url);
        if (parsed.overallScore !== undefined) console.log('overallScore:', parsed.overallScore);
        if (parsed.maturityStage) console.log('maturityStage:', parsed.maturityStage);

        // Check for plan sections
        if (parsed.plan) {
          console.log('\n--- plan section ---');
          console.log('plan keys:', Object.keys(parsed.plan));
        }

        if (parsed.quickWins) {
          console.log('\n--- quickWins section ---');
          console.log('quickWins count:', Array.isArray(parsed.quickWins) ? parsed.quickWins.length : 'not array');
          if (Array.isArray(parsed.quickWins) && parsed.quickWins[0]) {
            console.log('quickWins[0] keys:', Object.keys(parsed.quickWins[0]));
          }
        }

        if (parsed.initiatives) {
          console.log('\n--- initiatives section ---');
          console.log('initiatives count:', Array.isArray(parsed.initiatives) ? parsed.initiatives.length : 'not array');
          if (Array.isArray(parsed.initiatives) && parsed.initiatives[0]) {
            console.log('initiatives[0] keys:', Object.keys(parsed.initiatives[0]));
          }
        }

        if (parsed.dimensions) {
          console.log('\n--- dimensions section ---');
          console.log('dimensions keys:', Object.keys(parsed.dimensions));
          for (const [key, value] of Object.entries(parsed.dimensions)) {
            if (value && typeof value === 'object') {
              console.log(`  ${key}:`, Object.keys(value as object));
            }
          }
        }

        if (parsed.analysis) {
          console.log('\n--- analysis section ---');
          console.log('analysis keys:', Object.keys(parsed.analysis));
        }

        if (parsed.competitors) {
          console.log('\n--- competitors section ---');
          console.log('competitors count:', Array.isArray(parsed.competitors) ? parsed.competitors.length : 'not array');
          if (Array.isArray(parsed.competitors) && parsed.competitors[0]) {
            console.log('competitors[0]:', parsed.competitors[0]);
          }
        }

        if (parsed.icp || parsed.idealCustomerProfile) {
          console.log('\n--- ICP section ---');
          const icp = parsed.icp || parsed.idealCustomerProfile;
          console.log('ICP:', typeof icp === 'string' ? icp.substring(0, 200) : JSON.stringify(icp).substring(0, 200));
        }

        if (parsed.valueProposition || parsed.valueProp) {
          console.log('\n--- Value Proposition section ---');
          const vp = parsed.valueProposition || parsed.valueProp;
          console.log('Value Prop:', typeof vp === 'string' ? vp.substring(0, 200) : JSON.stringify(vp).substring(0, 200));
        }

        if (parsed.positioning) {
          console.log('\n--- positioning section ---');
          console.log('positioning:', typeof parsed.positioning === 'string' ? parsed.positioning.substring(0, 200) : JSON.stringify(parsed.positioning).substring(0, 200));
        }

        // Print full structure for inspection
        console.log('\n=== FULL STRUCTURE (first 3000 chars) ===');
        console.log(JSON.stringify(parsed, null, 2).substring(0, 3000));

      } catch (e) {
        console.log('Failed to parse Data JSON:', e);
        console.log('Raw Data JSON (first 500 chars):', dataJson.substring(0, 500));
      }
    } else {
      console.log('No Data JSON field');
    }
  }

  console.log('\n=== END DEBUG ===\n');
}

main().catch(console.error);
