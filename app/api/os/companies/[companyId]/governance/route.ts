// app/api/os/companies/[companyId]/governance/route.ts
// Governance Change Log API
//
// GET: Get change history for company

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyChanges,
  getGovernanceStats,
} from '@/lib/os/programs/governanceLog';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const since = searchParams.get('since') || undefined;
    const changeType = searchParams.get('type') as 'intensity_changed' | 'status_changed' | undefined;

    const changes = getCompanyChanges(companyId, { limit, since, changeType });
    const stats = getGovernanceStats(companyId);

    return NextResponse.json({
      success: true,
      changes,
      stats,
    });
  } catch (error) {
    console.error('[Governance GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
