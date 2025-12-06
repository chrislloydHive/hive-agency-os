// app/api/dev/purge-hive/route.ts
// Dev-only API endpoint for purging Hive companies
//
// DELETE /api/dev/purge-hive - Purge all companies with "hive" in their name
// DELETE /api/dev/purge-hive?dryRun=true - Preview what would be deleted
//
// IMPORTANT: This endpoint is ONLY available in development mode.
// It will return 403 Forbidden in production.

import { NextRequest, NextResponse } from 'next/server';

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Table names (in deletion order - children first, then parents)
const RELATED_TABLES = [
  'ContextGraphVersions',
  'ContextGraphs',
  'AudiencePersonas',
  'AudienceModels',
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
  'GAP-Heavy Run',
  'GAP-Full Report',
  'GAP-Plan Run',
  'GAP-IA Run',
  'Diagnostic Runs',
  'Client Documents',
  'Client Insights',
  'Company Strategy Snapshots',
  'Company AI Context',
  'Work Items',
];

const COMPANIES_TABLE = 'Companies';

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

async function deleteRecordsBatch(
  tableName: string,
  recordIds: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
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

    if (i + batchSize < recordIds.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return { deleted, errors };
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

async function findHiveCompanies(): Promise<AirtableRecord[]> {
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
    const conditions = companyRecordIds.map(
      id => `FIND("${id}", ARRAYJOIN({Company}, ",")) > 0`
    );
    const formula = `OR(${conditions.join(', ')})`;
    return await fetchRecords(tableName, formula);
  } catch {
    return [];
  }
}

export async function DELETE(request: NextRequest) {
  // Guard: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  // Check Airtable config
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable configuration missing' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  const summary: PurgeSummary = {
    companiesFound: 0,
    companiesPurged: [],
    deletedByTable: {},
    errors: [],
    dryRun,
  };

  try {
    // Find Hive companies
    const companies = await findHiveCompanies();
    summary.companiesFound = companies.length;

    if (companies.length === 0) {
      return NextResponse.json({
        message: 'No companies found with "hive" in their name',
        summary,
      });
    }

    const companyIds = companies.map(c => c.id);

    if (dryRun) {
      // Dry run: just count what would be deleted
      for (const tableName of RELATED_TABLES) {
        const relatedRecords = await findRelatedRecords(tableName, companyIds);
        if (relatedRecords.length > 0) {
          summary.deletedByTable[tableName] = relatedRecords.length;
        }
      }
      summary.deletedByTable[COMPANIES_TABLE] = companies.length;

      return NextResponse.json({
        message: `Dry run: would delete ${companies.length} company/companies and related records`,
        companies: companies.map(c => ({
          id: c.id,
          name: c.fields['Company Name'] || c.fields['Name'],
          domain: c.fields['Domain'],
        })),
        summary,
      });
    }

    // Actual deletion
    for (const company of companies) {
      const companyName = (company.fields['Company Name'] || company.fields['Name']) as string || 'Unknown';

      // Delete related records
      for (const tableName of RELATED_TABLES) {
        try {
          const relatedRecords = await findRelatedRecords(tableName, [company.id]);
          if (relatedRecords.length > 0) {
            const recordIds = relatedRecords.map(r => r.id);
            const result = await deleteRecordsBatch(tableName, recordIds);
            summary.deletedByTable[tableName] =
              (summary.deletedByTable[tableName] || 0) + result.deleted;
            if (result.errors.length > 0) {
              summary.errors.push(...result.errors);
            }
          }
        } catch (err) {
          summary.errors.push(`Error with ${tableName}: ${err}`);
        }
      }

      // Delete the company
      try {
        await deleteRecord(COMPANIES_TABLE, company.id);
        summary.companiesPurged.push(companyName);
        summary.deletedByTable[COMPANIES_TABLE] =
          (summary.deletedByTable[COMPANIES_TABLE] || 0) + 1;
      } catch (err) {
        summary.errors.push(`Failed to delete company ${companyName}: ${err}`);
      }
    }

    return NextResponse.json({
      message: `Purged ${summary.companiesPurged.length}/${summary.companiesFound} company/companies`,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Purge failed',
        details: err instanceof Error ? err.message : String(err),
        summary,
      },
      { status: 500 }
    );
  }
}

// Also support GET for dry-run preview
export async function GET(request: NextRequest) {
  // Guard: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable configuration missing' },
      { status: 500 }
    );
  }

  try {
    const companies = await findHiveCompanies();

    if (companies.length === 0) {
      return NextResponse.json({
        message: 'No companies found with "hive" in their name',
        companies: [],
      });
    }

    return NextResponse.json({
      message: `Found ${companies.length} company/companies with "hive" in their name`,
      companies: companies.map(c => ({
        id: c.id,
        name: c.fields['Company Name'] || c.fields['Name'],
        domain: c.fields['Domain'],
      })),
      hint: 'Use DELETE method to purge, or DELETE with ?dryRun=true to preview',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to find companies',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
