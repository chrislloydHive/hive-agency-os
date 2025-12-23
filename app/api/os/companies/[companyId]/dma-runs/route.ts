// app/api/os/companies/[companyId]/dma-runs/route.ts
// DMA runs endpoint for a specific company
// Returns all GAP runs (IA + Full) for the company with summary

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanyById } from '@/lib/airtable/companies';
import { fetchDMARunsForCompany, buildSingleCompanySummary } from '@/lib/dma';
import type { CompanyDMARuns } from '@/lib/types/dma';

// Query params schema
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const parsed = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { limit } = parsed.data;

    console.log('[DMA Runs] Fetching for company:', { companyId, limit });

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    const domain = company.domain || '';

    // Fetch runs for this company
    const runs = await fetchDMARunsForCompany(companyId, domain, limit);

    // Build summary
    const summary = buildSingleCompanySummary(
      companyId,
      company.name,
      company.domain || null,
      runs
    );

    const response: CompanyDMARuns = {
      ok: true,
      companyId,
      summary,
      runs,
    };

    console.log('[DMA Runs] Response:', {
      companyId,
      companyName: company.name,
      runCount: runs.length,
      intentLevel: summary.intentLevel,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[DMA Runs] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
