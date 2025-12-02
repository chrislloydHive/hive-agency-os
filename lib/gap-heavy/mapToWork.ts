// lib/gap-heavy/mapToWork.ts
// Maps GAP Heavy strategic intelligence to Work Items
//
// This module provides functions to convert GapHeavyResult outputs into
// candidate Work Items for the Hive OS Work system.

import type {
  GapHeavyResult,
  GapHeavyStrategicPriority,
  GapHeavyOpportunity,
  GapHeavyFunnelGap,
} from './strategicTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * Work Item category aligned with Hive OS Work system
 */
export type WorkItemCategory =
  | 'brand'
  | 'content'
  | 'seo'
  | 'website'
  | 'analytics'
  | 'ops'
  | 'demand'
  | 'other';

/**
 * Work Item priority aligned with Hive OS Work system
 */
export type WorkItemPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * A candidate Work Item derived from GAP Heavy analysis
 */
export interface GapHeavyWorkItem {
  /** Title of the work item */
  title: string;
  /** Detailed description */
  description: string;
  /** Category for the work item */
  category: WorkItemCategory;
  /** Priority level */
  priority: WorkItemPriority;
  /** Source type from GAP Heavy */
  sourceType: 'strategic_priority' | 'category_opportunity' | 'content_opportunity' | 'funnel_gap';
  /** Source ID from GAP Heavy */
  sourceId: string;
  /** Expected impact */
  expectedImpact: 'high' | 'medium' | 'low';
  /** Time horizon */
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
  /** Strategic rationale (why this matters) */
  rationale?: string;
}

/**
 * Work Items package from GAP Heavy
 */
export interface GapHeavyWorkPackage {
  /** All candidate work items */
  workItems: GapHeavyWorkItem[];
  /** High-priority items (P0/P1) */
  highPriorityItems: GapHeavyWorkItem[];
  /** Quick wins (high impact, near-term) */
  quickWins: GapHeavyWorkItem[];
  /** Data confidence from source analysis */
  dataConfidence: number;
  /** Source timestamp */
  sourceCreatedAt: string;
}

// ============================================================================
// Main Mapping Function
// ============================================================================

/**
 * Map GAP Heavy result to Work Items package
 *
 * This converts strategic priorities, opportunities, and funnel gaps into
 * candidate Work Items that can be added to the Hive OS Work system.
 *
 * @param result - GAP Heavy strategic intelligence result
 * @returns Work Items package
 */
