// app/api/os/companies/[companyId]/events/route.ts
// Operational Events API
//
// GET /api/os/companies/[companyId]/events
// Query operational events for a company
//
// Query params:
// - type: Filter by event type (bundle_instantiated, work_created, scope_violation)
// - since: ISO date string for start date
// - until: ISO date string for end date
// - limit: Maximum number of events to return (default 100)

import { NextRequest, NextResponse } from 'next/server';
import {
  queryOperationalEvents,
  getScopeViolationAggregates,
  OPERATIONAL_EVENT_TYPES,
} from '@/lib/observability/operationalEvents';
import type { OperationalEventType } from '@/lib/types/operationalEvent';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const type = searchParams.get('type');
    const since = searchParams.get('since') || undefined;
    const until = searchParams.get('until') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const aggregated = searchParams.get('aggregated') === 'true';

    // Validate type if provided
    let types: OperationalEventType[] | undefined;
    if (type) {
      const validTypes = Object.values(OPERATIONAL_EVENT_TYPES);
      if (!validTypes.includes(type as OperationalEventType)) {
        return NextResponse.json(
          { error: `Invalid event type: ${type}. Valid types: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      types = [type as OperationalEventType];
    }

    // For scope violations with aggregation, return aggregates
    if (type === OPERATIONAL_EVENT_TYPES.SCOPE_VIOLATION && aggregated) {
      const sinceDays = since
        ? Math.ceil((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      const aggregates = await getScopeViolationAggregates(companyId, sinceDays);

      return NextResponse.json({
        success: true,
        companyId,
        aggregates,
        period: {
          sinceDaysAgo: sinceDays,
        },
      });
    }

    // Query events
    const events = await queryOperationalEvents({
      companyId,
      types,
      since,
      until,
      limit,
    });

    return NextResponse.json({
      success: true,
      companyId,
      events,
      count: events.length,
      query: {
        type,
        since,
        until,
        limit,
      },
    });
  } catch (error) {
    console.error('[Events API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
