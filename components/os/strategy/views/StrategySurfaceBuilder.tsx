'use client';

// ============================================================================
// @DEPRECATED - December 2024
// This component is DEPRECATED. Use StrategyWorkspace.tsx instead.
// Kept for reference only - NOT exported from index.ts
// ============================================================================

// components/os/strategy/views/StrategySurfaceBuilder.tsx
// Builder View - Strategic Foundation
//
// SCREEN RESPONSIBILITY (NON-NEGOTIABLE):
// - Strategic Frame: audience, positioning, value prop, constraints
// - Objectives: with metrics (ONLY place metrics live)
//
// EXPLICITLY EXCLUDED (managed in Command/Orchestration):
// - Strategic Bets
// - Tradeoffs, Pros/Cons
// - Tactics, Programs
// - AI orchestration actions (generate strategy, generate tactics)

import React, { useCallback, useMemo } from 'react';
import {
  Target,
  Users,
  Sparkles,
  Plus,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import type { StrategySurfaceViewProps } from './types';
import type { StrategyDraft } from '@/lib/os/strategy/drafts';
import { StrategyFrameDisplay } from '../StrategyFrameDisplay';

// ============================================================================
// Types
// ============================================================================

// Parsed draft content for display (Objectives only in Builder)
interface ParsedObjectiveDraft {
  text: string;
  metric?: string;
  target?: string;
  timeframe?: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Objective Draft Proposal Card
// ============================================================================

interface ObjectiveDraftCardProps {
  draft: StrategyDraft;
  onApply: () => void;
  onDiscard: () => void;
  isApplying?: boolean;
}

function ObjectiveDraftCard({ draft, onApply, onDiscard, isApplying }: ObjectiveDraftCardProps) {
  // Parse draft value
  let parsed: ParsedObjectiveDraft | null = null;
  try {
    parsed = JSON.parse(draft.draftValue);
  } catch {
    // Fallback to raw value
  }

  const confidenceColors = {
    high: 'bg-emerald-500/10 text-emerald-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="p-4 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/5 relative">
      {/* AI Badge */}
      <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded-full">
        <Sparkles className="w-3 h-3" />
        AI Suggestion
      </div>

      {/* Objective content */}
      {parsed && 'text' in parsed ? (
        <div className="pr-16">
          <p className="text-sm text-slate-200">{parsed.text}</p>
          {(parsed.metric || parsed.target) && (
            <div className="flex items-center gap-2 mt-2">
              {parsed.metric && (
                <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                  {parsed.metric}
                </span>
              )}
              {parsed.target && (
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                  {parsed.target}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="pr-16">
          <p className="text-sm text-slate-400 italic">{draft.draftValue}</p>
        </div>
      )}

      {/* Rationale */}
      {draft.rationale?.[0] && (
        <p className="text-xs text-slate-500 mt-3 italic border-t border-slate-700/50 pt-2">
          "{draft.rationale[0]}"
        </p>
      )}

      {/* Confidence badge */}
      <div className="flex items-center gap-2 mt-3">
        <span className={`text-[10px] px-2 py-0.5 rounded ${confidenceColors[draft.confidence]}`}>
          {draft.confidence} confidence
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/50">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Apply
        </button>
        <button
          onClick={onDiscard}
          disabled={isApplying}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Discard
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Objectives Section
// ============================================================================

interface ObjectivesSectionProps {
  objectives: Array<{
    id: string;
    text: string;
    metric?: string;
    target?: string;
  }>;
  drafts: StrategyDraft[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onAI: () => void;
  onApplyDraft: (draft: StrategyDraft) => void;
  onDiscardDraft: (draftId: string) => void;
  isLoading: boolean;
  isApplying: boolean;
}

function ObjectivesSection({ objectives, drafts, onAdd, onEdit, onAI, onApplyDraft, onDiscardDraft, isLoading, isApplying }: ObjectivesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-200">Objectives</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onAI}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Suggest
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* AI Draft Proposals */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-purple-400">
            <Sparkles className="w-3 h-3" />
            <span>{drafts.length} AI suggestion{drafts.length !== 1 ? 's' : ''} pending review</span>
          </div>
          {drafts.map((draft) => (
            <ObjectiveDraftCard
              key={draft.id}
              draft={draft}
              onApply={() => onApplyDraft(draft)}
              onDiscard={() => onDiscardDraft(draft.id)}
              isApplying={isApplying}
            />
          ))}
        </div>
      )}

      {objectives.length === 0 && drafts.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-700 rounded-lg">
          <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">No objectives defined</p>
          <p className="text-xs text-slate-500 mb-4">Define what you want to achieve</p>
          <button
            onClick={onAdd}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Add First Objective
          </button>
        </div>
      ) : objectives.length > 0 && (
        <div className="space-y-3">
          {objectives
            .filter(obj => obj.text && obj.text.trim().length > 0)
            .map((obj, index) => (
              <div
                key={obj.id || `obj-${index}`}
                onClick={() => onEdit(obj.id)}
                className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:border-slate-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{obj.text}</p>
                    {(obj.metric || obj.target) && (
                      <div className="flex items-center gap-2 mt-2">
                        {obj.metric && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                            {obj.metric}
                          </span>
                        )}
                        {obj.target && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                            {obj.target}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySurfaceBuilder({
  companyId,
  companyName,
  data,
  helpers,
  refresh,
  applyDraft,
  discardDraft,
  proposeObjectives,
  // NOTE: proposeStrategy and proposeTactics are NOT used in Builder
  // Strategic Bets → Command screen, Tactics → Orchestration screen
  isProposing,
  isApplying,
}: StrategySurfaceViewProps) {
  const { objectives } = helpers;
  const strategy = data.strategy;

  // Filter drafts - only objectives in Builder
  const drafts = data.drafts || [];
  const objectiveDrafts = useMemo(() => {
    return drafts.filter(d => d.scopeType === 'objective');
  }, [drafts]);

  // Handlers for draft actions
  const handleApplyDraft = useCallback(async (draft: StrategyDraft) => {
    const success = await applyDraft(draft);
    if (success) {
      await refresh();
    }
  }, [applyDraft, refresh]);

  const handleDiscardDraft = useCallback(async (draftId: string) => {
    const success = await discardDraft(draftId);
    if (success) {
      await refresh();
    }
  }, [discardDraft, refresh]);

  // TODO: Wire up actual handlers
  const handleAddObjective = useCallback(() => {
    console.log('Add objective');
  }, []);

  const handleEditObjective = useCallback((id: string) => {
    console.log('Edit objective:', id);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {strategy.title || 'Strategy Builder'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{companyName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Note: Handoff moved to Command screen after Bets are defined */}
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Strategic Frame */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-medium text-slate-200">Strategic Frame</h3>
            </div>
            <StrategyFrameDisplay
              companyId={companyId}
              strategyId={strategy.id || ''}
              hydratedFrame={data.hydratedFrame}
              frameSummary={data.frameSummary}
              onFieldSaved={() => refresh()}
            />
          </div>
        </div>

        {/* Main Content: Objectives Only */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
            <ObjectivesSection
              objectives={objectives}
              drafts={objectiveDrafts}
              onAdd={handleAddObjective}
              onEdit={handleEditObjective}
              onAI={proposeObjectives}
              onApplyDraft={handleApplyDraft}
              onDiscardDraft={handleDiscardDraft}
              isLoading={isProposing}
              isApplying={isApplying}
            />
          </div>

          {/* Next Step Prompt */}
          <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              After defining your objectives with metrics, switch to <strong className="text-slate-200">Command</strong> to deliberate on Strategic Bets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StrategySurfaceBuilder;
