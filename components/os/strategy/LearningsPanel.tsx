'use client';

// components/os/strategy/LearningsPanel.tsx
// "What We've Learned" Panel - Read-only outcome signals display
//
// Design principle: This panel surfaces insights without prescribing action.
// All content is observational and meant to inform human retrospectives.
// No edit actions, no auto-updates, no AI modifications.

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Star,
  Minus,
  Circle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import type { OutcomeSignal, OutcomeSignalType } from '@/lib/types/outcomeSignal';
import {
  getSignalTypeLabel,
  getSignalTypeColorClass,
  getConfidenceColorClass,
  sortSignalsByRelevance,
} from '@/lib/types/outcomeSignal';

// ============================================================================
// Types
// ============================================================================

interface LearningsPanelProps {
  signals: OutcomeSignal[];
  companyId: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Maximum signals to show before "show more" */
  maxVisible?: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function LearningsPanel({
  signals,
  companyId,
  defaultCollapsed = true,
  maxVisible = 5,
}: LearningsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  // Sort signals by relevance
  const sortedSignals = sortSignalsByRelevance(signals);

  // Group signals by type for summary
  const signalsByType = sortedSignals.reduce((acc, signal) => {
    acc[signal.signalType] = (acc[signal.signalType] || 0) + 1;
    return acc;
  }, {} as Record<OutcomeSignalType, number>);

  // Display signals
  const displaySignals = showAll
    ? sortedSignals
    : sortedSignals.slice(0, maxVisible);

  const hasMore = sortedSignals.length > maxVisible;

  // Don't render if no signals
  if (signals.length === 0) {
    return null;
  }

  const positiveCount = sortedSignals.filter(
    s => s.signalType === 'completed' || s.signalType === 'high-impact'
  ).length;
  const learningCount = sortedSignals.filter(s => s.signalType === 'learning').length;

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">What We've Learned</h3>
            <p className="text-xs text-slate-500">
              {signals.length} signal{signals.length !== 1 ? 's' : ''} from executed work
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick summary badges */}
          {positiveCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
              <TrendingUp className="w-3 h-3" />
              {positiveCount} positive
            </span>
          )}
          {learningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
              <Lightbulb className="w-3 h-3" />
              {learningCount} learning{learningCount !== 1 ? 's' : ''}
            </span>
          )}

          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {/* Signals list */}
          <div className="mt-4 space-y-3">
            {displaySignals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                companyId={companyId}
              />
            ))}
          </div>

          {/* Show more / less */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showAll
                  ? 'Show less'
                  : `Show ${sortedSignals.length - maxVisible} more signals`}
              </button>
            </div>
          )}

          {/* Note about read-only nature */}
          <div className="mt-4 pt-3 border-t border-slate-800/50">
            <p className="text-[10px] text-slate-600 text-center">
              Signals are read-only observations. Use them to inform your next strategy session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Signal Card
// ============================================================================

function SignalCard({
  signal,
  companyId,
}: {
  signal: OutcomeSignal;
  companyId: string;
}) {
  const Icon = getSignalIcon(signal.signalType);

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-1.5 rounded-lg ${getIconBgClass(signal.signalType)}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Signal type badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${getSignalTypeColorClass(signal.signalType).split(' ')[1]}`}>
              {getSignalTypeLabel(signal.signalType)}
            </span>
            <span className={`text-[10px] ${getConfidenceColorClass(signal.confidence)}`}>
              {signal.confidence} confidence
            </span>
          </div>

          {/* Summary */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {signal.summary}
          </p>

          {/* Evidence */}
          {signal.evidence && signal.evidence.length > 0 && (
            <div className="mt-2 space-y-1">
              {signal.evidence.slice(0, 2).map((item, idx) => (
                <p key={idx} className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  {item}
                </p>
              ))}
              {signal.evidence.length > 2 && (
                <p className="text-xs text-slate-600">
                  +{signal.evidence.length - 2} more evidence points
                </p>
              )}
            </div>
          )}

          {/* Source link */}
          <div className="mt-2 flex items-center gap-2">
            {signal.source === 'artifact' && (
              <Link
                href={`/c/${companyId}/artifacts/${signal.sourceId}`}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                <FileText className="w-3 h-3" />
                View artifact
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            )}
            {signal.source === 'work' && (
              <Link
                href={`/c/${companyId}/work?workItemId=${signal.sourceId}`}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                <Briefcase className="w-3 h-3" />
                View work
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getSignalIcon(type: OutcomeSignalType) {
  switch (type) {
    case 'completed':
      return CheckCircle;
    case 'high-impact':
      return Star;
    case 'learning':
      return Lightbulb;
    case 'low-impact':
      return Minus;
    case 'abandoned':
      return Circle;
    default:
      return Lightbulb;
  }
}

function getIconBgClass(type: OutcomeSignalType): string {
  switch (type) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400';
    case 'high-impact':
      return 'bg-purple-500/10 text-purple-400';
    case 'learning':
      return 'bg-blue-500/10 text-blue-400';
    case 'low-impact':
      return 'bg-amber-500/10 text-amber-400';
    case 'abandoned':
      return 'bg-slate-500/10 text-slate-400';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

// ============================================================================
// Export for use in Strategy Workspace
// ============================================================================

export default LearningsPanel;
