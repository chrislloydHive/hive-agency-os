// app/api/os/companies/[companyId]/icp/route.ts
// ICP (Ideal Customer Profile) API
//
// GET: Load canonical ICP from Context Graph
// POST: Extract ICP from Website Lab + GAP diagnostics

import { NextRequest, NextResponse } from 'next/server';
import {
  extractICPFromDiagnostics,
  loadCanonicalICP,
} from '@/lib/contextGraph/icpExtractor';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/icp
 * Load canonical ICP from Context Graph
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const result = await loadCanonicalICP(companyId);

    return NextResponse.json({
      companyId,
      ...result,
    });
  } catch (error) {
    console.error('[API] ICP read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/icp
 * Extract ICP from Website Lab + GAP diagnostics
 *
 * Body: { force?: boolean }
 *
 * This will use AI to extract ICP fields from the latest
 * Website Lab and GAP results, then write to Context Graph.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { force } = body;

    console.log(`[API] ICP extraction for ${companyId}:`, { force });

    const result = await extractICPFromDiagnostics({
      companyId,
      force: force === true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          sourcesUsed: result.sourcesUsed,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      extracted: result.extracted,
      fieldsWritten: result.fieldsWritten,
      fieldsSkipped: result.fieldsSkipped,
      sourcesUsed: result.sourcesUsed,
    });
  } catch (error) {
    console.error('[API] ICP extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
