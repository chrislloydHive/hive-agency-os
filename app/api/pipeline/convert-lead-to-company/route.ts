// app/api/pipeline/convert-lead-to-company/route.ts
// Convert inbound lead to CRM company

import { NextRequest, NextResponse } from 'next/server';
import { getInboundLeadById, linkLeadToCompany, updateLeadStatus } from '@/lib/airtable/inboundLeads';
import { findOrCreateCompanyByDomain } from '@/lib/airtable/companies';
import { logCompanyCreatedFromLead } from '@/lib/telemetry/events';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Missing leadId' },
        { status: 400 }
      );
    }

    // Fetch lead
    const lead = await getInboundLeadById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if already linked to a company
    if (lead.companyId) {
      return NextResponse.json(
        { error: 'Lead already linked to a company' },
        { status: 400 }
      );
    }

    // Need website to create company
    if (!lead.website) {
      return NextResponse.json(
        { error: 'Lead has no website to create company from' },
        { status: 400 }
      );
    }

    // Find or create company
    const { companyId, companyRecord, isNew } = await findOrCreateCompanyByDomain(
      lead.website,
      {
        companyName: lead.companyName || undefined,
        stage: 'Prospect',
        source: lead.leadSource?.includes('DMA') || lead.leadSource?.includes('GAP')
          ? 'Inbound'
          : 'Other',
      }
    );

    // Link lead to company
    await linkLeadToCompany(leadId, companyRecord.id);

    // Update lead status
    await updateLeadStatus(leadId, 'Qualified');

    // Log telemetry event (only for new companies)
    if (isNew) {
      logCompanyCreatedFromLead(companyRecord.id, leadId, companyRecord.name, lead.website);
    }

    console.log(`[ConvertLeadToCompany] Lead ${leadId} → Company ${companyRecord.id} (${isNew ? 'new' : 'existing'})`);

    return NextResponse.json({
      leadId,
      companyId: companyRecord.id,
      companyName: companyRecord.name,
      isNew,
    });
  } catch (error) {
    console.error('[ConvertLeadToCompany] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
