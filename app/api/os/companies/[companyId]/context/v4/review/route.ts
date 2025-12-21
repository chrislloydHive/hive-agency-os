// app/api/os/companies/[companyId]/context/v4/review/route.ts
// Context V4 API: Review Queue endpoint
//
// Returns proposed fields awaiting review.

import { NextRequest, NextResponse } from 'next/server';
import { getProposedFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  type ReviewQueueResponseV4,
  type ContextFieldSourceV4,
} from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/v4/review
 * Returns proposed fields for review
 *
 * Query params:
 * - domain: Filter by domain (e.g., "identity")
 * - source: Filter by source (e.g., "lab")
 * - limit: Max results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json(
      { ok: false, error: 'Context V4 is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);

    const domain = searchParams.get('domain') || undefined;
    const source = searchParams.get('source') as ContextFieldSourceV4 | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get proposed fields with filters
    const allProposed = await getProposedFieldsV4(companyId, { domain, source });

    // Apply pagination
    const paginated = allProposed.slice(offset, offset + limit);

    // Group by domain
    const byDomain: Record<string, number> = {};
    for (const field of allProposed) {
      byDomain[field.domain] = (byDomain[field.domain] || 0) + 1;
    }

    // Group by source
    const bySource: Record<string, number> = {};
    for (const field of allProposed) {
      bySource[field.source] = (bySource[field.source] || 0) + 1;
    }

    // Build response
    const response: ReviewQueueResponseV4 = {
      companyId,
      proposed: paginated,
      totalCount: allProposed.length,
      byDomain,
      bySource,
    };

    return NextResponse.json({ ok: true, ...response });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 API] Error getting review queue:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
