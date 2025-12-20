// app/api/os/companies/[companyId]/route.ts
// Company API - GET and PATCH for company profile

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompany } from '@/lib/airtable/companies';

export const runtime = 'nodejs';

/**
 * GET /api/os/companies/[companyId]
 * Fetch a single company by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId' },
        { status: 400 }
      );
    }

    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Company API] Error fetching:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/companies/[companyId]
 * Update company fields (name, website, domain, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId' },
        { status: 400 }
      );
    }

    // Build updates object from allowed fields
    const updates: Parameters<typeof updateCompany>[1] = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.website !== undefined) updates.website = body.website;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.industry !== undefined) updates.industry = body.industry;
    if (body.companyType !== undefined) updates.companyType = body.companyType;
    if (body.stage !== undefined) updates.stage = body.stage;
    if (body.sizeBand !== undefined) updates.sizeBand = body.sizeBand;
    if (body.source !== undefined) updates.source = body.source;
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.primaryContactName !== undefined) updates.primaryContactName = body.primaryContactName;
    if (body.primaryContactEmail !== undefined) updates.primaryContactEmail = body.primaryContactEmail;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const company = await updateCompany(companyId, updates);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update company' },
        { status: 500 }
      );
    }

    console.log(`[Company API] Updated ${companyId}:`, Object.keys(updates));

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Company API] Error updating:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
