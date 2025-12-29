/**
 * Company Engagements - Airtable helper
 *
 * Manages the Company Engagements table which tracks engagement records
 * that route companies through Strategy or Project paths.
 */

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  CompanyEngagement,
  EngagementType,
  EngagementStatus,
  ProjectType,
  CreateEngagementInput,
  UpdateEngagementInput,
} from '@/lib/types/engagement';
import {
  generateEngagementId,
  getRequiredLabs,
  getSuggestedLabs,
  computeTargetRoute,
} from '@/lib/types/engagement';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Field Names (matching Airtable schema exactly)
// ============================================================================

const ENGAGEMENT_FIELDS = {
  ID: 'ID',                          // Text - unique engagement ID
  COMPANY: 'Company',                // Link to Companies
  TYPE: 'Type',                      // Single Select - strategy | project
  PROJECT_TYPE: 'Project Type',      // Single Select - website | campaign | content | other
  PROJECT_NAME: 'Project Name',      // Text - optional custom name
  SELECTED_LABS: 'Selected Labs',    // Multiple Select - lab IDs
  REQUIRED_LABS: 'Required Labs',    // Multiple Select - auto-selected labs
  OPTIONAL_LABS: 'Optional Labs',    // Multiple Select - user-selected labs
  STATUS: 'Status',                  // Single Select - engagement status
  GAP_RUN_ID: 'GAP Run ID',         // Text - link to GAP run
  LABS_COMPLETED_AT: 'Labs Completed At', // Date - when labs/GAP finished
  CONTEXT_APPROVED_AT: 'Context Approved At', // Date
  TARGET_ROUTE: 'Target Route',      // Text - computed destination route
  CREATED_AT: 'Created At',          // Date
  UPDATED_AT: 'Updated At',          // Date
  CREATED_BY: 'Created By',          // Text - user identifier
} as const;

// ============================================================================
// Airtable Field Types
// ============================================================================

interface EngagementFields {
  'ID'?: string;
  'Company'?: string[];               // Linked record
  'Type'?: EngagementType;
  'Project Type'?: ProjectType;
  'Project Name'?: string;
  'Selected Labs'?: LabId[];
  'Required Labs'?: LabId[];
  'Optional Labs'?: LabId[];
  'Status'?: EngagementStatus;
  'GAP Run ID'?: string;
  'Labs Completed At'?: string;
  'Context Approved At'?: string;
  'Target Route'?: string;
  'Created At'?: string;
  'Updated At'?: string;
  'Created By'?: string;
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Map Airtable record to CompanyEngagement
 */
function mapEngagementRecord(record: { id: string; fields: EngagementFields }): CompanyEngagement {
  const fields = record.fields;

  // Extract linked record IDs (arrays)
  const companyIds = fields['Company'];

  return {
    id: fields['ID'] || record.id,
    companyId: companyIds?.[0] || '',
    type: fields['Type'] || 'strategy',
    projectType: fields['Project Type'],
    projectName: fields['Project Name'],
    selectedLabs: fields['Selected Labs'] || [],
    requiredLabs: fields['Required Labs'] || [],
    optionalLabs: fields['Optional Labs'] || [],
    status: fields['Status'] || 'draft',
    gapRunId: fields['GAP Run ID'],
    labsCompletedAt: fields['Labs Completed At'],
    contextApprovedAt: fields['Context Approved At'],
    targetRoute: fields['Target Route'] || '',
    createdAt: fields['Created At'] || new Date().toISOString(),
    updatedAt: fields['Updated At'] || new Date().toISOString(),
    createdBy: fields['Created By'],
  };
}

/**
 * Build Airtable fields from engagement input
 */
function buildEngagementFields(
  engagement: Partial<CompanyEngagement> & { companyId: string }
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (engagement.id) {
    fields[ENGAGEMENT_FIELDS.ID] = engagement.id;
  }

  if (engagement.companyId) {
    fields[ENGAGEMENT_FIELDS.COMPANY] = [engagement.companyId];
  }

  if (engagement.type) {
    fields[ENGAGEMENT_FIELDS.TYPE] = engagement.type;
  }

  if (engagement.projectType) {
    fields[ENGAGEMENT_FIELDS.PROJECT_TYPE] = engagement.projectType;
  }

  if (engagement.projectName !== undefined) {
    fields[ENGAGEMENT_FIELDS.PROJECT_NAME] = engagement.projectName || '';
  }

  if (engagement.selectedLabs) {
    fields[ENGAGEMENT_FIELDS.SELECTED_LABS] = engagement.selectedLabs;
  }

  if (engagement.requiredLabs) {
    fields[ENGAGEMENT_FIELDS.REQUIRED_LABS] = engagement.requiredLabs;
  }

  if (engagement.optionalLabs) {
    fields[ENGAGEMENT_FIELDS.OPTIONAL_LABS] = engagement.optionalLabs;
  }

  if (engagement.status) {
    fields[ENGAGEMENT_FIELDS.STATUS] = engagement.status;
  }

  if (engagement.gapRunId !== undefined) {
    fields[ENGAGEMENT_FIELDS.GAP_RUN_ID] = engagement.gapRunId || '';
  }

  if (engagement.contextApprovedAt !== undefined) {
    fields[ENGAGEMENT_FIELDS.CONTEXT_APPROVED_AT] = engagement.contextApprovedAt || '';
  }

  if (engagement.targetRoute) {
    fields[ENGAGEMENT_FIELDS.TARGET_ROUTE] = engagement.targetRoute;
  }

  if (engagement.createdAt) {
    fields[ENGAGEMENT_FIELDS.CREATED_AT] = engagement.createdAt;
  }

  if (engagement.updatedAt) {
    fields[ENGAGEMENT_FIELDS.UPDATED_AT] = engagement.updatedAt;
  }

  if (engagement.createdBy) {
    fields[ENGAGEMENT_FIELDS.CREATED_BY] = engagement.createdBy;
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all engagements for a company
 */
export async function getEngagementsByCompany(
  companyId: string
): Promise<CompanyEngagement[]> {
  try {
    console.log('[Engagements] Fetching engagements for company:', companyId);

    const records = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS)
      .select()
      .all();

    // Filter by company ID (linked field is an array)
    const companyRecords = records.filter((record) => {
      const fields = record.fields as EngagementFields;
      const companyIds = fields['Company'];
      return companyIds && companyIds.includes(companyId);
    });

    console.log('[Engagements] Found', companyRecords.length, 'engagements for company');

    // Map and sort by createdAt descending (newest first)
    const engagements = companyRecords
      .map((record) => mapEngagementRecord({ id: record.id, fields: record.fields as EngagementFields }))
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

    return engagements;
  } catch (error) {
    console.error('[Engagements] Error fetching engagements:', error);
    return [];
  }
}

/**
 * Get engagement by ID
 */
export async function getEngagementById(
  engagementId: string
): Promise<CompanyEngagement | null> {
  try {
    console.log('[Engagements] Fetching engagement by ID:', engagementId);

    // First try to find by custom ID field
    const records = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS)
      .select({
        filterByFormula: `{${ENGAGEMENT_FIELDS.ID}} = '${engagementId}'`,
        maxRecords: 1,
      })
      .all();

    if (records.length > 0) {
      return mapEngagementRecord({
        id: records[0].id,
        fields: records[0].fields as EngagementFields,
      });
    }

    // Fallback: try Airtable record ID
    try {
      const record = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS).find(engagementId);
      if (record) {
        return mapEngagementRecord({
          id: record.id,
          fields: record.fields as EngagementFields,
        });
      }
    } catch {
      // Record not found
    }

    console.log('[Engagements] Engagement not found:', engagementId);
    return null;
  } catch (error) {
    console.error('[Engagements] Error fetching engagement:', error);
    return null;
  }
}

