// lib/os/companies/workSummary.ts
// Work Summary helper for Overview page
//
// Fetches active work items and recently completed items for a company.

import { getWorkItemsForCompany, type WorkItemRecord, type WorkItemStatus, type WorkItemArea, type WorkItemSeverity } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

export interface CompanyWorkSummaryItem {
  id: string;
  title: string;
  status: WorkItemStatus | string;
  area?: WorkItemArea | null;
  severity?: WorkItemSeverity | null;
  updatedAt?: string | null;
  dueDate?: string | null;
}

export interface CompanyWorkSummary {
  active: CompanyWorkSummaryItem[];      // Backlog + In Progress + Planned, top N
  doneRecently: CompanyWorkSummaryItem[]; // Done in last 14 days
  counts: {
    active: number;
    inProgress: number;
    doneRecently: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  } catch {
    return false;
  }
}

function workItemToSummaryItem(item: WorkItemRecord): CompanyWorkSummaryItem {
  return {
    id: item.id,
    title: item.title,
    status: item.status || 'Backlog',
    area: item.area || null,
    severity: item.severity || null,
    updatedAt: item.updatedAt || item.createdAt || null,
    dueDate: item.dueDate || null,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get work summary for a company
 *
 * Returns:
 * - active: Work items that are not Done (Backlog, Planned, In Progress), limited to top 5
 * - doneRecently: Work items completed in the last 14 days, limited to 5
 * - counts: Summary counts for display
 */
export async function getCompanyWorkSummary(companyId: string): Promise<CompanyWorkSummary> {
  console.log('[WorkSummary] Getting work summary for company:', companyId);

  try {
    const allItems = await getWorkItemsForCompany(companyId);

    // Separate active and done items
    const activeItems: WorkItemRecord[] = [];
    const doneItems: WorkItemRecord[] = [];
    let inProgressCount = 0;

    for (const item of allItems) {
      if (item.status === 'Done') {
        // Only include items done in the last 14 days
        if (isWithinDays(item.updatedAt || item.createdAt, 14)) {
          doneItems.push(item);
        }
      } else {
        activeItems.push(item);
        if (item.status === 'In Progress') {
          inProgressCount++;
        }
      }
    }

    // Sort active items by priority: In Progress > Planned > Backlog, then by severity
    const severityOrder: Record<string, number> = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4,
      Info: 5,
    };

    const statusOrder: Record<string, number> = {
      'In Progress': 1,
      Planned: 2,
      Backlog: 3,
    };

    activeItems.sort((a, b) => {
      const statusDiff = (statusOrder[a.status || 'Backlog'] || 99) - (statusOrder[b.status || 'Backlog'] || 99);
      if (statusDiff !== 0) return statusDiff;

      const severityDiff = (severityOrder[a.severity || 'Medium'] || 3) - (severityOrder[b.severity || 'Medium'] || 3);
      if (severityDiff !== 0) return severityDiff;

      // Finally sort by due date (items with due dates first)
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      return 0;
    });

    // Sort done items by updated date, most recent first
    doneItems.sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || '';
      const bDate = b.updatedAt || b.createdAt || '';
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    const summary: CompanyWorkSummary = {
      active: activeItems.slice(0, 5).map(workItemToSummaryItem),
      doneRecently: doneItems.slice(0, 5).map(workItemToSummaryItem),
      counts: {
        active: activeItems.length,
        inProgress: inProgressCount,
        doneRecently: doneItems.length,
      },
    };

    console.log('[WorkSummary] Summary generated:', {
      active: summary.counts.active,
      inProgress: summary.counts.inProgress,
      doneRecently: summary.counts.doneRecently,
    });

    return summary;
  } catch (error) {
    console.error('[WorkSummary] Error getting work summary:', error);
    return {
      active: [],
      doneRecently: [],
      counts: {
        active: 0,
        inProgress: 0,
        doneRecently: 0,
      },
    };
  }
}
