// scripts/migrate/normalizeContextGraphs.ts
// Migration Script: Normalize existing context graphs
//
// This script normalizes existing context graphs by:
// - Stripping empty fields ({} and { value: null } pollution)
// - Optionally re-importing from latest Lab runs (respects humanConfirmed)
//
// Usage:
//   npx ts-node scripts/migrate/normalizeContextGraphs.ts --dry-run
//   npx ts-node scripts/migrate/normalizeContextGraphs.ts --apply
//   npx ts-node scripts/migrate/normalizeContextGraphs.ts --apply --companyId=abc123
//   npx ts-node scripts/migrate/normalizeContextGraphs.ts --apply --reimport-labs

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { hydrateContextFromHistory } from '@/lib/contextGraph/importers/registry';
import { calculateCompleteness } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

interface MigrationOptions {
  dryRun: boolean;
  companyId?: string;
  reimportLabs?: boolean;
}

interface CompanyMigrationResult {
  companyId: string;
  companyName: string;
  fieldsStripped: number;
  blockedWrites: number;
  labsReimported: number;
  completenessBeforePercent: number;
  completenessAfterPercent: number;
  changed: boolean;
  errors: string[];
}

interface MigrationReport {
  companiesScanned: number;
  graphsChanged: number;
  fieldsStripped: number;
  blockedWrites: number;
  labsReimported: number;
  errors: string[];
}

// ============================================================================
// Normalization Logic
// ============================================================================

/**
 * Check if a value is effectively empty
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) return true;
  return false;
}

/**
 * Strip empty fields from a context graph (recursive)
 * Returns { stripped, fieldsRemoved }
 */
function stripEmptyFieldsRecursive(obj: unknown, depth = 0): { stripped: unknown; fieldsRemoved: number } {
  // Prevent infinite recursion
  if (depth > 20) return { stripped: obj, fieldsRemoved: 0 };

  // Handle non-objects
  if (obj === null || obj === undefined) return { stripped: undefined, fieldsRemoved: 0 };
  if (typeof obj !== 'object') return { stripped: obj, fieldsRemoved: 0 };

  // Handle arrays
  if (Array.isArray(obj)) {
    let totalRemoved = 0;
    const filtered = obj
      .map(item => {
        const result = stripEmptyFieldsRecursive(item, depth + 1);
        totalRemoved += result.fieldsRemoved;
        return result.stripped;
      })
      .filter(item => item !== undefined && !isEmptyValue(item));

    return {
      stripped: filtered.length === 0 ? undefined : filtered,
      fieldsRemoved: totalRemoved + (obj.length - filtered.length),
    };
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  let hasContent = false;
  let totalRemoved = 0;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Keep meta fields
    if (key === 'meta') {
      result[key] = value;
      hasContent = true;
      continue;
    }

    // Check for WithMeta field structure
    if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
      const withMeta = value as { value: unknown; provenance?: unknown[] };

      // If value is empty, track as removed
      if (isEmptyValue(withMeta.value)) {
        totalRemoved++;
        continue;
      }

      // Keep non-empty WithMeta fields
      result[key] = value;
      hasContent = true;
      continue;
    }

    // Recursively process nested objects
    const { stripped, fieldsRemoved } = stripEmptyFieldsRecursive(value, depth + 1);
    totalRemoved += fieldsRemoved;

    // Skip if result is undefined or empty
    if (stripped === undefined) continue;
    if (isEmptyValue(stripped)) {
      totalRemoved++;
      continue;
    }

    result[key] = stripped;
    hasContent = true;
  }

  return {
    stripped: hasContent ? result : undefined,
    fieldsRemoved: totalRemoved,
  };
}

/**
 * Normalize a single context graph
 */
function normalizeGraph(graph: Record<string, unknown>): {
  normalized: Record<string, unknown>;
  fieldsStripped: number;
} {
  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs', 'social',
    'capabilities',
  ];

  let totalStripped = 0;
  const normalized = { ...graph };

  for (const domain of domains) {
    if (normalized[domain]) {
      const { stripped, fieldsRemoved } = stripEmptyFieldsRecursive(normalized[domain]);
      totalStripped += fieldsRemoved;

      if (stripped === undefined) {
        // Keep domain as empty object if all fields stripped
        normalized[domain] = {};
      } else {
        normalized[domain] = stripped;
      }
    }
  }

  return { normalized, fieldsStripped: totalStripped };
}

// ============================================================================
// Company Migration
// ============================================================================

/**
 * Migrate a single company's context graph
 */
