// app/analytics/page.tsx
// Global Analytics Dashboard
//
// Aggregated analytics view across all companies in the workspace.
// Shows totals, top performers, funnel metrics, and attention-needed alerts.

import { WorkspaceAnalyticsDashboard } from '@/components/analytics/WorkspaceAnalyticsDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Aggregated analytics across all companies - traffic, conversions, funnels, and search performance.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AnalyticsPage() {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Analytics</h1>
          <p className="text-slate-400 mt-1">
            Aggregated metrics across all companies in your workspace.
          </p>
        </div>

        <WorkspaceAnalyticsDashboard />
      </div>
    </div>
  );
}
