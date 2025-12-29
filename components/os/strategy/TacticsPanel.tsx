'use client';

// components/os/strategy/TacticsPanel.tsx
// Right panel for Tactics in the bidirectional strategy view
//
// Features:
// - Responsive card grid layout (1/2/3 columns)
// - Grouped by Priority with collapsible sections
// - Clear program status visibility
// - Prominent primary CTAs
// - AI actions: Propose Tactics, Review Fit, Suggest Strategy Updates

import React, { useState, useCallback, useMemo } from 'react';
import {
  Zap,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { PlanningProgram } from '@/lib/types/program';
import type {
  StrategyObjectiveV6,
  StrategyPriorityV6,
  StrategyTacticV6,
} from '@/lib/types/strategyBidirectional';
import { generatePlayId } from '@/lib/types/strategy';
import { TacticCard } from '@/components/os/strategy/TacticCard';
import type { FieldDraft } from '@/components/os/ai/FieldAIActions';

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
  // Activation control - explicit approval for execution
  onActivateTactic?: (tacticId: string, tactic: StrategyTacticV6) => Promise<void>;
  activatingTacticId?: string | null;
  // Program-first workflow
  onDesignProgram?: (tacticId: string, tactic: StrategyTacticV6) => Promise<void>;
  designingProgramForTacticId?: string | null;
  programsByTacticId?: Map<string, PlanningProgram>;
  onOpenProgram?: (programId: string) => void;
  onViewWork?: (programId: string) => void;
  onAiProposeTactics?: () => void;
  onAiReviewFit?: () => void;
  onAiSuggestStrategyUpdates?: () => void;
  aiLoading?: boolean;
  className?: string;
  // AI Field Improvement props (passed through for future use)
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
// Priority Group Component
// ============================================================================

interface PriorityGroupProps {
  priority: StrategyPriorityV6;
  tactics: StrategyTacticV6[];
  objectives: StrategyObjectiveV6[];
  onUpdateTactic: (tactic: StrategyTacticV6) => void;
  onRemoveTactic: (id: string) => void;
  onLockTactic: (id: string) => void;
  onUnlockTactic: (id: string) => void;
  onAddTactic: (priorityId: string) => void;
  // Activation control
  onActivateTactic?: (tacticId: string, tactic: StrategyTacticV6) => Promise<void>;
  activatingTacticId?: string | null;
  // Program-first workflow
  onDesignProgram?: (tacticId: string, tactic: StrategyTacticV6) => Promise<void>;
  designingProgramForTacticId?: string | null;
  programsByTacticId?: Map<string, PlanningProgram>;
  onOpenProgram?: (programId: string) => void;
  onViewWork?: (programId: string) => void;
}

function PriorityGroup({
  priority,
  tactics,
  objectives,
  onUpdateTactic,
  onRemoveTactic,
  onLockTactic,
  onUnlockTactic,
  onAddTactic,
  onActivateTactic,
  activatingTacticId,
  onDesignProgram,
  designingProgramForTacticId,
  programsByTacticId,
  onOpenProgram,
  onViewWork,
}: PriorityGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Count programs in this group
  const programCount = tactics.filter(t => programsByTacticId?.has(t.id)).length;

  return (
    <div className="mb-6">
      {/* Priority Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 bg-slate-800/80 rounded-xl mb-3 hover:bg-slate-800 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-white">{priority.title}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{tactics.length} tactic{tactics.length !== 1 ? 's' : ''}</span>
              {programCount > 0 && (
                <span className="text-xs text-purple-400">
                  {programCount} program{programCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-1.5 rounded-lg group-hover:bg-slate-700/50 transition-colors">
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Tactics Grid */}
      {!collapsed && (
        <div className="space-y-3">
          {/* Card Grid - responsive columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tactics.map(tactic => {
              const program = programsByTacticId?.get(tactic.id);
              return (
                <TacticCard
                  key={tactic.id}
                  tactic={tactic}
                  objectives={objectives}
                  onUpdate={onUpdateTactic}
                  onRemove={() => onRemoveTactic(tactic.id)}
                  onLock={() => onLockTactic(tactic.id)}
                  onUnlock={() => onUnlockTactic(tactic.id)}
                  onActivate={onActivateTactic ? () => onActivateTactic(tactic.id, tactic) : undefined}
                  isActivating={activatingTacticId === tactic.id}
                  program={program}
                  isDesigningProgram={designingProgramForTacticId === tactic.id}
                  onDesignProgram={onDesignProgram ? () => onDesignProgram(tactic.id, tactic) : undefined}
                  onOpenProgram={program && onOpenProgram ? () => onOpenProgram(program.id) : undefined}
                  onViewWork={program && onViewWork ? () => onViewWork(program.id) : undefined}
                />
              );
            })}
          </div>

          {/* Add Tactic Button */}
          <button
            onClick={() => onAddTactic(priority.id)}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 hover:border-purple-500/50 rounded-xl text-sm text-slate-400 hover:text-purple-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
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
  // Activation control
  onActivateTactic,
  activatingTacticId,
  // Program-first workflow
  onDesignProgram,
  designingProgramForTacticId,
  programsByTacticId,
  onOpenProgram,
  onViewWork,
  onAiProposeTactics,
  onAiReviewFit,
  onAiSuggestStrategyUpdates,
  aiLoading = false,
  className = '',
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

  // Count total programs
  const totalPrograms = programsByTacticId?.size || 0;

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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Tactics</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{tactics.length} total</span>
              {totalPrograms > 0 && (
                <span className="text-xs text-purple-400">
                  {totalPrograms} with programs
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAiProposeTactics}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
            title="AI Propose Tactics"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Propose
          </button>
          <button
            onClick={onAiReviewFit}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
            title="AI Review Tactic Fit"
          >
            Review
          </button>
        </div>
      </div>

      {/* Tactics by Priority */}
      <div className="flex-1 overflow-y-auto pr-1">
        {priorities.map(priority => (
          <PriorityGroup
            key={priority.id}
            priority={priority}
            tactics={tacticsByPriority[priority.id] || []}
            objectives={objectives}
            onUpdateTactic={onUpdateTactic}
            onRemoveTactic={onRemoveTactic}
            onLockTactic={onLockTactic}
            onUnlockTactic={onUnlockTactic}
            onAddTactic={handleStartAdd}
            onActivateTactic={onActivateTactic}
            activatingTacticId={activatingTacticId}
            onDesignProgram={onDesignProgram}
            designingProgramForTacticId={designingProgramForTacticId}
            programsByTacticId={programsByTacticId}
            onOpenProgram={onOpenProgram}
            onViewWork={onViewWork}
          />
        ))}

        {/* Unassigned Tactics */}
        {unassignedTactics.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl mb-3">
              <div className="p-1.5 bg-slate-700/50 rounded-lg">
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-400">Unassigned</span>
                <span className="text-xs text-slate-500 ml-2">
                  ({unassignedTactics.length})
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {unassignedTactics.map(tactic => {
                const program = programsByTacticId?.get(tactic.id);
                return (
                  <TacticCard
                    key={tactic.id}
                    tactic={tactic}
                    objectives={objectives}
                    onUpdate={onUpdateTactic}
                    onRemove={() => onRemoveTactic(tactic.id)}
                    onLock={() => onLockTactic(tactic.id)}
                    onUnlock={() => onUnlockTactic(tactic.id)}
                    onActivate={onActivateTactic ? () => onActivateTactic(tactic.id, tactic) : undefined}
                    isActivating={activatingTacticId === tactic.id}
                    program={program}
                    isDesigningProgram={designingProgramForTacticId === tactic.id}
                    onDesignProgram={onDesignProgram ? () => onDesignProgram(tactic.id, tactic) : undefined}
                    onOpenProgram={program && onOpenProgram ? () => onOpenProgram(program.id) : undefined}
                    onViewWork={program && onViewWork ? () => onViewWork(program.id) : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Add New Modal */}
        {addingTo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-4">Add New Tactic</h3>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-600 rounded-xl text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 mb-4"
                placeholder="What tactic should we pursue?"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setAddingTo(null);
                    setNewTitle('');
                  }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Tactic
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {tactics.length === 0 && priorities.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
            <Zap className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-base font-medium text-slate-400 mb-2">No tactics yet</p>
          <p className="text-sm text-slate-500 max-w-xs">
            Define strategic priorities first, then add tactics to execute your strategy
          </p>
        </div>
      )}

      {/* AI Suggest Strategy Updates Button */}
      {tactics.length > 0 && (
        <div className="pt-4 mt-2 border-t border-slate-700">
          <button
            onClick={onAiSuggestStrategyUpdates}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 p-3 text-sm font-medium text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors disabled:opacity-50"
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
