// lib/contextGraph/governance/pipeline.ts
// Governed Update Pipeline
//
// Central function for all context graph writes.
// Enforces locks, validates contracts/rules, logs updates, and saves.

import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import { loadContextGraph, saveContextGraph } from '../storage';
import { setFieldUntyped, createProvenance, type ProvenanceSource } from '../mutate';
import { captureSnapshot } from '../history';
import { checkLock, type LockCheckResult } from './locks';
import { validateGraphContracts } from './contracts';
import { wouldCauseIssues, type ValidationIssue } from './rules';
import { logUpdate, type UpdateLogEntry } from './updateLog';
import type { ContextSource, ProvenanceTag } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UpdateMetadata {
  updatedBy: 'human' | 'ai' | 'system';
  sourceTool?: string;           // e.g., 'media_lab', 'audience_lab'
  reasoning?: string;
  userId?: string;               // For human updates
  suggestionId?: string;         // If accepting an AI suggestion
  skipValidation?: boolean;      // Emergency override (use sparingly)
  createSnapshot?: boolean;      // Create a snapshot after update
  snapshotReason?: string;
}

export interface UpdateResult {
  success: boolean;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  logEntry?: UpdateLogEntry;
  blockedReason?: string;
  validationIssues?: ValidationIssue[];
  lockInfo?: LockCheckResult;
}

export interface BatchUpdateResult {
  success: boolean;
  results: UpdateResult[];
  appliedCount: number;
  blockedCount: number;
  snapshotId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

function mapUpdaterToSource(updatedBy: 'human' | 'ai' | 'system', sourceTool?: string): ProvenanceSource {
  if (sourceTool) {
    const toolMap: Record<string, ProvenanceSource> = {
      media_lab: 'media_lab',
      audience_lab: 'audience_lab',
      brand_lab: 'brand_lab',
      creative_lab: 'creative_lab',
      audience_personas: 'audience_personas',
      website_lab: 'website_lab',
      seo_lab: 'seo_lab',
    };
    if (toolMap[sourceTool]) return toolMap[sourceTool];
  }

  if (updatedBy === 'human') return 'manual';
  if (updatedBy === 'ai') return 'inferred';
  return 'manual';
}

// ============================================================================
// Core Pipeline Function
// ============================================================================

/**
 * Apply a governed update to a single field.
 *
 * This function enforces:
 * 1. Lock rules - Cannot overwrite hard-locked fields, AI cannot override soft locks
 * 2. Validation - Checks if update would cause contradictions
 * 3. Logging - Every change is logged with full audit trail
 * 4. Persistence - Saves to graph and optionally creates snapshot
 */
export async function applyGovernedUpdate(
  companyId: string,
  path: string,
  newValue: unknown,
  metadata: UpdateMetadata
): Promise<UpdateResult> {
  const { updatedBy, skipValidation, createSnapshot, snapshotReason } = metadata;

  try {
    // 1. Load current graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      return {
        success: false,
        path,
        oldValue: undefined,
        newValue,
        blockedReason: 'Context graph not found',
      };
    }

    // 2. Get current value
    const oldValue = getValueByPath(graph, path);

    // 3. Check lock status
    const lockCheck = await checkLock(companyId, path);

    if (lockCheck.isLocked) {
      // Hard lock - block all changes
      if (lockCheck.lock?.severity === 'hard') {
        return {
          success: false,
          path,
          oldValue,
          newValue,
          blockedReason: `Field is hard-locked by ${lockCheck.lock.lockedBy}: ${lockCheck.lock.reason ?? 'No reason provided'}`,
          lockInfo: lockCheck,
        };
      }

      // Soft lock - block AI changes
      if (lockCheck.lock?.severity === 'soft' && updatedBy === 'ai') {
        return {
          success: false,
          path,
          oldValue,
          newValue,
          blockedReason: `Field is soft-locked (AI cannot modify). Reason: ${lockCheck.lock.reason ?? 'No reason provided'}`,
          lockInfo: lockCheck,
        };
      }
    }

    // 4. Check validation rules (would this cause issues?)
    if (!skipValidation) {
      const newIssues = wouldCauseIssues(graph, path, newValue);
      const criticalIssues = newIssues.filter(i => i.severity === 'error');

      if (criticalIssues.length > 0) {
        // Log the blocked attempt
        await logUpdate({
          companyId,
          path,
          oldValue,
          newValue,
          updatedBy,
          sourceTool: metadata.sourceTool,
          reasoning: `Blocked: ${criticalIssues[0].issue}`,
          status: 'rejected',
          metadata: { validationIssues: criticalIssues },
        });

        return {
          success: false,
          path,
          oldValue,
          newValue,
          blockedReason: `Update would cause validation issues: ${criticalIssues[0].issue}`,
          validationIssues: criticalIssues,
        };
      }
    }

    // 5. Apply the update
    const domain = path.split('.')[0] as DomainName;
    const fieldPath = path.split('.').slice(1).join('.');
    const source = mapUpdaterToSource(updatedBy, metadata.sourceTool);

    const provenance = createProvenance(source, {
      confidence: updatedBy === 'human' ? 1.0 : 0.8,
      sourceRunId: metadata.suggestionId ?? undefined,
      notes: metadata.reasoning,
    });

