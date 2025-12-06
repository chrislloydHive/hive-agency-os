// app/api/os/companies/[companyId]/competition/feedback/route.ts
// Competition Lab API - Handle user feedback on competitors

import { NextRequest, NextResponse } from 'next/server';
import { applyCompetitorFeedback, getLatestCompetitionRun, type CompetitorFeedbackAction } from '@/lib/competition';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/competition/feedback
 * Apply user feedback to a competition run
 *
 * Body:
 * - action: 'remove' | 'promote' | 'add'
 * - competitorId?: string (for remove/promote)
 * - toRole?: 'core' | 'secondary' | 'alternative' (for promote)
 * - reason?: string (for remove)
 * - domain?: string (for add)
 * - name?: string (for add)
 * - runId?: string (optional, uses latest if not provided)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();
    const { action, competitorId, toRole, reason, domain, name, runId } = body;

    // Validate action
    if (!action || !['remove', 'promote', 'add'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be remove, promote, or add.' },
        { status: 400 }
      );
    }

    // Get run ID - use provided or get latest
    let recordId = runId;
    if (!recordId) {
      const latestRun = await getLatestCompetitionRun(companyId);
      if (!latestRun) {
        return NextResponse.json(
          { success: false, error: 'No competition run found for this company' },
          { status: 404 }
        );
      }
      recordId = latestRun.id;
    }

    // Build feedback action
    let feedbackAction: CompetitorFeedbackAction;

    switch (action) {
      case 'remove':
        if (!competitorId) {
          return NextResponse.json(
            { success: false, error: 'competitorId required for remove action' },
            { status: 400 }
          );
        }
        feedbackAction = { type: 'remove', competitorId, reason };
        break;

      case 'promote':
        if (!competitorId || !toRole) {
          return NextResponse.json(
            { success: false, error: 'competitorId and toRole required for promote action' },
            { status: 400 }
          );
        }
        if (!['core', 'secondary', 'alternative'].includes(toRole)) {
          return NextResponse.json(
            { success: false, error: 'Invalid toRole. Must be core, secondary, or alternative.' },
            { status: 400 }
          );
        }
        feedbackAction = { type: 'promote', competitorId, toRole };
        break;

      case 'add':
        if (!domain) {
          return NextResponse.json(
            { success: false, error: 'domain required for add action' },
            { status: 400 }
          );
        }
        feedbackAction = { type: 'add', domain, name };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Apply feedback
    const updatedRun = await applyCompetitorFeedback(recordId, feedbackAction);

    // Return updated competitor list
    const activeCompetitors = updatedRun.competitors.filter((c) => !c.provenance.removed);

    return NextResponse.json({
      success: true,
      message: `Successfully applied ${action} action`,
      competitors: activeCompetitors,
      summary: {
        totalDiscovered: activeCompetitors.length,
        coreCount: activeCompetitors.filter((c) => c.role === 'core').length,
        secondaryCount: activeCompetitors.filter((c) => c.role === 'secondary').length,
        alternativeCount: activeCompetitors.filter((c) => c.role === 'alternative').length,
      },
    });
  } catch (error) {
    console.error('[competition/api] Error applying feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
