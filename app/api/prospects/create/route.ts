// app/api/prospects/create/route.ts
// Create a prospect (company with relationshipType='Prospect')
//
// This endpoint maintains backwards compatibility with the old prospect creation flow.
// Now directly calls the underlying functions instead of proxying to another API route.

import { NextRequest, NextResponse } from 'next/server';
import {
  findCompanyByDomain,
  createCompany,
  type CompanyRecord,
} from '@/lib/airtable/companies';
import { createOpportunity } from '@/lib/airtable/opportunities';
import { extractDomain } from '@/lib/utils/extractDomain';
import { linkGapRunsToCompanyByUrl } from '@/lib/airtable/linkGapRuns';

export const maxDuration = 120;

interface CreateProspectRequest {
  name: string;
  website?: string;
  industry?: string;
  companyType?: CompanyRecord['companyType'];
  sizeBand?: CompanyRecord['sizeBand'];
  icpFitScore?: string;
  owner?: string;
  notes?: string;
  createOpportunity?: boolean;
  runGapSnapshot?: boolean;
  runWebsiteLab?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Handle empty or malformed request body
    let body: CreateProspectRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    if (!body || !body.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const websiteUrl = body.website;

    console.log('[Prospects] Creating prospect:', {
      name: body.name,
      url: websiteUrl,
    });

    // Check for existing company by domain if website provided
    if (websiteUrl) {
      const domain = extractDomain(websiteUrl);
      if (domain) {
        const existing = await findCompanyByDomain(domain);
        if (existing) {
          console.log(`[Prospects] Company already exists for domain ${domain}: ${existing.name}`);
          return NextResponse.json(
            {
              error: `A company already exists for domain ${domain}`,
              existingCompanyId: existing.id,
              existingCompanyName: existing.name,
            },
            { status: 409 }
          );
        }
      }
    }

    // Create the company
    const company = await createCompany({
      name: body.name.trim(),
      website: websiteUrl || undefined,
      industry: body.industry || undefined,
      companyType: body.companyType || undefined,
      sizeBand: body.sizeBand || undefined,
      stage: 'Prospect',
      source: 'Manual Entry',
      icpFitScore: body.icpFitScore as 'A' | 'B' | 'C' | undefined,
      owner: body.owner || undefined,
      notes: body.notes || undefined,
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Failed to create company. Check server logs for details.' },
        { status: 500 }
      );
    }

    console.log(`[Prospects] Created prospect: ${company.name} (${company.id})`);

    // Track results
    let opportunityCreated = false;
    let gapRunsLinked = 0;

    // Link existing GAP runs to this company (if website provided)
    if (websiteUrl) {
      try {
        const linkResult = await linkGapRunsToCompanyByUrl(company.id, websiteUrl);
        gapRunsLinked = linkResult.gapPlanRunsLinked + linkResult.gapIaRunsLinked;
        if (gapRunsLinked > 0) {
          console.log(`[Prospects] Linked ${gapRunsLinked} GAP runs to ${company.name}`);
        }
      } catch (error) {
        console.error(`[Prospects] Failed to link GAP runs:`, error);
      }
    }

    // Create opportunity if requested
    if (body.createOpportunity) {
      try {
        await createOpportunity({
          companyId: company.id,
          name: `${company.name} - Initial Opportunity`,
          stage: 'interest_confirmed',
          owner: body.owner || undefined,
          notes: body.notes || undefined,
        });
        opportunityCreated = true;
        console.log(`[Prospects] Created opportunity for ${company.name}`);
      } catch (error) {
        console.error(`[Prospects] Failed to create opportunity:`, error);
      }
    }

    // Return response in backwards-compatible format
    return NextResponse.json({
      success: true,
      companyId: company.id,
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        stage: company.stage || 'Prospect',
      },
      relationshipType: 'Prospect',
      operations: {
        opportunityCreated,
        gapSnapshotTriggered: false,
        websiteLabTriggered: false,
        gapRunsLinked,
      },
    });
  } catch (error) {
    console.error('[Prospects] Error creating prospect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
