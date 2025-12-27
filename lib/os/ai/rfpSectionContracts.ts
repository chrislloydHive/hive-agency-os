// lib/os/ai/rfpSectionContracts.ts
// RFP Section Generation Contracts
// Defines inputs, constraints, and output specs for each RFP section

import type { RfpSectionKey } from '@/lib/types/rfp';

// ============================================================================
// Input Types
// ============================================================================

export type PrimaryInputType =
  | 'agency_profile'
  | 'team_members'
  | 'case_studies'
  | 'references'
  | 'pricing_template'
  | 'plan_template';

export type SecondaryInputType =
  | 'scope_summary'
  | 'company_context'
  | 'strategy_frame'
  | 'requirements_checklist';

// ============================================================================
// Section Contract
// ============================================================================

export interface RfpSectionContract {
  sectionKey: RfpSectionKey;
  title: string;
  description: string;
  primaryInputs: PrimaryInputType[];
  secondaryInputs: SecondaryInputType[];
  hardConstraints: string[];
  styleGuidance: string[];
  outputSpec: {
    format: 'markdown' | 'structured';
    minWords?: number;
    maxWords?: number;
    requiredSections?: string[];
  };
}

// ============================================================================
// Section Contracts
// ============================================================================

export const RFP_SECTION_CONTRACTS: Record<RfpSectionKey, RfpSectionContract> = {
  agency_overview: {
    sectionKey: 'agency_overview',
    title: 'Agency Overview',
    description: 'Introduces the agency, its mission, differentiators, and relevant experience.',
    primaryInputs: ['agency_profile'],
    secondaryInputs: ['scope_summary', 'company_context'],
    hardConstraints: [
      'MUST use exact agency name from profile',
      'MUST include stated differentiators',
      'MUST NOT invent capabilities not listed in profile',
      'MUST NOT include generic marketing language not backed by profile',
      'PROHIBIT mentioning "website performance", "CRO", "conversion optimization" unless explicitly in scope',
    ],
    styleGuidance: [
      'Lead with agency identity and mission',
      'Highlight relevant industry experience for this prospect',
      'Use confident but not boastful tone',
      'Keep focused on what matters to this specific RFP',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 200,
      maxWords: 500,
      requiredSections: ['Who We Are', 'Our Approach', 'Relevant Experience'],
    },
  },

  approach: {
    sectionKey: 'approach',
    title: 'Our Approach',
    description: 'Describes how the agency will tackle the specific opportunity/scope.',
    primaryInputs: ['agency_profile'],
    secondaryInputs: ['scope_summary', 'company_context', 'strategy_frame', 'requirements_checklist'],
    hardConstraints: [
      'MUST directly address the stated scope/requirements',
      'MUST align approach with agency methodology from profile',
      'MUST NOT propose services outside stated scope without explicit justification',
      'PROHIBIT generic "discover, define, deliver" without specifics',
      'PROHIBIT mentioning "website performance", "CRO", "conversion optimization" unless explicitly in scope',
    ],
    styleGuidance: [
      'Open by acknowledging the specific challenge/opportunity',
      'Connect approach to prospect context',
      'Be specific about methodology steps',
      'Show understanding of their business/industry',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 300,
      maxWords: 800,
      requiredSections: ['Understanding', 'Methodology', 'Key Deliverables'],
    },
  },

  team: {
    sectionKey: 'team',
    title: 'Proposed Team',
    description: 'Introduces the team members who will work on this engagement.',
    primaryInputs: ['team_members'],
    secondaryInputs: ['scope_summary'],
    hardConstraints: [
      'MUST only include selected team members from bindings',
      'MUST use exact names and roles from team member records',
      'MUST NOT invent qualifications or experience',
      'MUST include relevant strengths for this scope',
    ],
    styleGuidance: [
      'Lead with roles and responsibilities',
      'Highlight relevant experience for this project',
      'Show team chemistry and collaboration model',
      'Keep bios concise and relevant',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 150,
      maxWords: 400,
      requiredSections: ['Team Structure', 'Key Members'],
    },
  },

  work_samples: {
    sectionKey: 'work_samples',
    title: 'Work Samples',
    description: 'Showcases relevant case studies and portfolio work.',
    primaryInputs: ['case_studies'],
    secondaryInputs: ['scope_summary', 'company_context'],
    hardConstraints: [
      'MUST only include selected case studies from bindings',
      'MUST use exact client names (if permitted) and metrics from records',
      'MUST NOT embellish or invent results',
      'MUST respect permission levels (do not disclose NDA clients by name)',
    ],
    styleGuidance: [
      'Lead with relevance to this opportunity',
      'Focus on problem/approach/outcome structure',
      'Quantify results where available',
      'Draw clear parallels to prospect situation',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 200,
      maxWords: 600,
    },
  },

  plan_timeline: {
    sectionKey: 'plan_timeline',
    title: 'Plan & Timeline',
    description: 'Outlines the project phases, milestones, and timeline.',
    primaryInputs: ['plan_template'],
    secondaryInputs: ['scope_summary', 'requirements_checklist'],
    hardConstraints: [
      'MUST base structure on selected plan template',
      'MUST NOT commit to specific dates without client input',
      'MUST indicate dependencies and assumptions',
      'MUST align phases with stated scope',
    ],
    styleGuidance: [
      'Present phases in logical order',
      'Include key milestones and checkpoints',
      'Show collaboration points with client',
      'Be realistic about durations',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 200,
      maxWords: 500,
      requiredSections: ['Phases', 'Milestones', 'Assumptions'],
    },
  },

  pricing: {
    sectionKey: 'pricing',
    title: 'Investment',
    description: 'Presents the pricing structure, options, and terms.',
    primaryInputs: ['pricing_template'],
    secondaryInputs: ['scope_summary', 'requirements_checklist'],
    hardConstraints: [
      'MUST base pricing on selected pricing template',
      'MUST clearly state assumptions and exclusions',
      'MUST NOT invent rates or fees not in template',
      'MUST indicate what triggers additional costs',
    ],
    styleGuidance: [
      'Lead with value proposition, not just numbers',
      'Present options if available',
      'Be transparent about what is included/excluded',
      'Frame as investment, not cost',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 150,
      maxWords: 400,
      requiredSections: ['Investment Summary', 'What\'s Included', 'Assumptions'],
    },
  },

  references: {
    sectionKey: 'references',
    title: 'References',
    description: 'Provides client references for prospect to contact.',
    primaryInputs: ['references'],
    secondaryInputs: [],
    hardConstraints: [
      'MUST only include selected references from bindings',
      'MUST only include references with confirmed permission status',
      'MUST use exact contact information from records',
      'MUST NOT share contact details for non-confirmed references',
    ],
    styleGuidance: [
      'Present in professional format',
      'Include relevant context about each engagement',
      'Note what each reference can speak to',
    ],
    outputSpec: {
      format: 'markdown',
      minWords: 100,
      maxWords: 300,
    },
  },
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if required inputs are available for a section
 */
export function validateSectionInputs(
  sectionKey: RfpSectionKey,
  availableInputs: {
    hasAgencyProfile: boolean;
    teamMemberCount: number;
    caseStudyCount: number;
    referenceCount: number;
    hasPricingTemplate: boolean;
    hasPlanTemplate: boolean;
    hasScopeSummary: boolean;
  }
): { valid: boolean; missing: string[] } {
  const contract = RFP_SECTION_CONTRACTS[sectionKey];
  const missing: string[] = [];

  for (const input of contract.primaryInputs) {
    switch (input) {
      case 'agency_profile':
        if (!availableInputs.hasAgencyProfile) missing.push('Agency Profile');
        break;
      case 'team_members':
        if (availableInputs.teamMemberCount === 0) missing.push('Team Members');
        break;
      case 'case_studies':
        if (availableInputs.caseStudyCount === 0) missing.push('Case Studies');
        break;
      case 'references':
        if (availableInputs.referenceCount === 0) missing.push('References');
        break;
      case 'pricing_template':
        if (!availableInputs.hasPricingTemplate) missing.push('Pricing Template');
        break;
      case 'plan_template':
        if (!availableInputs.hasPlanTemplate) missing.push('Plan Template');
        break;
    }
  }

  // Check required secondary inputs
  if (contract.secondaryInputs.includes('scope_summary') && !availableInputs.hasScopeSummary) {
    missing.push('Scope Summary');
  }

  return { valid: missing.length === 0, missing };
}
