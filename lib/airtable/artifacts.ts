// lib/airtable/artifacts.ts
// Airtable CRUD operations for Workspace Artifacts
//
// Artifacts are first-class document outputs (Strategy Docs, QBR Slides, Briefs)
// tracked in Airtable and linked to Google Drive files.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactSource,
  GoogleFileType,
  CreateArtifactInput,
  UpdateArtifactInput,
} from '@/lib/types/artifact';

// ============================================================================
// Constants
// ============================================================================

const ARTIFACTS_TABLE = AIRTABLE_TABLES.ARTIFACTS;

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Map Airtable record to Artifact entity
 *
 * Airtable schema (all camelCase):
 * companyId, title, type, status, source,
 * googleFileId, googleFileType, googleFileUrl, googleFolderId, googleModifiedAt,
 * sourceStrategyId, sourceQbrStoryId, sourceBriefId, sourceMediaPlanId,
 * engagementId, projectId,
 * contextVersionAtCreation, strategyVersionAtCreation, isStale, stalenessReason, stalenessCheckedAt,
 * createdBy, createdAt, updatedAt, updatedBy, description, tags
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): Artifact {
  const fields = record.fields;

  // Parse tags from comma-separated string
  const tagsStr = fields['tags'] as string | undefined;
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  return {
    id: record.id,
    companyId: (fields['companyId'] as string) || '',
    title: (fields['title'] as string) || '',
    type: (fields['type'] as ArtifactType) || 'custom',
    status: (fields['status'] as ArtifactStatus) || 'draft',
    source: (fields['source'] as ArtifactSource) || 'manual',

    // Google Drive fields
    googleFileId: (fields['googleFileId'] as string) || null,
    googleFileType: (fields['googleFileType'] as GoogleFileType) || null,
    googleFileUrl: (fields['googleFileUrl'] as string) || null,
    googleFolderId: (fields['googleFolderId'] as string) || null,
    googleModifiedAt: (fields['googleModifiedAt'] as string) || null,

    // Source linking
    sourceStrategyId: (fields['sourceStrategyId'] as string) || null,
    sourceQbrStoryId: (fields['sourceQbrStoryId'] as string) || null,
    sourceBriefId: (fields['sourceBriefId'] as string) || null,
    sourceMediaPlanId: (fields['sourceMediaPlanId'] as string) || null,
    engagementId: (fields['engagementId'] as string) || null,
    projectId: (fields['projectId'] as string) || null,

    // Staleness
    contextVersionAtCreation: (fields['contextVersionAtCreation'] as number) || null,
    strategyVersionAtCreation: (fields['strategyVersionAtCreation'] as number) || null,
    isStale: (fields['isStale'] as boolean) || false,
    stalenessReason: (fields['stalenessReason'] as string) || null,
    stalenessCheckedAt: (fields['stalenessCheckedAt'] as string) || null,

    // Metadata
    createdBy: (fields['createdBy'] as string) || null,
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    updatedAt: (fields['updatedAt'] as string) || new Date().toISOString(),
    updatedBy: (fields['updatedBy'] as string) || null,
    description: (fields['description'] as string) || null,
    tags,
  };
}

/**
 * Map CreateArtifactInput to Airtable fields
 */
function mapCreateInputToFields(
  input: CreateArtifactInput,
  now: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    companyId: input.companyId,
    title: input.title,
    type: input.type,
    status: 'draft',
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };

  // Optional fields
  if (input.sourceStrategyId) fields.sourceStrategyId = input.sourceStrategyId;
  if (input.sourceQbrStoryId) fields.sourceQbrStoryId = input.sourceQbrStoryId;
  if (input.sourceBriefId) fields.sourceBriefId = input.sourceBriefId;
  if (input.sourceMediaPlanId) fields.sourceMediaPlanId = input.sourceMediaPlanId;
  if (input.engagementId) fields.engagementId = input.engagementId;
  if (input.projectId) fields.projectId = input.projectId;

  if (input.googleFileId) fields.googleFileId = input.googleFileId;
  if (input.googleFileType) fields.googleFileType = input.googleFileType;
  if (input.googleFileUrl) fields.googleFileUrl = input.googleFileUrl;
  if (input.googleFolderId) fields.googleFolderId = input.googleFolderId;

  if (input.description) fields.description = input.description;
  if (input.tags?.length) fields.tags = input.tags.join(',');
  if (input.createdBy) fields.createdBy = input.createdBy;

  if (input.contextVersionAtCreation !== undefined) {
    fields.contextVersionAtCreation = input.contextVersionAtCreation;
  }
  if (input.strategyVersionAtCreation !== undefined) {
    fields.strategyVersionAtCreation = input.strategyVersionAtCreation;
  }

  return fields;
}

