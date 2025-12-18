'use client';

// components/company/CompanyStatusHeader.tsx
// Company Status Header for Overview page
//
// Displays a compact 3-column status block:
// - Performance: Analytics status (Good/Watch/At Risk/Unknown)
// - Work: Work items status (On Track/Blocked/None)
// - Next Action: Single CTA based on state

import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Activity, Briefcase, Zap } from 'lucide-react';
import type {
  CompanyStatusHeader as StatusHeaderData,
  PerformanceState,
  WorkStatusState,
} from '@/lib/os/companies/companyStatus';

// ============================================================================
// Style Configuration
// ============================================================================

const performanceStateConfig: Record<PerformanceState, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = {
  good: {
    label: 'Good',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  watch: {
    label: 'Watch',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  risk: {
    label: 'At Risk',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-500',
  },
};

const workStateConfig: Record<WorkStatusState, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = {
  on_track: {
    label: 'On Track',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  watch: {
    label: 'Watch',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  none: {
    label: 'None',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-500',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-500',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    case 'down':
      return <TrendingDown className="w-3 h-3 text-red-400" />;
    default:
      return <Minus className="w-3 h-3 text-slate-500" />;
  }
}

function StatusChip({
  label,
  color,
  bg,
  border,
  dot,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${bg} ${border} ${color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface CompanyStatusHeaderProps {
  status: StatusHeaderData;
  className?: string;
}

export function CompanyStatusHeader({ status, className = '' }: CompanyStatusHeaderProps) {
  const perfConfig = performanceStateConfig[status.performance.state];
  const workConfig = workStateConfig[status.work.state];

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* Column A: Performance Snapshot */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${perfConfig.color}`} />
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Performance
              </span>
            </div>
            <StatusChip {...perfConfig} />
          </div>

          {status.performance.state === 'unknown' ? (
            <p className="text-xs text-slate-500">{status.performance.note || 'No analytics connected'}</p>
          ) : (
            <div className="space-y-1">
              {status.performance.primaryMetric && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {status.performance.primaryMetric.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white tabular-nums">
                      {status.performance.primaryMetric.value}
                    </span>
                    <TrendIcon trend={status.performance.primaryMetric.trend} />
                  </div>
                </div>
              )}
              {status.performance.secondaryMetrics?.map((metric, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{metric.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-300 tabular-nums">{metric.value}</span>
                    <TrendIcon trend={metric.trend} />
                  </div>
                </div>
              ))}
              {status.performance.note && (
                <p className="text-[10px] text-amber-400 mt-1">{status.performance.note}</p>
              )}
            </div>
          )}
        </div>

        {/* Column B: Work Snapshot */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Briefcase className={`w-4 h-4 ${workConfig.color}`} />
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Work
              </span>
            </div>
            <StatusChip {...workConfig} />
          </div>

          {status.work.state === 'none' ? (
            <p className="text-xs text-slate-500">{status.work.note || 'No work items yet'}</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">In Progress</span>
                <span className="text-sm font-medium text-white tabular-nums">
                  {status.work.counts.inProgress}
                </span>
              </div>
              {status.work.counts.blocked > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-400">Blocked</span>
                  <span className="text-sm font-medium text-red-400 tabular-nums">
                    {status.work.counts.blocked}
                  </span>
                </div>
              )}
              {status.work.counts.dueSoon > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-400">Due Soon</span>
                  <span className="text-sm font-medium text-amber-400 tabular-nums">
                    {status.work.counts.dueSoon}
                  </span>
                </div>
              )}
              {status.work.note && status.work.state === 'on_track' && (
                <p className="text-[10px] text-slate-500 mt-1">{status.work.note}</p>
              )}
            </div>
          )}
        </div>

        {/* Column C: Next Best Action */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
              Next Best Action
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">
              {status.nextAction.title}
            </p>
            {status.nextAction.description && (
              <p className="text-xs text-slate-400 line-clamp-2">
                {status.nextAction.description}
              </p>
            )}
            <Link
              href={status.nextAction.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              Go
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyStatusHeader;
