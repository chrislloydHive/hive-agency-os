'use client';

// app/c/[companyId]/strategy/StrategyWorkspaceV5Client.tsx
// Bidirectional Strategy Workspace with three-column layout
//
// LEFT: Objectives (what matters)
// CENTER: Strategy Core (how we win)
// RIGHT: Tactics (what we do)
//
// Features bidirectional AI proposals that can suggest changes
// in any direction, always as drafts requiring explicit Apply.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Target,
  Layers,
  Zap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import type { CompanyStrategy } from '@/lib/types/strategy';
import { StrategySwitcher } from '@/components/os/strategy/StrategySwitcher';
import {
  StrategyAIActionsBar,
  buildDefaultSegments,
  type AIActionSegment,
} from '@/components/os/strategy/StrategyAIActionsBar';
import { HealthSignalsBar } from '@/components/os/strategy/HealthSignalsBar';
import { StrategyFrameDisplay } from '@/components/os/strategy/StrategyFrameDisplay';
import { PriorityCard } from '@/components/os/strategy/PriorityCard';
import { HydrationDebugPanel } from '@/components/os/strategy/HydrationDebugPanel';
import { useStrategyViewModel } from '@/hooks/useStrategyViewModel';
import type { FieldDraft } from '@/components/os/ai/FieldAIActions';
import {
  normalizeObjectives,
  generateObjectiveId,
  generatePlayId,
  generateStrategyItemId,
} from '@/lib/types/strategy';
import type {
  StrategyObjectiveV6,
  StrategyPriorityV6,
  StrategyTacticV6,
  StrategyProposal,
  StrategyHealthSignals,
  GroupedProposals,
} from '@/lib/types/strategyBidirectional';
import {
  calculateHealthSignals,
  groupProposalsByLayer,
  toObjectiveV6,
  toPriorityV6,
  toTacticV6,
  lockItem,
  unlockItem,
} from '@/lib/types/strategyBidirectional';
import { ObjectivesPanel } from '@/components/os/strategy/ObjectivesPanel';
import { TacticsPanel } from '@/components/os/strategy/TacticsPanel';
import {
  ProposalGroup,
  ProposalEmptyState,
  HealthSignalWarning,
} from '@/components/os/strategy/ProposalCard';
import {
  StrategyStatusBanner,
  type StalenessIndicators,
} from '@/components/strategy/StalenessBanner';
import { HandoffButton } from '@/components/strategy/HandoffButton';
import { ProgramsSummaryCard } from '@/components/os/strategy/ProgramsSummaryCard';

// ============================================================================
// Types
// ============================================================================

interface StrategyWorkspaceV5ClientProps {
  companyId: string;
  strategy: CompanyStrategy;
  onUpdateStrategy?: (updates: Partial<CompanyStrategy>) => Promise<void>;
  onStrategyChange?: (strategyId: string) => void;
  contextAvailable?: boolean;
  contextLastUpdated?: string | null;
  competitionAvailable?: boolean;
  competitionLastUpdated?: string | null;
}

// ============================================================================
// Health Score Badge
// ============================================================================

function HealthScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
    score >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
    'bg-red-500/10 text-red-400 border-red-500/30';

  const Icon = score >= 80 ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{score}% aligned</span>
    </div>
  );
}

// ============================================================================
// Proposals Panel
// ============================================================================

interface ProposalsPanelProps {
  proposals: GroupedProposals;
  onApply: (proposal: StrategyProposal) => void;
  onEdit: (proposal: StrategyProposal) => void;
  onDiscard: (proposal: StrategyProposal) => void;
  onUnlockRequest: (proposal: StrategyProposal) => void;
  onClose: () => void;
  applyingId?: string;
}