/**
 * Map UpdateArtifactInput to Airtable fields
 */
function mapUpdateInputToFields(
  input: UpdateArtifactInput,
  now: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    updatedAt: now,
  };

  if (input.title !== undefined) fields.title = input.title;
  if (input.status !== undefined) fields.status = input.status;
  if (input.description !== undefined) fields.description = input.description;
  if (input.tags !== undefined) fields.tags = input.tags.join(',');
  if (input.updatedBy !== undefined) fields.updatedBy = input.updatedBy;

  if (input.googleFileId !== undefined) fields.googleFileId = input.googleFileId;
  if (input.googleFileType !== undefined) fields.googleFileType = input.googleFileType;
  if (input.googleFileUrl !== undefined) fields.googleFileUrl = input.googleFileUrl;
  if (input.googleFolderId !== undefined) fields.googleFolderId = input.googleFolderId;
  if (input.googleModifiedAt !== undefined) fields.googleModifiedAt = input.googleModifiedAt;

  if (input.isStale !== undefined) fields.isStale = input.isStale;
  if (input.stalenessReason !== undefined) fields.stalenessReason = input.stalenessReason;
  if (input.stalenessCheckedAt !== undefined) fields.stalenessCheckedAt = input.stalenessCheckedAt;

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new artifact
 */
export async function createArtifact(input: CreateArtifactInput): Promise<Artifact | null> {
  try {
    const now = new Date().toISOString();
    const fields = mapCreateInputToFields(input, now);

    const record = await base(ARTIFACTS_TABLE).create(fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error('[Artifacts] Failed to create artifact:', error);
    return null;
  }
}

/**
 * Get an artifact by ID
 */
export async function getArtifactById(artifactId: string): Promise<Artifact | null> {
  try {
    const record = await base(ARTIFACTS_TABLE).find(artifactId);
    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; message?: string; error?: string };
    console.error(`[Artifacts] Failed to get artifact ${artifactId}:`, {
      statusCode: airtableError.statusCode,
      message: airtableError.message || airtableError.error,
      table: ARTIFACTS_TABLE,
    });
    return null;
  }
}

/**
 * Get all artifacts for a company
 */
export async function getArtifactsForCompany(companyId: string): Promise<Artifact[]> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `{companyId} = "${companyId}"`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map((r: { id: string; fields: Record<string, unknown> }) =>
      mapAirtableRecord(r)
    );
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifacts for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Get artifacts for a company filtered by type
 */
export async function getArtifactsForCompanyByType(
  companyId: string,
  type: ArtifactType
): Promise<Artifact[]> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {type} = "${type}")`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map((r: { id: string; fields: Record<string, unknown> }) =>
      mapAirtableRecord(r)
    );
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifacts for company ${companyId} type ${type}:`, error);
    return [];
  }
}

/**
 * Get artifacts for a company filtered by status
 */
export async function getArtifactsForCompanyByStatus(
  companyId: string,
  status: ArtifactStatus
): Promise<Artifact[]> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {status} = "${status}")`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map((r: { id: string; fields: Record<string, unknown> }) =>
      mapAirtableRecord(r)
    );
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifacts for company ${companyId} status ${status}:`, error);
    return [];
  }
}

/**
 * Get artifact by source strategy ID
 */
export async function getArtifactBySourceStrategyId(strategyId: string): Promise<Artifact | null> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `{sourceStrategyId} = "${strategyId}"`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) return null;

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifact for strategy ${strategyId}:`, error);
    return null;
  }
}

/**
 * Get artifact by source QBR story ID
 */
export async function getArtifactBySourceQbrStoryId(qbrStoryId: string): Promise<Artifact | null> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `{sourceQbrStoryId} = "${qbrStoryId}"`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) return null;

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifact for QBR story ${qbrStoryId}:`, error);
    return null;
  }
}

/**
 * Get artifact by source brief ID
 */
