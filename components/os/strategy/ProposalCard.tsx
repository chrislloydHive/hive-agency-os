'use client';

// components/os/strategy/ProposalCard.tsx
// Displays a single AI proposal with Apply/Edit/Discard actions
//
// Used in the bidirectional strategy evolution UI to show
// AI-suggested changes grouped by layer.

import React, { useState } from 'react';
import {
  Lightbulb,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  Layers,
  Zap,
} from 'lucide-react';
import type { StrategyProposal } from '@/lib/types/strategyBidirectional';

// ============================================================================
// Types
// ============================================================================

interface ProposalCardProps {
  proposal: StrategyProposal;
  onApply: (proposal: StrategyProposal) => void;
  onEdit: (proposal: StrategyProposal) => void;
  onDiscard: (proposal: StrategyProposal) => void;
  onUnlockRequest?: (proposal: StrategyProposal) => void;
  applying?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const ACTION_ICONS = {
  add: Plus,
  modify: Pencil,
  remove: Trash2,
};

const ACTION_LABELS = {
  add: 'Add',
  modify: 'Modify',
  remove: 'Remove',
};

const ACTION_COLORS = {
  add: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  modify: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  remove: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const TYPE_ICONS = {
  objective: Target,
  strategy: Layers,
  tactic: Zap,
};

const TYPE_LABELS = {
  objective: 'Objective',
  strategy: 'Priority',
  tactic: 'Tactic',
};

const TYPE_COLORS = {
  objective: 'text-purple-400',
  strategy: 'text-blue-400',
  tactic: 'text-emerald-400',
};

const CONFIDENCE_COLORS = {
  high: 'bg-emerald-500/10 text-emerald-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-slate-500/10 text-slate-400',
};

// ============================================================================
// Component
// ============================================================================

export function ProposalCard({
  proposal,
  onApply,
  onEdit,
  onDiscard,
  onUnlockRequest,
  applying = false,
  className = '',
}: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const ActionIcon = ACTION_ICONS[proposal.action];
  const TypeIcon = TYPE_ICONS[proposal.type];

  // Extract title from proposed change
  const proposedTitle =
    (proposal.proposedChange as { title?: string; text?: string }).title ||
    (proposal.proposedChange as { title?: string; text?: string }).text ||
    'Untitled';

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        ${proposal.targetIsLocked
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-slate-700 bg-slate-800/50'
        }
        ${className}
      `}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`
              p-2 rounded-lg
              ${ACTION_COLORS[proposal.action]}
            `}
          >
            <ActionIcon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Type + Action */}
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className={`w-3.5 h-3.5 ${TYPE_COLORS[proposal.type]}`} />
              <span className={`text-xs font-medium ${TYPE_COLORS[proposal.type]}`}>
                {ACTION_LABELS[proposal.action]} {TYPE_LABELS[proposal.type]}
              </span>
              {proposal.targetIsLocked && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-medium text-white truncate">
              {proposedTitle}
            </h4>

            {/* Rationale */}
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {proposal.rationale}
            </p>

            {/* Confidence */}
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${CONFIDENCE_COLORS[proposal.confidence]}
                `}
              >
                {proposal.confidence} confidence
              </span>
            </div>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          {/* Proposed Changes */}
          <div className="mb-3">
            <h5 className="text-xs font-medium text-slate-300 mb-2">
              Proposed Changes
            </h5>
            <pre className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded overflow-x-auto">
              {JSON.stringify(proposal.proposedChange, null, 2)}
            </pre>
          </div>

          {/* Related Items */}
          {proposal.relatedItemIds && proposal.relatedItemIds.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-slate-300 mb-1">
                Related Items
              </h5>
              <div className="flex flex-wrap gap-1">
                {proposal.relatedItemIds.map(id => (
                  <span
                    key={id}
                    className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Target ID */}
          {proposal.targetId && (
            <div className="text-xs text-slate-500">
              Target: {proposal.targetId}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 bg-slate-900/30 border-t border-slate-700/50">
        {proposal.targetIsLocked ? (
          <>
            <button
              onClick={() => onUnlockRequest?.(proposal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Request Unlock
            </button>
            <span className="flex-1" />
            <button
              onClick={() => onDiscard(proposal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onApply(proposal)}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {applying ? 'Applying...' : 'Apply'}
            </button>
            <button
              onClick={() => onEdit(proposal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <span className="flex-1" />
            <button
              onClick={() => onDiscard(proposal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Proposal Group Component
// ============================================================================

interface ProposalGroupProps {
  title: string;
  icon: React.ReactNode;
  proposals: StrategyProposal[];
  onApply: (proposal: StrategyProposal) => void;
  onEdit: (proposal: StrategyProposal) => void;
  onDiscard: (proposal: StrategyProposal) => void;
  onUnlockRequest?: (proposal: StrategyProposal) => void;
  applyingId?: string;
  className?: string;
}

export function ProposalGroup({
  title,
  icon,
  proposals,
  onApply,
  onEdit,
  onDiscard,
  onUnlockRequest,
  applyingId,
  className = '',
}: ProposalGroupProps) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-medium text-white">
          {title}
        </h3>
        <span className="text-xs text-slate-400">
          ({proposals.length})
        </span>
      </div>

      <div className="space-y-3">
        {proposals.map(proposal => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onApply={onApply}
            onEdit={onEdit}
            onDiscard={onDiscard}
            onUnlockRequest={onUnlockRequest}
            applying={applyingId === proposal.id}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

export function ProposalEmptyState({
  message = 'No proposals generated',
  action,
}: {
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 bg-slate-800/50 rounded-full mb-3">
        <Lightbulb className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm text-slate-400 mb-3">{message}</p>
      {action}
    </div>
  );
}

// ============================================================================
// Health Signal Warning
// ============================================================================

export function HealthSignalWarning({
  signal,
  message,
  items,
  onAction,
  actionLabel = 'Fix',
}: {
  signal: 'warning' | 'error';
  message: string;
  items?: string[];
  onAction?: () => void;
  actionLabel?: string;
}) {
  const bgColor = signal === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10';
  const borderColor = signal === 'error' ? 'border-red-500/30' : 'border-amber-500/30';
  const iconColor = signal === 'error' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300">{message}</p>
          {items && items.length > 0 && (
            <ul className="mt-1 text-xs text-slate-400 list-disc list-inside">
              {items.slice(0, 3).map((item, i) => (
                <li key={i} className="truncate">{item}</li>
              ))}
              {items.length > 3 && (
                <li className="text-slate-500">+{items.length - 3} more</li>
              )}
            </ul>
          )}
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className={`
              text-xs px-2 py-1 rounded
              ${signal === 'error'
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              }
              transition-colors
            `}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
