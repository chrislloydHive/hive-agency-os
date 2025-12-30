// app/api/prospects/create/route.ts
// Thin wrapper for creating prospects via the generic company create API
//
// This endpoint maintains backwards compatibility with the old prospect creation flow.
// It simply calls the generic /api/os/companies/create with relationshipType='Prospect'.

import { NextRequest, NextResponse } from 'next/server';
import type { CompanyRecord } from '@/lib/airtable/companies';

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

    // Map to generic company create API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/os/companies/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body.name,
        url: body.website,
        relationshipType: 'Prospect',
        // Don't run diagnostics here - wizard handles this separately via /onboarding/run-all
        runInitialDiagnostics: false,
        industry: body.industry,
        companyType: body.companyType,
        sizeBand: body.sizeBand,
        icpFitScore: body.icpFitScore,
        owner: body.owner,
        notes: body.notes,
        createOpportunity: body.createOpportunity,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform response to match old format for backwards compatibility
    return NextResponse.json({
      success: data.success,
      companyId: data.companyId,
      company: {
        id: data.company.id,
        name: data.company.name,
        domain: data.company.domain,
        stage: data.company.stage,
      },
      relationshipType: data.relationshipType,
      operations: {
        opportunityCreated: data.opportunityCreated,
        gapSnapshotTriggered: data.diagnosticsTriggered,
        websiteLabTriggered: false,
        gapRunsLinked: data.gapRunsLinked,
      },
      diagnosticsRunId: data.diagnosticsRunId,
    });
  } catch (error) {
    console.error('[Prospects] Error creating prospect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
