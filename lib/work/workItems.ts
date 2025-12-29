// lib/work/workItems.ts
// Work Item CRUD operations

import { base } from '@/lib/airtable/client';
import type { WorkItem, WorkItemArea, WorkItemStatus, WorkCategory } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

export interface CreateWorkItemInput {
  companyId: string;
  title: string;
  description?: string;
  area?: string;
  priority?: 'high' | 'medium' | 'low' | 'P0' | 'P1' | 'P2' | 'P3';
  status?: 'pending' | 'in_progress' | 'done' | 'Backlog' | 'Planned' | 'In Progress' | 'Done';
  dueDate?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  area?: string;
  priority?: string;
  status?: string;
  dueDate?: string | null;
}


// ============================================================================
// Field Mappings
// ============================================================================

const WORK_ITEMS_FIELDS = {
  TITLE: 'Title',
  COMPANY: 'Company',
  AREA: 'Area',
  STATUS: 'Status',
  SEVERITY: 'Severity',
  NOTES: 'Notes',
  DUE_DATE: 'Due Date',
} as const;

// Using WorkItemArea and WorkItemStatus from @/lib/types/work
type WorkItemSeverity = 'High' | 'Medium' | 'Low';

function mapToArea(area?: string): WorkItemArea {
  const mapping: Record<string, WorkItemArea> = {
    'Strategy': 'Strategy',
    'Website UX': 'Website UX',
    'Website': 'Website UX',
    'Brand': 'Brand',
    'Content': 'Content',
    'SEO': 'SEO',
    'Funnel': 'Funnel',
    'Media & Advertising': 'Strategy',
    'Analytics & Reporting': 'Strategy',
    'Creative': 'Content',
    'Other': 'Other',
  };
  return mapping[area || ''] || 'Other';
}

function mapToStatus(status?: string): WorkItemStatus {
  const mapping: Record<string, WorkItemStatus> = {
    'pending': 'Planned',
    'in_progress': 'In Progress',
    'done': 'Done',
    'Backlog': 'Backlog',
    'Planned': 'Planned',
    'In Progress': 'In Progress',
    'Done': 'Done',
  };
  return mapping[status || ''] || 'Planned';
}

function mapToSeverity(priority?: string): WorkItemSeverity {
  const mapping: Record<string, WorkItemSeverity> = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    'P0': 'High',
    'P1': 'High',
    'P2': 'Medium',
    'P3': 'Low',
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low',
  };
  return mapping[priority || ''] || 'Medium';
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new work item
 */
export async function createWorkItem(input: CreateWorkItemInput): Promise<WorkItem | null> {
  try {
    // Build notes with source attribution
    const notesParts: string[] = [];
    if (input.sourceType) {
      notesParts.push(`Source: ${input.sourceType}`);
    }
    if (input.description) {
      notesParts.push(input.description);
    }
    const notes = notesParts.join('\n\n');

    const fields: Record<string, unknown> = {
      [WORK_ITEMS_FIELDS.TITLE]: input.title,
      [WORK_ITEMS_FIELDS.COMPANY]: [input.companyId],
      [WORK_ITEMS_FIELDS.AREA]: mapToArea(input.area),
      [WORK_ITEMS_FIELDS.STATUS]: mapToStatus(input.status),
      [WORK_ITEMS_FIELDS.SEVERITY]: mapToSeverity(input.priority),
      [WORK_ITEMS_FIELDS.NOTES]: notes,
    };

    if (input.dueDate) {
      fields[WORK_ITEMS_FIELDS.DUE_DATE] = input.dueDate;
    }

    const records = await base('Work Items').create([{ fields }] as any);

    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      title: input.title,
      notes,
      companyId: input.companyId,
      area: mapToArea(input.area),
      status: mapToStatus(input.status),
      priority: mapToSeverity(input.priority) === 'High' ? 'P1' : mapToSeverity(input.priority) === 'Low' ? 'P3' : 'P2',
      dueDate: input.dueDate || undefined,
    };
  } catch (error) {
    console.error('[WorkItems] Error creating work item:', error);
    return null;
  }
}

/**
 * Get work items for a company
 */
export async function getWorkItems(companyId: string): Promise<WorkItem[]> {
  try {
    const records = await base('Work Items')
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN({Company}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      title: record.get('Title') as string || '',
      notes: record.get('Notes') as string || '',
      companyId,
      area: (record.get('Area') as WorkItemArea) || 'Other',
      status: (record.get('Status') as WorkItemStatus) || 'Backlog',
      priority: mapPriorityFromSeverity(record.get('Severity') as string),
      dueDate: (record.get('Due Date') as string) || undefined,
      ownerName: (record.get('Owner Name') as string) || undefined,
      category: (record.get('Category') as WorkCategory) || undefined,
    }));
  } catch (error) {
    console.error('[WorkItems] Error fetching work items:', error);
    return [];
  }
}

/**
 * Update a work item
 */
export async function updateWorkItem(
  workItemId: string,
  updates: UpdateWorkItemInput
): Promise<WorkItem | null> {
  try {
    const fields: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      fields[WORK_ITEMS_FIELDS.TITLE] = updates.title;
    }
    if (updates.description !== undefined) {
      fields[WORK_ITEMS_FIELDS.NOTES] = updates.description;
    }
    if (updates.area !== undefined) {
      fields[WORK_ITEMS_FIELDS.AREA] = mapToArea(updates.area);
    }
    if (updates.status !== undefined) {
      fields[WORK_ITEMS_FIELDS.STATUS] = mapToStatus(updates.status);
    }
    if (updates.priority !== undefined) {
      fields[WORK_ITEMS_FIELDS.SEVERITY] = mapToSeverity(updates.priority);
    }
    if (updates.dueDate !== undefined) {
      fields[WORK_ITEMS_FIELDS.DUE_DATE] = updates.dueDate;
    }

    const records = await base('Work Items').update([{
      id: workItemId,
      fields,
    }] as any);

    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      title: record.get('Title') as string || '',
      notes: record.get('Notes') as string || '',
      companyId: (record.get('Company') as string[])?.[0] || '',
      area: (record.get('Area') as WorkItemArea) || 'Other',
      status: (record.get('Status') as WorkItemStatus) || 'Backlog',
      priority: mapPriorityFromSeverity(record.get('Severity') as string),
      dueDate: (record.get('Due Date') as string) || undefined,
    };
  } catch (error) {
    console.error('[WorkItems] Error updating work item:', error);
    return null;
  }
}

/**
 * Delete a work item
 */
export async function deleteWorkItem(workItemId: string): Promise<boolean> {
  try {
    await base('Work Items').destroy([workItemId]);
    return true;
  } catch (error) {
    console.error('[WorkItems] Error deleting work item:', error);
    return false;
  }
}

// Helper to map Airtable severity to priority
function mapPriorityFromSeverity(severity?: string): 'P0' | 'P1' | 'P2' | 'P3' {
  switch (severity) {
    case 'High':
      return 'P1';
    case 'Medium':
      return 'P2';
    case 'Low':
      return 'P3';
    default:
      return 'P2';
  }
}
