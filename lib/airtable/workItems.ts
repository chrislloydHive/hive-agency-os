/**
 * Work Items - Airtable helper
 *
 * Manages Work Items table which tracks real initiatives/tasks
 * derived from OS priorities or created manually.
 */

import { base } from './client';
import type { PriorityItem } from './fullReports';
import type { PlanInitiative } from '@/lib/gap/types';
import type { WorkSource, WorkSourceAnalytics } from '@/lib/types/work';

/**
 * Work Items table field names (matching Airtable schema exactly)
 */
const WORK_ITEMS_FIELDS = {
  TITLE: 'Title',
  COMPANY: 'Company',
  FULL_REPORT: 'Full Report',
  AREA: 'Area',
  STATUS: 'Status',
  SEVERITY: 'Severity',
  OWNER: 'Owner',
  OWNER_NAME: 'Owner Name', // Lookup from Owner (linked record)
  DUE_DATE: 'Due Date',
  NOTES: 'Notes',
  PRIORITY_ID: 'Priority ID',
  PLAN_INITIATIVE_ID: 'Plan Initiative ID',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
  LAST_TOUCHED_AT: 'Last Touched At', // Last activity timestamp
  EFFORT: 'Effort',
  IMPACT: 'Impact',
  AI_ADDITIONAL_INFO: 'AI Additional Info',
  SOURCE_JSON: 'Source JSON', // JSON-encoded WorkSource object
} as const;

/**
 * Valid status values for Work Items
 */
export type WorkItemStatus =
  | 'Backlog'
  | 'Planned'
  | 'In Progress'
  | 'Done';

/**
 * Valid area values for Work Items
 */
export type WorkItemArea =
  | 'Brand'
  | 'Content'
  | 'SEO'
  | 'Website UX'
  | 'Funnel'
  | 'Analytics'
  | 'Operations'
  | 'Strategy'
  | 'Other';

/**
 * Valid severity values for Work Items
 */
export type WorkItemSeverity =
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Info';

/**
 * Internal type matching Airtable column names exactly
 */
interface WorkItemFields {
  'Title'?: string;
  'Company'?: string[]; // Linked record
  'Full Report'?: string[]; // Linked record
  'Area'?: WorkItemArea | string;
  'Status'?: WorkItemStatus;
  'Severity'?: WorkItemSeverity;
  'Owner'?: string; // Linked record ID
  'Owner Name'?: string[]; // Lookup field from Owner
  'Due Date'?: string;
  'Notes'?: string;
  'Priority ID'?: string;
  'Plan Initiative ID'?: string;
  'Created At'?: string;
  'Updated At'?: string;
  'Last Touched At'?: string; // Last activity timestamp
  'Effort'?: string;
  'Impact'?: string;
  'AI Additional Info'?: string;
  'Source JSON'?: string; // JSON-encoded WorkSource
}

/**
 * Work Item record (normalized from Airtable)
 */
export interface WorkItemRecord {
  id: string;
  companyId: string;
  fullReportId?: string;
  title: string;
  area?: WorkItemArea;
  status?: WorkItemStatus;
  severity?: WorkItemSeverity;
  owner?: string; // Owner record ID
  ownerName?: string; // Owner display name (from lookup)
  dueDate?: string; // ISO date
  notes?: string;
  priorityId?: string;
  planInitiativeId?: string;
  effort?: string;
  impact?: string;
  createdAt?: string;
  updatedAt?: string;
  lastTouchedAt?: string; // Last activity timestamp
  aiAdditionalInfo?: string; // AI-generated implementation guide
  source?: WorkSource; // Where this work item came from
}

/**
 * Parse Source JSON from Airtable field
 */
function parseSourceJson(sourceJson: string | undefined): WorkSource | undefined {
  if (!sourceJson) return undefined;
  try {
    return JSON.parse(sourceJson) as WorkSource;
  } catch (error) {
    console.warn('[Work Items] Failed to parse Source JSON:', error);
    return undefined;
  }
}

/**
 * Map Airtable record to WorkItemRecord
 */
function mapWorkItemRecord(record: any): WorkItemRecord {
  const fields = record.fields as WorkItemFields;

  // Extract linked record IDs (arrays)
  const companyIds = fields['Company'];
  const fullReportIds = fields['Full Report'];
  const ownerNames = fields['Owner Name']; // Lookup field returns array

  return {
    id: record.id,
    companyId: companyIds?.[0] || '',
    fullReportId: fullReportIds?.[0],
    title: fields['Title'] || 'Untitled',
    area: fields['Area'] as WorkItemArea | undefined,
    status: fields['Status'],
    severity: fields['Severity'],
    owner: fields['Owner'],
    ownerName: ownerNames?.[0], // First value from lookup array
    dueDate: fields['Due Date'],
    notes: fields['Notes'],
    priorityId: fields['Priority ID'],
    planInitiativeId: fields['Plan Initiative ID'],
    effort: fields['Effort'],
    impact: fields['Impact'],
    createdAt: fields['Created At'],
    updatedAt: fields['Updated At'],
    lastTouchedAt: fields['Last Touched At'],
    aiAdditionalInfo: fields['AI Additional Info'],
    source: parseSourceJson(fields['Source JSON']),
  };
}

