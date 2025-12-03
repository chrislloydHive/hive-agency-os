// app/api/os/companies/[companyId]/media/work/route.ts
// API route to generate Work items from Media scorecards
//
// POST /api/os/companies/[companyId]/media/work
// Body (optional):
// {
//   "thresholds": {
//     "visibility": 50,
//     "demand": 50,
//     "conversion": 50,
//     "minSpendForDemandAlert": 100
//   }
// }

import { NextRequest, NextResponse } from 'next/server';
import { getStoreScorecards } from '@/lib/media/analytics';
import { analyzeAndCreateMediaWork, type MediaWorkThresholds } from '@/lib/media/work';

interface WorkRequestBody {
  thresholds?: Partial<MediaWorkThresholds>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const resolvedParams = await params;
  const { companyId } = resolvedParams;

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Company ID is required' },
      { status: 400 }
    );
  }

  try {
    // Parse request body
    let body: WorkRequestBody = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log('[Media Work API] Starting work generation:', {
      companyId,
      thresholds: body.thresholds,
    });

    // Get store scorecards
    const scorecards = await getStoreScorecards(companyId);

    if (scorecards.length === 0) {
      return NextResponse.json({
        ok: true,
        result: {
          companyId,
          draftsCount: 0,
          createdCount: 0,
          message: 'No stores found for this company',
        },
      });
    }

    // Analyze scorecards and create work items
    const result = await analyzeAndCreateMediaWork(
      companyId,
      scorecards,
      body.thresholds
    );

    console.log('[Media Work API] Work generation complete:', {
      companyId,
      draftsCount: result.drafts.length,
      createdCount: result.created.length,
      errors: result.errors,
    });

    return NextResponse.json({
      ok: true,
      result: {
        companyId,
        draftsCount: result.drafts.length,
        createdCount: result.created.length,
        errors: result.errors,
        drafts: result.drafts.map((d) => ({
          title: d.title,
          scoreType: d.scoreType,
          score: d.score,
          severity: d.severity,
          storeName: d.storeName,
        })),
        created: result.created.map((w) => ({
          id: w.id,
          title: w.title,
        })),
      },
    });
  } catch (error) {
    console.error('[Media Work API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Work generation failed',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what work items would be generated
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const resolvedParams = await params;
  const { companyId } = resolvedParams;

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Company ID is required' },
      { status: 400 }
    );
  }

  try {
    const scorecards = await getStoreScorecards(companyId);

    // Count stores needing attention
    const needsAttention = {
      visibility: scorecards.filter((s) => s.visibilityScore < 50).length,
      demand: scorecards.filter((s) => s.demandScore < 50 && s.spend >= 100).length,
      conversion: scorecards.filter((s) => s.conversionScore < 50 && s.demandScore >= 50).length,
    };

    return NextResponse.json({
      ok: true,
      companyId,
      storeCount: scorecards.length,
      needsAttention,
      potentialWorkItems:
        needsAttention.visibility + needsAttention.demand + needsAttention.conversion,
      usage: {
        method: 'POST',
        body: {
          thresholds: {
            visibility: 'Score threshold for visibility alerts (default: 50)',
            demand: 'Score threshold for demand alerts (default: 50)',
            conversion: 'Score threshold for conversion alerts (default: 50)',
            minSpendForDemandAlert: 'Minimum spend to trigger demand alert (default: 100)',
          },
        },
      },
    });
  } catch (error) {
    console.error('[Media Work API] Preview error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Preview failed',
      },
      { status: 500 }
    );
  }
}
