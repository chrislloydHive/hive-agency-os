// app/api/os/companies/[companyId]/brief/route.ts
// Company Daily Brief API Route
//
// GET: Returns the daily brief for a company
// POST: Force regenerates the brief

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { runDailyBrief } from '@/lib/os/briefing/daily';

export const maxDuration = 60;

// ============================================================================
// GET - Get Daily Brief
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Daily briefing must be explicitly enabled
  if (!FEATURE_FLAGS.DAILY_BRIEFING_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const result = await runDailyBrief({ companyId });

    return NextResponse.json({
      ok: true,
      brief: result.brief,
      cached: result.cached,
      sources: result.sources,
    });
  } catch (error) {
    console.error('[Brief API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to generate brief' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Force Regenerate Brief
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Daily briefing must be explicitly enabled
  if (!FEATURE_FLAGS.DAILY_BRIEFING_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const result = await runDailyBrief({
      companyId,
      forceRegenerate: true,
    });

    return NextResponse.json({
      ok: true,
      brief: result.brief,
      cached: false,
      sources: result.sources,
    });
  } catch (error) {
    console.error('[Brief API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to generate brief' },
      { status: 500 }
    );
  }
}
