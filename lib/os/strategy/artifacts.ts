// lib/os/strategy/artifacts.ts
// Storage operations for Strategy Artifacts
//
// Artifacts are working documents created during strategy development.
// They follow the same Airtable storage pattern as Company Strategies.

import { getBase } from '@/lib/airtable';
import type {
  StrategyArtifact,
  CreateArtifactRequest,
  UpdateArtifactRequest,
  PromoteArtifactRequest,
  ArtifactSummary,
} from '@/lib/types/strategyArtifact';
import { toArtifactSummary } from '@/lib/types/strategyArtifact';

// ============================================================================
// Configuration
// ============================================================================

const ARTIFACTS_TABLE = 'Strategy Artifacts';

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all artifacts for a company
 */
export async function getArtifactsForCompany(companyId: string): Promise<StrategyArtifact[]> {
  try {
    const base = getBase();
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToArtifact);
  } catch (error) {
    // Check if table doesn't exist yet
    const errorStr = String(error);
    if (errorStr.includes('NOT_FOUND') || errorStr.includes('Could not find table')) {
      console.warn('[getArtifactsForCompany] Table "Strategy Artifacts" not found. Create it in Airtable to use artifacts.');
    } else {
      console.error('[getArtifactsForCompany] Error:', error);
    }
    return [];
  }
}

/**
 * Get artifact by ID
 */
export async function getArtifactById(artifactId: string): Promise<StrategyArtifact | null> {
  try {
    const base = getBase();
    const record = await base(ARTIFACTS_TABLE).find(artifactId);
    return mapRecordToArtifact(record);
  } catch (error) {
    console.error('[getArtifactById] Error:', error);
    return null;
  }
}

/**
 * Get artifacts by status
 */
