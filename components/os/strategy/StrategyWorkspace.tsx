'use client';

// components/os/strategy/StrategyWorkspace.tsx
// Strategy Workspace - Single editing surface for all strategy elements
//
// LAYOUT:
// - Top: Strategic Frame (horizontal bar with AI helpers)
// - Main: 3 columns (Objectives | Strategic Bets | Tactics)
// - Bottom: Tools row
//
// REPLACES: Builder + Command + Orchestration views
//
// AI EVERYWHERE:
// - Column-level AI Generate buttons
// - Field-level AI helper on every editable field

import React, { useState, useCallback, useMemo } from 'react';
import {
  Target,
  Layers,
  Zap,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Link2,
  Edit3,
  Pin,
  MoreHorizontal,
  Scale,
  Sparkles,
} from 'lucide-react';
import type {
  StrategyObjective,
  StrategicBet,
  StrategicBetStatus,
  Tactic,
  StrategyFrame,
  TacticChannel,
  ImpactLevel,
  EffortLevel,
} from '@/lib/types/strategy';
import {
  generateObjectiveId,
  generateBetId,
  generateTacticId,
  TACTIC_CHANNEL_LABELS,
  TACTIC_CHANNEL_COLORS,
} from '@/lib/types/strategy';
import type { StrategyDraft, DraftScopeType } from '@/lib/os/strategy/drafts';
import { FieldAIHelper, type FieldAIAction, type ApplyMode } from './FieldAIHelper';
import { ColumnAIGenerateButton, type GenerateMode } from './ColumnAIGenerateButton';
import {
  FRAME_FIELDS,
  computeFrameCompleteness,
  type FrameCompleteness,
} from '@/lib/os/strategy/frameValidation';
import { GoalStatementCard } from './GoalStatementCard';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface StrategyWorkspaceProps {
  companyId: string;
  strategyId: string;
  companyName: string;
  // Data
  frame: StrategyFrame;
  objectives: StrategyObjective[];
  bets: StrategicBet[];
  tactics: Tactic[];
  // Goal Statement
  goalStatement?: string;
  onGoalStatementChange?: (goalStatement: string) => void;
  /** Ref for scrolling to goal editor from Inputs row */
  goalEditorRef?: React.RefObject<HTMLDivElement | null>;
  // Drafts (AI-generated items pending approval)
  drafts?: StrategyDraft[];
  draftsRecord?: Record<string, StrategyDraft>;
  // State
  isLoading?: boolean;
  // Callbacks
  onFrameUpdate: (updates: Partial<StrategyFrame>) => void;
  onObjectivesUpdate: (objectives: StrategyObjective[]) => void;
  onBetsUpdate: (bets: StrategicBet[]) => void;
  onTacticsUpdate: (tactics: Tactic[]) => void;
  // Draft actions
  onApplyDraft?: (draft: StrategyDraft) => Promise<boolean>;
  onDiscardDraft?: (draftId: string) => Promise<boolean>;
  // AI Callbacks
  onAIGenerate: (
    type: 'objectives' | 'bets' | 'tactics',
    mode: GenerateMode,
    guidance?: string
  ) => Promise<void>;
  onAIFieldAction: (
    fieldType: string,
    currentValue: string | string[],
    action: FieldAIAction,
    guidance?: string
  ) => Promise<{ value: string | string[] | { variants: string[] }; inputsUsed?: Record<string, boolean> }>;
  isGenerating?: boolean;
}

// ============================================================================
// Strategic Frame Bar
// ============================================================================

interface FrameBarProps {
  frame: StrategyFrame;
  frameCompleteness: FrameCompleteness;
  onUpdate: (updates: Partial<StrategyFrame>) => void;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
}

