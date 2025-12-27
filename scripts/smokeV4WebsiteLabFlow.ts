#!/usr/bin/env npx tsx
// scripts/smokeV4WebsiteLabFlow.ts
// Smoke test for V4 WebsiteLab proposal flow
//
// Usage:
//   npx tsx scripts/smokeV4WebsiteLabFlow.ts <companyId>
//   npx tsx scripts/smokeV4WebsiteLabFlow.ts <companyId> --confirm
//
// This script:
// 1. Finds the latest WebsiteLab diagnostic run for the company
// 2. Builds V4 proposal candidates from the rawJson
// 3. Proposes fields to the V4 Review Queue
// 4. Optionally auto-confirms 3 fields (with --confirm flag)
//
// Requirements:
// - CONTEXT_V4_ENABLED=true in .env.local
// - Valid AIRTABLE_API_KEY and AIRTABLE_BASE_ID

import 'dotenv/config';

// Verify V4 is enabled
if (process.env.CONTEXT_V4_ENABLED !== 'true' && process.env.CONTEXT_V4_ENABLED !== '1') {
  console.error('Error: CONTEXT_V4_ENABLED must be true');
  console.error('Set CONTEXT_V4_ENABLED=true in your .env.local file');
  process.exit(1);
}

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  buildWebsiteLabCandidates,
  proposeFromLabResult,
} from '@/lib/contextGraph/v4';
import { getProposedFieldsV4, confirmFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';

// ============================================================================
// CLI Parsing
// ============================================================================

const args = process.argv.slice(2);
const companyIdArg = args.find((arg) => !arg.startsWith('--'));
const shouldConfirm = args.includes('--confirm');

if (!companyIdArg) {
  console.error('Usage: npx tsx scripts/smokeV4WebsiteLabFlow.ts <companyId> [--confirm]');
  console.error('');
  console.error('Options:');
  console.error('  --confirm    Auto-confirm 3 proposed fields after proposal');
  process.exit(1);
}

const companyId: string = companyIdArg;

console.log('='.repeat(60));
console.log('V4 WebsiteLab Smoke Test');
console.log('='.repeat(60));
console.log(`Company ID: ${companyId}`);
console.log(`Auto-confirm: ${shouldConfirm}`);
console.log('');

// ============================================================================
// Step 1: Find latest WebsiteLab diagnostic run
// ============================================================================

async function findLatestWebsiteLabRun(companyId: string): Promise<{
  id: string;
  rawJson: unknown;
  createdAt: string;
} | null> {
  console.log('Step 1: Finding latest WebsiteLab diagnostic run...');

  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.DIAGNOSTIC_RUNS)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", {Tool ID} = "websiteLab", {Status} = "complete")`,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      console.log('  No WebsiteLab runs found for this company');
      return null;
    }

    const record = records[0];
    const rawJsonStr = record.fields['Raw JSON'] as string;
    const rawJson = rawJsonStr ? JSON.parse(rawJsonStr) : null;

    console.log(`  Found run: ${record.id}`);
    console.log(`  Created: ${record.fields['Created At']}`);

    return {
      id: record.id,
      rawJson,
      createdAt: record.fields['Created At'] as string,
    };
  } catch (error) {
    console.error('  Error finding run:', error);
    return null;
  }
}

// ============================================================================
// Step 2: Build candidates
// ============================================================================

function buildCandidates(rawJson: unknown) {
  console.log('\nStep 2: Building V4 proposal candidates...');

  const result = buildWebsiteLabCandidates(rawJson);

  console.log(`  Extraction path: ${result.extractionPath}`);
  console.log(`  Raw keys found: ${result.rawKeysFound}`);
  console.log(`  Candidates: ${result.candidates.length}`);
  console.log(`  Skipped (wrong domain): ${result.skipped.wrongDomain}`);
  console.log(`  Skipped (empty value): ${result.skipped.emptyValue}`);

  if (result.candidates.length > 0) {
    console.log('\n  Sample candidates:');
    result.candidates.slice(0, 5).forEach((c) => {
      const valuePreview =
        typeof c.value === 'string'
          ? c.value.slice(0, 50) + (c.value.length > 50 ? '...' : '')
          : JSON.stringify(c.value).slice(0, 50);
      console.log(`    - ${c.key}: ${valuePreview}`);
    });
  }

  if (result.skippedWrongDomainKeys.length > 0) {
    console.log('\n  Skipped (cross-domain):');
    result.skippedWrongDomainKeys.slice(0, 5).forEach((key) => {
      console.log(`    - ${key}`);
    });
  }

  return result;
}

