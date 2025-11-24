/**
 * Pipeline Leads Page
 *
 * Shows all leads with:
 * - Company/domain
 * - Source (DMA, outbound, referral)
 * - Status (New, Contacted, Qualified, Disqualified)
 * - Created date
 * - Link to create company/opportunity
 */

import { base } from '@/lib/airtable/client';
import { PipelineLeadsClient } from '@/components/os/PipelineLeadsClient';

// Fetch leads from Airtable
async function fetchLeads() {
  try {
    const records = await base('Leads')
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      name: (record.fields['Name'] as string) || 'Unnamed Lead',
      domain: record.fields['Domain'] as string,
      email: record.fields['Email'] as string,
      source: (record.fields['Source'] as string) || 'Unknown',
      status: (record.fields['Status'] as string) || 'New',
      notes: record.fields['Notes'] as string,
      companyId: (record.fields['Company'] as string[])?.[0],
      opportunityId: (record.fields['Opportunity'] as string[])?.[0],
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    console.warn('[Leads] Failed to fetch leads (table may not exist):', error);
    return [];
  }
}

export default async function LeadsPage() {
  const leads = await fetchLeads();

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
