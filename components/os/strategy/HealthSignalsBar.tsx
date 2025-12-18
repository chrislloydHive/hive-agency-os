'use client';

// components/os/strategy/HealthSignalsBar.tsx
// Displays strategy health signals and coverage metrics
//
// Shows:
// - % Objectives with Strategy coverage
// - % Strategy with Tactical support
// - Conflicting objectives detected
// - Overloaded tactics detected

import React from 'react';
import {
  Target,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type { StrategyHealthSignals } from '@/lib/types/strategyBidirectional';

// ============================================================================
// Types
// ============================================================================

interface HealthSignalsBarProps {
  signals: StrategyHealthSignals;
  onFixObjectives?: () => void;
  onFixStrategy?: () => void;
  onFixTactics?: () => void;
  className?: string;
}

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  status: 'good' | 'warning' | 'error';
  detail?: string;
  onFix?: () => void;
}

function MetricCard({
  icon,
  label,
  value,
  suffix = '%',
  status,
  detail,
  onFix,
}: MetricCardProps) {
  const statusColors = {
    good: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    error: 'border-red-500/30 bg-red-500/5',
  };

  const valueColors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  };

  const StatusIcon = status === 'good' ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`border rounded-lg p-3 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <StatusIcon
          className={`w-4 h-4 ${status === 'good' ? 'text-emerald-400' : status === 'warning' ? 'text-amber-400' : 'text-red-400'}`}
        />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={`text-2xl font-bold ${valueColors[status]}`}>
            {value}
          </span>
          <span className={`text-sm ${valueColors[status]}`}>{suffix}</span>
        </div>

        {onFix && status !== 'good' && (
          <button
            onClick={onFix}
            className={`
              text-xs px-2 py-1 rounded transition-colors
              ${status === 'warning'
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }
            `}
          >
            Fix
          </button>
        )}
      </div>

      {detail && (
        <p className="text-xs text-slate-500 mt-1">{detail}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HealthSignalsBar({
  signals,
  onFixObjectives,
  onFixStrategy,
  onFixTactics,
  className = '',
}: HealthSignalsBarProps) {
  const getStatus = (value: number): 'good' | 'warning' | 'error' => {
    if (value >= 80) return 'good';
    if (value >= 50) return 'warning';
    return 'error';
  };

  return (
    <div className={`grid grid-cols-4 gap-3 ${className}`}>
      {/* Overall Health */}
      <MetricCard
        icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
        label="Overall Health"
        value={signals.overallHealth}
        status={getStatus(signals.overallHealth)}
        detail={signals.overallHealth >= 80 ? 'Strategy is well-aligned' : 'Alignment issues detected'}
      />

      {/* Objectives Coverage */}
      <MetricCard
        icon={<Target className="w-4 h-4 text-purple-400" />}
        label="Objectives Covered"
        value={signals.objectivesCovered}
        status={getStatus(signals.objectivesCovered)}
        detail={
          signals.unsupportedObjectives.length > 0
            ? `${signals.unsupportedObjectives.length} without strategy`
            : 'All objectives supported'
        }
        onFix={onFixObjectives}
      />

      {/* Strategy Supported */}
      <MetricCard
        icon={<Layers className="w-4 h-4 text-blue-400" />}
        label="Strategy Supported"
        value={signals.strategySupported}
        status={getStatus(signals.strategySupported)}
        detail={
          signals.unsupportedPriorities.length > 0
            ? `${signals.unsupportedPriorities.length} without tactics`
            : 'All priorities have tactics'
        }
        onFix={onFixStrategy}
      />

      {/* Tactics Quality */}
      <MetricCard
        icon={<Zap className="w-4 h-4 text-emerald-400" />}
        label="Tactics Linked"
        value={
          signals.orphanedTactics.length === 0
            ? 100
            : Math.max(0, 100 - signals.orphanedTactics.length * 10)
        }
        status={
          signals.orphanedTactics.length === 0
            ? 'good'
            : signals.orphanedTactics.length <= 2
            ? 'warning'
            : 'error'
        }
        detail={
          signals.orphanedTactics.length > 0
            ? `${signals.orphanedTactics.length} unlinked`
            : 'All tactics linked'
        }
        onFix={onFixTactics}
      />
    </div>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

export function HealthSignalsCompact({
  signals,
  className = '',
}: {
  signals: StrategyHealthSignals;
  className?: string;
}) {
  const getColor = (value: number): string => {
    if (value >= 80) return 'text-emerald-400';
    if (value >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-purple-400" />
        <span className={`text-xs font-medium ${getColor(signals.objectivesCovered)}`}>
          {signals.objectivesCovered}%
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-blue-400" />
        <span className={`text-xs font-medium ${getColor(signals.strategySupported)}`}>
          {signals.strategySupported}%
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-emerald-400" />
        <span
          className={`text-xs font-medium ${
            signals.orphanedTactics.length === 0 ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {signals.orphanedTactics.length === 0 ? '100%' : `${100 - signals.orphanedTactics.length * 10}%`}
        </span>
      </div>

      {signals.overallHealth < 80 && (
        <div className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-xs">Issues</span>
        </div>
      )}
    </div>
  );
}

export default HealthSignalsBar;
