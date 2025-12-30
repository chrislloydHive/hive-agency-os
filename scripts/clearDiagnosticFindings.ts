#!/usr/bin/env npx tsx
/**
 * Clear diagnostic findings for a company
 *
 * Usage: npx tsx scripts/clearDiagnosticFindings.ts <companyId>
 *
 * This will delete all unconverted diagnostic findings for the specified company,
 * which clears the "Suggested Actions" on the Work page.
 */

import { getBase } from '../lib/airtable';

const DIAGNOSTIC_DETAILS_TABLE = 'Diagnostic Details';

async function clearDiagnosticFindings(companyId: string) {
  console.log(`[Cleanup] Clearing diagnostic findings for company: ${companyId}`);

  const base = getBase();

  // Find all unconverted findings for this company
  const records = await base(DIAGNOSTIC_DETAILS_TABLE)
    .select({
      filterByFormula: `AND(
        {Company ID} = "${companyId}",
        NOT({Is Converted to Work Item})
      )`,
    })
    .all();

  console.log(`[Cleanup] Found ${records.length} unconverted findings to delete`);

  if (records.length === 0) {
    console.log('[Cleanup] No findings to delete');
    return;
  }

  // Delete in batches of 10 (Airtable limit)
  const batchSize = 10;
  let deleted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const ids = batch.map(r => r.id);

    await base(DIAGNOSTIC_DETAILS_TABLE).destroy(ids);
    deleted += ids.length;
    console.log(`[Cleanup] Deleted ${deleted}/${records.length} findings`);
  }

  console.log(`[Cleanup] Done! Deleted ${deleted} diagnostic findings`);
  console.log('[Cleanup] Suggested Actions will now be empty for this company');
}

// Get company ID from command line
const companyId = process.argv[2];

if (!companyId) {
  console.error('Usage: npx tsx scripts/clearDiagnosticFindings.ts <companyId>');
  console.error('Example: npx tsx scripts/clearDiagnosticFindings.ts reckKOcbJMkthplsW');
  process.exit(1);
}

clearDiagnosticFindings(companyId).catch(console.error);
