// lib/contextGraph/nodes/proposalStorage.ts
// Storage layer for Context Proposals
//
// AI proposals are stored separately from the canonical context graph.
// They remain in 'pending' status until a human confirms, rejects, or edits.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { ContextProposal, ContextProposalBatch } from './types';
import type { EvidenceAnchor } from '@/lib/types/contextField';
import { createProposal } from './types';
import { enhanceProposalWithConvergence, isConvergenceEnabled, computeSpecificityScore, inferDecisionImpact, isSummaryShaped } from '../v4/convergence';

const PROPOSALS_TABLE = AIRTABLE_TABLES.CONTEXT_PROPOSALS;

// ============================================================================
// Types
// ============================================================================

export interface ProposalRecord {
  id: string;
  companyId: string;
  batchId: string;
  proposals: ContextProposal[];
  trigger: ContextProposal['trigger'];
  triggerSource?: string;
  batchReasoning: string;
  status: ContextProposalBatch['status'];
  createdAt: string;
  resolvedAt?: string;
}

// ============================================================================
// Load Proposals
// ============================================================================

/**
 * Load all pending proposals for a company
 */
export async function loadPendingProposals(
  companyId: string
): Promise<ContextProposalBatch[]> {
  try {
    const base = getBase();
    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", {Status} = "pending")`,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records
      .map(mapAirtableRecord)
      .filter((r): r is ContextProposalBatch => r !== null);
  } catch (error: any) {
    // Handle case where table doesn't exist yet
    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.warn(`[ContextProposals] Table "${PROPOSALS_TABLE}" not found.`);
      return [];
    }
    console.warn(`[ContextProposals] Could not load proposals for ${companyId}:`, error?.message || 'Unknown error');
    return [];
  }
}

/**
 * Load a specific proposal batch by ID
 */
