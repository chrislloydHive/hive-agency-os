// app/api/os/companies/[companyId]/rfps/[rfpId]/bindings/route.ts
// RFP Bindings API - Get and Update

import { NextResponse } from 'next/server';
import { getRfpBindings, updateRfpBindings } from '@/lib/airtable/rfp';
import { RfpBindingsInputSchema } from '@/lib/types/rfp';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/rfps/[rfpId]/bindings
 * Get RFP bindings
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { rfpId } = await params;
    const bindings = await getRfpBindings(rfpId);

    if (!bindings) {
      return NextResponse.json({ error: 'Bindings not found' }, { status: 404 });
    }

    return NextResponse.json({ bindings });
  } catch (error) {
    console.error('[rfps/[rfpId]/bindings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bindings' }, { status: 500 });
  }
}

/**
 * PUT /api/os/companies/[companyId]/rfps/[rfpId]/bindings
 * Update RFP bindings
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { rfpId } = await params;
    const body = await request.json();

    // Get existing bindings to get the ID
    const existing = await getRfpBindings(rfpId);
    if (!existing) {
      return NextResponse.json({ error: 'Bindings not found' }, { status: 404 });
    }

    const parsed = RfpBindingsInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const bindings = await updateRfpBindings(existing.id, parsed.data);

    if (!bindings) {
      return NextResponse.json({ error: 'Failed to update bindings' }, { status: 500 });
    }

    return NextResponse.json({ bindings });
  } catch (error) {
    console.error('[rfps/[rfpId]/bindings] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update bindings' }, { status: 500 });
  }
}
