'use client';

import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import type { PipelineKpis, OpportunityItem } from '@/lib/types/pipeline';
import { ForecastSection } from '@/components/pipeline/ForecastSection';

interface PipelineDashboardClientProps {
  kpis: PipelineKpis;
  winRate: number;
  avgDealSize: number;
  totalOpportunities: number;
  overdueOpportunities?: OpportunityItem[];
  overdueCount?: number;
}

// Color palette for charts
const STAGE_COLORS: Record<string, string> = {
  Discovery: '#3b82f6', // blue
  Qualification: '#8b5cf6', // purple
  Proposal: '#f59e0b', // amber
  Negotiation: '#f97316', // orange
  Won: '#10b981', // emerald
  Lost: '#ef4444', // red
  Other: '#6b7280', // gray
};

// Format currency
const formatCurrency = (num: number) => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
};

// Format number with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

// Helper to format relative date for overdue items
function formatDaysOverdue(dueDate: string): string {
  const due = new Date(dueDate);
  const today = new Date(new Date().toDateString());
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return '1 day overdue';
  return `${diffDays} days overdue`;
}

export function PipelineDashboardClient({
  kpis,
  winRate,
  avgDealSize,
  totalOpportunities,
  overdueOpportunities = [],
  overdueCount = 0,
}: PipelineDashboardClientProps) {
  // Prepare stage data for bar chart
  const stageData = kpis.opportunitiesByStage.map((item) => ({
    name: item.stage,
    count: item.count,
    value: item.value,
    fill: STAGE_COLORS[item.stage] || STAGE_COLORS.Other,
  }));

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-200 font-medium">{label}</p>
          <p className="text-slate-400 text-sm">
            Count: <span className="text-slate-200">{payload[0]?.payload?.count}</span>
          </p>
          <p className="text-slate-400 text-sm">
            Value: <span className="text-emerald-400">{formatCurrency(payload[0]?.payload?.value || 0)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-500">
            {formatCurrency(kpis.totalPipelineValue)}
          </div>
          <div className="text-xs text-slate-500">Total Pipeline</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">
            {kpis.openOpportunitiesCount}
          </div>
          <div className="text-xs text-slate-500">Open Opportunities</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">
            {winRate.toFixed(0)}%
          </div>
          <div className="text-xs text-slate-500">Win Rate</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">
            {formatCurrency(avgDealSize)}
          </div>
          <div className="text-xs text-slate-500">Avg Deal Size</div>
        </div>
      </div>

      {/* Pipeline Forecast */}
      <ForecastSection />

      {/* Overdue Next Steps Widget */}
      {(overdueCount > 0 || overdueOpportunities.length > 0) && (
        <div className="bg-slate-900/70 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              Overdue Next Steps
            </h3>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30 rounded">
                {overdueCount} overdue
              </span>
            )}
          </div>

          {overdueOpportunities.length === 0 ? (
            <div className="py-6 text-center">
              <div className="text-emerald-400 text-2xl mb-2">✓</div>
              <div className="text-sm text-slate-400">All caught up!</div>
              <div className="text-xs text-slate-500 mt-1">No overdue next steps</div>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueOpportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/pipeline/opportunities/${opp.id}`}
                  className="block p-3 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {opp.companyName || opp.deliverableName || 'Unnamed Opportunity'}
                      </div>
                      {opp.nextStep && (
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {opp.nextStep}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-red-400 whitespace-nowrap">
                      {opp.nextStepDue ? formatDaysOverdue(opp.nextStepDue) : 'Overdue'}
                    </div>
                  </div>
                  {opp.owner && (
                    <div className="text-xs text-slate-500 mt-2">
                      Assigned to: {opp.owner}
                    </div>
                  )}
                </Link>
              ))}

              {overdueCount > overdueOpportunities.length && (
                <Link
                  href="/pipeline/opportunities"
                  className="block text-center py-2 text-xs text-amber-400 hover:text-amber-300"
                >
                  +{overdueCount - overdueOpportunities.length} more overdue →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pipeline by Stage Chart */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Pipeline by Stage
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                tickFormatter={(val) => formatCurrency(val)}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                width={100}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Owner Breakdown */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Pipeline by Owner
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpis.opportunitiesByOwner}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="owner"
                stroke="#64748b"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tickFormatter={(val) => formatCurrency(val)}
                stroke="#64748b"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number) => [formatCurrency(value), 'Value']}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline Forecast by Month */}
      {kpis.pipelineByMonth.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Pipeline by Close Date
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpis.pipelineByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis
                  tickFormatter={(val) => formatCurrency(val)}
                  stroke="#64748b"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number) => [formatCurrency(value), 'Pipeline']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick Link */}
      <Link
        href="/pipeline/opportunities"
        className="block bg-slate-900/70 border border-slate-800 rounded-xl p-6 hover:bg-slate-800/50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
              View Opportunities
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {totalOpportunities} total opportunities in pipeline
            </p>
          </div>
          <svg
            className="w-6 h-6 text-slate-600 group-hover:text-amber-400 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Link>
    </div>
  );
}
