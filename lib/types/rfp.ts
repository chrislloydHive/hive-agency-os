// lib/types/rfp.ts
// Types for RFP (Request for Proposal) workflow
// Used in Deliver phase for heavy RFP response generation

import { z } from 'zod';
import { RfpWinStrategySchema } from './rfpWinStrategy';

// ============================================================================
// RFP Status
// ============================================================================

export type RfpStatus =
  | 'intake'      // Initial data gathering
  | 'assembling'  // Sections being generated/drafted
  | 'review'      // All sections drafted, awaiting review
  | 'submitted'   // RFP response submitted to prospect
  | 'won'         // Deal won
  | 'lost';       // Deal lost

export const RFP_STATUS_ORDER: RfpStatus[] = [
  'intake',
  'assembling',
  'review',
  'submitted',
  'won',
  'lost',
];

// ============================================================================
// RFP Path (approach type)
// ============================================================================

export type RfpPath =
  | 'strategy'  // Strategy-focused engagement
  | 'project'   // Project-based work
  | 'custom';   // Custom scope

// ============================================================================
// RFP Section Keys
// ============================================================================

export type RfpSectionKey =
  | 'agency_overview'    // Section 1: About the agency
  | 'approach'           // Section 2: Proposed approach
  | 'team'               // Section 3: Team members
  | 'work_samples'       // Section 4: Case studies / portfolio
  | 'plan_timeline'      // Section 5: Project plan and timeline
  | 'pricing'            // Section 6: Pricing and investment
  | 'references';        // Section 7: References

export const RFP_SECTION_ORDER: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

export const RFP_SECTION_LABELS: Record<RfpSectionKey, string> = {
  agency_overview: 'Agency Overview',
  approach: 'Our Approach',
  team: 'Proposed Team',
  work_samples: 'Work Samples',
  plan_timeline: 'Plan & Timeline',
  pricing: 'Investment',
  references: 'References',
};

// ============================================================================
// RFP Section Status
// ============================================================================

export type RfpSectionStatus =
  | 'empty'     // No content yet
  | 'draft'     // Content generated/entered but not reviewed
  | 'ready'     // Reviewed and ready
  | 'approved'; // Final approval

// ============================================================================
// RFP Section Source Type
// ============================================================================

export type RfpSectionSourceType =
  | 'firm_brain'  // Pulled directly from Firm Brain
  | 'generated'   // AI-generated
  | 'manual';     // Manually entered

// ============================================================================
// RFP Main Schema
// ============================================================================

export const RequirementChecklistItemSchema = z.object({
  id: z.string(),
  requirement: z.string(),
  category: z.string().optional(),
  addressed: z.boolean().default(false),
  notes: z.string().optional(),
});

export type RequirementChecklistItem = z.infer<typeof RequirementChecklistItemSchema>;

// V2: Firm Brain snapshot for drift detection
export const FirmBrainSnapshotRefSchema = z.object({
  hash: z.string(),
  createdAt: z.string(),
});

export type FirmBrainSnapshotRef = z.infer<typeof FirmBrainSnapshotRefSchema>;

// ============================================================================
// V2.5: Parsed Requirements from RFP Source
// ============================================================================

export const ParsedRequiredSectionSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  pageLimit: z.number().optional(),
  wordLimit: z.number().optional(),
});

export type ParsedRequiredSection = z.infer<typeof ParsedRequiredSectionSchema>;

export const ParsedRfpRequirementsSchema = z.object({
  /** Parsed deadline from RFP text */
  deadline: z.string().nullable().optional(),
  /** Parsed submission instructions */
  submissionInstructions: z.array(z.string()).default([]),
  /** Compliance requirements that must be met */
  complianceChecklist: z.array(z.string()).default([]),
  /** How the proposal will be evaluated */
  evaluationCriteria: z.array(z.string()).default([]),
  /** Required response sections from the RFP */
  requiredResponseSections: z.array(ParsedRequiredSectionSchema).default([]),
  /** Specific questions that must be answered */
  mustAnswerQuestions: z.array(z.string()).default([]),
  /** Overall word limit (if specified) */
  wordLimit: z.number().nullable().optional(),
  /** Overall page limit (if specified) */
  pageLimit: z.number().nullable().optional(),
  /** When the requirements were parsed */
  parsedAt: z.string().optional(),
  /** Parsing confidence */
  parseConfidence: z.enum(['high', 'medium', 'low']).optional(),
});

