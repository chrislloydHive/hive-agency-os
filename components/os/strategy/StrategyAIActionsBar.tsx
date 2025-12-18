'use client';

// components/os/strategy/StrategyAIActionsBar.tsx
// Unified AI Actions Bar for Strategy Command Center V5
//
// Provides consistent AI action controls for:
// - Objectives (left)
// - Strategy (center)
// - Tactics (right)
//
// Each segment has:
// - Primary AI action button (purple)
// - Secondary actions (ghost)
// - Status + inputs used chips
// - Disabled + tooltip when inputs missing
// - "Draft-only" badge (AI never writes without review)

import React from 'react';
import {
  Sparkles,
  Target,
  Layers,
  Zap,
  Lightbulb,
  RefreshCw,
  BarChart2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AIActionSegment = 'objectives' | 'strategy' | 'tactics';

export interface InputSource {
  id: 'context' | 'competition' | 'websiteLab';
  label: string;
  available: boolean;
  lastUpdatedAt: string | null;
}

export interface AIActionConfig {
  id: string;
  label: string;
  description?: string;
  isPrimary?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
}

export interface SegmentConfig {
  segment: AIActionSegment;
  icon: React.ReactNode;
  label: string;
  primaryAction: AIActionConfig;
  secondaryActions: AIActionConfig[];
  inputsUsed: InputSource[];
  itemCount?: number;
}

export interface StrategyAIActionsBarProps {
  segments: SegmentConfig[];
  onAction: (segment: AIActionSegment, actionId: string) => void;
  activeSegment?: AIActionSegment;
  onSegmentClick?: (segment: AIActionSegment) => void;
  className?: string;
}

// ============================================================================
// Input Source Chip
// ============================================================================

function InputSourceChip({ source }: { source: InputSource }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
        ${source.available
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-slate-700/50 text-slate-500'
        }
      `}
      title={source.available
        ? `${source.label}: Available${source.lastUpdatedAt ? ` (${new Date(source.lastUpdatedAt).toLocaleDateString()})` : ''}`
        : `${source.label}: Not available`
      }
    >
      {source.available ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {source.label}
    </span>
  );
}

// ============================================================================
// Action Button
// ============================================================================

interface ActionButtonProps {
  action: AIActionConfig;
  onClick: () => void;
  isPrimary?: boolean;
}

function ActionButton({ action, onClick, isPrimary = false }: ActionButtonProps) {
  const baseClasses = isPrimary
    ? 'bg-purple-600 hover:bg-purple-500 text-white'
    : 'text-slate-300 hover:bg-slate-700/50';

  return (
    <button
      onClick={onClick}
      disabled={action.disabled || action.loading}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors
        ${baseClasses}
        ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      title={action.disabled ? action.disabledReason : action.description}
    >
      {action.loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isPrimary ? (
        <Sparkles className="w-4 h-4" />
      ) : null}
      {action.label}
    </button>
  );
}

// ============================================================================
// Segment Panel
// ============================================================================

interface SegmentPanelProps {
  config: SegmentConfig;
  onAction: (actionId: string) => void;
  isActive?: boolean;
  onClick?: () => void;
}

function SegmentPanel({ config, onAction, isActive, onClick }: SegmentPanelProps) {
  return (
    <div
      className={`
        flex-1 p-3 rounded-lg border transition-colors cursor-pointer
        ${isActive
          ? 'border-purple-500/50 bg-purple-500/5'
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
        }
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`${isActive ? 'text-purple-400' : 'text-slate-400'}`}>
            {config.icon}
          </span>
          <span className="text-sm font-medium text-white">{config.label}</span>
          {config.itemCount !== undefined && (
            <span className="text-xs text-slate-400">({config.itemCount})</span>
          )}
        </div>
        <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
          Draft-only
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ActionButton
          action={config.primaryAction}
          onClick={() => onAction(config.primaryAction.id)}
          isPrimary
        />
        {config.secondaryActions.map(action => (
          <ActionButton
            key={action.id}
            action={action}
            onClick={() => onAction(action.id)}
          />
        ))}
      </div>

      {/* Inputs Used */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Inputs:</span>
        <div className="flex flex-wrap gap-1">
          {config.inputsUsed.map(source => (
            <InputSourceChip key={source.id} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyAIActionsBar({
  segments,
  onAction,
  activeSegment,
  onSegmentClick,
  className = '',
}: StrategyAIActionsBarProps) {
  return (
    <div className={`flex gap-3 ${className}`}>
      {segments.map(config => (
        <SegmentPanel
          key={config.segment}
          config={config}
          onAction={(actionId) => onAction(config.segment, actionId)}
          isActive={activeSegment === config.segment}
          onClick={() => onSegmentClick?.(config.segment)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Build the default segments configuration
 */
export function buildDefaultSegments(options: {
  hasStrategy: boolean;
  objectiveCount: number;
  priorityCount: number;
  tacticCount: number;
  contextAvailable: boolean;
  contextLastUpdated: string | null;
  competitionAvailable: boolean;
  competitionLastUpdated: string | null;
  websiteLabAvailable: boolean;
  websiteLabLastUpdated: string | null;
  loadingAction?: string;
}): SegmentConfig[] {
  const {
    hasStrategy,
    objectiveCount,
    priorityCount,
    tacticCount,
    contextAvailable,
    contextLastUpdated,
    competitionAvailable,
    competitionLastUpdated,
    websiteLabAvailable,
    websiteLabLastUpdated,
    loadingAction,
  } = options;

  const inputSources: InputSource[] = [
    {
      id: 'context',
      label: 'Context',
      available: contextAvailable,
      lastUpdatedAt: contextLastUpdated,
    },
    {
      id: 'competition',
      label: 'Competition',
      available: competitionAvailable,
      lastUpdatedAt: competitionLastUpdated,
    },
    {
      id: 'websiteLab',
      label: 'Website Lab',
      available: websiteLabAvailable,
      lastUpdatedAt: websiteLabLastUpdated,
    },
  ];

  return [
    {
      segment: 'objectives',
      icon: <Target className="w-4 h-4" />,
      label: 'Objectives',
      itemCount: objectiveCount,
      primaryAction: {
        id: 'suggest_objectives',
        label: 'AI Suggest',
        description: 'Generate objective suggestions based on context',
        loading: loadingAction === 'suggest_objectives',
        disabled: !contextAvailable,
        disabledReason: 'Context required',
      },
      secondaryActions: [
        {
          id: 'improve_objectives',
          label: 'Improve',
          description: 'Refine existing objectives',
          loading: loadingAction === 'improve_objectives',
          disabled: objectiveCount === 0,
          disabledReason: 'No objectives to improve',
        },
      ],
      inputsUsed: inputSources.filter(s => ['context'].includes(s.id)),
    },
    {
      segment: 'strategy',
      icon: <Layers className="w-4 h-4" />,
      label: 'Strategy',
      itemCount: priorityCount,
      primaryAction: {
        id: hasStrategy ? 'improve_strategy' : 'propose_strategy',
        label: hasStrategy ? 'AI Improve' : 'AI Propose',
        description: hasStrategy
          ? 'Improve existing strategy priorities'
          : 'Generate strategy based on context and objectives',
        loading: loadingAction === 'propose_strategy' || loadingAction === 'improve_strategy',
        disabled: !contextAvailable,
        disabledReason: 'Context required',
      },
      secondaryActions: [
        {
          id: 'explain_tradeoffs',
          label: 'Tradeoffs',
          description: 'Explain strategic tradeoffs',
          loading: loadingAction === 'explain_tradeoffs',
          disabled: priorityCount === 0,
          disabledReason: 'No priorities defined',
        },
        {
          id: 'generate_alternatives',
          label: 'Alternatives',
          description: 'Generate alternative strategy options',
          loading: loadingAction === 'generate_alternatives',
          disabled: !hasStrategy,
          disabledReason: 'Strategy required',
        },
      ],
      inputsUsed: inputSources.filter(s => ['context', 'competition'].includes(s.id)),
    },
    {
      segment: 'tactics',
      icon: <Zap className="w-4 h-4" />,
      label: 'Tactics',
      itemCount: tacticCount,
      primaryAction: {
        id: 'generate_tactics',
        label: 'Generate Tactics',
        description: 'Generate tactics to implement strategy',
        loading: loadingAction === 'generate_tactics',
        disabled: priorityCount === 0,
        disabledReason: 'Strategy priorities required',
      },
      secondaryActions: [
        {
          id: 'audit_tactics',
          label: 'Audit Fit',
          description: 'Check if tactics align with strategy',
          loading: loadingAction === 'audit_tactics',
          disabled: tacticCount === 0,
          disabledReason: 'No tactics to audit',
        },
        {
          id: 'rerank_tactics',
          label: 'Re-rank',
          description: 'Re-rank tactics by impact/effort',
          loading: loadingAction === 'rerank_tactics',
          disabled: tacticCount < 2,
          disabledReason: 'Need 2+ tactics to rank',
        },
      ],
      inputsUsed: inputSources,
    },
  ];
}

// ============================================================================
// Compact Version (for narrow layouts)
// ============================================================================

export function StrategyAIActionsCompact({
  segment,
  config,
  onAction,
  className = '',
}: {
  segment: AIActionSegment;
  config: SegmentConfig;
  onAction: (actionId: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ActionButton
        action={config.primaryAction}
        onClick={() => onAction(config.primaryAction.id)}
        isPrimary
      />
      {config.secondaryActions.slice(0, 2).map(action => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={() => onAction(action.id)}
        />
      ))}
      <div className="flex gap-1 ml-2">
        {config.inputsUsed.map(source => (
          <span
            key={source.id}
            className={`w-2 h-2 rounded-full ${source.available ? 'bg-emerald-400' : 'bg-slate-600'}`}
            title={`${source.label}: ${source.available ? 'Available' : 'Missing'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default StrategyAIActionsBar;
