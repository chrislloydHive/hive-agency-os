// app/api/os/companies/[companyId]/competition/run/route.ts
// Competition Lab API - Trigger a new competition run

import { NextRequest, NextResponse } from 'next/server';
import { runCompetitionLab } from '@/lib/competition';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/competition/run
 * Trigger a new competition discovery run
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    console.log(`[competition/api] Starting competition run for company: ${companyId}`);

    // Run the competition lab
    const result = await runCompetitionLab(companyId);

    console.log(`[competition/api] Competition run completed: ${result.runId}`);

    return NextResponse.json({
      success: true,
      runId: result.runId,
      status: result.status,
      summary: result.summary,
      competitors: result.competitors,
    });
  } catch (error) {
    console.error('[competition/api] Error running competition lab:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
