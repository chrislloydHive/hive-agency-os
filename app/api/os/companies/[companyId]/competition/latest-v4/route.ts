// app/api/os/companies/[companyId]/competition/latest-v4/route.ts
// Fetch latest Competition V4 run for UI

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRunV4 } from '@/lib/competition-v4/store';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const record = await getLatestCompetitionRunV4(companyId);

    if (!record) {
      return NextResponse.json({
        success: true,
        run: null,
        message: 'No competition V4 run found',
      });
    }

    return NextResponse.json({
      success: true,
      run: record.payload,
    });
  } catch (error) {
    console.error('[competition/latest-v4] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load competition V4 run',
      },
      { status: 500 }
    );
  }
}
