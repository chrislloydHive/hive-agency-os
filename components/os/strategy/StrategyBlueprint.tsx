'use client';

// components/os/strategy/StrategyBlueprint.tsx
// Strategy Blueprint - The complete strategy at a glance
//
// Structured view of the complete strategy:
// A. Strategy Frame - Audience/ICP, Positioning, Constraints, Inputs completeness
// B. Objectives (editable)
// C. Pillars/Priorities (editable)
// D. Tactical Plays (editable, with work generation)

import { useState, useCallback, useMemo } from 'react';
import {
  Target,
  Users,
  Compass,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit3,
  CheckCircle,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import type {
  CompanyStrategy,
  StrategyPillar,
  StrategyObjective,
  StrategyPlay,
} from '@/lib/types/strategy';
import { normalizeObjectives, getObjectiveText, hasEvaluationContent } from '@/lib/types/strategy';
import type { StrategyRisk, StrategyEvaluation } from '@/lib/types/strategy';
import type { StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import {
  computeStrategyReadiness,
  type StrategyReadiness,
} from '@/lib/os/strategy/strategyInputsHelpers';
import { ObjectivesEditor } from './ObjectivesEditor';
import { PlaysEditor } from './PlaysEditor';
import { EvaluationEditor, EvaluationSummary } from '@/components/strategy/EvaluationEditor';

// ============================================================================
// Types
// ============================================================================

interface StrategyBlueprintProps {
  companyId: string;
  strategy: CompanyStrategy;
  strategyInputs: StrategyInputs;
  onUpdateStrategy: (updates: Partial<CompanyStrategy>) => Promise<void>;
  onGenerateWork?: (playIds: string[]) => Promise<void>;
  isFinalized?: boolean;
}

// ============================================================================
// Strategy Frame Component
// ============================================================================

interface StrategyFrameProps {
  strategyInputs: StrategyInputs;
  readiness: StrategyReadiness;
  companyId: string;
}

function StrategyFrame({ strategyInputs, readiness, companyId }: StrategyFrameProps) {
  const [expanded, setExpanded] = useState(true);

  // Extract key frame elements from StrategyInputs
  const audience = strategyInputs.businessReality?.icpDescription || null;
  const positioning = strategyInputs.businessReality?.valueProposition || null;
  const constraints = strategyInputs.constraints?.legalRestrictions || null;

  // Completeness indicator
  const completenessColor =
    readiness.completenessPercent >= 80
      ? 'text-emerald-400'
      : readiness.completenessPercent >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  const completenessLabel =
    readiness.completenessPercent >= 80
      ? 'Strong'
      : readiness.completenessPercent >= 50
      ? 'Partial'
      : 'Needs Work';

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <Compass className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Strategy Frame</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${completenessColor}`}>
            {readiness.completenessPercent}% {completenessLabel}
          </span>
          <Link
            href={`/c/${companyId}/context`}
            className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Edit Context
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Audience/ICP */}
          <div className="flex items-start gap-3">
            <Users className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1">Target Audience</p>
              {audience ? (
                <p className="text-sm text-slate-200">{audience}</p>
              ) : (
                <p className="text-sm text-slate-500 italic">Not defined</p>
              )}
            </div>
          </div>

          {/* Positioning */}
          <div className="flex items-start gap-3">
            <Target className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1">Unique Positioning</p>
              {positioning ? (
                <p className="text-sm text-slate-200">{positioning}</p>
              ) : (
                <p className="text-sm text-slate-500 italic">Not defined</p>
              )}
            </div>
          </div>

          {/* Constraints */}
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1">Key Constraints</p>
              {constraints ? (
                <p className="text-sm text-slate-200">{constraints}</p>
              ) : (
                <p className="text-sm text-slate-500 italic">Not defined</p>
              )}
            </div>
          </div>

          {/* Missing inputs warning */}
          {readiness.missingCritical.length > 0 && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-300">
                Missing inputs: {readiness.missingCritical.slice(0, 3).map(c => c.label).join(', ')}
                {readiness.missingCritical.length > 3 &&
                  ` (+${readiness.missingCritical.length - 3} more)`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pillars Editor Component
// ============================================================================

interface PillarsEditorProps {
  pillars: StrategyPillar[];
  onUpdate: (pillars: StrategyPillar[]) => Promise<void>;
  isFinalized?: boolean;
  maxVisible?: number;
}

interface PillarEditForm {
  title: string;
  description?: string;
  rationale?: string;
  pros?: string[];
  cons?: string[];
  tradeoffs?: string[];
  risks?: StrategyRisk[];
  assumptions?: string[];
}

function PillarsEditor({
  pillars,
  onUpdate,
  isFinalized = false,
  maxVisible = 3,
}: PillarsEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PillarEditForm>({ title: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [newPillar, setNewPillar] = useState<{ title: string; description?: string }>({
    title: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showEvaluation, setShowEvaluation] = useState<string | null>(null);

  const visiblePillars = expanded ? pillars : pillars.slice(0, maxVisible);
  const hasMore = pillars.length > maxVisible;

  // Priority options
  const priorityOptions: Array<'low' | 'medium' | 'high'> = ['high', 'medium', 'low'];
  const priorityColors = {
    high: 'text-red-400 bg-red-500/10 border-red-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  const handleStartEdit = useCallback((pillar: StrategyPillar) => {
    setEditingId(pillar.id);
    setEditForm({
      title: pillar.title,
      description: pillar.description,
      rationale: pillar.rationale,
      pros: pillar.pros || [],
      cons: pillar.cons || [],
      tradeoffs: pillar.tradeoffs || [],
      risks: pillar.risks || [],
      assumptions: pillar.assumptions || [],
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({ title: '' });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editForm.title?.trim()) return;

    setSaving(true);
    try {
      const updated = pillars.map((p) =>
        p.id === editingId
          ? {
              ...p,
              title: editForm.title.trim(),
              description: editForm.description?.trim() || '',
              rationale: editForm.rationale?.trim(),
              pros: editForm.pros,
              cons: editForm.cons,
              tradeoffs: editForm.tradeoffs,
              risks: editForm.risks,
              assumptions: editForm.assumptions,
            }
          : p
      );
      await onUpdate(updated);
      setEditingId(null);
      setEditForm({ title: '' });
      setSavedId(editingId);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [editingId, editForm, pillars, onUpdate]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this priority?')) return;

      setSaving(true);
      try {
        const updated = pillars.filter((p) => p.id !== id);
        await onUpdate(updated);
      } finally {
        setSaving(false);
      }
    },
    [pillars, onUpdate]
  );

  const handleAddPillar = useCallback(async () => {
    if (!newPillar.title?.trim()) return;

    setSaving(true);
    try {
      const pillar: StrategyPillar = {
        id: `pillar-${Date.now()}`,
        title: newPillar.title.trim(),
        description: newPillar.description?.trim() || '',
        priority: 'medium',
        order: pillars.length,
      };
      await onUpdate([...pillars, pillar]);
      setNewPillar({ title: '' });
      setIsAdding(false);
      setSavedId(pillar.id);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [newPillar, pillars, onUpdate]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          Strategic Bets
          <span className="text-xs text-slate-500">({pillars.length})</span>
        </h3>
        {!isFinalized && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Pillars List */}
      {visiblePillars.length > 0 ? (
        <div className="space-y-2">
          {visiblePillars.map((pillar, idx) => (
            <div
              key={pillar.id}
              className={`bg-slate-800/50 rounded-lg px-3 py-2 ${
                savedId === pillar.id ? 'ring-1 ring-emerald-500/50' : ''
              }`}
            >
              {editingId === pillar.id ? (
                // Edit mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="Priority name..."
                    autoFocus
                  />
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <textarea
                    value={editForm.rationale || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, rationale: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    placeholder="Why this matters (rationale)"
                    rows={2}
                  />

                  {/* Evaluation Fields */}
                  <EvaluationEditor
                    evaluation={{
                      pros: editForm.pros || [],
                      cons: editForm.cons || [],
                      tradeoffs: editForm.tradeoffs || [],
                      risks: editForm.risks || [],
                      assumptions: editForm.assumptions || [],
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
                    <span className="w-5 h-5 flex items-center justify-center bg-purple-500/10 text-purple-400 rounded text-xs font-medium flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{pillar.title}</p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            priorityColors[pillar.priority]
                          }`}
                        >
                          {pillar.priority}
                        </span>
                        {hasEvaluationContent(pillar) && (
                          <button
                            onClick={() => setShowEvaluation(showEvaluation === pillar.id ? null : pillar.id)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300"
                          >
                            {showEvaluation === pillar.id ? 'Hide Analysis' : 'Show Analysis'}
                          </button>
                        )}
                      </div>
                      {pillar.description && (
                        <p className="text-xs text-slate-400 mt-1">{pillar.description}</p>
                      )}
                      {pillar.rationale && (
                        <p className="text-xs text-slate-500 mt-1 italic">Why: {pillar.rationale}</p>
                      )}
                    </div>
                    {!isFinalized && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(pillar)}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded"
                          title="Edit"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(pillar.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {savedId === pillar.id && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                        <CheckCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Evaluation Summary (expandable) */}
                  {showEvaluation === pillar.id && hasEvaluationContent(pillar) && (
                    <div className="ml-7 pt-2 border-t border-slate-700/50">
                      <EvaluationSummary
                        evaluation={{
                          pros: pillar.pros,
                          cons: pillar.cons,
                          tradeoffs: pillar.tradeoffs,
                          risks: pillar.risks,
                          assumptions: pillar.assumptions,
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
        <p className="text-xs text-slate-500 italic">No priorities defined yet.</p>
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
              Show {pillars.length - maxVisible} more
            </>
          )}
        </button>
      )}

      {/* Add New Pillar Form */}
      {isAdding && (
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 space-y-2 border border-purple-500/30">
          <input
            type="text"
            value={newPillar.title}
            onChange={(e) => setNewPillar({ ...newPillar, title: e.target.value })}
            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            placeholder="Priority name (e.g. 'Enterprise Sales Motion')"
            autoFocus
          />
          <textarea
            value={newPillar.description || ''}
            onChange={(e) => setNewPillar({ ...newPillar, description: e.target.value })}
            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            placeholder="Description (optional)"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddPillar}
              disabled={saving || !newPillar.title?.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add Priority
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewPillar({ title: '' });
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

// ============================================================================
// Main StrategyBlueprint Component
// ============================================================================

export function StrategyBlueprint({
  companyId,
  strategy,
  strategyInputs,
  onUpdateStrategy,
  onGenerateWork,
  isFinalized = false,
}: StrategyBlueprintProps) {
  // Compute readiness
  const readiness = useMemo(() => computeStrategyReadiness(strategyInputs), [strategyInputs]);

  // Normalize objectives
  const objectives = useMemo(() => normalizeObjectives(strategy.objectives), [strategy.objectives]);

  // Handler: Update objectives
  const handleUpdateObjectives = useCallback(
    async (newObjectives: StrategyObjective[]) => {
      await onUpdateStrategy({ objectives: newObjectives });
    },
    [onUpdateStrategy]
  );

  // Handler: Update pillars
  const handleUpdatePillars = useCallback(
    async (newPillars: StrategyPillar[]) => {
      await onUpdateStrategy({ pillars: newPillars });
    },
    [onUpdateStrategy]
  );

  // Handler: Update plays
  const handleUpdatePlays = useCallback(
    async (newPlays: StrategyPlay[]) => {
      await onUpdateStrategy({ plays: newPlays });
    },
    [onUpdateStrategy]
  );

  return (
    <div className="space-y-6">
      {/* Strategy Frame */}
      <StrategyFrame
        strategyInputs={strategyInputs}
        readiness={readiness}
        companyId={companyId}
      />

      {/* Objectives */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <ObjectivesEditor
          objectives={strategy.objectives}
          onUpdate={handleUpdateObjectives}
          isFinalized={isFinalized}
        />
      </div>

      {/* Pillars/Priorities */}
      <div id="strategy-priorities" className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 scroll-mt-20">
        <PillarsEditor
          pillars={strategy.pillars || []}
          onUpdate={handleUpdatePillars}
          isFinalized={isFinalized}
        />
      </div>

      {/* Tactical Plays */}
      <div id="strategy-plays" className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 scroll-mt-20">
        <PlaysEditor
          plays={strategy.plays || []}
          objectives={strategy.objectives}
          pillars={strategy.pillars || []}
          onUpdate={handleUpdatePlays}
          onGenerateWork={onGenerateWork}
          isFinalized={isFinalized}
        />
      </div>

      {/* Strategy → Work CTA */}
      {strategy.plays && strategy.plays.length > 0 && onGenerateWork && !isFinalized && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400" />
                Ready to Generate Work?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select plays above and click "Generate Work" to create tasks from your strategy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