/**
 * Get status sort order for display
 */
function getStatusSortOrder(status?: WorkItemStatus): number {
  const order: Record<WorkItemStatus, number> = {
    'In Progress': 1,
    'Planned': 2,
    'Backlog': 3,
    'Done': 4,
  };
  return status ? order[status] || 99 : 99;
}

/**
 * Get all Work Items across all companies
 *
 * @returns Array of all work items
 */
export async function getAllWorkItems(): Promise<WorkItemRecord[]> {
  try {
    console.log('[Work Items] Fetching all work items');
    const records = await base('Work Items').select().all();
    const workItems = records.map(mapWorkItemRecord);
    console.log('[Work Items] Found', workItems.length, 'total work items');
    return workItems;
  } catch (error) {
    console.error('[Work Items] Error fetching all work items:', error);
    return [];
  }
}

/**
 * Get all Work Items for a company
 *
 * @param companyId - Company record ID
 * @returns Array of work items sorted by status and due date
 */
export async function getWorkItemsForCompany(
  companyId: string
): Promise<WorkItemRecord[]> {
  try {
    console.log('[Work Items] Fetching work items for company:', companyId);

    // Fetch all work items from table
    const records = await base('Work Items')
      .select()
      .all();

    // Filter by company ID (linked field is an array)
    const companyRecords = records.filter((record) => {
      const fields = record.fields as WorkItemFields;
      const companyIds = fields['Company'];
      return companyIds && companyIds.includes(companyId);
    });

    console.log('[Work Items] Found', companyRecords.length, 'work items for company');

    // Map to WorkItemRecord
    const workItems = companyRecords.map(mapWorkItemRecord);

    // Sort by status, then by due date, then by created date
    workItems.sort((a, b) => {
      // First, sort by status
      const statusOrder = getStatusSortOrder(a.status) - getStatusSortOrder(b.status);
      if (statusOrder !== 0) return statusOrder;

      // Within same status, sort by due date (ascending, nulls last)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      // Finally, sort by created date (descending, newest first)
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      return 0;
    });

    return workItems;
  } catch (error) {
    console.error('[Work Items] Error fetching work items:', error);
    // Return empty array on error (e.g., table doesn't exist)
    return [];
  }
}

/**
 * Get Work Items for a company indexed by Priority ID
 *
 * @param companyId - Company record ID
 * @returns Dictionary of work items keyed by priorityId
 */
export async function getWorkItemsForCompanyByPriorityId(
  companyId: string
): Promise<Record<string, WorkItemRecord>> {
  const workItems = await getWorkItemsForCompany(companyId);

  const byPriorityId: Record<string, WorkItemRecord> = {};

  for (const item of workItems) {
    if (item.priorityId) {
      byPriorityId[item.priorityId] = item;
    }
  }

  return byPriorityId;
}

/**
 * Get Work Items for a company indexed by Plan Initiative ID
 *
 * @param companyId - Company record ID
 * @returns Dictionary of work items keyed by planInitiativeId
 */
export async function getWorkItemsForCompanyByPlanInitiativeId(
  companyId: string
): Promise<Record<string, WorkItemRecord>> {
  const workItems = await getWorkItemsForCompany(companyId);

  const byPlanInitiativeId: Record<string, WorkItemRecord> = {};

  for (const item of workItems) {
    if (item.planInitiativeId) {
      byPlanInitiativeId[item.planInitiativeId] = item;
    }
  }

  return byPlanInitiativeId;
}

/**
 * Map priority area to Work Item area
 */
function mapPriorityAreaToWorkItemArea(area?: string | unknown): WorkItemArea {
  if (!area || typeof area !== 'string') return 'Other';

  const normalized = area.toLowerCase().trim();

  if (normalized.includes('brand')) return 'Brand';
  if (normalized.includes('content')) return 'Content';
  if (normalized.includes('seo')) return 'SEO';
  if (normalized.includes('website') || normalized.includes('ux')) return 'Website UX';
  if (normalized.includes('funnel')) return 'Funnel';

  return 'Other';
}

/**
 * Map priority severity to Work Item severity
 */
function mapPrioritySeverityToWorkItemSeverity(severity?: string | number): WorkItemSeverity {
  if (!severity) return 'Medium';

  const normalized = String(severity).toLowerCase().trim();

  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'medium' || normalized === 'med') return 'Medium';
  if (normalized === 'low') return 'Low';
  if (normalized === 'info') return 'Info';

  return 'Medium'; // Default
}

/**
 * Create a Work Item from a Priority
 *
 * @param args - Configuration for creating work item
 * @returns Created work item record
 */
