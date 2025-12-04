// app/api/context/updates/route.ts
// Governed Update Pipeline API
//
// GET /api/context/updates?companyId=xxx - Get update logs
// POST /api/context/updates - Apply a governed update
// PATCH /api/context/updates - Accept/reject a pending suggestion

import { NextRequest, NextResponse } from 'next/server';
import {
  applyGovernedUpdate,
  applyBatchUpdate,
  acceptSuggestion,
  rejectSuggestion,
  queryUpdateLogs,
  getRecentUpdates,
  getPendingSuggestions,
  getUpdateStats,
  getLocks,
} from '@/lib/contextGraph/governance';

export const maxDuration = 60;

// GET - Fetch update logs and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type'); // 'recent', 'pending', 'stats', 'locks'
    const path = searchParams.get('path');
    const domain = searchParams.get('domain');
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'pending': {
        const pending = await getPendingSuggestions(companyId);
        return NextResponse.json({ ok: true, companyId, pending });
      }

      case 'stats': {
        const stats = await getUpdateStats(companyId);
        return NextResponse.json({ ok: true, companyId, stats });
      }

      case 'locks': {
        const locks = await getLocks(companyId);
        return NextResponse.json({ ok: true, companyId, locks });
      }

      case 'recent':
      default: {
        const logs = await queryUpdateLogs({
          companyId,
          path: path ?? undefined,
          domain: domain ?? undefined,
          limit,
        });
        return NextResponse.json({ ok: true, companyId, logs });
      }
    }
  } catch (error) {
    console.error('[API] Updates GET error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Apply a governed update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      path,
      value,
      updates,  // For batch updates
      updatedBy,
      sourceTool,
      reasoning,
      userId,
      createSnapshot,
      snapshotReason,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Batch update
    if (Array.isArray(updates)) {
      console.log('[API] Applying batch update:', {
        companyId,
        updateCount: updates.length,
        updatedBy,
      });

      const result = await applyBatchUpdate(companyId, updates, {
        updatedBy: updatedBy ?? 'human',
        sourceTool,
        reasoning,
        userId,
        createSnapshot: createSnapshot ?? true,
        snapshotReason,
      });

      return NextResponse.json({
        ok: result.success,
        companyId,
        ...result,
      });
    }

    // Single update
    if (!path) {
      return NextResponse.json(
        { error: 'path is required for single updates' },
        { status: 400 }
      );
    }

    console.log('[API] Applying governed update:', {
      companyId,
      path,
      updatedBy,
    });

    const result = await applyGovernedUpdate(companyId, path, value, {
      updatedBy: updatedBy ?? 'human',
      sourceTool,
      reasoning,
      userId,
      createSnapshot: createSnapshot ?? true,
      snapshotReason,
    });

    return NextResponse.json({
      ok: result.success,
      companyId,
      ...result,
    });
  } catch (error) {
    console.error('[API] Updates POST error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Accept or reject a pending suggestion
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, updateId, action, userId } = body;

    if (!companyId || !updateId || !action) {
      return NextResponse.json(
        { error: 'companyId, updateId, and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action must be "accept" or "reject"' },
        { status: 400 }
      );
    }

    console.log('[API] Processing suggestion:', { companyId, updateId, action });

    if (action === 'accept') {
      const result = await acceptSuggestion(companyId, updateId, userId ?? 'unknown');

      return NextResponse.json({
        ok: result.success,
        companyId,
        updateId,
        action,
        result,
      });
    } else {
      const success = await rejectSuggestion(companyId, updateId, userId ?? 'unknown');

      return NextResponse.json({
        ok: success,
        companyId,
        updateId,
        action,
      });
    }
  } catch (error) {
    console.error('[API] Updates PATCH error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
