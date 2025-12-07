// app/c/[companyId]/qbr/scorecard/page.tsx
// QBR Scorecard - KPI dashboard and metrics view

import { Metadata } from 'next';
import { TrendingUp, Target, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Scorecard - QBR',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrScorecardPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-slate-500 mb-1">QBR &rarr; Scorecard</p>
        <h2 className="text-lg font-semibold text-slate-100">Scorecard</h2>
        <p className="text-sm text-slate-400 mt-1">
          Track key performance indicators and measure progress against targets.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-6">
            <BarChart3 className="w-8 h-8 text-blue-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            KPI Scorecard Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Track key performance indicators, compare against targets, and visualize trends over time.
            This view consolidates metrics from all sources.
          </p>

          <div className="w-full space-y-3">
            <KpiPreview
              title="Revenue vs Target"
              value="$142K"
              target="$150K"
              trend="up"
              percentage={8.5}
            />
            <KpiPreview
              title="Customer Acquisition Cost"
              value="$45"
              target="$40"
              trend="down"
              percentage={-12.5}
            />
            <KpiPreview
              title="Conversion Rate"
              value="3.2%"
              target="3.5%"
              trend="up"
              percentage={4.2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiPreview({
  title,
  value,
  target,
  trend,
  percentage,
}: {
  title: string;
  value: string;
  target: string;
  trend: 'up' | 'down';
  percentage: number;
}) {
  const isPositive = percentage > 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="flex items-center gap-3">
        <Target className="w-4 h-4 text-slate-500" />
        <div>
          <div className="text-sm font-medium text-slate-200">{title}</div>
          <div className="text-xs text-slate-500">Target: {target}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-slate-200">{value}</div>
        <div className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(percentage)}%
        </div>
      </div>
    </div>
  );
}
