#!/usr/bin/env npx tsx
// scripts/migrate-setup-to-context-graph.ts
// One-time migration script for legacy Setup data
//
// This script migrates any existing Setup data stored separately
// (e.g., in Airtable or JSON files) into the Context Graph.
//
// Usage:
//   npx tsx scripts/migrate-setup-to-context-graph.ts
//   npx tsx scripts/migrate-setup-to-context-graph.ts --dry-run
//   npx tsx scripts/migrate-setup-to-context-graph.ts --company recXXXXXXXX

import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { createEmptyContextGraph } from '../lib/contextGraph/companyContextGraph';
import {
  setDomainFieldsWithResult,
  createProvenance,
} from '../lib/contextGraph/mutate';
import {
  ALL_SETUP_BINDINGS,
  type SetupFieldBinding,
} from '../lib/contextGraph/setupSchema';
import type { DomainName } from '../lib/contextGraph/companyContextGraph';

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_COMPANY = process.argv.find(arg => arg.startsWith('--company='))?.split('=')[1];

// ============================================================================
// Types
// ============================================================================

interface LegacySetupData {
  companyId: string;
  companyName: string;
  data: Record<string, Record<string, unknown>>;
  completedAt?: string;
}

interface MigrationResult {
  companyId: string;
  success: boolean;
  fieldsWritten: number;
  fieldsBlocked: number;
  errors: string[];
}

// ============================================================================
// Legacy Data Loader (customize based on your storage)
// ============================================================================

/**
 * Load legacy Setup data from your existing storage
 *
 * Customize this function based on where your Setup data is stored:
 * - Airtable table
 * - JSON files
 * - Database records
 */
async function loadLegacySetupData(): Promise<LegacySetupData[]> {
  // Example: Load from Airtable
  // const { getBase } = await import('../lib/airtable/base');
  // const base = getBase();
  // const records = await base('SetupData').select().all();
  // return records.map(r => ({ ... }));

  // Example: Load from JSON files
  // const fs = await import('fs/promises');
  // const files = await fs.readdir('./data/setup');
  // return Promise.all(files.map(async f => {
  //   const data = JSON.parse(await fs.readFile(`./data/setup/${f}`, 'utf-8'));
  //   return { companyId: f.replace('.json', ''), ...data };
  // }));

  console.log('[Migration] No legacy data source configured.');
  console.log('[Migration] To use this script, implement loadLegacySetupData()');
  console.log('[Migration] based on where your Setup data is stored.');

  return [];
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Migrate a single company's Setup data to Context Graph
 */
async function migrateCompany(
  legacyData: LegacySetupData
): Promise<MigrationResult> {
  const { companyId, companyName, data } = legacyData;
  const errors: string[] = [];
  let totalWritten = 0;
  let totalBlocked = 0;

  console.log(`[Migration] Processing ${companyId} (${companyName})...`);

  try {
    // Load or create context graph
    let graph = await loadContextGraph(companyId);

    if (!graph) {
      console.log(`  Creating new Context Graph for ${companyId}`);
      graph = createEmptyContextGraph(companyId, companyName);
    }

    // Create migration provenance
    const provenance = createProvenance('import', {
      confidence: 0.85, // Slightly lower than fresh Setup (0.95)
      notes: 'SetupLegacy migration',
    });

    // Group bindings by domain
    const bindingsByDomain = new Map<DomainName, SetupFieldBinding[]>();
    for (const binding of ALL_SETUP_BINDINGS) {
      const existing = bindingsByDomain.get(binding.domain) || [];
      existing.push(binding);
      bindingsByDomain.set(binding.domain, existing);
    }

    // Process each domain
    for (const [domain, bindings] of bindingsByDomain) {
      const fields: Record<string, unknown> = {};

      for (const binding of bindings) {
        // Get value from legacy data
        const stepKey = getStepFormKey(binding.setupStepId);
        const stepData = data[stepKey];

        if (stepData && stepData[binding.setupFieldId] !== undefined) {
          const value = stepData[binding.setupFieldId];

          // Skip empty values
          if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
            continue;
          }

          fields[binding.field] = value;
        }
      }

      if (Object.keys(fields).length === 0) continue;

      // Write to graph (respects priority - won't overwrite human edits)
      const { result } = setDomainFieldsWithResult(
        graph,
        domain,
        fields as any,
        provenance
      );

      totalWritten += result.updated;
      totalBlocked += result.blocked;

      if (result.blocked > 0) {
        console.log(`  Blocked ${result.blocked} fields in ${domain} (human-edited)`);
      }
    }

    // Save the graph
    if (!DRY_RUN && totalWritten > 0) {
      await saveContextGraph(graph, 'setup-migration');
      console.log(`  Saved ${totalWritten} fields to Context Graph`);
    } else if (DRY_RUN) {
      console.log(`  [DRY RUN] Would save ${totalWritten} fields`);
    }

    return {
      companyId,
      success: true,
      fieldsWritten: totalWritten,
      fieldsBlocked: totalBlocked,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    console.error(`  Error: ${message}`);

    return {
      companyId,
      success: false,
      fieldsWritten: 0,
      fieldsBlocked: 0,
      errors,
    };
  }
}

/**
 * Map step ID to form key
 */
function getStepFormKey(stepId: string): string {
  const mapping: Record<string, string> = {
    'business-identity': 'businessIdentity',
    'objectives': 'objectives',
    'audience': 'audience',
    'personas': 'personas',
    'website': 'website',
    'media-foundations': 'mediaFoundations',
    'budget-scenarios': 'budgetScenarios',
    'creative-strategy': 'creativeStrategy',
    'measurement': 'measurement',
    'summary': 'summary',
  };
  return mapping[stepId] || stepId;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Setup to Context Graph Migration');
  console.log('='.repeat(60));
  console.log();

  if (DRY_RUN) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log();
  }

  // Load legacy data
  const legacyData = await loadLegacySetupData();

  if (legacyData.length === 0) {
    console.log('No legacy data to migrate.');
    return;
  }

  // Filter if specific company requested
  const toMigrate = SPECIFIC_COMPANY
    ? legacyData.filter(d => d.companyId === SPECIFIC_COMPANY)
    : legacyData;

  console.log(`Found ${toMigrate.length} companies to migrate`);
  console.log();

  // Migrate each company
  const results: MigrationResult[] = [];

  for (const data of toMigrate) {
    const result = await migrateCompany(data);
    results.push(result);
    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalWritten = results.reduce((sum, r) => sum + r.fieldsWritten, 0);
  const totalBlocked = results.reduce((sum, r) => sum + r.fieldsBlocked, 0);

  console.log(`Companies processed: ${results.length}`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log();
  console.log(`Fields written: ${totalWritten}`);
  console.log(`Fields blocked (human-edited): ${totalBlocked}`);
  console.log();

  if (failed.length > 0) {
    console.log('Failed companies:');
    for (const result of failed) {
      console.log(`  ${result.companyId}: ${result.errors.join(', ')}`);
    }
    console.log();
  }

  if (DRY_RUN) {
    console.log('DRY RUN - No changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('Migration complete!');
    console.log();
    console.log('Next steps:');
    console.log('1. Verify data in Brain → Context for a few companies');
    console.log('2. Test Setup wizard loads data correctly');
    console.log('3. Stop reading from legacy Setup storage');
  }
}

main().catch(console.error);
