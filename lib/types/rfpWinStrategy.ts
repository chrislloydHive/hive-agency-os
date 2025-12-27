// lib/types/rfpWinStrategy.ts
// RFP Win Strategy types - explicit strategy layer to drive section generation
// toward higher win rates by aligning with evaluation criteria, win themes, and proof

import { z } from 'zod';

// ============================================================================
// Win Theme - Key messages to emphasize throughout the RFP
// ============================================================================

export const RfpWinThemeSchema = z.object({
  id: z.string(),
  /** Short label for the theme (e.g., "Speed to Market") */
  label: z.string().min(1),
  /** Detailed description of the theme and why it matters */
  description: z.string(),
  /** Which sections should emphasize this theme */
  applicableSections: z.array(z.string()).optional(),
});

export type RfpWinTheme = z.infer<typeof RfpWinThemeSchema>;

// ============================================================================
// Proof Item - Specific evidence to weave into the response
// ============================================================================

export const RfpProofItemSchema = z.object({
  type: z.enum(['case_study', 'reference', 'metric', 'credential']),
  /** ID of the case study or reference (from Firm Brain) */
  id: z.string(),
  /** Guidance on how to use this proof point */
  usageGuidance: z.string().optional(),
  /** Which sections should include this proof */
  targetSections: z.array(z.string()).optional(),
  /** Priority for inclusion (higher = more important) */
  priority: z.number().min(1).max(5).default(3),
});

export type RfpProofItem = z.infer<typeof RfpProofItemSchema>;

// ============================================================================
// Evaluation Criterion - Scoring criteria from the RFP
// ============================================================================

export const RfpEvaluationCriterionSchema = z.object({
  /** The criterion name (e.g., "Technical Approach") */
  label: z.string().min(1),
  /** Weight if specified (e.g., 0.4 for 40%) */
  weight: z.number().min(0).max(1).optional(),
  /** Guidance on how to address this criterion */
  guidance: z.string().optional(),
  /** Which sections primarily address this criterion */
  primarySections: z.array(z.string()).optional(),
  /** Our estimated alignment score (1-5) */
  alignmentScore: z.number().min(1).max(5).optional(),
  /** Why we believe we score this way */
  alignmentRationale: z.string().optional(),
});

export type RfpEvaluationCriterion = z.infer<typeof RfpEvaluationCriterionSchema>;

// ============================================================================
// Landmine - Risk areas to be careful about
// ============================================================================

export const RfpLandmineSchema = z.object({
  id: z.string(),
  /** Description of the risk */
  description: z.string(),
  /** Severity level */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  /** Mitigation strategy */
  mitigation: z.string().optional(),
  /** Which sections need to address this */
  affectedSections: z.array(z.string()).optional(),
});

export type RfpLandmine = z.infer<typeof RfpLandmineSchema>;

// ============================================================================
// Win Strategy - Full strategy model
// ============================================================================

export const RfpWinStrategySchema = z.object({
  /** Evaluation criteria with weights and guidance */
  evaluationCriteria: z.array(RfpEvaluationCriterionSchema).default([]),
  /** Key themes to emphasize throughout */
  winThemes: z.array(RfpWinThemeSchema).default([]),
  /** Proof points to include */
  proofPlan: z.array(RfpProofItemSchema).default([]),
  /** Assumptions about competitor weaknesses */
  competitiveAssumptions: z.array(z.string()).default([]),
  /** Risk areas to address carefully */
  landmines: z.array(RfpLandmineSchema).default([]),
  /** Whether the strategy has been reviewed/locked by a human */
  locked: z.boolean().default(false),
  /** Who locked the strategy */
  lockedBy: z.string().optional(),
  /** When the strategy was locked */
  lockedAt: z.string().optional(),
  /** Strategy creation timestamp */
  createdAt: z.string().optional(),
  /** Last update timestamp */
  updatedAt: z.string().optional(),
});

export type RfpWinStrategy = z.infer<typeof RfpWinStrategySchema>;

// ============================================================================
// Strategy Scoring - How well sections align with strategy
// ============================================================================

export const SectionStrategyAlignmentSchema = z.object({
  sectionKey: z.string(),
  /** Overall alignment score (0-100) */
  alignmentScore: z.number().min(0).max(100),
  /** Which win themes are addressed */
  themesAddressed: z.array(z.string()).default([]),
  /** Which win themes are missing */
  themesMissing: z.array(z.string()).default([]),
  /** Which proof items are included */
  proofIncluded: z.array(z.string()).default([]),
  /** Which proof items should be added */
  proofMissing: z.array(z.string()).default([]),
  /** Which evaluation criteria are addressed */
  criteriaAddressed: z.array(z.string()).default([]),
  /** Which criteria need more attention */
  criteriaMissing: z.array(z.string()).default([]),
  /** Any landmines that apply to this section */
  landminesPresent: z.array(z.string()).default([]),
  /** Improvement suggestions */
  suggestions: z.array(z.string()).default([]),
});

