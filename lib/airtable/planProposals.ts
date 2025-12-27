// lib/airtable/planProposals.ts
// Airtable CRUD operations for Plan Update Proposals
//
// Plan proposals are AI-generated update suggestions for approved plans.
// They follow a pending → applied | discarded workflow.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  PlanProposal,
  PlanProposalStatus,
  PlanType,
  CreatePlanProposalInput,
} from '@/lib/types/plan';

// ============================================================================
// Constants
// ============================================================================

const PROPOSALS_TABLE = AIRTABLE_TABLES.PLAN_PROPOSALS;

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Map Airtable record to PlanProposal entity
 */
function mapAirtableRecordToProposal(record: {
  id: string;
  fields: Record<string, unknown>;
}): PlanProposal {
  const fields = record.fields;

  // Parse JSON fields
  let proposedPatch: unknown = [];
  try {
    const patchJson = fields['proposedPatchJson'] as string | undefined;
    proposedPatch = patchJson ? JSON.parse(patchJson) : [];
  } catch {
    proposedPatch = [];
  }

  let warnings: string[] = [];
  try {
    const warningsJson = fields['warningsJson'] as string | undefined;
    warnings = warningsJson ? JSON.parse(warningsJson) : [];
  } catch {
    warnings = [];
  }

  let generatedUsing: PlanProposal['generatedUsing'] = {
    contextKeysUsed: [],
    strategyKeysUsed: [],
    goalAlignmentActive: false,
    businessDefinitionMissing: false,
  };
  try {
    const generatedUsingJson = fields['generatedUsingJson'] as string | undefined;
    if (generatedUsingJson) {
      generatedUsing = JSON.parse(generatedUsingJson);
    }
  } catch {
    // Use default
  }

  // Parse assumptions and unknowns
  let assumptions: string[] = [];
  let unknowns: string[] = [];
  try {
    const assumptionsJson = fields['assumptionsJson'] as string | undefined;
    assumptions = assumptionsJson ? JSON.parse(assumptionsJson) : [];
  } catch {
    assumptions = [];
  }
  try {
    const unknownsJson = fields['unknownsJson'] as string | undefined;
    unknowns = unknownsJson ? JSON.parse(unknownsJson) : [];
  } catch {
    unknowns = [];
  }

  return {
    id: record.id,
    planType: (fields['planType'] as PlanType) || 'media',
    planId: (fields['planId'] as string) || '',
    companyId: (fields['companyId'] as string) || '',
    strategyId: (fields['strategyId'] as string) || '',
    proposedPatch,
    rationale: (fields['rationale'] as string) || '',
    warnings,
    generatedUsing,
    status: (fields['status'] as PlanProposalStatus) || 'pending',
    createdAt: (fields['createdAt'] as string) || new Date().toISOString(),
    appliedAt: (fields['appliedAt'] as string) || undefined,
    discardedAt: (fields['discardedAt'] as string) || undefined,
    // Plan-based proposal fields
    proposedPlanId: (fields['proposedPlanId'] as string) || undefined,
    approvedPlanId: (fields['approvedPlanId'] as string) || undefined,
    title: (fields['title'] as string) || undefined,
    assumptions: assumptions.length > 0 ? assumptions : undefined,
    unknowns: unknowns.length > 0 ? unknowns : undefined,
    // Resolution tracking
    resolvedAt: (fields['resolvedAt'] as string) || undefined,
    resolvedBy: (fields['resolvedBy'] as string) || undefined,
    rejectionReason: (fields['rejectionReason'] as string) || undefined,
    acceptedPlanId: (fields['acceptedPlanId'] as string) || undefined,
    previousApprovedPlanId: (fields['previousApprovedPlanId'] as string) || undefined,
  };
}

/**
 * Map CreatePlanProposalInput to Airtable fields
 */
