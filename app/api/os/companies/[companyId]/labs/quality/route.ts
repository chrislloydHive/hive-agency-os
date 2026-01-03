// app/api/os/companies/[companyId]/labs/quality/route.ts
// Lab Quality Score API
//
// Returns current and historical quality scores for all labs.
// Includes regression detection and quality warnings.
//
// GET /api/os/companies/[companyId]/labs/quality
// Response: LabQualityResponse

import { NextRequest, NextResponse } from 'next/server';
import { computeContextLabQuality } from '@/lib/os/quality/contextLabQuality';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getCanonicalCompetitionRun } from '@/lib/competition/getCanonicalCompetitionRun';

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
        { ok: false, error: 'Missing companyId' },
        { status: 400 }
      );
    }

    // Compute from Context V4 proposed fields
    const quality = await computeContextLabQuality(companyId);

    // Also surface whether runs exist (for Insufficient)
    const websiteRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
    const brandRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
    const gapRun = await getLatestRunForCompanyAndTool(companyId, 'gapPlan');
    const audienceRun = await getLatestRunForCompanyAndTool(companyId, 'audienceLab');
    const competitionRun = await getCanonicalCompetitionRun(companyId);

    return NextResponse.json({
      ok: true,
      companyId,
      current: {
        websiteLab: { ...quality.websiteLab, runId: websiteRun?.id ?? null },
        brandLab: { ...quality.brandLab, runId: brandRun?.id ?? null },
        gapPlan: { ...quality.gapPlan, runId: gapRun?.id ?? null },
        competitionLab: { ...quality.competitionLab, runId: competitionRun?.runId ?? null },
        audienceLab: { ...quality.audienceLab, runId: audienceRun?.id ?? null },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Lab Quality API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
