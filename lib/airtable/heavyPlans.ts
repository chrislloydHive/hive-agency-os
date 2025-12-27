// lib/airtable/heavyPlans.ts
// Airtable CRUD operations for Heavy Media Plans and Content Plans
//
// Heavy plans are structured planning objects that bridge Decide → Deliver → Work.
// They track lifecycle status, version, and source snapshots for staleness detection.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaPlan,
  ContentPlan,
  MediaPlanSections,
  ContentPlanSections,
  PlanStatus,
  PlanType,
  PlanSourceSnapshot,
  CreateMediaPlanInput,
  CreateContentPlanInput,
} from '@/lib/types/plan';
import {
  createDefaultMediaPlanSections,
  createDefaultContentPlanSections,
} from '@/lib/types/plan';

// ============================================================================
// Constants
// ============================================================================

const MEDIA_PLANS_TABLE = AIRTABLE_TABLES.HEAVY_MEDIA_PLANS;
const CONTENT_PLANS_TABLE = AIRTABLE_TABLES.HEAVY_CONTENT_PLANS;

// ============================================================================
// Field Mapping - Media Plans
// ============================================================================

/**
 * Map Airtable record to MediaPlan entity
 */
function mapAirtableRecordToMediaPlan(record: {
  id: string;
  fields: Record<string, unknown>;
}): MediaPlan {
  const fields = record.fields;

  // Parse JSON sections
  let sections: MediaPlanSections;
  try {
    const sectionsJson = fields['sectionsJson'] as string | undefined;
    sections = sectionsJson
      ? JSON.parse(sectionsJson)
      : createDefaultMediaPlanSections();
  } catch {
    sections = createDefaultMediaPlanSections();
  }

  // Parse source snapshot
  let sourceSnapshot: PlanSourceSnapshot;
  try {
    const snapshotJson = fields['sourceSnapshotJson'] as string | undefined;
    sourceSnapshot = snapshotJson
      ? JSON.parse(snapshotJson)
      : { contextHash: 'empty', strategyHash: 'empty', contextConfirmedAt: null, strategyLockedAt: null };
  } catch {
    sourceSnapshot = { contextHash: 'empty', strategyHash: 'empty', contextConfirmedAt: null, strategyLockedAt: null };
  }

  return {
    id: record.id,
    companyId: (fields['companyId'] as string) || '',
    strategyId: (fields['strategyId'] as string) || '',
    status: (fields['status'] as PlanStatus) || 'draft',
    version: (fields['version'] as number) || 1,
    sourceSnapshot,
    sections,
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    updatedAt: (fields['updatedAt'] as string) || new Date().toISOString(),
    createdBy: (fields['createdBy'] as string) || undefined,
    updatedBy: (fields['updatedBy'] as string) || undefined,
    submittedAt: (fields['submittedAt'] as string) || undefined,
    approvedAt: (fields['approvedAt'] as string) || undefined,
    approvedBy: (fields['approvedBy'] as string) || undefined,
    archivedAt: (fields['archivedAt'] as string) || undefined,
    archivedReason: (fields['archivedReason'] as string) || undefined,
    supersededByPlanId: (fields['supersededByPlanId'] as string) || undefined,
    supersedesPlanId: (fields['supersedesPlanId'] as string) || undefined,
  };
}

/**
 * Map MediaPlan to Airtable fields for create
 */