function ProposalsPanel({
  proposals,
  onApply,
  onEdit,
  onDiscard,
  onUnlockRequest,
  onClose,
  applyingId,
}: ProposalsPanelProps) {
  const totalCount =
    proposals.objectives.length +
    proposals.strategy.length +
    proposals.tactics.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">AI Proposals</h2>
          <span className="text-xs text-slate-400">({totalCount})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Proposals List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <ProposalGroup
          title="Objectives"
          icon={<Target className="w-4 h-4 text-purple-400" />}
          proposals={proposals.objectives}
          onApply={onApply}
          onEdit={onEdit}
          onDiscard={onDiscard}
          onUnlockRequest={onUnlockRequest}
          applyingId={applyingId}
        />

        <ProposalGroup
          title="Strategy"
          icon={<Layers className="w-4 h-4 text-blue-400" />}
          proposals={proposals.strategy}
          onApply={onApply}
          onEdit={onEdit}
          onDiscard={onDiscard}
          onUnlockRequest={onUnlockRequest}
          applyingId={applyingId}
        />

        <ProposalGroup
          title="Tactics"
          icon={<Zap className="w-4 h-4 text-emerald-400" />}
          proposals={proposals.tactics}
          onApply={onApply}
          onEdit={onEdit}
          onDiscard={onDiscard}
          onUnlockRequest={onUnlockRequest}
          applyingId={applyingId}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyWorkspaceV5Client({
  companyId,
  strategy,
  onUpdateStrategy,
  onStrategyChange,
  contextAvailable = true,
  contextLastUpdated = null,
  competitionAvailable = false,
  competitionLastUpdated = null,
}: StrategyWorkspaceV5ClientProps) {
  // -------------------------------------------------------------------------
  // ViewModel Hook - Single source of truth for Context hydration
  // -------------------------------------------------------------------------

  const {
    data: viewModelData,
    loading: viewModelLoading,
    error: viewModelError,
    refresh: refreshViewModel,
  } = useStrategyViewModel(companyId, strategy.id);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Convert strategy data to V6 format
  const [objectives, setObjectives] = useState<StrategyObjectiveV6[]>(() =>
    normalizeObjectives(strategy.objectives).map(toObjectiveV6)
  );

  const [priorities, setPriorities] = useState<StrategyPriorityV6[]>(() =>
    strategy.pillars.map(p => toPriorityV6(p, []))
  );

  const [tactics, setTactics] = useState<StrategyTacticV6[]>(() =>
    (strategy.plays || []).map(p => toTacticV6(p))
  );

  // AI proposals
  const [proposals, setProposals] = useState<StrategyProposal[]>([]);
  const [showProposals, setShowProposals] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | undefined>();
  const [loadingAction, setLoadingAction] = useState<string | undefined>();

  // Field-level AI drafts (client-side only, no persistence)
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});

  // -------------------------------------------------------------------------
  // Field Draft Handlers
  // -------------------------------------------------------------------------

  const setDraft = useCallback((fieldKey: string, draft: FieldDraft) => {
    setFieldDrafts(prev => ({ ...prev, [fieldKey]: draft }));
  }, []);

  const clearDraft = useCallback((fieldKey: string) => {
    setFieldDrafts(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const applyFieldDraft = useCallback(async (fieldKey: string, value: string) => {
    const [scope, ...pathParts] = fieldKey.split('.');

    if (scope === 'frame') {
      // Write to strategy.strategyFrame as user override using canonical endpoint
      const frameField = pathParts[0];

      try {
        const response = await fetch('/api/os/strategy/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId: strategy.id,
            updates: {
              strategyFrame: { [frameField]: value },
              lastHumanUpdatedAt: new Date().toISOString(),
            },
          }),
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          console.error('Failed to apply frame draft:', errorBody.error || response.statusText);
        }
        // Refresh view model to get updated hydration
        refreshViewModel();
      } catch (err) {
        console.error('Error applying frame draft:', err);
      }
    } else if (scope === 'priority') {
      // Update local state for priority field
      const [indexStr, field] = pathParts;
      const index = parseInt(indexStr, 10);
      setPriorities(prev => {
        const updated = [...prev];
        if (updated[index]) {
          (updated[index] as unknown as Record<string, unknown>)[field] = value;
        }
        return updated;
      });
    } else if (scope === 'tactic') {
      // Update local state for tactic field
      const [indexStr, field] = pathParts;
      const index = parseInt(indexStr, 10);
      setTactics(prev => {
        const updated = [...prev];
        if (updated[index]) {
          (updated[index] as unknown as Record<string, unknown>)[field] = value;
        }
        return updated;
      });
    } else if (scope === 'objective') {
      // Update local state for objective field
      const [indexStr, field] = pathParts;
      const index = parseInt(indexStr, 10);
      setObjectives(prev => {
        const updated = [...prev];
        if (updated[index]) {
          (updated[index] as unknown as Record<string, unknown>)[field] = value;
        }
        return updated;
      });
    }

    // Clear the draft
    clearDraft(fieldKey);
  }, [strategy, companyId, refreshViewModel, clearDraft]);

  // Build context payload for AI requests
  const buildContextPayload = useCallback(() => ({
    objectives,
    priorities,
    tactics,
    frame: viewModelData?.hydratedFrame,
  }), [objectives, priorities, tactics, viewModelData?.hydratedFrame]);

  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------

  const healthSignals = useMemo(
    () => calculateHealthSignals(objectives, priorities, tactics),
    [objectives, priorities, tactics]
  );

  const groupedProposals = useMemo(
    () => groupProposalsByLayer(proposals),
    [proposals]
  );

  // -------------------------------------------------------------------------
  // Save to Strategy
  // -------------------------------------------------------------------------

  const saveChanges = useCallback(async () => {
    // Convert back to strategy format
    const updates = {
      objectives: objectives.map(o => ({
        id: o.id,
        text: o.text,
        metric: o.metric,
        target: o.target,
        timeframe: o.timeframe,
      })),
      pillars: priorities.map(p => ({
        ...p,
        // Don't include V6-specific fields in base type
      })),
      plays: tactics.map(t => ({
        ...t,
        impact: t.expectedImpact,
        effort: (t.effortSize === 's' ? 'low' : t.effortSize === 'l' ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      })),
    };

    if (onUpdateStrategy) {
      await onUpdateStrategy(updates);
    } else {
      // Call API directly
      const response = await fetch(`/api/os/companies/${companyId}/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, updates }),
      });
      if (!response.ok) {
        throw new Error('Failed to save strategy');
      }
    }
  }, [objectives, priorities, tactics, onUpdateStrategy, companyId, strategy.id]);

  // -------------------------------------------------------------------------
  // Objectives Handlers
  // -------------------------------------------------------------------------

  const handleUpdateObjective = useCallback((updated: StrategyObjectiveV6) => {
    setObjectives(prev => prev.map(o => o.id === updated.id ? updated : o));
  }, []);

  const handleAddObjective = useCallback((objective: StrategyObjectiveV6) => {
    setObjectives(prev => [...prev, objective]);
  }, []);

  const handleRemoveObjective = useCallback((id: string) => {
    setObjectives(prev => prev.filter(o => o.id !== id));
  }, []);

  const handleLockObjective = useCallback((id: string) => {
    setObjectives(prev => prev.map(o =>
      o.id === id ? lockItem(o) : o
    ));
  }, []);

  const handleUnlockObjective = useCallback((id: string) => {
    setObjectives(prev => prev.map(o =>
      o.id === id ? unlockItem(o) : o
    ));
  }, []);

  // -------------------------------------------------------------------------
  // Priority Handlers
  // -------------------------------------------------------------------------

  const handleUpdatePriority = useCallback((updated: StrategyPriorityV6) => {
    setPriorities(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const handleAddPriority = useCallback((priority: StrategyPriorityV6) => {
    setPriorities(prev => [...prev, priority]);
  }, []);

  const handleRemovePriority = useCallback((id: string) => {
    setPriorities(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleLockPriority = useCallback((id: string) => {
    setPriorities(prev => prev.map(p =>
      p.id === id ? lockItem(p) : p
    ));
  }, []);

  const handleUnlockPriority = useCallback((id: string) => {
    setPriorities(prev => prev.map(p =>
      p.id === id ? unlockItem(p) : p
    ));
  }, []);

  // -------------------------------------------------------------------------
  // Tactics Handlers
  // -------------------------------------------------------------------------

  const handleUpdateTactic = useCallback((updated: StrategyTacticV6) => {
    setTactics(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const handleAddTactic = useCallback((tactic: StrategyTacticV6) => {
    setTactics(prev => [...prev, tactic]);
  }, []);

  const handleRemoveTactic = useCallback((id: string) => {
    setTactics(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleLockTactic = useCallback((id: string) => {
    setTactics(prev => prev.map(t =>
      t.id === id ? lockItem(t) : t
    ));
  }, []);

  const handleUnlockTactic = useCallback((id: string) => {
    setTactics(prev => prev.map(t =>
      t.id === id ? unlockItem(t) : t
    ));
  }, []);

  // State for tactic promotion
  const [promotingTacticIds, setPromotingTacticIds] = useState<string[]>([]);
  const [promotionLoading, setPromotionLoading] = useState(false);

  // Ref for scrolling to ProgramsSummaryCard
  const programsCardRef = React.useRef<HTMLDivElement>(null);

  const handlePromoteTactic = useCallback(async (tacticId: string) => {
    // Find the tactic
    const tactic = tactics.find(t => t.id === tacticId);
    if (!tactic) return;

    console.log('[StrategyWorkspaceV5Client] Promoting tactic:', tactic.title);

    // Start promotion flow for this single tactic
    setPromotingTacticIds([tacticId]);
    setPromotionLoading(true);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/programs/from-strategy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId: strategy.id,
            tacticIds: [tacticId],
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to generate program');
      }

      const data = await response.json();
      console.log('[StrategyWorkspaceV5Client] Generated draft from tactic:', data);

      // Scroll to ProgramsSummaryCard to show the draft
      if (programsCardRef.current) {
        programsCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Force re-render of ProgramsSummaryCard by updating a key
      // The card will fetch the new draft on mount
      setPromotingTacticIds([]);
    } catch (err) {
      console.error('[StrategyWorkspaceV5Client] Promotion error:', err);
      alert(`Failed to promote tactic: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPromotionLoading(false);
    }
  }, [tactics, companyId, strategy.id]);

  // -------------------------------------------------------------------------
  // AI Proposal Handlers
  // -------------------------------------------------------------------------

  const fetchProposals = useCallback(async (direction: string) => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/os/strategy/ai-propose-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          strategyId: strategy.id,
          analyzeDirection: direction,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch proposals');

      const data = await response.json();
      setProposals(data.proposals || []);
      setShowProposals(true);
    } catch (error) {
      console.error('AI proposal error:', error);
    } finally {
      setAiLoading(false);
    }
  }, [companyId, strategy.id]);

  const handleAiImproveObjectives = useCallback(() => {
    fetchProposals('strategy_to_objectives');
  }, [fetchProposals]);

  const handleAiSuggestMissingObjectives = useCallback(() => {
    fetchProposals('tactics_to_objectives');
  }, [fetchProposals]);

  const handleAiProposeTactics = useCallback(() => {
    fetchProposals('strategy_to_tactics');
  }, [fetchProposals]);

  const handleAiReviewFit = useCallback(() => {
    fetchProposals('full_alignment');
  }, [fetchProposals]);

  const handleAiSuggestStrategyUpdates = useCallback(() => {
    fetchProposals('tactics_to_strategy');
  }, [fetchProposals]);

  const handleAiAlignStrategy = useCallback(() => {
    fetchProposals('objectives_to_strategy');
  }, [fetchProposals]);

  // -------------------------------------------------------------------------
  // Proposal Actions
  // -------------------------------------------------------------------------

  const handleApplyProposal = useCallback(async (proposal: StrategyProposal) => {
    setApplyingId(proposal.id);

    try {
      // Apply the proposal based on type
      if (proposal.type === 'objective') {
        const changes = proposal.proposedChange as Partial<StrategyObjectiveV6>;
        if (proposal.action === 'add') {
          const newObj: StrategyObjectiveV6 = {
            id: generateObjectiveId(),
            text: changes.text || 'New Objective',
            description: changes.description,
            metric: changes.metric,
            target: changes.target,
            successMetric: changes.successMetric,
            status: changes.status,
          };
          setObjectives(prev => [...prev, newObj]);
        } else if (proposal.action === 'modify' && proposal.targetId) {
          setObjectives(prev => prev.map(o =>
            o.id === proposal.targetId
              ? {
                  ...o,
                  text: changes.text ?? o.text,
                  description: changes.description ?? o.description,
                  metric: changes.metric ?? o.metric,
                  target: changes.target ?? o.target,
                  successMetric: changes.successMetric ?? o.successMetric,
                }
              : o
          ));
        } else if (proposal.action === 'remove' && proposal.targetId) {
          setObjectives(prev => prev.filter(o => o.id !== proposal.targetId));
        }
      } else if (proposal.type === 'strategy') {
        const changes = proposal.proposedChange as Partial<StrategyPriorityV6>;
        if (proposal.action === 'add') {
          const newPriority: StrategyPriorityV6 = {
            id: generateStrategyItemId(),
            title: changes.title || 'New Priority',
            description: changes.description || '',
            priority: changes.priority || 'medium',
            objectiveIds: changes.objectiveIds || [],
            rationale: changes.rationale,
            kpis: changes.kpis,
          };
          setPriorities(prev => [...prev, newPriority]);
        } else if (proposal.action === 'modify' && proposal.targetId) {
          setPriorities(prev => prev.map(p =>
            p.id === proposal.targetId
              ? {
                  ...p,
                  title: changes.title ?? p.title,
                  description: changes.description ?? p.description,
                  priority: changes.priority ?? p.priority,
                  objectiveIds: changes.objectiveIds ?? p.objectiveIds,
                  rationale: changes.rationale ?? p.rationale,
                }
              : p
          ));
        } else if (proposal.action === 'remove' && proposal.targetId) {
          setPriorities(prev => prev.filter(p => p.id !== proposal.targetId));
        }
      } else if (proposal.type === 'tactic') {
        const changes = proposal.proposedChange as Partial<StrategyTacticV6>;
        if (proposal.action === 'add') {
          const newTactic: StrategyTacticV6 = {
            id: generatePlayId(),
            title: changes.title || 'New Tactic',
            description: changes.description,
            objectiveIds: changes.objectiveIds || [],
            priorityIds: changes.priorityIds || [],
            expectedImpact: changes.expectedImpact || 'medium',
            effortSize: changes.effortSize,
            status: changes.status || 'proposed',
          };
          setTactics(prev => [...prev, newTactic]);
        } else if (proposal.action === 'modify' && proposal.targetId) {
          setTactics(prev => prev.map(t =>
            t.id === proposal.targetId
              ? {
                  ...t,
                  title: changes.title ?? t.title,
                  description: changes.description ?? t.description,
                  objectiveIds: changes.objectiveIds ?? t.objectiveIds,
                  priorityIds: changes.priorityIds ?? t.priorityIds,
                  expectedImpact: changes.expectedImpact ?? t.expectedImpact,
                  effortSize: changes.effortSize ?? t.effortSize,
                }
              : t
          ));
        } else if (proposal.action === 'remove' && proposal.targetId) {
          setTactics(prev => prev.filter(t => t.id !== proposal.targetId));
        }
      }

      // Remove from proposals
      setProposals(prev => prev.filter(p => p.id !== proposal.id));
    } finally {
      setApplyingId(undefined);
    }
  }, []);

  const handleEditProposal = useCallback((proposal: StrategyProposal) => {
    // TODO: Open edit modal for proposal
    console.log('Edit proposal:', proposal);
  }, []);

  const handleDiscardProposal = useCallback((proposal: StrategyProposal) => {
    setProposals(prev => prev.filter(p => p.id !== proposal.id));
  }, []);

  const handleUnlockRequest = useCallback((proposal: StrategyProposal) => {
    // Unlock the target item
    if (proposal.targetId) {
      if (proposal.type === 'objective') {
        handleUnlockObjective(proposal.targetId);
      } else if (proposal.type === 'strategy') {
        handleUnlockPriority(proposal.targetId);
      } else if (proposal.type === 'tactic') {
        handleUnlockTactic(proposal.targetId);
      }
    }
  }, [handleUnlockObjective, handleUnlockPriority, handleUnlockTactic]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          {/* Strategy Switcher */}
          <StrategySwitcher
            companyId={companyId}
            activeStrategyId={strategy.id}
            onStrategyChange={(id) => onStrategyChange?.(id)}
          />

          <div>
            <h1 className="text-lg font-semibold text-white">{strategy.title}</h1>
            <p className="text-sm text-slate-400 line-clamp-1">{strategy.summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HealthScoreBadge score={healthSignals.overallHealth} />

          {/* NOTE: Removed "AI Analyze" button - all AI actions are in StrategyAIActionsBar */}

          {/* Handoff Button - Generate Programs & Work from Strategy */}
          <HandoffButton
            companyId={companyId}
            strategyId={strategy.id}
            strategyTitle={strategy.title}
            disabled={tactics.length === 0}
          />

          <button
            onClick={saveChanges}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* AI Actions Bar - SINGLE location for all AI actions */}
      <div className="p-4 border-b border-slate-700 bg-slate-900/50">
        <StrategyAIActionsBar
          segments={buildDefaultSegments({
            hasStrategy: priorities.length > 0,
            objectiveCount: objectives.length,
            priorityCount: priorities.length,
            tacticCount: tactics.length,
            // Use viewModelData for context availability (canonical source)
            contextAvailable: viewModelData?.contextStatus.loaded ?? contextAvailable,
            contextLastUpdated: viewModelData?.contextStatus.updatedAt ?? contextLastUpdated,
            competitionAvailable,
            competitionLastUpdated,
            websiteLabAvailable: false,
            websiteLabLastUpdated: null,
            loadingAction: loadingAction,
          })}
          onAction={(segment, actionId) => {
            // Set loading state for specific action
            setLoadingAction(actionId);

            // Map action IDs to fetch directions
            const actionMap: Record<string, string> = {
              suggest_objectives: 'tactics_to_objectives',
              improve_objectives: 'strategy_to_objectives',
              propose_strategy: 'objectives_to_strategy',
              improve_strategy: 'objectives_to_strategy',
              explain_tradeoffs: 'full_alignment',
              generate_alternatives: 'full_alignment',
              generate_tactics: 'strategy_to_tactics',
              audit_tactics: 'full_alignment',
              rerank_tactics: 'strategy_to_tactics',
            };
            const direction = actionMap[actionId] || 'full_alignment';
            fetchProposals(direction).finally(() => setLoadingAction(undefined));
          }}
        />
      </div>

      {/* Staleness and Draft Banners */}
      {viewModelData && (
        <div className="px-4">
          <StrategyStatusBanner
            staleness={viewModelData.staleness}
            draftCount={viewModelData.drafts?.length || 0}
            onRefreshObjectives={() => fetchProposals('context_to_objectives')}
            onRefreshStrategy={() => fetchProposals('objectives_to_strategy')}
            onRefreshTactics={() => fetchProposals('strategy_to_tactics')}
            onReviewDrafts={() => setShowProposals(true)}
            onDiscardAllDrafts={async () => {
              // Discard all server-side drafts
              if (!viewModelData.drafts?.length) return;
              try {
                await Promise.all(
                  viewModelData.drafts.map(draft =>
                    fetch(
                      `/api/os/companies/${companyId}/strategy/apply-draft?strategyId=${strategy.id}&scopeType=${draft.scopeType}&fieldKey=${draft.fieldKey}${draft.entityId ? `&entityId=${draft.entityId}` : ''}`,
                      { method: 'DELETE' }
                    )
                  )
                );
                refreshViewModel();
              } catch (err) {
                console.error('Failed to discard drafts:', err);
              }
            }}
          />
        </div>
      )}

      {/* Health Warnings */}
      {healthSignals.overallHealth < 80 && (
        <div className="p-4 bg-slate-900/50 border-b border-slate-700 space-y-2">
          {healthSignals.unsupportedObjectives.length > 0 && (
            <HealthSignalWarning
              signal="warning"
              message={`${healthSignals.unsupportedObjectives.length} objective(s) have no strategy support`}
              items={healthSignals.unsupportedObjectives.map(id =>
                objectives.find(o => o.id === id)?.text || id
              )}
              onAction={handleAiAlignStrategy}
              actionLabel="AI Fix"
            />
          )}
          {healthSignals.unsupportedPriorities.length > 0 && (
            <HealthSignalWarning
              signal="warning"
              message={`${healthSignals.unsupportedPriorities.length} priority(ies) have no tactical support`}
              items={healthSignals.unsupportedPriorities.map(id =>
                priorities.find(p => p.id === id)?.title || id
              )}
              onAction={handleAiProposeTactics}
              actionLabel="AI Fix"
            />
          )}
          {healthSignals.orphanedTactics.length > 0 && (
            <HealthSignalWarning
              signal="error"
              message={`${healthSignals.orphanedTactics.length} tactic(s) are not linked to any objective`}
              items={healthSignals.orphanedTactics.map(id =>
                tactics.find(t => t.id === id)?.title || id
              )}
            />
          )}
        </div>
      )}

      {/* Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Strategy Frame + Objectives */}
        <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto space-y-6">
          {/* Strategy Frame - lives in Strategy, defaults populated from Context */}
          {viewModelLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : viewModelData ? (
            <>
              <StrategyFrameDisplay
                companyId={companyId}
                strategyId={strategy.id}
                hydratedFrame={viewModelData.hydratedFrame}
                frameSummary={viewModelData.frameSummary}
                fieldDrafts={fieldDrafts}
                onDraftReceived={(draft) => setDraft(draft.fieldKey, draft)}
                onApplyDraft={applyFieldDraft}
                onDiscardDraft={clearDraft}
                contextPayload={buildContextPayload()}
                onFieldSaved={() => {
                  console.log('[StrategyWorkspaceV5Client] onFieldSaved triggered, calling refreshViewModel...');
                  refreshViewModel().then(() => {
                    console.log('[StrategyWorkspaceV5Client] refreshViewModel completed');
                  });
                }}
              />

              {/* Hydration Debug Panel (dev only) */}
              <HydrationDebugPanel
                companyId={companyId}
                contextStatus={viewModelData.contextStatus}
                mappingReport={viewModelData.mappingReport}
              />
            </>
          ) : viewModelError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Failed to load Strategy Frame</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{viewModelError}</p>
            </div>
          ) : null}

          {/* Objectives Panel - AI buttons removed, use AI Actions Bar */}
          <ObjectivesPanel
            objectives={objectives}
            priorities={priorities}
            tactics={tactics}
            onUpdateObjective={handleUpdateObjective}
            onAddObjective={handleAddObjective}
            onRemoveObjective={handleRemoveObjective}
            onLockObjective={handleLockObjective}
            onUnlockObjective={handleUnlockObjective}
            aiLoading={aiLoading}
          />
        </div>

        {/* CENTER: Strategy Core */}
        <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto">
          {/* NOTE: AI buttons removed - all AI actions are in StrategyAIActionsBar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded">
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">Strategic Bets</h2>
              <span className="text-xs text-slate-400">({priorities.length})</span>
              {/* Dev-only: Priorities source indicator */}
              {process.env.NODE_ENV === 'development' && viewModelData?.meta?.prioritiesSource && (
                <span className="text-xs text-slate-500 font-mono">
                  [{viewModelData.meta.prioritiesSource}]
                </span>
              )}
            </div>
          </div>

          {/* Priorities List */}
          <div className="space-y-3">
            {priorities.map((priority, index) => (
              <PriorityCard
                key={priority.id}
                priority={priority}
                index={index}
                companyId={companyId}
                strategyId={strategy.id}
                hasNoCoverage={healthSignals.unsupportedPriorities.includes(priority.id)}
                drafts={{
                  title: fieldDrafts[`priority.${index}.title`],
                  description: fieldDrafts[`priority.${index}.description`],
                  rationale: fieldDrafts[`priority.${index}.rationale`],
                }}
                onDraftReceived={(draft) => setDraft(draft.fieldKey, draft)}
                onApplyDraft={applyFieldDraft}
                onDiscardDraft={clearDraft}
                contextPayload={buildContextPayload()}
              />
            ))}

            {priorities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-slate-800/50 rounded-full mb-3">
                  <Layers className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 mb-2">No priorities defined</p>
                <button
                  onClick={handleAiAlignStrategy}
                  disabled={aiLoading}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  AI Generate Priorities
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Tactics */}
        <div className="w-1/3 p-4 overflow-y-auto">
          {/* NOTE: AI buttons removed - all AI actions are in StrategyAIActionsBar */}
          <TacticsPanel
            tactics={tactics}
            priorities={priorities}
            objectives={objectives}
            onUpdateTactic={handleUpdateTactic}
            onAddTactic={handleAddTactic}
            onRemoveTactic={handleRemoveTactic}
            onLockTactic={handleLockTactic}
            onUnlockTactic={handleUnlockTactic}
            onPromoteTactic={handlePromoteTactic}
            companyId={companyId}
            strategyId={strategy.id}
            fieldDrafts={fieldDrafts}
            onDraftReceived={(draft) => setDraft(draft.fieldKey, draft)}
            onApplyDraft={applyFieldDraft}
            onDiscardDraft={clearDraft}
            contextPayload={buildContextPayload()}
          />

          {/* Programs Summary - promote tactics to programs */}
          <div ref={programsCardRef}>
            <ProgramsSummaryCard
              key={promotingTacticIds.join(',') || 'default'}
              companyId={companyId}
              strategyId={strategy.id}
              tacticIds={tactics.map(t => t.id)}
            />
          </div>
        </div>
      </div>

      {/* Proposals Panel (Slide-in) */}
      {showProposals && (
        <ProposalsPanel
          proposals={groupedProposals}
          onApply={handleApplyProposal}
          onEdit={handleEditProposal}
          onDiscard={handleDiscardProposal}
          onUnlockRequest={handleUnlockRequest}
          onClose={() => setShowProposals(false)}
          applyingId={applyingId}
        />
      )}
    </div>
  );
}

export default StrategyWorkspaceV5Client;
