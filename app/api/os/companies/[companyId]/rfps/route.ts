// app/api/os/companies/[companyId]/rfps/route.ts
// RFP List and Create API

import { NextResponse } from 'next/server';
import { getRfpsForCompany, createRfp } from '@/lib/airtable/rfp';
import { RfpInputSchema } from '@/lib/types/rfp';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/rfps
 * List all RFPs for a company
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const rfps = await getRfpsForCompany(companyId);
    return NextResponse.json({ rfps });
  } catch (error) {
    console.error('[rfps] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
  }
}

/**
 * POST /api/os/companies/[companyId]/rfps
 * Create a new RFP
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const inputWithCompany = { ...body, companyId };
    const parsed = RfpInputSchema.safeParse(inputWithCompany);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rfp = await createRfp(parsed.data);
    return NextResponse.json({ rfp }, { status: 201 });
  } catch (error) {
    console.error('[rfps] POST error:', error);
    return NextResponse.json({ error: 'Failed to create RFP' }, { status: 500 });
  }
}
