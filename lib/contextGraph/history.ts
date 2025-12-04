// lib/contextGraph/history.ts
// Context Graph Version History
//
// This module provides versioned history for context graphs,
// enabling time-travel, comparison, and learning from changes.

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { CompanyContextGraph } from './companyContextGraph';

// ============================================================================
// Version Types
// ============================================================================

/**
 * Reason why a version was captured
 */
export const ChangeReason = z.enum([
  'diagnostic_run',      // Automatic version after diagnostic completes
  'media_plan_published', // Version when a media plan is published
  'manual_rebuild',      // User manually triggered rebuild
  'scheduled',           // Scheduled periodic version
  'pre_optimization',    // Version before optimization run
  'post_optimization',   // Version after optimization run
  'user_edit',           // User made direct edits
  'migration',           // Schema migration version
]);

export type ChangeReason = z.infer<typeof ChangeReason>;

// Legacy alias for backward compatibility
export type SnapshotReason = ChangeReason;
export const SnapshotReason = ChangeReason;

/**
 * Context Graph Version - a point-in-time copy of the graph
 */
export const ContextGraphVersion = z.object({
  /** Unique version ID */
  versionId: z.string(),
  /** Company ID this version belongs to */
  companyId: z.string(),
  /** Company name (denormalized) */
  companyName: z.string(),
  /** Why this version was captured */
  changeReason: ChangeReason,
  /** When the version was captured */
  versionAt: z.string(),
  /** Optional description or notes */
  description: z.string().optional(),
  /** The full context graph at this point in time */
  graph: z.any(), // Full CompanyContextGraph - using any to avoid circular dependency
  /** Completeness score at time of version */
  completenessScore: z.number().min(0).max(100).nullable(),
  /** Run ID that triggered this version (if applicable) */
  triggerRunId: z.string().optional(),
  /** Previous version ID for delta tracking */
  previousVersionId: z.string().optional(),
});

export type ContextGraphVersion = z.infer<typeof ContextGraphVersion>;

// Legacy alias
export type ContextGraphSnapshot = ContextGraphVersion;
export const ContextGraphSnapshot = ContextGraphVersion;

/**
 * Lightweight version summary (without full graph)
 */
export interface VersionSummary {
  versionId: string;
  companyId: string;
  companyName: string;
  changeReason: ChangeReason;
  versionAt: string;
  description?: string;
  completenessScore: number | null;
  triggerRunId?: string;
}

// Legacy alias
export type SnapshotSummary = VersionSummary;

// ============================================================================
// Airtable Storage
// ============================================================================

const VERSIONS_TABLE = AIRTABLE_TABLES.CONTEXT_GRAPH_VERSIONS;

/**
 * Save a context graph version
 */
export async function saveContextGraphVersion(
  version: ContextGraphVersion
): Promise<ContextGraphVersion | null> {
  try {
    const base = getBase();

    const fields = {
      'Version ID': version.versionId,
      'Company ID': version.companyId,
      'Company Name': version.companyName,
      'Change Reason': version.changeReason,
      'Version At': version.versionAt,
      'Description': version.description || '',
      'Graph JSON': JSON.stringify(version.graph),
      'Completeness Score': version.completenessScore,
      'Trigger Run ID': version.triggerRunId || '',
      'Previous Version ID': version.previousVersionId || '',
    };

    await base(VERSIONS_TABLE).create([{ fields: fields as any }]);

    console.log(`[ContextGraph History] Created version ${version.versionId} for ${version.companyName} (${version.changeReason})`);

    return version;
  } catch (error: any) {
    // Silently handle table not found or permission errors
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return null;
    }
    console.error(`[ContextGraph History] Failed to save version:`, error?.message || error);
    return null;
  }
}

// Legacy alias
export const saveContextGraphSnapshot = saveContextGraphVersion;

/**
 * List versions for a company (most recent first)
 */
