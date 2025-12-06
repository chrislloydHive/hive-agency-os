#!/usr/bin/env npx ts-node
// scripts/purgeHiveCompanies.ts
//
// Purge All Hive Companies + Related Records
//
// This script finds all companies where the name contains "hive" (case-insensitive)
// and deletes them along with all related records in the correct order.
//
// Usage:
//   npx ts-node scripts/purgeHiveCompanies.ts          # Interactive with confirmation
//   npx ts-node scripts/purgeHiveCompanies.ts --force  # Skip confirmation
//   npm run purge:hive                                 # Via npm script
//   npm run purge:hive -- --force                      # Force via npm script

import * as readline from 'readline';
import { config } from 'dotenv';

// Load environment variables
config();

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in environment');
  process.exit(1);
}

// Table names (in deletion order - children first, then parents)
const RELATED_TABLES = [
  // Context Graph
  'ContextGraphVersions',
  'ContextGraphs',

  // Audience Lab
  'AudiencePersonas',
  'AudienceModels',

  // Media Lab (children first)
  'MediaPlanFlights',
  'MediaPlanChannels',
  'MediaScenarios',
  'MediaPlans',
  'MediaProfiles',
  'Media Performance',
  'Media Stores',
  'Media Markets',
  'Media Campaigns',
  'Media Programs',

  // GAP System
  'GAP-Heavy Run',
  'GAP-Full Report',
  'GAP-Plan Run',
  'GAP-IA Run',

  // Diagnostic Runs
  'Diagnostic Runs',

  // Client Brain
  'Client Documents',
  'Client Insights',
  'Company Strategy Snapshots',
  'Company AI Context',

  // Work Items
  'Work Items',
];

const COMPANIES_TABLE = 'Companies';

// Types
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface PurgeSummary {
  companiesFound: number;
  companiesPurged: string[];
  deletedByTable: Record<string, number>;
  errors: string[];
  dryRun: boolean;
}

// Airtable API helpers
async function fetchRecords(
  tableName: string,
  filterFormula?: string
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    if (offset) {
      params.append('offset', offset);
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch from ${tableName}: ${response.status} ${error}`);
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

async function deleteRecord(tableName: string, recordId: string): Promise<void> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete ${recordId} from ${tableName}: ${response.status} ${error}`);
  }
}

async function deleteRecordsBatch(
  tableName: string,
  recordIds: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  // Airtable allows up to 10 records per batch delete
  const batchSize = 10;

  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    const params = batch.map(id => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${params}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        errors.push(`Batch delete in ${tableName}: ${response.status} ${error}`);
      } else {
        const data = await response.json();
        deleted += data.records?.length || batch.length;
      }
    } catch (err) {
      errors.push(`Batch delete in ${tableName}: ${err}`);
    }

    // Rate limiting: Airtable allows 5 requests per second
    if (i + batchSize < recordIds.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return { deleted, errors };
}

async function findHiveCompanies(): Promise<AirtableRecord[]> {
  // FIND with LOWER for case-insensitive search
  // Field is "Company Name" in Airtable
  const formula = 'FIND("hive", LOWER({Company Name})) > 0';
  return fetchRecords(COMPANIES_TABLE, formula);
}

async function findRelatedRecords(
  tableName: string,
  companyRecordIds: string[]
): Promise<AirtableRecord[]> {
  if (companyRecordIds.length === 0) return [];

  try {
    // Build OR formula for all company IDs
    // Most tables use "Company" as the linked field name
    const conditions = companyRecordIds.map(
      id => `FIND("${id}", ARRAYJOIN({Company}, ",")) > 0`
    );
    const formula = `OR(${conditions.join(', ')})`;

    return await fetchRecords(tableName, formula);
  } catch (err) {
    // Table might not exist or might not have a Company field
    console.log(`  ⚠ Could not query ${tableName}: ${err}`);
    return [];
  }
}

