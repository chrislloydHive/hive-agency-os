// lib/airtable/creativeBriefs.ts
// Airtable integration for CreativeBriefs table
//
// Creative briefs are the terminal artifacts of project-scoped strategy.
// They are stored as JSON blobs with structured content schemas.

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  CreativeBrief,
  BriefStatus,
  BriefContent,
  BriefSourceSnapshot,
  BriefFieldProvenance,
} from '@/lib/types/creativeBrief';
import type { ProjectType } from '@/lib/types/engagement';

const CREATIVE_BRIEFS_TABLE = AIRTABLE_TABLES.CREATIVE_BRIEFS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Map Airtable record to CreativeBrief
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): CreativeBrief | null {
  try {
    const fields = record.fields;

    // Get linked company ID
    const companyLinks = fields['Company'] as string[] | undefined;
    const companyId = companyLinks?.[0] || (fields['Company ID'] as string) || '';

    // Parse JSON blobs
    const contentJson = fields['Content JSON'] as string | undefined;
    const snapshotJson = fields['Source Snapshot JSON'] as string | undefined;
    const provenanceJson = fields['Field Provenance JSON'] as string | undefined;

    const content: BriefContent = contentJson
      ? JSON.parse(contentJson)
      : { projectType: 'other', projectName: '', objective: '', primaryAudience: '', singleMindedMessage: '', supportingPoints: [], brandVoice: '', mandatories: [], constraints: [], successDefinition: '' };

    const sourceSnapshot: BriefSourceSnapshot = snapshotJson
      ? JSON.parse(snapshotJson)
      : { projectStrategyId: '', strategySnapshotAt: '', projectStrategyFrame: {}, objectives: [], acceptedBets: [], inputHashes: {} };

    const fieldProvenance: BriefFieldProvenance | undefined = provenanceJson
      ? JSON.parse(provenanceJson)
      : undefined;

    return {
      id: record.id,
      companyId,
      projectId: (fields['Project ID'] as string) || '',
      projectType: (fields['Project Type'] as ProjectType) || 'other',
      title: (fields['Title'] as string) || '',
      content,
      status: (fields['Status'] as BriefStatus) || 'draft',
      sourceSnapshot,
      fieldProvenance,
      approvedAt: (fields['Approved At'] as string) || undefined,
      approvedBy: (fields['Approved By'] as string) || undefined,
      approvalNotes: (fields['Approval Notes'] as string) || undefined,
      version: (fields['Version'] as number) || 1,
      previousVersionId: (fields['Previous Version ID'] as string) || undefined,
      isLocked: (fields['Is Locked'] as boolean) || false,
      lockedAt: (fields['Locked At'] as string) || undefined,
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
      generatedAt: (fields['Generated At'] as string) || undefined,
    };
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to map record ${record.id}:`, error);
    return null;
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a creative brief by ID
 */
export async function getCreativeBriefById(briefId: string): Promise<CreativeBrief | null> {
  try {
    const base = getBase();
    const record = await base(CREATIVE_BRIEFS_TABLE).find(briefId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to get brief ${briefId}:`, error);
    return null;
  }
}

/**
 * Get creative brief by project ID
 */
export async function getCreativeBriefByProjectId(projectId: string): Promise<CreativeBrief | null> {
  try {
    const base = getBase();

    const records = await base(CREATIVE_BRIEFS_TABLE)
      .select({
        filterByFormula: `{Project ID} = "${projectId}"`,
        sort: [{ field: 'Version', direction: 'desc' }],
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) return null;

    return mapAirtableRecord(records[0] as { id: string; fields: Record<string, unknown> });
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      console.warn(`[CreativeBriefs] Table "${CREATIVE_BRIEFS_TABLE}" not found in Airtable.`);
      return null;
    }
    console.error(`[CreativeBriefs] Failed to get brief for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Get all creative briefs for a company
 */
export async function getCreativeBriefsForCompany(companyId: string): Promise<CreativeBrief[]> {
  try {
    const base = getBase();

    const filterFormula = `OR(FIND("${companyId}", ARRAYJOIN({Company})) > 0, {Company ID} = "${companyId}")`;

    const records = await base(CREATIVE_BRIEFS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    const briefs = records
      .map(record => mapAirtableRecord(record as { id: string; fields: Record<string, unknown> }))
      .filter((b): b is CreativeBrief => b !== null);

    return briefs;
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to get briefs for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Create a new creative brief
 */
export async function createCreativeBrief(input: {
  companyId: string;
  projectId: string;
  projectType: ProjectType;
  title: string;
  content: BriefContent;
  sourceSnapshot: BriefSourceSnapshot;
}): Promise<CreativeBrief | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(CREATIVE_BRIEFS_TABLE).create({
      'Company': [input.companyId],
      'Company ID': input.companyId,
      'Project ID': input.projectId,
      'Project Type': input.projectType,
      'Title': input.title,
      'Content JSON': JSON.stringify(input.content),
      'Source Snapshot JSON': JSON.stringify(input.sourceSnapshot),
      'Status': 'draft' as BriefStatus,
      'Version': 1,
      'Is Locked': false,
      'Created At': now,
      'Updated At': now,
      'Generated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to create brief:`, error);
    return null;
  }
}

