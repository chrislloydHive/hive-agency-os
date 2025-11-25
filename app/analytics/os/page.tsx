// app/analytics/os/page.tsx
// Workspace Analytics page for Hive OS
// Displays GA4, GSC, Funnel metrics, and AI-powered insights

import { WorkspaceAnalyticsClient } from '@/components/os/WorkspaceAnalyticsClient';
import { getWorkspaceAnalyticsOverview } from '@/lib/os/analytics/overview';
import type { WorkspaceAnalyticsOverview } from '@/lib/os/analytics/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Analytics',
  description: 'Workspace-wide GA4, Search Console, and funnel analytics.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceAnalyticsPage() {
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
            GA4 + Search Console + Funnel analytics for the entire Hive OS workspace.
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
