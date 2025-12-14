#!/usr/bin/env ts-node
// scripts/migrateContextKeys.ts
// Key Naming Migration Script
//
// This script migrates legacy context keys to canonical keys.
// It reads all ContextNodes/ContextGraphs from Airtable and updates
// any keys that don't match the canonical naming convention.
//
// Usage:
//   npx ts-node scripts/migrateContextKeys.ts [--dry-run] [--company=<companyId>]
//
// Options:
//   --dry-run     Show changes without applying them
//   --company=X   Only migrate a specific company

import { getBase } from '../lib/airtable';
import { AIRTABLE_TABLES } from '../lib/airtable/tables';
import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { LEGACY_KEY_MIGRATION, REGISTRY_BY_KEY } from '../lib/contextGraph/unifiedRegistry';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Known legacy key mappings for migration
 * Map of old key -> new canonical key
 */
const KEY_MIGRATIONS: Record<string, string> = {
  // Legacy flat keys to canonical domain.field format
  ...LEGACY_KEY_MIGRATION,

  // Additional legacy key migrations
  'valueProposition': 'productOffer.valueProposition',
  'positioningStatement': 'brand.positioning',
  'keyDifferentiators': 'brand.differentiators',
  'icpDescription': 'audience.icpDescription',
  'primaryAudience': 'audience.primaryAudience',
  'businessModel': 'identity.businessModel',
  'primaryOffering': 'productOffer.primaryProducts',
  'primaryConversionAction': 'productOffer.primaryConversionAction',
  'goals': 'objectives.primaryObjective',
  'objectives': 'objectives.primaryObjective',
  'budget': 'operationalConstraints.maxBudget',

  // Identity domain misplacements
  'businessReality.valueProposition': 'productOffer.valueProposition',
  'identity.valueProposition': 'productOffer.valueProposition',
  'identity.positioning': 'brand.positioning',

  // Positioning misplacements
  'positioning.valueProposition': 'productOffer.valueProposition',
  'positioning.positioningStatement': 'brand.positioning',
  'positioning.keyDifferentiators': 'brand.differentiators',
};

// ============================================================================
// Types
// ============================================================================

interface MigrationResult {
  companyId: string;
  companyName: string;
  changes: {
    oldKey: string;
    newKey: string;
    value: unknown;
  }[];
  errors: string[];
}

interface MigrationSummary {
  totalCompanies: number;
  companiesWithChanges: number;
  totalKeysMigrated: number;
  errors: string[];
  results: MigrationResult[];
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Check if a key needs migration
 */
function needsMigration(key: string): string | null {
  // Check direct mapping
  if (KEY_MIGRATIONS[key]) {
    return KEY_MIGRATIONS[key];
  }

  // Check if key exists in registry
  if (REGISTRY_BY_KEY.has(key)) {
    return null; // Already canonical
  }

  // Check for legacy format (no dot notation)
  if (!key.includes('.')) {
    // Try to find a matching canonical key
    for (const [legacy, canonical] of Object.entries(KEY_MIGRATIONS)) {
      if (legacy.toLowerCase() === key.toLowerCase()) {
        return canonical;
      }
    }
  }

  return null;
}

/**
 * Migrate a single context graph
 */
async function migrateGraph(
  companyId: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = {
    companyId,
    companyName: '',
    changes: [],
    errors: [],
  };

  try {
    // Load the context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      result.errors.push(`No context graph found for ${companyId}`);
      return result;
    }

    result.companyName = graph.companyName;

    // Track if we made any changes
    let hasChanges = false;

    // Iterate through all domains and fields
    const domains = Object.keys(graph).filter(k => k !== 'meta' && k !== 'companyId' && k !== 'companyName');

    for (const domain of domains) {
      const domainObj = (graph as Record<string, unknown>)[domain];
      if (!domainObj || typeof domainObj !== 'object') continue;

      for (const [fieldName, fieldValue] of Object.entries(domainObj as Record<string, unknown>)) {
        const currentKey = `${domain}.${fieldName}`;

        // Check if this key needs migration
        const newKey = needsMigration(currentKey);

        if (newKey && newKey !== currentKey) {
          result.changes.push({
            oldKey: currentKey,
            newKey,
            value: (fieldValue as { value?: unknown })?.value ?? fieldValue,
          });

          if (!dryRun) {
            // Parse the new key
            const [newDomain, newFieldName] = newKey.split('.');

            // Move the value to the new location
            const newDomainObj = (graph as unknown as Record<string, Record<string, unknown>>)[newDomain];
            if (newDomainObj) {
              // Only move if the target doesn't already have a value
              const targetField = newDomainObj[newFieldName];
              const targetValue = (targetField as { value?: unknown })?.value;

              if (!targetValue) {
                newDomainObj[newFieldName] = fieldValue;
                // Clear the old field
                (domainObj as Record<string, unknown>)[fieldName] = { value: null, provenance: [] };
                hasChanges = true;
              } else {
                result.errors.push(
                  `Cannot migrate ${currentKey} -> ${newKey}: target already has value`
                );
              }
            }
          }
        }
      }
    }

    // Save the updated graph if we made changes
    if (hasChanges && !dryRun) {
      await saveContextGraph(graph, 'migration');
      console.log(`  Saved updated graph for ${result.companyName}`);
    }
  } catch (error) {
    result.errors.push(`Error processing ${companyId}: ${error}`);
  }

