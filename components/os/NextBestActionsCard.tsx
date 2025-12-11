'use client';

// components/os/NextBestActionsCard.tsx
// Reusable Next Best Actions card for Overview, Plan, and Work pages
//
// Features:
// - Displays top N recommended actions from the recommendations engine
// - Shows quick win badges, themes, and effort indicators
// - Links to Plan and Work pages
// - "Add to Work" functionality

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  Plus,
  Loader2,
  Lightbulb,
  Target,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { ExtendedNextBestAction } from '@/lib/os/companies/nextBestAction.types';

// ============================================================================
// Types
// ============================================================================

interface NextBestActionsCardProps {
  companyId: string;
  /** Initial actions (server-side loaded) */
  initialActions?: ExtendedNextBestAction[];
  /** Max actions to display */
  limit?: number;
  /** Show as compact inline version */
  compact?: boolean;
  /** Filter by lab slug */
  labSlug?: string;
  /** Show quick wins only */
  quickWinsOnly?: boolean;
  /** Title override */
  title?: string;
  /** Subtitle override */
  subtitle?: string;
  /** Show "View all" link */
  showViewAll?: boolean;
  /** Callback when action is added to work */
  onAddToWork?: (action: ExtendedNextBestAction) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'text-red-400';
    case 'medium':
      return 'text-amber-400';
    case 'low':
      return 'text-blue-400';
  }
}

function getEffortBadge(effort?: 'quick-win' | 'moderate' | 'significant'): {
  label: string;
  color: string;
} | null {
  switch (effort) {
    case 'quick-win':
      return { label: 'Quick win', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case 'moderate':
      return { label: 'Moderate', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'significant':
      return { label: 'Significant', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    default:
      return null;
  }
}

// ============================================================================
// Action Item Component
// ============================================================================

function ActionItem({
  action,
  companyId,
  onAddToWork,
  compact,
}: {
  action: ExtendedNextBestAction;
  companyId: string;
  onAddToWork?: (action: ExtendedNextBestAction) => void;
  compact?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const effortBadge = getEffortBadge(action.effort);

  const handleAddToWork = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      // Call the work item creation API
      const response = await fetch(`/api/os/companies/${companyId}/work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: action.action,
          description: `${action.reason}\n\n**Expected Impact:** ${action.expectedImpact || 'Not specified'}\n\n_Source: AI Recommendation_`,
          area: action.category || 'Strategy',
          priority: action.priority,
          status: 'Backlog',
          sourceType: 'AI Recommendation',
          sourceId: action.id,
        }),
      });

      if (response.ok) {
        onAddToWork?.(action);
      }
    } catch (error) {
      console.error('Failed to add to work:', error);
    } finally {
      setIsAdding(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {action.isQuickWin && (
            <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          )}
          <span className="text-sm text-slate-200 truncate">{action.action}</span>
        </div>
        <Link
          href={`/c/${companyId}/findings`}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 ml-2"
        >
          View
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {action.isQuickWin && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Zap className="w-3 h-3" />
                Quick win
              </span>
            )}
            {action.theme && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-300">
                {action.theme}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-100 leading-tight">
            {action.action}
          </h4>
        </div>
        <div className={`text-xs font-medium ${getPriorityColor(action.priority)}`}>
          {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
        </div>
      </div>

      {/* Description */}
      {action.reason && (
        <p className="text-xs text-slate-400 mt-2 line-clamp-2">
          {action.reason}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
        {effortBadge && (
          <span className={`px-1.5 py-0.5 rounded border ${effortBadge.color}`}>
            {effortBadge.label}
          </span>
        )}
        {action.expectedImpact && (
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            {action.expectedImpact.length > 40
              ? action.expectedImpact.slice(0, 37) + '...'
              : action.expectedImpact}
          </span>
        )}
        {action.estimatedHours && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{action.estimatedHours}h
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
        <Link
          href={`/c/${companyId}/findings`}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
        >
          View in Plan
          <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={handleAddToWork}
          disabled={isAdding}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Add to Work
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function NextBestActionsCard({
  companyId,
  initialActions,
  limit = 3,
  compact = false,
  labSlug,
  quickWinsOnly = false,
  title = 'Next Best Actions',
  subtitle = 'Highest impact moves based on current diagnostics and plan.',
  showViewAll = true,
  onAddToWork,
}: NextBestActionsCardProps) {
  const [actions, setActions] = useState<ExtendedNextBestAction[]>(initialActions || []);
  const [isLoading, setIsLoading] = useState(!initialActions);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Fetch actions if not provided
  useEffect(() => {
    if (initialActions) return;

    const fetchActions = async () => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          ...(labSlug && { labSlug }),
          ...(quickWinsOnly && { quickWinsOnly: 'true' }),
        });

        const response = await fetch(
          `/api/os/companies/${companyId}/next-best-actions?${params}`
        );

        if (response.ok) {
          const data = await response.json();
          setActions(data.actions || []);
        }
      } catch (error) {
        console.error('Failed to fetch next best actions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, [companyId, initialActions, limit, labSlug, quickWinsOnly]);

  const handleAddToWork = (action: ExtendedNextBestAction) => {
    setAddedIds(prev => new Set(prev).add(action.id));
    onAddToWork?.(action);
  };

  // Filter out added actions
  const displayActions = actions.filter(a => !addedIds.has(a.id));

  if (compact) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-white">{title}</h3>
          </div>
          {showViewAll && (
            <Link
              href={`/c/${companyId}/findings`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              View all
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : displayActions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-slate-500">No recommended actions right now.</p>
            <Link
              href={`/c/${companyId}/blueprint`}
              className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-block"
            >
              Run Diagnostics
            </Link>
          </div>
        ) : (
          <div>
            {displayActions.slice(0, limit).map(action => (
              <ActionItem
                key={action.id}
                action={action}
                companyId={companyId}
                onAddToWork={handleAddToWork}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {showViewAll && displayActions.length > 0 && (
          <Link
            href={`/c/${companyId}/findings`}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin mb-2" />
          <p className="text-xs text-slate-500">Loading recommendations...</p>
        </div>
      ) : displayActions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
          <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-2">
            No recommended actions right now.
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Run Diagnostics to generate new insights.
          </p>
          <Link
            href={`/c/${companyId}/blueprint`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            Run Diagnostics
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayActions.slice(0, limit).map(action => (
            <ActionItem
              key={action.id}
              action={action}
              companyId={companyId}
              onAddToWork={handleAddToWork}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default NextBestActionsCard;
