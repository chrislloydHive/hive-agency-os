// app/api/os/companies/[companyId]/weekly-brief/route.ts
// GET /api/os/companies/[companyId]/weekly-brief
//
// Fetches the weekly brief for a company.
// Query params:
// - weekKey: 'current' | 'YYYY-Www' (defaults to current week)
//
// Returns:
// - brief: WeeklyBrief | null
// - weekKey: string
// - hasHistory: boolean

import { NextRequest, NextResponse } from 'next/server';
import {
  getBriefByCompanyWeek,
  getLatestBrief,
  hasHistory,
} from '@/lib/os/briefs/briefStore';
import { getWeekKey } from '@/lib/types/weeklyBrief';
import type { WeeklyBriefResponse } from '@/lib/types/weeklyBrief';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<WeeklyBriefResponse | { error: string }>> {
  try {
    const { companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Parse weekKey from query params
    const { searchParams } = new URL(request.url);
    const weekKeyParam = searchParams.get('weekKey') || 'current';

    let weekKey: string;
    let brief;

    if (weekKeyParam === 'current' || weekKeyParam === 'latest') {
      // Get latest brief for this company
      weekKey = getWeekKey();
      brief = getLatestBrief(companyId);
    } else {
      // Validate week key format
      if (!/^\d{4}-W\d{2}$/.test(weekKeyParam)) {
        return NextResponse.json(
          { error: 'Invalid weekKey format. Expected YYYY-Www (e.g., 2025-W03)' },
          { status: 400 }
        );
      }
      weekKey = weekKeyParam;
      brief = getBriefByCompanyWeek(companyId, weekKey);
    }

    const response: WeeklyBriefResponse = {
      brief,
      weekKey,
      hasHistory: hasHistory(companyId),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[WeeklyBrief:GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
