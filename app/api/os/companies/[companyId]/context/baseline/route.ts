// app/api/os/companies/[companyId]/context/baseline/route.ts
// API Route: Baseline Context Build
//
// POST - Run baseline context build
// GET  - Get baseline build status

import { NextRequest, NextResponse } from 'next/server';
import {
  runBaselineContextBuild,
  getBaselineStatus,
  type BaselineBuildResult,
} from '@/lib/contextGraph/baseline';

// ============================================================================
// POST - Run Baseline Context Build
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    // Parse request body
    let body: { force?: boolean; dryRun?: boolean } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is fine
    }

    console.log(`[API] Starting baseline build for ${companyId}`, body);

    // Run baseline build
    const result = await runBaselineContextBuild({
      companyId,
      force: body.force ?? false,
      dryRun: body.dryRun ?? false,
    });

    // Return appropriate status based on result
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    // If it was a no-op (already initialized), return 200 with wasNoOp flag
    if (result.wasNoOp) {
      return NextResponse.json(result, { status: 200 });
    }

    // Successful new build
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API] Baseline build error:', error);
    return NextResponse.json(
      {
        error: 'Baseline build failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Baseline Build Status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    const status = await getBaselineStatus(companyId);

    return NextResponse.json({
      companyId,
      ...status,
    });
  } catch (error) {
    console.error('[API] Get baseline status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get baseline status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
