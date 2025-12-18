// scripts/migrateContextToCanonical.ts
// Migration Script: Convert {} → { value: null, status: 'missing' }
//
// This script migrates existing context graphs to the canonical format:
// - Converts empty objects {} to { value: null, status: 'missing' }
// - Preserves existing provenance where possible
// - Recomputes completeness
//
// Usage: npx ts-node scripts/migrateContextToCanonical.ts [companyId]
// If no companyId provided, migrates all companies

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

// ============================================================================
// Types
// ============================================================================

interface MigrationResult {
  companyId: string;
  companyName: string;
  fieldsConverted: number;
  fieldsPreserved: number;
  errors: string[];
  newCompleteness: number;
}

interface WithMetaField {
  value: unknown;
  provenance?: unknown[];
}

// ============================================================================
// Migration Logic
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
 * Check if an object is a WithMeta field (has value and provenance)
 */
function isWithMetaField(obj: unknown): obj is WithMetaField {
  if (!obj || typeof obj !== 'object') return false;
  return 'value' in (obj as Record<string, unknown>);
}

/**
 * Migrate a single field to canonical format
 */
function migrateField(field: unknown): { migrated: unknown; converted: boolean } {
  // If not an object, skip
  if (!field || typeof field !== 'object') {
    return { migrated: field, converted: false };
  }

  // If it's a WithMeta field
  if (isWithMetaField(field)) {
    if (isEmptyValue(field.value)) {
      // Convert to null value
      return {
        migrated: {
          value: null,
          provenance: field.provenance || [],
        },
        converted: true,
      };
    }
    // Keep as-is
    return { migrated: field, converted: false };
  }

  // If it's an empty object {}, convert to missing field
  if (Object.keys(field as object).length === 0) {
    return {
      migrated: {
        value: null,
        provenance: [],
      },
      converted: true,
    };
  }

  // Recurse into nested objects
  const result: Record<string, unknown> = {};
  let anyConverted = false;

  for (const [key, value] of Object.entries(field as Record<string, unknown>)) {
    const { migrated, converted } = migrateField(value);
    result[key] = migrated;
    if (converted) anyConverted = true;
  }

  return { migrated: result, converted: anyConverted };
}

/**
 * Migrate a context graph domain
 */
function migrateDomain(domain: unknown): { migrated: unknown; fieldsConverted: number } {
  if (!domain || typeof domain !== 'object') {
    return { migrated: domain, fieldsConverted: 0 };
  }

  const result: Record<string, unknown> = {};
  let fieldsConverted = 0;

  for (const [key, value] of Object.entries(domain as Record<string, unknown>)) {
    const { migrated, converted } = migrateField(value);
    result[key] = migrated;
    if (converted) fieldsConverted++;
  }

  return { migrated: result, fieldsConverted };
}

/**
 * Calculate completeness after migration
 */
function calculateCompleteness(graph: Record<string, unknown>): number {
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

  // Count in each domain
  const domains = [
    'identity', 'brand', 'audience', 'productOffer', 'competitive',
    'operationalConstraints', 'budgetOps', 'performanceMedia', 'ops',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      countFields(graph[domain]);
    }
  }

  return totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0;
}

/**
 * Migrate a single company's context graph
 */
async function migrateCompany(
  base: ReturnType<typeof getBase>,
  record: any
): Promise<MigrationResult> {
  const companyId = record.get('Company ID') as string;
  const companyName = record.get('Company Name') as string || 'Unknown';
  const graphJson = record.get('Graph JSON') as string;

  const result: MigrationResult = {
    companyId,
    companyName,
    fieldsConverted: 0,
    fieldsPreserved: 0,
    errors: [],
    newCompleteness: 0,
  };

  if (!graphJson) {
    result.errors.push('No Graph JSON found');
    return result;
  }

  try {
    const graph = JSON.parse(graphJson);

    // Migrate each domain
    const domains = [
      'identity', 'brand', 'objectives', 'audience', 'productOffer',
      'digitalInfra', 'website', 'content', 'seo', 'ops',
      'performanceMedia', 'historical', 'creative', 'competitive',
      'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs', 'social',
    ];

    for (const domain of domains) {
      if (graph[domain]) {
        const { migrated, fieldsConverted } = migrateDomain(graph[domain]);
        graph[domain] = migrated;
        result.fieldsConverted += fieldsConverted;
      }
    }

    // Calculate new completeness
    result.newCompleteness = calculateCompleteness(graph);

    // Save migrated graph
    const migratedJson = JSON.stringify(graph);

    await base(AIRTABLE_TABLES.CONTEXT_GRAPHS).update(record.id, {
      'Graph JSON': migratedJson,
      'Completeness Score': result.newCompleteness,
      'Updated At': new Date().toISOString(),
    });

    console.log(`✓ Migrated ${companyName}: ${result.fieldsConverted} fields converted, completeness: ${result.newCompleteness}%`);

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    console.error(`✗ Failed to migrate ${companyName}:`, error);
  }

  return result;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const targetCompanyId = process.argv[2];

  console.log('='.repeat(60));
  console.log('Context Graph Migration: {} → { value: null }');
  console.log('='.repeat(60));

  if (targetCompanyId) {
    console.log(`Target company: ${targetCompanyId}`);
  } else {
    console.log('Migrating ALL companies');
  }
  console.log();

  const base = getBase();

  // Build filter
  const filterFormula = targetCompanyId
    ? `{Company ID} = '${targetCompanyId}'`
    : 'NOT({Graph JSON} = "")';

  // Load records
  const records = await base(AIRTABLE_TABLES.CONTEXT_GRAPHS)
    .select({
      filterByFormula: filterFormula,
      sort: [{ field: 'Updated At', direction: 'desc' }],
    })
    .all();

  console.log(`Found ${records.length} context graphs to migrate`);
  console.log();

  const results: MigrationResult[] = [];

  for (const record of records) {
    const result = await migrateCompany(base, record);
    results.push(result);
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  const totalConverted = results.reduce((sum, r) => sum + r.fieldsConverted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const avgCompleteness = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.newCompleteness, 0) / results.length)
    : 0;

  console.log(`Companies migrated: ${results.length}`);
  console.log(`Total fields converted: ${totalConverted}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Average completeness: ${avgCompleteness}%`);

  if (totalErrors > 0) {
    console.log();
    console.log('Errors:');
    for (const r of results) {
      if (r.errors.length > 0) {
        console.log(`  ${r.companyName}: ${r.errors.join(', ')}`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { migrateCompany, migrateDomain, migrateField };
