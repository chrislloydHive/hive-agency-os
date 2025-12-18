'use client';

// components/os/strategy/ObjectivesEditor.tsx
// Inline editor for Strategy Objectives
//
// Objectives are structured goals with optional metrics, targets, and timeframes.
// Lives on Strategy (not Context) - these are strategic commitments.

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { StrategyObjective } from '@/lib/types/strategy';
import { generateObjectiveId, normalizeObjectives } from '@/lib/types/strategy';

interface ObjectivesEditorProps {
  objectives: string[] | StrategyObjective[];
  onUpdate: (objectives: StrategyObjective[]) => Promise<void>;
  isFinalized?: boolean;
  maxVisible?: number;
}

export function ObjectivesEditor({
  objectives,
  onUpdate,
  isFinalized = false,
  maxVisible = 3,
}: ObjectivesEditorProps) {
  // Normalize objectives to structured format
  const normalizedObjectives = normalizeObjectives(objectives);

  // State
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StrategyObjective>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newObjective, setNewObjective] = useState<Partial<StrategyObjective>>({});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Visible objectives (unless expanded)
  const visibleObjectives = expanded
    ? normalizedObjectives
    : normalizedObjectives.slice(0, maxVisible);
  const hasMore = normalizedObjectives.length > maxVisible;

  // Start editing an objective
  const handleStartEdit = useCallback((objective: StrategyObjective) => {
    setEditingId(objective.id);
    setEditForm({ ...objective });
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  // Save edited objective
  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editForm.text?.trim()) return;

    setSaving(true);
    try {
      const updated = normalizedObjectives.map((obj) =>
        obj.id === editingId
          ? { ...obj, ...editForm, text: editForm.text!.trim() }
          : obj
      );
      await onUpdate(updated);
      setEditingId(null);
      setEditForm({});
      setSavedId(editingId);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [editingId, editForm, normalizedObjectives, onUpdate]);

  // Delete an objective
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this objective?')) return;

      setSaving(true);
      try {
        const updated = normalizedObjectives.filter((obj) => obj.id !== id);
        await onUpdate(updated);
      } finally {
        setSaving(false);
      }
    },
    [normalizedObjectives, onUpdate]
  );

  // Add new objective
  const handleAddObjective = useCallback(async () => {
    if (!newObjective.text?.trim()) return;

    setSaving(true);
    try {
      const objective: StrategyObjective = {
        id: generateObjectiveId(),
        text: newObjective.text.trim(),
        metric: newObjective.metric?.trim() || undefined,
        target: newObjective.target?.trim() || undefined,
        timeframe: newObjective.timeframe?.trim() || undefined,
      };
      await onUpdate([...normalizedObjectives, objective]);
      setNewObjective({});
      setIsAdding(false);
      setSavedId(objective.id);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [newObjective, normalizedObjectives, onUpdate]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          Objectives
          <span className="text-xs text-slate-500">
            ({normalizedObjectives.length})
          </span>
        </h3>
        {!isFinalized && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Objectives List */}
      {visibleObjectives.length > 0 ? (
        <div className="space-y-2">
          {visibleObjectives.map((objective, idx) => (
            <div
              key={objective.id}
              className={`bg-slate-800/50 rounded-lg px-3 py-2 ${
                savedId === objective.id ? 'ring-1 ring-emerald-500/50' : ''
              }`}
            >
              {editingId === objective.id ? (
                // Edit mode
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editForm.text || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, text: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="Objective..."
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editForm.metric || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, metric: e.target.value })
                      }
                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      placeholder="Metric (e.g. Trials/week)"
                    />
                    <input
                      type="text"
                      value={editForm.target || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, target: e.target.value })
                      }
                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      placeholder="Target (e.g. +25%)"
                    />
                    <input
                      type="text"
                      value={editForm.timeframe || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, timeframe: e.target.value })
                      }
                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      placeholder="Timeframe (e.g. 90 days)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving || !editForm.text?.trim()}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded text-xs font-medium flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{objective.text}</p>
                    {(objective.metric || objective.target || objective.timeframe) && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {objective.metric && (
                          <span className="text-xs text-slate-500">
                            {objective.metric}
                          </span>
                        )}
                        {objective.target && (
                          <span className="text-xs text-emerald-400 font-medium">
                            {objective.target}
                          </span>
                        )}
                        {objective.timeframe && (
                          <span className="text-xs text-slate-500">
                            ({objective.timeframe})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!isFinalized && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(objective)}
                        className="p-1 text-slate-500 hover:text-slate-300 rounded"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(objective.id)}
                        className="p-1 text-slate-500 hover:text-red-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {savedId === objective.id && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                      <CheckCircle className="w-3 h-3" />
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No objectives defined yet.
        </p>
      )}

      {/* Show More/Less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              Show {normalizedObjectives.length - maxVisible} more
            </>
          )}
        </button>
      )}

      {/* Add New Objective Form */}
      {isAdding && (
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 space-y-2 border border-cyan-500/30">
          <input
            type="text"
            value={newObjective.text || ''}
            onChange={(e) =>
              setNewObjective({ ...newObjective, text: e.target.value })
            }
            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="What do you want to achieve?"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newObjective.metric || ''}
              onChange={(e) =>
                setNewObjective({ ...newObjective, metric: e.target.value })
              }
              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Metric (optional)"
            />
            <input
              type="text"
              value={newObjective.target || ''}
              onChange={(e) =>
                setNewObjective({ ...newObjective, target: e.target.value })
              }
              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Target (optional)"
            />
            <input
              type="text"
              value={newObjective.timeframe || ''}
              onChange={(e) =>
                setNewObjective({ ...newObjective, timeframe: e.target.value })
              }
              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Timeframe (optional)"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddObjective}
              disabled={saving || !newObjective.text?.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add Objective
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewObjective({});
              }}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
