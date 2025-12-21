'use client';

// components/os/strategy/StrategySurface.tsx
// Strategy Surface - 2-Page Model with AI Everywhere
//
// REPLACES: Builder + Command + Orchestration + Blueprint (4 views)
// NOW HAS: Workspace + Blueprint (2 views)
//
// Workspace: Single editing surface (Frame + Objectives + Bets + Tactics)
// Blueprint: Read-only narrative (accepted bets only)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  FileText,
  Scale,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  useUnifiedStrategyViewModel,
} from '@/hooks/useUnifiedStrategyViewModel';
import { StrategySwitcher } from './StrategySwitcher';
import { StrategyStatusBanner } from '@/components/strategy/StalenessBanner';
import { useContextV4Health } from '@/hooks/useContextV4Health';
import {
  ContextV4HealthGate,
  ContextV4HealthReadyIndicator,
} from '@/components/context-v4/ContextV4HealthGate';
import {
  FlowReadinessInlineWarningMulti,
} from '@/components/context-v4/FlowReadinessBanner';
import {
  resolveFlowReadiness,
  contextV4HealthToSignal,
  strategyPresenceToSignal,
} from '@/lib/flowReadiness';
import type { FlowReadinessResolved } from '@/lib/types/flowReadiness';

// Views
import { StrategyWorkspace } from './StrategyWorkspace';
import { StrategySurfaceBlueprint } from './views/StrategySurfaceBlueprint';

// Types
import type {
  StrategyObjective,
  StrategicBet,
  Tactic,
  StrategyFrame,
} from '@/lib/types/strategy';
import {
  pillarToStrategicBet,
  playToTactic,
  normalizeFrame,
  normalizeObjectives,
} from '@/lib/types/strategy';
import type { FieldAIAction, ApplyMode } from './FieldAIHelper';
import type { GenerateMode } from './ColumnAIGenerateButton';
import {
  computeFrameCompleteness,
  computeContextReadiness,
  getFrameStatusChip,
  getContextStatusChip,
  type FrameCompleteness,
  type ContextReadiness,
} from '@/lib/os/strategy/frameValidation';

// ============================================================================
// Types
// ============================================================================

type StrategyViewMode = 'workspace' | 'blueprint';

interface StrategySurfaceProps {
  companyId: string;
  companyName: string;
  initialView?: StrategyViewMode;
}

const STORAGE_KEY = 'hive-strategy-view-v2';

const VIEW_CONFIG: Record<StrategyViewMode, {
  icon: React.ElementType;
  label: string;
  description: string;
}> = {
  workspace: {
    icon: Pencil,
    label: 'Workspace',
    description: 'Edit strategy',
  },
  blueprint: {
    icon: FileText,
    label: 'Blueprint',
    description: 'Read-only summary',
  },
};

// ============================================================================
// View Tabs Component
// ============================================================================

interface ViewTabsProps {
  currentView: StrategyViewMode;
  onViewChange: (view: StrategyViewMode) => void;
}

