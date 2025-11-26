// app/api/os/companies/[companyId]/ai-memory/route.ts
// API endpoint to fetch Company AI Memory (Client Brain) entries for UI display

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyMemory } from '@/lib/ai-gateway';
import type { MemoryEntryType } from '@/lib/ai-gateway';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/ai-memory
 *
 * Fetch AI memory entries for a company
 *
 * Query params:
 * - limit: number (default 50)
 * - types: comma-separated list of types to filter by
 * - tags: comma-separated list of tags to filter by
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const typesParam = searchParams.get('types');
    const tagsParam = searchParams.get('tags');

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const types = typesParam
      ? (typesParam.split(',') as MemoryEntryType[])
      : undefined;
    const tags = tagsParam ? tagsParam.split(',') : undefined;

    console.log('[AI Memory API] Fetching entries:', {
      companyId,
      limit,
      types,
      tags,
    });

    const entries = await getCompanyMemory(companyId, {
      limit,
      types,
      tags,
    });

    console.log('[AI Memory API] ✅ Found entries:', entries.length);

    return NextResponse.json({
      ok: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Memory API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
