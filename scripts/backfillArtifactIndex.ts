#!/usr/bin/env npx tsx
/**
 * backfillArtifactIndex.ts
 *
 * Backfill script to populate the CompanyArtifactIndex table with all existing
 * diagnostic runs and artifacts.
 *
 * The CompanyArtifactIndex is the canonical index of ALL artifacts for the
 * Documents UI. This script ensures all historical artifacts are indexed.
 *
 * IMPORTANT: For Website Lab runs, this script:
 * 1. Normalizes rawJson using normalizeWebsiteLabRun()
 * 2. Lifts v5Diagnostic to top-level
 * 3. Creates CompanyArtifactIndex record with canonical href
 *
 * This script is IDEMPOTENT: running twice creates no duplicates.
 *
 * Usage:
 *   # Single company (recommended for testing):
 *   pnpm tsx scripts/backfillArtifactIndex.ts recuvxGlTSVt8sqvJ
 *
 *   # Dry run (preview only):
 *   npx tsx scripts/backfillArtifactIndex.ts --dry-run
 *
 *   # Execute (create records):
 *   npx tsx scripts/backfillArtifactIndex.ts --execute
 *
 * Options:
 *   --dry-run    Preview changes without creating index records (default)
 *   --execute    Actually create index records in Airtable
 *   --company=X  Only process a specific company ID
 *   --limit=N    Process at most N companies (default: unlimited)
 *   COMPANY_ID   Positional arg: process only this company (same as --company=)
 *
 * Environment Variables Required:
 *   AIRTABLE_API_KEY or AIRTABLE_ACCESS_TOKEN - Airtable credentials
 *   AIRTABLE_BASE_ID - Airtable base ID
 */

