// app/api/os/companies/[companyId]/context/v4/update/route.ts
// Context V4 API: Update endpoint
//
// Creates or updates a field as confirmed + locked (user edit).
// Automatically materializes to the existing Context Graph.

import { NextRequest, NextResponse } from 'next/server';
import { updateFieldV4 } from '@/lib/contextGraph/fieldStoreV4';
import { materializeFieldsToGraph } from '@/lib/contextGraph/materializeV4';
import {
  isContextV4Enabled,
  type UpdateFieldRequestV4,
  type UpdateFieldResponseV4,
} from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/update
 * Creates or updates a field as confirmed + locked
 *
 * Body: { key: string, value: unknown }
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
    const body: UpdateFieldRequestV4 = await request.json();

    // Validate request
    if (!body.key || typeof body.key !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'key is required' },
        { status: 400 }
      );
    }

    if (body.value === undefined) {
      return NextResponse.json(
        { ok: false, error: 'value is required' },
        { status: 400 }
      );
    }

    // Validate key format (must be domain.field)
    if (!body.key.includes('.')) {
      return NextResponse.json(
        { ok: false, error: 'key must be in format "domain.field"' },
        { status: 400 }
      );
    }

    // Update field
    const result = await updateFieldV4(companyId, body.key, body.value);

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

    // Materialize to existing Context Graph
    const materializeResult = await materializeFieldsToGraph(companyId, [
      body.key,
    ]);

    console.log(
      `[ContextV4 API] Updated ${body.key} for ${companyId}, ` +
        `materialized: ${materializeResult.materialized}`
    );

    // Build response
    const response: UpdateFieldResponseV4 = {
      field: result.field!,
    };

    return NextResponse.json({ ok: true, ...response });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 API] Error updating field:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
