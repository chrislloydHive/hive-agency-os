// app/api/os/companies/create/route.ts
// Generic company creation API endpoint
//
// Creates a company record with optional initial diagnostics.
// Supports all relationship types: Prospect, Client, Partner, Internal, Other
//
// The old /api/prospects/create endpoint is a thin wrapper around this.

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

// ============================================================================
// Types
// ============================================================================

/**
 * Valid relationship types for companies
 */
export type CompanyRelationshipType = 'Prospect' | 'Client' | 'Partner' | 'Internal' | 'Other';

/**
 * Request body for creating a company
 */
export interface CreateCompanyRequest {
  name: string;
  url?: string;
  website?: string; // Alias for url
  relationshipType?: CompanyRelationshipType;
  runInitialDiagnostics?: boolean;
  // Additional metadata
  industry?: string;
  companyType?: CompanyRecord['companyType'];
  sizeBand?: CompanyRecord['sizeBand'];
  icpFitScore?: 'A' | 'B' | 'C';
  owner?: string;
  notes?: string;
  // Sales actions
  createOpportunity?: boolean;
}

/**
 * Response from company creation
 */
export interface CreateCompanyResponse {
  success: boolean;
  companyId: string;
  company: {
    id: string;
    name: string;
    domain: string;
    stage: string;
    relationshipType: CompanyRelationshipType;
  };
  relationshipType: CompanyRelationshipType;
  diagnosticsTriggered: boolean;
  diagnosticsRunId?: string;
  contextInitialized: boolean;
  opportunityCreated: boolean;
  gapRunsLinked: number;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateCompanyRequest = await request.json();

    // Get website URL (support both 'url' and 'website' fields)
    const websiteUrl = body.url || body.website;
    const relationshipType = body.relationshipType || 'Prospect';
    const runDiagnostics = body.runInitialDiagnostics !== false; // Default true

    console.log('[Companies] Creating new company:', {
      name: body.name,
      url: websiteUrl,
      relationshipType,
      runDiagnostics,
    });

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Check for existing company by domain if website provided
    if (websiteUrl) {
      const domain = extractDomain(websiteUrl);
      if (domain) {
        const existing = await findCompanyByDomain(domain);
        if (existing) {
          console.log(`[Companies] Company already exists for domain ${domain}: ${existing.name}`);
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

    // Map relationship type to stage field
    // The stage field already supports these values
    const stage = mapRelationshipToStage(relationshipType);

    // Create the company
    const company = await createCompany({
      name: body.name.trim(),
      website: websiteUrl || undefined,
      industry: body.industry || undefined,
      companyType: body.companyType || undefined,
      sizeBand: body.sizeBand || undefined,
      stage,
      source: 'Manual Entry',
      icpFitScore: body.icpFitScore || undefined,
      owner: body.owner || undefined,
      notes: body.notes || undefined,
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Failed to create company. Check server logs for details.' },
        { status: 500 }
      );
    }

    console.log(`[Companies] Created company: ${company.name} (${company.id}) as ${relationshipType}`);

    // Track results
    let diagnosticsTriggered = false;
    let diagnosticsRunId: string | undefined;
    let contextInitialized = false;
    let opportunityCreated = false;
    let gapRunsLinked = 0;

    // Link existing GAP runs to this company (if website provided)
    if (websiteUrl) {
      try {
        const linkResult = await linkGapRunsToCompanyByUrl(company.id, websiteUrl);
        gapRunsLinked = linkResult.gapPlanRunsLinked + linkResult.gapIaRunsLinked;
        if (gapRunsLinked > 0) {
          console.log(`[Companies] Linked ${gapRunsLinked} GAP runs to ${company.name}`);
        }
      } catch (error) {
        console.error(`[Companies] Failed to link GAP runs:`, error);
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
        console.log(`[Companies] Created opportunity for ${company.name}`);
      } catch (error) {
        console.error(`[Companies] Failed to create opportunity:`, error);
      }
    }

    // Run initial diagnostics if requested and URL provided
    // This runs the full GAP-IA pipeline which:
    // - Creates a GAP-IA Run record
    // - Writes to ContextGraph via gapIaWriter
    // - Creates DiagnosticRun record
    if (runDiagnostics && websiteUrl) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/os/diagnostics/run/gap-snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            url: websiteUrl,
          }),
        });

        if (response.ok) {
          const diagResult = await response.json().catch(() => ({}));
          diagnosticsTriggered = true;
          diagnosticsRunId = diagResult.run?.id;
          contextInitialized = true;
          console.log(`[Companies] Triggered GAP-IA diagnostic for ${company.name}`, { runId: diagnosticsRunId });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Companies] GAP-IA diagnostic failed:`, errorData);
        }
      } catch (error) {
        console.error(`[Companies] Failed to trigger GAP-IA diagnostic:`, error);
      }
    }

    const responseData: CreateCompanyResponse = {
      success: true,
      companyId: company.id,
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        stage: company.stage || stage || 'Prospect',
        relationshipType,
      },
      relationshipType,
      diagnosticsTriggered,
      diagnosticsRunId,
      contextInitialized,
      opportunityCreated,
      gapRunsLinked,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Companies] Error creating company:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map relationship type to company stage field
 */
function mapRelationshipToStage(relationshipType: CompanyRelationshipType): CompanyRecord['stage'] {
  switch (relationshipType) {
    case 'Prospect':
      return 'Prospect';
    case 'Client':
      return 'Client';
    case 'Internal':
      return 'Internal';
    case 'Partner':
      // Partner isn't a native stage, use 'Client' as closest match
      // The relationshipType is preserved separately in response
      return 'Client';
    case 'Other':
      return 'Prospect'; // Default to Prospect for 'Other'
    default:
      return 'Prospect';
  }
}