import { getAllCompanies, getCompanyById } from '@/lib/airtable/companies';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { listDiagnosticRunsForCompany, getDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { indexArtifactsForRun, indexArtifactFromArtifact } from '@/lib/os/artifacts/indexer';
import { normalizeWebsiteLabRun, hasV5Diagnostic } from '@/lib/os/diagnostics/websiteLabNormalizer';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Progress Tracking
// ============================================================================

interface BackfillStats {
  companiesProcessed: number;
  runsProcessed: number;
  runsIndexed: number;
  runsSkipped: number;
  websiteLabRuns: number;
  websiteLabV5Found: number;
  websiteLabV5Missing: number;
  artifactsProcessed: number;
  artifactsIndexed: number;
  artifactsSkipped: number;
  errors: string[];
}

function createStats(): BackfillStats {
  return {
    companiesProcessed: 0,
    runsProcessed: 0,
    runsIndexed: 0,
    runsSkipped: 0,
    websiteLabRuns: 0,
    websiteLabV5Found: 0,
    websiteLabV5Missing: 0,
    artifactsProcessed: 0,
    artifactsIndexed: 0,
    artifactsSkipped: 0,
    errors: [],
  };
}

// ============================================================================
// Backfill Functions
// ============================================================================

/**
 * Backfill diagnostic runs for a company
 */
async function backfillRunsForCompany(
  companyId: string,
  dryRun: boolean,
  stats: BackfillStats
): Promise<void> {
  console.log(`  [Runs] Fetching runs for company ${companyId}...`);

  // Fetch all runs for this company (no limit for backfill)
  const runs = await listDiagnosticRunsForCompany(companyId, { limit: 500 });
  console.log(`  [Runs] Found ${runs.length} runs`);

  for (const run of runs) {
    stats.runsProcessed++;

    // Skip non-complete runs
    if (run.status !== 'complete') {
      stats.runsSkipped++;
      continue;
    }

    if (dryRun) {
      // For Website Lab, check if V5 exists
      if (run.toolId === 'websiteLab') {
        stats.websiteLabRuns++;
        const fullRun = await getDiagnosticRun(run.id);
        if (fullRun?.rawJson) {
          const hasV5 = hasV5Diagnostic(fullRun.rawJson);
          if (hasV5) {
            stats.websiteLabV5Found++;
            console.log(`    [DRY RUN] Would index Website Lab V5: ${run.id}`);
          } else {
            stats.websiteLabV5Missing++;
            console.log(`    [DRY RUN] Would index Website Lab (V5 MISSING): ${run.id}`);
          }
        }
      } else {
        console.log(`    [DRY RUN] Would index run: ${run.id} (${run.toolId})`);
      }
      stats.runsIndexed++;
    } else {
      try {
        // Need to fetch the full run with rawJson for indexing
        const fullRun = await getDiagnosticRun(run.id);
        if (!fullRun) {
          stats.errors.push(`Run ${run.id} not found when fetching full details`);
          continue;
        }

        // For Website Lab, normalize the rawJson to lift V5 to top level
        if (fullRun.toolId === 'websiteLab' && fullRun.rawJson) {
          stats.websiteLabRuns++;
          const normalized = normalizeWebsiteLabRun(fullRun.rawJson, {
            runId: fullRun.id,
            companyId,
          });
          if (normalized.v5Diagnostic) {
            stats.websiteLabV5Found++;
            console.log(`    [Website Lab V5] Score: ${normalized.v5Diagnostic.score}/100, Issues: ${normalized.v5Diagnostic.blockingIssues?.length || 0}`);
          } else {
            stats.websiteLabV5Missing++;
            console.log(`    [Website Lab] V5 NOT FOUND - legacy only`);
          }
          // Note: We don't persist the normalized data here, just index with canonical URL
        }

        const result = await indexArtifactsForRun(companyId, fullRun);
        if (result.ok) {
          stats.runsIndexed += result.indexed;
          stats.runsSkipped += result.skipped;
        } else {
          stats.errors.push(...result.errors);
        }
      } catch (error) {
        stats.errors.push(`Error indexing run ${run.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }
}

/**
 * Backfill artifacts for a company
 */
async function backfillArtifactsForCompany(
  companyId: string,
  dryRun: boolean,
  stats: BackfillStats
): Promise<void> {
  console.log(`  [Artifacts] Fetching artifacts for company ${companyId}...`);

  const artifacts = await getArtifactsForCompany(companyId);
  console.log(`  [Artifacts] Found ${artifacts.length} artifacts`);

  for (const artifact of artifacts) {
    stats.artifactsProcessed++;

    if (dryRun) {
      console.log(`    [DRY RUN] Would index artifact: ${artifact.id} (${artifact.type})`);
      stats.artifactsIndexed++;
    } else {
      try {
        const indexed = await indexArtifactFromArtifact(artifact);
        if (indexed) {
          stats.artifactsIndexed++;
        } else {
          stats.artifactsSkipped++;
        }
      } catch (error) {
        stats.errors.push(`Error indexing artifact ${artifact.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }
}

/**
 * Backfill all artifacts for a company
 */
async function backfillCompany(
  companyId: string,
  companyName: string,
  dryRun: boolean,
  stats: BackfillStats
): Promise<void> {
  console.log(`\n[Company] Processing: ${companyName} (${companyId})`);

  await backfillRunsForCompany(companyId, dryRun, stats);
  await backfillArtifactsForCompany(companyId, dryRun, stats);

  stats.companiesProcessed++;
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  // Support both --company=X and positional arg
  const companyArg = args.find((a) => a.startsWith('--company='));
  const positionalArg = args.find((a) => !a.startsWith('--') && a.length > 0);
  const targetCompanyId = companyArg
    ? companyArg.split('=')[1]
    : positionalArg || undefined;

  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('='.repeat(70));
  console.log('CompanyArtifactIndex Backfill Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will create index records)'}`);
  if (targetCompanyId) {
    console.log(`Company filter: ${targetCompanyId}`);
  }
  if (limit) {
    console.log(`Limit: ${limit} companies`);
  }
  console.log('');

  // Check environment variables
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('❌ Missing Airtable credentials!');
    console.error('   Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID');
    process.exit(1);
  }

  const stats = createStats();

  try {
    // Fetch companies
    console.log('Fetching companies from Airtable...');
    let companies = await getAllCompanies();
    console.log(`✅ Found ${companies.length} companies`);

    // Apply filters
    if (targetCompanyId) {
      companies = companies.filter(c => c.id === targetCompanyId);
      if (companies.length === 0) {
        console.error(`❌ Company not found: ${targetCompanyId}`);
        process.exit(1);
      }
    }

    if (limit && limit > 0) {
      companies = companies.slice(0, limit);
    }

    console.log(`Processing ${companies.length} companies...`);

    // Process each company
    for (const company of companies) {
      await backfillCompany(company.id, company.name, dryRun, stats);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print summary
    console.log('');
    console.log('='.repeat(70));
    console.log('Summary:');
    console.log('='.repeat(70));
    console.log(`Companies processed:  ${stats.companiesProcessed}`);
    console.log('');
    console.log('Diagnostic Runs:');
    console.log(`  Processed:          ${stats.runsProcessed}`);
    console.log(`  Indexed:            ${stats.runsIndexed}`);
    console.log(`  Skipped:            ${stats.runsSkipped}`);
    console.log('');
    console.log('Website Lab Runs:');
    console.log(`  Total:              ${stats.websiteLabRuns}`);
    console.log(`  V5 Found:           ${stats.websiteLabV5Found}`);
    console.log(`  V5 Missing:         ${stats.websiteLabV5Missing}`);
    console.log('');
    console.log('Artifacts:');
    console.log(`  Processed:          ${stats.artifactsProcessed}`);
    console.log(`  Indexed:            ${stats.artifactsIndexed}`);
    console.log(`  Skipped:            ${stats.artifactsSkipped}`);

    if (stats.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const error of stats.errors.slice(0, 10)) {
        console.log(`  ❌ ${error}`);
      }
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    if (dryRun) {
      console.log('');
      console.log('Run with --execute to create index records.');
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
