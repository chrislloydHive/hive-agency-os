'use client';

// components/os/strategy/StrategySurface.tsx
// Strategy Surface - 2-Page Model with AI Everywhere
//
// REPLACES: Builder + Command + Orchestration + Blueprint (4 views)
// NOW HAS: Workspace + Blueprint (2 views)
//
// Workspace: Single editing surface (Frame + Objectives + Bets + Tactics)
// Blueprint: Read-only narrative (accepted bets only)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Target,
} from 'lucide-react';
import { useGoalStatement, invalidateGoalCache } from '@/hooks/useGoalStatement';
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
  strategicBetToPillar,
  playToTactic,
  tacticToPlay,
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
// Status Indicators (Frame Completeness + Context Readiness + Warnings)
// ============================================================================

interface StatusIndicatorsProps {
  frame: FrameCompleteness;
  context: ContextReadiness;
  warningCount?: number;
}

function StatusIndicators({ frame, context, warningCount = 0 }: StatusIndicatorsProps) {
  const frameChip = getFrameStatusChip(frame);
  const contextChip = getContextStatusChip(context);

  return (
    <div className="flex items-center gap-2">
      {/* Frame Validation - compact, icon + text */}
      {!frame.isComplete && (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-red-400/90"
          title={frameChip.tooltip}
        >
          <XCircle className="w-3 h-3" />
          <span>{frame.missingFields.length} frame field{frame.missingFields.length !== 1 ? 's' : ''} missing</span>
        </span>
      )}

      {/* Context Confirmed - compact, icon + text */}
      {context.isReady ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80"
          title={contextChip.tooltip}
        >
          <CheckCircle className="w-3 h-3" />
          <span>Inputs confirmed</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-slate-400/70"
          title={contextChip.tooltip}
        >
          <AlertCircle className="w-3 h-3" />
          <span>{contextChip.label}</span>
        </span>
      )}

      {/* Warnings - amber, smaller, always last */}
      {warningCount > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/70">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>{warningCount} signal{warningCount !== 1 ? 's' : ''} may affect quality</span>
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Input Chips (Neutral status indicators - subtle icon + tint)
// ============================================================================

interface InputChipsProps {
  inputs: {
    context: boolean;
    websiteLab: boolean;
    strategy: boolean;
  };
  companyId: string;
  strategyId: string | null;
  /** Callback when Goal chip is clicked (for scrolling to editor) */
  onGoalClick?: () => void;
  /** External goalStatement to avoid refetch (for optimistic updates) */
  externalGoalStatement?: string | null;
}

function InputChips({ inputs, companyId, strategyId, onGoalClick, externalGoalStatement }: InputChipsProps) {
  // Fetch goalStatement for this strategy (unless external value provided)
  const { goalStatement: fetchedGoalStatement, loading: goalLoading } = useGoalStatement(companyId, strategyId);
  // Use external value if provided (for optimistic updates), else use fetched
  const goalStatement = externalGoalStatement !== undefined ? externalGoalStatement : fetchedGoalStatement;
  const hasGoal = Boolean(goalStatement && goalStatement.trim());

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
      active
        ? 'text-slate-300 bg-slate-800/60'
        : 'text-slate-500 bg-slate-800/30'
    }`;

  const iconClass = (active: boolean) =>
    `w-3 h-3 ${active ? 'text-emerald-400/70' : 'text-slate-600'}`;

  // Goal chip uses amber for missing (warning) state
  const goalChipClass = hasGoal
    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-300 bg-slate-800/60'
    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20';

  // Truncate goal for tooltip
  const goalTooltip = hasGoal
    ? `Goal: ${goalStatement!.length > 80 ? goalStatement!.slice(0, 80) + '...' : goalStatement}`
    : 'No goal statement defined';

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={chipClass(inputs.context)}
        title={inputs.context ? 'Context V4 data available' : 'No Context V4 data'}
      >
        {inputs.context ? (
          <CheckCircle className={iconClass(true)} />
        ) : (
          <XCircle className={iconClass(false)} />
        )}
        Context
      </span>
      <span
        className={chipClass(inputs.websiteLab)}
        title={inputs.websiteLab ? 'WebsiteLab run completed' : 'No WebsiteLab run'}
      >
        {inputs.websiteLab ? (
          <CheckCircle className={iconClass(true)} />
        ) : (
          <XCircle className={iconClass(false)} />
        )}
        WebsiteLab
      </span>
      <span
        className={chipClass(inputs.strategy)}
        title={inputs.strategy ? 'Existing strategy data' : 'No existing strategy'}
      >
        {inputs.strategy ? (
          <CheckCircle className={iconClass(true)} />
        ) : (
          <XCircle className={iconClass(false)} />
        )}
        Strategy
      </span>
      {/* Goal chip - shows goal status with fetch, clickable when missing */}
      {strategyId && (
        hasGoal ? (
          <span
            className={goalChipClass}
            title={goalTooltip}
          >
            {goalLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
            ) : (
              <Target className="w-3 h-3 text-emerald-400/70" />
            )}
            Goal ✓
          </span>
        ) : (
          <button
            type="button"
            onClick={onGoalClick}
            className={`${goalChipClass} cursor-pointer hover:bg-amber-500/20 transition-colors`}
            title="Click to add goal statement"
          >
            {goalLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
            ) : (
              <Target className="w-3 h-3 text-amber-400/70" />
            )}
            Goal missing
          </button>
        )
      )}
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
    updateStrategy,
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
  // Goal statement for optimistic UI updates
  const [localGoalStatement, setLocalGoalStatement] = useState<string | null>(null);

  // Debounce refs for saves
  const objectivesDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const betsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tacticsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const frameDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for scrolling to goal editor
  const goalEditorRef = useRef<HTMLDivElement>(null);
  // Ref for scrolling to tactics panel
  const tacticsPanelRef = useRef<HTMLDivElement>(null);
  // Focus highlight state
  const [tacticsFocused, setTacticsFocused] = useState(false);

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

      // Sync goal statement
      setLocalGoalStatement(data.strategy.goalStatement || null);
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

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (betsDebounceRef.current) {
        clearTimeout(betsDebounceRef.current);
      }
      if (frameDebounceRef.current) {
        clearTimeout(frameDebounceRef.current);
      }
    };
  }, []);

  // Handle focus=tactics deep-link (scroll + highlight)
  useEffect(() => {
    const focusParam = searchParams.get('focus');
    if (focusParam === 'tactics' && tacticsPanelRef.current && !loading) {
      // Scroll tactics panel into view
      setTimeout(() => {
        tacticsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      // Add temporary highlight
      setTacticsFocused(true);
      const timer = setTimeout(() => setTacticsFocused(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, loading]);

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

  // Goal statement update handler (for optimistic UI)
  const handleGoalStatementChange = useCallback((goalStatement: string) => {
    setLocalGoalStatement(goalStatement);
    // Invalidate cache so useGoalStatement refetches
    if (data?.strategy?.id) {
      invalidateGoalCache(companyId, data.strategy.id);
    }
  }, [companyId, data?.strategy?.id]);

  // Scroll to goal editor (called from InputChips when "Goal missing" is clicked)
  const handleGoalClick = useCallback(() => {
    if (goalEditorRef.current) {
      goalEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the textarea inside if it exists
      const textarea = goalEditorRef.current.querySelector('textarea');
      if (textarea) {
        setTimeout(() => textarea.focus(), 300);
      }
    }
  }, []);

  // Frame update handler - saves to server with debounce
  const handleFrameUpdate = useCallback((updates: Partial<StrategyFrame>) => {
    setLocalFrame(prev => {
      const newFrame = { ...prev, ...updates };

      // Debounce server sync to avoid rapid updates
      if (frameDebounceRef.current) {
        clearTimeout(frameDebounceRef.current);
      }

      frameDebounceRef.current = setTimeout(async () => {
        if (!data?.strategy?.id) return;

        try {
          const response = await fetch(`/api/os/companies/${companyId}/strategy/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'apply_field',
              strategyId: data.strategy.id,
              fieldPath: 'strategyFrame',
              newValue: newFrame,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[StrategySurface] Failed to save frame:', errorData.error || 'Unknown error');
          }
        } catch (error) {
          console.error('[StrategySurface] Error saving frame:', error);
        }
      }, 500); // 500ms debounce

      return newFrame;
    });
  }, [companyId, data?.strategy?.id]);

  // Objectives update handler - saves to server with debounce
  const handleObjectivesUpdate = useCallback((objectives: StrategyObjective[]) => {
    setLocalObjectives(objectives);

    // Debounce server sync
    if (objectivesDebounceRef.current) {
      clearTimeout(objectivesDebounceRef.current);
    }

    objectivesDebounceRef.current = setTimeout(async () => {
      const success = await updateStrategy({ objectives });
      if (!success) {
        console.error('[StrategySurface] Failed to save objectives');
      }
    }, 500);
  }, [updateStrategy]);

  // Bets update handler - saves to server with debounce
  const handleBetsUpdate = useCallback((bets: StrategicBet[]) => {
    setLocalBets(bets);

    // Debounce server sync to avoid rapid updates
    if (betsDebounceRef.current) {
      clearTimeout(betsDebounceRef.current);
    }

    betsDebounceRef.current = setTimeout(async () => {
      // Convert bets back to pillars format for storage
      const pillars = bets.map(strategicBetToPillar);
      const success = await updateStrategy({ pillars });
      if (!success) {
        console.error('[StrategySurface] Failed to save bets');
      }
    }, 500);
  }, [updateStrategy]);

  // Tactics update handler - saves to server with debounce
  const handleTacticsUpdate = useCallback((tactics: Tactic[]) => {
    setLocalTactics(tactics);

    // Debounce server sync
    if (tacticsDebounceRef.current) {
      clearTimeout(tacticsDebounceRef.current);
    }

    tacticsDebounceRef.current = setTimeout(async () => {
      // Convert tactics back to plays format for storage
      const plays = tactics.map(tacticToPlay);
      const success = await updateStrategy({ plays });
      if (!success) {
        console.error('[StrategySurface] Failed to save tactics');
      }
    }, 500);
  }, [updateStrategy]);

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

  // Map frame field keys to contract field keys for contract-driven generation
  const FRAME_TO_CONTRACT_KEY: Record<string, string> = {
    'frame.valueProp': 'valueProp',
    'frame.positioning': 'positioning',
    'frame.audience': 'audience',
  };

  // AI Field Action handler - calls contract-driven endpoint for frame fields
  const handleAIFieldAction = useCallback(async (
    fieldType: string,
    currentValue: string | string[],
    action: FieldAIAction,
    guidance?: string
  ): Promise<{
    value: string | string[] | { variants: string[] };
    inputsUsed?: Record<string, boolean>;
    generatedUsing?: { primary: string[]; constraints: string[]; missingPrimary: string[] };
    debug?: { contractId?: string; confirmedCount?: number };
  }> => {
    try {
      // Check if this is a frame field that uses contract-driven generation
      const contractFieldKey = FRAME_TO_CONTRACT_KEY[fieldType];

      if (contractFieldKey && (action === 'variants' || action === 'suggest')) {
        // Use contract-driven endpoint for frame fields
        // strategyId is required - goalStatement is fetched server-side
        const response = await fetch(`/api/os/companies/${companyId}/strategy/fields/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId: data?.strategy?.id,
            fieldKey: contractFieldKey,
            currentValue: typeof currentValue === 'string' ? currentValue : undefined,
            variants: action === 'variants' ? 3 : 1,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Contract-driven generation failed');
        }

        const result = await response.json();

        // Convert to expected format
        if (result.variants && result.variants.length > 0) {
          return {
            value: { variants: result.variants.map((v: { text: string }) => v.text) },
            generatedUsing: result.generatedUsing,
            debug: result.debug,
          };
        }

        return { value: currentValue };
      }

      // Fall back to legacy endpoint for other fields/actions
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

  // Count warnings from composed readiness for status indicators
  // Must be defined before any early returns to satisfy Rules of Hooks
  const warningCount = useMemo(() => {
    if (!composedReadiness) return 0;
    // Count WARN-severity reasons (not FAIL which are errors)
    return composedReadiness.rankedReasons.filter(r => r.severity === 'WARN').length;
  }, [composedReadiness]);

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

  return (
    <div className="space-y-3">
      {/* ================================================================== */}
      {/* Row 1: Mode/Scope - View toggle, Strategy selector, Compare action */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between">
        {/* Left: View Toggle (Workspace / Blueprint) */}
        <ViewTabs currentView={currentView} onViewChange={handleViewChange} />

        {/* Center: Strategy Scope */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Strategy</span>
          <StrategySwitcher
            companyId={companyId}
            activeStrategyId={data.activeStrategyId ?? undefined}
            onStrategyChange={(id) => handleStrategyChange(id)}
          />
        </div>

        {/* Right: Compare (secondary action) */}
        <Link
          href={`/c/${companyId}/strategy/compare`}
          className="px-2.5 py-1 text-[11px] font-medium rounded flex items-center gap-1.5 transition-colors text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
          title="Compare strategies side-by-side"
        >
          <Scale className="w-3 h-3" />
          Compare
        </Link>
      </div>

      {/* ================================================================== */}
      {/* Row 2: Inputs | Actions | Status */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between py-1.5 px-2 bg-slate-900/40 rounded-lg border border-slate-800/50">
        {/* Left: Input Chips (neutral status) */}
        <InputChips
          inputs={inputsUsed}
          companyId={companyId}
          strategyId={data.activeStrategyId}
          onGoalClick={handleGoalClick}
          externalGoalStatement={localGoalStatement}
        />

        {/* Center: Primary Action */}
        <button
          onClick={handleRegenerateStrategy}
          disabled={isGenerating || isProposing}
          className="px-3 py-1 text-[11px] font-medium rounded flex items-center gap-1.5 transition-colors bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Regenerate strategy using latest context and inputs"
        >
          {(isGenerating || isProposing) ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Regenerate with latest context
        </button>

        {/* Right: Status Indicators (validation + warnings) */}
        <StatusIndicators
          frame={frameCompleteness}
          context={contextReadiness}
          warningCount={warningCount}
        />
      </div>

      {/* Flow Readiness Inline Warning (only if errors, not just warnings) */}
      {composedReadiness && composedReadiness.status === 'RED' && (
        <div className="flex items-center gap-2">
          <FlowReadinessInlineWarningMulti readiness={composedReadiness} />
        </div>
      )}

      {/* Imported Strategy Banner */}
      {data.strategy.origin === 'imported' && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-cyan-300">Imported Strategy</p>
              <p className="text-xs text-slate-400">
                Strategy anchored. Diagnostics optional — run later to enrich context.
              </p>
            </div>
          </div>
          <Link
            href={`/c/${companyId}/deliver`}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Deliver
          </Link>
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
          goalStatement={localGoalStatement || undefined}
          onGoalStatementChange={handleGoalStatementChange}
          goalEditorRef={goalEditorRef}
          tacticsPanelRef={tacticsPanelRef}
          tacticsFocused={tacticsFocused}
          drafts={data.drafts}
          draftsRecord={data.draftsRecord}
          confirmedContextCount={v4Health?.store?.confirmed ?? 0}
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
