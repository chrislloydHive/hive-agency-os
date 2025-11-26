// app/pipeline/leads/page.tsx
// Pipeline Leads - Inbound lead triage with routing

import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { getAllCompanies } from '@/lib/airtable/companies';
import { LeadsClient } from './LeadsClient';

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
            <h1 className="text-3xl font-bold text-slate-100">Pipeline Leads</h1>
            <p className="text-slate-400 mt-1">
              Inbound leads from DMA audits, referrals, and outreach
            </p>
          </div>
          <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors">
            Add Lead
          </button>
        </div>
      </div>

      <LeadsClient leads={enrichedLeads} />
    </div>
  );
}
