// app/api/os/companies/[companyId]/rfps/[rfpId]/route.ts
// Individual RFP API - Get, Update, Delete

import { NextResponse } from 'next/server';
import { getRfpWithDetails, updateRfp, deleteRfp } from '@/lib/airtable/rfp';
import { RfpInputSchema } from '@/lib/types/rfp';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/rfps/[rfpId]
 * Get RFP with all details (sections, bindings)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { rfpId } = await params;
    const rfpDetails = await getRfpWithDetails(rfpId);

    if (!rfpDetails) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    return NextResponse.json(rfpDetails);
  } catch (error) {
    console.error('[rfps/[rfpId]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch RFP' }, { status: 500 });
  }
}

/**
 * PUT /api/os/companies/[companyId]/rfps/[rfpId]
 * Update RFP
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { rfpId } = await params;
    const body = await request.json();
    const parsed = RfpInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rfp = await updateRfp(rfpId, parsed.data);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    return NextResponse.json({ rfp });
  } catch (error) {
    console.error('[rfps/[rfpId]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update RFP' }, { status: 500 });
  }
}

/**
 * DELETE /api/os/companies/[companyId]/rfps/[rfpId]
 * Delete RFP and all related sections/bindings
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { rfpId } = await params;
    const deleted = await deleteRfp(rfpId);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete RFP' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[rfps/[rfpId]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete RFP' }, { status: 500 });
  }
}
