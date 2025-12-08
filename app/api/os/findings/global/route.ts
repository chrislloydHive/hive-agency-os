// app/api/os/findings/global/route.ts
// Global Findings API
//
// GET: Fetch findings across all companies with optional filters
// Returns findings list, summary statistics, and filter options

import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalFindingsWithSummary,
  getCompaniesForFilter,
  getKnownLabSlugs,
  getKnownSeverities,
  getKnownCategories,
  getTimeRangePresets,
  type GlobalFindingsFilter,
} from '@/lib/os/findings/globalFindings';

// GET /api/os/findings/global
export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);

    // Build filters from query params
    const filters: GlobalFindingsFilter = {};

    // Company IDs (comma-separated or repeated)
    const companyIds = searchParams.get('companyIds') || searchParams.get('company');
    if (companyIds) {
      filters.companyIds = companyIds.split(',').map(c => c.trim()).filter(Boolean);
    }

    // Labs filter (comma-separated)
    const labs = searchParams.get('labs') || searchParams.get('lab');
    if (labs) {
      filters.labs = labs.split(',').map(l => l.trim()).filter(Boolean);
    }

    // Severities filter (comma-separated)
    const severities = searchParams.get('severities') || searchParams.get('severity');
    if (severities) {
      filters.severities = severities.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Categories filter (comma-separated)
    const categories = searchParams.get('categories') || searchParams.get('category');
    if (categories) {
      filters.categories = categories.split(',').map(c => c.trim()).filter(Boolean);
    }

    // Converted filter
    const converted = searchParams.get('converted');
    if (converted === 'true' || converted === 'converted' || converted === 'only') {
      filters.converted = 'converted';
    } else if (converted === 'false' || converted === 'not_converted' || converted === 'no') {
      filters.converted = 'not_converted';
    } else {
      filters.converted = 'all';
    }

    // Time range filter (since date)
    const since = searchParams.get('since');
    const timeRange = searchParams.get('timeRange');

    if (since) {
      // Direct ISO date
      filters.since = new Date(since);
    } else if (timeRange && timeRange !== 'all') {
      // Preset time ranges
      const days = parseInt(timeRange.replace('d', ''), 10);
      if (!isNaN(days) && days > 0) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        filters.since = sinceDate;
      }
    }

    // Limit (default 200)
    const limitParam = searchParams.get('limit');
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0 && limit <= 500) {
        filters.limit = limit;
      }
    }

    console.log('[Global Findings API] Fetching with filters:', filters);

    // Fetch findings and summary
    const { findings, summary } = await getGlobalFindingsWithSummary(filters);

    // Get filter options for the UI (in parallel)
    const [companies, labOptions, severityOptions, categoryOptions] = await Promise.all([
      getCompaniesForFilter(),
      Promise.resolve(getKnownLabSlugs()),
      Promise.resolve(getKnownSeverities()),
      Promise.resolve(getKnownCategories()),
    ]);

    const filterOptions = {
      companies,
      labs: labOptions,
      severities: severityOptions,
      categories: categoryOptions,
      timeRanges: getTimeRangePresets(),
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
    console.error('[Global Findings API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch global findings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