export async function createWorkItemFromPriority(args: {
  companyId: string;
  fullReportId: string;
  priority: PriorityItem;
  defaultStatus?: WorkItemStatus;
}): Promise<WorkItemRecord> {
  const { companyId, fullReportId, priority, defaultStatus = 'Backlog' } = args;

  console.log('[Work Items] Creating work item from priority:', {
    companyId,
    fullReportId,
    priorityId: priority.id,
    priorityTitle: priority.title,
  });

  // Build notes from priority description/summary/rationale
  const notesParts: string[] = [];
  if (priority.summary) notesParts.push(priority.summary);
  if (priority.description && priority.description !== priority.summary) {
    notesParts.push(priority.description);
  }
  if (priority.rationale && priority.rationale !== priority.summary && priority.rationale !== priority.description) {
    notesParts.push(`Rationale: ${priority.rationale}`);
  }
  const notes = notesParts.join('\n\n') || undefined;

  // Build Airtable fields
  const fields: Record<string, any> = {
    [WORK_ITEMS_FIELDS.TITLE]: priority.title || 'Untitled Priority',
    [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
    [WORK_ITEMS_FIELDS.FULL_REPORT]: [fullReportId], // Link field
    [WORK_ITEMS_FIELDS.AREA]: mapPriorityAreaToWorkItemArea(priority.area || priority.pillar),
    [WORK_ITEMS_FIELDS.STATUS]: defaultStatus,
    [WORK_ITEMS_FIELDS.SEVERITY]: mapPrioritySeverityToWorkItemSeverity(priority.severity),
  };

  // Optional fields
  if (priority.id) {
    fields[WORK_ITEMS_FIELDS.PRIORITY_ID] = priority.id;
  }

  if (notes) {
    fields[WORK_ITEMS_FIELDS.NOTES] = notes;
  }

  if (priority.effort) {
    fields[WORK_ITEMS_FIELDS.EFFORT] = String(priority.effort);
  }

  if (priority.impact) {
    fields[WORK_ITEMS_FIELDS.IMPACT] = String(priority.impact);
  }

  try {
    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work Items] Work item created successfully:', {
      workItemId: record.id,
      priorityId: priority.id,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error creating work item:', error);
    throw error;
  }
}

/**
 * Map initiative effort to normalized value
 */
function mapInitiativeEffortToString(effort?: string | unknown): string {
  if (!effort) return 'Medium';
  const normalized = String(effort).toUpperCase().trim();

  // Initiative uses XS/S/M/L/XL, Work Item uses Low/Medium/High
  if (normalized === 'XS' || normalized === 'S') return 'Low';
  if (normalized === 'M') return 'Medium';
  if (normalized === 'L' || normalized === 'XL') return 'High';

  // Pass through Low/Medium/High directly
  if (['LOW', 'MEDIUM', 'HIGH'].includes(normalized)) {
    return normalized.charAt(0) + normalized.slice(1).toLowerCase();
  }

  return String(effort);
}

/**
 * Map initiative impact to normalized value
 */
function mapInitiativeImpactToString(impact?: string | unknown): string {
  if (!impact) return 'Medium';
  const normalized = String(impact).charAt(0).toUpperCase() + String(impact).slice(1).toLowerCase();
  return normalized;
}

/**
 * Derive severity from initiative context
 * If priorityId is present, we could look it up, but for simplicity default based on impact
 */
function deriveInitiativeSeverity(initiative: PlanInitiative): WorkItemSeverity {
  const impact = initiative.impact ? String(initiative.impact).toLowerCase() : '';

  if (impact === 'high') return 'High';
  if (impact === 'low') return 'Low';
  return 'Medium';
}

/**
 * Create a Work Item from a Plan Initiative
 *
 * @param args - Configuration for creating work item
 * @returns Created work item record
 */
