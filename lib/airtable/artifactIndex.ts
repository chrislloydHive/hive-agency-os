// lib/airtable/artifactIndex.ts
// Airtable CRUD operations for CompanyArtifactIndex
//
// The artifact index provides a unified view of all artifacts for a company.
// The Documents UI queries ONLY this index to display artifacts.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  CompanyArtifactIndex,
  CreateArtifactIndexInput,
  UpdateArtifactIndexInput,
  ArtifactIndexUpsertKey,
} from '@/lib/types/artifactIndex';
import { ArtifactStatus, ArtifactFileType, ArtifactPhase, ArtifactStorage } from '@/lib/types/artifactTaxonomy';

// ============================================================================
// Constants
// ============================================================================

const ARTIFACT_INDEX_TABLE = AIRTABLE_TABLES.ARTIFACT_INDEX || 'CompanyArtifactIndex';

// ============================================================================
// Field Mapping
// ============================================================================

function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): CompanyArtifactIndex {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: (fields['companyId'] as string) || '',
    title: (fields['title'] as string) || '',
    artifactType: (fields['artifactType'] as string) || 'custom',
    phase: (fields['phase'] as ArtifactPhase) || ArtifactPhase.Other,
    source: (fields['source'] as string) || 'manual',
    storage: (fields['storage'] as ArtifactStorage) || ArtifactStorage.Internal,
    groupKey: (fields['groupKey'] as string) || '',
    sourceRunId: (fields['sourceRunId'] as string) || null,
    sourceArtifactId: (fields['sourceArtifactId'] as string) || null,
    sourceStrategyId: (fields['sourceStrategyId'] as string) || null,
    url: (fields['url'] as string) || '',
    googleFileId: (fields['googleFileId'] as string) || null,
    status: (fields['status'] as ArtifactStatus) || ArtifactStatus.Final,
    primary: (fields['primary'] as boolean) || false,
    description: (fields['description'] as string) || null,
    fileType: (fields['fileType'] as ArtifactFileType) || ArtifactFileType.Json,
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    updatedAt: (fields['updatedAt'] as string) || new Date().toISOString(),
  };
}

