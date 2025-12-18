// app/api/os/companies/[companyId]/briefs/[briefId]/approve/route.ts
// Approve a brief and optionally lock the strategy
//
// POST /api/os/companies/[companyId]/briefs/[briefId]/approve
//
// After approval:
// - Brief becomes source of truth
// - Strategy edits require explicit "Unlock strategy" action

import { NextRequest, NextResponse } from 'next/server';
import { getBriefById, approveBrief, lockBrief } from '@/lib/airtable/briefs';
import { lockProjectStrategy } from '@/lib/airtable/projectStrategies';
import { canApproveBrief } from '@/lib/types/brief';

type Params = { params: Promise<{ companyId: string; briefId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json().catch(() => ({}));

    const {
      approvedBy,
      lockStrategy = true,
      lockBriefToo = false,
    } = body as {
      approvedBy?: string;
      lockStrategy?: boolean;
      lockBriefToo?: boolean;
    };

    // 1. Get the brief
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // 2. Check if brief can be approved
    if (!canApproveBrief(brief)) {
      return NextResponse.json(
        { error: `Brief cannot be approved (current status: ${brief.status})` },
        { status: 400 }
      );
    }

    // 3. Approve the brief
    let updatedBrief = await approveBrief(briefId, approvedBy);
    if (!updatedBrief) {
      return NextResponse.json(
        { error: 'Failed to approve brief' },
        { status: 500 }
      );
    }

    // 4. Lock the brief if requested
    if (lockBriefToo) {
      updatedBrief = await lockBrief(briefId, 'Brief approved and locked');
    }

    // 5. Lock the project strategy if requested and if this is a project brief
    let strategyLocked = false;
    if (lockStrategy && brief.projectId) {
      try {
        const { getProjectStrategyByProjectId } = await import('@/lib/airtable/projectStrategies');
        const strategy = await getProjectStrategyByProjectId(brief.projectId);

        if (strategy) {
          await lockProjectStrategy(strategy.id, 'Brief approved - strategy locked');
          strategyLocked = true;
        }
      } catch (error) {
        console.error('[API] Failed to lock strategy:', error);
        // Don't fail the approval if strategy lock fails
      }
    }

    return NextResponse.json({
      brief: updatedBrief,
      strategyLocked,
      message: 'Brief approved successfully',
    });
  } catch (error) {
    console.error('[API] Brief approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