function FrameBar({ frame, frameCompleteness, onUpdate, onAIFieldAction }: FrameBarProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-200">Strategic Frame</h2>
          <span className="text-xs text-slate-500" title="Strategy-scoped assumptions that guide AI generation">
            Strategy Assumptions
          </span>
        </div>
        {/* Frame Completeness Indicator */}
        <div className="flex items-center gap-2">
          {frameCompleteness.isComplete ? (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Frame complete
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30"
              title={`Missing: ${frameCompleteness.missingLabels.join(', ')}`}
            >
              {frameCompleteness.missingFields.length} field{frameCompleteness.missingFields.length > 1 ? 's' : ''} missing
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {FRAME_FIELDS.map((fieldDef) => (
          <FrameField
            key={fieldDef.key}
            fieldKey={fieldDef.key}
            label={fieldDef.shortLabel}
            description={fieldDef.description}
            placeholder={fieldDef.placeholder}
            value={frame[fieldDef.key] as string | undefined}
            isMissing={frameCompleteness.missingFields.includes(fieldDef.key)}
            onChange={(value) => onUpdate({ [fieldDef.key]: value })}
            onAIFieldAction={onAIFieldAction}
          />
        ))}
      </div>
    </div>
  );
}

interface FrameFieldProps {
  fieldKey: string;
  label: string;
  description?: string;
  placeholder?: string;
  value: string | undefined;
  isMissing?: boolean;
  onChange: (value: string) => void;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
}

function FrameField({
  fieldKey,
  label,
  description,
  placeholder,
  value,
  isMissing,
  onChange,
  onAIFieldAction,
}: FrameFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleAIFetch = useCallback(
    async (action: FieldAIAction, guidance?: string) => {
      return onAIFieldAction(`frame.${fieldKey}`, value || '', action, guidance);
    },
    [onAIFieldAction, fieldKey, value]
  );

  const handleAIApply = useCallback(
    (newValue: string | string[], mode: ApplyMode) => {
      const val = Array.isArray(newValue) ? newValue.join(', ') : newValue;
      if (mode === 'replace') {
        onChange(val);
        setEditValue(val);
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label
          className={`text-xs font-medium ${isMissing ? 'text-red-400' : 'text-slate-400'}`}
          title={description}
        >
          {label}
          {isMissing && <span className="ml-1 text-red-400">*</span>}
        </label>
        <FieldAIHelper
          fieldType={`frame.${fieldKey}`}
          currentValue={value || ''}
          onApply={handleAIApply}
          onFetch={handleAIFetch}
        />
      </div>
      {isEditing ? (
        <div className="space-y-1">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-2 py-0.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            setEditValue(value || '');
            setIsEditing(true);
          }}
          className={`px-2 py-1.5 text-xs rounded cursor-pointer transition-colors min-h-[40px] ${
            isMissing
              ? 'bg-red-500/5 border border-red-500/30 hover:border-red-500/50'
              : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
          }`}
        >
          {value ? (
            <span className="text-slate-300">{value}</span>
          ) : (
            <span className={isMissing ? 'text-red-400/70 italic' : 'text-slate-500 italic'}>
              {placeholder || 'Click to add...'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Draft Card (reusable for all draft types)
// ============================================================================

interface DraftCardProps {
  draft: StrategyDraft;
  onApply?: (draft: StrategyDraft) => Promise<boolean>;
  onDiscard?: (draftId: string) => Promise<boolean>;
}

function DraftCard({ draft, onApply, onDiscard }: DraftCardProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;
    setIsApplying(true);
    try {
      await onApply(draft);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = async () => {
    if (!onDiscard) return;
    await onDiscard(draft.id);
  };

  // Parse draft value (might be JSON for complex items)
  let displayValue = draft.draftValue;
  try {
    const parsed = JSON.parse(draft.draftValue);
    if (parsed.text) displayValue = parsed.text;
    else if (parsed.title) displayValue = parsed.title;
    else if (typeof parsed === 'string') displayValue = parsed;
  } catch {
    // Not JSON, use as-is
  }

  return (
    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 break-words">{displayValue}</p>
          {draft.rationale && draft.rationale.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">{draft.rationale[0]}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              draft.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
              draft.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {draft.confidence} confidence
            </span>
            <span className="text-[10px] text-slate-500">{draft.scopeType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleApply}
            disabled={isApplying || !onApply}
            className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
            title="Accept this draft"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleDiscard}
            disabled={!onDiscard}
            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
            title="Discard this draft"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Objectives Column
// ============================================================================

interface ObjectivesColumnProps {
  objectives: StrategyObjective[];
  drafts: StrategyDraft[];
  onUpdate: (objectives: StrategyObjective[]) => void;
  onApplyDraft?: (draft: StrategyDraft) => Promise<boolean>;
  onDiscardDraft?: (draftId: string) => Promise<boolean>;
  onAIGenerate: (mode: GenerateMode, guidance?: string) => Promise<void>;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
  isGenerating: boolean;
  frameComplete: boolean;
}

function ObjectivesColumn({
  objectives,
  drafts,
  onUpdate,
  onApplyDraft,
  onDiscardDraft,
  onAIGenerate,
  onAIFieldAction,
  isGenerating,
  frameComplete,
}: ObjectivesColumnProps) {
  const handleAdd = () => {
    const newObjective: StrategyObjective = {
      id: generateObjectiveId(),
      text: '',
      status: 'draft',
    };
    onUpdate([...objectives, newObjective]);
  };

  const handleUpdateObjective = (id: string, updates: Partial<StrategyObjective>) => {
    onUpdate(objectives.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)));
  };

  const handleDeleteObjective = (id: string) => {
    onUpdate(objectives.filter((obj) => obj.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-200">
            Objectives
            <span className="ml-2 text-xs font-normal text-slate-500">({objectives.length})</span>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <ColumnAIGenerateButton
            type="objectives"
            onGenerate={onAIGenerate}
            isGenerating={isGenerating}
            inputsAvailable={{ frame: frameComplete, objectives: true, bets: false }}
            existingCount={objectives.length}
          />
          <button
            onClick={handleAdd}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            title="Add Objective"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drafts Section (AI-generated pending approval) */}
      {drafts.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-purple-400 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Drafts ({drafts.length} pending)</span>
          </div>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApply={onApplyDraft}
              onDiscard={onDiscardDraft}
            />
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            onUpdate={(updates) => handleUpdateObjective(objective.id, updates)}
            onDelete={() => handleDeleteObjective(objective.id)}
            onAIFieldAction={onAIFieldAction}
          />
        ))}
        {objectives.length === 0 && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No objectives yet</p>
            <p className="text-xs text-slate-600 mt-1">Add one or use AI Generate</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ObjectiveCardProps {
  objective: StrategyObjective;
  onUpdate: (updates: Partial<StrategyObjective>) => void;
  onDelete: () => void;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
}

function ObjectiveCard({ objective, onUpdate, onDelete, onAIFieldAction }: ObjectiveCardProps) {
  const [isEditing, setIsEditing] = useState(!objective.text);
  const [editText, setEditText] = useState(objective.text);
  const [editMetric, setEditMetric] = useState(objective.metric || '');
  const [editTarget, setEditTarget] = useState(objective.target || '');

  const handleSave = () => {
    onUpdate({
      text: editText,
      metric: editMetric || undefined,
      target: editTarget || undefined,
    });
    setIsEditing(false);
  };

  const handleAIFetch = useCallback(
    async (action: FieldAIAction, guidance?: string) => {
      return onAIFieldAction(`objective.${objective.id}.text`, objective.text, action, guidance);
    },
    [onAIFieldAction, objective]
  );

  const handleAIApply = useCallback(
    (newValue: string | string[], mode: ApplyMode) => {
      const val = Array.isArray(newValue) ? newValue[0] : newValue;
      if (mode === 'replace') {
        onUpdate({ text: val });
        setEditText(val);
      }
    },
    [onUpdate]
  );

  if (isEditing) {
    return (
      <div className="p-3 bg-slate-800 border border-purple-500/30 rounded-lg space-y-2">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="What do we want to achieve?"
          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
          rows={2}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={editMetric}
            onChange={(e) => setEditMetric(e.target.value)}
            placeholder="Metric (e.g., MRR)"
            className="px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
          />
          <input
            type="text"
            value={editTarget}
            onChange={(e) => setEditTarget(e.target.value)}
            placeholder="Target (e.g., +25%)"
            className="px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (!objective.text) onDelete();
              else setIsEditing(false);
            }}
            className="px-2 py-1 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200">{objective.text}</p>
          {(objective.metric || objective.target) && (
            <div className="flex items-center gap-2 mt-1">
              {objective.metric && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">
                  {objective.metric}
                </span>
              )}
              {objective.target && (
                <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                  → {objective.target}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <FieldAIHelper
            fieldType={`objective.${objective.id}.text`}
            currentValue={objective.text}
            onApply={handleAIApply}
            onFetch={handleAIFetch}
          />
          <button
            onClick={() => {
              setEditText(objective.text);
              setEditMetric(objective.metric || '');
              setEditTarget(objective.target || '');
              setIsEditing(true);
            }}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-400 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Strategic Bets Column
// ============================================================================

interface BetsColumnProps {
  bets: StrategicBet[];
  objectives: StrategyObjective[];
  drafts: StrategyDraft[];
  onUpdate: (bets: StrategicBet[]) => void;
  onApplyDraft?: (draft: StrategyDraft) => Promise<boolean>;
  onDiscardDraft?: (draftId: string) => Promise<boolean>;
  onAIGenerate: (mode: GenerateMode, guidance?: string) => Promise<void>;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
  isGenerating: boolean;
  frameComplete: boolean;
  hasObjectives: boolean;
}

function BetsColumn({
  bets,
  objectives,
  drafts,
  onUpdate,
  onApplyDraft,
  onDiscardDraft,
  onAIGenerate,
  onAIFieldAction,
  isGenerating,
  frameComplete,
  hasObjectives,
}: BetsColumnProps) {
  const acceptedCount = bets.filter((b) => b.status === 'accepted').length;
  const draftCount = bets.filter((b) => b.status === 'draft').length;

  const handleAdd = () => {
    const newBet: StrategicBet = {
      id: generateBetId(),
      title: '',
      intent: '',
      linkedObjectives: [],
      pros: [],
      cons: [],
      tradeoffs: [],
      status: 'draft',
    };
    onUpdate([...bets, newBet]);
  };

  const handleUpdateBet = (id: string, updates: Partial<StrategicBet>) => {
    onUpdate(bets.map((bet) => (bet.id === id ? { ...bet, ...updates } : bet)));
  };

  const handleDeleteBet = (id: string) => {
    onUpdate(bets.filter((bet) => bet.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Strategic Bets</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400">{acceptedCount} accepted</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400">{draftCount} draft</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ColumnAIGenerateButton
            type="bets"
            onGenerate={onAIGenerate}
            isGenerating={isGenerating}
            inputsAvailable={{ frame: frameComplete, objectives: hasObjectives, bets: false }}
            existingCount={bets.length}
            acceptedCount={acceptedCount}
          />
          <button
            onClick={handleAdd}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            title="Add Strategic Bet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drafts Section */}
      {drafts.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-purple-400 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Drafts ({drafts.length} pending)</span>
          </div>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApply={onApplyDraft}
              onDiscard={onDiscardDraft}
            />
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {bets.map((bet) => (
          <BetCard
            key={bet.id}
            bet={bet}
            objectives={objectives}
            onUpdate={(updates) => handleUpdateBet(bet.id, updates)}
            onDelete={() => handleDeleteBet(bet.id)}
            onAIFieldAction={onAIFieldAction}
          />
        ))}
        {bets.length === 0 && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Layers className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No strategic bets yet</p>
            <p className="text-xs text-slate-600 mt-1">Add one or use AI Generate</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface BetCardProps {
  bet: StrategicBet;
  objectives: StrategyObjective[];
  onUpdate: (updates: Partial<StrategicBet>) => void;
  onDelete: () => void;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
}

function BetCard({ bet, objectives, onUpdate, onDelete, onAIFieldAction }: BetCardProps) {
  const [isExpanded, setIsExpanded] = useState(!bet.title);
  const [isEditing, setIsEditing] = useState(!bet.title);

  const statusColors = {
    draft: 'border-amber-500/30 bg-amber-500/5',
    accepted: 'border-emerald-500/30 bg-emerald-500/5',
    rejected: 'border-red-500/30 bg-red-500/5',
  };

  const statusBadgeColors = {
    draft: 'bg-amber-500/20 text-amber-400',
    accepted: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  const handleAIFetch = useCallback(
    async (action: FieldAIAction, guidance?: string) => {
      if (action === 'addPros') {
        return onAIFieldAction(`bet.${bet.id}.pros`, bet.pros, action, guidance);
      }
      if (action === 'addCons') {
        return onAIFieldAction(`bet.${bet.id}.cons`, bet.cons, action, guidance);
      }
      if (action === 'addTradeoffs') {
        return onAIFieldAction(`bet.${bet.id}.tradeoffs`, bet.tradeoffs, action, guidance);
      }
      return onAIFieldAction(`bet.${bet.id}.intent`, bet.intent, action, guidance);
    },
    [onAIFieldAction, bet]
  );

  const handleAIApply = useCallback(
    (newValue: string | string[], mode: ApplyMode, field?: 'pros' | 'cons' | 'tradeoffs') => {
      if (field && Array.isArray(newValue)) {
        if (mode === 'insert') {
          onUpdate({ [field]: [...bet[field], ...newValue] });
        } else {
          onUpdate({ [field]: newValue });
        }
      } else if (!field) {
        const val = Array.isArray(newValue) ? newValue[0] : newValue;
        onUpdate({ intent: val });
      }
    },
    [onUpdate, bet]
  );

  return (
    <div className={`rounded-lg border transition-colors ${statusColors[bet.status]}`}>
      {/* Header - always visible */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={bet.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Bet title..."
                className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-slate-200">{bet.title || 'New Bet'}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadgeColors[bet.status]}`}>
                  {bet.status}
                </span>
              </div>
            )}
            {!isEditing && bet.intent && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{bet.intent}</p>
            )}
          </div>
          {!isEditing && (
            <button className="text-slate-500 hover:text-slate-300 p-1 flex-shrink-0">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Quick stats */}
        {!isEditing && !isExpanded && (
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {bet.linkedObjectives.length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 className="w-3 h-3" /> {bet.linkedObjectives.length}
              </span>
            )}
            {bet.pros.length > 0 && (
              <span className="flex items-center gap-1 text-emerald-500">
                <ThumbsUp className="w-3 h-3" /> {bet.pros.length}
              </span>
            )}
            {bet.cons.length > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <ThumbsDown className="w-3 h-3" /> {bet.cons.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {(isExpanded || isEditing) && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50">
          {/* Intent */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Intent</label>
              <FieldAIHelper
                fieldType={`bet.${bet.id}.intent`}
                currentValue={bet.intent}
                onApply={(val) => handleAIApply(val, 'replace')}
                onFetch={handleAIFetch}
              />
            </div>
            <textarea
              value={bet.intent}
              onChange={(e) => onUpdate({ intent: e.target.value })}
              placeholder="What outcome do we expect?"
              className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Linked Objectives */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Linked Objectives</label>
            <div className="flex flex-wrap gap-1">
              {objectives.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => {
                    const linked = bet.linkedObjectives.includes(obj.id)
                      ? bet.linkedObjectives.filter((id) => id !== obj.id)
                      : [...bet.linkedObjectives, obj.id];
                    onUpdate({ linkedObjectives: linked });
                  }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    bet.linkedObjectives.includes(obj.id)
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {obj.text.slice(0, 25)}{obj.text.length > 25 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Pros */}
          <ListSection
            label="Pros"
            items={bet.pros}
            icon={ThumbsUp}
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
            onUpdate={(pros) => onUpdate({ pros })}
            onAIFetch={(action, guidance) => onAIFieldAction(`bet.${bet.id}.pros`, bet.pros, action, guidance)}
            onAIApply={(val, mode) => handleAIApply(val, mode, 'pros')}
          />

          {/* Cons */}
          <ListSection
            label="Cons"
            items={bet.cons}
            icon={ThumbsDown}
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
            onUpdate={(cons) => onUpdate({ cons })}
            onAIFetch={(action, guidance) => onAIFieldAction(`bet.${bet.id}.cons`, bet.cons, action, guidance)}
            onAIApply={(val, mode) => handleAIApply(val, mode, 'cons')}
          />

          {/* Tradeoffs */}
          <ListSection
            label="Tradeoffs"
            items={bet.tradeoffs}
            icon={AlertTriangle}
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
            onUpdate={(tradeoffs) => onUpdate({ tradeoffs })}
            onAIFetch={(action, guidance) => onAIFieldAction(`bet.${bet.id}.tradeoffs`, bet.tradeoffs, action, guidance)}
            onAIApply={(val, mode) => handleAIApply(val, mode, 'tradeoffs')}
          />

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    if (!bet.title) onDelete();
                    else setIsEditing(false);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-2 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded"
                >
                  Edit
                </button>
                {bet.status === 'draft' && (
                  <>
                    <button
                      onClick={() => onUpdate({ status: 'accepted' })}
                      className="flex-1 px-2 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button
                      onClick={() => onUpdate({ status: 'rejected' })}
                      className="flex-1 px-2 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </>
                )}
                {bet.status === 'accepted' && (
                  <button
                    onClick={() => onUpdate({ status: 'draft' })}
                    className="flex-1 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded"
                  >
                    Move to Draft
                  </button>
                )}
                {bet.status === 'rejected' && (
                  <button
                    onClick={() => onUpdate({ status: 'draft' })}
                    className="flex-1 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700/50 rounded"
                  >
                    Reconsider
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// List section component for pros/cons/tradeoffs
interface ListSectionProps {
  label: string;
  items: string[];
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  onUpdate: (items: string[]) => void;
  onAIFetch: (action: FieldAIAction, guidance?: string) => Promise<{ value: string | string[] | { variants: string[] }; inputsUsed?: Record<string, boolean> }>;
  onAIApply: (value: string | string[], mode: ApplyMode) => void;
}

function ListSection({ label, items, icon: Icon, colorClass, bgClass, onUpdate, onAIFetch, onAIApply }: ListSectionProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onUpdate([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const aiAction = label === 'Pros' ? 'addPros' : label === 'Cons' ? 'addCons' : 'addTradeoffs';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-xs ${colorClass} flex items-center gap-1`}>
          <Icon className="w-3 h-3" /> {label}
        </label>
        <FieldAIHelper
          fieldType={`bet.${label.toLowerCase()}`}
          currentValue={items}
          onApply={onAIApply}
          onFetch={onAIFetch}
          isListField
          availableActions={[aiAction]}
        />
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 text-xs">
            <span className={`flex-1 ${bgClass} px-2 py-1 rounded text-slate-300`}>{item}</span>
            <button onClick={() => handleRemove(idx)} className="text-slate-500 hover:text-red-400 p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={`Add ${label.toLowerCase().slice(0, -1)}...`}
            className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
          />
          <button onClick={handleAdd} className={`px-2 py-1 text-xs ${bgClass} ${colorClass} rounded`}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tactics Column
// ============================================================================

interface TacticsColumnProps {
  tactics: Tactic[];
  bets: StrategicBet[];
  drafts: StrategyDraft[];
  onUpdate: (tactics: Tactic[]) => void;
  onApplyDraft?: (draft: StrategyDraft) => Promise<boolean>;
  onDiscardDraft?: (draftId: string) => Promise<boolean>;
  onAIGenerate: (mode: GenerateMode, guidance?: string) => Promise<void>;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
  isGenerating: boolean;
  frameComplete: boolean;
  hasObjectives: boolean;
  hasAcceptedBets: boolean;
}

function TacticsColumn({
  tactics,
  bets,
  drafts,
  onUpdate,
  onApplyDraft,
  onDiscardDraft,
  onAIGenerate,
  onAIFieldAction,
  isGenerating,
  frameComplete,
  hasObjectives,
  hasAcceptedBets,
}: TacticsColumnProps) {
  const acceptedBets = bets.filter((b) => b.status === 'accepted');

  const handleAdd = () => {
    const newTactic: Tactic = {
      id: generateTacticId(),
      title: '',
      description: '',
      linkedBetIds: [],
      isDerived: false,
    };
    onUpdate([...tactics, newTactic]);
  };

  const handleUpdateTactic = (id: string, updates: Partial<Tactic>) => {
    onUpdate(tactics.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDeleteTactic = (id: string) => {
    onUpdate(tactics.filter((t) => t.id !== id));
  };

  const handleTogglePin = (id: string) => {
    onUpdate(tactics.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-200">
            Tactics
            <span className="ml-2 text-xs font-normal text-slate-500">({tactics.length})</span>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <ColumnAIGenerateButton
            type="tactics"
            onGenerate={onAIGenerate}
            isGenerating={isGenerating}
            inputsAvailable={{ frame: frameComplete, objectives: hasObjectives, bets: hasAcceptedBets }}
            existingCount={tactics.length}
            disabled={!hasAcceptedBets}
          />
          <button
            onClick={handleAdd}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            title="Add Tactic"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No accepted bets warning */}
      {!hasAcceptedBets && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-400 font-medium">No accepted bets</p>
              <p className="text-xs text-amber-300/70">Accept strategic bets to generate tactics</p>
            </div>
          </div>
        </div>
      )}

      {/* Drafts Section */}
      {drafts.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-purple-400 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Drafts ({drafts.length} pending)</span>
          </div>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApply={onApplyDraft}
              onDiscard={onDiscardDraft}
            />
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {tactics.map((tactic) => (
          <TacticCard
            key={tactic.id}
            tactic={tactic}
            bets={acceptedBets}
            onUpdate={(updates) => handleUpdateTactic(tactic.id, updates)}
            onDelete={() => handleDeleteTactic(tactic.id)}
            onTogglePin={() => handleTogglePin(tactic.id)}
            onAIFieldAction={onAIFieldAction}
          />
        ))}
        {tactics.length === 0 && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No tactics yet</p>
            <p className="text-xs text-slate-600 mt-1">
              {hasAcceptedBets ? 'Use AI Generate or add manually' : 'Accept bets first to generate'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TacticCardProps {
  tactic: Tactic;
  bets: StrategicBet[];
  onUpdate: (updates: Partial<Tactic>) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onAIFieldAction: StrategyWorkspaceProps['onAIFieldAction'];
}

function TacticCard({ tactic, bets, onUpdate, onDelete, onTogglePin, onAIFieldAction }: TacticCardProps) {
  const [isEditing, setIsEditing] = useState(!tactic.title);

  const handleAIFetch = useCallback(
    async (action: FieldAIAction, guidance?: string) => {
      return onAIFieldAction(`tactic.${tactic.id}.description`, tactic.description, action, guidance);
    },
    [onAIFieldAction, tactic]
  );

  const handleAIApply = useCallback(
    (newValue: string | string[], mode: ApplyMode) => {
      const val = Array.isArray(newValue) ? newValue[0] : newValue;
      if (mode === 'replace') {
        onUpdate({ description: val, isCustomized: true });
      }
    },
    [onUpdate]
  );

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        tactic.isPinned
          ? 'border-purple-500/30 bg-purple-500/5'
          : tactic.isDerived && !tactic.isCustomized
          ? 'border-slate-700 bg-slate-800/30'
          : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={tactic.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Tactic title..."
              className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-slate-200">{tactic.title || 'New Tactic'}</h4>
              {tactic.isPinned && <Pin className="w-3 h-3 text-purple-400" />}
              {tactic.isDerived && !tactic.isCustomized && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                  AI-derived
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <FieldAIHelper
            fieldType={`tactic.${tactic.id}.description`}
            currentValue={tactic.description}
            onApply={handleAIApply}
            onFetch={handleAIFetch}
          />
          <button
            onClick={onTogglePin}
            className={`p-1 rounded ${tactic.isPinned ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}
            title={tactic.isPinned ? 'Unpin' : 'Pin (preserve during regen)'}
          >
            <Pin className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Description */}
      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={tactic.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Describe this tactic..."
            className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                if (!tactic.title) onDelete();
                else setIsEditing(false);
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onUpdate({ isCustomized: true });
                setIsEditing(false);
              }}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {tactic.description && (
            <p className="text-xs text-slate-400 mt-1">{tactic.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Tools Row
// ============================================================================

interface ToolsRowProps {
  onTool: (tool: string) => void;
}

function ToolsRow({ onTool }: ToolsRowProps) {
  const tools = [
    { id: 'compare', label: 'Compare Bets', icon: Scale },
    { id: 'pros-cons', label: 'Pros/Cons Assist', icon: ThumbsUp },
    { id: 'tradeoffs', label: 'Tradeoffs Assist', icon: AlertTriangle },
    { id: 'metrics', label: 'Refine Metrics', icon: Target },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-slate-500 flex-shrink-0">Tools:</span>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onTool(tool.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Icon className="w-3.5 h-3.5" />
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyWorkspace({
  companyId,
  strategyId,
  companyName,
  frame,
  objectives,
  bets,
  tactics,
  goalStatement,
  onGoalStatementChange,
  goalEditorRef,
  drafts = [],
  draftsRecord = {},
  isLoading,
  onFrameUpdate,
  onObjectivesUpdate,
  onBetsUpdate,
  onTacticsUpdate,
  onApplyDraft,
  onDiscardDraft,
  onAIGenerate,
  onAIFieldAction,
  isGenerating = false,
}: StrategyWorkspaceProps) {
  // Filter drafts by scope type
  const objectiveDrafts = useMemo(() => drafts.filter(d => d.scopeType === 'objective'), [drafts]);
  const betDrafts = useMemo(() => drafts.filter(d => d.scopeType === 'priority' || d.scopeType === 'strategy'), [drafts]);
  const tacticDrafts = useMemo(() => drafts.filter(d => d.scopeType === 'tactic'), [drafts]);
  const frameDrafts = useMemo(() => drafts.filter(d => d.scopeType === 'frame'), [drafts]);

  // Compute frame completeness using the validation module
  const frameCompleteness = useMemo(() => computeFrameCompleteness(frame), [frame]);
  const frameComplete = frameCompleteness.isComplete;

  const hasObjectives = objectives.length > 0;
  const hasAcceptedBets = bets.some((b) => b.status === 'accepted');
  const hasDrafts = drafts.length > 0;

  // Handle tool actions
  const handleTool = useCallback((tool: string) => {
    console.log('Tool clicked:', tool);
    // TODO: Implement tool actions
  }, []);

  return (
    <div className="space-y-4">
      {/* Goal Statement - shown above frame as primary strategy input */}
      <div ref={goalEditorRef}>
        <GoalStatementCard
          companyId={companyId}
          strategyId={strategyId}
          goalStatement={goalStatement}
          onGoalStatementChange={onGoalStatementChange}
          className="mb-0"
        />
      </div>

      {/* Strategic Frame */}
      <FrameBar
        frame={frame}
        frameCompleteness={frameCompleteness}
        onUpdate={onFrameUpdate}
        onAIFieldAction={onAIFieldAction}
      />

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '500px' }}>
        {/* Objectives */}
        <ObjectivesColumn
          objectives={objectives}
          drafts={objectiveDrafts}
          onUpdate={onObjectivesUpdate}
          onApplyDraft={onApplyDraft}
          onDiscardDraft={onDiscardDraft}
          onAIGenerate={(mode, guidance) => onAIGenerate('objectives', mode, guidance)}
          onAIFieldAction={onAIFieldAction}
          isGenerating={isGenerating}
          frameComplete={frameComplete}
        />

        {/* Strategic Bets */}
        <BetsColumn
          bets={bets}
          objectives={objectives}
          drafts={betDrafts}
          onUpdate={onBetsUpdate}
          onApplyDraft={onApplyDraft}
          onDiscardDraft={onDiscardDraft}
          onAIGenerate={(mode, guidance) => onAIGenerate('bets', mode, guidance)}
          onAIFieldAction={onAIFieldAction}
          isGenerating={isGenerating}
          frameComplete={frameComplete}
          hasObjectives={hasObjectives}
        />

        {/* Tactics */}
        <TacticsColumn
          tactics={tactics}
          bets={bets}
          drafts={tacticDrafts}
          onUpdate={onTacticsUpdate}
          onApplyDraft={onApplyDraft}
          onDiscardDraft={onDiscardDraft}
          onAIGenerate={(mode, guidance) => onAIGenerate('tactics', mode, guidance)}
          onAIFieldAction={onAIFieldAction}
          isGenerating={isGenerating}
          frameComplete={frameComplete}
          hasObjectives={hasObjectives}
          hasAcceptedBets={hasAcceptedBets}
        />
      </div>

      {/* Next Step Hint */}
      <div className="text-center py-4">
        <p className="text-sm text-slate-500">
          Next step: Generate briefs, summaries, and playbooks from this strategy in{' '}
          <Link
            href={`/c/${companyId}/deliver/artifacts`}
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            Deliver → Artifacts
          </Link>
          .
        </p>
      </div>

      {/* Tools Row */}
      <ToolsRow onTool={handleTool} />
    </div>
  );
}

export default StrategyWorkspace;
