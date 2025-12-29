// lib/os/companies/attentionSignal.ts
// Attention Signal - Compute attention status for company cards
//
// This module provides deterministic attention signals for the My Companies page.
// Signals are computed client-side from CompanySummary data.

import type { CompanySummary } from '@/lib/os/companySummary';

// ============================================================================
// Types
// ============================================================================

/**
 * Attention status levels (in priority order)
 */
export type AttentionLevel = 'negative' | 'insights' | 'baseline' | 'stable';

/**
 * Attention signal for display
 */
export interface AttentionSignal {
  level: AttentionLevel;
  label: string;
  icon: '🔴' | '🔵' | '🟡' | '🟢';
  colorClass: string;
  priority: number; // Lower = more urgent
}

/**
 * Activity status for display
 */
export interface ActivityStatus {
  label: string;
  daysSinceActivity: number | null;
  isActive: boolean;
}

/**
 * Primary CTA for a company card
 */
export interface CompanyCTA {
  label: string;
  href: string;
  type: 'insights' | 'strategy' | 'baseline' | 'overview';
}

/**
 * Sort option for company list
 */
export type SortOption = 'attention' | 'recent' | 'alphabetical';

// ============================================================================
// Constants
// ============================================================================

const ATTENTION_SIGNALS: Record<AttentionLevel, Omit<AttentionSignal, 'priority'>> = {
  negative: {
    level: 'negative',
    label: 'Negative impact detected',
    icon: '🔴',
    colorClass: 'text-red-400',
  },
  insights: {
    level: 'insights',
    label: 'Insights available',
    icon: '🔵',
    colorClass: 'text-blue-400',
  },
  baseline: {
    level: 'baseline',
    label: 'Needs baseline data',
    icon: '🟡',
    colorClass: 'text-amber-400',
  },
  stable: {
    level: 'stable',
    label: 'Stable — no action needed',
    icon: '🟢',
    colorClass: 'text-emerald-400',
  },
};

const PRIORITY_MAP: Record<AttentionLevel, number> = {
  negative: 0,
  insights: 1,
  baseline: 2,
  stable: 3,
};

// ============================================================================
// Attention Signal Computation
// ============================================================================

/**
 * Compute attention signal for a company
 *
 * Rules:
 * 1. Negative impact: Recent negative attribution OR critical issues
 * 2. Insights available: Has insights/attribution data
 * 3. Needs baseline: No diagnostics run
 * 4. Stable: Default healthy state
 */
export function computeAttentionSignal(summary: CompanySummary): AttentionSignal {
  // Check for negative signals
  const hasNegativeSignals = checkNegativeSignals(summary);
  if (hasNegativeSignals) {
    return {
      ...ATTENTION_SIGNALS.negative,
      priority: PRIORITY_MAP.negative,
    };
  }

  // Check for insights/data availability
  const hasInsights = checkHasInsights(summary);
  if (hasInsights) {
    return {
      ...ATTENTION_SIGNALS.insights,
      priority: PRIORITY_MAP.insights,
    };
  }

  // Check for baseline data needs
  const needsBaseline = checkNeedsBaseline(summary);
  if (needsBaseline) {
    return {
      ...ATTENTION_SIGNALS.baseline,
      priority: PRIORITY_MAP.baseline,
    };
  }

  // Default: stable
  return {
    ...ATTENTION_SIGNALS.stable,
    priority: PRIORITY_MAP.stable,
  };
}

/**
 * Check for negative signals
 */
function checkNegativeSignals(summary: CompanySummary): boolean {
  const { flags, analytics, dimensionScores, recentWork } = summary;

  // Flag-based checks
  if (flags.isAtRisk) return true;
  if (flags.hasOpenCriticalIssues) return true;

  // Significant negative analytics trend
  if (analytics.sessionsChange != null && analytics.sessionsChange < -20) return true;
  if (analytics.conversionsChange != null && analytics.conversionsChange < -25) return true;

  // Very low dimension scores (under 30) indicate problems
  const criticalScores = dimensionScores.filter(
    d => d.score !== null && d.score < 30
  );
  if (criticalScores.length >= 2) return true;

  // Critical attention item
  if (recentWork.topAttentionItem?.severity === 'critical') return true;

  return false;
}

