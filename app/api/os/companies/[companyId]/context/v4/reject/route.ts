// app/api/os/companies/[companyId]/context/v4/reject/route.ts
// Context V4 API: Reject endpoint
//
// Rejects proposed fields. Rejected fields block re-proposal from the same source.

import { NextRequest, NextResponse } from 'next/server';
import { rejectFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  type RejectFieldsRequestV4,
} from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/reject
 * Rejects one or more proposed fields
 *
 * Body: { keys: string[], reason?: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json(
      { ok: false, error: 'Context V4 is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { companyId } = await params;
    const body: RejectFieldsRequestV4 = await request.json();

    // Validate request
    if (!body.keys || !Array.isArray(body.keys) || body.keys.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'keys array is required' },
        { status: 400 }
      );
    }

    // Reject fields
    const result = await rejectFieldsV4(companyId, body.keys, body.reason);

    // Check for store errors
    if (result.error) {
      const status = result.error === 'UNAUTHORIZED' ? 403 : 500;
      return NextResponse.json(
        {
          ok: false,
          error: result.error === 'UNAUTHORIZED'
            ? 'Not authorized to access V4 store'
            : result.errorMessage || 'Store error',
          errorCode: result.error,
        },
        { status }
      );
    }

    console.log(
      `[ContextV4 API] Rejected ${result.rejected?.length || 0} fields for ${companyId}`
    );

    return NextResponse.json({
      ok: true,
      rejected: result.rejected || [],
      failed: result.failed,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 API] Error rejecting fields:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
