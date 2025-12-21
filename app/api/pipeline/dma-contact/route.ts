// app/api/pipeline/dma-contact/route.ts
// API endpoint for DMA Full GAP "Contact Us" form submissions
//
// LEAD-FIRST DESIGN: Leads exist independently before Company/Opportunity.
// AUTO-CONVERT PIPELINE (OS-First Model):
// 1. Creates or updates Inbound Lead from DMA (Status="New", NO Pipeline Stage)
// 2. Upserts Company by domain (idempotent - never duplicates)
// 3. Upserts Opportunity for company (idempotent - never duplicates)
// 4. Links Lead → Opportunity
//
// Idempotency: Uses getOrCreateDmaOpportunityForLead which searches by:
//   Company + Opportunity Type="Inbound Interest" + Source="DMA Full GAP" + Open Stage
// This prevents duplicates WITHOUT needing a "Converted Opportunity" field.

import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdatePipelineLeadFromDmaV2, updateLeadLinkedOpportunity, linkLeadToCompany } from '@/lib/airtable/inboundLeads';
import { getCompanyById, findCompanyByDomain, normalizeDomain, upsertCompanyByDomain } from '@/lib/airtable/companies';
import { getOrCreateDmaOpportunityForLead } from '@/lib/airtable/opportunities';

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
      company_created: false,
      opportunity_created: false,
      opportunity_linked: false,
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

    // AUTO-CONVERT: Upsert Company and Opportunity if we have a website
    let opportunityId: string | null = null;
    let opportunityReused = false;
    const normalizedDomain = website ? normalizeDomain(website) : null;

    if (normalizedDomain) {
      try {
        // Step 1: Upsert Company by domain (idempotent)
        const companyResult = await upsertCompanyByDomain(
          normalizedDomain,
          companyName || undefined,
          website || undefined,
          'DMA' // source
        );

        telemetry.company_created = companyResult.isNew;
        telemetry.company_linked = true;

        const companyForOpportunity = companyResult.company;
        console.log(`[DMA Contact] Company upsert: ${companyForOpportunity.id} (${companyForOpportunity.name}), isNew=${companyResult.isNew}`);

        // Step 2: Link lead to company if not already linked
        if (!linkedCompanyId || linkedCompanyId !== companyForOpportunity.id) {
          await linkLeadToCompany(result.lead.id, companyForOpportunity.id);
          console.log(`[DMA Contact] Linked lead ${result.lead.id} to company ${companyForOpportunity.id}`);
        }

        // Step 3: Upsert Opportunity (idempotent - won't duplicate)
        // Search criteria: Company + Type="Inbound Interest" + Source="DMA Full GAP" + Open Stage
        const opportunityResult = await getOrCreateDmaOpportunityForLead({
          companyId: companyForOpportunity.id,
          inboundLeadId: result.lead.id,
          normalizedDomain,
        });

        opportunityId = opportunityResult.opportunity.id;
        opportunityReused = opportunityResult.reused;
        telemetry.opportunity_created = opportunityResult.isNew;
        telemetry.opportunity_linked = true;

        console.log(`[DMA Contact] Opportunity upsert: ${opportunityId}, isNew=${opportunityResult.isNew}, reused=${opportunityResult.reused}`);

        // Step 4: Link lead to opportunity
        await updateLeadLinkedOpportunity(result.lead.id, opportunityId);
        console.log(`[DMA Contact] Linked lead ${result.lead.id} to opportunity ${opportunityId}`);

      } catch (conversionError) {
        // Non-fatal - lead was still created, just log the error
        console.error('[DMA Contact] Auto-convert failed (lead still created):', conversionError);
      }
    } else {
      console.log('[DMA Contact] No website provided - skipping auto-convert');
    }

    // Build response
    const converted = opportunityId !== null;
    const companyId = telemetry.company_linked ? (linkedCompanyId || null) : null;

    console.log('[DMA Contact] Completed:', {
      leadId: result.lead.id,
      isNew: result.isNew,
      opportunityId,
      converted,
      reused: opportunityReused,
      ...telemetry,
    });

    return NextResponse.json({
      ok: true,
      inboundLeadId: result.lead.id,
      companyId,
      opportunityId,
      converted,
      reused: opportunityReused,
      // Legacy fields for backwards compatibility
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