/**
 * Check if company has actionable insights
 */
function checkHasInsights(summary: CompanySummary): boolean {
  const { dimensionScores, recentWork, analytics, brain } = summary;

  // Has dimension scores with trends
  const hasScoreTrends = dimensionScores.some(
    d => d.change !== null && d.change !== undefined && d.change !== 0
  );
  if (hasScoreTrends) return true;

  // Has analytics with trends
  const sessionsChange = analytics.sessionsChange ?? 0;
  const conversionsChange = analytics.conversionsChange ?? 0;
  const hasTrends = (
    (analytics.sessionsChange != null && Math.abs(sessionsChange) > 5) ||
    (analytics.conversionsChange != null && Math.abs(conversionsChange) > 5)
  );
  if (hasTrends) return true;

  // Has recent brain insights
  if (brain.recentInsightCount && brain.recentInsightCount > 0) return true;

  // Has next actions available
  if (recentWork.nextActions.length > 0) return true;

  // Has attention items (non-critical)
  if (recentWork.topAttentionItem) return true;

  return false;
}

/**
 * Check if company needs baseline data
 */
function checkNeedsBaseline(summary: CompanySummary): boolean {
  const { scores, dimensionScores, analytics, recentWork } = summary;

  // No blueprint/GAP score
  if (scores.latestBlueprintScore === null || scores.latestBlueprintScore === undefined) {
    return true;
  }

  // No dimension scores at all
  const hasAnyDimensionScore = dimensionScores.some(d => d.score !== null);
  if (!hasAnyDimensionScore) return true;

  // No analytics connected and no recent diagnostics
  const hasAnalytics = analytics.sessions !== null || analytics.conversions !== null;
  const hasRecentDiagnostic = recentWork.lastDiagnosticDate !== null;
  if (!hasAnalytics && !hasRecentDiagnostic) return true;

  return false;
}

// ============================================================================
// Activity Status
// ============================================================================

/**
 * Compute activity status for display
 */
