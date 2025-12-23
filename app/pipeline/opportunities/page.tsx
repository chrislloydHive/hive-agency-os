// app/pipeline/opportunities/page.tsx
// Pipeline Opportunities Board View with Forecast Filtering

import { getAllOpportunities } from '@/lib/airtable/opportunities';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { fetchRecentDMARuns, buildCompanySummaries } from '@/lib/dma/normalize';
import { OpportunitiesPageClient } from './OpportunitiesPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OpportunitiesPage() {
  const [opportunities, companies, dmaRuns] = await Promise.all([
    getAllOpportunities(),
    getAllCompanies(),
    fetchRecentDMARuns({ days: 90, limit: 500 }), // Fetch 90 days of DMA data
  ]);

  // Debug: log what we're rendering
  console.log(`[OpportunitiesPage] Rendering ${opportunities.length} opportunities, ${dmaRuns.length} DMA runs`);

  // Build company lookup for enrichment
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Build DMA summaries by company
  const dmaSummaries = await buildCompanySummaries(dmaRuns);
  const dmaSummaryLookup = new Map(dmaSummaries.map((s) => [s.companyId, s]));

  // Enrich opportunities with company data and DMA data
  const enrichedOpportunities = opportunities.map((opp) => {
    const dmaSummary = opp.companyId ? dmaSummaryLookup.get(opp.companyId) : null;
    return {
      ...opp,
      // If company data available, enrich
      industry: opp.industry || (opp.companyId ? companyLookup.get(opp.companyId)?.industry : null),
      companyType: opp.companyType || (opp.companyId ? companyLookup.get(opp.companyId)?.companyType : null),
      sizeBand: opp.sizeBand || (opp.companyId ? companyLookup.get(opp.companyId)?.sizeBand : null),
      // DMA enrichment
      dmaLastRunType: dmaSummary?.lastRunType ?? null,
      dmaLastRunAt: dmaSummary?.lastRunAt ?? null,
      dmaTotalRuns: dmaSummary?.totalRuns ?? null,
      dmaLatestScore: dmaSummary?.latestScore ?? null,
      dmaIntentLevel: dmaSummary?.intentLevel ?? null,
    };
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Pipeline Opportunities
          </h1>
          <p className="text-slate-400 mt-1">
            Track deal progress from proposal to close
          </p>
        </div>
      </div>

      <OpportunitiesPageClient
        opportunities={enrichedOpportunities}
        companies={companies}
      />
    </div>
  );
}
