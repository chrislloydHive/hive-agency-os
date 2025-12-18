'use client';

// components/os/strategy/ObjectivesPanel.tsx
// Left panel for Objectives in the bidirectional strategy view
//
// Features:
// - Editable list with inline editing
// - Lock toggle per objective
// - Shows linked priorities + tactics
// - AI actions: Improve, Suggest Missing

import React, { useState, useCallback } from 'react';
import {
  Target,
  Lock,
  Unlock,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  GripVertical,
} from 'lucide-react';
import type {
  StrategyObjectiveV6,
  StrategyPriorityV6,
  StrategyTacticV6,
} from '@/lib/types/strategyBidirectional';
import { generateObjectiveId } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface ObjectivesPanelProps {
  objectives: StrategyObjectiveV6[];
  priorities: StrategyPriorityV6[];
  tactics: StrategyTacticV6[];
  onUpdateObjective: (objective: StrategyObjectiveV6) => void;
  onAddObjective: (objective: StrategyObjectiveV6) => void;
  onRemoveObjective: (id: string) => void;
  onLockObjective: (id: string) => void;
  onUnlockObjective: (id: string) => void;
  onAiImprove?: () => void;
  onAiSuggestMissing?: () => void;
  aiLoading?: boolean;
  className?: string;
}

// ============================================================================
// Objective Item Component
// ============================================================================

interface ObjectiveItemProps {
  objective: StrategyObjectiveV6;
  linkedPriorities: StrategyPriorityV6[];
  linkedTactics: StrategyTacticV6[];
  onUpdate: (objective: StrategyObjectiveV6) => void;
  onRemove: () => void;
  onLock: () => void;
  onUnlock: () => void;
}

function ObjectiveItem({
  objective,
  linkedPriorities,
  linkedTactics,
  onUpdate,
  onRemove,
  onLock,
  onUnlock,
}: ObjectiveItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editText, setEditText] = useState(objective.text);
  const [editMetric, setEditMetric] = useState(objective.metric || '');
  const [editTarget, setEditTarget] = useState(objective.target || '');

  const handleSave = useCallback(() => {
    onUpdate({
      ...objective,
      text: editText.trim(),
      metric: editMetric.trim() || undefined,
      target: editTarget.trim() || undefined,
    });
    setEditing(false);
  }, [objective, editText, editMetric, editTarget, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditText(objective.text);
    setEditMetric(objective.metric || '');
    setEditTarget(objective.target || '');
    setEditing(false);
  }, [objective]);

  const hasLinks = linkedPriorities.length > 0 || linkedTactics.length > 0;

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        ${objective.isLocked
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
              <label className="text-xs text-slate-400 mb-1 block">Objective</label>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
                rows={2}
                placeholder="What do you want to achieve?"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Metric</label>
                <input
                  type="text"
                  value={editMetric}
                  onChange={e => setEditMetric(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g. Trials/week"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Target</label>
                <input
                  type="text"
                  value={editTarget}
                  onChange={e => setEditTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g. +25%"
                />
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
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
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
                  <p className="text-sm text-white">{objective.text}</p>
                  {(objective.metric || objective.target) && (
                    <div className="flex items-center gap-2 mt-1">
                      {objective.metric && (
                        <span className="text-xs text-slate-400">
                          {objective.metric}
                        </span>
                      )}
                      {objective.target && (
                        <span className="text-xs text-emerald-400 font-medium">
                          {objective.target}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {objective.isLocked ? (
                    <button
                      onClick={onUnlock}
                      className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                      title="Unlock objective"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
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
                        title="Lock objective"
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

              {/* Linkage Summary */}
              {hasLinks && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-2 mt-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {linkedPriorities.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-blue-400" />
                      {linkedPriorities.length}
                    </span>
                  )}
                  {linkedTactics.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      {linkedTactics.length}
                    </span>
                  )}
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
      {expanded && hasLinks && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-700/50">
          {linkedPriorities.length > 0 && (
            <div className="mt-2">
              <h5 className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Priorities
              </h5>
              <ul className="space-y-1">
                {linkedPriorities.map(p => (
                  <li key={p.id} className="text-xs text-slate-400 truncate">
                    {p.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {linkedTactics.length > 0 && (
            <div className="mt-2">
              <h5 className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Tactics
              </h5>
              <ul className="space-y-1">
                {linkedTactics.map(t => (
                  <li key={t.id} className="text-xs text-slate-400 truncate">
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function ObjectivesPanel({
  objectives,
  priorities,
  tactics,
  onUpdateObjective,
  onAddObjective,
  onRemoveObjective,
  onLockObjective,
  onUnlockObjective,
  onAiImprove,
  onAiSuggestMissing,
  aiLoading = false,
  className = '',
}: ObjectivesPanelProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [newText, setNewText] = useState('');

  // Find linked items for each objective
  const getLinkedPriorities = useCallback(
    (objectiveId: string) =>
      priorities.filter(p => p.objectiveIds?.includes(objectiveId)),
    [priorities]
  );

  const getLinkedTactics = useCallback(
    (objectiveId: string) =>
      tactics.filter(t => t.objectiveIds?.includes(objectiveId)),
    [tactics]
  );

  const handleAddNew = useCallback(() => {
    if (!newText.trim()) return;

    const newObjective: StrategyObjectiveV6 = {
      id: generateObjectiveId(),
      text: newText.trim(),
      status: 'draft',
    };

    onAddObjective(newObjective);
    setNewText('');
    setAddingNew(false);
  }, [newText, onAddObjective]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-500/10 rounded">
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">Objectives</h2>
          <span className="text-xs text-slate-400">({objectives.length})</span>
        </div>

        {/* AI Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAiImprove}
            disabled={aiLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
            title="AI Improve Objectives"
          >
            <Sparkles className="w-3 h-3" />
            Improve
          </button>
          <button
            onClick={onAiSuggestMissing}
            disabled={aiLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
            title="AI Suggest Missing Objectives"
          >
            <Plus className="w-3 h-3" />
            Suggest
          </button>
        </div>
      </div>

      {/* Objectives List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {objectives.map(objective => (
          <ObjectiveItem
            key={objective.id}
            objective={objective}
            linkedPriorities={getLinkedPriorities(objective.id)}
            linkedTactics={getLinkedTactics(objective.id)}
            onUpdate={onUpdateObjective}
            onRemove={() => onRemoveObjective(objective.id)}
            onLock={() => onLockObjective(objective.id)}
            onUnlock={() => onUnlockObjective(objective.id)}
          />
        ))}

        {/* Add New Form */}
        {addingNew ? (
          <div className="border border-dashed border-purple-500/30 rounded-lg p-3">
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
              rows={2}
              placeholder="What do you want to achieve?"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setAddingNew(false);
                  setNewText('');
                }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNew}
                disabled={!newText.trim()}
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white hover:border-purple-500/50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Objective
          </button>
        )}
      </div>

      {/* Empty State */}
      {objectives.length === 0 && !addingNew && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-slate-800/50 rounded-full mb-3">
            <Target className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400 mb-2">No objectives defined</p>
          <p className="text-xs text-slate-500 mb-4">
            Define what matters before building strategy
          </p>
          <button
            onClick={() => setAddingNew(true)}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
          >
            Add First Objective
          </button>
        </div>
      )}
    </div>
  );
}

export default ObjectivesPanel;