function ViewTabs({ currentView, onViewChange }: ViewTabsProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
      {(Object.keys(VIEW_CONFIG) as StrategyViewMode[]).map((view) => {
        const { icon: Icon, label, description } = VIEW_CONFIG[view];
        const isActive = view === currentView;

        return (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors
              ${isActive
                ? 'text-white bg-purple-600'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }
            `}
            title={description}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Validation Chips (Frame Completeness + Context Readiness)
// ============================================================================

interface ValidationChipsProps {
  frame: FrameCompleteness;
  context: ContextReadiness;
}

function ValidationChips({ frame, context }: ValidationChipsProps) {
  const frameChip = getFrameStatusChip(frame);
  const contextChip = getContextStatusChip(context);

  const frameColorClasses = {
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  const contextColorClasses = {
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Frame Completeness Chip (Hard Requirement) */}
      <span
        className={`text-xs px-2 py-1 rounded border ${frameColorClasses[frameChip.color]}`}
        title={frameChip.tooltip}
      >
        {!frame.isComplete && (
          <span className="mr-1">
            {frameChip.color === 'red' ? '🔴' : ''}
          </span>
        )}
        {frameChip.label}
      </span>

      {/* Context Readiness Chip (Soft Signal) */}
      <span
        className={`text-xs px-2 py-1 rounded border ${contextColorClasses[contextChip.color]}`}
        title={contextChip.tooltip}
      >
        {!context.isReady && context.percent < 50 && (
          <span className="mr-1">🟡</span>
        )}
        {contextChip.label}
      </span>
    </div>
  );
}

// ============================================================================
// Inputs Used Indicator
// ============================================================================

interface InputsUsedIndicatorProps {
  inputs: {
    context: boolean;
    websiteLab: boolean;
    strategy: boolean;
  };
}

function InputsUsedIndicator({ inputs }: InputsUsedIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span>Inputs:</span>
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
          inputs.context
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'
        }`}
        title={inputs.context ? 'Context V4 data available' : 'No Context V4 data'}
      >
        {inputs.context ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        Context
      </span>
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
          inputs.websiteLab
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'
        }`}
        title={inputs.websiteLab ? 'WebsiteLab run completed' : 'No WebsiteLab run'}
      >
        {inputs.websiteLab ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        WebsiteLab
      </span>
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
          inputs.strategy
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'
        }`}
        title={inputs.strategy ? 'Existing strategy data' : 'No existing strategy'}
      >
        {inputs.strategy ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        Strategy
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySurface({
  companyId,
  companyName,
  initialView = 'workspace',
}: StrategySurfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentView, setCurrentView] = useState<StrategyViewMode>(initialView);
  const [isGenerating, setIsGenerating] = useState(false);

  // Read strategyId from URL if provided (for project engagement redirects)
  const urlStrategyId = searchParams.get('strategyId');

  // Use unified view model hook with optional strategyId from URL
  const {
    data,
    helpers,
    loading,
    error,
    refresh,
    setStrategyId,
    applyDraft,
    discardDraft,
    proposeObjectives,
    proposeStrategy,
    proposeTactics,
    isProposing,
  } = useUnifiedStrategyViewModel(companyId, urlStrategyId);

  // Local state for editable data (will be synced with server)
  const [localFrame, setLocalFrame] = useState<StrategyFrame>({});
  const [localObjectives, setLocalObjectives] = useState<StrategyObjective[]>([]);
  const [localBets, setLocalBets] = useState<StrategicBet[]>([]);
  const [localTactics, setLocalTactics] = useState<Tactic[]>([]);

  // Context V4 Health (using unified hook)
  const {
    health: v4Health,
    refresh: refreshV4Health,
  } = useContextV4Health(companyId);

  // Sync local state from server data
  useEffect(() => {
    if (data?.strategy) {
      // Normalize frame
      const frame = normalizeFrame(data.hydratedFrame ? {
        audience: data.hydratedFrame.audience?.value,
        valueProp: data.hydratedFrame.valueProp?.value,
        positioning: data.hydratedFrame.positioning?.value,
        constraints: data.hydratedFrame.constraints?.value,
        offering: data.hydratedFrame.offering?.value,
      } : {});
      setLocalFrame(frame);

      // Normalize objectives
      const objectives = normalizeObjectives(data.strategy.objectives);
      setLocalObjectives(objectives);

      // Convert pillars to bets
      const bets = data.strategy.pillars.map(pillarToStrategicBet);
      setLocalBets(bets);

      // Convert plays to tactics
      const tactics = (data.strategy.plays || []).map(play => playToTactic(play));
      setLocalTactics(tactics);
    }
  }, [data]);

  // Compute Frame Completeness (Hard Requirement - blocks AI)
  const frameCompleteness = useMemo(() => computeFrameCompleteness(localFrame), [localFrame]);

  // Compute Context Readiness (Soft Signal - never blocks)
  // Note: Context data would come from the view model if available
  // For now, we compute from available data in the readiness object
  const contextReadiness = useMemo(() => {
    // Extract context data from view model if available
    const contextData = data?.readiness ? {
      competitors: data.readiness.missingCritical?.some(c => c.id === 'competitors') ? [] : ['has'],
      budget: data.readiness.missingCritical?.some(c => c.id === 'budget') ? undefined : { min: 1 },
      channels: data.readiness.missingCritical?.some(c => c.id === 'channels') ? [] : ['has'],
      historicalPerformance: data.readiness.missingCritical?.some(c => c.id === 'historicalPerformance') ? undefined : true,
    } : undefined;
    return computeContextReadiness(contextData);
  }, [data?.readiness]);

  // Sync view from URL or handle legacy routes
  useEffect(() => {
    const urlView = searchParams.get('view');

    // Handle legacy view redirects
    if (urlView === 'builder' || urlView === 'command' || urlView === 'orchestration') {
      setCurrentView('workspace');
      router.replace(`/c/${companyId}/strategy?view=workspace`);
      return;
    }

    if (urlView === 'workspace' || urlView === 'blueprint') {
      setCurrentView(urlView);
    } else {
      // Try localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as StrategyViewMode | null;
        if (stored === 'workspace' || stored === 'blueprint') {
          setCurrentView(stored);
        }
      } catch {
        // localStorage not available
      }
    }
  }, [searchParams, router, companyId]);

  // Handle view change
  const handleViewChange = useCallback((view: StrategyViewMode) => {
    setCurrentView(view);

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // localStorage not available
    }

    // Update URL
    router.push(`/c/${companyId}/strategy?view=${view}`);
  }, [router, companyId]);

  // Handle strategy change
  const handleStrategyChange = useCallback((strategyId: string | null) => {
    setStrategyId(strategyId);
  }, [setStrategyId]);

  // Frame update handler
  const handleFrameUpdate = useCallback((updates: Partial<StrategyFrame>) => {
    setLocalFrame(prev => ({ ...prev, ...updates }));
    // TODO: Debounce and sync to server
  }, []);

  // Objectives update handler
  const handleObjectivesUpdate = useCallback((objectives: StrategyObjective[]) => {
    setLocalObjectives(objectives);
    // TODO: Sync to server
  }, []);

  // Bets update handler
  const handleBetsUpdate = useCallback((bets: StrategicBet[]) => {
    setLocalBets(bets);
    // TODO: Sync to server
  }, []);

  // Tactics update handler
  const handleTacticsUpdate = useCallback((tactics: Tactic[]) => {
    setLocalTactics(tactics);
    // TODO: Sync to server
  }, []);

  // AI Generate handler
  const handleAIGenerate = useCallback(async (
    type: 'objectives' | 'bets' | 'tactics',
    mode: GenerateMode,
    guidance?: string
  ) => {
    setIsGenerating(true);
    try {
      // Call the appropriate AI generation
      if (type === 'objectives') {
        await proposeObjectives?.();
      } else if (type === 'bets') {
        await proposeStrategy?.();
      } else if (type === 'tactics') {
        await proposeTactics?.();
      }
      // Results will be in drafts, handled by the view model
      await refresh();
    } catch (error) {
      console.error(`AI ${type} generation failed:`, error);
    } finally {
      setIsGenerating(false);
    }
  }, [proposeObjectives, proposeStrategy, proposeTactics, refresh]);

  // AI Field Action handler - calls the dedicated field AI endpoint
  const handleAIFieldAction = useCallback(async (
    fieldType: string,
    currentValue: string | string[],
    action: FieldAIAction,
    guidance?: string
  ): Promise<{ value: string | string[] | { variants: string[] }; inputsUsed?: Record<string, boolean> }> => {
    try {
      const response = await fetch('/api/os/strategy/ai-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          strategyId: data?.strategy?.id,
          fieldType,
          currentValue,
          action,
          guidance,
        }),
      });

      if (!response.ok) {
        throw new Error('AI field action failed');
      }

      const result = await response.json();
      return {
        value: result.value || currentValue,
        inputsUsed: result.inputsUsed || { Frame: true, Objectives: true },
      };
    } catch (error) {
      console.error('AI field action failed:', error);
      return { value: currentValue };
    }
  }, [companyId, data?.strategy?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
          <p className="text-slate-400">Loading strategy workspace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-300 mb-2">
              Failed to Load Strategy Workspace
            </h2>
            <p className="text-red-200/80 mb-4">{error}</p>
            <button
              onClick={() => refresh()}
              className="px-4 py-2 bg-red-800/50 hover:bg-red-700/50 text-red-200 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !helpers) return null;

  // No strategy exists - show creation prompt with health gate
  if (!data.strategy.id) {
    const showHealthGate = v4Health && v4Health.status !== 'GREEN';

    return (
      <div className="space-y-4">
        {/* Header with Strategy Switcher for creation */}
        <div className="flex items-center justify-end">
          <StrategySwitcher
            companyId={companyId}
            activeStrategyId={undefined}
            onStrategyChange={(id) => handleStrategyChange(id)}
          />
        </div>

        {/* Empty state */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            No Strategy Yet
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Create your first strategy to define objectives, strategic bets, and tactics.
            Click the dropdown above to create a new strategy.
          </p>

          {/* Context V4 Health Gate */}
          <div className="flex flex-col items-center">
            {showHealthGate && (
              <ContextV4HealthGate
                health={v4Health}
                companyId={companyId}
                showContinueButton={false}
              />
            )}

            {v4Health?.status === 'GREEN' && (
              <ContextV4HealthReadyIndicator health={v4Health} />
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Strategy is a first-class object. Create one explicitly to get started.
          </p>
        </div>
      </div>
    );
  }

  // Build view props for Blueprint (legacy compatibility)
  const blueprintProps = {
    companyId,
    companyName,
    data,
    helpers,
    refresh,
    applyDraft: async () => false as boolean,
    discardDraft: async () => false as boolean,
    proposeObjectives: proposeObjectives || (async () => {}),
    proposeStrategy: proposeStrategy || (async () => {}),
    proposeTactics: proposeTactics || (async () => {}),
    improveField: async () => {},
    isProposing,
    isApplying: false,
  };

  // Handle Regenerate with latest context
  const handleRegenerateStrategy = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Regenerate all layers: objectives, strategy, tactics
      await proposeObjectives?.();
      await proposeStrategy?.();
      await proposeTactics?.();
      await refresh();
      await refreshV4Health();
    } catch (error) {
      console.error('Strategy regeneration failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [proposeObjectives, proposeStrategy, proposeTactics, refresh, refreshV4Health]);

  // Compute inputs used indicator
  const inputsUsed = useMemo(() => ({
    context: (v4Health?.store.total ?? 0) > 0,
    websiteLab: v4Health?.websiteLab.hasRun ?? false,
    strategy: !!data?.strategy.id && (localObjectives.length > 0 || localBets.length > 0),
  }), [v4Health, data?.strategy.id, localObjectives.length, localBets.length]);

  // ============================================================================
  // Multi-Signal Flow Readiness (Composed)
  // ============================================================================
  // Composes multiple readiness signals into a single resolved status.
  // This proves the multi-signal model works before expanding to other surfaces.
  const composedReadiness: FlowReadinessResolved | null = useMemo(() => {
    // Need at least v4Health to compose
    if (!v4Health) return null;

    const signals = [];

    // Signal 1: Context V4 Health
    signals.push(contextV4HealthToSignal(v4Health));

    // Signal 2: Strategy Presence
    const strategyPresenceInfo = {
      hasStrategy: !!data?.strategy?.id,
      hasObjectives: localObjectives.length > 0,
      hasBets: localBets.length > 0,
      companyId,
    };
    signals.push(strategyPresenceToSignal(strategyPresenceInfo));

    return resolveFlowReadiness(signals);
  }, [v4Health, data?.strategy?.id, localObjectives.length, localBets.length, companyId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">View:</span>
          <ViewTabs currentView={currentView} onViewChange={handleViewChange} />
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-4">
          {/* Inputs Used Indicator */}
          <InputsUsedIndicator inputs={inputsUsed} />

          {/* Regenerate Button */}
          <button
            onClick={handleRegenerateStrategy}
            disabled={isGenerating || isProposing}
            className="px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 bg-purple-900/20 border border-purple-700/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate strategy using latest context and inputs"
          >
            {(isGenerating || isProposing) ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Regenerate with latest context
          </button>

          {/* Strategy Switcher - Always show for explicit strategy creation */}
          <StrategySwitcher
            companyId={companyId}
            activeStrategyId={data.activeStrategyId ?? undefined}
            onStrategyChange={(id) => handleStrategyChange(id)}
          />

          {/* Compare Button */}
          <Link
            href={`/c/${companyId}/strategy/compare`}
            className="px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 bg-slate-800/50"
            title="Compare strategies side-by-side"
          >
            <Scale className="w-3 h-3" />
            Compare
          </Link>

          {/* Validation Chips (Frame Completeness + Context Readiness) */}
          <ValidationChips
            frame={frameCompleteness}
            context={contextReadiness}
          />
        </div>
      </div>

      {/* Multi-Signal Flow Readiness Inline Warning */}
      {/* Uses composed readiness (Context V4 Health + Strategy Presence) */}
      {composedReadiness && composedReadiness.status !== 'GREEN' && (
        <div className="flex items-center gap-2">
          <FlowReadinessInlineWarningMulti readiness={composedReadiness} />
        </div>
      )}

      {/* Staleness/Status Banners */}
      {data.staleness && (
        <StrategyStatusBanner
          staleness={data.staleness}
          onRefreshObjectives={refresh}
          onRefreshStrategy={refresh}
          onRefreshTactics={refresh}
        />
      )}

      {/* View Body */}
      {currentView === 'workspace' && (
        <StrategyWorkspace
          companyId={companyId}
          strategyId={data.strategy.id || ''}
          companyName={companyName}
          frame={localFrame}
          objectives={localObjectives}
          bets={localBets}
          tactics={localTactics}
          drafts={data.drafts}
          draftsRecord={data.draftsRecord}
          onFrameUpdate={handleFrameUpdate}
          onObjectivesUpdate={handleObjectivesUpdate}
          onBetsUpdate={handleBetsUpdate}
          onTacticsUpdate={handleTacticsUpdate}
          onApplyDraft={applyDraft}
          onDiscardDraft={discardDraft}
          onAIGenerate={handleAIGenerate}
          onAIFieldAction={handleAIFieldAction}
          isGenerating={isGenerating || isProposing}
        />
      )}
      {currentView === 'blueprint' && (
        <StrategySurfaceBlueprint {...blueprintProps} />
      )}
    </div>
  );
}

export default StrategySurface;
