// lib/types/rfpEvaluatorPersona.ts
// Evaluator Persona types for RFP win optimization
// Different evaluators (procurement, technical, executive) have different priorities
// and sensitivities when reviewing RFP responses.

import { z } from 'zod';
import type { RfpSectionKey } from './rfp';

// ============================================================================
// Evaluator Persona Types
// ============================================================================

/**
 * The three primary evaluator archetypes
 */
export type EvaluatorPersonaType = 'procurement' | 'technical' | 'executive';

export const EVALUATOR_PERSONA_TYPES: EvaluatorPersonaType[] = [
  'procurement',
  'technical',
  'executive',
];

// ============================================================================
// Persona Definitions
// ============================================================================

export interface EvaluatorPersona {
  type: EvaluatorPersonaType;
  label: string;
  description: string;
  /** What this persona prioritizes when evaluating */
  priorities: string[];
  /** What triggers negative reactions from this persona */
  sensitivities: string[];
  /** Tone/style preferences for content aimed at this persona */
  tonePreferences: string[];
  /** Keywords/phrases that resonate with this persona */
  resonantPhrases: string[];
  /** Keywords/phrases to avoid with this persona */
  avoidPhrases: string[];
}

/**
 * Predefined evaluator personas with their characteristics
 */
export const EVALUATOR_PERSONAS: Record<EvaluatorPersonaType, EvaluatorPersona> = {
  procurement: {
    type: 'procurement',
    label: 'Procurement',
    description: 'Focuses on compliance, risk mitigation, and process adherence',
    priorities: [
      'Compliance with RFP requirements',
      'Clear pricing structure',
      'Risk mitigation',
      'Contract terms and conditions',
      'Vendor stability and credentials',
      'References and past performance',
    ],
    sensitivities: [
      'Vague or ambiguous pricing',
      'Non-responsive sections',
      'Missing required content',
      'Unclear terms or commitments',
      'Overpromising without evidence',
    ],
    tonePreferences: [
      'Formal and professional',
      'Clear and unambiguous',
      'Structured and organized',
      'Compliance-focused',
    ],
    resonantPhrases: [
      'in compliance with',
      'as specified in the RFP',
      'we commit to',
      'our standard terms include',
      'upon request we can provide',
      'included in the base scope',
    ],
    avoidPhrases: [
      'we believe',
      'typically',
      'usually',
      'subject to change',
      'TBD',
      'approximate',
    ],
  },
  technical: {
    type: 'technical',
    label: 'Technical',
    description: 'Evaluates methodology, innovation, and technical capability',
    priorities: [
      'Technical approach and methodology',
      'Team qualifications and expertise',
      'Innovation and problem-solving',
      'Quality assurance processes',
      'Tools and technology stack',
      'Past technical performance',
    ],
    sensitivities: [
      'Generic or buzzword-heavy content',
      'Lack of specific methodology',
      'Oversimplified technical claims',
      'Missing team credentials',
      'Vague implementation details',
    ],
    tonePreferences: [
      'Technically precise',
      'Detail-oriented',
      'Evidence-based',
      'Methodologically rigorous',
    ],
    resonantPhrases: [
      'our methodology includes',
      'we implement using',
      'technically, this involves',
      'our team has expertise in',
      'based on our experience with',
      'measurable outcomes include',
    ],
    avoidPhrases: [
      'best-in-class',
      'world-class',
      'cutting-edge',
      'synergy',
      'leverage',
      'holistic approach',
    ],
  },
  executive: {
    type: 'executive',
    label: 'Executive',
    description: 'Focuses on strategic value, ROI, and partnership potential',
    priorities: [
      'Business value and ROI',
      'Strategic alignment',
      'Partnership approach',
      'Scalability and future potential',
      'Leadership and vision',
      'Risk vs. reward trade-offs',
    ],
    sensitivities: [
      'Too much technical detail',
      'Lack of business context',
      'Missing value proposition',
      'No clear differentiators',
      'Transactional rather than strategic tone',
    ],
    tonePreferences: [
      'Strategic and forward-looking',
      'Value-focused',
      'Partnership-oriented',
      'Confident but not arrogant',
    ],
    resonantPhrases: [
      'return on investment',
      'strategic partnership',
      'long-term value',
      'business outcomes',
      'we understand your goals',
      'aligned with your vision',
    ],
    avoidPhrases: [
      'deliverables',
      'scope items',
      'hours allocated',
      'per the SOW',
      'as contracted',
      'line item',
    ],
  },
};

// ============================================================================
// Section-Persona Assignment
// ============================================================================

export const SectionPersonaAssignmentSchema = z.object({
  sectionKey: z.string(),
  /** Primary persona evaluating this section */
  primaryPersona: z.enum(['procurement', 'technical', 'executive']),
  /** Secondary personas who may also review (lower weight) */
  secondaryPersonas: z.array(z.enum(['procurement', 'technical', 'executive'])).default([]),
  /** Override reason (if user changed from default) */
  overrideReason: z.string().optional(),
  /** Was this assignment manual or automatic? */
  isManualOverride: z.boolean().default(false),
});

export type SectionPersonaAssignment = z.infer<typeof SectionPersonaAssignmentSchema>;

// ============================================================================
// Default Persona Mappings
// ============================================================================

/**
 * Default persona assignments by section type
 * Based on typical RFP evaluation patterns
 */