export async function createWorkItemFromPlanInitiative(args: {
  companyId: string;
  fullReportId: string;
  initiative: PlanInitiative;
  defaultStatus?: WorkItemStatus;
}): Promise<WorkItemRecord> {
  const { companyId, fullReportId, initiative, defaultStatus = 'Planned' } = args;

  console.log('[Work Items] Creating work item from plan initiative:', {
    companyId,
    fullReportId,
    initiativeId: initiative.id,
    initiativeTitle: initiative.title,
  });

  // Build notes from initiative summary/detail
  const notesParts: string[] = [];
  notesParts.push(`Created from Plan Initiative (${initiative.timeHorizon.replace('_', ' ')})`);
  if (initiative.summary) notesParts.push(initiative.summary);
  if (initiative.detail && initiative.detail !== initiative.summary) {
    notesParts.push(initiative.detail);
  }
  const notes = notesParts.join('\n\n') || undefined;

  // Build Airtable fields
  const fields: Record<string, any> = {
    [WORK_ITEMS_FIELDS.TITLE]: initiative.title || 'Untitled Initiative',
    [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
    [WORK_ITEMS_FIELDS.FULL_REPORT]: [fullReportId], // Link field
    [WORK_ITEMS_FIELDS.AREA]: mapPriorityAreaToWorkItemArea(initiative.area),
    [WORK_ITEMS_FIELDS.STATUS]: defaultStatus,
    [WORK_ITEMS_FIELDS.SEVERITY]: deriveInitiativeSeverity(initiative),
  };

  // Optional fields
  if (initiative.id) {
    fields[WORK_ITEMS_FIELDS.PLAN_INITIATIVE_ID] = initiative.id;
  }

  if (initiative.priorityId) {
    fields[WORK_ITEMS_FIELDS.PRIORITY_ID] = initiative.priorityId;
  }

  if (notes) {
    fields[WORK_ITEMS_FIELDS.NOTES] = notes;
  }

  if (initiative.effort) {
    fields[WORK_ITEMS_FIELDS.EFFORT] = mapInitiativeEffortToString(initiative.effort);
  }

  if (initiative.impact) {
    fields[WORK_ITEMS_FIELDS.IMPACT] = mapInitiativeImpactToString(initiative.impact);
  }

  if (initiative.ownerHint) {
    fields[WORK_ITEMS_FIELDS.OWNER] = initiative.ownerHint;
  }

  try {
    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work Items] Work item created successfully from plan initiative:', {
      workItemId: record.id,
      initiativeId: initiative.id,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error creating work item from plan initiative:', error);
    throw error;
  }
}

/**
 * Update the status of a Work Item
 *
 * @param workItemId - The Airtable record ID of the work item
 * @param status - The new status to set
 * @returns Updated work item record
 */
