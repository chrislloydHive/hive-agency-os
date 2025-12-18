// app/api/pipeline/convert-lead-to-company/route.ts
// Convert inbound lead to CRM company
//
// LEAD-FIRST DESIGN:
// - This is the ONLY place where a lead should create a company
// - Inbound/DMA endpoints create leads WITHOUT companies
// - This endpoint explicitly converts a lead to a company

import { NextRequest, NextResponse } from 'next/server';
import { getInboundLeadById, linkLeadToCompany, updateLeadStatus, updateLeadConvertedAt } from '@/lib/airtable/inboundLeads';
import { findOrCreateCompanyByDomain, getCompanyById } from '@/lib/airtable/companies';
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

    // Idempotent: if already linked to a company, return success with existing company
    if (lead.companyId) {
      const existingCompany = await getCompanyById(lead.companyId);
      if (existingCompany) {
        console.log(`[ConvertLeadToCompany] Lead ${leadId} already linked to company ${lead.companyId} (idempotent)`);
        return NextResponse.json({
          leadId,
          companyId: existingCompany.id,
          companyName: existingCompany.name,
          isNew: false,
          alreadyConverted: true,
        });
      }
      // Company link exists but company not found - continue to create
    }

    // Need website to create company
    if (!lead.website) {
      return NextResponse.json(
        { error: 'Lead has no website to create company from' },
        { status: 400 }
      );
    }

    // Find or create company (THIS is the correct place to create companies from leads)
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

    // Set convertedAt timestamp
    await updateLeadConvertedAt(leadId);

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
      alreadyConverted: false,
    });
  } catch (error) {
    console.error('[ConvertLeadToCompany] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
