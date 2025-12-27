// lib/types/contextProposal.ts
// Context Proposal Types for GAP/Labs → Context V4 Promotion Pipeline
//
// These types define the contract for proposals generated from diagnostic outputs
// that can be reviewed and confirmed to become Context V4 facts.

import type { PromotionSourceType } from '@/lib/contextGraph/v4/promotion/promotableFields';

// ============================================================================
// Status Types
// ============================================================================

/**
 * Status of a context proposal
 *
 * - proposed: Awaiting human review
 * - confirmed: Human approved, written to Context V4
 * - rejected: Human rejected, not written to Context V4
 */
export type ContextProposalStatus = 'proposed' | 'confirmed' | 'rejected';

// ============================================================================
// Proposal Types
// ============================================================================

/**
 * A single context proposal from diagnostic outputs
 */
export interface ContextProposal {
  /** Unique proposal ID (Airtable record ID or generated UUID) */
  id: string;

  /** Company ID (link to Companies table) */
  companyId: string;

  /** Target field key in Context V4 (e.g., "identity.businessModel") */
  fieldKey: string;

  /** Proposed value for the field */
  proposedValue: string;

  /** Current status of the proposal */
  status: ContextProposalStatus;

  /** Source type that generated this proposal */
  sourceType: PromotionSourceType;

  /** Run ID of the diagnostic that generated this (nullable) */
  sourceRunId?: string;

  /** Evidence supporting the proposal (short citation/snippet + optional URLs) */
  evidence: string;

  /** Confidence score (0-100) */
  confidence: number;

  /** When the proposal was created */
  createdAt: string;

  /** When the proposal was decided (confirmed/rejected) */
  decidedAt?: string;

  /** Who decided the proposal (user ID or "system") */
  decidedBy?: string;
}

/**
 * Evidence metadata for a proposal
 */
export interface ProposalEvidence {
  /** Source of the evidence */
  source: string;

  /** Run ID for traceability */
  runId?: string;

  /** Short supporting quotes/snippets (max ~300 chars) */
  snippets: string[];

  /** Optional source URLs */
  urls?: string[];
}

// ============================================================================
// Input Types for API Operations
// ============================================================================

/**
 * Input for creating a new context proposal
 */
export interface CreateContextProposalInput {
  /** Company ID */
  companyId: string;

  /** Target field key */
  fieldKey: string;

  /** Proposed value */
  proposedValue: string;

  /** Source type */
  sourceType: PromotionSourceType;

  /** Run ID (optional) */
  sourceRunId?: string;

  /** Evidence string */
  evidence: string;

  /** Confidence (0-100) */
  confidence: number;
}

/**
 * Input for confirming a proposal
 */
export interface ConfirmContextProposalInput {
  /** Proposal ID to confirm */
  proposalId: string;

  /** Optional override value (if user edits before confirming) */
  overrideValue?: string;

  /** User ID confirming */
  userId?: string;
}

/**
 * Input for rejecting a proposal
 */
export interface RejectContextProposalInput {
  /** Proposal ID to reject */
  proposalId: string;

  /** Optional rejection reason */
  reason?: string;

  /** User ID rejecting */
  userId?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from the generate proposals endpoint
 */
export interface GenerateProposalsResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Number of proposals created */
  createdCount: number;

  /** Number of proposals skipped (duplicates) */
  skippedCount: number;

  /** Summaries of created proposals */
  proposals: Array<{
    fieldKey: string;
    sourceType: PromotionSourceType;
    confidence: number;
    snippetPreview: string;
  }>;

  /** Error message if failed */
  error?: string;

  /** Debug info */
  debug?: {
    diagnosticsFound: string[];
    candidatesExtracted: number;
    deduplicationSkipped: number;
  };
}

/**
 * Response from the list proposals endpoint
 */
export interface ListProposalsResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Proposals grouped by field key */
  proposalsByField: Record<string, ContextProposal[]>;

  /** Total count of proposals */
  totalCount: number;

  /** Counts by status */
  byStatus: {
    proposed: number;
    confirmed: number;
    rejected: number;
  };

  /** Counts by source */
  bySource: Record<string, number>;
}

/**
 * Response from the confirm proposal endpoint
 */
export interface ConfirmProposalResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Updated proposal */
  proposal: ContextProposal;

  /** Summary of the context update */
  contextUpdate: {
    fieldKey: string;
    value: string;
    confirmedAt: string;
  };

  /** Whether staleness hooks were triggered */
  stalenessTriggered: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Response from the reject proposal endpoint
 */
export interface RejectProposalResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Updated proposal */
  proposal: ContextProposal;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Summary of proposals for a company
 */
export interface ProposalSummary {
  /** Total pending proposals */
  pendingCount: number;

  /** Proposals by field key */
  byField: Record<string, number>;

  /** Proposals by source type */
  bySource: Record<string, number>;

  /** Whether there are high-confidence proposals */
  hasHighConfidence: boolean;

  /** Fields ready for confirmation (high confidence) */
  readyToConfirm: string[];
}

/**
 * Airtable record shape for Context Proposals table
 */
export interface ContextProposalRecord {
  id: string;
  fields: {
    'Company ID': string;
    'Field Key': string;
    'Proposed Value': string;
    'Status': ContextProposalStatus;
    'Source Type': PromotionSourceType;
    'Source Run ID'?: string;
    'Evidence': string;
    'Confidence': number;
    'Created At': string;
    'Decided At'?: string;
    'Decided By'?: string;
  };
}

/**
 * Map Airtable record to ContextProposal
 */
export function mapRecordToProposal(record: ContextProposalRecord): ContextProposal {
  return {
    id: record.id,
    companyId: record.fields['Company ID'],
    fieldKey: record.fields['Field Key'],
    proposedValue: record.fields['Proposed Value'],
    status: record.fields['Status'],
    sourceType: record.fields['Source Type'],
    sourceRunId: record.fields['Source Run ID'],
    evidence: record.fields['Evidence'],
    confidence: record.fields['Confidence'],
    createdAt: record.fields['Created At'],
    decidedAt: record.fields['Decided At'],
    decidedBy: record.fields['Decided By'],
  };
}

/**
 * Map ContextProposal to Airtable record fields
 */
export function mapProposalToFields(proposal: CreateContextProposalInput): Record<string, unknown> {
  return {
    'Company ID': proposal.companyId,
    'Field Key': proposal.fieldKey,
    'Proposed Value': proposal.proposedValue,
    'Status': 'proposed' as ContextProposalStatus,
    'Source Type': proposal.sourceType,
    'Source Run ID': proposal.sourceRunId || '',
    'Evidence': proposal.evidence,
    'Confidence': proposal.confidence,
    'Created At': new Date().toISOString(),
  };
}