export function computeActivityStatus(summary: CompanySummary): ActivityStatus {
  const { meta, recentWork } = summary;

  // Calculate days since last activity
  let daysSinceActivity: number | null = null;
  let lastActivityDate: Date | null = null;

  if (meta.lastActivityAt) {
    lastActivityDate = new Date(meta.lastActivityAt);
    const now = new Date();
    daysSinceActivity = Math.floor(
      (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  } else if (recentWork.lastDiagnosticDate) {
    lastActivityDate = new Date(recentWork.lastDiagnosticDate);
    const now = new Date();
    daysSinceActivity = Math.floor(
      (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // No activity at all
  if (daysSinceActivity === null) {
    return {
      label: 'No activity yet — run initial baseline',
      daysSinceActivity: null,
      isActive: false,
    };
  }

  // Recent activity (within 7 days)
  if (daysSinceActivity <= 7) {
    const taskCount = recentWork.openTasksCount;
    if (taskCount > 0) {
      return {
        label: `Active — ${taskCount} task${taskCount > 1 ? 's' : ''} open`,
        daysSinceActivity,
        isActive: true,
      };
    }
    return {
      label: 'Active — recently updated',
      daysSinceActivity,
      isActive: true,
    };
  }

  // Moderate activity (8-30 days)
  if (daysSinceActivity <= 30) {
    return {
      label: `No recent changes — last update ${daysSinceActivity}d ago`,
      daysSinceActivity,
      isActive: false,
    };
  }

  // Stale (over 30 days)
  const weeks = Math.floor(daysSinceActivity / 7);
  const months = Math.floor(daysSinceActivity / 30);

  if (months >= 2) {
    return {
      label: `Dormant — last update ${months}mo ago`,
      daysSinceActivity,
      isActive: false,
    };
  }

  return {
    label: `No recent changes — last update ${weeks}w ago`,
    daysSinceActivity,
    isActive: false,
  };
}

// ============================================================================
// Company CTA
// ============================================================================

/**
 * Get the primary CTA for a company card
 */
export function getCompanyCTA(
  summary: CompanySummary,
  attentionSignal: AttentionSignal
): CompanyCTA {
  const { companyId, scores, recentWork } = summary;

  // If insights available, go to strategy/insights
  if (attentionSignal.level === 'insights' || attentionSignal.level === 'negative') {
    // Has strategy? Go to strategy
    if (scores.latestBlueprintScore !== null) {
      return {
        label: 'View insights',
        href: `/c/${companyId}/strategy`,
        type: 'insights',
      };
    }
    // Has diagnostics? Go to blueprint
    if (recentWork.lastDiagnosticRunId) {
      return {
        label: 'Review strategy',
        href: `/c/${companyId}/blueprint`,
        type: 'strategy',
      };
    }
  }

  // Needs baseline
  if (attentionSignal.level === 'baseline') {
    return {
      label: 'Run baseline',
      href: `/c/${companyId}/blueprint`,
      type: 'baseline',
    };
  }

  // Default: go to blueprint/overview
  if (scores.latestBlueprintScore !== null) {
    return {
      label: 'View details',
      href: `/c/${companyId}/blueprint`,
      type: 'overview',
    };
  }

  return {
    label: 'Get started',
    href: `/c/${companyId}/blueprint`,
    type: 'baseline',
  };
}

// ============================================================================
// Page-Level Summary
// ============================================================================

/**
 * Summary of attention across all companies
 */
export interface AttentionSummary {
  total: number;
  needsAttention: number;
  atRisk: number;
  stable: number;
  label: string;
}

/**
 * Compute page-level attention summary
 */
export function computeAttentionSummary(summaries: CompanySummary[]): AttentionSummary {
  const signals = summaries.map(s => computeAttentionSignal(s));

  const atRisk = signals.filter(s => s.level === 'negative').length;
  const needsAttention = signals.filter(
    s => s.level === 'insights' || s.level === 'baseline'
  ).length;
  const stable = signals.filter(s => s.level === 'stable').length;

  // Build label
  const parts: string[] = [`${summaries.length} compan${summaries.length === 1 ? 'y' : 'ies'}`];

  if (needsAttention > 0) {
    parts.push(`${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`);
  }
  if (atRisk > 0) {
    parts.push(`${atRisk} at risk`);
  }

  return {
    total: summaries.length,
    needsAttention,
    atRisk,
    stable,
    label: parts.join(' • '),
  };
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Sort companies by the given option
 */
export function sortCompanies(
  summaries: CompanySummary[],
  sortBy: SortOption
): CompanySummary[] {
  const sorted = [...summaries];

  switch (sortBy) {
    case 'attention':
      // Sort by attention priority (urgent first), then by name for stability
      return sorted.sort((a, b) => {
        const signalA = computeAttentionSignal(a);
        const signalB = computeAttentionSignal(b);

        // Primary: attention priority
        if (signalA.priority !== signalB.priority) {
          return signalA.priority - signalB.priority;
        }

        // Secondary: has more open tasks first
        if (a.recentWork.openTasksCount !== b.recentWork.openTasksCount) {
          return b.recentWork.openTasksCount - a.recentWork.openTasksCount;
        }

        // Tertiary: alphabetical for stability
        return a.meta.name.localeCompare(b.meta.name);
      });

    case 'recent':
      // Sort by last activity date (most recent first)
      return sorted.sort((a, b) => {
        const dateA = a.meta.lastActivityAt
          ? new Date(a.meta.lastActivityAt).getTime()
          : 0;
        const dateB = b.meta.lastActivityAt
          ? new Date(b.meta.lastActivityAt).getTime()
          : 0;

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        // Fall back to alphabetical
        return a.meta.name.localeCompare(b.meta.name);
      });

    case 'alphabetical':
      return sorted.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

    default:
      return sorted;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'attention', label: 'Attention needed' },
  { value: 'recent', label: 'Recent activity' },
  { value: 'alphabetical', label: 'Alphabetical' },
];
