/**
 * Hive OS — Today Dashboard
 *
 * AI-enhanced command center showing:
 * - Overnight summary with AI-generated insights
 * - Today's focus plan (key actions, quick wins, risks, outreach)
 * - High priority queue
 * - Pipeline highlights
 * - Diagnostic review queue
 * - Owner/assignment issues
 */

import { TodayDashboardClient } from '@/components/os/TodayDashboardClient';

export default async function HiveOsDashboard() {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Today</h1>
          <p className="text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <TodayDashboardClient />
      </div>
    </div>
  );
}
