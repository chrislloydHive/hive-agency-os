// app/analytics/os/page.tsx
// Growth Analytics page for Hive OS with multi-site support

import { getDefaultDateRange } from '@/lib/analytics/growthAnalytics';
import { getAnalyticsSites, getDefaultSite } from '@/lib/analytics/sites';
import { GrowthAnalyticsClient } from './GrowthAnalyticsClient';

export default async function OSAnalyticsPage() {
  // Get available sites
  const sites = getAnalyticsSites();
  const defaultSite = getDefaultSite();

  // Get default date range (last 30 days)
  const defaultRange = getDefaultDateRange(30);

  // Fetch initial snapshot from API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let url = `${baseUrl}/api/analytics/growth?start=${defaultRange.startDate}&end=${defaultRange.endDate}`;
  if (defaultSite) {
    url += `&site=${defaultSite.id}`;
  }

  let initialSnapshot = null;
  let error = null;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics: ${response.statusText}`);
    }

    const data = await response.json();
    initialSnapshot = data.snapshot;
  } catch (err) {
    console.error('[OS Analytics Page] Error fetching initial snapshot:', err);
    error = err instanceof Error ? err.message : 'Failed to load analytics data';
  }

  // Convert sites for client component
  const sitesForClient = sites.map(s => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    color: s.color,
    hasGa4: !!s.ga4PropertyId,
    hasSearchConsole: !!s.searchConsoleSiteUrl,
  }));

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Growth Analytics</h1>
          <p className="text-slate-400 mt-1">
            GA4 + Search Console performance
            {defaultSite && (
              <span className={`ml-1 ${
                defaultSite.color === 'amber' ? 'text-amber-400' :
                defaultSite.color === 'purple' ? 'text-purple-400' :
                defaultSite.color === 'yellow' ? 'text-yellow-400' : 'text-amber-400'
              }`}>
                {defaultSite.name}
              </span>
            )}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Focus on traffic, engagement, and search visibility.
          </p>
        </div>

        <GrowthAnalyticsClient
          initialSnapshot={initialSnapshot}
          initialRange={defaultRange}
          initialSites={sitesForClient}
          initialSiteId={defaultSite?.id}
          error={error}
        />
      </div>
    </div>
  );
}