function mapMediaPlanToCreateFields(
  input: CreateMediaPlanInput,
  sections: MediaPlanSections,
  sourceSnapshot: PlanSourceSnapshot,
  now: string
): Record<string, unknown> {
  return {
    companyId: input.companyId,
    strategyId: input.strategyId,
    status: 'draft',
    version: 1,
    sectionsJson: JSON.stringify(sections),
    sourceSnapshotJson: JSON.stringify(sourceSnapshot),
    // Decomposed fields for filtering/reporting
    goalStatement: sections.summary.goalStatement || '',
    totalBudget: sections.budget.totalMonthly || sections.budget.totalQuarterly || null,
    currency: sections.budget.currency || 'USD',
    channelCount: sections.channelMix.length,
    campaignCount: sections.campaigns.length,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Field Mapping - Content Plans
// ============================================================================

/**
 * Map Airtable record to ContentPlan entity
 */
function mapAirtableRecordToContentPlan(record: {
  id: string;
  fields: Record<string, unknown>;
}): ContentPlan {
  const fields = record.fields;

  // Parse JSON sections
  let sections: ContentPlanSections;
  try {
    const sectionsJson = fields['sectionsJson'] as string | undefined;
    sections = sectionsJson
      ? JSON.parse(sectionsJson)
      : createDefaultContentPlanSections();
  } catch {
    sections = createDefaultContentPlanSections();
  }

  // Parse source snapshot
  let sourceSnapshot: PlanSourceSnapshot;
  try {
    const snapshotJson = fields['sourceSnapshotJson'] as string | undefined;
    sourceSnapshot = snapshotJson
      ? JSON.parse(snapshotJson)
      : { contextHash: 'empty', strategyHash: 'empty', contextConfirmedAt: null, strategyLockedAt: null };
  } catch {
    sourceSnapshot = { contextHash: 'empty', strategyHash: 'empty', contextConfirmedAt: null, strategyLockedAt: null };
  }

  return {
    id: record.id,
    companyId: (fields['companyId'] as string) || '',
    strategyId: (fields['strategyId'] as string) || '',
    status: (fields['status'] as PlanStatus) || 'draft',
    version: (fields['version'] as number) || 1,
    sourceSnapshot,
    sections,
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    updatedAt: (fields['updatedAt'] as string) || new Date().toISOString(),
    createdBy: (fields['createdBy'] as string) || undefined,
    updatedBy: (fields['updatedBy'] as string) || undefined,
    submittedAt: (fields['submittedAt'] as string) || undefined,
    approvedAt: (fields['approvedAt'] as string) || undefined,
    approvedBy: (fields['approvedBy'] as string) || undefined,
    archivedAt: (fields['archivedAt'] as string) || undefined,
    archivedReason: (fields['archivedReason'] as string) || undefined,
    supersededByPlanId: (fields['supersededByPlanId'] as string) || undefined,
    supersedesPlanId: (fields['supersedesPlanId'] as string) || undefined,
  };
}

/**
 * Map ContentPlan to Airtable fields for create
 */
function mapContentPlanToCreateFields(
  input: CreateContentPlanInput,
  sections: ContentPlanSections,
  sourceSnapshot: PlanSourceSnapshot,
  now: string
): Record<string, unknown> {
  return {
    companyId: input.companyId,
    strategyId: input.strategyId,
    status: 'draft',
    version: 1,
    sectionsJson: JSON.stringify(sections),
    sourceSnapshotJson: JSON.stringify(sourceSnapshot),
    // Decomposed fields for filtering/reporting
    editorialThesis: sections.summary.editorialThesis || '',
    pillarCount: sections.pillars.length,
    calendarItemCount: sections.calendar.length,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Media Plan CRUD
// ============================================================================

/**
 * Get a Media Plan by ID
 */
export async function getMediaPlanById(planId: string): Promise<MediaPlan | null> {
  try {
    const record = await base(MEDIA_PLANS_TABLE).find(planId);
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get media plan ${planId}:`, error);
    return null;
  }
}

/**
 * Get all Media Plans for a company
 */
export async function getMediaPlansForCompany(companyId: string): Promise<MediaPlan[]> {
  try {
    const records = await base(MEDIA_PLANS_TABLE)
      .select({
        filterByFormula: `{companyId} = "${companyId}"`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();
    return records.map(mapAirtableRecordToMediaPlan);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get media plans for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Get active (non-archived) Media Plan for a company/strategy
 */
export async function getActiveMediaPlan(
  companyId: string,
  strategyId: string
): Promise<MediaPlan | null> {
  try {
    const records = await base(MEDIA_PLANS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {strategyId} = "${strategyId}", {status} != "archived")`,
        sort: [{ field: 'version', direction: 'desc' }],
        maxRecords: 1,
      })
      .all();
    return records.length > 0 ? mapAirtableRecordToMediaPlan(records[0]) : null;
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get active media plan:`, error);
    return null;
  }
}

/**
 * Create a new Media Plan
 */
export async function createMediaPlan(
  input: CreateMediaPlanInput,
  sourceSnapshot: PlanSourceSnapshot
): Promise<MediaPlan | null> {
  try {
    const now = new Date().toISOString();
    const sections = {
      ...createDefaultMediaPlanSections(),
      ...(input.sections || {}),
    };
    const fields = mapMediaPlanToCreateFields(input, sections, sourceSnapshot, now);
    const record = await base(MEDIA_PLANS_TABLE).create(fields as any) as unknown as { id: string; fields: Record<string, unknown> };
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error('[HeavyPlans] Failed to create media plan:', error);
    return null;
  }
}

/**
 * Update Media Plan sections
 */
export async function updateMediaPlanSections(
  planId: string,
  sections: Partial<MediaPlanSections>
): Promise<MediaPlan | null> {
  try {
    const existing = await getMediaPlanById(planId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const mergedSections = { ...existing.sections, ...sections };

    const fields: Record<string, unknown> = {
      sectionsJson: JSON.stringify(mergedSections),
      updatedAt: now,
      // Update decomposed fields
      goalStatement: mergedSections.summary.goalStatement || '',
      totalBudget: mergedSections.budget.totalMonthly || mergedSections.budget.totalQuarterly || null,
      channelCount: mergedSections.channelMix.length,
      campaignCount: mergedSections.campaigns.length,
    };

    const record = await base(MEDIA_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to update media plan sections ${planId}:`, error);
    return null;
  }
}

/**
 * Update Media Plan status
 */
export async function updateMediaPlanStatus(
  planId: string,
  status: PlanStatus,
  metadata?: {
    submittedAt?: string;
    approvedAt?: string;
    approvedBy?: string;
    version?: number;
    sourceSnapshot?: PlanSourceSnapshot;
  }
): Promise<MediaPlan | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (metadata?.submittedAt) fields.submittedAt = metadata.submittedAt;
    if (metadata?.approvedAt) fields.approvedAt = metadata.approvedAt;
    if (metadata?.approvedBy) fields.approvedBy = metadata.approvedBy;
    if (metadata?.version) fields.version = metadata.version;
    if (metadata?.sourceSnapshot) {
      fields.sourceSnapshotJson = JSON.stringify(metadata.sourceSnapshot);
    }

    const record = await base(MEDIA_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to update media plan status ${planId}:`, error);
    return null;
  }
}

// ============================================================================
// Content Plan CRUD
// ============================================================================

/**
 * Get a Content Plan by ID
 */
export async function getContentPlanById(planId: string): Promise<ContentPlan | null> {
  try {
    const record = await base(CONTENT_PLANS_TABLE).find(planId);
    return mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get content plan ${planId}:`, error);
    return null;
  }
}