async function purgeCompany(
  company: AirtableRecord,
  summary: PurgeSummary
): Promise<void> {
  const companyName = (company.fields['Company Name'] || company.fields['Name']) as string || 'Unknown';
  const companyId = company.id;

  console.log(`\n  Purging: ${companyName} (${companyId})`);

  // Delete related records in order
  for (const tableName of RELATED_TABLES) {
    try {
      const relatedRecords = await findRelatedRecords(tableName, [companyId]);

      if (relatedRecords.length > 0) {
        console.log(`    ${tableName}: ${relatedRecords.length} record(s)`);

        const recordIds = relatedRecords.map(r => r.id);
        const result = await deleteRecordsBatch(tableName, recordIds);

        summary.deletedByTable[tableName] =
          (summary.deletedByTable[tableName] || 0) + result.deleted;

        if (result.errors.length > 0) {
          summary.errors.push(...result.errors);
        }
      }
    } catch (err) {
      // Continue with other tables even if one fails
      console.log(`    ⚠ Error with ${tableName}: ${err}`);
    }
  }

  // Finally, delete the company record itself
  try {
    await deleteRecord(COMPANIES_TABLE, companyId);
    summary.companiesPurged.push(companyName);
    summary.deletedByTable[COMPANIES_TABLE] =
      (summary.deletedByTable[COMPANIES_TABLE] || 0) + 1;
    console.log(`    ✓ Company deleted`);
  } catch (err) {
    summary.errors.push(`Failed to delete company ${companyName}: ${err}`);
    console.log(`    ✗ Failed to delete company: ${err}`);
  }
}

async function confirmPurge(companies: AirtableRecord[]): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will permanently delete the following companies and ALL related data:\n');

    companies.forEach((company, idx) => {
      const name = (company.fields['Company Name'] || company.fields['Name']) as string || 'Unknown';
      const domain = company.fields['Domain'] as string || '';
      console.log(`  ${idx + 1}. ${name}${domain ? ` (${domain})` : ''}`);
    });

    console.log(`\nRelated tables that will be purged: ${RELATED_TABLES.length}`);
    console.log('This action CANNOT be undone.\n');

    rl.question('Are you sure you want to proceed? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main(): Promise<PurgeSummary> {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const dryRun = args.includes('--dry-run') || args.includes('-n');

  console.log('🔍 Finding companies with "hive" in their name...\n');

  const companies = await findHiveCompanies();

  const summary: PurgeSummary = {
    companiesFound: companies.length,
    companiesPurged: [],
    deletedByTable: {},
    errors: [],
    dryRun,
  };

  if (companies.length === 0) {
    console.log('✓ No companies found with "hive" in their name.');
    return summary;
  }

  console.log(`Found ${companies.length} company/companies:`);
  companies.forEach((company, idx) => {
    const name = (company.fields['Company Name'] || company.fields['Name']) as string || 'Unknown';
    const domain = company.fields['Domain'] as string || '';
    console.log(`  ${idx + 1}. ${name}${domain ? ` (${domain})` : ''}`);
  });

  if (dryRun) {
    console.log('\n🔍 Dry run mode - checking what would be deleted...\n');

    for (const company of companies) {
      const companyName = (company.fields['Company Name'] || company.fields['Name']) as string || 'Unknown';
      console.log(`\n  Would purge: ${companyName}`);

      for (const tableName of RELATED_TABLES) {
        try {
          const relatedRecords = await findRelatedRecords(tableName, [company.id]);
          if (relatedRecords.length > 0) {
            console.log(`    ${tableName}: ${relatedRecords.length} record(s)`);
            summary.deletedByTable[tableName] =
              (summary.deletedByTable[tableName] || 0) + relatedRecords.length;
          }
        } catch {
          // Ignore errors in dry run
        }
      }
      summary.deletedByTable[COMPANIES_TABLE] =
        (summary.deletedByTable[COMPANIES_TABLE] || 0) + 1;
    }

    console.log('\n📊 Dry Run Summary:');
    console.log('─'.repeat(40));
    Object.entries(summary.deletedByTable).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });

    return summary;
  }

  // Confirm unless --force is passed
  if (!force) {
    const confirmed = await confirmPurge(companies);
    if (!confirmed) {
      console.log('\n❌ Purge cancelled.');
      process.exit(0);
    }
  }

  console.log('\n🗑️  Starting purge...');

  for (const company of companies) {
    await purgeCompany(company, summary);
  }

  // Print summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 PURGE SUMMARY');
  console.log('═'.repeat(50));
  console.log(`\nCompanies purged: ${summary.companiesPurged.length}/${summary.companiesFound}`);

  if (summary.companiesPurged.length > 0) {
    summary.companiesPurged.forEach(name => console.log(`  ✓ ${name}`));
  }

  console.log('\nRecords deleted by table:');
  Object.entries(summary.deletedByTable).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`  ${table}: ${count}`);
    }
  });

  if (summary.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    summary.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n' + '═'.repeat(50));

  return summary;
}

// Run if executed directly
main()
  .then((summary) => {
    if (summary.errors.length > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

// Export for API route usage
export { main as purgeHiveCompanies };
export type { PurgeSummary };
