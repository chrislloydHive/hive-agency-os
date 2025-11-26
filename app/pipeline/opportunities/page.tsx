// app/pipeline/opportunities/page.tsx
// Pipeline Opportunities Board View

import { getAllOpportunities } from '@/lib/airtable/opportunities';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { OpportunitiesBoardClient } from './OpportunitiesBoardClient';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const [opportunities, companies] = await Promise.all([
    getAllOpportunities(),
    getAllCompanies(),
  ]);

  // Build company lookup for enrichment
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Enrich opportunities with company data
  const enrichedOpportunities = opportunities.map((opp) => ({
    ...opp,
    // If company data available, enrich
    industry: opp.industry || (opp.companyId ? companyLookup.get(opp.companyId)?.industry : null),
    companyType: opp.companyType || (opp.companyId ? companyLookup.get(opp.companyId)?.companyType : null),
    sizeBand: opp.sizeBand || (opp.companyId ? companyLookup.get(opp.companyId)?.sizeBand : null),
  }));

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

      <OpportunitiesBoardClient
        opportunities={enrichedOpportunities}
        companies={companies}
      />
    </div>
  );
}
