// app/analytics/os/page.tsx
// OS Intelligence Dashboard
//
// AI-driven command center for Hive OS workspace operations.
// Provides system health score, risk clusters, opportunities, and actionable insights.

import { OSIntelligenceDashboard } from '@/components/os/OSIntelligenceDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OS Intelligence',
  description: 'AI-driven command center - system health, risk clusters, opportunities, and actionable insights.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OSAnalyticsPage() {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">OS Intelligence</h1>
          <p className="text-slate-400 mt-1">
            AI-driven command center for workspace operations.
          </p>
        </div>

        <OSIntelligenceDashboard />
      </div>
    </div>
  );
}
