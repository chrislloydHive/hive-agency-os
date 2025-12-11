// app/pipeline/leads/page.tsx
// Pipeline Leads - DMA Full GAP leads with Board/Table views

import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { getAllCompanies } from '@/lib/airtable/companies';
import { PipelineViewToggle } from './PipelineViewToggle';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const [leads, companies] = await Promise.all([
    getAllInboundLeads(),
    getAllCompanies(),
  ]);

  // Build company lookup
  const companyLookup = new Map<string, { name: string; industry?: string; sizeBand?: string }>();
  for (const company of companies) {
    companyLookup.set(company.id, {
      name: company.name,
      industry: company.industry,
      sizeBand: company.sizeBand,
    });
  }

  // Enrich leads with company data
  const enrichedLeads = leads.map((lead) => ({
    ...lead,
    companyInfo: lead.companyId ? companyLookup.get(lead.companyId) : null,
  }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Pipeline</h1>
            <p className="text-slate-400 mt-1">
              Manage DMA Full GAP leads through the sales pipeline
            </p>
          </div>
        </div>
      </div>

      <PipelineViewToggle leads={enrichedLeads} />
    </div>
  );
}
