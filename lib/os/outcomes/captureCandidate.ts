// lib/os/outcomes/captureCandidate.ts
// Outcome Capture Candidate System
//
// Records when artifacts are "shipped" (finalized) and linked to work items,
// creating candidates for outcome capture that users can act on.

import { createOutcomeSignal } from '@/lib/airtable/outcomeSignals';
import { getWorkItemsWithArtifactAttached } from '@/lib/airtable/workItems';
import { isArtifactShipped, type ArtifactStatus } from '@/lib/types/artifact';
import type { WorkItemRecord } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

export interface OutcomeCaptureCandidate {
  artifactId: string;
  artifactTitle: string;
  artifactType: string;
  workItemIds: string[];
  companyId: string;
  strategyId?: string;
  programId?: string;
  createdAt: string;
}

export interface RecordCaptureCandidateResult {
  success: boolean;
  candidate?: OutcomeCaptureCandidate;
  signalId?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a status transition represents shipping (finalizing) an artifact
 */
export function isShippingTransition(
  oldStatus: ArtifactStatus | undefined,
  newStatus: ArtifactStatus
): boolean {
  // Shipping means transitioning TO final status
  if (!isArtifactShipped(newStatus)) return false;

  // Only count as shipping if coming from non-final state
  return oldStatus !== 'final';
}

/**
 * Get work items that produce this artifact
 */
async function getProducingWorkItems(artifactId: string): Promise<WorkItemRecord[]> {
  const workItems = await getWorkItemsWithArtifactAttached(artifactId);

  // Filter to only work items that produce this artifact
  return workItems.filter((item) => {
    const artifacts = item.artifacts || [];
    return artifacts.some(
      (a) => a.artifactId === artifactId && (a.relation === 'produces' || !a.relation)
    );
  });
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Record an outcome capture candidate when an artifact is shipped
 *
 * This creates an OutcomeSignal with type 'completed' and source 'artifact'
 * that serves as a prompt for users to capture outcomes.
 *
 * @param artifactId - The artifact that was shipped
 * @param artifactTitle - Title of the artifact
 * @param artifactType - Type of the artifact
 * @param companyId - Company owning the artifact
 * @param options - Additional options
 */
export async function recordArtifactShippedCandidate(
  artifactId: string,
  artifactTitle: string,
  artifactType: string,
  companyId: string,
  options?: {
    strategyId?: string;
    tacticIds?: string[];
  }
): Promise<RecordCaptureCandidateResult> {
  try {
    // Find work items that produce this artifact
    const producingWorkItems = await getProducingWorkItems(artifactId);

    // If no work items produce this artifact, skip (artifact wasn't work output)
    if (producingWorkItems.length === 0) {
      console.log('[CaptureCandidate] No producing work items for artifact:', artifactId);
      return { success: true }; // Not an error, just no candidate needed
    }

    const workItemIds = producingWorkItems.map((w) => w.id);

    // Determine strategy ID from work items if not provided
    const strategyId = options?.strategyId || producingWorkItems.find(
      (w) => w.strategyLink?.strategyId
    )?.strategyLink?.strategyId;

    // Create the outcome signal
    const signal = await createOutcomeSignal({
      companyId,
      strategyId: strategyId || '',
      source: 'artifact',
      sourceId: artifactId,
      signalType: 'completed',
      confidence: 'medium', // Medium confidence until user confirms outcome
      summary: `Artifact shipped: "${artifactTitle}" (${artifactType})`,
      evidence: [
        `Artifact ID: ${artifactId}`,
        `Type: ${artifactType}`,
        `Produced by ${workItemIds.length} work item(s)`,
        ...workItemIds.slice(0, 3).map((id) => `Work Item: ${id}`),
      ],
      tacticIds: options?.tacticIds,
      createdAt: new Date().toISOString(),
    });

    const candidate: OutcomeCaptureCandidate = {
      artifactId,
      artifactTitle,
      artifactType,
      workItemIds,
      companyId,
      strategyId,
      createdAt: new Date().toISOString(),
    };

    console.log('[CaptureCandidate] Recorded candidate for artifact:', artifactId, {
      workItemCount: workItemIds.length,
      signalId: signal.id,
    });

    return {
      success: true,
      candidate,
      signalId: signal.id,
    };
  } catch (error) {
    console.error('[CaptureCandidate] Failed to record candidate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if an artifact shipping should trigger outcome capture
 *
 * Returns true if:
 * - The artifact is being shipped (transitioning to final)
 * - The artifact is linked as 'produces' to at least one work item
 */
export async function shouldTriggerOutcomeCapture(
  artifactId: string,
  oldStatus: ArtifactStatus | undefined,
  newStatus: ArtifactStatus
): Promise<boolean> {
  // Must be a shipping transition
  if (!isShippingTransition(oldStatus, newStatus)) {
    return false;
  }

  // Must have at least one work item that produces this artifact
  const producingWorkItems = await getProducingWorkItems(artifactId);
  return producingWorkItems.length > 0;
}
