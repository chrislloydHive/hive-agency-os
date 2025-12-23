// app/api/os/pipeline/dma-activity/route.ts
// DMA Activity endpoint for Pipeline view
// Returns recent GAP runs (IA + Full) with intent signals

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchRecentDMARuns,
  buildCompanySummaries,
  getDMAActivityStats,
} from '@/lib/dma';
import type { DMAActivityResponse, DMARunType, IntentLevel } from '@/lib/types/dma';

// Query params schema
const querySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(7),
  runType: z.enum(['all', 'GAP_IA', 'GAP_FULL']).default('all'),
  intentLevel: z.enum(['all', 'High', 'Medium', 'Low', 'None']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate query params
    const parsed = querySchema.safeParse({
      days: searchParams.get('days') ?? undefined,
      runType: searchParams.get('runType') ?? undefined,
      intentLevel: searchParams.get('intentLevel') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { days, runType, intentLevel, limit } = parsed.data;

    console.log('[DMA Activity] Fetching with params:', { days, runType, intentLevel, limit });

    // Fetch runs
    const runs = await fetchRecentDMARuns({
      days,
      runType: runType as DMARunType | 'all',
      limit: limit * 2, // Fetch more to account for filtering
    });

    // Build company summaries for intent calculation
    const summaries = await buildCompanySummaries(runs);

    // Filter summaries by intent level if specified
    let filteredSummaries = summaries;
    if (intentLevel !== 'all') {
      filteredSummaries = summaries.filter(s => s.intentLevel === intentLevel);
    }

    // Get runs for filtered companies
    const filteredCompanyIds = new Set(filteredSummaries.map(s => s.companyId));
    let filteredRuns = runs;
    if (intentLevel !== 'all') {
      filteredRuns = runs.filter(r =>
        (r.companyId && filteredCompanyIds.has(r.companyId)) ||
        (r.domain && filteredCompanyIds.has(`domain:${r.domain}`))
      );
    }

    // Apply limit
    const limitedRuns = filteredRuns.slice(0, limit);

    // Calculate stats
    const { countByType, countByIntent } = getDMAActivityStats(limitedRuns, filteredSummaries);

    const response: DMAActivityResponse = {
      ok: true,
      runs: limitedRuns,
      totalCount: filteredRuns.length,
      countByType,
      countByIntent,
    };

    console.log('[DMA Activity] Response:', {
      runCount: limitedRuns.length,
      totalCount: filteredRuns.length,
      countByType,
      countByIntent,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[DMA Activity] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
