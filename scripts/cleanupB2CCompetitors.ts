#!/usr/bin/env npx tsx
/**
 * cleanupB2CCompetitors.ts
 *
 * Migration script to clean B2C company competitor data.
 *
 * This script identifies B2C retail companies and removes B2B-only competitor types
 * (fractional, internal) that were incorrectly added due to context bleed.
 *
 * Usage:
 *   npx tsx scripts/cleanupB2CCompetitors.ts --dry-run
 *   npx tsx scripts/cleanupB2CCompetitors.ts --execute
 *
 * Options:
 *   --dry-run    Preview changes without updating (default)
 *   --execute    Actually update the context graphs
 *   --limit=N    Process at most N companies (default: all)
 *   --company=X  Only process a specific company ID
 *   --verbose    Show detailed output for all companies
 *
 * Environment Variables Required:
 *   AIRTABLE_API_KEY or AIRTABLE_ACCESS_TOKEN - Airtable credentials
 *   AIRTABLE_BASE_ID - Airtable base ID
 */

import { getAllCompanies, type CompanyRecord } from '../lib/airtable/companies';
import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { loadCompetitorLabContext } from '../app/c/[companyId]/labs/competitor/loadCompetitorLab';
import {
  isB2CCompany,
  B2C_DISALLOWED_COMPETITOR_TYPES,
  validateNoContextBleed,
} from '../lib/competition-v3/b2cRetailClassifier';
import type { QueryContext, CompetitorType } from '../lib/competition-v3/types';

// ============================================================================
// Types
// ============================================================================

interface CleanupCompanyResult {
  companyId: string;
  companyName: string;
  domain: string | null;
  isB2C: boolean;
  hadIssues: boolean;
  beforeCount: number;
  afterCount: number;
  removedCount: number;
  removedCompetitors: Array<{
    name: string;
    type: string;
    reason: string;
  }>;
  error?: string;
}