/**
 * Get all Content Plans for a company
 */
export async function getContentPlansForCompany(companyId: string): Promise<ContentPlan[]> {
  try {
    const records = await base(CONTENT_PLANS_TABLE)
      .select({
        filterByFormula: `{companyId} = "${companyId}"`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();
    return records.map(mapAirtableRecordToContentPlan);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get content plans for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Get active (non-archived) Content Plan for a company/strategy
 */
export async function getActiveContentPlan(
  companyId: string,
  strategyId: string
): Promise<ContentPlan | null> {
  try {
    const records = await base(CONTENT_PLANS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {strategyId} = "${strategyId}", {status} != "archived")`,
        sort: [{ field: 'version', direction: 'desc' }],
        maxRecords: 1,
      })
      .all();
    return records.length > 0 ? mapAirtableRecordToContentPlan(records[0]) : null;
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get active content plan:`, error);
    return null;
  }
}

/**
 * Create a new Content Plan
 */
export async function createContentPlan(
  input: CreateContentPlanInput,
  sourceSnapshot: PlanSourceSnapshot
): Promise<ContentPlan | null> {
  try {
    const now = new Date().toISOString();
    const sections = {
      ...createDefaultContentPlanSections(),
      ...(input.sections || {}),
    };
    const fields = mapContentPlanToCreateFields(input, sections, sourceSnapshot, now);
    const record = await base(CONTENT_PLANS_TABLE).create(fields as any) as unknown as { id: string; fields: Record<string, unknown> };
    return mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error('[HeavyPlans] Failed to create content plan:', error);
    return null;
  }
}

/**
 * Update Content Plan sections
 */
export async function updateContentPlanSections(
  planId: string,
  sections: Partial<ContentPlanSections>
): Promise<ContentPlan | null> {
  try {
    const existing = await getContentPlanById(planId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const mergedSections = { ...existing.sections, ...sections };

    const fields: Record<string, unknown> = {
      sectionsJson: JSON.stringify(mergedSections),
      updatedAt: now,
      // Update decomposed fields
      editorialThesis: mergedSections.summary.editorialThesis || '',
      pillarCount: mergedSections.pillars.length,
      calendarItemCount: mergedSections.calendar.length,
    };

    const record = await base(CONTENT_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to update content plan sections ${planId}:`, error);
    return null;
  }
}

/**
 * Update Content Plan status
 */
export async function updateContentPlanStatus(
  planId: string,
  status: PlanStatus,
  metadata?: {
    submittedAt?: string;
    approvedAt?: string;
    approvedBy?: string;
    version?: number;
    sourceSnapshot?: PlanSourceSnapshot;
  }
): Promise<ContentPlan | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (metadata?.submittedAt) fields.submittedAt = metadata.submittedAt;
    if (metadata?.approvedAt) fields.approvedAt = metadata.approvedAt;
    if (metadata?.approvedBy) fields.approvedBy = metadata.approvedBy;
    if (metadata?.version) fields.version = metadata.version;
    if (metadata?.sourceSnapshot) {
      fields.sourceSnapshotJson = JSON.stringify(metadata.sourceSnapshot);
    }

    const record = await base(CONTENT_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to update content plan status ${planId}:`, error);
    return null;
  }
}

// ============================================================================
// Generic Plan Operations
// ============================================================================

/**
 * Get any plan by type and ID
 */
export async function getPlanById(
  type: PlanType,
  planId: string
): Promise<MediaPlan | ContentPlan | null> {
  return type === 'media'
    ? getMediaPlanById(planId)
    : getContentPlanById(planId);
}

/**
 * Get active plan by type
 */
export async function getActivePlan(
  type: PlanType,
  companyId: string,
  strategyId: string
): Promise<MediaPlan | ContentPlan | null> {
  return type === 'media'
    ? getActiveMediaPlan(companyId, strategyId)
    : getActiveContentPlan(companyId, strategyId);
}

/**
 * Update plan status by type
 */
export async function updatePlanStatus(
  type: PlanType,
  planId: string,
  status: PlanStatus,
  metadata?: {
    submittedAt?: string;
    approvedAt?: string;
    approvedBy?: string;
    version?: number;
    sourceSnapshot?: PlanSourceSnapshot;
  }
): Promise<MediaPlan | ContentPlan | null> {
  return type === 'media'
    ? updateMediaPlanStatus(planId, status, metadata)
    : updateContentPlanStatus(planId, status, metadata);
}

// ============================================================================
// Archive Operations
// ============================================================================

export interface ArchivePlanInput {
  archivedReason?: string;
  supersededByPlanId?: string;
}

/**
 * Archive a Media Plan
 */
export async function archiveMediaPlan(
  planId: string,
  input: ArchivePlanInput = {}
): Promise<MediaPlan | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    if (input.archivedReason) fields.archivedReason = input.archivedReason;
    if (input.supersededByPlanId) fields.supersededByPlanId = input.supersededByPlanId;

    const record = await base(MEDIA_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to archive media plan ${planId}:`, error);
    return null;
  }
}

/**
 * Archive a Content Plan
 */
export async function archiveContentPlan(
  planId: string,
  input: ArchivePlanInput = {}
): Promise<ContentPlan | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    if (input.archivedReason) fields.archivedReason = input.archivedReason;
    if (input.supersededByPlanId) fields.supersededByPlanId = input.supersededByPlanId;

    const record = await base(CONTENT_PLANS_TABLE).update(planId, fields as any);
    return mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to archive content plan ${planId}:`, error);
    return null;
  }
}

/**
 * Archive a plan by type
 */
export async function archivePlan(
  type: PlanType,
  planId: string,
  input: ArchivePlanInput = {}
): Promise<MediaPlan | ContentPlan | null> {
  return type === 'media'
    ? archiveMediaPlan(planId, input)
    : archiveContentPlan(planId, input);
}

/**
 * Set supersedes link on a plan (called on the new approved plan)
 */
export async function setPlanSupersedes(
  type: PlanType,
  planId: string,
  supersedesPlanId: string
): Promise<MediaPlan | ContentPlan | null> {
  try {
    const table = type === 'media' ? MEDIA_PLANS_TABLE : CONTENT_PLANS_TABLE;
    const fields: Record<string, unknown> = {
      supersedesPlanId,
    };

    const record = await base(table).update(planId, fields as any);
    return type === 'media'
      ? mapAirtableRecordToMediaPlan(record)
      : mapAirtableRecordToContentPlan(record);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to set supersedes link on plan ${planId}:`, error);
    return null;
  }
}

/**
 * Get the currently approved plan for a company/strategy (if any)
 * Used to find plan to supersede when approving a new version
 */
export async function getApprovedPlan(
  type: PlanType,
  companyId: string,
  strategyId: string
): Promise<MediaPlan | ContentPlan | null> {
  try {
    const table = type === 'media' ? MEDIA_PLANS_TABLE : CONTENT_PLANS_TABLE;
    const records = await base(table)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {strategyId} = "${strategyId}", {status} = "approved")`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) return null;

    return type === 'media'
      ? mapAirtableRecordToMediaPlan(records[0])
      : mapAirtableRecordToContentPlan(records[0]);
  } catch (error) {
    console.error(`[HeavyPlans] Failed to get approved plan:`, error);
    return null;
  }
}
