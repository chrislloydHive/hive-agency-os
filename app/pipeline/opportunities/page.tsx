/**
 * Pipeline Opportunities Page
 *
 * Shows all opportunities from A-Lead Tracker with:
 * - Company (linked)
 * - Stage (Discovery, Proposal, Contract, Won, Lost)
 * - Est. value
 * - Close date
 * - Owner
 */

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { getAllOpportunities } from '@/lib/airtable/opportunities';
import { PipelineOpportunitiesClient } from '@/components/os/PipelineOpportunitiesClient';

// Fetch opportunities with company data
async function getOpportunitiesWithCompanies() {
  const [opportunities, companies] = await Promise.all([
    getAllOpportunities({ maxRecords: 200 }),
    getAllCompanies(),
  ]);

  // Build company lookup
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Enrich opportunities with additional company data
  const enrichedOpportunities = opportunities.map((opp) => {
    const company = opp.companyId ? companyLookup.get(opp.companyId) : undefined;
    return {
      ...opp,
      // Use company name from lookup if not already set
      companyName: opp.companyName || company?.name || 'Unknown Company',
      companyDomain: opp.companyDomain || company?.domain,
      companyStage: opp.companyStage || company?.stage,
    };
  });

  return { opportunities: enrichedOpportunities, companies };
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
