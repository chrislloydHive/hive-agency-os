'use client';

// components/os/strategy/PlaysEditor.tsx
// Inline editor for Strategy Plays (Tactical Initiatives)
//
// Plays are the bridge between strategy and work.
// Each play connects to an objective and pillar, and generates work items.

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import type {
  StrategyPlay,
  StrategyPlayStatus,
  StrategyObjective,
  StrategyPillar,
} from '@/lib/types/strategy';
import {
  generatePlayId,
  normalizeObjectives,
  PLAY_STATUS_LABELS,
  PLAY_STATUS_COLORS,
  hasEvaluationContent,
} from '@/lib/types/strategy';
import { EvaluationEditor, EvaluationSummary } from '@/components/strategy/EvaluationEditor';

interface PlaysEditorProps {
  plays: StrategyPlay[];
  objectives: string[] | StrategyObjective[];
  pillars: StrategyPillar[];
  workCounts?: Record<string, number>;
  onUpdate: (plays: StrategyPlay[]) => Promise<void>;
  onGenerateWork?: (playIds: string[]) => Promise<void>;
  isFinalized?: boolean;
}

export function PlaysEditor({
  plays,
  objectives,
  pillars,
  workCounts = {},
  onUpdate,
  onGenerateWork,
  isFinalized = false,
}: PlaysEditorProps) {
  // Normalize objectives for dropdown
  const normalizedObjectives = normalizeObjectives(objectives);

  // State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StrategyPlay>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newPlay, setNewPlay] = useState<Partial<StrategyPlay>>({
    status: 'proposed',
  });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selectedForWork, setSelectedForWork] = useState<Set<string>>(new Set());
  const [generatingWork, setGeneratingWork] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showEvaluation, setShowEvaluation] = useState<string | null>(null);

  // Status options
  const statusOptions: StrategyPlayStatus[] = ['proposed', 'active', 'paused', 'proven'];

  // Start editing a play
  const handleStartEdit = useCallback((play: StrategyPlay) => {
    setEditingId(play.id);
    setEditForm({ ...play });
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  // Save edited play
  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editForm.title?.trim()) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updated = plays.map((play) =>
        play.id === editingId
          ? {
              ...play,
              ...editForm,
              title: editForm.title!.trim(),
              description: editForm.description?.trim(),
              updatedAt: now,
            }
          : play
      );
      await onUpdate(updated);
      setEditingId(null);
      setEditForm({});
      setSavedId(editingId);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [editingId, editForm, plays, onUpdate]);

  // Delete a play
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this play?')) return;

      setSaving(true);
      try {
        const updated = plays.filter((play) => play.id !== id);
        await onUpdate(updated);
        setSelectedForWork((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } finally {
        setSaving(false);
      }
    },
    [plays, onUpdate]
  );

  // Add new play
  const handleAddPlay = useCallback(async () => {
    if (!newPlay.title?.trim()) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const play: StrategyPlay = {
        id: generatePlayId(),
        title: newPlay.title.trim(),
        description: newPlay.description?.trim(),
        objectiveId: newPlay.objectiveId,
        pillarTitle: newPlay.pillarTitle,
        successMetric: newPlay.successMetric?.trim(),
        timeframe: newPlay.timeframe?.trim(),
        status: newPlay.status || 'proposed',
        createdAt: now,
        updatedAt: now,
      };
      await onUpdate([...plays, play]);
      setNewPlay({ status: 'proposed' });
      setIsAdding(false);
      setSavedId(play.id);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [newPlay, plays, onUpdate]);

  // Toggle selection for work generation
  const toggleSelection = useCallback((playId: string) => {
    setSelectedForWork((prev) => {
      const next = new Set(prev);
      if (next.has(playId)) {
        next.delete(playId);
      } else {
        next.add(playId);
      }
      return next;
    });
  }, []);

  // Generate work from selected plays
  const handleGenerateWork = useCallback(async () => {
    if (selectedForWork.size === 0 || !onGenerateWork) return;

    setGeneratingWork(true);
    try {
      await onGenerateWork(Array.from(selectedForWork));
      setSelectedForWork(new Set());
    } finally {
      setGeneratingWork(false);
    }
  }, [selectedForWork, onGenerateWork]);

  // Get objective text by ID
  const getObjectiveText = (objectiveId?: string) => {
    if (!objectiveId) return null;
    const objective = normalizedObjectives.find((o) => o.id === objectiveId);
    return objective?.text;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-medium text-white flex items-center gap-2 hover:text-slate-200"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-400" />
          )}
          <Play className="w-4 h-4 text-amber-400" />
          Tactical Plays
          <span className="text-xs text-slate-500">({plays.length})</span>
        </button>
        <div className="flex items-center gap-2">
          {selectedForWork.size > 0 && onGenerateWork && (
            <button
              onClick={handleGenerateWork}
              disabled={generatingWork}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50"
            >
              {generatingWork ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              Generate Work ({selectedForWork.size})
            </button>
          )}
          {!isFinalized && !isAdding && expanded && (
            <button
              onClick={() => setIsAdding(true)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Play
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {/* Plays List */}
          {plays.length > 0 ? (
            <div className="space-y-2">
              {plays.map((play) => (
                <div
                  key={play.id}
                  className={`bg-slate-800/50 rounded-lg px-3 py-2 ${
                    savedId === play.id ? 'ring-1 ring-emerald-500/50' : ''
                  } ${selectedForWork.has(play.id) ? 'ring-1 ring-amber-500/50' : ''}`}
                >
                  {editingId === play.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, title: e.target.value })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="Play title..."
                        autoFocus
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                        placeholder="Description (optional)"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editForm.objectiveId || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, objectiveId: e.target.value || undefined })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          <option value="">Link to objective...</option>
                          {normalizedObjectives.map((obj) => (
                            <option key={obj.id} value={obj.id}>
                              {obj.text.substring(0, 50)}
                              {obj.text.length > 50 ? '...' : ''}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editForm.pillarTitle || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, pillarTitle: e.target.value || undefined })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          <option value="">Link to pillar...</option>
                          {pillars.map((pillar) => (
                            <option key={pillar.id} value={pillar.title}>
                              {pillar.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editForm.successMetric || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, successMetric: e.target.value })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Success metric"
                        />
                        <input
                          type="text"
                          value={editForm.timeframe || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, timeframe: e.target.value })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Timeframe"
                        />
                        <select
                          value={editForm.status || 'proposed'}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              status: e.target.value as StrategyPlayStatus,
                            })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {PLAY_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Evaluation Fields */}
                      <EvaluationEditor
                        evaluation={{
                          pros: editForm.pros || [],
                          cons: editForm.cons || [],
                          tradeoffs: editForm.tradeoffs || [],
                          risks: editForm.risks || [],
                          assumptions: editForm.assumptions || [],
                          dependencies: editForm.dependencies || [],
                        }}
                        onChange={(updated) => setEditForm({ ...editForm, ...updated })}
                      />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving || !editForm.title?.trim()}
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
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        {/* Selection checkbox for work generation */}
                        {onGenerateWork && !isFinalized && (
                          <input
                            type="checkbox"
                            checked={selectedForWork.has(play.id)}
                            onChange={() => toggleSelection(play.id)}
                            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/50"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-200">
                              {play.title}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                PLAY_STATUS_COLORS[play.status]
                              }`}
                            >
                              {PLAY_STATUS_LABELS[play.status]}
                            </span>
                            {workCounts[play.id] !== undefined && workCounts[play.id] > 0 && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                <Briefcase className="w-3 h-3" />
                                {workCounts[play.id]} tasks
                              </span>
                            )}
                            {hasEvaluationContent(play) && (
                              <button
                                onClick={() => setShowEvaluation(showEvaluation === play.id ? null : play.id)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300"
                              >
                                {showEvaluation === play.id ? 'Hide Analysis' : 'Show Analysis'}
                              </button>
                            )}
                          </div>
                          {play.description && (
                            <p className="text-xs text-slate-400 mt-1">
                              {play.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {play.objectiveId && getObjectiveText(play.objectiveId) && (
                              <span className="text-[10px] text-cyan-400">
                                Obj: {getObjectiveText(play.objectiveId)?.substring(0, 30)}...
                              </span>
                            )}
                            {play.pillarTitle && (
                              <span className="text-[10px] text-purple-400">
                                Pillar: {play.pillarTitle}
                              </span>
                            )}
                            {play.successMetric && (
                              <span className="text-[10px] text-emerald-400">
                                {play.successMetric}
                              </span>
                            )}
                            {play.timeframe && (
                              <span className="text-[10px] text-slate-500">
                                ({play.timeframe})
                              </span>
                            )}
                          </div>
                        </div>
                        {!isFinalized && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleStartEdit(play)}
                              className="p-1 text-slate-500 hover:text-slate-300 rounded"
                              title="Edit"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(play.id)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {savedId === play.id && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                            <CheckCircle className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* Evaluation Summary (expandable) */}
                      {showEvaluation === play.id && hasEvaluationContent(play) && (
                        <div className="ml-6 pt-2 border-t border-slate-700/50">
                          <EvaluationSummary
                            evaluation={{
                              pros: play.pros,
                              cons: play.cons,
                              tradeoffs: play.tradeoffs,
                              risks: play.risks,
                              assumptions: play.assumptions,
                              dependencies: play.dependencies,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No tactical plays defined yet. Add plays to bridge strategy to work.
            </p>
          )}

          {/* Add New Play Form */}
          {isAdding && (
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 space-y-2 border border-amber-500/30">
              <input
                type="text"
                value={newPlay.title || ''}
                onChange={(e) =>
                  setNewPlay({ ...newPlay, title: e.target.value })
                }
                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Play title (e.g. 'Launch email nurture sequence')"
                autoFocus
              />
              <textarea
                value={newPlay.description || ''}
                onChange={(e) =>
                  setNewPlay({ ...newPlay, description: e.target.value })
                }
                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                placeholder="Description (optional)"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newPlay.objectiveId || ''}
                  onChange={(e) =>
                    setNewPlay({ ...newPlay, objectiveId: e.target.value || undefined })
                  }
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Link to objective (optional)</option>
                  {normalizedObjectives.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.text.substring(0, 50)}
                      {obj.text.length > 50 ? '...' : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={newPlay.pillarTitle || ''}
                  onChange={(e) =>
                    setNewPlay({ ...newPlay, pillarTitle: e.target.value || undefined })
                  }
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Link to pillar (optional)</option>
                  {pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.title}>
                      {pillar.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newPlay.successMetric || ''}
                  onChange={(e) =>
                    setNewPlay({ ...newPlay, successMetric: e.target.value })
                  }
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Success metric (optional)"
                />
                <input
                  type="text"
                  value={newPlay.timeframe || ''}
                  onChange={(e) =>
                    setNewPlay({ ...newPlay, timeframe: e.target.value })
                  }
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Timeframe (optional)"
                />
                <select
                  value={newPlay.status || 'proposed'}
                  onChange={(e) =>
                    setNewPlay({
                      ...newPlay,
                      status: e.target.value as StrategyPlayStatus,
                    })
                  }
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {PLAY_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddPlay}
                  disabled={saving || !newPlay.title?.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Add Play
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewPlay({ status: 'proposed' });
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
