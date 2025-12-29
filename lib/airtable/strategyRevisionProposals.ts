// lib/airtable/strategyRevisionProposals.ts
// Airtable CRUD operations for Strategy Revision Proposals
//
// Stores guided revision proposals that surface from outcome signals.
// Proposals are drafts until applied or rejected.

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  StrategyRevisionProposal,
  StrategyRevisionChange,
  RevisionConfidence,
  RevisionProposalStatus,
} from '@/lib/types/strategyRevision';
import { generateProposalId } from '@/lib/types/strategyRevision';

// ============================================================================
// Types
// ============================================================================

export interface CreateProposalInput {
  companyId: string;
  strategyId: string;
  title: string;
  summary: string;
  signalIds: string[];
  evidence: string[];
  confidence: RevisionConfidence;
  changes: StrategyRevisionChange[];
}

export interface UpdateProposalInput {
  status?: RevisionProposalStatus;
  appliedAt?: string;
  rejectedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all revision proposals for a strategy
 */
export async function getRevisionProposals(
  companyId: string,
  strategyId: string,
  options?: { status?: RevisionProposalStatus }
): Promise<StrategyRevisionProposal[]> {
  try {
    const base = getAirtableBase();
    const filterFormula = options?.status
      ? `AND({companyId} = '${companyId}', {strategyId} = '${strategyId}', {status} = '${options.status}')`
      : `AND({companyId} = '${companyId}', {strategyId} = '${strategyId}')`;

    const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(recordToProposal);
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to get proposals:', error);
    return [];
  }
}

/**
 * Get a single revision proposal by ID
 */
export async function getRevisionProposalById(
  proposalId: string
): Promise<StrategyRevisionProposal | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS)
      .select({
        filterByFormula: `{proposalId} = '${proposalId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return recordToProposal(records[0]);
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to get proposal:', error);
    return null;
  }
}

/**
 * Create a new revision proposal
 */
export async function createRevisionProposal(
  input: CreateProposalInput
): Promise<StrategyRevisionProposal> {
  const base = getAirtableBase();
  const now = new Date().toISOString();
  const proposalId = generateProposalId();

  const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS).create([
    {
      fields: {
        proposalId,
        companyId: input.companyId,
        strategyId: input.strategyId,
        title: input.title,
        summary: input.summary,
        signalIds: JSON.stringify(input.signalIds),
        evidence: JSON.stringify(input.evidence),
        confidence: input.confidence,
        changes: JSON.stringify(input.changes),
        status: 'draft',
        createdAt: now,
      },
    },
  ]) as unknown as Array<{ id: string }>;

  return {
    id: proposalId,
    companyId: input.companyId,
    strategyId: input.strategyId,
    title: input.title,
    summary: input.summary,
    signalIds: input.signalIds,
    evidence: input.evidence,
    confidence: input.confidence,
    changes: input.changes,
    status: 'draft',
    createdAt: now,
  };
}

/**
 * Create multiple revision proposals at once
 */
export async function createRevisionProposals(
  inputs: CreateProposalInput[]
): Promise<StrategyRevisionProposal[]> {
  if (inputs.length === 0) return [];

  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = inputs.map(input => {
    const proposalId = generateProposalId();
    return {
      proposalId,
      input,
      fields: {
        proposalId,
        companyId: input.companyId,
        strategyId: input.strategyId,
        title: input.title,
        summary: input.summary,
        signalIds: JSON.stringify(input.signalIds),
        evidence: JSON.stringify(input.evidence),
        confidence: input.confidence,
        changes: JSON.stringify(input.changes),
        status: 'draft',
        createdAt: now,
      },
    };
  });

  // Airtable batch create (max 10 at a time)
  const batches: Array<typeof records[0]>[] = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  for (const batch of batches) {
    await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS).create(
      batch.map(r => ({ fields: r.fields })) as any
    );
  }

  return records.map(r => ({
    id: r.proposalId,
    companyId: r.input.companyId,
    strategyId: r.input.strategyId,
    title: r.input.title,
    summary: r.input.summary,
    signalIds: r.input.signalIds,
    evidence: r.input.evidence,
    confidence: r.input.confidence,
    changes: r.input.changes,
    status: 'draft' as const,
    createdAt: now,
  }));
}

/**
 * Update a revision proposal
 */
export async function updateRevisionProposal(
  proposalId: string,
  updates: UpdateProposalInput
): Promise<StrategyRevisionProposal | null> {
  try {
    const base = getAirtableBase();

    // First find the record by proposalId
    const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS)
      .select({
        filterByFormula: `{proposalId} = '${proposalId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const recordId = records[0].id;
    const fields: Record<string, unknown> = {};

    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.appliedAt !== undefined) fields.appliedAt = updates.appliedAt;
    if (updates.rejectedAt !== undefined) fields.rejectedAt = updates.rejectedAt;
    if (updates.decidedBy !== undefined) fields.decidedBy = updates.decidedBy;
    if (updates.rejectionReason !== undefined) fields.rejectionReason = updates.rejectionReason;

    await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS).update([
      { id: recordId, fields },
    ] as any);

    return getRevisionProposalById(proposalId);
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to update proposal:', error);
    return null;
  }
}