// ============================================================================
// Step 3: Propose fields
// ============================================================================

async function proposeFields(
  companyId: string,
  runId: string,
  candidates: ReturnType<typeof buildWebsiteLabCandidates>
) {
  console.log('\nStep 3: Proposing fields to V4 Review Queue...');

  const result = await proposeFromLabResult({
    companyId,
    importerId: 'websiteLab',
    source: 'lab',
    sourceId: runId,
    extractionPath: candidates.extractionPath,
    candidates: candidates.candidates,
  });

  console.log(`  Proposed: ${result.proposed}`);
  console.log(`  Blocked: ${result.blocked}`);
  console.log(`  Replaced: ${result.replaced}`);
  console.log(`  Errors: ${result.errors.length}`);

  if (result.proposedKeys.length > 0) {
    console.log('\n  Proposed keys:');
    result.proposedKeys.slice(0, 10).forEach((key) => {
      console.log(`    - ${key}`);
    });
  }

  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach((err) => {
      console.log(`    - ${err}`);
    });
  }

  return result;
}

// ============================================================================
// Step 4: Auto-confirm (optional)
// ============================================================================

async function autoConfirmFields(companyId: string) {
  console.log('\nStep 4: Auto-confirming 3 fields...');

  // Get proposed fields
  const proposed = await getProposedFieldsV4(companyId);

  if (proposed.length === 0) {
    console.log('  No proposed fields to confirm');
    return;
  }

  // Confirm first 3
  const keysToConfirm = proposed.slice(0, 3).map((f) => f.key);
  console.log(`  Keys to confirm: ${keysToConfirm.join(', ')}`);

  const result = await confirmFieldsV4(companyId, keysToConfirm, { confirmedBy: 'smoke-test' });

  console.log(`  Confirmed: ${result.confirmed?.length ?? 0}`);
  console.log(`  Failed: ${result.failed?.length ?? 0}`);

  if (result.confirmed && result.confirmed.length > 0) {
    console.log('\n  Confirmed keys:');
    result.confirmed.forEach((key) => {
      console.log(`    - ${key}`);
    });
  }
}

// ============================================================================
// Step 5: Verify Review Queue
// ============================================================================

async function verifyReviewQueue(companyId: string) {
  console.log('\nStep 5: Verifying Review Queue...');

  const proposed = await getProposedFieldsV4(companyId);

  console.log(`  Total proposed fields: ${proposed.length}`);

  if (proposed.length > 0) {
    // Group by domain
    const byDomain: Record<string, number> = {};
    proposed.forEach((f) => {
      byDomain[f.domain] = (byDomain[f.domain] || 0) + 1;
    });

    console.log('\n  By domain:');
    Object.entries(byDomain).forEach(([domain, count]) => {
      console.log(`    - ${domain}: ${count}`);
    });

    // Group by source
    const byImporter: Record<string, number> = {};
    proposed.forEach((f) => {
      const importer = f.evidence?.importerId || 'unknown';
      byImporter[importer] = (byImporter[importer] || 0) + 1;
    });

    console.log('\n  By importer:');
    Object.entries(byImporter).forEach(([importer, count]) => {
      console.log(`    - ${importer}: ${count}`);
    });
  }

  console.log(`\n  Review Queue URL: /context-v4/${companyId}/review`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    // Step 1: Find run
    const run = await findLatestWebsiteLabRun(companyId);
    if (!run) {
      console.error('\nNo WebsiteLab run found. Run a WebsiteLab diagnostic first.');
      process.exit(1);
    }

    // Step 2: Build candidates
    const candidates = buildCandidates(run.rawJson);
    if (candidates.candidates.length === 0) {
      console.error('\nNo candidates found. Check the rawJson structure.');
      process.exit(1);
    }

    // Step 3: Propose fields
    await proposeFields(companyId, run.id, candidates);

    // Step 4: Auto-confirm (optional)
    if (shouldConfirm) {
      await autoConfirmFields(companyId);
    }

    // Step 5: Verify
    await verifyReviewQueue(companyId);

    console.log('\n' + '='.repeat(60));
    console.log('Smoke test complete!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
