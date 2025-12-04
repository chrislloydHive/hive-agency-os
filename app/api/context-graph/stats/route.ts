// app/api/context-graph/stats/route.ts
// Get context graph stats for a company

import { NextRequest, NextResponse } from 'next/server';
import { getContextGraphStats } from '@/lib/contextGraph/storage';

/**
 * GET /api/context-graph/stats?companyId=xxx
 * Get completeness stats for a company's context graph
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId is required' },
      { status: 400 }
    );
  }

  try {
    const stats = await getContextGraphStats(companyId);

    if (!stats) {
      return NextResponse.json({
        exists: false,
        completenessScore: 0,
        domainCoverage: null,
        lastFusionAt: null,
      });
    }

    return NextResponse.json({
      exists: true,
      ...stats,
    });
  } catch (error) {
    console.error('[ContextGraph Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
