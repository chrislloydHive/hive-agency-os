// app/api/os/companies/[companyId]/weekly-brief/regenerate/route.ts
// POST /api/os/companies/[companyId]/weekly-brief/regenerate
//
// Triggers on-demand weekly brief generation.
// Body (optional):
// - weekKey: string (defaults to current week)
// - requestedBy: string (user id)
//
// Returns:
// - debugId: string
// - message: string
// - status: 'triggered' | 'already_running'

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { generateDebugId } from '@/lib/types/operationalEvent';
import { getWeekKey, type RegenerateBriefResponse } from '@/lib/types/weeklyBrief';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

interface RegenerateRequestBody {
  weekKey?: string;
  requestedBy?: string;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<RegenerateBriefResponse | { error: string }>> {
  try {
    const { companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    let body: RegenerateRequestBody = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is fine
    }

    const weekKey = body.weekKey || getWeekKey();
    const debugId = generateDebugId();

    // Validate week key format if provided
    if (body.weekKey && !/^\d{4}-W\d{2}$/.test(body.weekKey)) {
      return NextResponse.json(
        { error: 'Invalid weekKey format. Expected YYYY-Www (e.g., 2025-W03)' },
        { status: 400 }
      );
    }

    // Trigger on-demand brief generation via Inngest
    await inngest.send({
      name: 'os/weekly-brief.requested',
      data: {
        companyId,
        weekKey,
        requestedBy: body.requestedBy,
        debugId,
      },
    });

    const response: RegenerateBriefResponse = {
      debugId,
      message: `Weekly brief regeneration triggered for week ${weekKey}`,
      status: 'triggered',
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error('[WeeklyBrief:Regenerate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
