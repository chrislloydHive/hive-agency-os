// app/api/os/companies/[companyId]/strategy/[strategyId]/evolution/[eventId]/route.ts
// Single Evolution Event API
//
// GET - Get a single evolution event with full details

import { NextRequest, NextResponse } from 'next/server';
import { getEvolutionEvent } from '@/lib/airtable/strategyEvolutionEvents';
import {
  getStrategyVersionByNumber,
} from '@/lib/airtable/strategyVersions';

// ============================================================================
// GET - Get single evolution event
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string; eventId: string }> }
) {
  try {
    const { strategyId, eventId } = await params;

    if (!strategyId || !eventId) {
      return NextResponse.json(
        { error: 'Strategy ID and Event ID are required' },
        { status: 400 }
      );
    }

    const event = await getEvolutionEvent(eventId);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify event belongs to this strategy
    if (event.strategyId !== strategyId) {
      return NextResponse.json(
        { error: 'Event does not belong to this strategy' },
        { status: 403 }
      );
    }

    // Get the version snapshots for full context
    const [versionBefore, versionAfter] = await Promise.all([
      getStrategyVersionByNumber(strategyId, event.versionFrom),
      getStrategyVersionByNumber(strategyId, event.versionTo),
    ]);

    return NextResponse.json({
      event,
      snapshots: {
        before: versionBefore?.snapshot || null,
        after: versionAfter?.snapshot || null,
      },
    });
  } catch (error) {
    console.error('[GET /evolution/:eventId] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get event' },
      { status: 500 }
    );
  }
}
