'use client';

// components/os/strategy/StrategyCommandCenter.tsx
// Strategy Command Center - 3-Column Workflow UI
//
// Layout:
// - Left: Inputs (Objectives, Strategy Frame, Inputs Completeness)
// - Center: Strategy Blueprint (Summary, Priorities with Why/Tradeoff/Risks, Tradeoffs)
// - Right: Tactics (Tactical Plays derived from Objectives + Strategy)
//
// Features:
// - Progress Strip at top
// - Lock/Unlock workflow
// - AI-led suggestions
// - Responsive stacking for mobile

import { useState, useCallback, useMemo } from 'react';
import {
  Target,
  Compass,
  Zap,
  Lock,
  Unlock,
  Sparkles,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  Users,
  Shield,
  TrendingUp,
  Filter,
  Search,
  ExternalLink,
  Play,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type {
  CompanyStrategy,
  StrategyObjective,
  StrategyPlay,
  StrategyPillar,
  StrategyFrame,
  StrategyTradeoffs,
  StrategyLockState,
  TacticChannel,
  ImpactLevel,
  EffortLevel,
} from '@/lib/types/strategy';
import {
  normalizeObjectives,
  getObjectiveText,
  generateObjectiveId,
  generatePlayId,
  TACTIC_CHANNEL_LABELS,
  TACTIC_CHANNEL_COLORS,
  PLAY_STATUS_LABELS,
  PLAY_STATUS_COLORS,
} from '@/lib/types/strategy';
import type { StrategyInputs, StrategyReadiness } from '@/lib/os/strategy/strategyInputsHelpers';
import { computeStrategyReadiness } from '@/lib/os/strategy/strategyInputsHelpers';

// ============================================================================
// Types
// ============================================================================

interface StrategyCommandCenterProps {
  companyId: string;
  strategy: CompanyStrategy | null;
  strategyInputs: StrategyInputs;
  onUpdateStrategy: (updates: Partial<CompanyStrategy>) => Promise<void>;
  onGenerateTactics?: () => Promise<void>;
  onGenerateWork?: (playIds: string[]) => Promise<void>;
}

// ============================================================================
// Progress Strip Component
// ============================================================================

interface ProgressStripProps {
  readiness: StrategyReadiness;
  lockState: StrategyLockState;
  onToggleLock: () => void;
  aiSuggestionCount: number;
  isLocked: boolean;
  hasStrategy: boolean;
  onGenerateTactics?: () => void;
  onGenerateWork?: () => void;
  generating: boolean;
}

function ProgressStrip({
  readiness,
  lockState,
  onToggleLock,
  aiSuggestionCount,
  isLocked,
  hasStrategy,
  onGenerateTactics,
  onGenerateWork,
  generating,
}: ProgressStripProps) {
  const completenessColor =
    readiness.completenessPercent >= 80
      ? 'text-emerald-400'
      : readiness.completenessPercent >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-3 sticky top-0 z-20">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Inputs Completeness */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  readiness.completenessPercent >= 80
                    ? 'bg-emerald-500'
                    : readiness.completenessPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${readiness.completenessPercent}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${completenessColor}`}>
              {readiness.completenessPercent}% Ready
            </span>
          </div>
        </div>

        {/* Center: Lock State */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLock}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isLocked
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                Locked
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                Draft
              </>
            )}
          </button>
        </div>

        {/* Right: AI Suggestions + Primary CTA */}
        <div className="flex items-center gap-3">
          {aiSuggestionCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 text-sm rounded-lg border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              {aiSuggestionCount} suggestions
            </div>
          )}

          {isLocked ? (
            <button
              onClick={onGenerateWork}
              disabled={generating || !hasStrategy}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Generate Work Plan
            </button>
          ) : (
            <button
              onClick={onGenerateTactics}
              disabled={generating || !hasStrategy}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Tactics
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Column Header Component
// ============================================================================

interface ColumnHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  showArrow?: boolean;
}

function ColumnHeader({ icon, title, subtitle, color, showArrow }: ColumnHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {showArrow && (
          <ArrowRight className="w-4 h-4 text-slate-600" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Left Column: Inputs
// ============================================================================

interface InputsColumnProps {
  companyId: string;
  strategy: CompanyStrategy | null;
  strategyInputs: StrategyInputs;
  readiness: StrategyReadiness;
  onUpdateStrategy: (updates: Partial<CompanyStrategy>) => Promise<void>;
  isLocked: boolean;
}

function InputsColumn({
  companyId,
  strategy,
  strategyInputs,
  readiness,
  onUpdateStrategy,
  isLocked,
}: InputsColumnProps) {
  const objectives = useMemo(
    () => normalizeObjectives(strategy?.objectives),
    [strategy?.objectives]
  );

  // Editing state
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [editingObjectiveText, setEditingObjectiveText] = useState('');
  const [isAddingObjective, setIsAddingObjective] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [saving, setSaving] = useState(false);

  // Frame editing
  const [editingFrame, setEditingFrame] = useState(false);
  const [frameEdits, setFrameEdits] = useState<StrategyFrame>({});

  // Objective handlers
  const handleSaveObjective = useCallback(async () => {
    if (!editingObjectiveId || !editingObjectiveText.trim()) return;
    setSaving(true);
    try {
      const updated = objectives.map((obj) =>
        obj.id === editingObjectiveId
          ? { ...obj, text: editingObjectiveText.trim() }
          : obj
      );
      await onUpdateStrategy({ objectives: updated });
      setEditingObjectiveId(null);
      setEditingObjectiveText('');
    } finally {
      setSaving(false);
    }
  }, [editingObjectiveId, editingObjectiveText, objectives, onUpdateStrategy]);

  const handleAddObjective = useCallback(async () => {
    if (!newObjectiveText.trim()) return;
    setSaving(true);
    try {
      const newObj: StrategyObjective = {
        id: generateObjectiveId(),
        text: newObjectiveText.trim(),
      };
      await onUpdateStrategy({ objectives: [...objectives, newObj] });
      setNewObjectiveText('');
      setIsAddingObjective(false);
    } finally {
      setSaving(false);
    }
  }, [newObjectiveText, objectives, onUpdateStrategy]);

  const handleDeleteObjective = useCallback(async (id: string) => {
    if (!confirm('Delete this objective?')) return;
    setSaving(true);
    try {
      const updated = objectives.filter((obj) => obj.id !== id);
      await onUpdateStrategy({ objectives: updated });
    } finally {
      setSaving(false);
    }
  }, [objectives, onUpdateStrategy]);

  // Frame handlers
  const handleSaveFrame = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdateStrategy({
        strategyFrame: {
          ...(strategy?.strategyFrame || {}),
          ...frameEdits,
        },
      });
      setEditingFrame(false);
      setFrameEdits({});
    } finally {
      setSaving(false);
    }
  }, [strategy?.strategyFrame, frameEdits, onUpdateStrategy]);

  const frame = strategy?.strategyFrame || {};

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border-r border-slate-800">
      <ColumnHeader
        icon={<Target className="w-4 h-4 text-cyan-400" />}
        title="Objectives"
        subtitle="What we want"
        color="bg-cyan-500/10"
        showArrow
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Objectives Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              Strategic Objectives
              <span className="text-xs text-slate-500">({objectives.length})</span>
            </h3>
            {!isLocked && !isAddingObjective && (
              <button
                onClick={() => setIsAddingObjective(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>

          {/* Objectives List */}
          <div className="space-y-2">
            {objectives.map((objective, idx) => (
              <div
                key={objective.id}
                className="bg-slate-800/50 rounded-lg px-3 py-2"
              >
                {editingObjectiveId === objective.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingObjectiveText}
                      onChange={(e) => setEditingObjectiveText(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveObjective}
                        disabled={saving}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingObjectiveId(null);
                          setEditingObjectiveText('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded text-xs font-medium flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{objective.text}</p>
                      {(objective.metric || objective.target) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          {objective.metric && <span>{objective.metric}</span>}
                          {objective.target && (
                            <span className="text-emerald-400">{objective.target}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isLocked && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingObjectiveId(objective.id);
                            setEditingObjectiveText(objective.text);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteObjective(objective.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {objectives.length === 0 && !isAddingObjective && (
              <p className="text-xs text-slate-500 italic text-center py-4">
                No objectives yet. Add your first objective to get started.
              </p>
            )}
          </div>

          {/* Add Objective Form */}
          {isAddingObjective && (
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 space-y-2 border border-cyan-500/30">
              <textarea
                value={newObjectiveText}
                onChange={(e) => setNewObjectiveText(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                placeholder="What do you want to achieve?"
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddObjective}
                  disabled={saving || !newObjectiveText.trim()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Objective'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingObjective(false);
                    setNewObjectiveText('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* AI Suggest Button */}
          {!isLocked && (
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              AI Suggest Objectives
            </button>
          )}
        </div>

        {/* Strategy Frame Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              Strategy Frame
            </h3>
            {!isLocked && !editingFrame && (
              <button
                onClick={() => {
                  setEditingFrame(true);
                  setFrameEdits(frame);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>

          {editingFrame ? (
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-purple-500/30">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Audience</label>
                <input
                  type="text"
                  value={frameEdits.targetAudience || ''}
                  onChange={(e) => setFrameEdits({ ...frameEdits, targetAudience: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="Who are you targeting?"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Unique Positioning</label>
                <textarea
                  value={frameEdits.positioning || ''}
                  onChange={(e) => setFrameEdits({ ...frameEdits, positioning: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="What makes you different?"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Key Constraints</label>
                <textarea
                  value={frameEdits.constraints || ''}
                  onChange={(e) => setFrameEdits({ ...frameEdits, constraints: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="Budget, timeline, restrictions..."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFrame}
                  disabled={saving}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingFrame(false);
                    setFrameEdits({});
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg divide-y divide-slate-700/50">
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Target Audience</p>
                    <p className="text-sm text-slate-200">
                      {frame.targetAudience || strategyInputs.businessReality?.icpDescription || (
                        <span className="text-slate-500 italic">Not defined</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Positioning</p>
                    <p className="text-sm text-slate-200">
                      {frame.positioning || strategyInputs.businessReality?.valueProposition || (
                        <span className="text-slate-500 italic">Not defined</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Constraints</p>
                    <p className="text-sm text-slate-200">
                      {frame.constraints || strategyInputs.constraints?.legalRestrictions || (
                        <span className="text-slate-500 italic">Not defined</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inputs Completeness */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Inputs Completeness
          </h3>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">
                {readiness.completenessPercent}% Complete
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  readiness.isReady
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {readiness.isReady ? 'Ready' : 'Incomplete'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  readiness.completenessPercent >= 80
                    ? 'bg-emerald-500'
                    : readiness.completenessPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${readiness.completenessPercent}%` }}
              />
            </div>
            {readiness.missingCritical.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">Missing inputs:</p>
                <div className="flex flex-wrap gap-1">
                  {readiness.missingCritical.slice(0, 4).map((field) => (
                    <span
                      key={field.id}
                      className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded"
                    >
                      {field.label}
                    </span>
                  ))}
                  {readiness.missingCritical.length > 4 && (
                    <span className="text-xs text-slate-500">
                      +{readiness.missingCritical.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
            <Link
              href={`/c/${companyId}/context`}
              className="mt-3 flex items-center justify-center gap-1 text-xs text-purple-400 hover:text-purple-300"
            >
              Fix Inputs
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Center Column: Strategy Blueprint
// ============================================================================

interface BlueprintColumnProps {
  strategy: CompanyStrategy | null;
  onUpdateStrategy: (updates: Partial<CompanyStrategy>) => Promise<void>;
  isLocked: boolean;
}

function BlueprintColumn({
  strategy,
  onUpdateStrategy,
  isLocked,
}: BlueprintColumnProps) {
  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [expandedPriority, setExpandedPriority] = useState<string | null>(null);
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [priorityEdits, setPriorityEdits] = useState<Partial<StrategyPillar>>({});
  const [editingTradeoffs, setEditingTradeoffs] = useState(false);
  const [tradeoffEdits, setTradeoffEdits] = useState<StrategyTradeoffs>({});
  const [saving, setSaving] = useState(false);

  // Title/Summary handlers
  const handleSaveTitle = useCallback(async () => {
    if (!editedTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdateStrategy({ title: editedTitle.trim() });
      setEditingTitle(false);
    } finally {
      setSaving(false);
    }
  }, [editedTitle, onUpdateStrategy]);

  const handleSaveSummary = useCallback(async () => {
    if (!editedSummary.trim()) return;
    setSaving(true);
    try {
      await onUpdateStrategy({ summary: editedSummary.trim() });
      setEditingSummary(false);
    } finally {
      setSaving(false);
    }
  }, [editedSummary, onUpdateStrategy]);

  // Priority handlers
  const handleSavePriority = useCallback(async () => {
    if (!editingPriorityId || !priorityEdits.title?.trim()) return;
    setSaving(true);
    try {
      const updated = (strategy?.pillars || []).map((p) =>
        p.id === editingPriorityId
          ? { ...p, ...priorityEdits, title: priorityEdits.title!.trim() }
          : p
      );
      await onUpdateStrategy({ pillars: updated });
      setEditingPriorityId(null);
      setPriorityEdits({});
    } finally {
      setSaving(false);
    }
  }, [editingPriorityId, priorityEdits, strategy?.pillars, onUpdateStrategy]);

  // Tradeoffs handlers
  const handleSaveTradeoffs = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdateStrategy({ tradeoffs: tradeoffEdits });
      setEditingTradeoffs(false);
      setTradeoffEdits({});
    } finally {
      setSaving(false);
    }
  }, [tradeoffEdits, onUpdateStrategy]);

  const pillars = strategy?.pillars || [];
  const tradeoffs = strategy?.tradeoffs || {};

  if (!strategy) {
    return (
      <div className="h-full flex flex-col bg-slate-900/30">
        <ColumnHeader
          icon={<Compass className="w-4 h-4 text-purple-400" />}
          title="Strategy"
          subtitle="How we'll win"
          color="bg-purple-500/10"
          showArrow
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">No Strategy Yet</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Define your objectives and use AI to generate a strategy
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/30">
      <ColumnHeader
        icon={<Compass className="w-4 h-4 text-purple-400" />}
        title="Strategy"
        subtitle="How we'll win"
        color="bg-purple-500/10"
        showArrow
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Strategy Title & Summary */}
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTitle}
                    disabled={saving}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  if (!isLocked) {
                    setEditedTitle(strategy.title);
                    setEditingTitle(true);
                  }
                }}
                className={`${!isLocked ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1' : ''}`}
              >
                <h2 className="text-xl font-semibold text-white">
                  {strategy.title || 'Untitled Strategy'}
                </h2>
              </div>
            )}
          </div>

          {/* Summary */}
          <div>
            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  rows={4}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveSummary}
                    disabled={saving}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingSummary(false)}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  if (!isLocked) {
                    setEditedSummary(strategy.summary);
                    setEditingSummary(true);
                  }
                }}
                className={`${!isLocked ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1' : ''}`}
              >
                <p className="text-sm text-slate-400">
                  {strategy.summary || 'No summary yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Strategic Bets */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Strategic Bets
            <span className="text-xs text-slate-500">({pillars.length})</span>
          </h3>

          <div className="space-y-2">
            {pillars.map((pillar, idx) => (
              <div
                key={pillar.id}
                className="bg-slate-800/50 rounded-lg overflow-hidden"
              >
                {editingPriorityId === pillar.id ? (
                  <div className="p-3 space-y-3">
                    <input
                      type="text"
                      value={priorityEdits.title || ''}
                      onChange={(e) => setPriorityEdits({ ...priorityEdits, title: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      placeholder="Priority title"
                      autoFocus
                    />
                    <textarea
                      value={priorityEdits.rationale || ''}
                      onChange={(e) => setPriorityEdits({ ...priorityEdits, rationale: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                      placeholder="Why this matters..."
                      rows={2}
                    />
                    <textarea
                      value={priorityEdits.tradeoff || ''}
                      onChange={(e) => setPriorityEdits({ ...priorityEdits, tradeoff: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                      placeholder="What we're sacrificing..."
                      rows={2}
                    />
                    <textarea
                      value={priorityEdits.risksLegacy || ''}
                      onChange={(e) => setPriorityEdits({ ...priorityEdits, risksLegacy: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                      placeholder="Potential risks..."
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSavePriority}
                        disabled={saving}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingPriorityId(null);
                          setPriorityEdits({});
                        }}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setExpandedPriority(expandedPriority === pillar.id ? null : pillar.id)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-800/50"
                    >
                      <span className="w-5 h-5 flex items-center justify-center bg-purple-500/10 text-purple-400 rounded text-xs font-medium flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-left text-sm font-medium text-slate-200">
                        {pillar.title}
                      </span>
                      {expandedPriority === pillar.id ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    {expandedPriority === pillar.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50">
                        <div className="pt-2">
                          {pillar.description && (
                            <p className="text-xs text-slate-400 mb-2">{pillar.description}</p>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-slate-500 w-16 flex-shrink-0">Why:</span>
                              <span className="text-xs text-slate-300">
                                {pillar.rationale || <em className="text-slate-500">Not defined</em>}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-slate-500 w-16 flex-shrink-0">Tradeoff:</span>
                              <span className="text-xs text-amber-400">
                                {pillar.tradeoff || <em className="text-slate-500">Not defined</em>}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-slate-500 w-16 flex-shrink-0">Risks:</span>
                              <span className="text-xs text-red-400">
                                {pillar.risksLegacy || (pillar.risks && pillar.risks.length > 0
                                  ? pillar.risks.map(r => r.risk).join('; ')
                                  : <em className="text-slate-500">Not defined</em>)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!isLocked && (
                          <button
                            onClick={() => {
                              setEditingPriorityId(pillar.id);
                              setPriorityEdits({
                                title: pillar.title,
                                rationale: pillar.rationale,
                                tradeoff: pillar.tradeoff,
                                risksLegacy: pillar.risksLegacy || (pillar.risks?.map(r => r.risk).join('; ')),
                              });
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {pillars.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-4">
                No priorities defined yet.
              </p>
            )}
          </div>
        </div>

        {/* Tradeoffs Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Strategy Tradeoffs
            </h3>
            {!isLocked && !editingTradeoffs && (
              <button
                onClick={() => {
                  setEditingTradeoffs(true);
                  setTradeoffEdits(tradeoffs);
                }}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>

          {editingTradeoffs ? (
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-amber-500/30">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Optimizes For</label>
                <input
                  type="text"
                  value={tradeoffEdits.optimizesFor?.join(', ') || ''}
                  onChange={(e) => setTradeoffEdits({
                    ...tradeoffEdits,
                    optimizesFor: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Speed, Quality, Reach..."
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Sacrifices</label>
                <input
                  type="text"
                  value={tradeoffEdits.sacrifices?.join(', ') || ''}
                  onChange={(e) => setTradeoffEdits({
                    ...tradeoffEdits,
                    sacrifices: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Breadth, Short-term wins..."
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Key Risks</label>
                <input
                  type="text"
                  value={tradeoffEdits.risks?.join(', ') || ''}
                  onChange={(e) => setTradeoffEdits({
                    ...tradeoffEdits,
                    risks: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Execution risk, Market timing..."
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveTradeoffs}
                  disabled={saving}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingTradeoffs(false);
                    setTradeoffEdits({});
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Optimizes For</p>
                <div className="flex flex-wrap gap-1">
                  {(tradeoffs.optimizesFor || []).length > 0 ? (
                    tradeoffs.optimizesFor!.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Not defined</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Sacrifices</p>
                <div className="flex flex-wrap gap-1">
                  {(tradeoffs.sacrifices || []).length > 0 ? (
                    tradeoffs.sacrifices!.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Not defined</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Key Risks</p>
                <div className="flex flex-wrap gap-1">
                  {(tradeoffs.risks || []).length > 0 ? (
                    tradeoffs.risks!.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Not defined</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Right Column: Tactics
// ============================================================================

interface TacticsColumnProps {
  strategy: CompanyStrategy | null;
  onUpdateStrategy: (updates: Partial<CompanyStrategy>) => Promise<void>;
  onGenerateWork?: (playIds: string[]) => Promise<void>;
  isLocked: boolean;
}

function TacticsColumn({
  strategy,
  onUpdateStrategy,
  onGenerateWork,
  isLocked,
}: TacticsColumnProps) {
  const plays = strategy?.plays || [];
  const objectives = useMemo(
    () => normalizeObjectives(strategy?.objectives),
    [strategy?.objectives]
  );
  const pillars = strategy?.pillars || [];

  // State
  const [selectedPlayIds, setSelectedPlayIds] = useState<Set<string>>(new Set());
  const [filterChannel, setFilterChannel] = useState<TacticChannel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlayId, setExpandedPlayId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Filter plays
  const filteredPlays = useMemo(() => {
    return plays.filter((play) => {
      if (filterChannel !== 'all' && !play.channels?.includes(filterChannel)) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          play.title.toLowerCase().includes(query) ||
          play.description?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [plays, filterChannel, searchQuery]);

  // Handle generate work
  const handleGenerateWork = useCallback(async () => {
    if (selectedPlayIds.size === 0 || !onGenerateWork) return;
    setGenerating(true);
    try {
      await onGenerateWork(Array.from(selectedPlayIds));
      setSelectedPlayIds(new Set());
    } finally {
      setGenerating(false);
    }
  }, [selectedPlayIds, onGenerateWork]);

  // Toggle play selection
  const togglePlaySelection = useCallback((playId: string) => {
    setSelectedPlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(playId)) {
        next.delete(playId);
      } else {
        next.add(playId);
      }
      return next;
    });
  }, []);

  // Find linked items
  const getLinkedObjective = useCallback(
    (objectiveId?: string) => {
      if (!objectiveId) return null;
      return objectives.find((o) => o.id === objectiveId);
    },
    [objectives]
  );

  const getLinkedPriority = useCallback(
    (priorityId?: string, pillarTitle?: string) => {
      if (priorityId) {
        return pillars.find((p) => p.id === priorityId);
      }
      if (pillarTitle) {
        return pillars.find((p) => p.title === pillarTitle);
      }
      return null;
    },
    [pillars]
  );

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border-l border-slate-800">
      <ColumnHeader
        icon={<Zap className="w-4 h-4 text-amber-400" />}
        title="Tactics"
        subtitle="What we'll do"
        color="bg-amber-500/10"
      />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tactics..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Channel Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterChannel('all')}
              className={`flex-shrink-0 px-2 py-1 text-xs rounded-lg transition-colors ${
                filterChannel === 'all'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              All
            </button>
            {(['seo', 'content', 'website', 'media', 'social'] as TacticChannel[]).map((channel) => (
              <button
                key={channel}
                onClick={() => setFilterChannel(channel)}
                className={`flex-shrink-0 px-2 py-1 text-xs rounded-lg transition-colors ${
                  filterChannel === channel
                    ? TACTIC_CHANNEL_COLORS[channel]
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {TACTIC_CHANNEL_LABELS[channel]}
              </button>
            ))}
          </div>
        </div>

        {/* Plays List */}
        <div className="p-4 space-y-2">
          {filteredPlays.length > 0 ? (
            filteredPlays.map((play) => {
              const linkedObjective = getLinkedObjective(play.objectiveId);
              const linkedPriority = getLinkedPriority(play.priorityId, play.pillarTitle);
              const isSelected = selectedPlayIds.has(play.id);
              const isExpanded = expandedPlayId === play.id;

              return (
                <div
                  key={play.id}
                  className={`bg-slate-800/50 rounded-lg overflow-hidden transition-colors ${
                    isSelected ? 'ring-1 ring-amber-500/50' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="px-3 py-2 flex items-start gap-2">
                    {isLocked && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlaySelection(play.id)}
                        className="mt-1 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                      />
                    )}
                    <button
                      onClick={() => setExpandedPlayId(isExpanded ? null : play.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200">{play.title}</p>
                          {play.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {play.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                            PLAY_STATUS_COLORS[play.status]
                          }`}
                        >
                          {PLAY_STATUS_LABELS[play.status]}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Channel Tags */}
                  {play.channels && play.channels.length > 0 && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {play.channels.map((channel) => (
                        <span
                          key={channel}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${TACTIC_CHANNEL_COLORS[channel]}`}
                        >
                          {TACTIC_CHANNEL_LABELS[channel]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-slate-700/50 space-y-2">
                      {/* Impact/Effort/Confidence */}
                      <div className="flex items-center gap-3 text-xs">
                        {play.impact && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            Impact: {play.impact}
                          </span>
                        )}
                        {play.effort && (
                          <span className="flex items-center gap-1 text-slate-400">
                            Effort: {play.effort}
                          </span>
                        )}
                        {play.confidence && (
                          <span className="flex items-center gap-1 text-purple-400">
                            Confidence: {play.confidence}
                          </span>
                        )}
                      </div>

                      {/* Linked Items */}
                      <div className="flex flex-wrap gap-2">
                        {linkedObjective && (
                          <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/30">
                            Objective: {linkedObjective.text.slice(0, 30)}...
                          </span>
                        )}
                        {linkedPriority && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/30">
                            Priority: {linkedPriority.title}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {plays.length === 0
                  ? 'No tactics yet. Generate tactics from your strategy.'
                  : 'No tactics match your filters.'}
              </p>
            </div>
          )}
        </div>

        {/* Generate Work CTA (when locked) */}
        {isLocked && selectedPlayIds.size > 0 && (
          <div className="sticky bottom-0 p-4 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800">
            <button
              onClick={handleGenerateWork}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Create Work from {selectedPlayIds.size} Play{selectedPlayIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyCommandCenter({
  companyId,
  strategy,
  strategyInputs,
  onUpdateStrategy,
  onGenerateTactics,
  onGenerateWork,
}: StrategyCommandCenterProps) {
  // Compute readiness
  const readiness = useMemo(
    () => computeStrategyReadiness(strategyInputs),
    [strategyInputs]
  );

  // Lock state
  const isLocked = strategy?.lockState === 'locked';
  const [generating, setGenerating] = useState(false);

  // Toggle lock
  const handleToggleLock = useCallback(async () => {
    if (!strategy) return;
    const newLockState: StrategyLockState = isLocked ? 'draft' : 'locked';
    await onUpdateStrategy({ lockState: newLockState });
  }, [strategy, isLocked, onUpdateStrategy]);

  // Handle generate tactics
  const handleGenerateTactics = useCallback(async () => {
    if (!onGenerateTactics) return;
    setGenerating(true);
    try {
      await onGenerateTactics();
    } finally {
      setGenerating(false);
    }
  }, [onGenerateTactics]);

  // Handle generate work (for progress strip)
  const handleGenerateWorkFromStrip = useCallback(async () => {
    // This would open a modal to select plays, or generate work from all active plays
    if (!strategy?.plays || strategy.plays.length === 0) return;
    const activePlayIds = strategy.plays
      .filter((p) => p.status === 'active')
      .map((p) => p.id);
    if (activePlayIds.length === 0) return;
    if (onGenerateWork) {
      setGenerating(true);
      try {
        await onGenerateWork(activePlayIds);
      } finally {
        setGenerating(false);
      }
    }
  }, [strategy?.plays, onGenerateWork]);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Progress Strip */}
      <ProgressStrip
        readiness={readiness}
        lockState={strategy?.lockState || 'draft'}
        onToggleLock={handleToggleLock}
        aiSuggestionCount={0}
        isLocked={isLocked}
        hasStrategy={!!strategy}
        onGenerateTactics={handleGenerateTactics}
        onGenerateWork={handleGenerateWorkFromStrip}
        generating={generating}
      />

      {/* 3-Column Layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: 3 columns */}
        <div className="hidden lg:grid lg:grid-cols-[340px_1fr_380px] h-full">
          <InputsColumn
            companyId={companyId}
            strategy={strategy}
            strategyInputs={strategyInputs}
            readiness={readiness}
            onUpdateStrategy={onUpdateStrategy}
            isLocked={isLocked}
          />
          <BlueprintColumn
            strategy={strategy}
            onUpdateStrategy={onUpdateStrategy}
            isLocked={isLocked}
          />
          <TacticsColumn
            strategy={strategy}
            onUpdateStrategy={onUpdateStrategy}
            onGenerateWork={onGenerateWork}
            isLocked={isLocked}
          />
        </div>

        {/* Mobile/Tablet: Stacked */}
        <div className="lg:hidden h-full overflow-y-auto">
          <div className="min-h-full">
            <InputsColumn
              companyId={companyId}
              strategy={strategy}
              strategyInputs={strategyInputs}
              readiness={readiness}
              onUpdateStrategy={onUpdateStrategy}
              isLocked={isLocked}
            />
            <BlueprintColumn
              strategy={strategy}
              onUpdateStrategy={onUpdateStrategy}
              isLocked={isLocked}
            />
            <TacticsColumn
              strategy={strategy}
              onUpdateStrategy={onUpdateStrategy}
              onGenerateWork={onGenerateWork}
              isLocked={isLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
