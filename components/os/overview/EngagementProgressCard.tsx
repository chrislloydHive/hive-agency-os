'use client';

// components/os/overview/EngagementProgressCard.tsx
// Engagement Progress Card - Shows GAP progress during context gathering
//
// Displays:
// - Overall progress
// - Lab-by-lab status
// - Context approval action when complete

import { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { CompanyEngagement } from '@/lib/types/engagement';
import type { LabId } from '@/lib/contextGraph/labContext';
import { getStatusLabel, getStatusColor, ENGAGEMENT_TYPE_CONFIG, PROJECT_TYPE_CONFIG } from '@/lib/types/engagement';

// ============================================================================
// Types
// ============================================================================

export interface LabProgress {
  labId: LabId;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

export interface EngagementProgressCardProps {
  engagement: CompanyEngagement;
  labProgress?: LabProgress[];
  onApproveContext: () => void;
  onCancel: () => void;
  onRefresh?: () => void;
  approving?: boolean;
  cancelling?: boolean;
}

// ============================================================================
// Lab Label Map
// ============================================================================

const LAB_LABELS: Record<LabId, string> = {
  brand: 'Brand Lab',
  audience: 'Audience Lab',
  website: 'Website Lab',
  seo: 'SEO Lab',
  content: 'Content Lab',
  media: 'Media Lab',
  demand: 'Demand Lab',
  creative: 'Creative Lab',
  ux: 'UX Lab',
  ops: 'Operations Lab',
  competitor: 'Competitor Lab',
};

// ============================================================================
// Component
// ============================================================================

export function EngagementProgressCard({
  engagement,
  labProgress = [],
  onApproveContext,
  onCancel,
  onRefresh,
  approving = false,
  cancelling = false,
}: EngagementProgressCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Calculate progress
  // If labsCompletedAt is set, labs are done (from Inngest)
  const labsFinished = !!engagement.labsCompletedAt;

  const totalLabs = engagement.selectedLabs.length;
  const completedLabs = labsFinished
    ? totalLabs
    : labProgress.filter(l => l.status === 'complete').length;
  const runningLabs = labsFinished
    ? 0
    : labProgress.filter(l => l.status === 'running').length;
  const errorLabs = labProgress.filter(l => l.status === 'error').length;
  const progressPercent = totalLabs > 0 ? Math.round((completedLabs / totalLabs) * 100) : 0;
  const isComplete = labsFinished || (completedLabs === totalLabs && totalLabs > 0);
  const hasErrors = errorLabs > 0;

  // Track elapsed time
  useEffect(() => {
    if (engagement.status !== 'context_gathering') return;

    const startTime = new Date(engagement.updatedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [engagement.status, engagement.updatedAt]);

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get engagement display info
  const typeConfig = ENGAGEMENT_TYPE_CONFIG[engagement.type];
  const projectConfig = engagement.projectType ? PROJECT_TYPE_CONFIG[engagement.projectType] : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded bg-${typeConfig.color}-500/20 text-${typeConfig.color}-400`}>
              {typeConfig.badge}
            </span>
            {projectConfig && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-700 text-slate-400">
                {projectConfig.label}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-white">
            {engagement.projectName || typeConfig.label}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {getStatusLabel(engagement.status)}
            {engagement.status === 'context_gathering' && (
              <span className="ml-2 text-slate-500">({formatTime(elapsedTime)})</span>
            )}
          </p>
        </div>

        {/* Status indicator */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center
          ${isComplete ? 'bg-emerald-500/20' : 'bg-purple-500/20'}
        `}>
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Progress section */}
      <div className="mb-6">
        {isComplete ? (
          <>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">
                Full GAP + {totalLabs} labs complete
              </span>
              <span className="font-medium text-emerald-400">100%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 w-full" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">
                Running Full GAP + {totalLabs} labs...
              </span>
              <span className="font-medium text-purple-400">In progress</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-purple-500 animate-pulse w-full opacity-50" />
            </div>
          </>
        )}
      </div>

      {/* Lab progress list */}
      {engagement.selectedLabs.length > 0 && (
        <div className="space-y-2 mb-6">
          {/* Full GAP row */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg">
            <span className="text-sm text-slate-300 font-medium">Full GAP Analysis</span>
            <div className="flex items-center gap-2">
              {labsFinished ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              )}
            </div>
          </div>
          {/* Individual labs */}
          {engagement.selectedLabs.map((labId) => {
            const lab = labProgress.find(l => l.labId === labId);
            // Show running while in progress, complete when done
            const status = labsFinished ? 'complete' : (lab?.status || 'running');

            return (
              <div
                key={labId}
                className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg"
              >
                <span className="text-sm text-slate-300">
                  {LAB_LABELS[labId] || labId}
                </span>
                <div className="flex items-center gap-2">
                  {status === 'pending' && (
                    <Clock className="w-4 h-4 text-slate-500" />
                  )}
                  {status === 'running' && (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  )}
                  {status === 'complete' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message if any */}
      {hasErrors && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Some labs encountered errors</p>
              <p className="text-xs text-slate-400 mt-1">
                You can still approve the context with available data, or cancel and retry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        {/* Left side - cancel / refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={approving || cancelling}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel'}
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={approving || cancelling}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh progress"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right side - review context (navigate to context page first) */}
        {isComplete && engagement.status === 'context_gathering' && (
          <button
            onClick={() => {
              // Navigate to context page where user can review before approving
              window.location.href = `/c/${engagement.companyId}/context`;
            }}
            disabled={approving || cancelling}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            Review Context
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Waiting indicator if not complete */}
        {!isComplete && engagement.status === 'context_gathering' && (
          <p className="text-sm text-slate-500">
            Waiting for labs to complete...
          </p>
        )}
      </div>

      {/* Strategy inputs confirmed state */}
      {engagement.status === 'context_approved' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Strategy inputs confirmed</p>
                <p className="text-xs text-slate-400">
                  Completed {engagement.contextApprovedAt
                    ? new Date(engagement.contextApprovedAt).toLocaleDateString()
                    : 'recently'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                // Go to context page to review approved context
                window.location.href = `/c/${engagement.companyId}/context`;
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              View Context
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EngagementProgressCard;
