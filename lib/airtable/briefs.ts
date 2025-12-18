// lib/airtable/briefs.ts
// Airtable CRUD operations for canonical Briefs
//
// Product Rule (NON-NEGOTIABLE):
// If work is being done, there must be a Brief — and the Brief is the source of truth.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  Brief,
  BriefType,
  BriefStatus,
  BriefCore,
  BriefExtension,
  BriefTraceability,
  CreateBriefInput,
  BriefChangeLogEntry,
  BriefChangeSource,
} from '@/lib/types/brief';
import { createEmptyBriefCore, createEmptyExtension } from '@/lib/types/brief';

// ============================================================================
// Constants
// ============================================================================

const BRIEFS_TABLE = AIRTABLE_TABLES.BRIEFS;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format BriefCore as markdown for the body field
 */
function formatCoreAsMarkdown(core: BriefCore): string {
  const sections: string[] = [];

  if (core.objective) {
    sections.push(`## Objective\n\n${core.objective}`);
  }

  if (core.targetAudience) {
    sections.push(`## Target Audience\n\n${core.targetAudience}`);
  }

  if (core.problemToSolve) {
    sections.push(`## Problem to Solve\n\n${core.problemToSolve}`);
  }

  if (core.singleMindedFocus) {
    sections.push(`## Single-Minded Focus\n\n${core.singleMindedFocus}`);
  }

  if (core.constraints && core.constraints.length > 0) {
    const items = core.constraints.map(c => `- ${c}`).join('\n');
    sections.push(`## Constraints\n\n${items}`);
  }

  if (core.successDefinition) {
    sections.push(`## Success Definition\n\n${core.successDefinition}`);
  }

  if (core.assumptions && core.assumptions.length > 0) {
    const items = core.assumptions.map(a => `- ${a}`).join('\n');
    sections.push(`## Assumptions\n\n${items}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Map Airtable record to Brief entity
 *
 * Airtable schema (all camelCase):
 * title, companyId, type, summary, body, relatedStrategyId, relatedPillarIds,
 * status, version, createdAt, updatedAt, createdBy, approvedAt, approvedBy
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): Brief {
  const fields = record.fields;

  // Parse body JSON as core
  const bodyJson = fields['body'] as string | undefined;
  let core: BriefCore = createEmptyBriefCore();

  if (bodyJson) {
    try {
      core = JSON.parse(bodyJson) as BriefCore;
    } catch (e) {
      // If body isn't valid JSON, treat it as the objective
      core = { ...createEmptyBriefCore(), objective: bodyJson };
    }
  }

  // Build traceability from relatedStrategyId/relatedPillarIds
  const relatedPillarIds = fields['relatedPillarIds'] as string | undefined;
  const traceability: BriefTraceability = {
    sourceStrategicBetIds: relatedPillarIds ? relatedPillarIds.split(',').filter(Boolean) : [],
  };

  return {
    id: record.id,
    companyId: (fields['companyId'] as string) || '',
    engagementId: (fields['engagementId'] as string) || undefined,
    projectId: (fields['projectId'] as string) || undefined,
    workItemId: (fields['workItemId'] as string) || undefined,
    title: (fields['title'] as string) || '',
    type: (fields['type'] as BriefType) || 'creative',
    status: (fields['status'] as BriefStatus) || 'draft',
    core,
    extension: {} as BriefExtension,
    traceability,
    isLocked: false,
    lockedAt: undefined,
    lockedBy: undefined,
    lockedReason: undefined,
    unlockReason: undefined,
    changeLog: [],
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    updatedAt: (fields['updatedAt'] as string) || new Date().toISOString(),
    approvedAt: fields['approvedAt'] as string | undefined,
    approvedBy: fields['approvedBy'] as string | undefined,
  };
}

/**
 * Map Brief entity to Airtable fields
 *
 * Airtable schema (all camelCase):
 * title, companyId, type, summary, body, relatedStrategyId, relatedPillarIds,
 * status, version, createdAt, updatedAt, createdBy, approvedAt, approvedBy
 */
function mapToAirtableFields(
  brief: Partial<Brief> & { companyId: string },
  now: string
): Record<string, unknown> {
  // All field names are camelCase to match Airtable schema
  const fields: Record<string, unknown> = {
    'companyId': brief.companyId,
    'updatedAt': now,
  };

  if (brief.title !== undefined) {
    fields['title'] = brief.title;
  }

  if (brief.type !== undefined) {
    fields['type'] = brief.type;
  }

  if (brief.status !== undefined) {
    fields['status'] = brief.status;
  }

  // Map core fields to summary/body (as markdown, not JSON)
  if (brief.core !== undefined) {
    // Store objective as summary
    if (brief.core.objective) {
      fields['summary'] = brief.core.objective;
    }
    // Format core as markdown for body field
    fields['body'] = formatCoreAsMarkdown(brief.core);
  }

  if (brief.traceability !== undefined) {
    // Map traceability to relatedStrategyId/relatedPillarIds
    if (brief.traceability.sourceStrategicBetIds?.length) {
      fields['relatedPillarIds'] = brief.traceability.sourceStrategicBetIds.join(',');
    }
  }

  if (brief.approvedAt !== undefined) {
    fields['approvedAt'] = brief.approvedAt;
  }

  if (brief.approvedBy !== undefined) {
    fields['approvedBy'] = brief.approvedBy;
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new brief
 * Note: engagementId is optional - briefs are project/work-centric
 */
export async function createBrief(input: CreateBriefInput): Promise<Brief | null> {
  try {
    const now = new Date().toISOString();

    // Only set minimal required fields on creation
    // Content (body) will be filled in by updateBrief after AI generation
    const fields: Record<string, unknown> = {
      'companyId': input.companyId,
      'title': input.title,
      'type': input.type,
      'status': 'draft',
      'createdAt': now,
      'updatedAt': now,
    };

    // Optional linkage fields - briefs are project/work-centric
    if (input.engagementId) {
      fields['engagementId'] = input.engagementId;
    }
    if (input.projectId) {
      fields['projectId'] = input.projectId;
    }
    if (input.workItemId) {
      fields['workItemId'] = input.workItemId;
    }

    const record = await base(BRIEFS_TABLE).create(fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error('[Briefs] Failed to create brief:', error);
    return null;
  }
}

/**
 * Get a brief by ID
 */
export async function getBriefById(briefId: string): Promise<Brief | null> {
  try {
    const record = await base(BRIEFS_TABLE).find(briefId);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error: unknown) {
    // Airtable errors don't serialize well - extract useful info
    const airtableError = error as { statusCode?: number; message?: string; error?: string };
    console.error(`[Briefs] Failed to get brief ${briefId}:`, {
      statusCode: airtableError.statusCode,
      message: airtableError.message || airtableError.error,
      table: BRIEFS_TABLE,
    });
    return null;
  }
}

/**
 * Get brief by project ID
 */
export async function getBriefByProjectId(projectId: string): Promise<Brief | null> {
  try {
    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `{projectId} = "${projectId}"`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Briefs] Failed to get brief for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Get brief by work item ID
 */
export async function getBriefByWorkItemId(workItemId: string): Promise<Brief | null> {
  try {
    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `{workItemId} = "${workItemId}"`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Briefs] Failed to get brief for work item ${workItemId}:`, error);
    return null;
  }
}