export type SectionStrategyAlignment = z.infer<typeof SectionStrategyAlignmentSchema>;

// ============================================================================
// Strategy Health - Overall strategy completeness
// ============================================================================

export interface StrategyHealth {
  /** Is the strategy defined? */
  isDefined: boolean;
  /** Is the strategy locked? */
  isLocked: boolean;
  /** Completeness score (0-100) */
  completenessScore: number;
  /** Issues with the strategy */
  issues: string[];
  /** Suggested improvements */
  suggestions: string[];
}

export function computeStrategyHealth(strategy: RfpWinStrategy | null | undefined): StrategyHealth {
  if (!strategy) {
    return {
      isDefined: false,
      isLocked: false,
      completenessScore: 0,
      issues: ['No win strategy defined'],
      suggestions: ['Define evaluation criteria, win themes, and proof plan to improve win rate'],
    };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check evaluation criteria (30 points)
  if (strategy.evaluationCriteria.length > 0) {
    score += 15;
    const withWeights = strategy.evaluationCriteria.filter(c => c.weight !== undefined);
    if (withWeights.length === strategy.evaluationCriteria.length) {
      score += 10;
    } else {
      suggestions.push('Add weights to all evaluation criteria for better alignment');
    }
    const withGuidance = strategy.evaluationCriteria.filter(c => c.guidance);
    if (withGuidance.length === strategy.evaluationCriteria.length) {
      score += 5;
    }
  } else {
    issues.push('No evaluation criteria defined');
    suggestions.push('Add evaluation criteria from the RFP to align content');
  }

  // Check win themes (30 points)
  if (strategy.winThemes.length > 0) {
    score += 20;
    if (strategy.winThemes.length >= 3) {
      score += 10;
    } else {
      suggestions.push('Consider adding more win themes (recommend 3-5)');
    }
  } else {
    issues.push('No win themes defined');
    suggestions.push('Define 3-5 key themes to emphasize throughout the response');
  }

  // Check proof plan (25 points)
  if (strategy.proofPlan.length > 0) {
    score += 15;
    const caseStudies = strategy.proofPlan.filter(p => p.type === 'case_study');
    const references = strategy.proofPlan.filter(p => p.type === 'reference');
    if (caseStudies.length >= 2 && references.length >= 1) {
      score += 10;
    } else {
      suggestions.push('Include at least 2 case studies and 1 reference in proof plan');
    }
  } else {
    issues.push('No proof plan defined');
    suggestions.push('Add case studies and references to support your claims');
  }

  // Check landmines (15 points)
  if (strategy.landmines.length > 0) {
    score += 10;
    const withMitigation = strategy.landmines.filter(l => l.mitigation);
    if (withMitigation.length === strategy.landmines.length) {
      score += 5;
    } else {
      suggestions.push('Add mitigation strategies for all identified landmines');
    }
  }
  // Landmines are optional, no issue if missing

  return {
    isDefined: true,
    isLocked: strategy.locked,
    completenessScore: score,
    issues,
    suggestions,
  };
}

// ============================================================================
// Section-Strategy Mapping
// ============================================================================

/**
 * Default mapping of sections to evaluation criteria and themes
 */
export const SECTION_STRATEGY_DEFAULTS: Record<string, {
  typicalCriteria: string[];
  typicalThemes: string[];
}> = {
  agency_overview: {
    typicalCriteria: ['experience', 'qualifications', 'capability'],
    typicalThemes: ['credibility', 'expertise', 'partnership'],
  },
  approach: {
    typicalCriteria: ['methodology', 'approach', 'technical', 'innovation'],
    typicalThemes: ['differentiation', 'results', 'innovation'],
  },
  team: {
    typicalCriteria: ['team', 'qualifications', 'experience', 'expertise'],
    typicalThemes: ['expertise', 'commitment', 'collaboration'],
  },
  work_samples: {
    typicalCriteria: ['experience', 'past performance', 'results'],
    typicalThemes: ['results', 'credibility', 'proof'],
  },
  plan_timeline: {
    typicalCriteria: ['timeline', 'deliverables', 'approach', 'methodology'],
    typicalThemes: ['efficiency', 'clarity', 'commitment'],
  },
  pricing: {
    typicalCriteria: ['cost', 'price', 'value', 'budget'],
    typicalThemes: ['value', 'transparency', 'flexibility'],
  },
  references: {
    typicalCriteria: ['references', 'reputation', 'client satisfaction'],
    typicalThemes: ['credibility', 'trust', 'results'],
  },
};

// ============================================================================
// Empty/Default Strategy
// ============================================================================

export function createEmptyWinStrategy(): RfpWinStrategy {
  return {
    evaluationCriteria: [],
    winThemes: [],
    proofPlan: [],
    competitiveAssumptions: [],
    landmines: [],
    locked: false,
  };
}