interface CleanupSummary {
  companiesProcessed: number;
  b2cCompaniesFound: number;
  companiesWithIssues: number;
  totalCompetitorsRemoved: number;
  results: CleanupCompanyResult[];
  errors: string[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal QueryContext from company and graph data for B2C detection
 */
function buildQueryContext(
  company: CompanyRecord,
  graph: any | null
): QueryContext {
  return {
    businessName: company.name,
    domain: company.domain || company.website || null,
    industry: graph?.identity?.industry?.value || company.industry || null,
    businessModel: graph?.identity?.businessModel?.value || null,
    businessModelCategory: graph?.identity?.businessModelCategory?.value || null,
    icpDescription:
      graph?.identity?.icpDescription?.value ||
      graph?.audience?.primaryAudience?.value ||
      null,
    icpStage: null,
    targetIndustries:
      graph?.audience?.segmentDetails?.value
        ?.map((s: any) => s.industry)
        .filter(Boolean) || [],
    primaryOffers: graph?.productOffer?.productLines?.value || [],
    serviceModel: null,
    pricePositioning: null,
    valueProposition: graph?.brand?.valueProps?.value?.[0] || null,
    differentiators: graph?.brand?.differentiators?.value || [],
    geography: graph?.identity?.geographicFootprint?.value || null,
    serviceRegions: [],
    aiOrientation: null,
    invalidCompetitors: graph?.competitive?.invalidCompetitors?.value || [],
  };
}

/**
 * Check if a competitor has a B2B-only type
 */
function hasB2BOnlyType(competitor: any): { has: boolean; type: string | null } {
  // Check businessModelCategory field (primary indicator)
  const bmCategory = competitor.businessModelCategory?.toLowerCase();
  if (bmCategory === 'fractional' || bmCategory === 'internal') {
    return { has: true, type: bmCategory };
  }

  // Check classification.type if present
  const classType = competitor.classification?.type?.toLowerCase();
  if (classType && B2C_DISALLOWED_COMPETITOR_TYPES.includes(classType as CompetitorType)) {
    return { has: true, type: classType };
  }

  // Check category field as fallback
  const category = competitor.category?.toLowerCase();
  if (category === 'fractional' || category === 'internal') {
    return { has: true, type: category };
  }

  return { has: false, type: null };
}

/**
 * Clean competitors for a single company graph
 */
function cleanCompetitorsForGraph(
  graph: any,
  context: QueryContext
): { cleaned: any[]; removed: any[]; reasons: Array<{ name: string; type: string; reason: string }> } {
  const competitors = graph?.competitive?.competitors?.value || [];
  const cleaned: any[] = [];
  const removed: any[] = [];
  const reasons: Array<{ name: string; type: string; reason: string }> = [];

  for (const c of competitors) {
    const { has, type } = hasB2BOnlyType(c);
    if (has) {
      removed.push(c);
      reasons.push({
        name: c.name || 'Unknown',
        type: type || 'unknown',
        reason: `${type} competitor type is B2B-only, not valid for B2C retail`,
      });
    } else {
      cleaned.push(c);
    }
  }

  return { cleaned, removed, reasons };
}

// ============================================================================
// Main Cleanup Function
// ============================================================================

async function cleanupCompany(
  company: CompanyRecord,
  dryRun: boolean,
  verbose: boolean
): Promise<CleanupCompanyResult> {
  const result: CleanupCompanyResult = {
    companyId: company.id,
    companyName: company.name,
    domain: company.domain || company.website || null,
    isB2C: false,
    hadIssues: false,
    beforeCount: 0,
    afterCount: 0,
    removedCount: 0,
    removedCompetitors: [],
  };

  try {
    // Load the context graph
    const graph = await loadContextGraph(company.id);
    if (!graph) {
      if (verbose) {
        console.log(`  [SKIP] No context graph for ${result.companyName}`);
      }
      return result;
    }

    // Build context and check if B2C
    const context = buildQueryContext(company, graph);
    result.isB2C = isB2CCompany(context);

    if (!result.isB2C) {
      if (verbose) {
        console.log(`  [B2B] ${result.companyName} - skipping (not B2C)`);
      }
      return result;
    }

    // Get current competitors
    const competitors = graph?.competitive?.competitors?.value || [];
    result.beforeCount = competitors.length;

    // Clean the competitors
    const { cleaned, removed, reasons } = cleanCompetitorsForGraph(graph, context);

    result.afterCount = cleaned.length;
    result.removedCount = removed.length;
    result.removedCompetitors = reasons;
    result.hadIssues = removed.length > 0;

    if (removed.length === 0) {
      if (verbose) {
        console.log(`  [OK] ${result.companyName} - B2C company, no issues found`);
      }
      return result;
    }

    // Report findings
    console.log(`  [B2C] ${result.companyName}`);
    console.log(`        Domain: ${result.domain || 'none'}`);
    console.log(`        Industry: ${context.industry || 'unknown'}`);
    console.log(`        Competitors: ${result.beforeCount} -> ${result.afterCount}`);
    console.log(`        Removing ${removed.length} B2B-only competitors:`);
    for (const r of reasons) {
      console.log(`          - ${r.name} (${r.type}): ${r.reason}`);
    }

    if (!dryRun) {
      // Update the graph with cleaned competitors
      if (graph.competitive?.competitors) {
        graph.competitive.competitors.value = cleaned;
        graph.competitive.competitors.provenance = [
          {
            source: 'manual',
            updatedAt: new Date().toISOString(),
            confidence: 1.0,
            notes: `[B2C Cleanup Migration] Removed ${removed.length} B2B-only competitor types from B2C company`,
          },
          ...(graph.competitive.competitors.provenance || []).slice(0, 4),
        ];
      }

      // Save the updated graph (use 'manual' as it's a migration/cleanup operation)
      await saveContextGraph(graph, 'manual');
      console.log(`        [SAVED] Updated context graph`);
    } else {
      console.log(`        (dry run - not saved)`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  [ERROR] ${result.companyName}: ${result.error}`);
    return result;
  }
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const verbose = args.includes('--verbose');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
  const companyArg = args.find((a) => a.startsWith('--company='));
  const specificCompanyId = companyArg ? companyArg.split('=')[1] : undefined;

  console.log('='.repeat(60));
  console.log('B2C Competitor Data Cleanup Script');
  console.log('='.repeat(60));
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will update Airtable)'}`
  );
  if (limit !== Infinity) {
    console.log(`Limit: ${limit} companies`);
  }
  if (specificCompanyId) {
    console.log(`Company filter: ${specificCompanyId}`);
  }
  console.log('');

  // Check environment variables
  const apiKey =
    process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('Missing Airtable credentials!');
    console.error('   Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID');
    process.exit(1);
  }

  // Fetch companies
  console.log('Fetching companies from Airtable...');
  let companies: CompanyRecord[];

  try {
    companies = await getAllCompanies();
    console.log(`Fetched ${companies.length} companies`);
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    process.exit(1);
  }

  // Filter to specific company if requested
  if (specificCompanyId) {
    companies = companies.filter((c) => c.id === specificCompanyId);
    if (companies.length === 0) {
      console.error(`Company ${specificCompanyId} not found`);
      process.exit(1);
    }
  }

  // Apply limit
  if (limit !== Infinity && companies.length > limit) {
    companies = companies.slice(0, limit);
    console.log(`Limited to ${limit} companies`);
  }

  console.log('');
  console.log('Processing companies...');
  console.log('');

  // Track results
  const summary: CleanupSummary = {
    companiesProcessed: 0,
    b2cCompaniesFound: 0,
    companiesWithIssues: 0,
    totalCompetitorsRemoved: 0,
    results: [],
    errors: [],
  };

  // Process each company
  for (const company of companies) {
    const result = await cleanupCompany(company, dryRun, verbose);
    summary.results.push(result);
    summary.companiesProcessed++;

    if (result.isB2C) {
      summary.b2cCompaniesFound++;
    }
    if (result.hadIssues) {
      summary.companiesWithIssues++;
      summary.totalCompetitorsRemoved += result.removedCount;
    }
    if (result.error) {
      summary.errors.push(`${result.companyName}: ${result.error}`);
    }

    // Progress indicator
    if (summary.companiesProcessed % 10 === 0) {
      console.log(`... processed ${summary.companiesProcessed}/${companies.length} companies`);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Companies processed: ${summary.companiesProcessed}`);
  console.log(`B2C companies found: ${summary.b2cCompaniesFound}`);
  console.log(`Companies with issues: ${summary.companiesWithIssues}`);
  console.log(`Total competitors removed: ${summary.totalCompetitorsRemoved}`);

  if (summary.companiesWithIssues > 0) {
    console.log('');
    console.log('Companies that had B2B competitors removed:');
    for (const r of summary.results.filter((r) => r.hadIssues)) {
      console.log(`  - ${r.companyName}: removed ${r.removedCount} competitor(s)`);
      for (const c of r.removedCompetitors) {
        console.log(`      ${c.name} (${c.type})`);
      }
    }
  }

  if (summary.errors.length > 0) {
    console.log('');
    console.log('Errors encountered:');
    for (const e of summary.errors) {
      console.log(`  - ${e}`);
    }
  }

  if (dryRun && summary.companiesWithIssues > 0) {
    console.log('');
    console.log('Run with --execute to apply these changes.');
  }

  console.log('='.repeat(60));
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