/**
 * Update a creative brief
 */
export async function updateCreativeBrief(
  briefId: string,
  updates: {
    title?: string;
    content?: BriefContent;
    status?: BriefStatus;
    fieldProvenance?: BriefFieldProvenance;
    approvedAt?: string;
    approvedBy?: string;
    approvalNotes?: string;
    isLocked?: boolean;
    lockedAt?: string;
  }
): Promise<CreativeBrief | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      'Updated At': now,
    };

    if (updates.title !== undefined) {
      fields['Title'] = updates.title;
    }
    if (updates.content !== undefined) {
      fields['Content JSON'] = JSON.stringify(updates.content);
    }
    if (updates.status !== undefined) {
      fields['Status'] = updates.status;
    }
    if (updates.fieldProvenance !== undefined) {
      fields['Field Provenance JSON'] = JSON.stringify(updates.fieldProvenance);
    }
    if (updates.approvedAt !== undefined) {
      fields['Approved At'] = updates.approvedAt;
    }
    if (updates.approvedBy !== undefined) {
      fields['Approved By'] = updates.approvedBy;
    }
    if (updates.approvalNotes !== undefined) {
      fields['Approval Notes'] = updates.approvalNotes;
    }
    if (updates.isLocked !== undefined) {
      fields['Is Locked'] = updates.isLocked;
    }
    if (updates.lockedAt !== undefined) {
      fields['Locked At'] = updates.lockedAt;
    }

    const record = await base(CREATIVE_BRIEFS_TABLE).update(briefId, fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to update brief ${briefId}:`, error);
    return null;
  }
}

/**
 * Update brief content
 */
export async function updateBriefContent(
  briefId: string,
  content: BriefContent
): Promise<CreativeBrief | null> {
  return updateCreativeBrief(briefId, { content });
}

/**
 * Update a single field in brief content
 */
export async function updateBriefField(
  briefId: string,
  fieldPath: string,
  value: unknown
): Promise<CreativeBrief | null> {
  const brief = await getCreativeBriefById(briefId);
  if (!brief) return null;

  // Parse field path and update nested value
  const parts = fieldPath.split('.');
  const updatedContent = { ...brief.content };

  let current: Record<string, unknown> = updatedContent as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;

  return updateBriefContent(briefId, updatedContent as BriefContent);
}

/**
 * Update brief status
 */
export async function updateBriefStatus(
  briefId: string,
  status: BriefStatus
): Promise<CreativeBrief | null> {
  return updateCreativeBrief(briefId, { status });
}

/**
 * Approve a brief
 */
export async function approveBrief(
  briefId: string,
  approvedBy?: string,
  approvalNotes?: string
): Promise<CreativeBrief | null> {
  const now = new Date().toISOString();
  return updateCreativeBrief(briefId, {
    status: 'approved',
    approvedAt: now,
    approvedBy,
    approvalNotes,
    isLocked: true,
    lockedAt: now,
  });
}

/**
 * Create a new version of a brief (for regeneration)
 */
export async function createBriefVersion(
  previousBriefId: string,
  newContent: BriefContent,
  newSourceSnapshot: BriefSourceSnapshot
): Promise<CreativeBrief | null> {
  const previousBrief = await getCreativeBriefById(previousBriefId);
  if (!previousBrief) return null;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(CREATIVE_BRIEFS_TABLE).create({
      'Company': [previousBrief.companyId],
      'Company ID': previousBrief.companyId,
      'Project ID': previousBrief.projectId,
      'Project Type': previousBrief.projectType,
      'Title': previousBrief.title,
      'Content JSON': JSON.stringify(newContent),
      'Source Snapshot JSON': JSON.stringify(newSourceSnapshot),
      'Status': 'draft' as BriefStatus,
      'Version': previousBrief.version + 1,
      'Previous Version ID': previousBriefId,
      'Is Locked': false,
      'Created At': now,
      'Updated At': now,
      'Generated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to create brief version:`, error);
    return null;
  }
}

/**
 * Delete a creative brief
 */
export async function deleteCreativeBrief(briefId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(CREATIVE_BRIEFS_TABLE).destroy(briefId);
    return true;
  } catch (error) {
    console.error(`[CreativeBriefs] Failed to delete brief ${briefId}:`, error);
    return false;
  }
}
