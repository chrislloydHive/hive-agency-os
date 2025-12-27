// lib/os/proposal/convertRfpToProposal.ts
// Converts an RFP to a Proposal by mapping sections and preserving content

import type { RfpWithDetails, RfpSection, RfpSectionKey } from '@/lib/types/rfp';
import type {
  Proposal,
  ProposalSection,
  ProposalSectionKey,
  ConvertRfpToProposalResponse,
} from '@/lib/types/proposal';
import {
  createProposal,
  createProposalSection,
} from '@/lib/airtable/proposals';

// ============================================================================
// RFP → Proposal Section Mapping
// ============================================================================

/**
 * Maps RFP section keys to Proposal section keys.
 * Some RFP sections map directly, others are merged or skipped.
 */
const RFP_TO_PROPOSAL_MAP: Record<RfpSectionKey, ProposalSectionKey | null> = {
  agency_overview: 'scope',      // Agency overview becomes scope intro
  approach: 'approach',          // Direct mapping
  team: 'team',                  // Direct mapping
  work_samples: 'proof',         // Work samples become proof
  plan_timeline: 'timeline',     // Plan becomes timeline
  pricing: 'pricing',            // Direct mapping
  references: null,              // References not directly mapped (optional appendix)
};

/**
 * Proposal sections that don't have a direct RFP equivalent
 * and start empty (user must fill manually)
 */
const PROPOSAL_ONLY_SECTIONS: ProposalSectionKey[] = [
  'deliverables',  // Specific deliverables list (not in RFP)
];

// ============================================================================
// Conversion Logic
// ============================================================================

export interface ConvertRfpToProposalInput {
  rfpWithDetails: RfpWithDetails;
  proposalTitle?: string;  // Override title (defaults to "Proposal: {RFP Title}")
}

/**
 * Converts an RFP to a Proposal by:
 * 1. Creating a new Proposal record linked to the source RFP
 * 2. Mapping RFP sections to Proposal sections (using approved or working content)
 * 3. Creating empty sections for proposal-only fields
 * 4. Preserving the Firm Brain snapshot reference
 */
export async function convertRfpToProposal(
  input: ConvertRfpToProposalInput
): Promise<ConvertRfpToProposalResponse> {
  const { rfpWithDetails, proposalTitle } = input;
  const { rfp, sections: rfpSections } = rfpWithDetails;

  // Create the proposal record
  const proposal = await createProposal({
    companyId: rfp.companyId,
    title: proposalTitle || `Proposal: ${rfp.title}`,
    status: 'draft',
    sourceRfpId: rfp.id,
    firmBrainSnapshot: rfp.firmBrainSnapshot,
    createdBy: null,
  });

  // Track mapping results
  const createdSections: ProposalSection[] = [];
  const skippedSections: string[] = [];
  let mappedCount = 0;

  // Map RFP sections to Proposal sections
  for (const rfpSection of rfpSections) {
    const proposalSectionKey = RFP_TO_PROPOSAL_MAP[rfpSection.sectionKey];

    if (!proposalSectionKey) {
      // This RFP section doesn't map to a proposal section
      skippedSections.push(rfpSection.sectionKey);
      continue;
    }

    // Get the best available content (approved > working)
    const content = rfpSection.contentApproved || rfpSection.contentWorking;
    const hasContent = content && content.trim().length > 0;

    // Create the proposal section
    const proposalSection = await createProposalSection({
      proposalId: proposal.id,
      sectionKey: proposalSectionKey,
      title: getProposalSectionTitle(proposalSectionKey),
      status: hasContent ? 'draft' : 'empty',
      content: content || null,
      sourceType: hasContent ? 'rfp_converted' : null,
      sourceRfpSectionKey: rfpSection.sectionKey,
      sourceLibrarySectionId: null,
    });

    createdSections.push(proposalSection);

    if (hasContent) {
      mappedCount++;
    }
  }

  // Create empty sections for proposal-only fields
  for (const sectionKey of PROPOSAL_ONLY_SECTIONS) {
    // Check if already created (shouldn't be, but safety check)
    const alreadyCreated = createdSections.some(s => s.sectionKey === sectionKey);
    if (alreadyCreated) continue;

    const proposalSection = await createProposalSection({
      proposalId: proposal.id,
      sectionKey,
      title: getProposalSectionTitle(sectionKey),
      status: 'empty',
      content: null,
      sourceType: null,
      sourceRfpSectionKey: null,
      sourceLibrarySectionId: null,
    });

    createdSections.push(proposalSection);
  }

  // Sort sections by canonical order
  const sortedSections = sortProposalSections(createdSections);

  return {
    success: true,
    proposal,
    sections: sortedSections,
    mappedSections: mappedCount,
    skippedSections,
  };
}

