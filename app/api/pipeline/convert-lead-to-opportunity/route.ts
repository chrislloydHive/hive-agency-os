// app/api/pipeline/convert-lead-to-opportunity/route.ts
// Convert inbound lead to pipeline opportunity

import { NextRequest, NextResponse } from 'next/server';
import { getInboundLeadById, updateLeadStatus } from '@/lib/airtable/inboundLeads';
import { createOpportunity } from '@/lib/airtable/opportunities';
import { getCompanyById } from '@/lib/airtable/companies';
import { logLeadConvertedToOpportunity } from '@/lib/telemetry/events';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, value, stage } = body;

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

    // Need company to create opportunity
    if (!lead.companyId) {
      return NextResponse.json(
        { error: 'Lead must be linked to a company first. Create a company before creating an opportunity.' },
        { status: 400 }
      );
    }

    // Get company details
    const company = await getCompanyById(lead.companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Linked company not found' },
        { status: 404 }
      );
    }

    // Create opportunity
    const opportunity = await createOpportunity({
      companyId: lead.companyId,
      name: `${company.name} - New Opportunity`,
      stage: stage || 'discovery',
      value: value || undefined,
      owner: lead.assignee || undefined,
      notes: lead.notes || undefined,
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Failed to create opportunity' },
        { status: 500 }
      );
    }

    // Update lead status
    await updateLeadStatus(leadId, 'Qualified');

    // Log telemetry event
    logLeadConvertedToOpportunity(leadId, opportunity.id, lead.companyId, company.name);

    console.log(`[ConvertLeadToOpportunity] Lead ${leadId} → Opportunity ${opportunity.id}`);

    return NextResponse.json({
      leadId,
      opportunityId: opportunity.id,
      companyId: lead.companyId,
      companyName: company.name,
    });
  } catch (error) {
    console.error('[ConvertLeadToOpportunity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
