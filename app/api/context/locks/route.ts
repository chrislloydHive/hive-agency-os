// app/api/context/locks/route.ts
// Field Locking API
//
// GET /api/context/locks?companyId=xxx - Get all locks
// POST /api/context/locks - Create a lock
// DELETE /api/context/locks - Remove a lock

import { NextRequest, NextResponse } from 'next/server';
import {
  getLocks,
  getLocksForDomain,
  lockField,
  unlockField,
  checkLock,
  lockFields,
} from '@/lib/contextGraph/governance/locks';

// GET - Fetch locks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const domain = searchParams.get('domain');
    const path = searchParams.get('path');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Check specific path
    if (path) {
      const lockCheck = await checkLock(companyId, path);
      return NextResponse.json({
        ok: true,
        companyId,
        path,
        ...lockCheck,
      });
    }

    // Get locks for domain
    if (domain) {
      const locks = await getLocksForDomain(companyId, domain);
      return NextResponse.json({ ok: true, companyId, domain, locks });
    }

    // Get all locks
    const locks = await getLocks(companyId);
    return NextResponse.json({ ok: true, companyId, locks });
  } catch (error) {
    console.error('[API] Locks GET error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create lock(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, path, paths, lockedBy, reason, severity, expiresAt } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!lockedBy) {
      return NextResponse.json(
        { error: 'lockedBy is required' },
        { status: 400 }
      );
    }

    const lockSeverity = severity === 'hard' ? 'hard' : 'soft';

    // Bulk lock
    if (Array.isArray(paths)) {
      const locks = await lockFields(
        companyId,
        paths.map((p: string) => ({
          path: p,
          lockedBy,
          reason,
          severity: lockSeverity,
        }))
      );

      console.log('[API] Bulk lock created:', {
        companyId,
        count: locks.length,
        severity: lockSeverity,
      });

      return NextResponse.json({ ok: true, companyId, locks });
    }

    // Single lock
    if (!path) {
      return NextResponse.json(
        { error: 'path or paths is required' },
        { status: 400 }
      );
    }

    const lock = await lockField(companyId, path, {
      lockedBy,
      reason,
      severity: lockSeverity,
      expiresAt,
    });

    console.log('[API] Lock created:', {
      companyId,
      path,
      lockedBy,
      severity: lockSeverity,
    });

    return NextResponse.json({ ok: true, companyId, lock });
  } catch (error) {
    console.error('[API] Locks POST error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove lock
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const path = searchParams.get('path');

    if (!companyId || !path) {
      return NextResponse.json(
        { error: 'companyId and path are required' },
        { status: 400 }
      );
    }

    const removed = await unlockField(companyId, path);

    console.log('[API] Lock removed:', { companyId, path, removed });

    return NextResponse.json({ ok: true, companyId, path, removed });
  } catch (error) {
    console.error('[API] Locks DELETE error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
