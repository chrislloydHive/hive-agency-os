// app/api/os/analytics/search-console/company/[companyId]/route.ts
// Company-level Search Console API
// Returns GSC snapshot for a specific company's site
// Falls back to workspace/env GSC config if company doesn't have its own

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  fetchCompanySearchConsoleSnapshot,
  resolveDateRange,
} from '@/lib/os/searchConsole/snapshot';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse date range parameters
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Resolve date range (defaults to last 30 days)
    const range = resolveDateRange(start, end, 30);

    console.log('[SearchConsole Company API] Fetching data...', {
      companyId,
      range,
    });

    // Fetch company
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if company has Search Console configured, otherwise fall back to env default
    const companySiteUrl = company.searchConsoleSiteUrl;
    const fallbackSiteUrl = process.env.SEARCH_CONSOLE_SITE_URL;
    const siteUrl = companySiteUrl || fallbackSiteUrl;
    const usingFallback = !companySiteUrl && !!fallbackSiteUrl;

    if (!siteUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Search Console not configured',
          hint: 'Add the Search Console site URL in company settings or set SEARCH_CONSOLE_SITE_URL env var.',
          company: {
            id: company.id,
            name: company.name,
          },
        },
        { status: 400 }
      );
    }

    console.log('[SearchConsole Company API] Using site URL', {
      siteUrl,
      usingFallback,
      companyName: company.name,
    });

    // Fetch snapshot
    const snapshot = await fetchCompanySearchConsoleSnapshot(
      siteUrl,
      range,
      50
    );

    return NextResponse.json({
      ok: true,
      snapshot,
      usingFallback,
      company: {
        id: company.id,
        name: company.name,
        searchConsoleSiteUrl: siteUrl,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[SearchConsole Company API] Error:', errorMessage);

    // Handle specific error types
    if (errorMessage.includes('Permission denied')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Permission denied',
          detail: errorMessage,
          hint: 'Ensure the Google account has access to this Search Console property.',
        },
        { status: 403 }
      );
    }

    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Site not found in Search Console',
          detail: errorMessage,
          hint: 'Verify the Search Console site URL is correct and the site is verified.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