export type ParsedRfpRequirements = z.infer<typeof ParsedRfpRequirementsSchema>;

export const RfpSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  opportunityId: z.string().nullable(), // Link to Opportunity if exists
  title: z.string().min(1),
  status: z.enum(['intake', 'assembling', 'review', 'submitted', 'won', 'lost']).default('intake'),
  dueDate: z.string().nullable(),
  scopeSummary: z.string().nullable(),
  sourceDocUrl: z.string().url().nullable(), // Link to original RFP document
  requirementsChecklist: z.array(RequirementChecklistItemSchema).default([]),
  selectedPath: z.enum(['strategy', 'project', 'custom']).default('project'),
  // V2: Firm Brain snapshot for drift detection
  firmBrainSnapshot: FirmBrainSnapshotRefSchema.nullable().optional(),
  // V2.5: RFP Source - pasted text and parsed requirements
  sourceText: z.string().nullable().optional(), // Pasted RFP text
  parsedRequirements: ParsedRfpRequirementsSchema.nullable().optional(), // Parsed from sourceText
  // V3: Competitive positioning
  competitors: z.array(z.string()).optional(), // Competitor company names
  // V3: Win Strategy - explicit strategy layer to drive generation
  winStrategy: RfpWinStrategySchema.nullable().optional(),
  // V4: Submission Readiness Snapshot - captured at final submission
  submissionSnapshot: z.object({
    /** Bid readiness score at submission (0-100) */
    score: z.number(),
    /** Recommendation at submission */
    recommendation: z.enum(['go', 'conditional', 'no_go']),
    /** Summary text at submission */
    summary: z.string(),
    /** Risks that were acknowledged */
    acknowledgedRisks: z.array(z.object({
      category: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string(),
    })),
    /** Whether user explicitly acknowledged risks */
    risksAcknowledged: z.boolean(),
    /** When the submission decision was made */
    submittedAt: z.string(),
    /** User who submitted */
    submittedBy: z.string().nullable().optional(),
  }).nullable().optional(),
  createdBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type Rfp = z.infer<typeof RfpSchema>;

export const RfpInputSchema = RfpSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RfpInput = z.infer<typeof RfpInputSchema>;

// ============================================================================
// RFP Section Schema
// ============================================================================

export const GeneratedUsingSchema = z.object({
  firmBrainVersion: z.string().optional(),
  agencyProfileUpdatedAt: z.string().optional(),
  teamMemberIds: z.array(z.string()).optional(),
  caseStudyIds: z.array(z.string()).optional(),
  referenceIds: z.array(z.string()).optional(),
  pricingTemplateId: z.string().optional(),
  planTemplateId: z.string().optional(),
  scopeSummaryHash: z.string().optional(),
  strategyVersion: z.string().optional(),
  contextVersion: z.number().optional(),
  // V2: Input attribution for trust indicators
  inputsUsed: z.object({
    agencyProfile: z.boolean().default(false),
    team: z.boolean().default(false),
    caseStudies: z.boolean().default(false),
    references: z.boolean().default(false),
    pricing: z.boolean().default(false),
    plans: z.boolean().default(false),
  }).optional(),
  // V3: Win strategy tracking
  hasWinStrategy: z.boolean().optional(),
  winThemesApplied: z.array(z.string()).optional(),
  proofItemsApplied: z.array(z.string()).optional(),
});

export type GeneratedUsing = z.infer<typeof GeneratedUsingSchema>;

export const RfpSectionSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  sectionKey: z.enum([
    'agency_overview',
    'approach',
    'team',
    'work_samples',
    'plan_timeline',
    'pricing',
    'references',
  ]),
  title: z.string(),
  status: z.enum(['empty', 'draft', 'ready', 'approved']).default('empty'),
  contentWorking: z.string().nullable(), // Current working content (markdown)
  contentApproved: z.string().nullable(), // Approved/locked content
  // V2: Previous content for version safety during regeneration
  previousContent: z.string().nullable().optional(),
  sourceType: z.enum(['firm_brain', 'generated', 'manual']).nullable(),
  generatedUsing: GeneratedUsingSchema.nullable(),
  needsReview: z.boolean().default(false),
  lastGeneratedAt: z.string().nullable(),
  isStale: z.boolean().default(false),
  staleReason: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type RfpSection = z.infer<typeof RfpSectionSchema>;

