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
    // Note: Select fields can receive empty strings to clear selections.
    // The updateCompany function converts "" to null for select fields.
    const updates: Parameters<typeof updateCompany>[1] = {};

    // Identity (text fields)
    if (body.name !== undefined) updates.name = body.name;
    if (body.website !== undefined) updates.website = body.website;
    if (body.domain !== undefined) updates.domain = body.domain;

    // Classification - select fields: pass through (updateCompany converts "" → null)
    if (body.industry !== undefined) updates.industry = body.industry; // text field
    if (body.companyType !== undefined) updates.companyType = body.companyType;
    if (body.stage !== undefined) updates.stage = body.stage;
    if (body.tier !== undefined) updates.tier = body.tier;
    if (body.sizeBand !== undefined) updates.sizeBand = body.sizeBand;
    if (body.region !== undefined) updates.region = body.region; // text field
    if (body.source !== undefined) updates.source = body.source;
    if (body.lifecycleStatus !== undefined) updates.lifecycleStatus = body.lifecycleStatus; // text field

    // Contact (text fields)
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.primaryContactName !== undefined) updates.primaryContactName = body.primaryContactName;
    if (body.primaryContactEmail !== undefined) updates.primaryContactEmail = body.primaryContactEmail;
    if (body.primaryContactRole !== undefined) updates.primaryContactRole = body.primaryContactRole;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.internalNotes !== undefined) updates.internalNotes = body.internalNotes;
    if (body.tags !== undefined) updates.tags = body.tags;

    // ICP - select field
    if (body.icpFitScore !== undefined) updates.icpFitScore = body.icpFitScore;

    // Analytics (text fields mostly)
    if (body.ga4PropertyId !== undefined) updates.ga4PropertyId = body.ga4PropertyId;
    if (body.ga4Linked !== undefined) updates.ga4Linked = body.ga4Linked;
    if (body.primaryConversionEvents !== undefined) updates.primaryConversionEvents = body.primaryConversionEvents;
    if (body.searchConsoleSiteUrl !== undefined) updates.searchConsoleSiteUrl = body.searchConsoleSiteUrl;

    // Health - select field
    if (body.healthOverride !== undefined) updates.healthOverride = body.healthOverride;
    if (body.atRiskFlag !== undefined) updates.atRiskFlag = body.atRiskFlag;

    // Drive/Jobs
    if (body.driveEligible !== undefined) updates.driveEligible = body.driveEligible;
    if (body.driveProvisioningAllowed !== undefined) updates.driveProvisioningAllowed = body.driveProvisioningAllowed;
    if (body.clientCode !== undefined) updates.clientCode = body.clientCode;

    // Media - select fields
    if (body.mediaProgramStatus !== undefined) updates.mediaProgramStatus = body.mediaProgramStatus;
    if (body.mediaLabStatus !== undefined) updates.mediaLabStatus = body.mediaLabStatus;
    if (body.mediaPrimaryObjective !== undefined) updates.mediaPrimaryObjective = body.mediaPrimaryObjective;
    if (body.mediaLabNotes !== undefined) updates.mediaLabNotes = body.mediaLabNotes;

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