/**
 * Get the active (most recent non-completed) engagement for a company
 */
export async function getActiveEngagement(
  companyId: string
): Promise<CompanyEngagement | null> {
  try {
    console.log('[Engagements] Fetching active engagement for company:', companyId);

    const engagements = await getEngagementsByCompany(companyId);

    // Find the first non-completed engagement (sorted by newest first)
    const active = engagements.find((e) => e.status !== 'completed');

    if (active) {
      console.log('[Engagements] Found active engagement:', active.id, 'status:', active.status);
    } else {
      console.log('[Engagements] No active engagement found');
    }

    return active || null;
  } catch (error) {
    console.error('[Engagements] Error fetching active engagement:', error);
    return null;
  }
}

/**
 * Create a new engagement
 */
export async function createEngagement(
  input: CreateEngagementInput
): Promise<CompanyEngagement> {
  const now = new Date().toISOString();
  const engagementId = generateEngagementId();

  // Compute labs
  const requiredLabs = getRequiredLabs(input.type);
  const suggestedLabs = getSuggestedLabs(input.type, input.projectType);

  // Combine required with user-selected or suggested
  const selectedLabs = [
    ...requiredLabs,
    ...(input.selectedLabs ?? suggestedLabs),
  ];
  const uniqueSelectedLabs = [...new Set(selectedLabs)] as LabId[];
  const optionalLabs = uniqueSelectedLabs.filter((lab) => !requiredLabs.includes(lab));

  // Compute target route
  const targetRoute = computeTargetRoute(input.companyId, input.type, input.projectType);

  console.log('[Engagements] Creating engagement:', {
    engagementId,
    companyId: input.companyId,
    type: input.type,
    projectType: input.projectType,
    selectedLabs: uniqueSelectedLabs,
    targetRoute,
  });

  const fields = buildEngagementFields({
    id: engagementId,
    companyId: input.companyId,
    type: input.type,
    projectType: input.projectType,
    projectName: input.projectName,
    selectedLabs: uniqueSelectedLabs,
    requiredLabs,
    optionalLabs,
    status: 'draft',
    targetRoute,
    createdAt: now,
    updatedAt: now,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS).create([{ fields: fields as any }]);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Engagements] Engagement created successfully:', {
      airtableId: record.id,
      engagementId,
    });

    // Map the record but ensure we use our generated ID
    // (Airtable may not return all fields in the create response)
    const mapped = mapEngagementRecord({
      id: record.id,
      fields: record.fields as EngagementFields,
    });

    // Override with our generated ID since Airtable may not return it
    return {
      ...mapped,
      id: engagementId,
    };
  } catch (error) {
    console.error('[Engagements] Error creating engagement:', error);
    throw error;
  }
}

