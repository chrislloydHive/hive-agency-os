// app/api/os/companies/[companyId]/runbook/route.ts
// Runbook API - Weekly Operator Checklist
//
// GET: Get runbook checklist with completion status
// POST: Mark item as completed/skipped

import { NextRequest, NextResponse } from 'next/server';
import {
  getWeekKey,
  buildRunbookChecklist,
  calculateRunbookSummary,
  markRunbookItemComplete,
  markRunbookItemSkipped,
  resetRunbookItem,
  getRunbookForIntensity,
  groupRunbookByDomain,
  DOMAIN_DISPLAY_ORDER,
  CAR_TOYS_STANDARD_RUNBOOK,
} from '@/lib/os/programs/runbook';
import type { IntensityLevel } from '@/lib/types/programTemplate';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);

    const weekKey = searchParams.get('weekKey') || getWeekKey();
    const intensity = (searchParams.get('intensity') as IntensityLevel) || 'Standard';

    // Get runbook items for intensity
    const items = getRunbookForIntensity(intensity);

    // Build checklist with completion status
    const checklist = buildRunbookChecklist(companyId, items, weekKey);

    // Group by domain
    const byDomain = groupRunbookByDomain(checklist);

    // Calculate summary
    const summary = calculateRunbookSummary(companyId, items, weekKey);

    return NextResponse.json({
      success: true,
      weekKey,
      intensity,
      summary,
      domainOrder: DOMAIN_DISPLAY_ORDER,
      byDomain,
      checklist,
    });
  } catch (error) {
    console.error('[Runbook GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const body = await request.json();

    const { itemId, action, notes, weekKey, completedBy } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 }
      );
    }

    if (!['complete', 'skip', 'reset'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "complete", "skip", or "reset"' },
        { status: 400 }
      );
    }

    const week = weekKey || getWeekKey();

    let completion;
    switch (action) {
      case 'complete':
        completion = markRunbookItemComplete(companyId, itemId, {
          weekKey: week,
          notes,
          completedBy,
        });
        break;
      case 'skip':
        completion = markRunbookItemSkipped(companyId, itemId, {
          weekKey: week,
          notes,
          completedBy,
        });
        break;
      case 'reset':
        resetRunbookItem(companyId, itemId, week);
        completion = null;
        break;
    }

    // Recalculate summary after update
    const items = CAR_TOYS_STANDARD_RUNBOOK;
    const summary = calculateRunbookSummary(companyId, items, week);

    return NextResponse.json({
      success: true,
      action,
      itemId,
      weekKey: week,
      completion,
      summary,
    });
  } catch (error) {
    console.error('[Runbook POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
