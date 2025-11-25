// app/api/analytics/sites/route.ts
// API endpoint for listing available analytics sites

import { NextResponse } from 'next/server';
import { getAnalyticsSites } from '@/lib/analytics/sites';

export async function GET() {
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
