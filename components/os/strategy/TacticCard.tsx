'use client';

// components/os/strategy/TacticCard.tsx
// Tactic Card Component - True card/tile layout with clear primary actions
//
// Features:
// - Card tile with header, body, footer structure
// - Clear program status visibility
// - Prominent primary CTA
// - Proper locked state messaging

import React, { useState, useCallback, useMemo } from 'react';
import {
  Lock,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Rocket,
  ExternalLink,
  Check,
  Loader2,
  FileBox,
  MoreVertical,
  Play,
  Pause,
  Archive,
} from 'lucide-react';
import type { PlanningProgram, PlanningProgramStatus } from '@/lib/types/program';
import type {
  StrategyObjectiveV6,
  StrategyTacticV6,
  EffortSize,
} from '@/lib/types/strategyBidirectional';
import { EFFORT_SIZE_LABELS } from '@/lib/types/strategyBidirectional';
import { PLAY_STATUS_LABELS, PLAY_STATUS_COLORS } from '@/lib/types/strategy';
import type { ImpactLevel, StrategyPlayStatus } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export interface TacticCardProps {
  tactic: StrategyTacticV6;
  objectives: StrategyObjectiveV6[];
  onUpdate: (tactic: StrategyTacticV6) => void;
  onRemove: () => void;
  onLock: () => void;
  onUnlock: () => void;
  // Activation control - explicit approval for execution
  onActivate?: () => void;
  isActivating?: boolean;
  // Program-first workflow
  program?: PlanningProgram;
  isDesigningProgram?: boolean;
  onDesignProgram?: () => void;
  onOpenProgram?: () => void;
  onViewWork?: () => void;
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

// Program status config with dot colors
const PROGRAM_STATUS_CONFIG: Record<PlanningProgramStatus, {
  label: string;
  dotColor: string;
  icon: typeof Check;
  ctaLabel: string;
  ctaType: 'deliver' | 'work';
}> = {
  draft: {
    label: 'Draft',
    dotColor: 'bg-purple-400',
    icon: Rocket,
    ctaLabel: 'View in Deliver',
    ctaType: 'deliver',
  },
  ready: {
    label: 'Ready',
    dotColor: 'bg-emerald-400',
    icon: FileBox,
    ctaLabel: 'View in Deliver',
    ctaType: 'deliver',
  },
  committed: {
    label: 'In execution',
    dotColor: 'bg-cyan-400',
    icon: Play,
    ctaLabel: 'View Work',
    ctaType: 'work',
  },
  paused: {
    label: 'Paused',
    dotColor: 'bg-amber-400',
    icon: Pause,
    ctaLabel: 'View in Deliver',
    ctaType: 'deliver',
  },
  archived: {
    label: 'Archived',
    dotColor: 'bg-slate-500',
    icon: Archive,
    ctaLabel: 'View in Deliver',
    ctaType: 'deliver',
  },
};

// Check if tactic is "accepted" (can create programs)
function isTacticAccepted(status: StrategyPlayStatus | undefined): boolean {
  return status === 'active' || status === 'proven';
}

// Approval status labels for clarity
const APPROVAL_STATUS = {
  notApproved: {
    label: 'Not approved for execution',
    color: 'text-slate-500',
    bgColor: 'bg-slate-700/30',
  },
  approved: {
    label: 'Approved — ready to design a Program',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
};

// ============================================================================
// Program Status Line Component
// ============================================================================

function ProgramStatusLine({ program }: { program?: PlanningProgram }) {
  if (!program) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="w-2 h-2 rounded-full bg-slate-600" />
        <span>Program: None</span>
      </div>
    );
  }

  const config = PROGRAM_STATUS_CONFIG[program.status];
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      <span className="text-slate-300">Program: {config.label}</span>
    </div>
  );
}

// ============================================================================
// Tactic Card Component
// ============================================================================

