'use client';

// ============================================================================
// @DEPRECATED - December 2024
// This component is DEPRECATED. Use StrategyWorkspace.tsx instead.
// Kept for reference only - NOT exported from index.ts
// ============================================================================

// components/os/strategy/views/StrategySurfaceOrchestration.tsx
// AI Orchestration View - 3-column AI-first workflow
//
// Layout: Objectives → Strategy (Priorities) → Tactics
// Mode: AI-focused with prominent generate buttons
//
// Uses shared panels:
// - ObjectivesPanel (ai mode)
// - PrioritiesPanel (ai mode)
// - TacticsPanel (ai mode)

import React from 'react';
import { Target, Layers, Zap, Sparkles, Loader2 } from 'lucide-react';
import type { StrategySurfaceViewProps } from './types';

// ============================================================================
// Column Header
// ============================================================================

interface ColumnHeaderProps {
  icon: React.ElementType;
  title: string;
  count: number;
  colorClass: string;
}

function ColumnHeader({ icon: Icon, title, count, colorClass }: ColumnHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-sm font-medium text-slate-200">
        {title}
        <span className="ml-2 text-xs font-normal text-slate-500">({count})</span>
      </h3>
    </div>
  );
}

// ============================================================================
// AI Generate Button
// ============================================================================

interface AIGenerateButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

function AIGenerateButton({ label, onClick, disabled, loading }: AIGenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg border border-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {label}
    </button>
  );
}

// ============================================================================
// Priority Card (inline for orchestration view)
// ============================================================================

interface PriorityCardProps {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
}

function PriorityCard({ title, description, priority }: PriorityCardProps) {
  const priorityColors = {
    high: 'border-red-500/30 bg-red-500/5',
    medium: 'border-amber-500/30 bg-amber-500/5',
    low: 'border-slate-500/30 bg-slate-500/5',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[priority]}`}>
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
        <span className={`text-xs px-2 py-0.5 rounded ${
          priority === 'high' ? 'bg-red-500/20 text-red-400' :
          priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
          'bg-slate-500/20 text-slate-400'
        }`}>
          {priority}
        </span>
      </div>
      {description && (
        <p className="text-xs text-slate-400 mt-2">{description}</p>
      )}
    </div>
  );
}

// ============================================================================
// Tactic Card (inline for orchestration view)
// ============================================================================

interface TacticCardProps {
  title: string;
  description?: string;
  impact?: 'high' | 'medium' | 'low';
  effort?: 'high' | 'medium' | 'low';
}

function TacticCard({ title, description, impact, effort }: TacticCardProps) {
  return (
    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
      <h4 className="text-sm font-medium text-slate-200">{title}</h4>
      {description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{description}</p>
      )}
      {(impact || effort) && (
        <div className="flex gap-2 mt-2">
          {impact && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              impact === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
              impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {impact} impact
            </span>
          )}
          {effort && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              effort === 'low' ? 'bg-emerald-500/20 text-emerald-400' :
              effort === 'medium' ? 'bg-amber-500/20 text-amber-400' :
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
// Objective Item (inline for orchestration view)
// ============================================================================

interface ObjectiveItemProps {
  text: string;
  metric?: string;
  target?: string;
}

function ObjectiveItem({ text, metric, target }: ObjectiveItemProps) {
  return (
    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
      <p className="text-sm text-slate-200">{text}</p>
      {(metric || target) && (
        <div className="flex items-center gap-2 mt-1">
          {metric && <span className="text-xs text-slate-400">{metric}</span>}
          {target && <span className="text-xs text-emerald-400 font-medium">{target}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySurfaceOrchestration({
  companyId,
  companyName,
  data,
  helpers,
  proposeObjectives,
  proposeStrategy,
  proposeTactics,
  isProposing,
}: StrategySurfaceViewProps) {
  const { objectives, priorities, tactics } = helpers;
  const strategy = data.strategy;

  return (
    <div className="space-y-6">
      {/* Header with strategy title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {strategy.title || 'Strategy Workspace'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{companyName}</p>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OBJECTIVES */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <ColumnHeader
            icon={Target}
            title="Objectives"
            count={objectives.length}
            colorClass="bg-blue-500/10 text-blue-400"
          />

          {objectives.filter(obj => obj.text && obj.text.trim().length > 0).length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No objectives defined</p>
              <p className="text-xs text-slate-600 mt-1">
                Define what matters first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {objectives
                .filter(obj => obj.text && obj.text.trim().length > 0)
                .map((obj) => (
                  <ObjectiveItem
                    key={obj.id}
                    text={obj.text}
                    metric={obj.metric}
                    target={obj.target}
                  />
                ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800">
            <AIGenerateButton
              label="Generate Objectives"
              onClick={proposeObjectives}
              disabled={isProposing}
              loading={isProposing}
            />
          </div>
        </div>

        {/* STRATEGY (PRIORITIES) */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <ColumnHeader
            icon={Layers}
            title="Strategy"
            count={priorities.length}
            colorClass="bg-purple-500/10 text-purple-400"
          />

          {priorities.filter(p => p.title && p.title.trim().length > 0).length === 0 ? (
            <div className="text-center py-8">
              <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No priorities defined</p>
              <p className="text-xs text-slate-600 mt-1">
                Generate strategy from objectives
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {priorities
                .filter(p => p.title && p.title.trim().length > 0)
                .map((priority) => (
                  <PriorityCard
                    key={priority.id}
                    title={priority.title}
                    description={priority.description}
                    priority={priority.priority || 'medium'}
                  />
                ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800">
            <AIGenerateButton
              label="Generate Strategy"
              onClick={proposeStrategy}
              disabled={isProposing || objectives.length === 0}
              loading={isProposing}
            />
          </div>
        </div>

        {/* TACTICS */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <ColumnHeader
            icon={Zap}
            title="Tactics"
            count={tactics.length}
            colorClass="bg-emerald-500/10 text-emerald-400"
          />

          {tactics.filter(t => t.title && t.title.trim().length > 0).length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tactics defined</p>
              <p className="text-xs text-slate-600 mt-1">
                Generate tactics from strategy
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tactics
                .filter(t => t.title && t.title.trim().length > 0)
                .map((tactic) => (
                  <TacticCard
                    key={tactic.id}
                    title={tactic.title}
                    description={tactic.description}
                    impact={tactic.impact}
                    effort={tactic.effort}
                  />
                ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800">
            <AIGenerateButton
              label="Generate Tactics"
              onClick={proposeTactics}
              disabled={isProposing || priorities.length === 0}
              loading={isProposing}
            />
          </div>
        </div>
      </div>

      {/* Strategy Summary */}
      {strategy.summary && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Strategy Summary</h4>
          <p className="text-sm text-slate-400">{strategy.summary}</p>
        </div>
      )}
    </div>
  );
}

export default StrategySurfaceOrchestration;