export async function getArtifactBySourceBriefId(briefId: string): Promise<Artifact | null> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `{sourceBriefId} = "${briefId}"`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) return null;

    return mapAirtableRecord(records[0] as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifact for brief ${briefId}:`, error);
    return null;
  }
}

/**
 * Get stale artifacts for a company
 */
export async function getStaleArtifactsForCompany(companyId: string): Promise<Artifact[]> {
  try {
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {isStale} = TRUE())`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map((r: { id: string; fields: Record<string, unknown> }) =>
      mapAirtableRecord(r)
    );
  } catch (error) {
    console.error(`[Artifacts] Failed to get stale artifacts for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Update an artifact
 */
export async function updateArtifact(
  artifactId: string,
  updates: UpdateArtifactInput
): Promise<Artifact | null> {
  try {
    const now = new Date().toISOString();
    const fields = mapUpdateInputToFields(updates, now);

    const record = await base(ARTIFACTS_TABLE).update(artifactId, fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Artifacts] Failed to update artifact ${artifactId}:`, error);
    return null;
  }
}

/**
 * Update artifact status
 */
export async function updateArtifactStatus(
  artifactId: string,
  status: ArtifactStatus
): Promise<Artifact | null> {
  return updateArtifact(artifactId, { status });
}

/**
 * Mark artifact as stale
 */
export async function markArtifactStale(
  artifactId: string,
  reason: string
): Promise<Artifact | null> {
  return updateArtifact(artifactId, {
    isStale: true,
    stalenessReason: reason,
    stalenessCheckedAt: new Date().toISOString(),
  });
}

/**
 * Mark artifact as fresh (not stale)
 */
export async function markArtifactFresh(artifactId: string): Promise<Artifact | null> {
  return updateArtifact(artifactId, {
    isStale: false,
    stalenessReason: null,
    stalenessCheckedAt: new Date().toISOString(),
  });
}

/**
 * Link artifact to Google Drive file
 */
export async function linkArtifactToGoogleFile(
  artifactId: string,
  googleFileId: string,
  googleFileUrl: string,
  googleFileType: GoogleFileType,
  googleFolderId?: string
): Promise<Artifact | null> {
  return updateArtifact(artifactId, {
    googleFileId,
    googleFileUrl,
    googleFileType,
    googleFolderId,
    googleModifiedAt: new Date().toISOString(),
  });
}

/**
 * Update Google file metadata (from sync)
 */
export async function updateGoogleFileMetadata(
  artifactId: string,
  googleModifiedAt: string
): Promise<Artifact | null> {
  return updateArtifact(artifactId, { googleModifiedAt });
}

/**
 * Delete an artifact
 */
export async function deleteArtifact(artifactId: string): Promise<boolean> {
  try {
    await base(ARTIFACTS_TABLE).destroy(artifactId);
    return true;
  } catch (error) {
    console.error(`[Artifacts] Failed to delete artifact ${artifactId}:`, error);
    return false;
  }
}

/**
 * Archive an artifact
 */
export async function archiveArtifact(artifactId: string): Promise<Artifact | null> {
  return updateArtifactStatus(artifactId, 'archived');
}

/**
 * Publish an artifact
 */
export async function publishArtifact(artifactId: string): Promise<Artifact | null> {
  return updateArtifactStatus(artifactId, 'published');
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Check and update staleness for all artifacts of a company
 * Returns count of newly stale artifacts
 */
export async function checkStalenessForCompany(
  companyId: string,
  currentContextVersion: number,
  currentStrategyVersion: number
): Promise<{ checked: number; newlyStale: number }> {
  try {
    const artifacts = await getArtifactsForCompany(companyId);
    let newlyStale = 0;

    for (const artifact of artifacts) {
      // Skip archived artifacts
      if (artifact.status === 'archived') continue;

      // Check context staleness
      const contextStale =
        artifact.contextVersionAtCreation !== null &&
        artifact.contextVersionAtCreation < currentContextVersion;

      // Check strategy staleness (only for strategy_doc)
      const strategyStale =
        artifact.type === 'strategy_doc' &&
        artifact.strategyVersionAtCreation !== null &&
        artifact.strategyVersionAtCreation < currentStrategyVersion;

      if (contextStale || strategyStale) {
        if (!artifact.isStale) {
          newlyStale++;
        }

        const reason = contextStale
          ? 'Context has been updated since this artifact was created'
          : 'Strategy has been updated since this artifact was created';

        await markArtifactStale(artifact.id, reason);
      }
    }

    return { checked: artifacts.length, newlyStale };
  } catch (error) {
    console.error(`[Artifacts] Failed to check staleness for company ${companyId}:`, error);
    return { checked: 0, newlyStale: 0 };
  }
}