// ============================================================================
// Content Transformation (Optional Enhancement)
// ============================================================================

/**
 * Transforms RFP section content to better fit the proposal format.
 * Currently a pass-through, but can be enhanced for section-specific transforms.
 */
export function transformContentForProposal(
  rfpSectionKey: RfpSectionKey,
  proposalSectionKey: ProposalSectionKey,
  content: string
): string {
  // For now, just return the content as-is
  // Future: Could add section-specific transformations
  // e.g., strip RFP-specific phrasing, adjust tone, etc.
  return content;
}

// ============================================================================
// Helpers
// ============================================================================

const PROPOSAL_SECTION_TITLES: Record<ProposalSectionKey, string> = {
  scope: 'Scope of Work',
  approach: 'Our Approach',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  pricing: 'Investment',
  proof: 'Proof of Expertise',
  team: 'Your Team',
};

function getProposalSectionTitle(key: ProposalSectionKey): string {
  return PROPOSAL_SECTION_TITLES[key] || key;
}

const PROPOSAL_SECTION_ORDER: ProposalSectionKey[] = [
  'scope',
  'approach',
  'deliverables',
  'timeline',
  'pricing',
  'proof',
  'team',
];

function sortProposalSections(sections: ProposalSection[]): ProposalSection[] {
  return sections.sort((a, b) => {
    const aIndex = PROPOSAL_SECTION_ORDER.indexOf(a.sectionKey);
    const bIndex = PROPOSAL_SECTION_ORDER.indexOf(b.sectionKey);
    return aIndex - bIndex;
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Checks if an RFP is ready to be converted to a proposal.
 * Requires at least some content in key sections.
 */
export function canConvertToProposal(rfpWithDetails: RfpWithDetails): {
  canConvert: boolean;
  reason?: string;
  warnings: string[];
} {
  const { rfp, sections } = rfpWithDetails;
  const warnings: string[] = [];

  // Check RFP status - should be at least in assembling phase
  if (rfp.status === 'intake') {
    return {
      canConvert: false,
      reason: 'RFP is still in intake phase. Generate some content first.',
      warnings: [],
    };
  }

  // Check for content in key sections
  const keySections: RfpSectionKey[] = ['approach', 'team', 'pricing'];
  const hasKeyContent = keySections.some(key => {
    const section = sections.find(s => s.sectionKey === key);
    return section && (section.contentApproved || section.contentWorking);
  });

  if (!hasKeyContent) {
    return {
      canConvert: false,
      reason: 'RFP has no content in key sections (approach, team, or pricing).',
      warnings: [],
    };
  }

  // Warnings for missing content
  const allMappableSections: RfpSectionKey[] = ['agency_overview', 'approach', 'team', 'work_samples', 'plan_timeline', 'pricing'];
  for (const key of allMappableSections) {
    const section = sections.find(s => s.sectionKey === key);
    const hasContent = section && (section.contentApproved || section.contentWorking);
    if (!hasContent) {
      warnings.push(`${key.replace('_', ' ')} section is empty`);
    }
  }

  return {
    canConvert: true,
    warnings,
  };
}