export async function updateWorkItemStatus(
  workItemId: string,
  status: WorkItemStatus
): Promise<WorkItemRecord> {
  console.log('[Work Items] Updating work item status:', {
    workItemId,
    status,
  });

  try {
    // Update only the Status field
    const records = await base('Work Items').update([
      {
        id: workItemId,
        fields: {
          [WORK_ITEMS_FIELDS.STATUS]: status,
        },
      },
    ]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable update');
    }

    const record = records[0];

    console.log('[Work Items] Work item status updated successfully:', {
      workItemId: record.id,
      newStatus: status,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error updating work item status:', error);
    throw error;
  }
}

/**
 * Suggested work item from AI diagnostic analysis
 */
export interface SuggestedWorkItemInput {
  title: string;
  area: 'strategy' | 'website' | 'brand' | 'content' | 'seo' | 'demand' | 'ops';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Map suggested work item area to Work Item area
 */
function mapSuggestedAreaToWorkItemArea(area: SuggestedWorkItemInput['area']): WorkItemArea {
  const mapping: Record<SuggestedWorkItemInput['area'], WorkItemArea> = {
    strategy: 'Other',
    website: 'Website UX',
    brand: 'Brand',
    content: 'Content',
    seo: 'SEO',
    demand: 'Funnel',
    ops: 'Other',
  };
  return mapping[area] || 'Other';
}

/**
 * Map suggested priority to Work Item severity
 */
function mapSuggestedPriorityToSeverity(priority: SuggestedWorkItemInput['priority']): WorkItemSeverity {
  const mapping: Record<SuggestedWorkItemInput['priority'], WorkItemSeverity> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return mapping[priority] || 'Medium';
}

/**
 * Create a Work Item from an AI-suggested work item (from diagnostic insights)
 *
 * @param args - Configuration for creating work item
 * @returns Created work item record
 */
export async function createWorkItemFromDiagnosticInsight(args: {
  companyId: string;
  diagnosticRunId?: string;
  toolId: string;
  suggestedItem: SuggestedWorkItemInput;
  defaultStatus?: WorkItemStatus;
}): Promise<WorkItemRecord> {
  const { companyId, diagnosticRunId, toolId, suggestedItem, defaultStatus = 'Backlog' } = args;

  console.log('[Work Items] Creating work item from diagnostic insight:', {
    companyId,
    toolId,
    title: suggestedItem.title,
    area: suggestedItem.area,
  });

  // Build notes
  const notesParts: string[] = [];
  notesParts.push(`Created from ${toolId} diagnostic insight`);
  if (diagnosticRunId) {
    notesParts.push(`Diagnostic Run ID: ${diagnosticRunId}`);
  }
  if (suggestedItem.description) {
    notesParts.push(suggestedItem.description);
  }
  const notes = notesParts.join('\n\n') || undefined;

  // Build Airtable fields
  const fields: Record<string, any> = {
    [WORK_ITEMS_FIELDS.TITLE]: suggestedItem.title || 'Untitled Work Item',
    [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
    [WORK_ITEMS_FIELDS.AREA]: mapSuggestedAreaToWorkItemArea(suggestedItem.area),
    [WORK_ITEMS_FIELDS.STATUS]: defaultStatus,
    [WORK_ITEMS_FIELDS.SEVERITY]: mapSuggestedPriorityToSeverity(suggestedItem.priority),
  };

  if (notes) {
    fields[WORK_ITEMS_FIELDS.NOTES] = notes;
  }

  try {
    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work Items] Work item created successfully from diagnostic insight:', {
      workItemId: record.id,
      title: suggestedItem.title,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error creating work item from diagnostic insight:', error);
    throw error;
  }
}

/**
 * Get a single Work Item by ID
 *
 * @param workItemId - The Airtable record ID
 * @returns Work item record or null if not found
 */
export async function getWorkItemById(
  workItemId: string
): Promise<WorkItemRecord | null> {
  try {
    console.log('[Work Items] Fetching work item by ID:', workItemId);

    const record = await base('Work Items').find(workItemId);

    if (!record) {
      console.log('[Work Items] Work item not found:', workItemId);
      return null;
    }

    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error fetching work item:', error);
    return null;
  }
}

/**
 * Generic work item creation input
 */
export interface CreateWorkItemInput {
  title: string;
  companyId: string;
  notes?: string;
  area?: WorkItemArea;
  severity?: WorkItemSeverity;
  status?: WorkItemStatus;
  source?: WorkSource;
  aiAdditionalInfo?: string;
}

/**
 * Create a generic work item
 *
 * @param input - Work item creation input
 * @returns Created work item record or null if failed
 */
export async function createWorkItem(
  input: CreateWorkItemInput
): Promise<WorkItemRecord | null> {
  const {
    title,
    companyId,
    notes,
    area = 'Other',
    severity = 'Medium',
    status = 'Backlog',
    source,
    aiAdditionalInfo,
  } = input;

  console.log('[Work Items] Creating generic work item:', {
    title,
    companyId,
    area,
    severity,
    status,
    hasSource: !!source,
  });

  // Build Airtable fields
  const fields: Record<string, any> = {
    [WORK_ITEMS_FIELDS.TITLE]: title,
    [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
    [WORK_ITEMS_FIELDS.AREA]: area,
    [WORK_ITEMS_FIELDS.STATUS]: status,
    [WORK_ITEMS_FIELDS.SEVERITY]: severity,
  };

  if (notes) {
    fields[WORK_ITEMS_FIELDS.NOTES] = notes;
  }

  if (source) {
    fields[WORK_ITEMS_FIELDS.SOURCE_JSON] = JSON.stringify(source);
  }

  if (aiAdditionalInfo) {
    fields[WORK_ITEMS_FIELDS.AI_ADDITIONAL_INFO] = aiAdditionalInfo;
  }

  try {
    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }]);

    if (!records || records.length === 0) {
      console.error('[Work Items] No record returned from Airtable create');
      return null;
    }

    const record = records[0];

    console.log('[Work Items] Work item created successfully:', {
      workItemId: record.id,
      title,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error creating work item:', error);
    return null;
  }
}

/**
 * Update the AI Additional Info field of a Work Item
 *
 * @param workItemId - The Airtable record ID
 * @param aiAdditionalInfo - The AI-generated implementation guide markdown
 * @returns Updated work item record
 */
export async function updateWorkItemAiAdditionalInfo(
  workItemId: string,
  aiAdditionalInfo: string
): Promise<WorkItemRecord> {
  console.log('[Work Items] Updating AI Additional Info:', {
    workItemId,
    contentLength: aiAdditionalInfo.length,
  });

  try {
    const records = await base('Work Items').update([
      {
        id: workItemId,
        fields: {
          [WORK_ITEMS_FIELDS.AI_ADDITIONAL_INFO]: aiAdditionalInfo,
        },
      },
    ]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable update');
    }

    const record = records[0];

    console.log('[Work Items] AI Additional Info updated successfully:', {
      workItemId: record.id,
    });

    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error updating AI Additional Info:', error);
    throw error;
  }
}

/**
 * Update a Work Item's Source JSON to add AI brief
 *
 * @param workItemId - Work item record ID
 * @param aiBrief - AI-generated brief to attach
 * @returns Updated work item record
 */
export async function updateWorkItemSourceWithAiBrief(
  workItemId: string,
  aiBrief: import('@/lib/types/work').PrescribedWorkAiBrief
): Promise<WorkItemRecord> {
  console.log('[Work Items] Updating work item with AI brief:', {
    workItemId,
    hasSummary: !!aiBrief.summary,
    requirementsCount: aiBrief.requirements?.length ?? 0,
  });

  try {
    // First fetch the existing work item to get current source
    const existingRecord = await base('Work Items').find(workItemId);
    if (!existingRecord) {
      throw new Error('Work item not found');
    }

    const fields = existingRecord.fields as WorkItemFields;
    const existingSourceJson = fields['Source JSON'];

    let source: WorkSource | undefined;
    if (existingSourceJson) {
      try {
        source = JSON.parse(existingSourceJson) as WorkSource;
      } catch {
        console.warn('[Work Items] Failed to parse existing source JSON');
      }
    }

    // Only add aiBrief to user_prescribed source type
    if (source && source.sourceType === 'user_prescribed') {
      (source as import('@/lib/types/work').WorkSourceUserPrescribed).aiBrief = aiBrief;
    }

    // Update the record
    const records = await base('Work Items').update([
      {
        id: workItemId,
        fields: {
          [WORK_ITEMS_FIELDS.SOURCE_JSON]: JSON.stringify(source),
        },
      },
    ]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable update');
    }

    const record = records[0];

    console.log('[Work Items] Work item AI brief updated successfully:', {
      workItemId: record.id,
    });

    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error updating work item AI brief:', error);
    throw error;
  }
}

/**
 * Update work item source with a canonical Brief ID
 * Links a user-prescribed work item to a Brief record
 *
 * @param workItemId - Work item record ID
 * @param briefId - Brief record ID to link
 * @returns Updated work item record
 */
export async function updateWorkItemSourceWithBriefId(
  workItemId: string,
  briefId: string
): Promise<WorkItemRecord> {
  console.log('[Work Items] Linking work item to brief:', {
    workItemId,
    briefId,
  });

  try {
    // First fetch the existing work item to get current source
    const existingRecord = await base('Work Items').find(workItemId);
    if (!existingRecord) {
      throw new Error('Work item not found');
    }

    const fields = existingRecord.fields as WorkItemFields;
    const existingSourceJson = fields['Source JSON'];

    let source: WorkSource | undefined;
    if (existingSourceJson) {
      try {
        source = JSON.parse(existingSourceJson) as WorkSource;
      } catch {
        console.warn('[Work Items] Failed to parse existing source JSON');
      }
    }

    // Add briefId to user_prescribed source type
    if (source && source.sourceType === 'user_prescribed') {
      (source as import('@/lib/types/work').WorkSourceUserPrescribed).briefId = briefId;
    }

    // Update the record
    const records = await base('Work Items').update([
      {
        id: workItemId,
        fields: {
          [WORK_ITEMS_FIELDS.SOURCE_JSON]: JSON.stringify(source),
        },
      },
    ]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable update');
    }

    const record = records[0];

    console.log('[Work Items] Work item linked to brief successfully:', {
      workItemId: record.id,
      briefId,
    });

    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error linking work item to brief:', error);
    throw error;
  }
}

/**
 * Map metric group to Work Item area
 */
function mapMetricGroupToWorkItemArea(metricGroup: string): WorkItemArea {
  const mapping: Record<string, WorkItemArea> = {
    traffic: 'Other',
    seo: 'SEO',
    conversion: 'Funnel',
    engagement: 'Website UX',
    local: 'SEO',
    ecommerce: 'Funnel',
    brand: 'Brand',
  };
  return mapping[metricGroup.toLowerCase()] || 'Other';
}

/**
 * Create a Work Item from an Analytics metric insight
 *
 * @param args - Configuration for creating work item from analytics
 * @returns Created work item record
 */
export async function createWorkItemFromAnalytics(args: {
  companyId: string;
  title: string;
  description: string;
  source: WorkSourceAnalytics;
  defaultStatus?: WorkItemStatus;
}): Promise<WorkItemRecord> {
  const { companyId, title, description, source, defaultStatus = 'Backlog' } = args;

  console.log('[Work Items] Creating work item from analytics metric:', {
    companyId,
    metricId: source.metricId,
    metricLabel: source.metricLabel,
    title,
  });

  // Build Airtable fields
  const fields: Record<string, any> = {
    [WORK_ITEMS_FIELDS.TITLE]: title,
    [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
    [WORK_ITEMS_FIELDS.AREA]: mapMetricGroupToWorkItemArea(source.metricGroup),
    [WORK_ITEMS_FIELDS.STATUS]: defaultStatus,
    [WORK_ITEMS_FIELDS.SEVERITY]: 'Medium', // Default severity for analytics-driven work
    [WORK_ITEMS_FIELDS.AI_ADDITIONAL_INFO]: description, // Store the full guide
    [WORK_ITEMS_FIELDS.SOURCE_JSON]: JSON.stringify(source),
  };

  try {
    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work Items] Work item created successfully from analytics:', {
      workItemId: record.id,
      metricId: source.metricId,
    });

    // Map to WorkItemRecord
    return mapWorkItemRecord(record);
  } catch (error) {
    console.error('[Work Items] Error creating work item from analytics:', error);
    throw error;
  }
}

// ============================================================================
// Tool Run Work Item Creation
// ============================================================================

import type {
  WorkCategory,
  WorkPriority,
  WorkSourceToolRun,
  WorkSourceStrategyPlay,
} from '@/lib/types/work';
import type { StrategyPlay } from '@/lib/types/strategy';

/**
 * Input for creating work items from a tool run
 */
export interface ToolRunWorkItemInput {
  title: string;
  description: string;
  status?: WorkItemStatus;
  priority?: WorkPriority;
  category?: WorkCategory;
  source: WorkSourceToolRun;
}

/**
 * Map WorkCategory to WorkItemArea
 */
function mapCategoryToWorkItemArea(category?: WorkCategory): WorkItemArea {
  if (!category) return 'Other';
  const mapping: Record<WorkCategory, WorkItemArea> = {
    brand: 'Brand',
    content: 'Content',
    seo: 'SEO',
    website: 'Website UX',
    analytics: 'Funnel',
    demand: 'Funnel',
    ops: 'Other',
    other: 'Other',
  };
  return mapping[category] || 'Other';
}

/**
 * Map WorkPriority to WorkItemSeverity
 */
function mapPriorityToSeverity(priority?: WorkPriority): WorkItemSeverity {
  if (!priority) return 'Medium';
  const mapping: Record<WorkPriority, WorkItemSeverity> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
  };
  return mapping[priority] || 'Medium';
}

