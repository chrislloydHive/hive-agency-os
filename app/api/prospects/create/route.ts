// app/api/prospects/create/route.ts
// API endpoint for creating new prospects via wizard

import { NextRequest, NextResponse } from 'next/server';
import {
  findCompanyByDomain,
  createCompany,
  type CompanyRecord,
} from '@/lib/airtable/companies';
import { createOpportunity } from '@/lib/airtable/opportunities';
import { extractDomain } from '@/lib/utils/extractDomain';
import { linkGapRunsToCompanyByUrl } from '@/lib/airtable/linkGapRuns';

export const maxDuration = 60;

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
    const body: CreateProspectRequest = await request.json();
    console.log('[Prospects] Creating new prospect:', body.name);

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Check for existing company by domain if website provided
    if (body.website) {
      const domain = extractDomain(body.website);
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
    // Stage is always "Prospect" for manual creation
    // Source is "Manual Entry" to distinguish from GAP-created companies
    const company = await createCompany({
      name: body.name.trim(),
      website: body.website || undefined,
      industry: body.industry || undefined,
      companyType: body.companyType || undefined,
      sizeBand: body.sizeBand || undefined,
      stage: 'Prospect',
      source: 'Manual Entry',
      icpFitScore: (body.icpFitScore as 'A' | 'B' | 'C') || undefined,
      owner: body.owner || undefined,
      notes: body.notes || undefined,
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Failed to create company. Check server logs for details.' },
        { status: 500 }
      );
    }

    console.log(`[Prospects] Created company: ${company.name} (${company.id})`);

    // Track async operations
    const operations: Promise<void>[] = [];

    // Link existing GAP runs to this company (if website provided)
    // This runs synchronously so GAP data is available immediately when user views company
    let gapRunsLinked = { gapPlanRunsLinked: 0, gapIaRunsLinked: 0 };
    if (body.website) {
      try {
        const linkResult = await linkGapRunsToCompanyByUrl(company.id, body.website);
        gapRunsLinked = linkResult;
        if (linkResult.gapPlanRunsLinked > 0 || linkResult.gapIaRunsLinked > 0) {
          console.log(`[Prospects] Linked ${linkResult.gapPlanRunsLinked} GAP-Plan runs and ${linkResult.gapIaRunsLinked} GAP-IA runs to ${company.name}`);
        }
        if (linkResult.errors.length > 0) {
          console.warn(`[Prospects] GAP linking warnings:`, linkResult.errors);
        }
      } catch (error) {
        console.error(`[Prospects] Failed to link GAP runs:`, error);
      }
    }

    // Create opportunity if requested
    if (body.createOpportunity) {
      operations.push(
        (async () => {
          try {
            await createOpportunity({
              companyId: company.id,
              name: `${company.name} - Initial Opportunity`,
              stage: 'discovery',
              owner: body.owner || undefined,
              notes: body.notes || undefined,
            });
            console.log(`[Prospects] Created opportunity for ${company.name}`);
          } catch (error) {
            console.error(`[Prospects] Failed to create opportunity:`, error);
          }
        })()
      );
    }

    // Run GAP Snapshot if requested
    if (body.runGapSnapshot && body.website) {
      operations.push(
        (async () => {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/os/diagnostics/run/gap-snapshot`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: company.id,
                  url: body.website,
                }),
              }
            );
            if (response.ok) {
              console.log(`[Prospects] Triggered GAP Snapshot for ${company.name}`);
            } else {
              console.error(`[Prospects] GAP Snapshot failed:`, await response.text());
            }
          } catch (error) {
            console.error(`[Prospects] Failed to trigger GAP Snapshot:`, error);
          }
        })()
      );
    }

    // Run Website Lab if requested
    if (body.runWebsiteLab && body.website) {
      operations.push(
        (async () => {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/os/diagnostics/run/website-lab`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: company.id,
                  url: body.website,
                }),
              }
            );
            if (response.ok) {
              console.log(`[Prospects] Triggered Website Lab for ${company.name}`);
            } else {
              console.error(`[Prospects] Website Lab failed:`, await response.text());
            }
          } catch (error) {
            console.error(`[Prospects] Failed to trigger Website Lab:`, error);
          }
        })()
      );
    }

    // Wait for all operations (don't block response on them)
    // These run in background - user gets immediate response
    Promise.all(operations).catch((error) => {
      console.error('[Prospects] Background operations error:', error);
    });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
      },
      operations: {
        opportunityCreated: body.createOpportunity || false,
        gapSnapshotTriggered: (body.runGapSnapshot && body.website) || false,
        websiteLabTriggered: (body.runWebsiteLab && body.website) || false,
        gapRunsLinked: gapRunsLinked.gapPlanRunsLinked + gapRunsLinked.gapIaRunsLinked,
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