function mapInputToFields(
  input: CreateArtifactIndexInput,
  now: string
): Record<string, unknown> {
  return {
    companyId: input.companyId,
    title: input.title,
    artifactType: input.artifactType,
    phase: input.phase,
    source: input.source,
    storage: input.storage,
    groupKey: input.groupKey,
    sourceRunId: input.sourceRunId || null,
    sourceArtifactId: input.sourceArtifactId || null,
    sourceStrategyId: input.sourceStrategyId || null,
    url: input.url,
    googleFileId: input.googleFileId || null,
    status: input.status || ArtifactStatus.Final,
    primary: input.primary || false,
    description: input.description || null,
    fileType: input.fileType || ArtifactFileType.Json,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get artifact index entries for a company
 */
export async function getArtifactIndexForCompany(
  companyId: string
): Promise<CompanyArtifactIndex[]> {
  console.log(`[ArtifactIndex] Fetching index for company ${companyId}...`);

  try {
    const records = await base(ARTIFACT_INDEX_TABLE)
      .select({
        filterByFormula: `{companyId} = "${companyId}"`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    const artifacts = records.map((r) =>
      mapAirtableRecord(r as unknown as { id: string; fields: Record<string, unknown> })
    );

    console.log(`[ArtifactIndex] Found ${artifacts.length} indexed artifacts for company ${companyId}`);
    return artifacts;
  } catch (error: unknown) {
    // Check if table doesn't exist (404) - this is expected if ArtifactIndex table hasn't been created
    const airtableError = error as { statusCode?: number; message?: string; error?: string };
    if (airtableError.statusCode === 404) {
      console.log(`[ArtifactIndex] Table "${ARTIFACT_INDEX_TABLE}" not found - returning empty list. Create this table in Airtable to enable artifact indexing.`);
      return [];
    }
    console.error(`[ArtifactIndex] Failed to get index for company ${companyId}:`, {
      statusCode: airtableError.statusCode,
      message: airtableError.message || airtableError.error,
    });
    return [];
  }
}

/**
 * Create a new artifact index entry
 */
export async function createArtifactIndexEntry(
  input: CreateArtifactIndexInput
): Promise<CompanyArtifactIndex | null> {
  const now = new Date().toISOString();

  console.log(`[ArtifactIndex] Creating index entry:`, {
    companyId: input.companyId,
    artifactType: input.artifactType,
    title: input.title,
  });

  try {
    const fields = mapInputToFields(input, now);
    const record = await base(ARTIFACT_INDEX_TABLE).create(fields as any);

    const entry = mapAirtableRecord(
      record as unknown as { id: string; fields: Record<string, unknown> }
    );

    console.log(`[ArtifactIndex] ✓ Created index entry ${entry.id}`);
    return entry;
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; message?: string; error?: string };
    if (airtableError.statusCode === 404) {
      console.log(`[ArtifactIndex] Table "${ARTIFACT_INDEX_TABLE}" not found - skipping index creation. Create this table in Airtable to enable artifact indexing.`);
      return null;
    }
    console.error(`[ArtifactIndex] Failed to create index entry:`, {
      statusCode: airtableError.statusCode,
      message: airtableError.message || airtableError.error,
    });
    return null;
  }
}

/**
 * Update an artifact index entry
 */
export async function updateArtifactIndexEntry(
  id: string,
  input: UpdateArtifactIndexInput
): Promise<CompanyArtifactIndex | null> {
  const now = new Date().toISOString();

  try {
    const fields: Record<string, unknown> = {
      updatedAt: now,
    };

    if (input.title !== undefined) fields.title = input.title;
    if (input.status !== undefined) fields.status = input.status;
    if (input.primary !== undefined) fields.primary = input.primary;
    if (input.url !== undefined) fields.url = input.url;
    if (input.description !== undefined) fields.description = input.description;

    const record = await base(ARTIFACT_INDEX_TABLE).update(id, fields as any);

    return mapAirtableRecord(
      record as unknown as { id: string; fields: Record<string, unknown> }
    );
  } catch (error) {
    console.error(`[ArtifactIndex] Failed to update index entry ${id}:`, error);
    return null;
  }
}

/**
 * Find an existing index entry by upsert key
 */
export async function findArtifactIndexEntry(
  key: ArtifactIndexUpsertKey
): Promise<CompanyArtifactIndex | null> {
  try {
    // Build filter formula for unique key: companyId + artifactType + groupKey + url
    const formula = `AND({companyId} = "${key.companyId}", {artifactType} = "${key.artifactType}", {groupKey} = "${key.groupKey}", {url} = "${key.url}")`;

    const records = await base(ARTIFACT_INDEX_TABLE)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(
      records[0] as unknown as { id: string; fields: Record<string, unknown> }
    );
  } catch (error) {
    console.error(`[ArtifactIndex] Failed to find index entry:`, error);
    return null;
  }
}

/**
 * Upsert an artifact index entry (create if not exists, update if exists)
 */
export async function upsertArtifactIndexEntry(
  input: CreateArtifactIndexInput
): Promise<CompanyArtifactIndex | null> {
  // Build upsert key
  const key: ArtifactIndexUpsertKey = {
    companyId: input.companyId,
    artifactType: input.artifactType as string,
    groupKey: input.groupKey,
    url: input.url,
  };

  // Check if entry already exists
  const existing = await findArtifactIndexEntry(key);

  if (existing) {
    console.log(`[ArtifactIndex] Entry exists, updating: ${existing.id}`);
    return updateArtifactIndexEntry(existing.id, {
      title: input.title,
      status: input.status,
      description: input.description,
    });
  }

  // Create new entry
  return createArtifactIndexEntry(input);
}

/**
 * Delete an artifact index entry
 */
export async function deleteArtifactIndexEntry(id: string): Promise<boolean> {
  try {
    await base(ARTIFACT_INDEX_TABLE).destroy(id);
    console.log(`[ArtifactIndex] ✓ Deleted index entry ${id}`);
    return true;
  } catch (error) {
    console.error(`[ArtifactIndex] Failed to delete index entry ${id}:`, error);
    return false;
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Get all index entries for a specific run
 */
export async function getArtifactIndexForRun(
  runId: string
): Promise<CompanyArtifactIndex[]> {
  try {
    const records = await base(ARTIFACT_INDEX_TABLE)
      .select({
        filterByFormula: `{sourceRunId} = "${runId}"`,
      })
      .all();

    return records.map((r) =>
      mapAirtableRecord(r as unknown as { id: string; fields: Record<string, unknown> })
    );
  } catch (error) {
    console.error(`[ArtifactIndex] Failed to get index for run ${runId}:`, error);
    return [];
  }
}

// Legacy type export for backwards compatibility
export type ArtifactIndexEntry = CompanyArtifactIndex;