/**
 * Create multiple Work Items from a Tool Run's AI-generated suggestions
 *
 * @param input - Configuration for creating work items
 * @returns Array of created work item records
 */
export async function createWorkItemsFromToolRun(input: {
  companyId: string;
  items: ToolRunWorkItemInput[];
}): Promise<WorkItemRecord[]> {
  const { companyId, items } = input;

  if (items.length === 0) {
    return [];
  }

  console.log('[Work Items] Creating work items from tool run:', {
    companyId,
    itemCount: items.length,
    toolSlug: items[0]?.source?.toolSlug,
  });

  // Build records for batch creation
  const recordsToCreate = items.map((item) => {
    const fields: Record<string, any> = {
      [WORK_ITEMS_FIELDS.TITLE]: item.title,
      [WORK_ITEMS_FIELDS.COMPANY]: [companyId],
      [WORK_ITEMS_FIELDS.AREA]: mapCategoryToWorkItemArea(item.category),
      [WORK_ITEMS_FIELDS.STATUS]: item.status || 'Backlog',
      [WORK_ITEMS_FIELDS.SEVERITY]: mapPriorityToSeverity(item.priority),
      [WORK_ITEMS_FIELDS.SOURCE_JSON]: JSON.stringify(item.source),
    };

    if (item.description) {
      fields[WORK_ITEMS_FIELDS.AI_ADDITIONAL_INFO] = item.description;
    }

    return { fields };
  });

  try {
    // Airtable batch create supports up to 10 records at a time
    const createdRecords: WorkItemRecord[] = [];
    const batchSize = 10;

    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize);
      const records = await base('Work Items').create(batch);

      if (records && records.length > 0) {
        createdRecords.push(...records.map(mapWorkItemRecord));
      }
    }

    console.log('[Work Items] Work items created successfully from tool run:', {
      companyId,
      createdCount: createdRecords.length,
    });

    return createdRecords;
  } catch (error) {
    console.error('[Work Items] Error creating work items from tool run:', error);
    throw error;
  }
}