  return result;
}

/**
 * Run the migration for all companies or a specific company
 */
async function runMigration(dryRun: boolean, specificCompanyId?: string): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    totalCompanies: 0,
    companiesWithChanges: 0,
    totalKeysMigrated: 0,
    errors: [],
    results: [],
  };

  try {
    const base = getBase();

    // Get all companies (or specific one)
    let filterFormula = '';
    if (specificCompanyId) {
      filterFormula = `{ID} = "${specificCompanyId}"`;
    }

    const companies = await base(AIRTABLE_TABLES.COMPANIES)
      .select({
        filterByFormula: filterFormula || '',
        fields: ['ID', 'Name'],
      })
      .all();

    summary.totalCompanies = companies.length;
    console.log(`\nMigrating ${companies.length} companies...${dryRun ? ' (DRY RUN)' : ''}\n`);

    for (const company of companies) {
      const companyId = company.fields['ID'] as string;
      const companyName = company.fields['Name'] as string;

      console.log(`Processing: ${companyName} (${companyId})`);

      const result = await migrateGraph(companyId, dryRun);
      summary.results.push(result);

      if (result.changes.length > 0) {
        summary.companiesWithChanges++;
        summary.totalKeysMigrated += result.changes.length;

        console.log(`  Found ${result.changes.length} key(s) to migrate:`);
        for (const change of result.changes) {
          console.log(`    ${change.oldKey} -> ${change.newKey}`);
        }
      }

      if (result.errors.length > 0) {
        for (const error of result.errors) {
          console.log(`  Error: ${error}`);
          summary.errors.push(error);
        }
      }
    }
  } catch (error) {
    summary.errors.push(`Migration failed: ${error}`);
    console.error('Migration failed:', error);
  }

  return summary;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const companyArg = args.find(a => a.startsWith('--company='));
  const specificCompanyId = companyArg?.split('=')[1];

  console.log('='.repeat(60));
  console.log('Context Key Migration Script');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('Mode: DRY RUN (no changes will be saved)');
  } else {
    console.log('Mode: LIVE (changes will be saved)');
  }

  if (specificCompanyId) {
    console.log(`Target: Company ${specificCompanyId}`);
  } else {
    console.log('Target: All companies');
  }

  const summary = await runMigration(dryRun, specificCompanyId);

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total companies: ${summary.totalCompanies}`);
  console.log(`Companies with changes: ${summary.companiesWithChanges}`);
  console.log(`Total keys migrated: ${summary.totalKeysMigrated}`);
  console.log(`Errors: ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of summary.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (dryRun && summary.totalKeysMigrated > 0) {
    console.log('\nTo apply these changes, run without --dry-run');
  }
}

main().catch(console.error);