export async function loadProposalBatch(
  batchId: string
): Promise<ContextProposalBatch | null> {
  try {
    const base = getBase();
    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: `{Batch ID} = "${batchId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0]);
  } catch (error: any) {
    // Handle case where table doesn't exist or isn't accessible
    if (error?.statusCode === 404 || error?.statusCode === 403 ||
        error?.error === 'NOT_FOUND' || error?.error === 'NOT_AUTHORIZED') {
      console.warn(`[ContextProposals] Table "${PROPOSALS_TABLE}" not accessible. Batch ${batchId} not found.`);
      return null;
    }
    console.error(`[ContextProposals] Failed to load batch ${batchId}:`, error);
    return null;
  }
}

/**
 * Load all proposals for a company (including resolved)
 */
export async function loadAllProposals(
  companyId: string,
  limit: number = 50
): Promise<ContextProposalBatch[]> {
  try {
    const base = getBase();
    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: limit,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records
      .map(mapAirtableRecord)
      .filter((r): r is ContextProposalBatch => r !== null);
  } catch (error) {
    console.error(`[ContextProposals] Failed to load proposals for ${companyId}:`, error);
    return [];
  }
}

// ============================================================================
// Save Proposals
// ============================================================================

/**
 * Save a new proposal batch
 */
export async function saveProposalBatch(
  batch: ContextProposalBatch
): Promise<ProposalRecord | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      'Batch ID': batch.id,
      'Company ID': batch.companyId,
      'Proposals JSON': JSON.stringify(batch.proposals),
      'Proposal Count': batch.proposals.length,
      'Trigger': batch.trigger,
      'Trigger Source': batch.triggerSource || '',
      'Batch Reasoning': batch.batchReasoning,
      'Status': batch.status,
      'Created At': now,
    };

    // Extract field paths for querying
    const fieldPaths = batch.proposals.map(p => p.fieldPath).join(', ');
    fields['Field Paths'] = fieldPaths;

    const created = await base(PROPOSALS_TABLE).create([{ fields: fields as any }]);
    console.log(`[ContextProposals] Created batch ${batch.id} with ${batch.proposals.length} proposals`);

    return {
      id: created[0].id,
      companyId: batch.companyId,
      batchId: batch.id,
      proposals: batch.proposals,
      trigger: batch.trigger,
      triggerSource: batch.triggerSource,
      batchReasoning: batch.batchReasoning,
      status: batch.status,
      createdAt: now,
    };
  } catch (error) {
    console.error(`[ContextProposals] Failed to save batch:`, error);
    return null;
  }
}

// ============================================================================
// Update Proposals
// ============================================================================

/**
 * Accept a single proposal within a batch
 */
export async function acceptProposal(
  batchId: string,
  proposalId: string,
  acceptedBy: string
): Promise<boolean> {
  try {
    const batch = await loadProposalBatch(batchId);
    if (!batch) {
      console.error(`[ContextProposals] Batch ${batchId} not found`);
      return false;
    }

    const now = new Date().toISOString();
    const updatedProposals = batch.proposals.map(p => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: 'accepted' as const,
          resolvedAt: now,
          resolvedBy: acceptedBy,
        };
      }
      return p;
    });

    // Update batch status based on proposal statuses
    const batchStatus = computeBatchStatus(updatedProposals);

    return updateBatchInAirtable(batchId, updatedProposals, batchStatus, now);
  } catch (error) {
    console.error(`[ContextProposals] Failed to accept proposal ${proposalId}:`, error);
    return false;
  }
}

/**
 * Reject a single proposal within a batch
 */
export async function rejectProposal(
  batchId: string,
  proposalId: string,
  rejectedBy: string
): Promise<boolean> {
  try {
    const batch = await loadProposalBatch(batchId);
    if (!batch) {
      console.error(`[ContextProposals] Batch ${batchId} not found`);
      return false;
    }

    const now = new Date().toISOString();
    const updatedProposals = batch.proposals.map(p => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: 'rejected' as const,
          resolvedAt: now,
          resolvedBy: rejectedBy,
        };
      }
      return p;
    });

    const batchStatus = computeBatchStatus(updatedProposals);

    return updateBatchInAirtable(batchId, updatedProposals, batchStatus, now);
  } catch (error) {
    console.error(`[ContextProposals] Failed to reject proposal ${proposalId}:`, error);
    return false;
  }
}

/**
 * Edit and accept a proposal with a modified value
 */
export async function editAndAcceptProposal(
  batchId: string,
  proposalId: string,
  editedValue: unknown,
  editedBy: string
): Promise<boolean> {
  try {
    const batch = await loadProposalBatch(batchId);
    if (!batch) {
      console.error(`[ContextProposals] Batch ${batchId} not found`);
      return false;
    }

    const now = new Date().toISOString();
    const updatedProposals = batch.proposals.map(p => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: 'edited' as const,
          editedValue,
          resolvedAt: now,
          resolvedBy: editedBy,
        };
      }
      return p;
    });

    const batchStatus = computeBatchStatus(updatedProposals);

    return updateBatchInAirtable(batchId, updatedProposals, batchStatus, now);
  } catch (error) {
    console.error(`[ContextProposals] Failed to edit proposal ${proposalId}:`, error);
    return false;
  }
}

/**
 * Accept all proposals in a batch
 */
export async function acceptAllProposals(
  batchId: string,
  acceptedBy: string
): Promise<boolean> {
  try {
    const batch = await loadProposalBatch(batchId);
    if (!batch) {
      console.error(`[ContextProposals] Batch ${batchId} not found`);
      return false;
    }

    const now = new Date().toISOString();
    const updatedProposals = batch.proposals.map(p => ({
      ...p,
      status: 'accepted' as const,
      resolvedAt: now,
      resolvedBy: acceptedBy,
    }));

    return updateBatchInAirtable(batchId, updatedProposals, 'complete', now);
  } catch (error) {
    console.error(`[ContextProposals] Failed to accept all in batch ${batchId}:`, error);
    return false;
  }
}

/**
 * Reject all proposals in a batch
 */
export async function rejectAllProposals(
  batchId: string,
  rejectedBy: string
): Promise<boolean> {
  try {
    const batch = await loadProposalBatch(batchId);
    if (!batch) {
      console.error(`[ContextProposals] Batch ${batchId} not found`);
      return false;
    }

    const now = new Date().toISOString();
    const updatedProposals = batch.proposals.map(p => ({
      ...p,
      status: 'rejected' as const,
      resolvedAt: now,
      resolvedBy: rejectedBy,
    }));

    return updateBatchInAirtable(batchId, updatedProposals, 'rejected', now);
  } catch (error) {
    console.error(`[ContextProposals] Failed to reject all in batch ${batchId}:`, error);
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map Airtable record to ContextProposalBatch
 */
function mapAirtableRecord(record: any): ContextProposalBatch | null {
  try {
    const fields = record.fields;
    const proposalsJson = fields['Proposals JSON'] as string | undefined;

    if (!proposalsJson) {
      console.warn(`[ContextProposals] Record ${record.id} has no Proposals JSON`);
      return null;
    }

    const proposals = JSON.parse(proposalsJson) as ContextProposal[];

    return {
      id: (fields['Batch ID'] as string) || record.id,
      companyId: (fields['Company ID'] as string) || '',
      proposals,
      trigger: (fields['Trigger'] as ContextProposal['trigger']) || 'ai_assist',
      triggerSource: (fields['Trigger Source'] as string) || undefined,
      batchReasoning: (fields['Batch Reasoning'] as string) || '',
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      status: (fields['Status'] as ContextProposalBatch['status']) || 'pending',
    };
  } catch (error) {
    console.error(`[ContextProposals] Failed to parse record ${record.id}:`, error);
    return null;
  }
}

/**
 * Compute batch status from individual proposal statuses
 */
function computeBatchStatus(proposals: ContextProposal[]): ContextProposalBatch['status'] {
  const pending = proposals.filter(p => p.status === 'pending').length;
  const rejected = proposals.filter(p => p.status === 'rejected').length;
  const acceptedOrEdited = proposals.filter(p => p.status === 'accepted' || p.status === 'edited').length;

  if (pending === proposals.length) {
    return 'pending';
  }
  if (rejected === proposals.length) {
    return 'rejected';
  }
  if (acceptedOrEdited + rejected === proposals.length) {
    return 'complete';
  }
  return 'partial';
}

/**
 * Update batch in Airtable
 */
async function updateBatchInAirtable(
  batchId: string,
  proposals: ContextProposal[],
  status: ContextProposalBatch['status'],
  resolvedAt?: string
): Promise<boolean> {
  try {
    const base = getBase();

    // Find the Airtable record by batch ID
    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: `{Batch ID} = "${batchId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      // Batch not in Airtable - likely a local-only proposal
      console.warn(`[ContextProposals] Batch ${batchId} not in Airtable (local-only). Skipping persist.`);
      return true; // Return true to allow local operations to succeed
    }

    const fields: Record<string, unknown> = {
      'Proposals JSON': JSON.stringify(proposals),
      'Status': status,
    };

    if (resolvedAt && status !== 'pending' && status !== 'partial') {
      fields['Resolved At'] = resolvedAt;
    }

    await base(PROPOSALS_TABLE).update(records[0].id, fields as any);
    console.log(`[ContextProposals] Updated batch ${batchId} to status ${status}`);

    return true;
  } catch (error: any) {
    // Handle case where table doesn't exist or isn't accessible
    if (error?.statusCode === 404 || error?.statusCode === 403 ||
        error?.error === 'NOT_FOUND' || error?.error === 'NOT_AUTHORIZED') {
      console.warn(`[ContextProposals] Table "${PROPOSALS_TABLE}" not accessible. Batch ${batchId} treated as local-only.`);
      return true; // Return true to allow local operations to succeed
    }
    console.error(`[ContextProposals] Failed to update batch ${batchId}:`, error);
    return false;
  }
}

