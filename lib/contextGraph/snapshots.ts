// lib/contextGraph/snapshots.ts
// Context Graph Snapshots - Named point-in-time captures
//
// This module provides explicit snapshot creation for QBRs, SSM runs,
// and manual checkpoints. It builds on top of the version history system.

import { randomUUID } from 'crypto';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { loadContextGraph } from './storage';
import {
  createVersion,
  saveContextGraphVersion,
  getVersionById,
  listVersionSummaries,
  type VersionSummary,
  type ChangeReason,
} from './history';
import type { CompanyContextGraph } from './companyContextGraph';
import { getContextForScopes, type ContextScopeId, type ContextGatewayResult } from './contextGateway';

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Snapshot type identifiers
 */
export type SnapshotType =
  | 'qbr'         // Quarterly Business Review
  | 'ssm'         // Strategic State Machine run
  | 'manual'      // User-triggered checkpoint
  | 'lab'         // Lab diagnostic snapshot
  | 'import'      // Data import snapshot
  | 'migration';  // Schema migration

/**
 * Map snapshot types to version change reasons
 */
const SNAPSHOT_TYPE_TO_REASON: Record<SnapshotType, ChangeReason> = {
  qbr: 'diagnostic_run',
  ssm: 'pre_optimization',
  manual: 'user_edit',
  lab: 'diagnostic_run',
  import: 'migration',
  migration: 'migration',
};

/**
 * Snapshot metadata for display
 */
export interface SnapshotMeta {
  id: string;
  companyId: string;
  label: string;
  type: SnapshotType;
  createdAt: string;
  createdByUserId?: string;
  sourceRunId?: string;
  completenessScore: number | null;
  description?: string;
}

/**
 * Full snapshot with context data
 */
export interface FullSnapshot extends SnapshotMeta {
  graph: CompanyContextGraph;
}

// ============================================================================
// Snapshot Creation
// ============================================================================

export interface CreateSnapshotParams {
  companyId: string;
  snapshotType: SnapshotType;
  label: string;
  sourceRunId?: string;
  createdByUserId?: string;
  description?: string;
}

export interface CreateSnapshotResult {
  snapshotId: string;
  label: string;
  completenessScore: number | null;
  createdAt: string;
}

/**
 * Create a new context snapshot
 *
 * This captures the current state of the context graph as a named snapshot
 * that can be referenced later for comparison or historical viewing.
 */
export async function createContextSnapshot(
  params: CreateSnapshotParams
): Promise<CreateSnapshotResult> {
  const {
    companyId,
    snapshotType,
    label,
    sourceRunId,
    createdByUserId,
    description,
  } = params;

  // Load current context graph
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    throw new Error(`No context graph found for company ${companyId}`);
  }

  // Map snapshot type to change reason
  const changeReason = SNAPSHOT_TYPE_TO_REASON[snapshotType];

  // Build description with metadata
  const fullDescription = [
    label,
    description,
    sourceRunId ? `Source: ${sourceRunId}` : null,
    createdByUserId ? `By: ${createdByUserId}` : null,
    `Type: ${snapshotType}`,
  ]
    .filter(Boolean)
    .join(' | ');

  // Create version
  const version = createVersion(graph, changeReason, {
    description: fullDescription,
    triggerRunId: sourceRunId,
  });

  // Save to Airtable
  const saved = await saveContextGraphVersion(version);

  if (!saved) {
    throw new Error('Failed to save snapshot to database');
  }

  console.log(`[Snapshots] Created snapshot "${label}" for ${companyId} (${snapshotType})`);

  return {
    snapshotId: version.versionId,
    label,
    completenessScore: version.completenessScore,
    createdAt: version.versionAt,
  };
}

// ============================================================================
// Snapshot Retrieval
// ============================================================================

/**
 * Get snapshot metadata for a company
 */
export async function getSnapshotMetaForCompany(
  companyId: string,
  limit: number = 50
): Promise<SnapshotMeta[]> {
  const summaries = await listVersionSummaries(companyId, limit);

  return summaries.map((summary) => {
    // Parse type from description
    const typeMatch = summary.description?.match(/Type: (\w+)/);
    const type = (typeMatch?.[1] as SnapshotType) || 'manual';

    // Parse source run ID
    const sourceMatch = summary.description?.match(/Source: ([^\s|]+)/);
    const sourceRunId = sourceMatch?.[1];

    // Parse user ID
    const userMatch = summary.description?.match(/By: ([^\s|]+)/);
    const createdByUserId = userMatch?.[1];

    // Extract label (first part before |)
    const labelPart = summary.description?.split(' | ')[0] || `Snapshot ${summary.versionId.slice(0, 8)}`;

    return {
      id: summary.versionId,
      companyId: summary.companyId,
      label: labelPart,
      type,
      createdAt: summary.versionAt,
      createdByUserId,
      sourceRunId,
      completenessScore: summary.completenessScore,
      description: summary.description,
    };
  });
}

