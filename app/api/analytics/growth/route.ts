// app/api/analytics/growth/route.ts
// API endpoint for fetching growth analytics snapshot

import { NextRequest, NextResponse } from 'next/server';
import { getGrowthAnalyticsSnapshot, getDefaultDateRange } from '@/lib/analytics/growthAnalytics';
import { getAnalyticsSites, getSiteConfig } from '@/lib/analytics/sites';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const siteId = searchParams.get('site'); // Optional site ID

    // Use provided dates or default to last 30 days
    let startDate: string;
    let endDate: string;

    if (start && end) {
      startDate = start;
      endDate = end;
    } else {
      const defaultRange = getDefaultDateRange(30);
      startDate = defaultRange.startDate;
      endDate = defaultRange.endDate;
    }

    console.log('[API /analytics/growth] Fetching snapshot', { startDate, endDate, siteId });

    const snapshot = await getGrowthAnalyticsSnapshot(startDate, endDate, siteId || undefined);

    // Include site info in response
    const site = siteId ? getSiteConfig(siteId) : null;

    return NextResponse.json({
      snapshot,
      site: site ? { id: site.id, name: site.name, domain: site.domain, color: site.color } : null,
    });
  } catch (error) {
    console.error('[API /analytics/growth] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Get list of available analytics sites
 */
export async function OPTIONS() {
  const sites = getAnalyticsSites();
  return NextResponse.json({
    sites: sites.map(s => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      color: s.color,
      hasGa4: !!s.ga4PropertyId,
      hasSearchConsole: !!s.searchConsoleSiteUrl,
    })),
  });
}
