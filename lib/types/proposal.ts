// lib/types/proposal.ts
// Types for Proposal workflow (converted from RFPs)
// Used in Deliver phase for shipping proposals to prospects

import { z } from 'zod';
import { FirmBrainSnapshotRefSchema } from './rfp';

// ============================================================================
// Proposal Status
// ============================================================================

export type ProposalStatus = 'draft' | 'approved';

export const PROPOSAL_STATUS_ORDER: ProposalStatus[] = ['draft', 'approved'];

// ============================================================================
// Proposal Section Keys
// ============================================================================

export type ProposalSectionKey =
  | 'scope'         // What we'll do (merged from agency_overview intro)
  | 'approach'      // How we'll do it
  | 'deliverables'  // What you'll get
  | 'timeline'      // When you'll get it
  | 'pricing'       // What it costs
  | 'proof'         // Why trust us (work samples)
  | 'team';         // Who will do it

export const PROPOSAL_SECTION_ORDER: ProposalSectionKey[] = [
  'scope',
  'approach',
  'deliverables',
  'timeline',
  'pricing',
  'proof',
  'team',
];

export const PROPOSAL_SECTION_LABELS: Record<ProposalSectionKey, string> = {
  scope: 'Scope of Work',
  approach: 'Our Approach',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  pricing: 'Investment',
  proof: 'Proof of Expertise',
  team: 'Your Team',
};

// ============================================================================
// Proposal Section Status
// ============================================================================

export type ProposalSectionStatus = 'empty' | 'draft' | 'approved';

// ============================================================================
// Proposal Section Source Type
// ============================================================================

export type ProposalSectionSourceType =
  | 'rfp_converted'  // Converted from RFP section
  | 'manual'         // Manually entered
  | 'library';       // Inserted from section library

// ============================================================================
// RFP → Proposal Section Mapping
// ============================================================================

export const RFP_TO_PROPOSAL_SECTION_MAP: Record<string, ProposalSectionKey | null> = {
  agency_overview: 'scope',    // Merged into scope intro
  approach: 'approach',
  team: 'team',
  work_samples: 'proof',
  plan_timeline: 'timeline',
  pricing: 'pricing',
  references: null,            // Not directly mapped (optional appendix)
};

// ============================================================================
// Proposal Section Schema
// ============================================================================

export const ProposalSectionSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  sectionKey: z.enum([
    'scope',
    'approach',
    'deliverables',
    'timeline',
    'pricing',
    'proof',
    'team',
  ]),
  title: z.string(),
  status: z.enum(['empty', 'draft', 'approved']).default('empty'),
  content: z.string().nullable(),
  sourceType: z.enum(['rfp_converted', 'manual', 'library']).nullable(),
  sourceRfpSectionKey: z.string().nullable(), // Links back to RFP section if converted
  sourceLibrarySectionId: z.string().nullable(), // Links to library section if inserted
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ProposalSection = z.infer<typeof ProposalSectionSchema>;

export const ProposalSectionInputSchema = ProposalSectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProposalSectionInput = z.infer<typeof ProposalSectionInputSchema>;

// ============================================================================
// Proposal Main Schema
// ============================================================================

export const ProposalSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string().min(1),
  status: z.enum(['draft', 'approved']).default('draft'),
  sourceRfpId: z.string().nullable(), // Link to source RFP if converted
  firmBrainSnapshot: FirmBrainSnapshotRefSchema.nullable().optional(),
  createdBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const ProposalInputSchema = ProposalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProposalInput = z.infer<typeof ProposalInputSchema>;

// ============================================================================
// Proposal Aggregate (for builder UI)
// ============================================================================

export interface ProposalWithSections {
  proposal: Proposal;
  sections: ProposalSection[];
}

// ============================================================================
// Proposal Progress
// ============================================================================

export interface ProposalProgress {
  totalSections: number;
  emptySections: number;
  draftSections: number;
  approvedSections: number;
  progressPercent: number;
  canApprove: boolean;
  blockers: string[];
}

export function computeProposalProgress(sections: ProposalSection[]): ProposalProgress {
  const total = PROPOSAL_SECTION_ORDER.length;
  const emptySections = sections.filter(s => s.status === 'empty').length;
  const draftSections = sections.filter(s => s.status === 'draft').length;
  const approvedSections = sections.filter(s => s.status === 'approved').length;

  // Progress: draft=50%, approved=100%
  const progressPoints = sections.reduce((sum, s) => {
    if (s.status === 'approved') return sum + 100;
    if (s.status === 'draft') return sum + 50;
    return sum;
  }, 0);

  const progressPercent = Math.round(progressPoints / total);

  const blockers: string[] = [];
  if (emptySections > 0) {
    blockers.push(`${emptySections} section${emptySections > 1 ? 's' : ''} empty`);
  }
  if (draftSections > 0) {
    blockers.push(`${draftSections} section${draftSections > 1 ? 's' : ''} in draft`);
  }

  // Can approve if no empty sections
  const canApprove = emptySections === 0;

  return {
    totalSections: total,
    emptySections,
    draftSections,
    approvedSections,
    progressPercent,
    canApprove,
    blockers,
  };
}

// ============================================================================
// Conversion Request/Response
// ============================================================================

export interface ConvertRfpToProposalRequest {
  rfpId: string;
  proposalTitle?: string; // Optional override, defaults to RFP title
}

export interface ConvertRfpToProposalResponse {
  success: boolean;
  proposal: Proposal;
  sections: ProposalSection[];
  mappedSections: number;
  skippedSections: string[]; // RFP sections not mapped
}
