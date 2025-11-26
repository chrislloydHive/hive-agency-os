// app/api/pipeline/convert-lead-to-opportunity/route.ts
// API route to convert an inbound lead to an opportunity in A-Lead Tracker

import { NextRequest, NextResponse } from 'next/server';
import {
  getInboundLeadById,
  updateInboundLead,
} from '@/lib/airtable/inboundLeads';
import { createOpportunity } from '@/lib/airtable/opportunities';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, opportunityData } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Fetch the lead
    const lead = await getInboundLeadById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Create opportunity in A-Lead Tracker
    const opportunity = await createOpportunity({
      companyName: opportunityData?.companyName || lead.companyName || lead.name || 'Unknown',
      deliverableName: opportunityData?.deliverableName || `Opportunity from ${lead.leadSource} lead`,
      stage: 'Discovery',
      notes: `Converted from Inbound Lead\n\nOriginal notes: ${lead.notes || 'None'}`,
      leadId: leadId,
      // Link to company if the lead was already converted to one
      companyId: lead.companyId,
      // Additional fields from request
      owner: opportunityData?.owner,
      value: opportunityData?.value,
      probability: opportunityData?.probability || 25,
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Failed to create opportunity' },
        { status: 500 }
      );
    }

    // Update the lead status
    await updateInboundLead(leadId, {
      status: 'Converted',
    });

    return NextResponse.json({
      success: true,
      opportunityId: opportunity.id,
      companyName: opportunity.companyName,
      message: `Lead converted to opportunity: ${opportunity.deliverableName || opportunity.companyName}`,
    });
  } catch (error) {
    console.error('[API] Failed to convert lead to opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to convert lead to opportunity' },
      { status: 500 }
    );
  }
}