/**
 * Get a specific snapshot by ID
 */
export async function getSnapshotById(
  snapshotId: string
): Promise<FullSnapshot | null> {
  const version = await getVersionById(snapshotId);

  if (!version) {
    return null;
  }

  // Parse metadata from description
  const typeMatch = version.description?.match(/Type: (\w+)/);
  const type = (typeMatch?.[1] as SnapshotType) || 'manual';
  const sourceMatch = version.description?.match(/Source: ([^\s|]+)/);
  const userMatch = version.description?.match(/By: ([^\s|]+)/);
  const labelPart = version.description?.split(' | ')[0] || `Snapshot ${version.versionId.slice(0, 8)}`;

  return {
    id: version.versionId,
    companyId: version.companyId,
    label: labelPart,
    type,
    createdAt: version.versionAt,
    createdByUserId: userMatch?.[1],
    sourceRunId: sourceMatch?.[1],
    completenessScore: version.completenessScore,
    description: version.description,
    graph: version.graph as CompanyContextGraph,
  };
}

/**
 * Get snapshot context via the Context Gateway
 *
 * This returns context data in the same format as live context,
 * but loaded from a historical snapshot.
 */
export async function getSnapshotContext(
  companyId: string,
  snapshotId: string,
  scopes: ContextScopeId[]
): Promise<ContextGatewayResult> {
  return getContextForScopes({
    companyId,
    scopes,
    snapshotId,
  });
}

// ============================================================================
// Snapshot Convenience Functions
// ============================================================================

/**
 * Create a QBR snapshot
 */
export async function createQbrSnapshot(
  companyId: string,
  qbrId: string,
  options?: {
    label?: string;
    userId?: string;
  }
): Promise<CreateSnapshotResult> {
  const quarter = getQuarterLabel();

  return createContextSnapshot({
    companyId,
    snapshotType: 'qbr',
    label: options?.label || `${quarter} QBR Snapshot`,
    sourceRunId: qbrId,
    createdByUserId: options?.userId,
  });
}

/**
 * Create an SSM baseline snapshot
 */
export async function createSsmSnapshot(
  companyId: string,
  ssmRunId: string,
  options?: {
    label?: string;
    userId?: string;
  }
): Promise<CreateSnapshotResult> {
  const dateLabel = new Date().toISOString().split('T')[0];

  return createContextSnapshot({
    companyId,
    snapshotType: 'ssm',
    label: options?.label || `SSM Baseline – ${dateLabel}`,
    sourceRunId: ssmRunId,
    createdByUserId: options?.userId,
  });
}

/**
 * Create a manual checkpoint snapshot
 */
export async function createManualSnapshot(
  companyId: string,
  label: string,
  options?: {
    userId?: string;
    description?: string;
  }
): Promise<CreateSnapshotResult> {
  return createContextSnapshot({
    companyId,
    snapshotType: 'manual',
    label,
    createdByUserId: options?.userId,
    description: options?.description,
  });
}

/**
 * Create a lab diagnostic snapshot
 */
export async function createLabSnapshot(
  companyId: string,
  labType: string,
  runId: string,
  options?: {
    userId?: string;
  }
): Promise<CreateSnapshotResult> {
  return createContextSnapshot({
    companyId,
    snapshotType: 'lab',
    label: `${labType} Snapshot`,
    sourceRunId: runId,
    createdByUserId: options?.userId,
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get current quarter label (e.g., "Q1 2026")
 */
function getQuarterLabel(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();
  return `Q${quarter} ${year}`;
}

/**
 * Get snapshots by type
 */
export async function getSnapshotsByType(
  companyId: string,
  type: SnapshotType,
  limit: number = 20
): Promise<SnapshotMeta[]> {
  const all = await getSnapshotMetaForCompany(companyId, 100);
  return all.filter((s) => s.type === type).slice(0, limit);
}

/**
 * Get the most recent snapshot of a given type
 */
export async function getLatestSnapshotByType(
  companyId: string,
  type: SnapshotType
): Promise<SnapshotMeta | null> {
  const snapshots = await getSnapshotsByType(companyId, type, 1);
  return snapshots[0] || null;
}

/**
 * Check if a snapshot exists
 */
export async function snapshotExists(snapshotId: string): Promise<boolean> {
  const version = await getVersionById(snapshotId);
  return version !== null;
}
