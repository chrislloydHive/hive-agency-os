// app/api/os/companies/[companyId]/context/v4/confirm/route.ts
// Context V4 API: Confirm endpoint
//
// Confirms proposed fields and materializes them to the existing Context Graph.

import { NextRequest, NextResponse } from 'next/server';
import { confirmFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { materializeFieldsToGraph } from '@/lib/contextGraph/materializeV4';
import { incrementStrategyDocStaleness } from '@/lib/documents/strategyDoc';
import {
  isContextV4Enabled,
  type ConfirmFieldsRequestV4,
  type ConfirmFieldsResponseV4,
} from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/confirm
 * Confirms one or more proposed fields
 *
 * Body: { keys: string[] }
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
    const body: ConfirmFieldsRequestV4 = await request.json();

    // Validate request
    if (!body.keys || !Array.isArray(body.keys) || body.keys.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'keys array is required' },
        { status: 400 }
      );
    }

    // Confirm fields in V4 store
    const result = await confirmFieldsV4(companyId, body.keys);

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

    // Materialize confirmed fields to existing Context Graph
    if (result.confirmed && result.confirmed.length > 0) {
      const materializeResult = await materializeFieldsToGraph(
        companyId,
        result.confirmed
      );

      console.log(
        `[ContextV4 API] Confirmed ${result.confirmed.length} fields, ` +
          `materialized ${materializeResult.materialized} to graph`
      );

      if (materializeResult.errors.length > 0) {
        console.warn(
          '[ContextV4 API] Materialization errors:',
          materializeResult.errors
        );
      }

      // Increment Strategy Doc staleness when context is confirmed
      await incrementStrategyDocStaleness(companyId);
    }

    // Build response
    const response: ConfirmFieldsResponseV4 = {
      confirmed: result.confirmed || [],
      failed: result.failed,
    };

    return NextResponse.json({ ok: true, ...response });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 API] Error confirming fields:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
