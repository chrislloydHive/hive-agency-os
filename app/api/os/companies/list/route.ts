// app/api/os/companies/list/route.ts
// GET /api/os/companies/list
// Returns aggregated company data for the Companies directory page

import { NextRequest, NextResponse } from 'next/server';
import {
  aggregateCompaniesData,
} from '@/lib/os/companies/aggregate';
import type {
  CompanyListFilterV2,
  CompanyStage,
  AttentionFilter,
  SortField,
  SortDirection,
} from '@/lib/os/companies/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/os/companies/list
 *
 * Query parameters:
 * - stage: CompanyStage | 'All'
 * - search: string
 * - attention: AttentionFilter
 * - sortBy: SortField
 * - sortDirection: SortDirection
 *
 * Returns:
 * - companies: CompanyRowVM[]
 * - summary: CompaniesPageSummaryVM
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter params
    const filter: CompanyListFilterV2 = {};

    const stage = searchParams.get('stage');
    if (stage && isValidStage(stage)) {
      filter.stage = stage as CompanyStage | 'All';
    }

    const search = searchParams.get('search') || searchParams.get('q');
    if (search) {
      filter.search = search;
    }

    const attention = searchParams.get('attention');
    if (attention && isValidAttentionFilter(attention)) {
      filter.attention = attention as AttentionFilter;
    }

    const sortBy = searchParams.get('sortBy');
    if (sortBy && isValidSortField(sortBy)) {
      filter.sortBy = sortBy as SortField;
    }

    const sortDirection = searchParams.get('sortDirection');
    if (sortDirection && isValidSortDirection(sortDirection)) {
      filter.sortDirection = sortDirection as SortDirection;
    }

    console.log('[API] /api/os/companies/list - Filter:', filter);

    const result = await aggregateCompaniesData(filter);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/os/companies/list - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function isValidStage(value: string): boolean {
  return ['All', 'Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(value);
}

function isValidAttentionFilter(value: string): boolean {
  return ['highIntent', 'overdueWork', 'noBaseline', 'duplicates', 'atRisk'].includes(value);
}

function isValidSortField(value: string): boolean {
  return ['name', 'lastActivity', 'gapScore', 'openWork', 'health'].includes(value);
}

function isValidSortDirection(value: string): boolean {
  return ['asc', 'desc'].includes(value);
}
