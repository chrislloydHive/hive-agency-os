// app/api/os/pipeline/opportunities/route.ts
// Pipeline Opportunities API
// Returns generated opportunities from various sources

import { NextRequest, NextResponse } from 'next/server';
import {
  generateOpportunities,
  getOpportunitySummary,
} from '@/lib/os/pipeline/opportunityEngine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Optional filters
    const companyId = searchParams.get('companyId');
    const includeAnalytics = searchParams.get('includeAnalytics') !== 'false';
    const includeGrowthPlans = searchParams.get('includeGrowthPlans') === 'true';

    console.log('[Opportunities API] Generating...', {
      companyId,
      includeAnalytics,
      includeGrowthPlans,
    });

    const opportunities = await generateOpportunities({
      includeAnalytics,
      includeGrowthPlans,
      companyFilter: companyId ? [companyId] : undefined,
    });

    const summary = getOpportunitySummary(opportunities);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
      opportunities,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Opportunities API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// POST to refresh/rebuild opportunities (can be extended to store)
export async function POST(request: NextRequest) {
  try {
    let companyId: string | undefined;
    try {
      const body = await request.json();
      companyId = body.companyId;
    } catch {
      // No body - that's fine
    }

    console.log('[Opportunities API] Rebuilding...', { companyId });

    const opportunities = await generateOpportunities({
      includeAnalytics: true,
      includeGrowthPlans: true,
      companyFilter: companyId ? [companyId] : undefined,
    });

    const summary = getOpportunitySummary(opportunities);

    return NextResponse.json({
      ok: true,
      message: 'Opportunities rebuilt',
      generatedAt: new Date().toISOString(),
      summary,
      opportunities,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Opportunities API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