export async function listContextGraphVersions(
  companyId: string,
  limit: number = 10
): Promise<ContextGraphVersion[]> {
  try {
    const base = getBase();

    const records = await base(VERSIONS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: limit,
        sort: [{ field: 'Version At', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableRecordToVersion).filter((v): v is ContextGraphVersion => v !== null);
  } catch (error: any) {
    // Silently handle common errors: table doesn't exist, no permission, or not found
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return [];
    }
    console.error(`[ContextGraph History] Failed to list versions for ${companyId}:`, error?.message || error);
    return [];
  }
}

// Legacy alias
export const listContextGraphSnapshots = listContextGraphVersions;

/**
 * List version summaries (without full graph data)
 */
export async function listVersionSummaries(
  companyId: string,
  limit: number = 20
): Promise<VersionSummary[]> {
  try {
    const base = getBase();

    const records = await base(VERSIONS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: limit,
        sort: [{ field: 'Version At', direction: 'desc' }],
        fields: [
          'Version ID',
          'Company ID',
          'Company Name',
          'Change Reason',
          'Version At',
          'Description',
          'Completeness Score',
          'Trigger Run ID',
        ],
      })
      .all();

    return records.map((record) => ({
      versionId: (record.fields['Version ID'] as string) || '',
      companyId: (record.fields['Company ID'] as string) || '',
      companyName: (record.fields['Company Name'] as string) || '',
      changeReason: (record.fields['Change Reason'] as ChangeReason) || 'diagnostic_run',
      versionAt: (record.fields['Version At'] as string) || '',
      description: (record.fields['Description'] as string) || undefined,
      completenessScore: (record.fields['Completeness Score'] as number) || null,
      triggerRunId: (record.fields['Trigger Run ID'] as string) || undefined,
    }));
  } catch (error: any) {
    // Silently handle table not found or permission errors
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return [];
    }
    console.error(`[ContextGraph History] Failed to list summaries for ${companyId}:`, error?.message || error);
    return [];
  }
}

// Legacy alias
export const listSnapshotSummaries = listVersionSummaries;

/**
 * Get a specific version by ID
 */
export async function getVersionById(
  versionId: string
): Promise<ContextGraphVersion | null> {
  try {
    const base = getBase();

    const records = await base(VERSIONS_TABLE)
      .select({
        filterByFormula: `{Version ID} = "${versionId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecordToVersion(records[0]);
  } catch (error: any) {
    // Silently handle table not found or permission errors
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return null;
    }
    console.error(`[ContextGraph History] Failed to get version ${versionId}:`, error?.message || error);
    return null;
  }
}

// Legacy alias
export const getSnapshotById = getVersionById;

/**
 * Get the most recent version for a company
 */
export async function getLatestVersion(
  companyId: string
): Promise<ContextGraphVersion | null> {
  const versions = await listContextGraphVersions(companyId, 1);
  return versions[0] || null;
}

// Legacy alias
export const getLatestSnapshot = getLatestVersion;

/**
 * Get versions by reason
 */
export async function getVersionsByReason(
  companyId: string,
  reason: ChangeReason,
  limit: number = 10
): Promise<ContextGraphVersion[]> {
  try {
    const base = getBase();

    const records = await base(VERSIONS_TABLE)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", {Change Reason} = "${reason}")`,
        maxRecords: limit,
        sort: [{ field: 'Version At', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableRecordToVersion).filter((v): v is ContextGraphVersion => v !== null);
  } catch (error: any) {
    // Silently handle table not found or permission errors
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return [];
    }
    console.error(`[ContextGraph History] Failed to get versions by reason:`, error?.message || error);
    return [];
  }
}

// Legacy alias
export const getSnapshotsByReason = getVersionsByReason;

/**
 * Delete old versions (keep N most recent)
 */
export async function pruneOldVersions(
  companyId: string,
  keepCount: number = 50
): Promise<number> {
  try {
    const base = getBase();

    const allRecords = await base(VERSIONS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        sort: [{ field: 'Version At', direction: 'desc' }],
      })
      .all();

    if (allRecords.length <= keepCount) {
      return 0;
    }

    const toDelete = allRecords.slice(keepCount);
    const deleteIds = toDelete.map((r) => r.id);

    // Airtable limits batch deletes to 10 at a time
    for (let i = 0; i < deleteIds.length; i += 10) {
      const batch = deleteIds.slice(i, i + 10);
      await base(VERSIONS_TABLE).destroy(batch);
    }

    console.log(`[ContextGraph History] Pruned ${deleteIds.length} old versions for ${companyId}`);
    return deleteIds.length;
  } catch (error: any) {
    // Silently handle table not found or permission errors
    if (
      error?.statusCode === 404 ||
      error?.statusCode === 403 ||
      error?.error === 'NOT_FOUND' ||
      error?.error === 'NOT_AUTHORIZED' ||
      error?.message?.includes('not authorized')
    ) {
      return 0;
    }
    console.error(`[ContextGraph History] Failed to prune versions:`, error?.message || error);
    return 0;
  }
}

// Legacy alias
export const pruneOldSnapshots = pruneOldVersions;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to ContextGraphVersion
 */
function mapAirtableRecordToVersion(record: any): ContextGraphVersion | null {
  try {
    const fields = record.fields;
    const graphJson = fields['Graph JSON'] as string | undefined;

    if (!graphJson) {
      console.warn(`[ContextGraph History] Record ${record.id} has no Graph JSON`);
      return null;
    }

    const graph = JSON.parse(graphJson);

    return {
      versionId: (fields['Version ID'] as string) || '',
      companyId: (fields['Company ID'] as string) || '',
      companyName: (fields['Company Name'] as string) || '',
      changeReason: (fields['Change Reason'] as ChangeReason) || 'diagnostic_run',
      versionAt: (fields['Version At'] as string) || '',
      description: (fields['Description'] as string) || undefined,
      graph,
      completenessScore: (fields['Completeness Score'] as number) || null,
      triggerRunId: (fields['Trigger Run ID'] as string) || undefined,
      previousVersionId: (fields['Previous Version ID'] as string) || undefined,
    };
  } catch (error) {
    console.error(`[ContextGraph History] Failed to map record:`, error);
    return null;
  }
}

/**
 * Create a version from a context graph
 */
export function createVersion(
  graph: CompanyContextGraph,
  reason: ChangeReason,
  options?: {
    description?: string;
    triggerRunId?: string;
    previousVersionId?: string;
  }
): ContextGraphVersion {
  return {
    versionId: randomUUID(),
    companyId: graph.companyId,
    companyName: graph.companyName,
    changeReason: reason,
    versionAt: new Date().toISOString(),
    description: options?.description,
    graph,
    completenessScore: graph.meta.completenessScore,
    triggerRunId: options?.triggerRunId,
    previousVersionId: options?.previousVersionId,
  };
}

// Legacy alias
export const createSnapshot = createVersion;

/**
 * Create and save a version in one call
 */
export async function captureVersion(
  graph: CompanyContextGraph,
  reason: ChangeReason,
  options?: {
    description?: string;
    triggerRunId?: string;
  }
): Promise<ContextGraphVersion | null> {
  // Get previous version for linking
  const previous = await getLatestVersion(graph.companyId);

  const version = createVersion(graph, reason, {
    ...options,
    previousVersionId: previous?.versionId,
  });

  return saveContextGraphVersion(version);
}

// Legacy alias
export const captureSnapshot = captureVersion;

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Compare two versions and return changed fields
 */
export interface VersionDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}

