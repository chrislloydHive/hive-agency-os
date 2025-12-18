// app/api/os/companies/[companyId]/briefs/route.ts
// List briefs for a company

import { NextRequest, NextResponse } from 'next/server';
import { getBriefsForCompany } from '@/lib/airtable/briefs';

type Params = { params: Promise<{ companyId: string }> };

/**
 * GET /api/os/companies/[companyId]/briefs
 * List all briefs for a company
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { companyId } = await params;

    const briefs = await getBriefsForCompany(companyId);

    return NextResponse.json({ briefs });
  } catch (error) {
    console.error('[API] Failed to list briefs:', error);
    return NextResponse.json(
      { error: 'Failed to list briefs' },
      { status: 500 }
    );
  }
}