export function mapGapHeavyToWork(result: GapHeavyResult): GapHeavyWorkPackage {
  const workItems: GapHeavyWorkItem[] = [];

  // Map strategic priorities to work items (highest priority)
  for (const priority of result.strategicPriorities) {
    workItems.push(...mapPriorityToWorkItems(priority));
  }

  // Map category opportunities to work items
  for (const opportunity of result.categoryOpportunities) {
    workItems.push(mapOpportunityToWorkItem(opportunity, 'category_opportunity'));
  }

  // Map content opportunities to work items
  for (const opportunity of result.contentOpportunities) {
    workItems.push(mapOpportunityToWorkItem(opportunity, 'content_opportunity'));
  }

  // Map funnel gaps to work items
  for (const gap of result.funnelGaps) {
    workItems.push(mapFunnelGapToWorkItem(gap));
  }

  // Sort by priority
  workItems.sort((a, b) => {
    const priorityOrder: Record<WorkItemPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Identify high-priority items
  const highPriorityItems = workItems.filter(w => w.priority === 'P0' || w.priority === 'P1');

  // Identify quick wins (high impact + near-term)
  const quickWins = workItems.filter(
    w => w.expectedImpact === 'high' && w.timeHorizon === 'near-term'
  );

  return {
    workItems,
    highPriorityItems,
    quickWins,
    dataConfidence: result.dataConfidence,
    sourceCreatedAt: result.createdAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a strategic priority to work items
 *
 * Strategic priorities may generate multiple work items (one per recommended play)
 */
function mapPriorityToWorkItems(priority: GapHeavyStrategicPriority): GapHeavyWorkItem[] {
  const items: GapHeavyWorkItem[] = [];

  // Create a work item for each recommended play
  for (const play of priority.recommendedPlays) {
    items.push({
      title: play.length > 80 ? play.slice(0, 77) + '...' : play,
      description: `${play}\n\nStrategic Context: ${priority.whyItMatters}`,
      category: inferCategoryFromPriority(priority),
      priority: 'P1', // Strategic priorities are high priority
      sourceType: 'strategic_priority',
      sourceId: priority.id,
      expectedImpact: 'high',
      timeHorizon: 'near-term',
      rationale: priority.whyItMatters,
    });
  }

  // If no plays, create a single work item for the priority itself
  if (items.length === 0) {
    items.push({
      title: priority.title,
      description: priority.whyItMatters,
      category: inferCategoryFromPriority(priority),
      priority: 'P1',
      sourceType: 'strategic_priority',
      sourceId: priority.id,
      expectedImpact: 'high',
      timeHorizon: 'mid-term',
      rationale: priority.whyItMatters,
    });
  }

  return items;
}

/**
 * Map an opportunity to a work item
 */
function mapOpportunityToWorkItem(
  opportunity: GapHeavyOpportunity,
  sourceType: 'category_opportunity' | 'content_opportunity'
): GapHeavyWorkItem {
  return {
    title: opportunity.title,
    description: opportunity.description,
    category: mapOpportunityCategoryToWorkCategory(opportunity.category),
    priority: mapImpactToPriority(opportunity.expectedImpact),
    sourceType,
    sourceId: opportunity.id,
    expectedImpact: opportunity.expectedImpact,
    timeHorizon: opportunity.timeHorizon,
  };
}

/**
 * Map a funnel gap to a work item
 */
function mapFunnelGapToWorkItem(gap: GapHeavyFunnelGap): GapHeavyWorkItem {
  return {
    title: `Fix: ${gap.title}`,
    description: `${gap.description}\n\nFunnel Stage: ${gap.stage}`,
    category: mapFunnelStageToWorkCategory(gap.stage),
    priority: mapSeverityToPriority(gap.severity),
    sourceType: 'funnel_gap',
    sourceId: gap.id,
    expectedImpact: gap.severity === 'high' ? 'high' : gap.severity === 'medium' ? 'medium' : 'low',
    timeHorizon: gap.severity === 'high' ? 'near-term' : 'mid-term',
    rationale: `Funnel gap at ${gap.stage} stage with ${gap.severity} severity`,
  };
}

/**
 * Infer work category from strategic priority
 */
function inferCategoryFromPriority(priority: GapHeavyStrategicPriority): WorkItemCategory {
  const titleLower = priority.title.toLowerCase();
  const whyLower = priority.whyItMatters.toLowerCase();
  const combined = `${titleLower} ${whyLower}`;

  if (combined.includes('seo') || combined.includes('search') || combined.includes('ranking')) {
    return 'seo';
  }
  if (combined.includes('content') || combined.includes('blog') || combined.includes('article')) {
    return 'content';
  }
  if (combined.includes('brand') || combined.includes('positioning') || combined.includes('message')) {
    return 'brand';
  }
  if (combined.includes('website') || combined.includes('conversion') || combined.includes('ux')) {
    return 'website';
  }
  if (combined.includes('demand') || combined.includes('lead') || combined.includes('funnel')) {
    return 'demand';
  }
  if (combined.includes('analytics') || combined.includes('tracking') || combined.includes('data')) {
    return 'analytics';
  }

  return 'other';
}

/**
 * Map opportunity category to work category
 */
function mapOpportunityCategoryToWorkCategory(
  category: GapHeavyOpportunity['category']
): WorkItemCategory {
  switch (category) {
    case 'category':
      return 'seo'; // Category opportunities are typically SEO-related
    case 'content':
      return 'content';
    case 'funnel':
      return 'demand';
    case 'local':
      return 'seo';
    case 'social':
      return 'demand';
    case 'brand':
      return 'brand';
    default:
      return 'other';
  }
}

/**
 * Map funnel stage to work category
 */
function mapFunnelStageToWorkCategory(
  stage: GapHeavyFunnelGap['stage']
): WorkItemCategory {
  switch (stage) {
    case 'awareness':
      return 'content';
    case 'consideration':
      return 'website';
    case 'decision':
      return 'demand';
    case 'post-purchase':
      return 'ops';
    default:
      return 'other';
  }
}

/**
 * Map impact level to work priority
 */
function mapImpactToPriority(impact: 'high' | 'medium' | 'low'): WorkItemPriority {
  switch (impact) {
    case 'high':
      return 'P1';
    case 'medium':
      return 'P2';
    case 'low':
      return 'P3';
  }
}

/**
 * Map severity to work priority
 */
function mapSeverityToPriority(severity: 'high' | 'medium' | 'low'): WorkItemPriority {
  switch (severity) {
    case 'high':
      return 'P0'; // Funnel gaps with high severity are critical
    case 'medium':
      return 'P2';
    case 'low':
      return 'P3';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get work items by category
 */
export function getWorkItemsByCategory(
  workPackage: GapHeavyWorkPackage,
  category: WorkItemCategory
): GapHeavyWorkItem[] {
  return workPackage.workItems.filter(w => w.category === category);
}

/**
 * Get work items by source type
 */
export function getWorkItemsBySourceType(
  workPackage: GapHeavyWorkPackage,
  sourceType: GapHeavyWorkItem['sourceType']
): GapHeavyWorkItem[] {
  return workPackage.workItems.filter(w => w.sourceType === sourceType);
}

/**
 * Get a summary of work items by priority
 */
export function getWorkItemSummary(
  workPackage: GapHeavyWorkPackage
): Record<WorkItemPriority, number> {
  const summary: Record<WorkItemPriority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const item of workPackage.workItems) {
    summary[item.priority]++;
  }
  return summary;
}
