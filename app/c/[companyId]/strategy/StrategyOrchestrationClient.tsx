'use client';

// app/c/[companyId]/strategy/StrategyOrchestrationClient.tsx
// Strategy Orchestration View - AI-first workflow
//
// Implements: Objectives → Strategy → Tactics
// All AI outputs are drafts requiring explicit Apply

import React from 'react';
import Link from 'next/link';
import { Target, Layers, Zap, Sparkles, AlertCircle, Loader2, Scale } from 'lucide-react';
import { useStrategyOrchestration } from '@/hooks/useStrategyOrchestration';
import {
  DraftPreviewPanel,
  StalenessBanners,
  AIProposalButton,
  ObjectiveEditor,
} from '@/components/strategy-orchestration';
import type { OrchestrationObjective } from '@/lib/types/strategyOrchestration';

// ============================================================================
// Types
// ============================================================================

interface StrategyOrchestrationClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Readiness Indicator
// ============================================================================

function ReadinessIndicator({
  percent,
  canGenerate,
  blockedReason,
}: {
  percent: number;
  canGenerate: boolean;
  blockedReason: string | null;
}) {
  const color = percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-gray-400">{percent}%</span>
      {!canGenerate && blockedReason && (
        <span className="text-xs text-red-400">{blockedReason}</span>
      )}
    </div>
  );
}

// ============================================================================
// Priority Card
// ============================================================================

function PriorityCard({
  title,
  description,
  priority,
}: {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
}) {
  const priorityColors = {
    high: 'border-red-500/30 bg-red-500/5',
    medium: 'border-yellow-500/30 bg-yellow-500/5',
    low: 'border-gray-500/30 bg-gray-500/5',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[priority]}`}>
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium text-gray-200">{title}</h4>
        <span className={`text-xs px-2 py-0.5 rounded ${
          priority === 'high' ? 'bg-red-500/20 text-red-400' :
          priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {priority}
        </span>
      </div>
      {description && (
        <p className="text-xs text-gray-400 mt-2">{description}</p>
      )}
    </div>
  );
}

// ============================================================================
// Tactic Card
// ============================================================================

function TacticCard({
  title,
  description,
  impact,
  effort,
}: {
  title: string;
  description?: string;
  impact?: 'high' | 'medium' | 'low';
  effort?: 'high' | 'medium' | 'low';
}) {
  return (
    <div className="p-3 rounded-lg border border-gray-700 bg-gray-800/50">
      <h4 className="text-sm font-medium text-gray-200">{title}</h4>
      {description && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{description}</p>
      )}
      {(impact || effort) && (
        <div className="flex gap-2 mt-2">
          {impact && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              impact === 'high' ? 'bg-green-500/20 text-green-400' :
              impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {impact} impact
            </span>
          )}
          {effort && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              effort === 'low' ? 'bg-green-500/20 text-green-400' :
              effort === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {effort} effort
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Column Header
// ============================================================================

function ColumnHeader({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-200">{title}</h3>
        <p className="text-xs text-gray-500">{count} items</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyOrchestrationClient({
  companyId,
  companyName,
}: StrategyOrchestrationClientProps) {
  const {
    viewModel,
    isLoading,
    error,
    draft,
    isProposing,
    isApplying,
    refreshing,
    staleness,
    readiness,
    propose,
    applyDraft,
    dismissDraft,
    refreshStrategy,
    refreshTactics,
    refreshContext,
    updateObjectives,
  } = useStrategyOrchestration({ companyId });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-400">Loading strategy workspace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Failed to load strategy</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!viewModel) return null;

  const objectives = viewModel.objectives || [];
  const priorities = viewModel.activeStrategy?.priorities || [];
  const tactics = viewModel.tactics || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">
            {viewModel.activeStrategy?.title || 'Strategy Workspace'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{companyName}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Compare Strategies Button */}
          <Link
            href={`/c/${companyId}/strategy/compare`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            title="Compare strategies side-by-side"
          >
            <Scale className="w-4 h-4" />
            Compare
          </Link>
          <ReadinessIndicator
            percent={readiness.completenessPercent}
            canGenerate={readiness.canGenerateStrategy}
            blockedReason={readiness.blockedReason}
          />
        </div>
      </div>

      {/* Staleness Banners */}
      <StalenessBanners
        staleness={staleness}
        onRefreshStrategy={refreshStrategy}
        onRefreshTactics={refreshTactics}
        onRefreshContext={refreshContext}
        isRefreshing={refreshing}
      />

      {/* Draft Preview */}
      {draft.type && draft.data && (
        <DraftPreviewPanel
          type={draft.type}
          draft={draft.data}
          onApply={applyDraft}
          onDismiss={dismissDraft}
          isApplying={isApplying}
        />
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* OBJECTIVES */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <ColumnHeader
            icon={Target}
            title="Objectives"
            count={objectives.length}
            color="bg-blue-500/10 text-blue-400"
          />

          <ObjectiveEditor
            objectives={objectives}
            onUpdate={updateObjectives}
            companyId={companyId}
            strategyId={viewModel.activeStrategyId || undefined}
          />

          <div className="mt-4 pt-4 border-t border-gray-800">
            <AIProposalButton
              action="propose_objectives"
              companyId={companyId}
              strategyId={viewModel.activeStrategyId || undefined}
              onProposalReceived={() => {}}
              disabled={isProposing}
              variant="secondary"
              size="sm"
              label="Generate Objectives"
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* STRATEGY */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <ColumnHeader
            icon={Layers}
            title="Strategy"
            count={priorities.length}
            color="bg-purple-500/10 text-purple-400"
          />

          {priorities.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No priorities defined</p>
              <p className="text-xs text-gray-600 mt-1">
                Generate strategy from objectives
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {priorities.map((priority) => (
                <PriorityCard
                  key={priority.id}
                  title={priority.title}
                  description={priority.description}
                  priority={priority.priority || 'medium'}
                />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-800">
            <AIProposalButton
              action="propose_strategy"
              companyId={companyId}
              strategyId={viewModel.activeStrategyId || undefined}
              onProposalReceived={() => {}}
              disabled={isProposing || objectives.length === 0}
              variant="secondary"
              size="sm"
              label="Generate Strategy"
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* TACTICS */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <ColumnHeader
            icon={Zap}
            title="Tactics"
            count={tactics.length}
            color="bg-green-500/10 text-green-400"
          />

          {tactics.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No tactics defined</p>
              <p className="text-xs text-gray-600 mt-1">
                Generate tactics from strategy
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tactics.map((tactic) => (
                <TacticCard
                  key={tactic.id}
                  title={tactic.title}
                  description={tactic.description}
                />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-800">
            <AIProposalButton
              action="propose_tactics"
              companyId={companyId}
              strategyId={viewModel.activeStrategyId || undefined}
              onProposalReceived={() => {}}
              disabled={isProposing || priorities.length === 0}
              variant="secondary"
              size="sm"
              label="Generate Tactics"
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {viewModel.activeStrategy?.summary && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Strategy Summary</h4>
          <p className="text-sm text-gray-400">{viewModel.activeStrategy.summary}</p>
        </div>
      )}
    </div>
  );
}