export async function getArtifactsByStatus(
  companyId: string,
  status: StrategyArtifact['status']
): Promise<StrategyArtifact[]> {
  try {
    const base = getBase();
    const records = await base(ARTIFACTS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = '${companyId}', {status} = '${status}')`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToArtifact);
  } catch (error) {
    console.error('[getArtifactsByStatus] Error:', error);
    return [];
  }
}

/**
 * Get artifact summaries for a company (lightweight for lists)
 */
export async function getArtifactSummaries(companyId: string): Promise<ArtifactSummary[]> {
  const artifacts = await getArtifactsForCompany(companyId);
  return artifacts.map(toArtifactSummary);
}

/**
 * Get candidate artifacts (ready for promotion review)
 */
export async function getCandidateArtifacts(companyId: string): Promise<StrategyArtifact[]> {
  return getArtifactsByStatus(companyId, 'candidate');
}

/**
 * Get artifacts linked to a specific artifact
 */
export async function getLinkedArtifacts(artifactId: string): Promise<StrategyArtifact[]> {
  const artifact = await getArtifactById(artifactId);
  if (!artifact || artifact.linkedArtifactIds.length === 0) {
    return [];
  }

  const results: StrategyArtifact[] = [];
  for (const linkedId of artifact.linkedArtifactIds) {
    const linked = await getArtifactById(linkedId);
    if (linked) {
      results.push(linked);
    }
  }
  return results;
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create a new artifact
 */
export async function createArtifact(request: CreateArtifactRequest): Promise<StrategyArtifact> {
  const {
    companyId,
    type,
    title,
    content,
    source,
    linkedContextRevisionId,
    linkedCompetitionSource,
    linkedArtifactIds,
  } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields = {
      companyId,
      type,
      title,
      content,
      status: 'draft',
      source,
      linkedContextRevisionId: linkedContextRevisionId || undefined,
      linkedCompetitionSource: linkedCompetitionSource ?? undefined,
      linkedArtifactIds: linkedArtifactIds?.length
        ? JSON.stringify(linkedArtifactIds)
        : undefined,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[createArtifact] Creating artifact:', {
      companyId,
      type,
      title,
      source,
    });

    const record = await base(ARTIFACTS_TABLE).create(fields);
    return mapRecordToArtifact(record);
  } catch (error) {
    console.error('[createArtifact] Error:', error);
    throw new Error(`Failed to create artifact: ${extractAirtableError(error)}`);
  }
}

/**
 * Update an artifact
 */
export async function updateArtifact(request: UpdateArtifactRequest): Promise<StrategyArtifact> {
  const { artifactId, updates } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      updatedAt: now,
    };

    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.content !== undefined) fields.content = updates.content;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.linkedArtifactIds !== undefined) {
      fields.linkedArtifactIds = JSON.stringify(updates.linkedArtifactIds);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(ARTIFACTS_TABLE) as any).update([
      { id: artifactId, fields },
    ]);
    const record = results[0] as { id: string; fields: Record<string, unknown> };
    return mapRecordToArtifact(record);
  } catch (error) {
    console.error('[updateArtifact] Error:', error);
    throw new Error(`Failed to update artifact: ${extractAirtableError(error)}`);
  }
}

/**
 * Mark an artifact as a candidate for promotion
 */
export async function markAsCandidate(artifactId: string): Promise<StrategyArtifact> {
  return updateArtifact({
    artifactId,
    updates: { status: 'candidate' },
  });
}

/**
 * Discard an artifact
 */
export async function discardArtifact(artifactId: string): Promise<StrategyArtifact> {
  return updateArtifact({
    artifactId,
    updates: { status: 'discarded' },
  });
}

/**
 * Promote an artifact to canonical strategy
 *
 * IMPORTANT: This marks the artifact as promoted and records the target.
 * The actual strategy creation/update is handled separately to maintain
 * the guardrail that canonical strategy changes are always explicit.
 */
export async function promoteArtifact(request: PromoteArtifactRequest): Promise<StrategyArtifact> {
  const { artifactId, targetStrategyId, targetPillarId } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      status: 'promoted',
      promotedAt: now,
      updatedAt: now,
    };

    if (targetStrategyId) {
      fields.promotedToStrategyId = targetStrategyId;
    }
    if (targetPillarId) {
      fields.promotedToPillarId = targetPillarId;
    }

    console.log('[promoteArtifact] Promoting artifact:', {
      artifactId,
      targetStrategyId,
      targetPillarId,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(ARTIFACTS_TABLE) as any).update([
      { id: artifactId, fields },
    ]);
    const record = results[0] as { id: string; fields: Record<string, unknown> };
    return mapRecordToArtifact(record);
  } catch (error) {
    console.error('[promoteArtifact] Error:', error);
    throw new Error(`Failed to promote artifact: ${extractAirtableError(error)}`);
  }
}

/**
 * Delete an artifact (hard delete - use sparingly)
 */
export async function deleteArtifact(artifactId: string): Promise<void> {
  try {
    const base = getBase();
    await base(ARTIFACTS_TABLE).destroy(artifactId);
    console.log('[deleteArtifact] Deleted artifact:', artifactId);
  } catch (error) {
    console.error('[deleteArtifact] Error:', error);
    throw new Error(`Failed to delete artifact: ${extractAirtableError(error)}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to StrategyArtifact
 */
function mapRecordToArtifact(record: {
  id: string;
  fields: Record<string, unknown>;
}): StrategyArtifact {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.companyId as string,
    type: fields.type as StrategyArtifact['type'],
    title: (fields.title as string) || 'Untitled',
    content: (fields.content as string) || '',
    status: (fields.status as StrategyArtifact['status']) || 'draft',
    source: (fields.source as StrategyArtifact['source']) || 'human',
    linkedContextRevisionId: fields.linkedContextRevisionId as string | undefined,
    linkedCompetitionSource: fields.linkedCompetitionSource as 'v3' | 'v4' | null | undefined,
    linkedArtifactIds: parseJsonArray(fields.linkedArtifactIds),
    promotedToStrategyId: fields.promotedToStrategyId as string | undefined,
    promotedToPillarId: fields.promotedToPillarId as string | undefined,
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
    createdBy: fields.createdBy as string | undefined,
    promotedAt: fields.promotedAt as string | undefined,
    promotedBy: fields.promotedBy as string | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Extract error message from Airtable error format
 */
function extractAirtableError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (err.error && typeof err.error === 'string') {
      return `${err.error}${err.message ? `: ${err.message}` : ''}`;
    }
    if (err.message && typeof err.message === 'string') {
      return err.message;
    }
  }
  const errorStr = String(error);
  if (errorStr.includes('NOT_FOUND') || errorStr.includes('Could not find table')) {
    return 'Table "Strategy Artifacts" not found. Please create it in Airtable.';
  }
  return 'Unknown error - check server logs';
}
