'use client';

// components/os/strategy/PriorityCard.tsx
// Displays a Strategic Bet with AI Improve controls for each field
//
// Features:
// - Title, description, rationale fields with AI Improve buttons
// - Priority level badge
// - Linked objectives indicator
// - Lock/unlock status
// - Coverage warning for unsupported priorities

import React from 'react';
import {
  Target,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { StrategyPriorityV6 } from '@/lib/types/strategyBidirectional';
import { FieldAIActions, type FieldDraft } from '@/components/os/ai/FieldAIActions';

// ============================================================================
// Types
// ============================================================================

interface PriorityCardProps {
  priority: StrategyPriorityV6;
  index: number;
  companyId: string;
  strategyId: string;
  // Coverage warning
  hasNoCoverage?: boolean;
  // AI Drafts
  drafts?: {
    title?: FieldDraft;
    description?: FieldDraft;
    rationale?: FieldDraft;
  };
  onDraftReceived?: (draft: FieldDraft) => void;
  onApplyDraft?: (fieldKey: string, value: string) => void;
  onDiscardDraft?: (fieldKey: string) => void;
  // Context for AI
  contextPayload?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
  };
  className?: string;
}

// ============================================================================
// Priority Level Badge
// ============================================================================

function PriorityBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[level]}`}>
      {level}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PriorityCard({
  priority,
  index,
  companyId,
  strategyId,
  hasNoCoverage = false,
  drafts = {},
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
  className = '',
}: PriorityCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Helper to create field-specific key
  const makeFieldKey = (field: string) => `priority.${index}.${field}`;

  // Helper to determine if AI actions are available
  const hasAiActions = onDraftReceived && onApplyDraft && onDiscardDraft;

  return (
    <div
      className={`
        p-3 border rounded-lg
        ${priority.isLocked
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-slate-700 bg-slate-800/50'
        }
        ${className}
      `}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white truncate">
              {priority.title}
            </h3>
            {priority.isLocked && (
              <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {priority.description}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityBadge level={priority.priority} />
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Linked Objectives */}
      {priority.objectiveIds && priority.objectiveIds.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Target className="w-3 h-3 text-purple-400" />
          {priority.objectiveIds.length} objective(s)
        </div>
      )}

      {/* Coverage Warning */}
      {hasNoCoverage && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          No tactical support
        </div>
      )}

      {/* Expanded: Editable Fields with AI */}
      {expanded && hasAiActions && (
        <div className="mt-4 pt-3 border-t border-slate-700 space-y-4">
          {/* Title Field */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Title</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700">
              {priority.title || 'Not defined'}
            </div>
            <FieldAIActions
              fieldKey={makeFieldKey('title')}
              currentValue={priority.title}
              scope="strategy"
              companyId={companyId}
              strategyId={strategyId}
              contextPayload={contextPayload}
              draft={drafts.title}
              onDraftReceived={onDraftReceived}
              onApply={(value) => onApplyDraft(makeFieldKey('title'), value)}
              onDiscard={() => onDiscardDraft(makeFieldKey('title'))}
              disabled={priority.isLocked}
              compact
            />
          </div>

          {/* Description Field */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Description</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700">
              {priority.description || 'Not defined'}
            </div>
            <FieldAIActions
              fieldKey={makeFieldKey('description')}
              currentValue={priority.description}
              scope="strategy"
              companyId={companyId}
              strategyId={strategyId}
              contextPayload={contextPayload}
              draft={drafts.description}
              onDraftReceived={onDraftReceived}
              onApply={(value) => onApplyDraft(makeFieldKey('description'), value)}
              onDiscard={() => onDiscardDraft(makeFieldKey('description'))}
              disabled={priority.isLocked}
              compact
            />
          </div>

          {/* Rationale Field */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Rationale (Why)</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700">
              {priority.rationale || 'Not defined'}
            </div>
            <FieldAIActions
              fieldKey={makeFieldKey('rationale')}
              currentValue={priority.rationale || null}
              scope="strategy"
              companyId={companyId}
              strategyId={strategyId}
              contextPayload={contextPayload}
              draft={drafts.rationale}
              onDraftReceived={onDraftReceived}
              onApply={(value) => onApplyDraft(makeFieldKey('rationale'), value)}
              onDiscard={() => onDiscardDraft(makeFieldKey('rationale'))}
              disabled={priority.isLocked}
              compact
            />
          </div>
        </div>
      )}

      {/* Expanded: No AI Actions - Read Only */}
      {expanded && !hasAiActions && (
        <div className="mt-4 pt-3 border-t border-slate-700 space-y-3">
          {priority.rationale && (
            <div>
              <label className="text-xs font-medium text-slate-400">Rationale</label>
              <p className="text-xs text-slate-300 mt-1">{priority.rationale}</p>
            </div>
          )}
          {priority.tradeoff && (
            <div>
              <label className="text-xs font-medium text-slate-400">Tradeoff</label>
              <p className="text-xs text-slate-300 mt-1">{priority.tradeoff}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PriorityCard;