/**
 * Update an engagement
 */
export async function updateEngagement(
  engagementId: string,
  updates: UpdateEngagementInput
): Promise<CompanyEngagement> {
  console.log('[Engagements] Updating engagement:', engagementId, updates);

  try {
    // First find the Airtable record ID
    const records = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS)
      .select({
        filterByFormula: `{${ENGAGEMENT_FIELDS.ID}} = '${engagementId}'`,
        maxRecords: 1,
      })
      .all();

    let airtableRecordId = records[0]?.id;

    // Fallback: try engagementId as Airtable record ID
    if (!airtableRecordId) {
      airtableRecordId = engagementId;
    }

    const now = new Date().toISOString();

    // Build update fields
    const fieldsToUpdate: Record<string, unknown> = {
      [ENGAGEMENT_FIELDS.UPDATED_AT]: now,
    };

    if (updates.type !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.TYPE] = updates.type;
    }

    if (updates.projectType !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.PROJECT_TYPE] = updates.projectType;
    }

    if (updates.projectName !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.PROJECT_NAME] = updates.projectName;
    }

    if (updates.selectedLabs !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.SELECTED_LABS] = updates.selectedLabs;
    }

    if (updates.status !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.STATUS] = updates.status;
    }

    if (updates.gapRunId !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.GAP_RUN_ID] = updates.gapRunId;
    }

    if (updates.labsCompletedAt !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.LABS_COMPLETED_AT] = updates.labsCompletedAt;
    }

    if (updates.contextApprovedAt !== undefined) {
      fieldsToUpdate[ENGAGEMENT_FIELDS.CONTEXT_APPROVED_AT] = updates.contextApprovedAt;
    }

     
    const updatedRecords = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS).update([
      {
        id: airtableRecordId,
        fields: fieldsToUpdate as any,
      },
    ]);

    if (!updatedRecords || updatedRecords.length === 0) {
      throw new Error('No record returned from Airtable update');
    }

    const record = updatedRecords[0];

    console.log('[Engagements] Engagement updated successfully:', engagementId);

    return mapEngagementRecord({
      id: record.id,
      fields: record.fields as EngagementFields,
    });
  } catch (error) {
    console.error('[Engagements] Error updating engagement:', error);
    throw error;
  }
}

/**
 * Delete an engagement
 */
export async function deleteEngagement(engagementId: string): Promise<void> {
  console.log('[Engagements] Deleting engagement:', engagementId);

  try {
    // First find the Airtable record ID
    const records = await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS)
      .select({
        filterByFormula: `{${ENGAGEMENT_FIELDS.ID}} = '${engagementId}'`,
        maxRecords: 1,
      })
      .all();

    let airtableRecordId = records[0]?.id;

    // Fallback: try engagementId as Airtable record ID
    if (!airtableRecordId) {
      airtableRecordId = engagementId;
    }

    await base(AIRTABLE_TABLES.COMPANY_ENGAGEMENTS).destroy([airtableRecordId]);

    console.log('[Engagements] Engagement deleted successfully:', engagementId);
  } catch (error) {
    console.error('[Engagements] Error deleting engagement:', error);
    throw error;
  }
}

// ============================================================================
// Status Transition Helpers
// ============================================================================

/**
 * Start context gathering (transition from draft to context_gathering)
 */
export async function startContextGathering(
  engagementId: string,
  gapRunId: string
): Promise<CompanyEngagement> {
  console.log('[Engagements] Starting context gathering:', engagementId);

  return updateEngagement(engagementId, {
    status: 'context_gathering',
    gapRunId,
  });
}

/**
 * Approve context (transition from context_gathering to context_approved)
 */
export async function approveContext(
  engagementId: string
): Promise<CompanyEngagement> {
  console.log('[Engagements] Approving context:', engagementId);

  return updateEngagement(engagementId, {
    status: 'context_approved',
    contextApprovedAt: new Date().toISOString(),
  });
}

/**
 * Start work (transition from context_approved to in_progress)
 */
export async function startWork(
  engagementId: string
): Promise<CompanyEngagement> {
  console.log('[Engagements] Starting work:', engagementId);

  return updateEngagement(engagementId, {
    status: 'in_progress',
  });
}

/**
 * Complete engagement (transition to completed)
 */
export async function completeEngagement(
  engagementId: string
): Promise<CompanyEngagement> {
  console.log('[Engagements] Completing engagement:', engagementId);

  return updateEngagement(engagementId, {
    status: 'completed',
  });
}

/**
 * Cancel/reset engagement back to draft
 */
export async function resetEngagement(
  engagementId: string
): Promise<CompanyEngagement> {
  console.log('[Engagements] Resetting engagement to draft:', engagementId);

  return updateEngagement(engagementId, {
    status: 'draft',
    gapRunId: undefined,
    contextApprovedAt: undefined,
  });
}
