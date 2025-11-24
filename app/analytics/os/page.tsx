// app/os/analytics/os/page.tsx
// Growth Analytics page for Hive OS

import { getDefaultDateRange } from '@/lib/analytics/growthAnalytics';
import { GrowthAnalyticsClient } from './GrowthAnalyticsClient';

export default async function OSAnalyticsPage() {
  // Get default date range (last 30 days)
  const defaultRange = getDefaultDateRange(30);

  // Fetch initial snapshot from API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/os/analytics/growth?start=${defaultRange.startDate}&end=${defaultRange.endDate}`;

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

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Growth Analytics</h1>
          <p className="text-slate-400 mt-1">
            GA4 + Search Console performance for <span className="text-amber-400">DigitalMarketingAudit.ai</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Focus on traffic, engagement, and search visibility for the last 30 days.
          </p>
        </div>

        <GrowthAnalyticsClient
          initialSnapshot={initialSnapshot}
          initialRange={defaultRange}
          error={error}
        />
      </div>
    </div>
  );
}