    graph = setFieldUntyped(graph, domain, fieldPath, newValue, provenance);

    // 6. Save the graph
    await saveContextGraph(graph);

    // 7. Create version snapshot if requested
    let snapshotId: string | undefined;
    if (createSnapshot) {
      const version = await captureSnapshot(
        graph,
        'user_edit',
        { description: snapshotReason ?? `Field ${path} updated by ${updatedBy}` }
      );
      snapshotId = version?.versionId;
    }

    // 8. Log the update
    const logEntry = await logUpdate({
      companyId,
      path,
      oldValue,
      newValue,
      updatedBy,
      sourceTool: metadata.sourceTool,
      reasoning: metadata.reasoning,
      acceptedBy: metadata.suggestionId ? metadata.userId : undefined,
      status: 'applied',
      metadata: { snapshotId },
    });

    return {
      success: true,
      path,
      oldValue,
      newValue,
      logEntry,
    };
  } catch (error) {
    console.error('[pipeline] Error applying update:', error);
    return {
      success: false,
      path,
      oldValue: undefined,
      newValue,
      blockedReason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Apply multiple governed updates in a batch.
 *
 * All updates share the same snapshot (if createSnapshot is true).
 * Each update is validated independently.
 */
export async function applyBatchUpdate(
  companyId: string,
  updates: Array<{ path: string; value: unknown }>,
  metadata: UpdateMetadata
): Promise<BatchUpdateResult> {
  const results: UpdateResult[] = [];
  let appliedCount = 0;
  let blockedCount = 0;

  // Load graph once
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    return {
      success: false,
      results: updates.map(u => ({
        success: false,
        path: u.path,
        oldValue: undefined,
        newValue: u.value,
        blockedReason: 'Context graph not found',
      })),
      appliedCount: 0,
      blockedCount: updates.length,
    };
  }

  // Process each update
  for (const update of updates) {
    // Apply without snapshot (we'll create one at the end)
    const result = await applyGovernedUpdate(companyId, update.path, update.value, {
      ...metadata,
      createSnapshot: false,
    });

    results.push(result);

    if (result.success) {
      appliedCount++;
      // Reload graph to get the updated state
      graph = await loadContextGraph(companyId);
      if (!graph) break;
    } else {
      blockedCount++;
    }
  }

  // Create a single snapshot for all changes
  let snapshotId: string | undefined;
  if (metadata.createSnapshot && appliedCount > 0 && graph) {
    const version = await captureSnapshot(
      graph,
      'user_edit',
      { description: metadata.snapshotReason ?? `Batch update: ${appliedCount} fields updated` }
    );
    snapshotId = version?.versionId;
  }

  return {
    success: appliedCount > 0,
    results,
    appliedCount,
    blockedCount,
    snapshotId,
  };
}

/**
 * Request a graph update (for tools that shouldn't write directly).
 *
 * This creates a pending suggestion that must be accepted by a human.
 */
export async function requestGraphUpdate(
  companyId: string,
  path: string,
  newValue: unknown,
  metadata: Omit<UpdateMetadata, 'updatedBy'> & { sourceTool: string }
): Promise<UpdateLogEntry> {
  // Load current graph to get old value
  const graph = await loadContextGraph(companyId);
  const oldValue = graph ? getValueByPath(graph, path) : undefined;

  // Log as pending suggestion
  const logEntry = await logUpdate({
    companyId,
    path,
    oldValue,
    newValue,
    updatedBy: 'ai',
    sourceTool: metadata.sourceTool,
    reasoning: metadata.reasoning,
    status: 'pending',
  });

  return logEntry;
}

/**
 * Accept a pending suggestion.
 */
export async function acceptSuggestion(
  companyId: string,
  updateId: string,
  acceptedBy: string
): Promise<UpdateResult> {
  const { queryUpdateLogs, markUpdateApplied } = await import('./updateLog');

  // Find the pending update
  const [pendingUpdate] = await queryUpdateLogs({
    companyId,
    status: 'pending',
  });

  const update = pendingUpdate?.updateId === updateId ? pendingUpdate :
    (await queryUpdateLogs({ companyId })).find(u => u.updateId === updateId);

  if (!update || update.status !== 'pending') {
    return {
      success: false,
      path: '',
      oldValue: undefined,
      newValue: undefined,
      blockedReason: 'Pending update not found',
    };
  }

  // Apply the update
  const result = await applyGovernedUpdate(companyId, update.path, update.newValue, {
    updatedBy: 'human',
    sourceTool: update.sourceTool,
    reasoning: update.reasoning,
    userId: acceptedBy,
    suggestionId: updateId,
    createSnapshot: true,
    snapshotReason: `Accepted AI suggestion for ${update.path}`,
  });

  // Mark original as applied
  if (result.success) {
    await markUpdateApplied(companyId, updateId, acceptedBy);
  }

  return result;
}

/**
 * Reject a pending suggestion.
 */
export async function rejectSuggestion(
  companyId: string,
  updateId: string,
  rejectedBy: string
): Promise<boolean> {
  const { markUpdateRejected } = await import('./updateLog');
  const result = await markUpdateRejected(companyId, updateId, rejectedBy);
  return result !== null;
}