export const RfpSectionInputSchema = RfpSectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RfpSectionInput = z.infer<typeof RfpSectionInputSchema>;

// ============================================================================
// RFP Bindings Schema
// ============================================================================

export const RfpBindingsSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  teamMemberIds: z.array(z.string()).default([]),
  caseStudyIds: z.array(z.string()).default([]),
  referenceIds: z.array(z.string()).default([]),
  pricingTemplateId: z.string().nullable(),
  planTemplateId: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type RfpBindings = z.infer<typeof RfpBindingsSchema>;

export const RfpBindingsInputSchema = RfpBindingsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RfpBindingsInput = z.infer<typeof RfpBindingsInputSchema>;

// ============================================================================
// RFP Aggregate (for builder UI)
// ============================================================================

export interface RfpWithDetails {
  rfp: Rfp;
  sections: RfpSection[];
  bindings: RfpBindings | null;
}

// ============================================================================
// RFP Health / Progress
// ============================================================================

export interface RfpProgress {
  totalSections: number;
  emptySections: number;
  draftSections: number;
  readySections: number;
  approvedSections: number;
  staleSections: number;
  needsReviewSections: number;
  progressPercent: number; // 0-100
  canSubmit: boolean;
  blockers: string[];
}

export function computeRfpProgress(sections: RfpSection[]): RfpProgress {
  const total = RFP_SECTION_ORDER.length;
  const emptySections = sections.filter(s => s.status === 'empty').length;
  const draftSections = sections.filter(s => s.status === 'draft').length;
  const readySections = sections.filter(s => s.status === 'ready').length;
  const approvedSections = sections.filter(s => s.status === 'approved').length;
  const staleSections = sections.filter(s => s.isStale).length;
  const needsReviewSections = sections.filter(s => s.needsReview).length;

  // Progress: draft=25%, ready=75%, approved=100%
  const progressPoints = sections.reduce((sum, s) => {
    if (s.status === 'approved') return sum + 100;
    if (s.status === 'ready') return sum + 75;
    if (s.status === 'draft') return sum + 25;
    return sum;
  }, 0);

  const progressPercent = Math.round(progressPoints / total);

  const blockers: string[] = [];
  if (emptySections > 0) {
    blockers.push(`${emptySections} section${emptySections > 1 ? 's' : ''} empty`);
  }
  if (staleSections > 0) {
    blockers.push(`${staleSections} section${staleSections > 1 ? 's' : ''} stale`);
  }
  if (needsReviewSections > 0) {
    blockers.push(`${needsReviewSections} section${needsReviewSections > 1 ? 's' : ''} need${needsReviewSections === 1 ? 's' : ''} review`);
  }

  // Can submit if all sections are at least ready (not empty/draft) and no stale
  const canSubmit = emptySections === 0 && draftSections === 0 && staleSections === 0;

  return {
    totalSections: total,
    emptySections,
    draftSections,
    readySections,
    approvedSections,
    staleSections,
    needsReviewSections,
    progressPercent,
    canSubmit,
    blockers,
  };
}

// ============================================================================
// RFP Section Generation Request
// ============================================================================

export interface RfpSectionGenerateRequest {
  rfpId: string;
  sectionKey: RfpSectionKey;
  regenerate?: boolean; // Force regeneration even if content exists
}

export interface RfpSectionGenerateResponse {
  success: boolean;
  section: RfpSection;
  generatedUsing: GeneratedUsing;
  validationWarnings?: string[];
}

// ============================================================================
// RFP Artifact Types (extend existing)
// ============================================================================

export const RFP_ARTIFACT_TYPES = [
  'rfp_response_doc',
  'rfp_deck',
  'pricing_sheet',
] as const;

export type RfpArtifactType = typeof RFP_ARTIFACT_TYPES[number];
