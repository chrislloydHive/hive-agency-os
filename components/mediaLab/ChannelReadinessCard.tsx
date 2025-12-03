'use client';

// components/mediaLab/ChannelReadinessCard.tsx
// Channel Readiness Checklist Component

import { useState } from 'react';
import {
  type ChannelReadinessChecklist,
  type ChannelRequirement,
  type ChannelReadinessStatus,
  CHANNEL_READINESS_CONFIG,
  MEDIA_CHANNEL_COLORS,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

interface ChannelReadinessCardProps {
  checklists: ChannelReadinessChecklist[];
  readinessScore: number;
  onUpdateStatus: (requirementId: string, status: ChannelReadinessStatus) => void;
  onCreateWorkItem?: (requirement: ChannelRequirement) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ChannelReadinessCard({
  checklists,
  readinessScore,
  onUpdateStatus,
  onCreateWorkItem,
}: ChannelReadinessCardProps) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">
            Channel Readiness
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete these requirements before launch
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold tabular-nums ${getScoreColor(readinessScore)}`}>
            {readinessScore}%
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ready</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${getScoreBg(readinessScore)}`}
          style={{ width: `${readinessScore}%` }}
        />
      </div>

      {/* Channel Checklists */}
      <div className="space-y-2">
        {checklists.map((checklist) => (
          <ChannelChecklistItem
            key={checklist.channel}
            checklist={checklist}
            isExpanded={expandedChannel === checklist.channel}
            onToggle={() =>
              setExpandedChannel(
                expandedChannel === checklist.channel ? null : checklist.channel
              )
            }
            onUpdateStatus={onUpdateStatus}
            onCreateWorkItem={onCreateWorkItem}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Channel Checklist Item
// ============================================================================

function ChannelChecklistItem({
  checklist,
  isExpanded,
  onToggle,
  onUpdateStatus,
  onCreateWorkItem,
}: {
  checklist: ChannelReadinessChecklist;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (requirementId: string, status: ChannelReadinessStatus) => void;
  onCreateWorkItem?: (requirement: ChannelRequirement) => void;
}) {
  const channelColors = MEDIA_CHANNEL_COLORS[checklist.channel];
  const statusConfig = CHANNEL_READINESS_CONFIG[checklist.overallStatus];

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              checklist.overallStatus === 'ready'
                ? 'bg-emerald-400'
                : checklist.overallStatus === 'partial'
                ? 'bg-amber-400'
                : 'bg-red-400'
            }`}
          />
          <span className={`text-sm font-medium ${channelColors.text}`}>
            {checklist.channelLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {checklist.readyCount}/{checklist.totalCount}
          </span>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Requirements List */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
          {checklist.requirements.map((req) => (
            <RequirementItem
              key={req.id}
              requirement={req}
              onUpdateStatus={onUpdateStatus}
              onCreateWorkItem={onCreateWorkItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Requirement Item
// ============================================================================

function RequirementItem({
  requirement,
  onUpdateStatus,
  onCreateWorkItem,
}: {
  requirement: ChannelRequirement;
  onUpdateStatus: (requirementId: string, status: ChannelReadinessStatus) => void;
  onCreateWorkItem?: (requirement: ChannelRequirement) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const statusConfig = CHANNEL_READINESS_CONFIG[requirement.status];

  const getPriorityBadge = () => {
    switch (requirement.priority) {
      case 'required':
        return (
          <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">
            Required
          </span>
        );
      case 'recommended':
        return (
          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
            Recommended
          </span>
        );
      case 'optional':
        return (
          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-500/20 text-slate-400">
            Optional
          </span>
        );
    }
  };

  const cycleStatus = () => {
    const statusOrder: ChannelReadinessStatus[] = ['missing', 'partial', 'ready'];
    const currentIndex = statusOrder.indexOf(requirement.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onUpdateStatus(requirement.id, statusOrder[nextIndex]);
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-700/20 hover:bg-slate-700/30 transition-colors">
      {/* Status Toggle */}
      <button
        type="button"
        onClick={cycleStatus}
        className={`flex-shrink-0 w-5 h-5 rounded border transition-colors ${
          requirement.status === 'ready'
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            : requirement.status === 'partial'
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
            : 'bg-slate-700 border-slate-600 text-slate-500'
        }`}
      >
        {requirement.status === 'ready' && (
          <svg className="w-full h-full p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {requirement.status === 'partial' && (
          <svg className="w-full h-full p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-200">{requirement.label}</span>
          {getPriorityBadge()}
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">{requirement.description}</p>
      </div>

      {/* Actions */}
      {requirement.status !== 'ready' && onCreateWorkItem && (
        <button
          type="button"
          onClick={() => onCreateWorkItem(requirement)}
          className="flex-shrink-0 p-1 rounded hover:bg-slate-600/50 text-slate-500 hover:text-slate-300 transition-colors"
          title="Create work item"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