async function migrateCompany(
  base: ReturnType<typeof getBase>,
  record: any,
  options: MigrationOptions
): Promise<CompanyMigrationResult> {
  const companyId = record.get('Company ID') as string;
  const companyName = record.get('Company Name') as string || 'Unknown';
  const graphJson = record.get('Graph JSON') as string;
  const existingCompleteness = record.get('Completeness Score') as number || 0;

  const result: CompanyMigrationResult = {
    companyId,
    companyName,
    fieldsStripped: 0,
    blockedWrites: 0,
    labsReimported: 0,
    completenessBeforePercent: existingCompleteness,
    completenessAfterPercent: existingCompleteness,
    changed: false,
    errors: [],
  };

  if (!graphJson) {
    result.errors.push('No Graph JSON found');
    return result;
  }

  try {
    const originalGraph = JSON.parse(graphJson);
    const originalJsonStr = JSON.stringify(originalGraph, null, 0);

    // Step 1: Normalize (strip empty fields)
    const { normalized, fieldsStripped } = normalizeGraph(originalGraph);
    result.fieldsStripped = fieldsStripped;

    // Step 2: Re-import from Labs if requested
    if (options.reimportLabs && !options.dryRun) {
      console.log(`  Re-importing Labs for ${companyName}...`);
      try {
        const hydrationResult = await hydrateContextFromHistory(companyId);
        result.labsReimported = hydrationResult.totalFieldsUpdated;

        // Note: blockedWrites would be tracked via flow events
        // We don't have direct access to blocked count here

        if (hydrationResult.graph) {
          // Use the hydrated graph instead
          const newCompleteness = calculateCompleteness(hydrationResult.graph);
          result.completenessAfterPercent = newCompleteness;
          result.changed = true;
          console.log(`    Labs reimported: ${result.labsReimported} fields updated`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Lab reimport failed: ${errorMsg}`);
        console.error(`    Lab reimport error: ${errorMsg}`);
      }
    } else {
      // Just normalize without reimporting
      const normalizedJsonStr = JSON.stringify(normalized, null, 0);
      result.changed = normalizedJsonStr !== originalJsonStr;

      if (result.changed && !options.dryRun) {
        // Save normalized graph
        const newCompleteness = calculateGraphCompleteness(normalized);
        result.completenessAfterPercent = newCompleteness;

        await base(AIRTABLE_TABLES.CONTEXT_GRAPHS).update(record.id, {
          'Graph JSON': normalizedJsonStr,
          'Completeness Score': newCompleteness,
          'Updated At': new Date().toISOString(),
        });
      }
    }

    // Summary log
    const changeIndicator = result.changed ? '~' : '=';
    const status = options.dryRun ? '[DRY RUN]' : '[APPLIED]';
    console.log(
      `${changeIndicator} ${companyName}: ` +
      `stripped=${result.fieldsStripped}, ` +
      `reimported=${result.labsReimported}, ` +
      `completeness=${result.completenessBeforePercent}%→${result.completenessAfterPercent}% ${status}`
    );

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    console.error(`x ${companyName}: ${result.errors.join(', ')}`);
  }

  return result;
}

/**
 * Calculate completeness from raw graph object
 */
function calculateGraphCompleteness(graph: Record<string, unknown>): number {
  let totalFields = 0;
  let presentFields = 0;

  function countFields(obj: unknown, depth = 0): void {
    if (depth > 10) return;
    if (!obj || typeof obj !== 'object') return;

    const record = obj as Record<string, unknown>;

    if ('value' in record && 'provenance' in record) {
      totalFields++;
      if (!isEmptyValue(record.value)) {
        presentFields++;
      }
    } else {
      for (const value of Object.values(record)) {
        countFields(value, depth + 1);
      }
    }
  }

  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'website', 'seo', 'content', 'competitive', 'ops',
    'performanceMedia', 'budgetOps',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      countFields(graph[domain]);
    }
  }

  return totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0;
}

// ============================================================================
// Main
// ============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: true, // Default to dry run
    companyId: undefined,
    reimportLabs: false,
  };

  for (const arg of args) {
    if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--reimport-labs') {
      options.reimportLabs = true;
    } else if (arg.startsWith('--companyId=')) {
      options.companyId = arg.split('=')[1];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('='.repeat(70));
  console.log('Context Graph Normalization Migration');
  console.log('='.repeat(70));
  console.log();
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes will be saved)' : 'APPLY (changes will be saved)'}`);
  if (options.companyId) {
    console.log(`Target company: ${options.companyId}`);
  } else {
    console.log('Target: ALL companies with context graphs');
  }
  if (options.reimportLabs) {
    console.log('Lab reimport: ENABLED (will re-import from latest Lab runs)');
  }
  console.log();

  const base = getBase();

  // Build filter
  const filterFormula = options.companyId
    ? `{Company ID} = '${options.companyId}'`
    : 'NOT({Graph JSON} = "")';

  // Load records
  console.log('Loading context graphs...');
  const records = await base(AIRTABLE_TABLES.CONTEXT_GRAPHS)
    .select({
      filterByFormula: filterFormula,
      sort: [{ field: 'Updated At', direction: 'desc' }],
    })
    .all();

  console.log(`Found ${records.length} context graphs to process`);
  console.log();

  const report: MigrationReport = {
    companiesScanned: records.length,
    graphsChanged: 0,
    fieldsStripped: 0,
    blockedWrites: 0,
    labsReimported: 0,
    errors: [],
  };

  const results: CompanyMigrationResult[] = [];

  for (const record of records) {
    const result = await migrateCompany(base, record, options);
    results.push(result);

    report.fieldsStripped += result.fieldsStripped;
    report.blockedWrites += result.blockedWrites;
    report.labsReimported += result.labsReimported;
    if (result.changed) report.graphsChanged++;
    report.errors.push(...result.errors);
  }

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('Migration Summary');
  console.log('='.repeat(70));
  console.log();
  console.log(`Companies scanned:  ${report.companiesScanned}`);
  console.log(`Graphs changed:     ${report.graphsChanged}`);
  console.log(`Fields stripped:    ${report.fieldsStripped}`);
  console.log(`Blocked writes:     ${report.blockedWrites} (should be 0 during migration)`);
  console.log(`Labs reimported:    ${report.labsReimported}`);
  console.log(`Total errors:       ${report.errors.length}`);

  if (report.errors.length > 0) {
    console.log();
    console.log('Errors:');
    for (const error of report.errors.slice(0, 20)) {
      console.log(`  - ${error}`);
    }
    if (report.errors.length > 20) {
      console.log(`  ... and ${report.errors.length - 20} more errors`);
    }
  }

  if (options.dryRun) {
    console.log();
    console.log('>>> This was a DRY RUN. No changes were saved.');
    console.log('>>> Run with --apply to save changes.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { migrateCompany, normalizeGraph };
export type { MigrationOptions, MigrationReport };