export const DEFAULT_SECTION_PERSONAS: Record<RfpSectionKey, {
  primary: EvaluatorPersonaType;
  secondary: EvaluatorPersonaType[];
}> = {
  agency_overview: {
    primary: 'executive',
    secondary: ['procurement'],
  },
  approach: {
    primary: 'technical',
    secondary: ['executive'],
  },
  team: {
    primary: 'technical',
    secondary: ['executive'],
  },
  work_samples: {
    primary: 'technical',
    secondary: ['executive', 'procurement'],
  },
  plan_timeline: {
    primary: 'technical',
    secondary: ['procurement'],
  },
  pricing: {
    primary: 'procurement',
    secondary: ['executive'],
  },
  references: {
    primary: 'procurement',
    secondary: ['executive'],
  },
};

// ============================================================================
// Persona Risk Detection
// ============================================================================

export interface PersonaRisk {
  /** The criterion label */
  criterionLabel: string;
  /** The persona expecting this criterion */
  expectedPersona: EvaluatorPersonaType;
  /** Section(s) covering this criterion */
  coveringSections: string[];
  /** Persona assigned to those sections */
  actualPersonas: EvaluatorPersonaType[];
  /** Is there a mismatch? */
  isMismatch: boolean;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
  /** Description of the risk */
  description: string;
}

/**
 * Map evaluation criteria keywords to expected personas
 */
export const CRITERION_PERSONA_KEYWORDS: Record<EvaluatorPersonaType, string[]> = {
  procurement: [
    'compliance', 'cost', 'price', 'budget', 'contract', 'terms',
    'references', 'insurance', 'certification', 'warranty', 'payment',
    'risk', 'liability', 'sla', 'service level', 'penalty',
  ],
  technical: [
    'methodology', 'approach', 'technical', 'technology', 'implementation',
    'quality', 'process', 'team', 'expertise', 'experience', 'tools',
    'development', 'design', 'innovation', 'architecture', 'integration',
  ],
  executive: [
    'value', 'roi', 'strategy', 'vision', 'partnership', 'growth',
    'scalability', 'competitive', 'differentiation', 'leadership',
    'business', 'alignment', 'outcomes', 'success', 'transformation',
  ],
};

/**
 * Infer the likely evaluator persona for a criterion based on keywords
 */
export function inferCriterionPersona(criterionLabel: string): EvaluatorPersonaType | null {
  const lowerLabel = criterionLabel.toLowerCase();

  // Count keyword matches for each persona
  const scores: Record<EvaluatorPersonaType, number> = {
    procurement: 0,
    technical: 0,
    executive: 0,
  };

  for (const [persona, keywords] of Object.entries(CRITERION_PERSONA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerLabel.includes(keyword)) {
        scores[persona as EvaluatorPersonaType]++;
      }
    }
  }

  // Find the highest scoring persona
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  const winners = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([persona]) => persona as EvaluatorPersonaType);

  // If tie, prefer technical (most common RFP evaluator)
  if (winners.includes('technical')) return 'technical';
  return winners[0];
}

// ============================================================================
// RFP Persona Settings
// ============================================================================

export const RfpPersonaSettingsSchema = z.object({
  /** Whether persona layer is enabled for this RFP */
  enabled: z.boolean().default(true),
  /** Section-specific persona assignments */
  sectionAssignments: z.array(SectionPersonaAssignmentSchema).default([]),
  /** Custom guidance for personas (user can add specific notes) */
  customGuidance: z.record(z.enum(['procurement', 'technical', 'executive']), z.string()).optional(),
  /** When settings were last updated */
  updatedAt: z.string().optional(),
});

export type RfpPersonaSettings = z.infer<typeof RfpPersonaSettingsSchema>;

/**
 * Create default persona settings for an RFP
 */
export function createDefaultPersonaSettings(): RfpPersonaSettings {
  const sectionAssignments: SectionPersonaAssignment[] = Object.entries(DEFAULT_SECTION_PERSONAS).map(
    ([sectionKey, { primary, secondary }]) => ({
      sectionKey,
      primaryPersona: primary,
      secondaryPersonas: secondary,
      isManualOverride: false,
    })
  );

  return {
    enabled: true,
    sectionAssignments,
  };
}

/**
 * Get persona assignment for a section (with fallback to defaults)
 */
export function getPersonaForSection(
  sectionKey: RfpSectionKey,
  settings?: RfpPersonaSettings | null
): { primary: EvaluatorPersonaType; secondary: EvaluatorPersonaType[] } {
  // Check custom assignments first
  if (settings?.sectionAssignments) {
    const assignment = settings.sectionAssignments.find(a => a.sectionKey === sectionKey);
    if (assignment) {
      return {
        primary: assignment.primaryPersona,
        secondary: assignment.secondaryPersonas,
      };
    }
  }

  // Fall back to defaults
  return DEFAULT_SECTION_PERSONAS[sectionKey] || { primary: 'technical', secondary: [] };
}

// ============================================================================
// Persona Label Helpers
// ============================================================================

export function getPersonaLabel(type: EvaluatorPersonaType): string {
  return EVALUATOR_PERSONAS[type].label;
}

export function getPersonaColor(type: EvaluatorPersonaType): string {
  switch (type) {
    case 'procurement': return 'blue';
    case 'technical': return 'purple';
    case 'executive': return 'amber';
    default: return 'slate';
  }
}

export function getPersonaIcon(type: EvaluatorPersonaType): string {
  switch (type) {
    case 'procurement': return 'FileCheck';
    case 'technical': return 'Code';
    case 'executive': return 'TrendingUp';
    default: return 'User';
  }
}