/**
 * Count work items created from a specific tool run
 *
 * @param runId - The diagnostic run ID (stored in Source JSON)
 * @returns Count of work items linked to this run
 */
export async function countWorkItemsForRun(runId: string): Promise<number> {
  try {
    console.log('[Work Items] Counting work items for run:', runId);

    // Fetch all work items that might have Source JSON
    const records = await base('Work Items')
      .select({
        fields: [WORK_ITEMS_FIELDS.SOURCE_JSON],
        // Only fetch records that have Source JSON set
        filterByFormula: `NOT({${WORK_ITEMS_FIELDS.SOURCE_JSON}} = '')`,
      })
      .all();

    // Count those that match the runId in Source JSON
    let count = 0;
    for (const record of records) {
      const fields = record.fields as WorkItemFields;
      const sourceJson = fields['Source JSON'];
      if (sourceJson) {
        try {
          const source = JSON.parse(sourceJson) as WorkSource;
          if (source.sourceType === 'tool_run' && source.toolRunId === runId) {
            count++;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    console.log('[Work Items] Found', count, 'work items for run:', runId);
    return count;
  } catch (error: unknown) {
    // Handle table or field not found errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('UNKNOWN_FIELD_NAME')) {
      console.log('[Work Items] Table or field not found, returning 0');
      return 0;
    }
    console.error('[Work Items] Error counting work items for run:', errorMessage);
    return 0;
  }
}

// ============================================================================
// Strategy Play Work Item Creation
// ============================================================================

/**
 * Create Work Items from Strategy Plays
 *
 * @param input - Configuration for creating work items from plays
 * @returns Array of created work item records
 */
export async function createWorkItemsFromStrategyPlays(input: {
  companyId: string;
  strategyId: string;
  plays: StrategyPlay[];
}): Promise<WorkItemRecord[]> {
  const { companyId, strategyId, plays } = input;

  if (plays.length === 0) {
    return [];
  }

  console.log('[Work Items] Creating work items from strategy plays:', {
    companyId,
    strategyId,
    playCount: plays.length,
  });

  // Build records for batch creation
  const recordsToCreate = plays.map((play) => {
    // Build source metadata
    const source: WorkSourceStrategyPlay = {
      sourceType: 'strategy_play',
      strategyId,
      playId: play.id,
      playTitle: play.title,
      objectiveId: play.objectiveId,
      pillarTitle: play.pillarTitle,
    };

    // Build notes from play description and metadata
    const notesParts: string[] = [];
    notesParts.push(`Created from Strategy Play: ${play.title}`);
    if (play.description) notesParts.push(play.description);
    if (play.successMetric) notesParts.push(`Success Metric: ${play.successMetric}`);
    if (play.timeframe) notesParts.push(`Timeframe: ${play.timeframe}`);
    if (play.pillarTitle) notesParts.push(`Strategic Pillar: ${play.pillarTitle}`);

    const notes = notesParts.join('\n\n') || undefined;

    const fields: Record<string, any> = {
      [WORK_ITEMS_FIELDS.TITLE]: play.title,
      [WORK_ITEMS_FIELDS.COMPANY]: [companyId],
      [WORK_ITEMS_FIELDS.AREA]: 'Strategy',
      [WORK_ITEMS_FIELDS.STATUS]: 'Backlog',
      [WORK_ITEMS_FIELDS.SEVERITY]: 'Medium',
      [WORK_ITEMS_FIELDS.SOURCE_JSON]: JSON.stringify(source),
    };

    if (notes) {
      fields[WORK_ITEMS_FIELDS.NOTES] = notes;
    }

    return { fields };
  });

  try {
    // Airtable batch create supports up to 10 records at a time
    const createdRecords: WorkItemRecord[] = [];
    const batchSize = 10;

    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize);
      const records = await base('Work Items').create(batch);

      if (records && records.length > 0) {
        createdRecords.push(...records.map(mapWorkItemRecord));
      }
    }

    console.log('[Work Items] Work items created successfully from strategy plays:', {
      companyId,
      strategyId,
      createdCount: createdRecords.length,
    });

    return createdRecords;
  } catch (error) {
    console.error('[Work Items] Error creating work items from strategy plays:', error);
    throw error;
  }
}

/**
 * Get work items created from a specific brief
 *
 * @param briefId - The brief ID
 * @returns Array of work items linked to this brief
 */
export async function getWorkItemsByBriefId(briefId: string): Promise<WorkItemRecord[]> {
  try {
    console.log('[Work Items] Fetching work items for brief:', briefId);

    // Fetch all work items that have Source JSON
    const records = await base('Work Items')
      .select({
        filterByFormula: `NOT({${WORK_ITEMS_FIELDS.SOURCE_JSON}} = '')`,
      })
      .all();

    // Filter those that match the briefId in Source JSON
    const matchingRecords: WorkItemRecord[] = [];
    for (const record of records) {
      const fields = record.fields as WorkItemFields;
      const sourceJson = fields['Source JSON'];
      if (sourceJson) {
        try {
          const source = JSON.parse(sourceJson) as WorkSource;
          if (source.sourceType === 'creative_brief' && source.briefId === briefId) {
            matchingRecords.push(mapWorkItemRecord(record));
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    console.log('[Work Items] Found', matchingRecords.length, 'work items for brief:', briefId);
    return matchingRecords;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('UNKNOWN_FIELD_NAME')) {
      console.log('[Work Items] Table or field not found, returning empty array');
      return [];
    }
    console.error('[Work Items] Error fetching work items for brief:', errorMessage);
    return [];
  }
}

/**
 * Count work items created from a specific brief
 *
 * @param briefId - The brief ID
 * @returns Count of work items linked to this brief
 */
export async function countWorkItemsForBrief(briefId: string): Promise<number> {
  const items = await getWorkItemsByBriefId(briefId);
  return items.length;
}

/**
 * Count work items created from a specific strategy play
 *
 * @param playId - The strategy play ID
 * @returns Count of work items linked to this play
 */
export async function countWorkItemsForStrategyPlay(playId: string): Promise<number> {
  try {
    console.log('[Work Items] Counting work items for strategy play:', playId);

    // Fetch all work items that might have Source JSON
    const records = await base('Work Items')
      .select({
        fields: [WORK_ITEMS_FIELDS.SOURCE_JSON],
        filterByFormula: `NOT({${WORK_ITEMS_FIELDS.SOURCE_JSON}} = '')`,
      })
      .all();

    // Count those that match the playId in Source JSON
    let count = 0;
    for (const record of records) {
      const fields = record.fields as WorkItemFields;
      const sourceJson = fields['Source JSON'];
      if (sourceJson) {
        try {
          const source = JSON.parse(sourceJson) as WorkSource;
          if (source.sourceType === 'strategy_play' && source.playId === playId) {
            count++;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    console.log('[Work Items] Found', count, 'work items for strategy play:', playId);
    return count;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('UNKNOWN_FIELD_NAME')) {
      console.log('[Work Items] Table or field not found, returning 0');
      return 0;
    }
    console.error('[Work Items] Error counting work items for play:', errorMessage);
    return 0;
  }
}
