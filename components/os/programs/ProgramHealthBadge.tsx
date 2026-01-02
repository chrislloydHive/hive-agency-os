'use client';

// components/os/programs/ProgramHealthBadge.tsx
// Health status badge for programs
//
// Shows at a glance health status with tooltip for details

import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import type { HealthStatus, ProgramHealthSnapshot } from '@/lib/os/programs/programHealth';
import { getHealthBadgeStyle } from '@/lib/os/programs/programHealth';

interface ProgramHealthBadgeProps {
  status: HealthStatus;
  issues?: string[];
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ProgramHealthBadge({
  status,
  issues = [],
  showLabel = false,
  size = 'sm',
}: ProgramHealthBadgeProps) {
  const style = getHealthBadgeStyle(status);
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  const Icon = status === 'Healthy'
    ? CheckCircle
    : status === 'Attention'
    ? AlertTriangle
    : AlertCircle;

  return (
    <div className="group relative">
      <div
        className={`inline-flex items-center gap-1 ${padding} rounded-full ${style.bg} border ${style.border}`}
      >
        <Icon className={`${iconSize} ${style.text}`} />
        {showLabel && (
          <span className={`text-xs font-medium ${style.text}`}>{status}</span>
        )}
      </div>

      {/* Tooltip */}
      {issues.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 text-xs whitespace-nowrap">
            <div className={`font-medium ${style.text} mb-1`}>{status}</div>
            <ul className="text-slate-400 space-y-0.5">
              {issues.map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Health Summary Card
// ============================================================================

interface HealthSummaryCardProps {
  snapshot: ProgramHealthSnapshot;
  onClick?: () => void;
}

export function HealthSummaryCard({ snapshot, onClick }: HealthSummaryCardProps) {
  const style = getHealthBadgeStyle(snapshot.status);

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border ${style.border} ${style.bg} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } transition-opacity`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-white truncate">{snapshot.programTitle}</h4>
        <ProgramHealthBadge status={snapshot.status} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Due Soon</div>
          <div className="font-medium text-white">{snapshot.metrics.dueNext7Days}</div>
        </div>
        <div>
          <div className="text-slate-500">Overdue</div>
          <div className={`font-medium ${
            snapshot.metrics.overdueCount > 0 ? 'text-red-400' : 'text-white'
          }`}>
            {snapshot.metrics.overdueCount}
          </div>
        </div>
        <div>
          <div className="text-slate-500">In Progress</div>
          <div className="font-medium text-white">{snapshot.metrics.workInProgress}</div>
        </div>
        <div>
          <div className="text-slate-500">Completed</div>
          <div className="font-medium text-emerald-400">
            {snapshot.metrics.completedThisPeriod}
          </div>
        </div>
      </div>

      {snapshot.issues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className={`text-xs ${style.text}`}>
            {snapshot.issues[0]}
            {snapshot.issues.length > 1 && ` (+${snapshot.issues.length - 1} more)`}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Capacity Load Badge
// ============================================================================

interface CapacityLoadBadgeProps {
  load: 'low' | 'medium' | 'high';
  showLabel?: boolean;
}

export function CapacityLoadBadge({ load, showLabel = true }: CapacityLoadBadgeProps) {
  const colors = {
    low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
    medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    high: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  };

  const style = colors[load];
  const labels = { low: 'Low Load', medium: 'Medium Load', high: 'High Load' };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          load === 'low' ? 'bg-slate-400' : load === 'medium' ? 'bg-blue-400' : 'bg-amber-400'
        }`}
      />
      {showLabel && labels[load]}
    </span>
  );
}

// ============================================================================
// Capacity Warning Banner
// ============================================================================

interface CapacityWarningBannerProps {
  totalLoadScore: number;
  recommendation?: string;
  onDismiss?: () => void;
}

export function CapacityWarningBanner({
  totalLoadScore,
  recommendation,
  onDismiss,
}: CapacityWarningBannerProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-amber-400">High Capacity Load</div>
        <div className="text-xs text-slate-400 mt-0.5">
          {recommendation || `Total load score: ${totalLoadScore}. Consider adjusting program scope.`}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-500 hover:text-white transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default ProgramHealthBadge;
