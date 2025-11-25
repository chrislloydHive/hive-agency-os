// app/analytics/os/page.tsx
// Workspace Analytics page for Hive OS
// Displays GA4, GSC, Funnel metrics, and AI-powered insights

import { WorkspaceAnalyticsClient } from '@/components/os/WorkspaceAnalyticsClient';
import { getWorkspaceAnalyticsOverview } from '@/lib/os/analytics/overview';
import type { WorkspaceAnalyticsOverview } from '@/lib/os/analytics/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OSAnalyticsPage() {
  let initialOverview: WorkspaceAnalyticsOverview | null = null;
  let error: string | null = null;

  try {
    // Fetch initial analytics overview (30-day default)
    initialOverview = await getWorkspaceAnalyticsOverview({
      preset: '30d',
      includeFunnel: true,
      includeAlerts: true,
    });
  } catch (err) {
    console.error('[OS Analytics Page] Error fetching initial overview:', err);
    error = err instanceof Error ? err.message : 'Failed to load analytics data';
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Workspace Analytics</h1>
          <p className="text-slate-400 mt-1">
            GA4 traffic, Search Console data, growth funnel, and AI-powered insights
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Monitor performance, identify issues, and discover opportunities.
          </p>
        </div>

        <WorkspaceAnalyticsClient
          initialOverview={initialOverview}
          error={error}
        />
      </div>
    </div>
  );
}
