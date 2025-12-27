'use client';

// components/os/artifacts/ArtifactUsageIndicators.tsx
// Impact indicators for artifact viewer header
//
// Shows:
// - "Used in X work items"
// - "Referenced in completed work" (if applicable)
// - Tooltip explaining signals

import { Briefcase, CheckCircle2, Info } from 'lucide-react';
import type { ArtifactUsage } from '@/lib/types/artifact';

interface ArtifactUsageIndicatorsProps {
  usage: ArtifactUsage;
  className?: string;
}

export function ArtifactUsageIndicators({
  usage,
  className = '',
}: ArtifactUsageIndicatorsProps) {
  const hasUsage = usage.attachedWorkCount > 0;
  const hasCompletedWork = usage.completedWorkCount > 0;

  // Don't show anything if no usage
  if (!hasUsage && !hasCompletedWork) {
    return null;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Work Item Count */}
      {hasUsage && (
        <div
          className="flex items-center gap-1.5 text-xs text-slate-400"
          title={`Attached to ${usage.attachedWorkCount} work item${usage.attachedWorkCount !== 1 ? 's' : ''}`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>
            Used in {usage.attachedWorkCount} work item{usage.attachedWorkCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Completed Work Indicator */}
      {hasCompletedWork && (
        <div
          className="flex items-center gap-1.5 text-xs text-emerald-400"
          title={`${usage.completedWorkCount} attached work item${usage.completedWorkCount !== 1 ? 's' : ''} completed`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>
            Referenced in completed work
          </span>
        </div>
      )}

      {/* Info tooltip */}
      <div className="relative group">
        <Info className="w-3.5 h-3.5 text-slate-600 hover:text-slate-500 cursor-help" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Based on work item attachments and task completion
        </div>
      </div>
    </div>
  );
}

/**
 * Compact badge version for list views
 */
export function ArtifactUsageBadge({
  usage,
  showLabel = true,
}: {
  usage: ArtifactUsage;
  showLabel?: boolean;
}) {
  const hasUsage = usage.attachedWorkCount > 0;
  const hasCompletedWork = usage.completedWorkCount > 0;

  if (hasCompletedWork) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded"
        title={`${usage.completedWorkCount} completed work items`}
      >
        <CheckCircle2 className="w-3 h-3" />
        {showLabel && 'High impact'}
      </span>
    );
  }

  if (hasUsage) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded"
        title={`Used in ${usage.attachedWorkCount} work items`}
      >
        <Briefcase className="w-3 h-3" />
        {showLabel && 'Used'}
      </span>
    );
  }

  return null;
}

/**
 * Get usage filter label
 */
export function getUsageFilterLabel(filter: 'all' | 'used' | 'never_used' | 'high_impact' | 'recently_used'): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'used':
      return 'Used';
    case 'never_used':
      return 'Never used';
    case 'high_impact':
      return 'High impact';
    case 'recently_used':
      return 'Recently used';
  }
}

export default ArtifactUsageIndicators;
