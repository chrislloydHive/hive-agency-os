// app/api/os/companies/[companyId]/media-lab/route.ts
// GET /api/os/companies/[companyId]/media-lab - Fetch Media Lab data for a company

import { NextRequest, NextResponse } from 'next/server';
import { getMediaLabForCompany } from '@/lib/media-lab/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    console.log('[api/media-lab] Fetching Media Lab data for company:', companyId);

    const data = await getMediaLabForCompany(companyId);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error('[api/media-lab] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