// ============================================================================
// Proposal Creation Helpers
// ============================================================================

/**
 * Create a proposal batch from multiple field suggestions
 *
 * When V4 Convergence is enabled, each proposal is enhanced with:
 * - decisionImpact (LOW/MEDIUM/HIGH)
 * - specificityScore (0-100)
 * - genericnessReasons (why it might be generic)
 * - hiddenByDefault (should hide in Review Queue)
 * - fieldCategory (derivedNarrative, corePositioning, tactical, evidence)
 * - evidenceAnchors (V4 Evidence Grounding)
 * - isUngrounded (true if no evidence anchors)
 */
export function createProposalBatch(
  companyId: string,
  proposals: Array<{
    fieldPath: string;
    fieldLabel: string;
    proposedValue: unknown;
    currentValue: unknown | null;
    reasoning: string;
    confidence: number;
    /** V4 Evidence Grounding: concrete quotes from the company's website */
    evidenceAnchors?: EvidenceAnchor[];
  }>,
  trigger: ContextProposal['trigger'],
  batchReasoning: string,
  triggerSource?: string,
  options?: {
    /** Company name for specificity scoring (V4 Convergence) */
    companyName?: string;
    /** Block proposals if diagnostic had errors (V4 Evidence Grounding) */
    blockOnError?: boolean;
    /** True if diagnostic returned an error state (e.g., 403, blocked) */
    diagnosticErrorState?: boolean;
    /** Error message from diagnostic */
    diagnosticErrorMessage?: string;
  }
): ContextProposalBatch {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // V4 Evidence Grounding: Block proposals if diagnostic is in error state
  if (options?.blockOnError && options?.diagnosticErrorState) {
    console.warn(`[ContextProposals] Blocking proposals due to diagnostic error: ${options.diagnosticErrorMessage || 'Unknown error'}`);
    return {
      id: batchId,
      companyId,
      proposals: [],
      trigger,
      triggerSource,
      batchReasoning: `Proposals blocked: ${options.diagnosticErrorMessage || 'Diagnostic returned an error state. Cannot ground proposals without website access.'}`,
      createdAt: new Date().toISOString(),
      status: 'rejected', // Mark as rejected since we're blocking
    };
  }

  let contextProposals = proposals.map(p => {
    const proposal = createProposal(
      companyId,
      p.fieldPath,
      p.fieldLabel,
      p.proposedValue,
      p.currentValue,
      p.reasoning,
      p.confidence,
      trigger,
      triggerSource
    );

    // V4 Evidence Grounding: Attach evidence anchors
    if (p.evidenceAnchors !== undefined) {
      proposal.evidenceAnchors = p.evidenceAnchors;
      proposal.isUngrounded = p.evidenceAnchors.length === 0;
    }

    return proposal;
  });

  // V4 Convergence: Enhance proposals with decision-grade metadata
  if (isConvergenceEnabled()) {
    contextProposals = contextProposals.map(proposal => {
      // Use evidence-aware specificity scoring
      const enhanced = enhanceProposalWithConvergenceAndEvidence(
        proposal,
        options?.companyName
      );
      return enhanced;
    });
  }

  return {
    id: batchId,
    companyId,
    proposals: contextProposals,
    trigger,
    triggerSource,
    batchReasoning,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

/**
 * Enhance proposal with convergence metadata including evidence grounding
 */
function enhanceProposalWithConvergenceAndEvidence(
  proposal: ContextProposal,
  companyName?: string
): ContextProposal {
  const { fieldPath, proposedValue, evidenceAnchors } = proposal;

  // Compute decision impact
  const decisionImpact = inferDecisionImpact(fieldPath, proposedValue);

  // Compute specificity score with evidence awareness
  const valueStr = typeof proposedValue === 'string'
    ? proposedValue
    : JSON.stringify(proposedValue);
  const { score: specificityScore, reasons: genericnessReasons } = computeSpecificityScore(
    valueStr,
    { companyName, evidenceAnchors }
  );

  // Determine if summary-shaped
  const isSummary = isSummaryShaped(fieldPath, proposedValue);

  // Determine field category
  let fieldCategory: ContextProposal['fieldCategory'] = 'evidence';
  if (isSummary) {
    fieldCategory = 'derivedNarrative';
  } else if (['brand.positioning', 'productOffer.valueProposition', 'audience.primaryAudience', 'audience.icpDescription', 'brand.differentiators', 'competitive.positionSummary'].includes(fieldPath)) {
    fieldCategory = 'corePositioning';
  } else if (['productOffer.primaryConversionAction', 'productOffer.primaryProducts', 'audience.coreSegments', 'identity.businessModel'].includes(fieldPath)) {
    fieldCategory = 'tactical';
  }

  // Determine if should be hidden by default
  // Hide LOW impact, very low specificity, or ungrounded proposals
  const isUngrounded = evidenceAnchors !== undefined && evidenceAnchors.length === 0;
  const hiddenByDefault = decisionImpact === 'LOW' || specificityScore < 30 || (isUngrounded && decisionImpact !== 'HIGH');

  return {
    ...proposal,
    decisionImpact,
    specificityScore,
    genericnessReasons,
    hiddenByDefault,
    fieldCategory,
    isUngrounded,
  };
}

/**
 * Get pending proposals for a specific field path
 */
export async function getPendingProposalsForField(
  companyId: string,
  fieldPath: string
): Promise<ContextProposal[]> {
  const batches = await loadPendingProposals(companyId);

  return batches.flatMap(batch =>
    batch.proposals.filter(
      p => p.fieldPath === fieldPath && p.status === 'pending'
    )
  );
}
