// app/api/experiments/stats/route.ts
// API route for experiment statistics

import { NextResponse } from 'next/server';
import { getExperimentStats } from '@/lib/airtable/experiments';

/**
 * GET /api/experiments/stats
 * Get experiment statistics
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || undefined;

    const stats = await getExperimentStats(companyId);

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error('[API Experiments] Error fetching stats:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch experiment stats' },
      { status: 500 }
    );
  }
}
