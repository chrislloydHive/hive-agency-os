// lib/airtable/projects.ts
// Airtable integration for Projects table
//
// Projects are specific deliverables within engagements that flow through:
// GAP → Project Strategy → Creative Brief → Work Items

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  Project,
  ProjectStatus,
  CreateProjectInput,
  ProjectListItem,
} from '@/lib/types/project';
import type { ProjectType } from '@/lib/types/engagement';

const PROJECTS_TABLE = AIRTABLE_TABLES.PROJECTS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Map Airtable record to Project
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): Project | null {
  try {
    const fields = record.fields;

    // Get linked company ID
    const companyLinks = fields['Company'] as string[] | undefined;
    const companyId = companyLinks?.[0] || (fields['Company ID'] as string) || '';

    // Get linked engagement ID
    const engagementLinks = fields['Engagement'] as string[] | undefined;
    const engagementId = engagementLinks?.[0] || (fields['Engagement ID'] as string) || '';

    return {
      id: record.id,
      companyId,
      engagementId,
      name: (fields['Name'] as string) || '',
      type: (fields['Project Type'] as ProjectType) || 'other',
      description: (fields['Description'] as string) || undefined,
      status: (fields['Status'] as ProjectStatus) || 'draft',

      // Readiness gates
      gapReportId: (fields['GAP Report ID'] as string) || undefined,
      gapReady: (fields['GAP Ready'] as boolean) || false,
      gapScore: (fields['GAP Score'] as number) || undefined,

      // Strategy link
      projectStrategyId: (fields['Project Strategy ID'] as string) || undefined,
      hasAcceptedBets: (fields['Has Accepted Bets'] as boolean) || false,

      // Brief link
      creativeBriefId: (fields['Creative Brief ID'] as string) || undefined,
      briefApproved: (fields['Brief Approved'] as boolean) || false,
      briefApprovedAt: (fields['Brief Approved At'] as string) || undefined,
      briefApprovedBy: (fields['Brief Approved By'] as string) || undefined,

      // Lock state
      isLocked: (fields['Is Locked'] as boolean) || false,
      lockedAt: (fields['Locked At'] as string) || undefined,
      lockedReason: (fields['Locked Reason'] as string) || undefined,

      // Metadata
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
      createdBy: (fields['Created By'] as string) || undefined,
    };
  } catch (error) {
    console.error(`[Projects] Failed to map record ${record.id}:`, error);
    return null;
  }
}

/**
 * Map Project to Airtable fields for create/update
 */
function mapToAirtableFields(
  project: Partial<Project> & { companyId: string; engagementId: string },
  now: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    'Updated At': now,
  };

  if (project.companyId) {
    fields['Company'] = [project.companyId];
    fields['Company ID'] = project.companyId;
  }
  if (project.engagementId) {
    fields['Engagement'] = [project.engagementId];
    fields['Engagement ID'] = project.engagementId;
  }
  if (project.name !== undefined) fields['Name'] = project.name;
  if (project.type !== undefined) fields['Project Type'] = project.type;
  if (project.description !== undefined) fields['Description'] = project.description;
  if (project.status !== undefined) fields['Status'] = project.status;
  if (project.gapReportId !== undefined) fields['GAP Report ID'] = project.gapReportId;
  if (project.gapReady !== undefined) fields['GAP Ready'] = project.gapReady;
  if (project.gapScore !== undefined) fields['GAP Score'] = project.gapScore;
  if (project.projectStrategyId !== undefined) fields['Project Strategy ID'] = project.projectStrategyId;
  if (project.hasAcceptedBets !== undefined) fields['Has Accepted Bets'] = project.hasAcceptedBets;
  if (project.creativeBriefId !== undefined) fields['Creative Brief ID'] = project.creativeBriefId;
  if (project.briefApproved !== undefined) fields['Brief Approved'] = project.briefApproved;
  if (project.briefApprovedAt !== undefined) fields['Brief Approved At'] = project.briefApprovedAt;
  if (project.briefApprovedBy !== undefined) fields['Brief Approved By'] = project.briefApprovedBy;
  if (project.isLocked !== undefined) fields['Is Locked'] = project.isLocked;
  if (project.lockedAt !== undefined) fields['Locked At'] = project.lockedAt;
  if (project.lockedReason !== undefined) fields['Locked Reason'] = project.lockedReason;

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all projects for a company
 */
