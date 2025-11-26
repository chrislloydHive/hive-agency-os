/**
 * Pipeline Leads Page
 *
 * Shows all inbound leads with:
 * - Company/domain
 * - Source (DMA, outbound, referral)
 * - Status (New, Contacted, Qualified, Disqualified)
 * - Created date
 * - Link to create company/opportunity
 */

import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { PipelineLeadsClient } from '@/components/os/PipelineLeadsClient';

export default async function LeadsPage() {
  const leads = await getAllInboundLeads({ maxRecords: 200 });

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

      <PipelineLeadsClient leads={leads} />
    </div>
  );
}
