// lib/os/programs/runbook.ts
// Runbook Mode - Weekly Operator Checklist for Enterprise Accounts
//
// Provides structured checklists grouped by Program Domain for operational
// consistency. Supports Car Toys Standard intensity as default template.
//
// Key Features:
// - Domain-grouped checklist items
// - Idempotent weekly completion tracking
// - Automatic weekly reset
// - Completion percentage calculation

import { z } from 'zod';
import type { ProgramDomain, IntensityLevel } from '@/lib/types/programTemplate';

// ============================================================================
// Types
// ============================================================================

export const RunbookItemStatusSchema = z.enum(['pending', 'completed', 'skipped']);
export type RunbookItemStatus = z.infer<typeof RunbookItemStatusSchema>;

export interface RunbookItem {
  id: string;
  title: string;
  description?: string;
  domain: ProgramDomain;
  cadence: 'weekly' | 'monthly';
  /** Link to relevant program (optional) */
  programId?: string;
  /** Tags for filtering */
  tags?: string[];
}

export interface RunbookCompletion {
  itemId: string;
  weekKey: string; // Format: YYYY-Www (e.g., 2025-W03)
  status: RunbookItemStatus;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface RunbookChecklistItem extends RunbookItem {
  status: RunbookItemStatus;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface RunbookSummary {
  weekKey: string;
  totalItems: number;
  completedItems: number;
  skippedItems: number;
  pendingItems: number;
  completionPercentage: number;
  byDomain: Record<ProgramDomain, {
    total: number;
    completed: number;
    pending: number;
  }>;
}

// ============================================================================
// Week Key Generation (ISO Week)
// ============================================================================

/**
 * Get the ISO week key for a date
 * Format: YYYY-Www (e.g., 2025-W03)
 */
export function getWeekKey(date: Date = new Date()): string {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tempDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Check if a week key is the current week
 */
export function isCurrentWeek(weekKey: string): boolean {
  return weekKey === getWeekKey();
}

/**
 * Generate idempotency key for runbook completion
 */
export function generateRunbookCompletionKey(
  companyId: string,
  itemId: string,
  weekKey: string
): string {
  return `runbook:${companyId}:${itemId}:${weekKey}`;
}

// ============================================================================
// Default Runbook Templates
// ============================================================================

/**
 * Car Toys Standard Runbook Items
 * Grouped by domain with weekly operational tasks
 */
export const CAR_TOYS_STANDARD_RUNBOOK: RunbookItem[] = [
  // Media Weekly
  {
    id: 'media-pmax-cycle',
    title: 'PMAX Cycle Review',
    description: 'Review Performance Max campaign performance and adjust asset groups',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['pmax', 'google-ads'],
  },
  {
    id: 'media-asc-cycle',
    title: 'ASC Cycle Review',
    description: 'Review Advantage Shopping campaigns and budget allocation',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['asc', 'meta'],
  },
  {
    id: 'media-search-cycle',
    title: 'Search Campaign Cycle',
    description: 'Review search campaigns, keywords, and bid adjustments',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['search', 'google-ads'],
  },
  {
    id: 'media-retargeting',
    title: 'Retargeting Review',
    description: 'Check retargeting audiences and creative refresh needs',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['retargeting', 'audiences'],
  },
  {
    id: 'media-lsa-optimization',
    title: 'LSA Optimization',
    description: 'Review Local Service Ads performance and adjust bids by location',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['lsa', 'local'],
  },
  {
    id: 'media-store-budget',
    title: 'Store Budget Allocation Check',
    description: 'Verify budget distribution across store locations',
    domain: 'Media',
    cadence: 'weekly',
    tags: ['budget', 'stores'],
  },

  // Creative Weekly
  {
    id: 'creative-variation-set',
    title: 'New Variation Set',
    description: 'Create new ad creative variations for testing',
    domain: 'Creative',
    cadence: 'weekly',
    tags: ['creative', 'testing'],
  },
  {
    id: 'creative-price-forward',
    title: 'Refresh Price-Forward Assets',
    description: 'Update price-focused creative with current promotions',
    domain: 'Creative',
    cadence: 'weekly',
    tags: ['pricing', 'promotions'],
  },
  {
    id: 'creative-testing-hypotheses',
    title: 'Testing Hypotheses Update',
    description: 'Review creative test results and update hypotheses',
    domain: 'Creative',
    cadence: 'weekly',
    tags: ['testing', 'learnings'],
  },

  // Local Visibility Weekly
  {
    id: 'local-gbp-refresh',
    title: 'GBP Post/Media Refresh',
    description: 'Update Google Business Profile posts and media',
    domain: 'LocalVisibility',
    cadence: 'weekly',
    tags: ['gbp', 'local'],
  },
  {
    id: 'local-review-monitoring',
    title: 'Review Monitoring',
    description: 'Monitor and respond to new customer reviews',
    domain: 'LocalVisibility',
    cadence: 'weekly',
    tags: ['reviews', 'reputation'],
  },

  // Analytics Weekly
  {
    id: 'analytics-dashboard-refresh',
    title: 'Dashboard Refresh',
    description: 'Update analytics dashboards with latest data and insights',
    domain: 'Analytics',
    cadence: 'weekly',
    tags: ['dashboards', 'reporting'],
  },
  {
    id: 'analytics-signal-audit',
    title: 'Signal Audit Check',
    description: 'Verify conversion signals and tracking accuracy',
    domain: 'Analytics',
    cadence: 'weekly',
    tags: ['signals', 'tracking'],
  },

  // Operations Weekly
  {
    id: 'ops-weekly-sync',
    title: 'Weekly Status Sync',
    description: 'Conduct weekly status sync with stakeholders',
    domain: 'Operations',
    cadence: 'weekly',
    tags: ['sync', 'communication'],
  },
  {
    id: 'ops-blockers-review',
    title: 'Blockers Review',
    description: 'Review and address any blockers across programs',
    domain: 'Operations',
    cadence: 'weekly',
    tags: ['blockers', 'resolution'],
  },
];

/**
 * Get runbook items for a specific intensity level
 * Core: fewer items, Aggressive: more items
 */
export function getRunbookForIntensity(
  intensity: IntensityLevel
): RunbookItem[] {
  // For now, all intensities use the same base runbook
  // Can be expanded to add/remove items per intensity
  switch (intensity) {
    case 'Core':
      // Core: essential items only
      return CAR_TOYS_STANDARD_RUNBOOK.filter(item =>
        ['media-pmax-cycle', 'media-search-cycle', 'analytics-dashboard-refresh', 'ops-weekly-sync'].includes(item.id)
      );
    case 'Aggressive':
      // Aggressive: all items plus extras
      return CAR_TOYS_STANDARD_RUNBOOK;
    case 'Standard':
    default:
      return CAR_TOYS_STANDARD_RUNBOOK;
  }
}

/**
 * Get runbook items grouped by domain
 */
export function groupRunbookByDomain(
  items: RunbookItem[]
): Record<ProgramDomain, RunbookItem[]> {
  const grouped: Record<ProgramDomain, RunbookItem[]> = {
    Strategy: [],
    Creative: [],
    Media: [],
    LocalVisibility: [],
    Analytics: [],
    Operations: [],
  };

  for (const item of items) {
    grouped[item.domain].push(item);
  }

  return grouped;
}

// ============================================================================
// In-Memory Store (for completion tracking)
// In production, this would be persisted to Airtable or a database
// ============================================================================

const completionStore = new Map<string, RunbookCompletion>();

/**
 * Mark a runbook item as completed for the current week
 */
export function markRunbookItemComplete(
  companyId: string,
  itemId: string,
  options: {
    completedBy?: string;
    notes?: string;
    weekKey?: string;
  } = {}
): RunbookCompletion {
  const weekKey = options.weekKey || getWeekKey();
  const key = generateRunbookCompletionKey(companyId, itemId, weekKey);

  const completion: RunbookCompletion = {
    itemId,
    weekKey,
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: options.completedBy,
    notes: options.notes,
  };

  completionStore.set(key, completion);
  return completion;
}

/**
 * Mark a runbook item as skipped for the current week
 */
export function markRunbookItemSkipped(
  companyId: string,
  itemId: string,
  options: {
    completedBy?: string;
    notes?: string;
    weekKey?: string;
  } = {}
): RunbookCompletion {
  const weekKey = options.weekKey || getWeekKey();
  const key = generateRunbookCompletionKey(companyId, itemId, weekKey);

  const completion: RunbookCompletion = {
    itemId,
    weekKey,
    status: 'skipped',
    completedAt: new Date().toISOString(),
    completedBy: options.completedBy,
    notes: options.notes,
  };

  completionStore.set(key, completion);
  return completion;
}

/**
 * Reset a runbook item to pending for the current week
 */
export function resetRunbookItem(
  companyId: string,
  itemId: string,
  weekKey?: string
): void {
  const week = weekKey || getWeekKey();
  const key = generateRunbookCompletionKey(companyId, itemId, week);
  completionStore.delete(key);
}

/**
 * Get completion status for a runbook item
 */
export function getRunbookItemCompletion(
  companyId: string,
  itemId: string,
  weekKey?: string
): RunbookCompletion | null {
  const week = weekKey || getWeekKey();
  const key = generateRunbookCompletionKey(companyId, itemId, week);
  return completionStore.get(key) || null;
}

/**
 * Get all completions for a company for a specific week
 */
export function getWeekCompletions(
  companyId: string,
  weekKey?: string
): RunbookCompletion[] {
  const week = weekKey || getWeekKey();
  const prefix = `runbook:${companyId}:`;
  const suffix = `:${week}`;

  const completions: RunbookCompletion[] = [];
  for (const [key, completion] of completionStore) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      completions.push(completion);
    }
  }

  return completions;
}

/**
 * Build the runbook checklist with completion status
 */
export function buildRunbookChecklist(
  companyId: string,
  items: RunbookItem[],
  weekKey?: string
): RunbookChecklistItem[] {
  const week = weekKey || getWeekKey();

  return items.map(item => {
    const completion = getRunbookItemCompletion(companyId, item.id, week);
    return {
      ...item,
      status: completion?.status || 'pending',
      completedAt: completion?.completedAt,
      completedBy: completion?.completedBy,
      notes: completion?.notes,
    };
  });
}

/**
 * Calculate runbook summary for a company
 */
export function calculateRunbookSummary(
  companyId: string,
  items: RunbookItem[],
  weekKey?: string
): RunbookSummary {
  const week = weekKey || getWeekKey();
  const checklist = buildRunbookChecklist(companyId, items, week);

  const byDomain: Record<ProgramDomain, { total: number; completed: number; pending: number }> = {
    Strategy: { total: 0, completed: 0, pending: 0 },
    Creative: { total: 0, completed: 0, pending: 0 },
    Media: { total: 0, completed: 0, pending: 0 },
    LocalVisibility: { total: 0, completed: 0, pending: 0 },
    Analytics: { total: 0, completed: 0, pending: 0 },
    Operations: { total: 0, completed: 0, pending: 0 },
  };

  let completed = 0;
  let skipped = 0;
  let pending = 0;

  for (const item of checklist) {
    byDomain[item.domain].total++;

    if (item.status === 'completed') {
      completed++;
      byDomain[item.domain].completed++;
    } else if (item.status === 'skipped') {
      skipped++;
    } else {
      pending++;
      byDomain[item.domain].pending++;
    }
  }

  const total = checklist.length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    weekKey: week,
    totalItems: total,
    completedItems: completed,
    skippedItems: skipped,
    pendingItems: pending,
    completionPercentage,
    byDomain,
  };
}

/**
 * Clear all completions (for testing)
 */
export function clearRunbookCompletions(): void {
  completionStore.clear();
}

// ============================================================================
// Domain Display Helpers
// ============================================================================

export const DOMAIN_DISPLAY_NAMES: Record<ProgramDomain, string> = {
  Strategy: 'Strategy',
  Creative: 'Creative',
  Media: 'Media',
  LocalVisibility: 'Local Visibility',
  Analytics: 'Analytics',
  Operations: 'Operations',
};

export const DOMAIN_DISPLAY_ORDER: ProgramDomain[] = [
  'Strategy',
  'Media',
  'Creative',
  'LocalVisibility',
  'Analytics',
  'Operations',
];