export async function getProjectsForCompany(companyId: string): Promise<Project[]> {
  try {
    const base = getBase();

    const filterFormula = `OR(FIND("${companyId}", ARRAYJOIN({Company})) > 0, {Company ID} = "${companyId}")`;

    const records = await base(PROJECTS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    const projects = records
      .map(record => mapAirtableRecord(record as { id: string; fields: Record<string, unknown> }))
      .filter((p): p is Project => p !== null);

    return projects;
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      console.warn(`[Projects] Table "${PROJECTS_TABLE}" not found in Airtable.`);
      return [];
    }
    console.error(`[Projects] Failed to get projects for ${companyId}:`, error);
    return [];
  }
}

/**
 * Get projects for an engagement
 */
export async function getProjectsForEngagement(engagementId: string): Promise<Project[]> {
  try {
    const base = getBase();

    const filterFormula = `OR(FIND("${engagementId}", ARRAYJOIN({Engagement})) > 0, {Engagement ID} = "${engagementId}")`;

    const records = await base(PROJECTS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    const projects = records
      .map(record => mapAirtableRecord(record as { id: string; fields: Record<string, unknown> }))
      .filter((p): p is Project => p !== null);

    return projects;
  } catch (error) {
    console.error(`[Projects] Failed to get projects for engagement ${engagementId}:`, error);
    return [];
  }
}

/**
 * Get a single project by ID
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const base = getBase();
    const record = await base(PROJECTS_TABLE).find(projectId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Projects] Failed to get project ${projectId}:`, error);
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields = mapToAirtableFields(
      {
        ...input,
        status: 'draft',
        gapReady: false,
        hasAcceptedBets: false,
        briefApproved: false,
        isLocked: false,
      },
      now
    );

    fields['Created At'] = now;

    const record = await base(PROJECTS_TABLE).create(fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Projects] Failed to create project:`, error);
    return null;
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'companyId' | 'engagementId' | 'createdAt'>>
): Promise<Project | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Get existing project to preserve required fields
    const existing = await getProjectById(projectId);
    if (!existing) {
      console.error(`[Projects] Project ${projectId} not found`);
      return null;
    }

    const fields = mapToAirtableFields(
      { ...updates, companyId: existing.companyId, engagementId: existing.engagementId },
      now
    );

    const record = await base(PROJECTS_TABLE).update(projectId, fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Projects] Failed to update project ${projectId}:`, error);
    return null;
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(PROJECTS_TABLE).destroy(projectId);
    return true;
  } catch (error) {
    console.error(`[Projects] Failed to delete project ${projectId}:`, error);
    return false;
  }
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<Project | null> {
  return updateProject(projectId, { status });
}

/**
 * Lock a project (after brief approval)
 */
export async function lockProject(
  projectId: string,
  reason: string
): Promise<Project | null> {
  const now = new Date().toISOString();
  return updateProject(projectId, {
    isLocked: true,
    lockedAt: now,
    lockedReason: reason,
  });
}

/**
 * Link GAP report to project
 */
export async function linkGapReportToProject(
  projectId: string,
  gapReportId: string,
  gapScore?: number
): Promise<Project | null> {
  return updateProject(projectId, {
    gapReportId,
    gapReady: true,
    gapScore,
  });
}

/**
 * Link project strategy to project
 */
export async function linkStrategyToProject(
  projectId: string,
  projectStrategyId: string
): Promise<Project | null> {
  return updateProject(projectId, { projectStrategyId });
}

/**
 * Update accepted bets status
 */
export async function updateProjectBetsStatus(
  projectId: string,
  hasAcceptedBets: boolean
): Promise<Project | null> {
  return updateProject(projectId, { hasAcceptedBets });
}

/**
 * Link creative brief to project and optionally approve
 */
export async function linkBriefToProject(
  projectId: string,
  creativeBriefId: string,
  approved?: { approvedAt: string; approvedBy?: string }
): Promise<Project | null> {
  const updates: Partial<Project> = { creativeBriefId };

  if (approved) {
    updates.briefApproved = true;
    updates.briefApprovedAt = approved.approvedAt;
    updates.briefApprovedBy = approved.approvedBy;
  }

  return updateProject(projectId, updates);
}

/**
 * Get project list items for display
 */
export async function getProjectListItems(companyId: string): Promise<ProjectListItem[]> {
  const projects = await getProjectsForCompany(companyId);

  return projects.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    status: p.status,
    engagementId: p.engagementId,
    gapReady: p.gapReady,
    hasAcceptedBets: p.hasAcceptedBets,
    briefApproved: p.briefApproved,
    isLocked: p.isLocked,
    updatedAt: p.updatedAt,
  }));
}
