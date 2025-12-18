// app/api/os/companies/[companyId]/briefs/[briefId]/lock/route.ts
// Lock and unlock brief endpoints
//
// LOCKING SEMANTICS:
// - approved = ready for execution; editable but audited
// - locked = execution started; edits blocked unless unlocked with reason

import { NextRequest, NextResponse } from 'next/server';
import { getBriefById, lockBrief, unlockBrief } from '@/lib/airtable/briefs';
import { canLockBrief, canUnlockBrief, getLockedBriefError } from '@/lib/types/brief';

type Params = { params: Promise<{ companyId: string; briefId: string }> };

/**
 * POST /api/os/companies/[companyId]/briefs/[briefId]/lock
 *
 * Lock a brief (requires brief to be approved first)
 *
 * Body:
 * - reason?: string (optional lock reason)
 * - lockedBy?: string (user identifier)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json().catch(() => ({}));

    const { reason, lockedBy } = body as {
      reason?: string;
      lockedBy?: string;
    };

    // Get brief
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Check if can be locked
    if (!canLockBrief(brief)) {
      if (brief.isLocked || brief.status === 'locked') {
        return NextResponse.json(
          {
            error: {
              code: 'ALREADY_LOCKED',
              title: 'Brief Already Locked',
              message: 'This brief is already locked.',
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: 'NOT_APPROVED',
            title: 'Brief Must Be Approved First',
            message: `Brief must be approved before it can be locked. Current status: ${brief.status}`,
          },
        },
        { status: 400 }
      );
    }

    // Lock the brief
    const locked = await lockBrief(
      briefId,
      reason || 'Brief locked for execution',
      lockedBy
    );

    if (!locked) {
      return NextResponse.json(
        { error: 'Failed to lock brief' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brief: locked,
      message: 'Brief locked successfully',
    });
  } catch (error) {
    console.error('[API] Lock brief error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/companies/[companyId]/briefs/[briefId]/lock
 *
 * Unlock a brief (requires reason)
 *
 * Body:
 * - unlockReason: string (required - must explain why unlocking)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    const { unlockReason } = body as {
      unlockReason: string;
    };

    // Require unlock reason
    if (!unlockReason || unlockReason.trim().length < 3) {
      return NextResponse.json(
        {
          error: {
            code: 'REASON_REQUIRED',
            title: 'Unlock Reason Required',
            message: 'Please provide a reason for unlocking this brief (minimum 3 characters).',
          },
        },
        { status: 400 }
      );
    }

    // Get brief
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Check if can be unlocked
    if (!canUnlockBrief(brief)) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_LOCKED',
            title: 'Brief Not Locked',
            message: 'This brief is not locked.',
          },
        },
        { status: 400 }
      );
    }

    // Unlock the brief
    const unlocked = await unlockBrief(briefId, unlockReason);

    if (!unlocked) {
      return NextResponse.json(
        { error: 'Failed to unlock brief' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brief: unlocked,
      message: 'Brief unlocked successfully',
    });
  } catch (error) {
    console.error('[API] Unlock brief error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