export function TacticCard({
  tactic,
  objectives,
  onUpdate,
  onRemove,
  onLock,
  onUnlock,
  onActivate,
  isActivating = false,
  program,
  isDesigningProgram = false,
  onDesignProgram,
  onOpenProgram,
  onViewWork,
}: TacticCardProps) {
  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
  const isAccepted = isTacticAccepted(tactic.status);
  const canDesignProgram = isAccepted && !program && onDesignProgram;

  // Determine card border based on state
  const cardBorder = tactic.isLocked
    ? 'border-amber-500/40 hover:border-amber-500/60'
    : program?.status === 'committed'
    ? 'border-cyan-500/30 hover:border-cyan-500/50'
    : program
    ? 'border-purple-500/30 hover:border-purple-500/50'
    : 'border-slate-700 hover:border-slate-600';

  if (editing) {
    return (
      <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Title</label>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            placeholder="Tactic title"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Description</label>
          <textarea
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none resize-none"
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
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
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
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
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
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              {Object.entries(PLAY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-slate-800/60 border rounded-xl overflow-hidden
        transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50
        ${cardBorder}
      `}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        {/* Title row with status badge and menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">
              {tactic.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Status Badge */}
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${PLAY_STATUS_COLORS[tactic.status || 'proposed']}`}
            >
              {PLAY_STATUS_LABELS[tactic.status || 'proposed']}
            </span>
            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                    <button
                      onClick={() => { setEditing(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    {tactic.isLocked ? (
                      <button
                        onClick={() => { onUnlock(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-slate-700/50 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock
                      </button>
                    ) : (
                      <button
                        onClick={() => { onLock(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Lock
                      </button>
                    )}
                    <button
                      onClick={() => { onRemove(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Impact / Effort row */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`flex items-center gap-1 text-xs ${IMPACT_COLORS[tactic.expectedImpact || 'medium']}`}
          >
            <ImpactIcon className="w-3 h-3" />
            {tactic.expectedImpact || 'medium'}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded border ${EFFORT_COLORS[tactic.effortSize || 'm']}`}
          >
            {EFFORT_SIZE_LABELS[tactic.effortSize || 'm']}
          </span>
        </div>

        {/* Description (2-3 lines clamped) */}
        {tactic.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
            {tactic.description}
          </p>
        )}

        {/* Program Status Line */}
        <ProgramStatusLine program={program} />
      </div>

      {/* Card Footer - Primary CTA (exactly ONE per state) */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-700/50">
        {/* Approval status indicator */}
        {!program && (
          <div className={`flex items-center gap-2 text-xs mb-3 px-2 py-1.5 rounded-lg ${
            isAccepted ? APPROVAL_STATUS.approved.bgColor : APPROVAL_STATUS.notApproved.bgColor
          }`}>
            {isAccepted ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className={APPROVAL_STATUS.approved.color}>{APPROVAL_STATUS.approved.label}</span>
              </>
            ) : (
              <span className={APPROVAL_STATUS.notApproved.color}>
                {tactic.isLocked ? 'Locked — unlock to activate' : APPROVAL_STATUS.notApproved.label}
              </span>
            )}
          </div>
        )}

        {/* Primary CTA - exactly ONE based on state */}
        <div className="flex items-center justify-between gap-2">
          {program ? (
            /* STATE: Has program */
            program.status === 'committed' ? (
              /* Committed: View Work */
              <button
                onClick={onViewWork}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Work
              </button>
            ) : (
              /* Draft/Ready/Paused: View in Deliver */
              <button
                onClick={onOpenProgram}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {PROGRAM_STATUS_CONFIG[program.status].ctaLabel}
              </button>
            )
          ) : isAccepted ? (
            /* STATE: Active + no Program → Design Program */
            <div className="flex-1">
              <button
                onClick={onDesignProgram}
                disabled={isDesigningProgram || !onDesignProgram}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20"
              >
                {isDesigningProgram ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Design Program
                  </>
                )}
              </button>
              <p className="text-xs text-slate-500 text-center mt-1.5">
                Creates a draft Program in Deliver
              </p>
            </div>
          ) : onActivate && !tactic.isLocked ? (
            /* STATE: Draft (not approved) → Activate tactic */
            <div className="flex-1">
              <button
                onClick={onActivate}
                disabled={isActivating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Activate tactic
                  </>
                )}
              </button>
              <p className="text-xs text-slate-500 text-center mt-1.5">
                Approves this tactic for execution
              </p>
            </div>
          ) : (
            /* STATE: Locked or no activation handler */
            <div className="flex-1 text-center">
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 bg-slate-800/50 border border-slate-700 rounded-lg cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                Activate tactic
              </button>
              {tactic.isLocked && (
                <p className="text-xs text-amber-400 text-center mt-1.5">
                  Unlock to activate
                </p>
              )}
            </div>
          )}

          {/* Details toggle (if has linked objectives) */}
          {linkedObjectives.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 px-2 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 rounded-lg transition-colors"
            >
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <span>{linkedObjectives.length}</span>
              {showDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && linkedObjectives.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">Linked Objectives</p>
          <ul className="space-y-1.5">
            {linkedObjectives.map(o => (
              <li key={o.id} className="text-xs text-slate-300 flex items-start gap-2">
                <Target className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TacticCard;
