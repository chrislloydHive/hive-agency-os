// app/api/pipeline/dma-contact/route.ts
// API endpoint for DMA Full GAP "Contact Us" form submissions
// Creates or updates a pipeline lead from DMA

import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdatePipelineLeadFromDma } from '@/lib/airtable/inboundLeads';
import { getCompanyById } from '@/lib/airtable/companies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { companyId, contactEmail, gapPlanRunId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!contactEmail) {
      return NextResponse.json(
        { error: 'contactEmail is required' },
        { status: 400 }
      );
    }

    if (!gapPlanRunId) {
      return NextResponse.json(
        { error: 'gapPlanRunId is required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Create or update the lead
    const lead = await createOrUpdatePipelineLeadFromDma({
      companyId,
      contactEmail,
      contactName: body.contactName,
      companyName: body.companyName || company.name,
      website: body.website || company.website,
      gapPlanRunId,
      gapOverallScore: body.gapOverallScore,
      gapMaturityStage: body.gapMaturityStage,
      contactMessage: body.contactMessage,
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Failed to create lead' },
        { status: 500 }
      );
    }

    console.log('[DMA Contact] Created/updated lead:', lead.id);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: 'Contact request received successfully',
    });
  } catch (error) {
    console.error('[DMA Contact] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
