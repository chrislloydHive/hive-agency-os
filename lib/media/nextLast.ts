// lib/media/nextLast.ts
// Next/Last Work Item Recommendations
//
// Provides "Last thing we did" and "Next recommended step" for the Media Dashboard.
// Integrates with Work items and unresolved insights to guide users.

import type { MediaInsight } from './alerts';

// ============================================================================
// Types
// ============================================================================

export interface MediaLastWorkItem {
  id: string;
  title: string;
  completedAt: string;
  area?: string;
  outcome?: string;
}

export interface MediaNextRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  sourceInsightId?: string;
  actionType: 'optimize' | 'investigate' | 'expand' | 'review';
  suggestedAction?: string;
}

export interface MediaNextLast {
  lastWorkItem?: MediaLastWorkItem;
  nextRecommended?: MediaNextRecommendation;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get next/last work recommendations for a media program
 */
export async function getMediaNextLast(args: {
  companyId: string;
  mediaProgramId: string;
  insights: MediaInsight[];
}): Promise<MediaNextLast> {
  const { companyId, mediaProgramId, insights } = args;

  // Get last completed work item for media
  const lastWorkItem = await getLastMediaWorkItem(companyId, mediaProgramId);

  // Get next recommendation based on insights
  const nextRecommended = getNextRecommendation(insights);

  return {
    lastWorkItem,
    nextRecommended,
  };
}

// ============================================================================
// Work Item Query
// ============================================================================

/**
 * Get the most recent completed media-related work item
 */
async function getLastMediaWorkItem(
  companyId: string,
  mediaProgramId: string
): Promise<MediaLastWorkItem | undefined> {
  // TODO: Query Work table for completed media items
  // For now, return mock data or undefined

  try {
    // Dynamic import to avoid circular dependencies
    const { getWorkItemsForCompany } = await import('@/lib/airtable/workItems');
    const workItems = await getWorkItemsForCompany(companyId);

    // Filter for completed media-related items
    const mediaItems = workItems.filter((item) => {
      // Must be done
      if (item.status !== 'Done') return false;

      const area = (item.area?.toLowerCase() || '') as string;
      const title = (item.title?.toLowerCase() || '') as string;
      return (
        area.includes('media') ||
        area.includes('advertising') ||
        title.includes('media') ||
        title.includes('campaign') ||
        title.includes('ads') ||
        title.includes('ppc')
      );
    });

    if (mediaItems.length === 0) {
      return undefined;
    }

    // Sort by updatedAt descending and get most recent
    const sorted = [...mediaItems].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    const latest = sorted[0];

    return {
      id: latest.id,
      title: latest.title || 'Media task',
      completedAt: latest.updatedAt || new Date().toISOString(),
      area: latest.area || 'Media',
      outcome: undefined,
    };
  } catch (error) {
    console.error('[MediaNextLast] Failed to fetch work items:', error);
    return undefined;
  }
}

// ============================================================================
// Recommendation Logic
// ============================================================================

/**
 * Generate next recommendation based on insights
 */
function getNextRecommendation(
  insights: MediaInsight[]
): MediaNextRecommendation | undefined {
  if (insights.length === 0) {
    // No issues detected - suggest routine optimization
    return {
      title: 'Review campaign performance',
      description: 'No urgent issues detected. Review recent performance trends and identify optimization opportunities.',
      priority: 'low',
      actionType: 'review',
      suggestedAction: 'Check conversion rates and bid strategies across channels.',
    };
  }

  // Sort by severity (critical > warning > info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sortedInsights = [...insights].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const topInsight = sortedInsights[0];

  return mapInsightToRecommendation(topInsight);
}

/**
 * Map an insight to a recommendation
 */
function mapInsightToRecommendation(insight: MediaInsight): MediaNextRecommendation {
  const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
    critical: 'high',
    warning: 'medium',
    info: 'low',
  };

  const actionTypeMap: Record<string, 'optimize' | 'investigate' | 'expand' | 'review'> = {
    underperforming_channel: 'optimize',
    store_dropoff: 'investigate',
    spend_spike: 'investigate',
    spend_underspend: 'expand',
    conversion_drop: 'optimize',
    cpl_increase: 'optimize',
    low_impressions: 'investigate',
    high_cpc: 'optimize',
  };

  return {
    title: insight.title,
    description: insight.description,
    priority: priorityMap[insight.severity] || 'medium',
    sourceInsightId: insight.id,
    actionType: actionTypeMap[insight.type] || 'review',
    suggestedAction: insight.recommendation,
  };
}

// ============================================================================
// Quick Wins
// ============================================================================

/**
 * Get a list of quick win recommendations
 */
export function getQuickWins(insights: MediaInsight[]): MediaNextRecommendation[] {
  const quickWins: MediaNextRecommendation[] = [];

  // Look for underspend opportunities
  const underspendInsights = insights.filter(i => i.type === 'spend_underspend');
  if (underspendInsights.length > 0) {
    quickWins.push({
      title: 'Capture more budget',
      description: 'Budget is underutilized. Consider expanding reach or increasing bids.',
      priority: 'medium',
      actionType: 'expand',
      suggestedAction: 'Review daily budgets and bid caps across campaigns.',
    });
  }

  // Look for high CPC that could be optimized
  const highCpcInsights = insights.filter(i => i.type === 'high_cpc');
  if (highCpcInsights.length > 0) {
    quickWins.push({
      title: 'Reduce cost per click',
      description: 'Some channels have high CPCs. Review keywords and targeting.',
      priority: 'medium',
      actionType: 'optimize',
      suggestedAction: 'Audit keyword quality scores and remove low-performers.',
    });
  }

  // Look for low impressions
  const lowImpressionInsights = insights.filter(i => i.type === 'low_impressions');
  if (lowImpressionInsights.length > 0) {
    quickWins.push({
      title: 'Increase visibility',
      description: 'Some channels have low impression volume despite active spend.',
      priority: 'low',
      actionType: 'investigate',
      suggestedAction: 'Check ad approval status and targeting restrictions.',
    });
  }

  return quickWins;
}

// ============================================================================
// Priority Actions
// ============================================================================

/**
 * Get top priority actions for today
 */
export function getPriorityActions(
  insights: MediaInsight[],
  maxCount: number = 3
): MediaNextRecommendation[] {
  // Filter to critical and warning only
  const urgentInsights = insights.filter(i =>
    i.severity === 'critical' || i.severity === 'warning'
  );

  // Sort by severity
  const sorted = [...urgentInsights].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return 0;
  });

  return sorted.slice(0, maxCount).map(mapInsightToRecommendation);
}

// ============================================================================
// Action Type Labels
// ============================================================================

export const ACTION_TYPE_LABELS: Record<MediaNextRecommendation['actionType'], {
  label: string;
  icon: string;
  color: string;
}> = {
  optimize: {
    label: 'Optimize',
    icon: 'tune',
    color: 'text-amber-400',
  },
  investigate: {
    label: 'Investigate',
    icon: 'search',
    color: 'text-blue-400',
  },
  expand: {
    label: 'Expand',
    icon: 'trending-up',
    color: 'text-emerald-400',
  },
  review: {
    label: 'Review',
    icon: 'eye',
    color: 'text-slate-400',
  },
};

export const PRIORITY_LABELS: Record<MediaNextRecommendation['priority'], {
  label: string;
  color: string;
  bgColor: string;
}> = {
  high: {
    label: 'High Priority',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  medium: {
    label: 'Medium Priority',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  low: {
    label: 'Low Priority',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
  },
};