/**
 * Get brief by engagement ID (engagement-level briefs)
 * @deprecated Use getBriefByProjectId or getBriefByWorkItemId instead - briefs are project/work-centric
 */
export async function getBriefByEngagementId(engagementId: string): Promise<Brief | null> {
  try {
    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `AND({engagementId} = "${engagementId}", {projectId} = "")`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Briefs] Failed to get brief for engagement ${engagementId}:`, error);
    return null;
  }
}

/**
 * Get all briefs for a company
 */
export async function getBriefsForCompany(companyId: string): Promise<Brief[]> {
  try {
    console.log('[Briefs] Fetching briefs for company:', {
      companyId,
      companyIdLength: companyId.length,
      filterFormula: `{companyId} = "${companyId}"`,
    });

    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `{companyId} = "${companyId}"`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    console.log('[Briefs] Found briefs:', {
      count: records.length,
      briefIds: records.map((r) => r.id),
    });

    return records.map((r: { id: string; fields: Record<string, unknown> }) =>
      mapAirtableRecord(r)
    );
  } catch (error) {
    console.error(`[Briefs] Failed to get briefs for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Update a brief
 */
export async function updateBrief(
  briefId: string,
  updates: Partial<Omit<Brief, 'id' | 'companyId' | 'engagementId' | 'projectId' | 'createdAt'>>
): Promise<Brief | null> {
  try {
    const now = new Date().toISOString();

    // Get existing brief to preserve required fields
    const existing = await getBriefById(briefId);
    if (!existing) {
      console.error(`[Briefs] Brief ${briefId} not found`);
      return null;
    }

    const fields: Record<string, unknown> = {
      'updatedAt': now,
    };

    if (updates.title !== undefined) {
      fields['title'] = updates.title;
    }

    if (updates.type !== undefined) {
      fields['type'] = updates.type;
    }

    if (updates.status !== undefined) {
      fields['status'] = updates.status;
    }

    if (updates.core !== undefined) {
      // Store objective as summary, format core as markdown for body
      if (updates.core.objective) {
        fields['summary'] = updates.core.objective;
      }
      fields['body'] = formatCoreAsMarkdown(updates.core);
    }

    if (updates.traceability !== undefined) {
      if (updates.traceability.sourceStrategicBetIds?.length) {
        fields['relatedPillarIds'] = updates.traceability.sourceStrategicBetIds.join(',');
      }
    }

    if (updates.approvedAt !== undefined) {
      fields['approvedAt'] = updates.approvedAt;
    }

    if (updates.approvedBy !== undefined) {
      fields['approvedBy'] = updates.approvedBy;
    }

    const record = await base(BRIEFS_TABLE).update(briefId, fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Briefs] Failed to update brief ${briefId}:`, error);
    return null;
  }
}

/**
 * Update brief core fields
 */
export async function updateBriefCore(
  briefId: string,
  core: BriefCore
): Promise<Brief | null> {
  return updateBrief(briefId, { core });
}

/**
 * Update brief extension fields
 */
export async function updateBriefExtension(
  briefId: string,
  extension: BriefExtension
): Promise<Brief | null> {
  return updateBrief(briefId, { extension });
}

/**
 * Update brief status
 */
export async function updateBriefStatus(
  briefId: string,
  status: BriefStatus
): Promise<Brief | null> {
  return updateBrief(briefId, { status });
}

/**
 * Approve a brief
 */
export async function approveBrief(
  briefId: string,
  approvedBy?: string
): Promise<Brief | null> {
  const now = new Date().toISOString();
  return updateBrief(briefId, {
    status: 'approved',
    approvedAt: now,
    approvedBy,
  });
}

/**
 * Lock a brief (after approval)
 */
export async function lockBrief(
  briefId: string,
  reason: string = 'Brief approved and locked',
  lockedBy?: string
): Promise<Brief | null> {
  const now = new Date().toISOString();
  return updateBrief(briefId, {
    status: 'locked',
    isLocked: true,
    lockedAt: now,
    lockedBy,
    lockedReason: reason,
  });
}

/**
 * Unlock a brief (requires reason)
 */
export async function unlockBrief(
  briefId: string,
  unlockReason: string
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  // Determine status after unlock: 'approved' if was approved, otherwise 'draft'
  const newStatus = existing.approvedAt ? 'approved' : 'draft';

  return updateBrief(briefId, {
    status: newStatus,
    isLocked: false,
    unlockReason,
  });
}

/**
 * Delete a brief
 */
export async function deleteBrief(briefId: string): Promise<boolean> {
  try {
    await base(BRIEFS_TABLE).destroy(briefId);
    return true;
  } catch (error) {
    console.error(`[Briefs] Failed to delete brief ${briefId}:`, error);
    return false;
  }
}

// ============================================================================
// Field Update Operations
// ============================================================================

/**
 * Update a single field in the brief core
 */
export async function updateBriefCoreField(
  briefId: string,
  fieldKey: keyof BriefCore,
  value: string | string[]
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  const updatedCore = {
    ...existing.core,
    [fieldKey]: value,
  };

  return updateBriefCore(briefId, updatedCore);
}

/**
 * Update a single field in the brief extension
 */
export async function updateBriefExtensionField(
  briefId: string,
  fieldKey: string,
  value: unknown
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  const updatedExtension = {
    ...existing.extension,
    [fieldKey]: value,
  };

  return updateBriefExtension(briefId, updatedExtension as BriefExtension);
}

// ============================================================================
// Traceability Operations
// ============================================================================

/**
 * Update brief traceability
 */
export async function updateBriefTraceability(
  briefId: string,
  traceability: BriefTraceability
): Promise<Brief | null> {
  return updateBrief(briefId, { traceability });
}

/**
 * Add a strategic bet ID to traceability
 */
export async function addStrategicBetToBrief(
  briefId: string,
  betId: string
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  const updatedTraceability: BriefTraceability = {
    ...existing.traceability,
    sourceStrategicBetIds: [
      ...new Set([...existing.traceability.sourceStrategicBetIds, betId]),
    ],
  };

  return updateBriefTraceability(briefId, updatedTraceability);
}

// ============================================================================
// Change Log Operations
// ============================================================================

/**
 * Append an entry to the brief's change log
 */
export async function appendToChangeLog(
  briefId: string,
  entry: Omit<BriefChangeLogEntry, 'at'>
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  const newEntry: BriefChangeLogEntry = {
    ...entry,
    at: new Date().toISOString(),
  };

  const updatedChangeLog = [...existing.changeLog, newEntry];

  return updateBrief(briefId, { changeLog: updatedChangeLog });
}

/**
 * Update a brief field with change log audit
 * This is the preferred way to update fields as it records the change.
 */
export async function updateBriefFieldWithAudit(
  briefId: string,
  fieldPath: string, // e.g., "core.objective" or "extension.visualDirection"
  newValue: unknown,
  source: BriefChangeSource,
  actor?: string
): Promise<Brief | null> {
  const existing = await getBriefById(briefId);
  if (!existing) return null;

  // Get old value
  const [section, fieldName] = fieldPath.split('.') as ['core' | 'extension', string];
  const oldValue = section === 'core'
    ? (existing.core as unknown as Record<string, unknown>)[fieldName]
    : (existing.extension as unknown as Record<string, unknown>)[fieldName];

  // Update the field
  let result: Brief | null;
  if (section === 'core') {
    result = await updateBriefCoreField(briefId, fieldName as keyof BriefCore, newValue as string | string[]);
  } else {
    result = await updateBriefExtensionField(briefId, fieldName, newValue);
  }

  if (!result) return null;

  // Append to change log
  return appendToChangeLog(briefId, {
    fieldPath,
    from: oldValue,
    to: newValue,
    source,
    actor,
  });
}
