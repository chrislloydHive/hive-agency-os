// app/api/pipeline/convert-lead-to-opportunity/route.ts
// Convert inbound lead to pipeline opportunity
//
// LEAD-FIRST DESIGN:
// - Lead must be linked to a company before creating an opportunity
// - Updates lead with linkedOpportunityId and stage
// - Idempotent: returns existing opportunity if already converted

import { NextRequest, NextResponse } from 'next/server';
import { getInboundLeadById, updateLeadStatus, updateLeadLinkedOpportunity, updatePipelineLeadStage } from '@/lib/airtable/inboundLeads';
import { createOpportunity, getOpportunityById } from '@/lib/airtable/opportunities';
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

    // Idempotent: if already linked to an opportunity, return success with existing
    if (lead.linkedOpportunityId) {
      const existingOpportunity = await getOpportunityById(lead.linkedOpportunityId);
      if (existingOpportunity) {
        console.log(`[ConvertLeadToOpportunity] Lead ${leadId} already has opportunity ${lead.linkedOpportunityId} (idempotent)`);
        return NextResponse.json({
          leadId,
          opportunityId: existingOpportunity.id,
          companyId: lead.companyId,
          companyName: existingOpportunity.companyName,
          alreadyConverted: true,
        });
      }
      // Opportunity link exists but not found - continue to create
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

    // Create opportunity with OS-First Pipeline fields
    // - Stage: interest_confirmed (default for inbound leads)
    // - Opportunity Type: "Inbound Interest" for DMA/GAP-IA leads
    // - Source Lead: link to the Inbound Lead record
    // - Source: attribution from lead source
    // - Never create Engagement on conversion
    const opportunity = await createOpportunity({
      companyId: lead.companyId,
      name: `${company.name} - New Opportunity`,
      stage: stage || 'interest_confirmed',
      value: value || undefined,
      owner: lead.assignee || undefined,
      notes: lead.notes || undefined,
      // OS-First Pipeline: Set Opportunity Type based on lead source
      opportunityType: 'Inbound Interest',
      // OS-First Pipeline: Link Source Lead
      sourceLeadId: leadId,
      // Attribution: Carry over lead source
      source: lead.leadSource || 'DMA',
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Failed to create opportunity' },
        { status: 500 }
      );
    }

    // Update lead status
    await updateLeadStatus(leadId, 'Qualified');

    // Link opportunity to lead
    await updateLeadLinkedOpportunity(leadId, opportunity.id);

    // Update pipeline stage to reflect conversion
    await updatePipelineLeadStage(leadId, 'qualified');

    // Log telemetry event
    logLeadConvertedToOpportunity(leadId, opportunity.id, lead.companyId, company.name);

    console.log(`[ConvertLeadToOpportunity] Lead ${leadId} → Opportunity ${opportunity.id}`);

    return NextResponse.json({
      leadId,
      opportunityId: opportunity.id,
      companyId: lead.companyId,
      companyName: company.name,
      alreadyConverted: false,
    });
  } catch (error) {
    console.error('[ConvertLeadToOpportunity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
