// app/api/media/planning/prefill/route.ts
// API route to get prefilled media planning inputs for a company

import { NextRequest, NextResponse } from 'next/server';
import { buildPrefilledMediaPlanningInputs } from '@/lib/media/planningInputPrefill';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Getting prefilled planning inputs for company: ${companyId}`);

    const result = await buildPrefilledMediaPlanningInputs(companyId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] Failed to get prefilled inputs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get prefilled inputs',
      },
      { status: 500 }
    );
  }
}
