/**
 * Pipeline Opportunities Page
 *
 * Shows all opportunities with:
 * - Company (linked)
 * - Stage (Discovery, Proposal, Contract, Won, Lost)
 * - Est. value
 * - Close date
 * - Owner
 */

import { base } from '@/lib/airtable/client';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { PipelineOpportunitiesClient } from '@/components/os/PipelineOpportunitiesClient';

// Fetch opportunities with company data
async function getOpportunitiesWithCompanies() {
  const [opportunities, companies] = await Promise.all([
    fetchOpportunities(),
    getAllCompanies(),
  ]);

  // Build company lookup
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Enrich opportunities with company names
  const enrichedOpportunities = opportunities.map((opp) => ({
    ...opp,
    companyName: opp.companyId
      ? companyLookup.get(opp.companyId)?.name
      : undefined,
    companyDomain: opp.companyId
      ? companyLookup.get(opp.companyId)?.domain
      : undefined,
  }));

  return { opportunities: enrichedOpportunities, companies };
}

async function fetchOpportunities() {
  try {
    const records = await base('Opportunities')
      .select({
        sort: [{ field: 'Close Date', direction: 'asc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      name: (record.fields['Name'] as string) || 'Unnamed Opportunity',
      companyId: (record.fields['Company'] as string[])?.[0],
      stage: (record.fields['Stage'] as string) || 'Discovery',
      value: record.fields['Value'] as number,
      probability: record.fields['Probability'] as number,
      closeDate: record.fields['Close Date'] as string,
      owner: record.fields['Owner'] as string,
      notes: record.fields['Notes'] as string,
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    console.warn(
      '[Opportunities] Failed to fetch opportunities (table may not exist):',
      error
    );
    return [];
  }
}

export default async function OpportunitiesPage() {
  const { opportunities, companies } = await getOpportunitiesWithCompanies();

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              Pipeline Opportunities
            </h1>
            <p className="text-slate-400 mt-1">
              Active opportunities in your sales pipeline
            </p>
          </div>
          <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors">
            New Opportunity
          </button>
        </div>
      </div>

      <PipelineOpportunitiesClient
        opportunities={opportunities}
        companies={companies}
      />
    </div>
  );
}