/**
 * Apply a revision proposal (marks as applied)
 */
export async function applyRevisionProposal(
  proposalId: string,
  decidedBy?: string
): Promise<StrategyRevisionProposal | null> {
  return updateRevisionProposal(proposalId, {
    status: 'applied',
    appliedAt: new Date().toISOString(),
    decidedBy,
  });
}

/**
 * Reject a revision proposal
 */
export async function rejectRevisionProposal(
  proposalId: string,
  reason?: string,
  decidedBy?: string
): Promise<StrategyRevisionProposal | null> {
  return updateRevisionProposal(proposalId, {
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
    decidedBy,
  });
}

/**
 * Delete a revision proposal
 */
export async function deleteRevisionProposal(proposalId: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    // First find the record by proposalId
    const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS)
      .select({
        filterByFormula: `{proposalId} = '${proposalId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return false;

    await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS).destroy([records[0].id]);
    return true;
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to delete proposal:', error);
    return false;
  }
}

/**
 * Delete all draft proposals for a strategy (cleanup before regeneration)
 */
export async function deleteDraftProposals(
  companyId: string,
  strategyId: string
): Promise<number> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS)
      .select({
        filterByFormula: `AND({companyId} = '${companyId}', {strategyId} = '${strategyId}', {status} = 'draft')`,
      })
      .all();

    if (records.length === 0) return 0;

    // Delete in batches of 10
    const ids = records.map(r => r.id);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await base(AIRTABLE_TABLES.STRATEGY_REVISION_PROPOSALS).destroy(batch);
    }

    return records.length;
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to delete draft proposals:', error);
    return 0;
  }
}

/**
 * Check if proposals already exist for given signal IDs (idempotency)
 */
export async function getProposalsBySignals(
  strategyId: string,
  signalIds: string[]
): Promise<StrategyRevisionProposal[]> {
  try {
    const proposals = await getRevisionProposals('', strategyId);

    // Filter to proposals that share any signal IDs
    return proposals.filter(p =>
      p.signalIds.some(sid => signalIds.includes(sid))
    );
  } catch (error) {
    console.error('[strategyRevisionProposals] Failed to get proposals by signals:', error);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert Airtable record to StrategyRevisionProposal
 */
function recordToProposal(record: {
  id: string;
  get: (field: string) => unknown;
}): StrategyRevisionProposal {
  return {
    id: (record.get('proposalId') as string) || record.id,
    companyId: (record.get('companyId') as string) || '',
    strategyId: (record.get('strategyId') as string) || '',
    title: (record.get('title') as string) || '',
    summary: (record.get('summary') as string) || '',
    signalIds: parseJsonArray<string>(record.get('signalIds')),
    evidence: parseJsonArray<string>(record.get('evidence')),
    confidence: (record.get('confidence') as RevisionConfidence) || 'low',
    changes: parseJsonArray<StrategyRevisionChange>(record.get('changes')),
    status: (record.get('status') as RevisionProposalStatus) || 'draft',
    createdAt: (record.get('createdAt') as string) || new Date().toISOString(),
    appliedAt: record.get('appliedAt') as string | undefined,
    rejectedAt: record.get('rejectedAt') as string | undefined,
    decidedBy: record.get('decidedBy') as string | undefined,
    rejectionReason: record.get('rejectionReason') as string | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