// Legacy alias
export type SnapshotDiff = VersionDiff;

export function compareVersions(
  older: ContextGraphVersion,
  newer: ContextGraphVersion
): VersionDiff {
  const diff: VersionDiff = {
    added: [],
    removed: [],
    changed: [],
    unchanged: 0,
  };

  // Simple comparison - walk through fields
  function compareFields(
    oldObj: any,
    newObj: any,
    path: string = ''
  ): void {
    if (!oldObj && !newObj) return;

    // Check if this is a WithMeta field
    if (newObj && 'value' in newObj && 'provenance' in newObj) {
      const oldValue = oldObj?.value;
      const newValue = newObj?.value;

      if (oldValue === null && newValue !== null) {
        diff.added.push(path);
      } else if (oldValue !== null && newValue === null) {
        diff.removed.push(path);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diff.changed.push(path);
      } else {
        diff.unchanged++;
      }
      return;
    }

    // Recurse into objects
    if (typeof newObj === 'object' && newObj !== null) {
      for (const key of Object.keys(newObj)) {
        if (['companyId', 'companyName', 'meta'].includes(key)) continue;
        compareFields(oldObj?.[key], newObj[key], path ? `${path}.${key}` : key);
      }
    }
  }

  compareFields(older.graph, newer.graph);

  return diff;
}

// Legacy alias
export const compareSnapshots = compareVersions;

/**
 * Get a summary of changes between current and previous version
 */
export async function getRecentChanges(
  companyId: string
): Promise<{
  hasChanges: boolean;
  diff: VersionDiff | null;
  previousVersion: VersionSummary | null;
  currentVersion: VersionSummary | null;
}> {
  const versions = await listContextGraphVersions(companyId, 2);

  if (versions.length < 2) {
    return {
      hasChanges: false,
      diff: null,
      previousVersion: null,
      currentVersion: versions[0] ? {
        versionId: versions[0].versionId,
        companyId: versions[0].companyId,
        companyName: versions[0].companyName,
        changeReason: versions[0].changeReason,
        versionAt: versions[0].versionAt,
        completenessScore: versions[0].completenessScore,
      } : null,
    };
  }

  const [current, previous] = versions;
  const diff = compareVersions(previous, current);

  return {
    hasChanges: diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0,
    diff,
    previousVersion: {
      versionId: previous.versionId,
      companyId: previous.companyId,
      companyName: previous.companyName,
      changeReason: previous.changeReason,
      versionAt: previous.versionAt,
      completenessScore: previous.completenessScore,
    },
    currentVersion: {
      versionId: current.versionId,
      companyId: current.companyId,
      companyName: current.companyName,
      changeReason: current.changeReason,
      versionAt: current.versionAt,
      completenessScore: current.completenessScore,
    },
  };
}
