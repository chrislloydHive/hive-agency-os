// app/api/os/companies/[companyId]/findings/route.ts
// Company Findings API
//
// GET: Fetch findings for a company with optional filters
// Returns findings list and summary statistics

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyFindings,
  getCompanyFindingsSummary,
  getKnownLabSlugs,
  getKnownSeverities,
  getKnownCategories,
  type FindingsFilter,
} from '@/lib/os/findings/companyFindings';

// GET /api/os/companies/[companyId]/findings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);

    // Build filters from query params
    const filters: FindingsFilter = {};

    // Labs filter (comma-separated)
    const labs = searchParams.get('labs');
    if (labs) {
      filters.labs = labs.split(',').map(l => l.trim()).filter(Boolean);
    }

    // Severities filter (comma-separated)
    const severities = searchParams.get('severities');
    if (severities) {
      filters.severities = severities.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Categories filter (comma-separated)
    const categories = searchParams.get('categories');
    if (categories) {
      filters.categories = categories.split(',').map(c => c.trim()).filter(Boolean);
    }

    // Converted filter
    const converted = searchParams.get('converted');
    if (converted === 'false' || converted === 'no') {
      filters.includeConverted = false;
    } else if (converted === 'true' || converted === 'yes' || converted === 'only') {
      filters.includeConverted = true;
    }
    // If not specified, include all (converted + unconverted)

    // Fetch findings and summary in parallel
    const [findings, summary] = await Promise.all([
      getCompanyFindings(companyId, filters),
      getCompanyFindingsSummary(companyId),
    ]);

    // Get filter options for the UI
    const filterOptions = {
      labs: getKnownLabSlugs(),
      severities: getKnownSeverities(),
      categories: getKnownCategories(),
    };

    return NextResponse.json({
      success: true,
      findings,
      summary,
      filterOptions,
      appliedFilters: filters,
      count: findings.length,
    });
  } catch (error) {
    console.error('[Findings API] Error fetching findings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch findings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
