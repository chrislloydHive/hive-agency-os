// app/api/pipeline/dma-contact/route.ts
// API endpoint for DMA Full GAP "Contact Us" form submissions
//
// LEAD-FIRST DESIGN:
// - Creates or updates a pipeline lead from DMA
// - Company is optional - if provided or matched, we link; if not, lead stays unlinked
// - Never creates a company - leads can be converted later

import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdatePipelineLeadFromDmaV2 } from '@/lib/airtable/inboundLeads';
import { getCompanyById, findCompanyByDomain, normalizeDomain } from '@/lib/airtable/companies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields - companyId is now OPTIONAL
    const { contactEmail, gapPlanRunId, website, companyName } = body;

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

    // Telemetry
    const telemetry = {
      lead_created: false,
      lead_updated: false,
      company_linked: false,
      company_created: false, // Always false - lead-first design
    };

    // Try to find/link company (optional)
    let linkedCompanyId: string | null = body.companyId || null;
    let linkedCompanyName: string | null = companyName || null;
    let linkedCompanyWebsite: string | null = website || null;

    // If companyId provided, verify it exists
    if (body.companyId) {
      const company = await getCompanyById(body.companyId);
      if (company) {
        linkedCompanyId = company.id;
        linkedCompanyName = linkedCompanyName || company.name;
        linkedCompanyWebsite = linkedCompanyWebsite || company.website || null;
        telemetry.company_linked = true;
        console.log(`[DMA Contact] Using provided companyId: ${company.id} (${company.name})`);
      } else {
        console.warn(`[DMA Contact] Provided companyId ${body.companyId} not found, will try domain match`);
        linkedCompanyId = null;
      }
    }

    // If no companyId or it wasn't found, try to match by domain
    if (!linkedCompanyId && website) {
      const domain = normalizeDomain(website);
      const matchedCompany = await findCompanyByDomain(domain);
      if (matchedCompany) {
        linkedCompanyId = matchedCompany.id;
        linkedCompanyName = linkedCompanyName || matchedCompany.name;
        linkedCompanyWebsite = linkedCompanyWebsite || matchedCompany.website || null;
        telemetry.company_linked = true;
        console.log(`[DMA Contact] Matched company by domain ${domain}: ${matchedCompany.id} (${matchedCompany.name})`);
      } else {
        console.log(`[DMA Contact] No existing company found for domain ${domain} - lead will remain unlinked (company_created=false)`);
      }
    }

    // Create or update the lead (now with optional company linking)
    const result = await createOrUpdatePipelineLeadFromDmaV2({
      contactEmail,
      contactName: body.contactName,
      companyName: linkedCompanyName || companyName,
      website: linkedCompanyWebsite || website,
      linkedCompanyId, // May be null
      gapPlanRunId,
      gapOverallScore: body.gapOverallScore,
      gapMaturityStage: body.gapMaturityStage,
      contactMessage: body.contactMessage,
    });

    if (!result.lead) {
      return NextResponse.json(
        { error: 'Failed to create lead' },
        { status: 500 }
      );
    }

    telemetry.lead_created = result.isNew;
    telemetry.lead_updated = !result.isNew;

    console.log('[DMA Contact] Completed:', {
      leadId: result.lead.id,
      isNew: result.isNew,
      companyLinked: telemetry.company_linked,
      companyCreated: telemetry.company_created, // Always false
    });

    return NextResponse.json({
      success: true,
      leadId: result.lead.id,
      isNew: result.isNew,
      companyLinked: telemetry.company_linked,
      message: 'Contact request received successfully',
      telemetry,
    });
  } catch (error) {
    console.error('[DMA Contact] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
