/**
 * Hive OS — Dashboard (Today View)
 *
 * The "day in the life" dashboard showing:
 * - What's happening now?
 * - What clients need attention?
 * - What work is due?
 * - What's happening in the funnel/analytics?
 * - AI Briefing with focus recommendations
 */

import Link from 'next/link';
import { getDashboardSummary } from '@/lib/os/dashboardSummary';
import HiveLogo from '@/components/HiveLogo';
import { DashboardClient } from '@/components/os/DashboardClient';

export default async function HiveOsDashboard() {
  const summary = await getDashboardSummary();

  return (
    <div className="min-h-screen bg-[#050608] p-8">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 rounded-t-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <HiveLogo className="h-14 w-auto" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-100">Today</h1>
                  <p className="text-sm text-slate-400">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-900/30 rounded-b-2xl">
        <DashboardClient summary={summary} />
      </div>
    </div>
  );
}
