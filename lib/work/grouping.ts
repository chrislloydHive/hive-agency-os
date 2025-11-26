// lib/work/grouping.ts
// Utilities for grouping work items into time buckets
// This file should NOT import any server-only code

import {
  isToday,
  isPast,
  isThisWeek,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { WorkItem } from '@/lib/types/work';

// ============================================================================
// Time Bucket Types
// ============================================================================

/**
 * Time bucket keys for work item grouping
 */
export type TimeBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_date';

/**
 * Time bucket display configuration
 */
export const TIME_BUCKET_CONFIG: Record<TimeBucket, { label: string; color: string; priority: number }> = {
  overdue: { label: 'Overdue', color: 'red', priority: 1 },
  today: { label: 'Today', color: 'blue', priority: 2 },
  this_week: { label: 'This Week', color: 'yellow', priority: 3 },
  later: { label: 'Later', color: 'gray', priority: 4 },
  no_date: { label: 'No Due Date', color: 'gray', priority: 5 },
};

/**
 * Work items grouped by time bucket
 */
export interface GroupedWorkItems {
  overdue: WorkItem[];
  today: WorkItem[];
  this_week: WorkItem[];
  later: WorkItem[];
  no_date: WorkItem[];
}

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * Get the time bucket for a work item based on its due date
 */
export function getTimeBucket(dueDate: string | undefined | null): TimeBucket {
  if (!dueDate) {
    return 'no_date';
  }

  try {
    const date = parseISO(dueDate);
    const todayStart = startOfDay(new Date());

    // Check if overdue (past and not today)
    if (isPast(date) && !isToday(date)) {
      return 'overdue';
    }

    // Check if today
    if (isToday(date)) {
      return 'today';
    }

    // Check if this week (but not today)
    if (isThisWeek(date, { weekStartsOn: 1 })) {
      return 'this_week';
    }

    // Everything else is later
    return 'later';
  } catch {
    return 'no_date';
  }
}

/**
 * Group work items into time buckets
 */
export function groupWorkItemsByTimeBucket(items: WorkItem[]): GroupedWorkItems {
  const groups: GroupedWorkItems = {
    overdue: [],
    today: [],
    this_week: [],
    later: [],
    no_date: [],
  };

  for (const item of items) {
    const bucket = getTimeBucket(item.dueDate);
    groups[bucket].push(item);
  }

  // Sort each bucket by priority (P0 first), then by due date
  const sortByPriorityAndDate = (a: WorkItem, b: WorkItem): number => {
    // First, sort by priority (P0 > P1 > P2 > P3)
    const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    const aPriority = a.priority ? priorityOrder[a.priority] ?? 99 : 99;
    const bPriority = b.priority ? priorityOrder[b.priority] ?? 99 : 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then by due date (earlier first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return 0;
  };

  groups.overdue.sort(sortByPriorityAndDate);
  groups.today.sort(sortByPriorityAndDate);
  groups.this_week.sort(sortByPriorityAndDate);
  groups.later.sort(sortByPriorityAndDate);
  groups.no_date.sort(sortByPriorityAndDate);

  return groups;
}

/**
 * Get total count of work items across all buckets
 */
export function getTotalWorkItemCount(groups: GroupedWorkItems): number {
  return (
    groups.overdue.length +
    groups.today.length +
    groups.this_week.length +
    groups.later.length +
    groups.no_date.length
  );
}

/**
 * Get the bucket label with count
 */
export function getBucketLabelWithCount(bucket: TimeBucket, count: number): string {
  const config = TIME_BUCKET_CONFIG[bucket];
  return `${config.label} (${count})`;
}

/**
 * Check if a bucket has items
 */
export function bucketHasItems(groups: GroupedWorkItems, bucket: TimeBucket): boolean {
  return groups[bucket].length > 0;
}

/**
 * Get non-empty buckets in display order
 */
export function getNonEmptyBuckets(groups: GroupedWorkItems): TimeBucket[] {
  const allBuckets: TimeBucket[] = ['overdue', 'today', 'this_week', 'later', 'no_date'];
  return allBuckets.filter(bucket => groups[bucket].length > 0);
}

// ============================================================================
// Filter Helpers
// ============================================================================

/**
 * Filter work items by owner
 */
export function filterByOwner(items: WorkItem[], ownerName: string | null): WorkItem[] {
  if (!ownerName) return items;
  return items.filter(item => item.ownerName === ownerName);
}

/**
 * Filter work items by status
 */
export function filterByStatus(items: WorkItem[], status: string | null): WorkItem[] {
  if (!status) return items;
  return items.filter(item => item.status === status);
}

/**
 * Filter work items by category
 */
export function filterByCategory(items: WorkItem[], category: string | null): WorkItem[] {
  if (!category) return items;
  return items.filter(item => item.category === category || item.area?.toLowerCase() === category);
}

/**
 * Get unique owner names from work items
 */
export function getUniqueOwners(items: WorkItem[]): string[] {
  const owners = new Set<string>();
  for (const item of items) {
    if (item.ownerName) {
      owners.add(item.ownerName);
    }
  }
  return Array.from(owners).sort();
}

/**
 * Get unique statuses from work items
 */
export function getUniqueStatuses(items: WorkItem[]): string[] {
  const statuses = new Set<string>();
  for (const item of items) {
    if (item.status) {
      statuses.add(item.status);
    }
  }
  return Array.from(statuses);
}
