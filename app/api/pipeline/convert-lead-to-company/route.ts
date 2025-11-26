// app/api/pipeline/convert-lead-to-company/route.ts
// API route to convert an inbound lead to a company in CRM

import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable/client';
import {
  getInboundLeadById,
  updateInboundLead,
} from '@/lib/airtable/inboundLeads';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, companyData } = body;

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

    // Check if already converted
    if (lead.companyId) {
      return NextResponse.json(
        { error: 'Lead already converted to company', companyId: lead.companyId },
        { status: 400 }
      );
    }

    // Create company in CRM (Companies table)
    const companyFields: any = {
      Name: companyData?.name || lead.companyName || lead.name || 'Unknown',
      Stage: 'Prospect',
    };

    // Add optional fields
    if (lead.website || companyData?.website) {
      companyFields['Website'] = lead.website || companyData?.website;
    }
    if (lead.notes || companyData?.notes) {
      companyFields['Notes'] = `${lead.notes || ''}\n\nConverted from Inbound Lead (${lead.leadSource})`.trim();
    }

    // Create the company
    const companyRecord = await base('Companies').create(companyFields) as any;

    // Update the lead with the company link and status
    await updateInboundLead(leadId, {
      companyId: companyRecord.id,
      status: 'Converted',
    });

    return NextResponse.json({
      success: true,
      companyId: companyRecord.id,
      companyName: companyRecord.fields['Name'],
      message: `Lead converted to company: ${companyRecord.fields['Name']}`,
    });
  } catch (error) {
    console.error('[API] Failed to convert lead to company:', error);
    return NextResponse.json(
      { error: 'Failed to convert lead to company' },
      { status: 500 }
    );
  }
}
