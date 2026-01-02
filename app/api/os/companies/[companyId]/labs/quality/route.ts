// app/api/os/companies/[companyId]/labs/quality/route.ts
// Lab Quality Score API
//
// Returns current and historical quality scores for all labs.
// Includes regression detection and quality warnings.
//
// GET /api/os/companies/[companyId]/labs/quality
// Response: LabQualityResponse

import { NextRequest, NextResponse } from 'next/server';
import { buildLabQualityResponse } from '@/lib/os/diagnostics/qualityScoreStore';
import type { LabQualityResponse } from '@/lib/types/labQualityScore';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/labs/quality
 *
 * Returns quality scores for all labs including:
 * - Current scores per lab
 * - Historical scores (up to 10 per lab)
 * - Regression indicators
 * - Summary statistics
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        {
          ok: false,
          companyId: '',
          current: {
            websiteLab: null,
            competitionLab: null,
            brandLab: null,
            gapPlan: null,
            audienceLab: null,
          },
          history: {
            websiteLab: [],
            competitionLab: [],
            brandLab: [],
            gapPlan: [],
            audienceLab: [],
          },
          regressions: [],
          summary: { averageScore: 0, lowestLab: null, highestLab: null, labsWithWarnings: [] },
          error: 'Missing companyId',
        } satisfies LabQualityResponse,
        { status: 400 }
      );
    }

    const response = await buildLabQualityResponse(companyId);
    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Lab Quality API] Error:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        companyId: '',
        current: {
          websiteLab: null,
          competitionLab: null,
          brandLab: null,
          gapPlan: null,
          audienceLab: null,
        },
        history: {
          websiteLab: [],
          competitionLab: [],
          brandLab: [],
          gapPlan: [],
          audienceLab: [],
        },
        regressions: [],
        summary: {
          averageScore: 0,
          lowestLab: null,
          highestLab: null,
          labsWithWarnings: [],
        },
        error: errorMessage,
      } as LabQualityResponse,
      { status: 500 }
    );
  }
}
