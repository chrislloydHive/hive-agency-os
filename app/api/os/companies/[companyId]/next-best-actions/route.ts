// app/api/os/companies/[companyId]/next-best-actions/route.ts
// Next Best Actions API
//
// GET: Fetch top N next best actions for a company
// Query params:
//   - limit: number (default 3)
//   - theme: string (filter by theme)
//   - labSlug: string (filter by lab)
//   - quickWinsOnly: boolean (only quick wins)

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getNextBestActionsForCompany,
  type ExtendedNextBestAction,
} from '@/lib/os/companies/nextBestAction';

// ============================================================================
// API Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '3', 10);
    const theme = searchParams.get('theme') || undefined;
    const labSlug = searchParams.get('labSlug') || undefined;
    const quickWinsOnly = searchParams.get('quickWinsOnly') === 'true';

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch next best actions
    const actions = await getNextBestActionsForCompany(companyId, {
      limit: Math.min(limit, 20), // Cap at 20
      theme,
      labSlug,
      quickWinsOnly,
    });

    // Return response
    return NextResponse.json({
      success: true,
      companyId,
      companyName: company.name,
      actions,
      count: actions.length,
      filters: {
        limit,
        theme: theme || null,
        labSlug: labSlug || null,
        quickWinsOnly,
      },
    });
  } catch (error) {
    console.error('[Next Best Actions API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch next best actions',
      },
      { status: 500 }
    );
  }
}