function mapCreateInputToFields(
  input: CreatePlanProposalInput,
  now: string
): Record<string, unknown> {
  return {
    planType: input.planType,
    planId: input.planId,
    companyId: input.companyId,
    strategyId: input.strategyId,
    proposedPatchJson: JSON.stringify(input.proposedPatch),
    rationale: input.rationale,
    warningsJson: JSON.stringify(input.warnings || []),
    generatedUsingJson: JSON.stringify(input.generatedUsing),
    status: 'pending',
    createdAt: now,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a proposal by ID
 */
export async function getPlanProposalById(proposalId: string): Promise<PlanProposal | null> {
  try {
    const record = await base(PROPOSALS_TABLE).find(proposalId);
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error(`[PlanProposals] Failed to get proposal ${proposalId}:`, error);
    return null;
  }
}

/**
 * Get all proposals for a plan
 */
export async function getPlanProposals(
  planId: string,
  planType: PlanType,
  status?: PlanProposalStatus
): Promise<PlanProposal[]> {
  try {
    let filterFormula = `AND({planId} = "${planId}", {planType} = "${planType}")`;
    if (status) {
      filterFormula = `AND({planId} = "${planId}", {planType} = "${planType}", {status} = "${status}")`;
    }

    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();
    return records.map(mapAirtableRecordToProposal);
  } catch (error) {
    console.error(`[PlanProposals] Failed to get proposals for plan ${planId}:`, error);
    return [];
  }
}

/**
 * Get pending proposals for a plan
 */
export async function getPendingProposals(
  planId: string,
  planType: PlanType
): Promise<PlanProposal[]> {
  return getPlanProposals(planId, planType, 'pending');
}

/**
 * Get all pending proposals for a company
 */
export async function getPendingProposalsForCompany(
  companyId: string
): Promise<PlanProposal[]> {
  try {
    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = "${companyId}", {status} = "pending")`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();
    return records.map(mapAirtableRecordToProposal);
  } catch (error) {
    console.error(`[PlanProposals] Failed to get pending proposals for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Create a new proposal
 */
export async function createPlanProposal(
  input: CreatePlanProposalInput
): Promise<PlanProposal | null> {
  try {
    const now = new Date().toISOString();
    const fields = mapCreateInputToFields(input, now);
    const record = await base(PROPOSALS_TABLE).create(fields as any) as unknown as { id: string; fields: Record<string, unknown> };
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error('[PlanProposals] Failed to create proposal:', error);
    return null;
  }
}

/**
 * Update proposal status to 'applied'
 */
export async function markProposalApplied(proposalId: string): Promise<PlanProposal | null> {
  try {
    const now = new Date().toISOString();
    const record = await base(PROPOSALS_TABLE).update(proposalId, {
      status: 'applied',
      appliedAt: now,
    } as any);
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error(`[PlanProposals] Failed to mark proposal applied ${proposalId}:`, error);
    return null;
  }
}

/**
 * Update proposal status to 'discarded'
 */
export async function markProposalDiscarded(proposalId: string): Promise<PlanProposal | null> {
  try {
    const now = new Date().toISOString();
    const record = await base(PROPOSALS_TABLE).update(proposalId, {
      status: 'discarded',
      discardedAt: now,
    } as any);
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error(`[PlanProposals] Failed to mark proposal discarded ${proposalId}:`, error);
    return null;
  }
}

/**
 * Count pending proposals for a plan
 */
export async function countPendingProposals(
  planId: string,
  planType: PlanType
): Promise<number> {
  try {
    const proposals = await getPendingProposals(planId, planType);
    return proposals.length;
  } catch {
    return 0;
  }
}

// ============================================================================
// Resolution Operations
// ============================================================================

export interface AcceptProposalInput {
  resolvedBy?: string;
  acceptedPlanId: string;
  previousApprovedPlanId?: string;
}

/**
 * Accept a proposal (mark as applied with resolution tracking)
 */
export async function acceptProposal(
  proposalId: string,
  input: AcceptProposalInput
): Promise<PlanProposal | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status: 'applied',
      appliedAt: now,
      resolvedAt: now,
      acceptedPlanId: input.acceptedPlanId,
    };

    if (input.resolvedBy) {
      fields.resolvedBy = input.resolvedBy;
    }
    if (input.previousApprovedPlanId) {
      fields.previousApprovedPlanId = input.previousApprovedPlanId;
    }

    const record = await base(PROPOSALS_TABLE).update(proposalId, fields as any);
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error(`[PlanProposals] Failed to accept proposal ${proposalId}:`, error);
    return null;
  }
}

export interface RejectProposalInput {
  resolvedBy?: string;
  rejectionReason?: string;
}

/**
 * Reject a proposal (mark as discarded with reason)
 */
export async function rejectProposal(
  proposalId: string,
  input: RejectProposalInput = {}
): Promise<PlanProposal | null> {
  try {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      status: 'discarded',
      discardedAt: now,
      resolvedAt: now,
    };

    if (input.resolvedBy) {
      fields.resolvedBy = input.resolvedBy;
    }
    if (input.rejectionReason) {
      fields.rejectionReason = input.rejectionReason;
    }

    const record = await base(PROPOSALS_TABLE).update(proposalId, fields as any);
    return mapAirtableRecordToProposal(record);
  } catch (error) {
    console.error(`[PlanProposals] Failed to reject proposal ${proposalId}:`, error);
    return null;
  }
}

/**
 * Get all proposals for a company (for proposals index)
 */
export async function getProposalsForCompany(
  companyId: string,
  status?: PlanProposalStatus
): Promise<PlanProposal[]> {
  try {
    let filterFormula = `{companyId} = "${companyId}"`;
    if (status) {
      filterFormula = `AND({companyId} = "${companyId}", {status} = "${status}")`;
    }

    const records = await base(PROPOSALS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();
    return records.map(mapAirtableRecordToProposal);
  } catch (error) {
    console.error(`[PlanProposals] Failed to get proposals for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Check if a proposal is resolvable (pending status)
 */
export function isProposalResolvable(proposal: PlanProposal): boolean {
  return proposal.status === 'pending';
}
