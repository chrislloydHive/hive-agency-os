'use client';

// components/os/strategy/TacticsPanel.tsx
// Right panel for Tactics in the bidirectional strategy view
//
// Features:
// - Grouped by Priority
// - Effort vs Impact display
// - Shows linked objectives
// - AI actions: Propose Tactics, Review Fit, Suggest Strategy Updates

import React, { useState, useCallback, useMemo } from 'react';
import {
  Zap,
  Lock,
  Unlock,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Layers,
  GripVertical,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Rocket,
} from 'lucide-react';
import type {
  StrategyObjectiveV6,
  StrategyPriorityV6,
  StrategyTacticV6,
  EffortSize,
} from '@/lib/types/strategyBidirectional';
import { EFFORT_SIZE_LABELS } from '@/lib/types/strategyBidirectional';
import { generatePlayId, PLAY_STATUS_LABELS, PLAY_STATUS_COLORS } from '@/lib/types/strategy';
import type { ImpactLevel, StrategyPlayStatus } from '@/lib/types/strategy';
import { FieldAIActions, type FieldDraft } from '@/components/os/ai/FieldAIActions';

// ============================================================================
// Types
// ============================================================================

interface TacticsPanelProps {
  tactics: StrategyTacticV6[];
  priorities: StrategyPriorityV6[];
  objectives: StrategyObjectiveV6[];
  onUpdateTactic: (tactic: StrategyTacticV6) => void;
  onAddTactic: (tactic: StrategyTacticV6) => void;
  onRemoveTactic: (id: string) => void;
  onLockTactic: (id: string) => void;
  onUnlockTactic: (id: string) => void;
  onPromoteTactic?: (tacticId: string) => void;
  onAiProposeTactics?: () => void;
  onAiReviewFit?: () => void;
  onAiSuggestStrategyUpdates?: () => void;
  aiLoading?: boolean;
  className?: string;
  // AI Field Improvement props
  companyId?: string;
  strategyId?: string;
  fieldDrafts?: Record<string, FieldDraft>;
  onDraftReceived?: (draft: FieldDraft) => void;
  onApplyDraft?: (fieldKey: string, value: string) => void;
  onDiscardDraft?: (fieldKey: string) => void;
  contextPayload?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
  };
}

// ============================================================================
// Helpers
// ============================================================================

const IMPACT_ICONS = {
  high: ArrowUp,
  medium: ArrowRight,
  low: ArrowDown,
};

const IMPACT_COLORS = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
};

const EFFORT_COLORS: Record<EffortSize, string> = {
  s: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  m: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  l: 'bg-red-500/10 text-red-400 border-red-500/30',
};

// ============================================================================
// Tactic Item Component
// ============================================================================

interface TacticItemProps {
  tactic: StrategyTacticV6;
  tacticIndex: number;
  objectives: StrategyObjectiveV6[];
  onUpdate: (tactic: StrategyTacticV6) => void;
  onRemove: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onPromote?: () => void;
  // AI Field Improvement props
  companyId?: string;
  strategyId?: string;
  drafts?: {
    title?: FieldDraft;
    description?: FieldDraft;
  };
  onDraftReceived?: (draft: FieldDraft) => void;
  onApplyDraft?: (fieldKey: string, value: string) => void;
  onDiscardDraft?: (fieldKey: string) => void;
  contextPayload?: unknown;
}

function TacticItem({
  tactic,
  tacticIndex,
  objectives,
  onUpdate,
  onRemove,
  onLock,
  onUnlock,
  onPromote,
  companyId,
  strategyId,
  drafts = {},
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
}: TacticItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(tactic.title);
  const [editDescription, setEditDescription] = useState(tactic.description || '');
  const [editImpact, setEditImpact] = useState<ImpactLevel>(tactic.expectedImpact || 'medium');
  const [editEffort, setEditEffort] = useState<EffortSize>(tactic.effortSize || 'm');
  const [editStatus, setEditStatus] = useState<StrategyPlayStatus>(tactic.status || 'proposed');

  const linkedObjectives = useMemo(
    () => objectives.filter(o => tactic.objectiveIds?.includes(o.id)),
    [objectives, tactic.objectiveIds]
  );

  const handleSave = useCallback(() => {
    onUpdate({
      ...tactic,
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      expectedImpact: editImpact,
      impact: editImpact,
      effortSize: editEffort,
      status: editStatus,
    });
    setEditing(false);
  }, [tactic, editTitle, editDescription, editImpact, editEffort, editStatus, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditTitle(tactic.title);
    setEditDescription(tactic.description || '');
    setEditImpact(tactic.expectedImpact || 'medium');
    setEditEffort(tactic.effortSize || 'm');
    setEditStatus(tactic.status || 'proposed');
    setEditing(false);
  }, [tactic]);

  const ImpactIcon = IMPACT_ICONS[tactic.expectedImpact || 'medium'];

  // AI Field Improvement helpers
  const makeFieldKey = (field: string) => `tactic.${tacticIndex}.${field}`;
  const hasAiActions = companyId && strategyId && onDraftReceived && onApplyDraft && onDiscardDraft;

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        ${tactic.isLocked
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-slate-700 bg-slate-800/50'
        }
      `}
    >
      {/* Main Content */}
      <div className="p-3">
        {editing ? (
          // Edit Mode
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Tactic title"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none resize-none"
                rows={2}
                placeholder="What does this tactic involve?"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Impact</label>
                <select
                  value={editImpact}
                  onChange={e => setEditImpact(e.target.value as ImpactLevel)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Effort</label>
                <select
                  value={editEffort}
                  onChange={e => setEditEffort(e.target.value as EffortSize)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="s">Small</option>
                  <option value="m">Medium</option>
                  <option value="l">Large</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as StrategyPlayStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(PLAY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          // View Mode
          <div className="flex items-start gap-2">
            <div className="pt-0.5 text-slate-600 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{tactic.title}</p>
                  {tactic.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {tactic.description}
                    </p>
                  )}

                  {/* Impact / Effort / Status */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`flex items-center gap-1 text-xs ${IMPACT_COLORS[tactic.expectedImpact || 'medium']}`}
                    >
                      <ImpactIcon className="w-3 h-3" />
                      {tactic.expectedImpact || 'medium'}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${EFFORT_COLORS[tactic.effortSize || 'm']}`}
                    >
                      {EFFORT_SIZE_LABELS[tactic.effortSize || 'm']}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${PLAY_STATUS_COLORS[tactic.status || 'proposed']}`}
                    >
                      {PLAY_STATUS_LABELS[tactic.status || 'proposed']}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {tactic.isLocked ? (
                    <button
                      onClick={onUnlock}
                      className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                      title="Unlock tactic"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      {onPromote && (
                        <button
                          onClick={onPromote}
                          className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                          title="Promote to Program"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(true)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={onLock}
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                        title="Lock tactic"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={onRemove}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Linked Objectives Toggle */}
              {linkedObjectives.length > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-2 mt-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <Target className="w-3 h-3 text-purple-400" />
                  {linkedObjectives.length} objective{linkedObjectives.length > 1 ? 's' : ''}
                  {expanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Links */}
      {expanded && linkedObjectives.length > 0 && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
          <ul className="space-y-1">
            {linkedObjectives.map(o => (
              <li key={o.id} className="text-xs text-slate-400 flex items-start gap-1.5">
                <Target className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
                {o.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Actions Section (when expanded) */}
      {expanded && hasAiActions && !editing && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2 space-y-3">
          {/* Title AI Improvement */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Title</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700">
              {tactic.title}
            </div>
            <FieldAIActions
              fieldKey={makeFieldKey('title')}
              currentValue={tactic.title}
              scope="tactic"
              companyId={companyId}
              strategyId={strategyId}
              contextPayload={contextPayload as Parameters<typeof FieldAIActions>[0]['contextPayload']}
              draft={drafts.title}
              onDraftReceived={onDraftReceived}
              onApply={(value) => onApplyDraft(makeFieldKey('title'), value)}
              onDiscard={() => onDiscardDraft(makeFieldKey('title'))}
              disabled={tactic.isLocked}
              compact
            />
          </div>

          {/* Description AI Improvement */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Description</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700">
              {tactic.description || 'Not defined'}
            </div>
            <FieldAIActions
              fieldKey={makeFieldKey('description')}
              currentValue={tactic.description || null}
              scope="tactic"
              companyId={companyId}
              strategyId={strategyId}
              contextPayload={contextPayload as Parameters<typeof FieldAIActions>[0]['contextPayload']}
              draft={drafts.description}
              onDraftReceived={onDraftReceived}
              onApply={(value) => onApplyDraft(makeFieldKey('description'), value)}
              onDiscard={() => onDiscardDraft(makeFieldKey('description'))}
              disabled={tactic.isLocked}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Priority Group Component
// ============================================================================

interface PriorityGroupProps {
  priority: StrategyPriorityV6;
  tactics: StrategyTacticV6[];
  allTactics: StrategyTacticV6[]; // For computing global tactic index
  objectives: StrategyObjectiveV6[];
  onUpdateTactic: (tactic: StrategyTacticV6) => void;
  onRemoveTactic: (id: string) => void;
  onLockTactic: (id: string) => void;
  onUnlockTactic: (id: string) => void;
  onPromoteTactic?: (tacticId: string) => void;
  onAddTactic: (priorityId: string) => void;
  // AI Field Improvement props
  companyId?: string;
  strategyId?: string;
  fieldDrafts?: Record<string, FieldDraft>;
  onDraftReceived?: (draft: FieldDraft) => void;
  onApplyDraft?: (fieldKey: string, value: string) => void;
  onDiscardDraft?: (fieldKey: string) => void;
  contextPayload?: unknown;
}

function PriorityGroup({
  priority,
  tactics,
  allTactics,
  objectives,
  onUpdateTactic,
  onRemoveTactic,
  onLockTactic,
  onUnlockTactic,
  onPromoteTactic,
  onAddTactic,
  companyId,
  strategyId,
  fieldDrafts = {},
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
}: PriorityGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Helper to get global tactic index
  const getTacticIndex = (tacticId: string) => allTactics.findIndex(t => t.id === tacticId);

  return (
    <div className="mb-4">
      {/* Priority Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-2 bg-slate-800/80 rounded-lg mb-2 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">{priority.title}</span>
          <span className="text-xs text-slate-400">({tactics.length})</span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Tactics */}
      {!collapsed && (
        <div className="space-y-2 pl-2">
          {tactics.map(tactic => {
            const tacticIndex = getTacticIndex(tactic.id);
            return (
              <TacticItem
                key={tactic.id}
                tactic={tactic}
                tacticIndex={tacticIndex}
                objectives={objectives}
                onUpdate={onUpdateTactic}
                onRemove={() => onRemoveTactic(tactic.id)}
                onLock={() => onLockTactic(tactic.id)}
                onUnlock={() => onUnlockTactic(tactic.id)}
                onPromote={onPromoteTactic ? () => onPromoteTactic(tactic.id) : undefined}
                companyId={companyId}
                strategyId={strategyId}
                drafts={{
                  title: fieldDrafts[`tactic.${tacticIndex}.title`],
                  description: fieldDrafts[`tactic.${tacticIndex}.description`],
                }}
                onDraftReceived={onDraftReceived}
                onApplyDraft={onApplyDraft}
                onDiscardDraft={onDiscardDraft}
                contextPayload={contextPayload}
              />
            );
          })}

          {/* Add Tactic to Priority */}
          <button
            onClick={() => onAddTactic(priority.id)}
            className="w-full flex items-center justify-center gap-2 p-2 border border-dashed border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white hover:border-emerald-500/50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Tactic
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function TacticsPanel({
  tactics,
  priorities,
  objectives,
  onUpdateTactic,
  onAddTactic,
  onRemoveTactic,
  onLockTactic,
  onUnlockTactic,
  onPromoteTactic,
  onAiProposeTactics,
  onAiReviewFit,
  onAiSuggestStrategyUpdates,
  aiLoading = false,
  className = '',
  // AI Field Improvement props
  companyId,
  strategyId,
  fieldDrafts = {},
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
}: TacticsPanelProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Group tactics by priority
  const tacticsByPriority = useMemo(() => {
    const grouped: Record<string, StrategyTacticV6[]> = {};

    // Initialize all priorities
    for (const p of priorities) {
      grouped[p.id] = [];
    }

    // Group tactics
    for (const t of tactics) {
      const priorityId = t.priorityIds?.[0] || 'unassigned';
      if (!grouped[priorityId]) {
        grouped[priorityId] = [];
      }
      grouped[priorityId].push(t);
    }

    return grouped;
  }, [tactics, priorities]);

  // Unassigned tactics
  const unassignedTactics = tacticsByPriority['unassigned'] || [];

  const handleStartAdd = useCallback((priorityId: string) => {
    setAddingTo(priorityId);
    setNewTitle('');
  }, []);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim() || !addingTo) return;

    const newTactic: StrategyTacticV6 = {
      id: generatePlayId(),
      title: newTitle.trim(),
      objectiveIds: [],
      priorityIds: [addingTo],
      expectedImpact: 'medium',
      effortSize: 'm',
      status: 'proposed',
    };

    onAddTactic(newTactic);
    setNewTitle('');
    setAddingTo(null);
  }, [newTitle, addingTo, onAddTactic]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 rounded">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">Tactics</h2>
          <span className="text-xs text-slate-400">({tactics.length})</span>
        </div>

        {/* AI Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAiProposeTactics}
            disabled={aiLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
            title="AI Propose Tactics"
          >
            <Sparkles className="w-3 h-3" />
            Propose
          </button>
          <button
            onClick={onAiReviewFit}
            disabled={aiLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
            title="AI Review Tactic Fit"
          >
            Review
          </button>
        </div>
      </div>

      {/* Tactics by Priority */}
      <div className="flex-1 overflow-y-auto">
        {priorities.map(priority => (
          <PriorityGroup
            key={priority.id}
            priority={priority}
            tactics={tacticsByPriority[priority.id] || []}
            allTactics={tactics}
            objectives={objectives}
            onUpdateTactic={onUpdateTactic}
            onRemoveTactic={onRemoveTactic}
            onLockTactic={onLockTactic}
            onUnlockTactic={onUnlockTactic}
            onAddTactic={handleStartAdd}
            onPromoteTactic={onPromoteTactic}
            companyId={companyId}
            strategyId={strategyId}
            fieldDrafts={fieldDrafts}
            onDraftReceived={onDraftReceived}
            onApplyDraft={onApplyDraft}
            onDiscardDraft={onDiscardDraft}
            contextPayload={contextPayload}
          />
        ))}

        {/* Unassigned Tactics */}
        {unassignedTactics.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg mb-2">
              <span className="text-sm font-medium text-slate-400">Unassigned</span>
              <span className="text-xs text-slate-500">({unassignedTactics.length})</span>
            </div>
            <div className="space-y-2 pl-2">
              {unassignedTactics.map(tactic => {
                const tacticIndex = tactics.findIndex(t => t.id === tactic.id);
                return (
                  <TacticItem
                    key={tactic.id}
                    tactic={tactic}
                    tacticIndex={tacticIndex}
                    objectives={objectives}
                    onUpdate={onUpdateTactic}
                    onRemove={() => onRemoveTactic(tactic.id)}
                    onLock={() => onLockTactic(tactic.id)}
                    onUnlock={() => onUnlockTactic(tactic.id)}
                    onPromote={onPromoteTactic ? () => onPromoteTactic(tactic.id) : undefined}
                    companyId={companyId}
                    strategyId={strategyId}
                    drafts={{
                      title: fieldDrafts[`tactic.${tacticIndex}.title`],
                      description: fieldDrafts[`tactic.${tacticIndex}.description`],
                    }}
                    onDraftReceived={onDraftReceived}
                    onApplyDraft={onApplyDraft}
                    onDiscardDraft={onDiscardDraft}
                    contextPayload={contextPayload}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Add New Modal */}
        {addingTo && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-full max-w-md mx-4">
              <h3 className="text-sm font-semibold text-white mb-3">Add Tactic</h3>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none mb-3"
                placeholder="Tactic title"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setAddingTo(null);
                    setNewTitle('');
                  }}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim()}
                  className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {tactics.length === 0 && priorities.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-slate-800/50 rounded-full mb-3">
            <Zap className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400 mb-2">No tactics yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Define strategic priorities first, then add tactics
          </p>
        </div>
      )}

      {/* AI Suggest Strategy Updates Button */}
      {tactics.length > 0 && (
        <div className="pt-3 border-t border-slate-700">
          <button
            onClick={onAiSuggestStrategyUpdates}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 p-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            AI: Suggest Strategy Updates
          </button>
        </div>
      )}
    </div>
  );
}

export default TacticsPanel;
