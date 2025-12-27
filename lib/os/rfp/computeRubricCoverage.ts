// lib/os/rfp/computeRubricCoverage.ts
// Computes coverage per criterion across RFP sections
// Used to identify gaps in addressing evaluation criteria and improve win rate

import type { RfpSection, RfpSectionKey, GeneratedUsing } from '@/lib/types/rfp';
import type { RfpWinStrategy, RfpEvaluationCriterion, RfpProofItem } from '@/lib/types/rfpWinStrategy';
import { SECTION_STRATEGY_DEFAULTS } from '@/lib/types/rfpWinStrategy';
import {
  type EvaluatorPersonaType,
  type RfpPersonaSettings,
  inferCriterionPersona,
  getPersonaForSection,
  getPersonaLabel,
} from '@/lib/types/rfpEvaluatorPersona';

// ============================================================================
// Types
// ============================================================================

export interface CriterionCoverage {
  /** The criterion label */
  criterionLabel: string;
  /** The criterion index in the strategy (for stable sorting) */
  criterionIndex: number;
  /** Weight of this criterion (0-1, higher = more important) */
  weight: number;
  /** Sections that cover this criterion */
  coveredBySectionKeys: string[];
  /** Coverage score (0-100) based on section coverage */
  coverageScore: number;
  /** Proof coverage score (0-100) based on proof items applied */
  proofCoverageScore: number;
  /** Combined score considering weight */
  weightedScore: number;
  /** Notes/warnings about coverage */
  notes: string[];
  /** Sections that should cover this but don't */
  missingSections: string[];
  /** Is this criterion flagged as a risk? */
  isRisk: boolean;
  /** V4: Persona risk detection */
  /** Expected persona for this criterion (inferred from keywords) */
  expectedPersona?: EvaluatorPersonaType;
  /** Actual personas of sections covering this criterion */
  coveringPersonas?: EvaluatorPersonaType[];
  /** Is there a persona mismatch? */
  hasPersonaMismatch?: boolean;
  /** Persona risk level */
  personaRiskLevel?: 'none' | 'low' | 'medium' | 'high';
  /** Persona risk description */
  personaRiskDescription?: string;
}

export interface SectionCoverage {
  /** Section key */
  sectionKey: string;
  /** Section ID */
  sectionId: string;
  /** Criteria touched by this section */
  criteriaTouched: string[];
  /** High-weight criteria that should be in this section but aren't */
  missingHighWeightCriteria: string[];
  /** Win themes applied in this section */
  themesApplied: string[];
  /** Proof items applied in this section */
  proofApplied: string[];
  /** Overall section coverage score (0-100) */
  coverageScore: number;
  /** Whether this section needs review based on coverage gaps */
  needsReview: boolean;
  /** V4: Persona information */
  /** Primary persona assigned to this section */
  primaryPersona?: EvaluatorPersonaType;
  /** Secondary personas for this section */
  secondaryPersonas?: EvaluatorPersonaType[];
}

export interface RubricCoverageResult {
  /** Coverage for each criterion, sorted by priority (highest weight * lowest coverage first) */
  criterionCoverage: CriterionCoverage[];
  /** Coverage for each section */
  sectionCoverage: SectionCoverage[];
  /** Overall health percentage (0-100) */
  overallHealth: number;
  /** Number of uncovered high-weight criteria */
  uncoveredHighWeightCount: number;
  /** Number of sections needing review */
  sectionsNeedingReview: number;
  /** Summary notes */
  summaryNotes: string[];
  /** V4: Persona risk tracking */
  /** Number of criteria with persona mismatch risks */
  personaMismatchCount: number;
  /** Whether persona settings were provided */
  hasPersonaSettings: boolean;
}

// ============================================================================
// Section-Criterion Mapping
// ============================================================================

/**
 * Keywords that map criteria to sections
 */
const CRITERION_SECTION_KEYWORDS: Record<RfpSectionKey, string[]> = {
  agency_overview: [
    'experience', 'qualifications', 'capability', 'background', 'history',
    'company', 'agency', 'firm', 'organization', 'size', 'stability',
    'credentials', 'certifications',
  ],
  approach: [
    'methodology', 'approach', 'process', 'strategy', 'innovation',
    'technical', 'solution', 'design', 'execution', 'quality',
  ],
  team: [
    'team', 'personnel', 'staff', 'expertise', 'qualifications',
    'resources', 'people', 'roles', 'skills', 'talent',
  ],
  work_samples: [
    'experience', 'past performance', 'track record', 'similar projects',
    'portfolio', 'case studies', 'examples', 'results', 'outcomes',
  ],
  plan_timeline: [
    'timeline', 'schedule', 'milestones', 'deliverables', 'project management',
    'phasing', 'plan', 'execution', 'implementation',
  ],
  pricing: [
    'cost', 'price', 'value', 'budget', 'investment', 'fees',
    'rate', 'compensation', 'financial',
  ],
  references: [
    'references', 'reputation', 'client satisfaction', 'testimonials',
    'feedback', 'endorsements',
  ],
};

/**
 * Determine which sections should cover a criterion based on keywords
 */
function getSuggestedSectionsForCriterion(
  criterion: RfpEvaluationCriterion
): RfpSectionKey[] {
  // If criterion has explicit primarySections, use those
  if (criterion.primarySections && criterion.primarySections.length > 0) {
    return criterion.primarySections as RfpSectionKey[];
  }

  // Otherwise, match by keywords
  const criterionLower = criterion.label.toLowerCase();
  const guidanceLower = (criterion.guidance || '').toLowerCase();
  const combinedText = `${criterionLower} ${guidanceLower}`;

  const matchingSections: RfpSectionKey[] = [];

  for (const [sectionKey, keywords] of Object.entries(CRITERION_SECTION_KEYWORDS)) {
    const hasMatch = keywords.some(kw => combinedText.includes(kw));
    if (hasMatch) {
      matchingSections.push(sectionKey as RfpSectionKey);
    }
  }

  // If no matches, fall back to approach (most general section)
  if (matchingSections.length === 0) {
    return ['approach'];
  }

  return matchingSections;
}

/**
 * Check if a section's themes/content addresses a criterion
 */
function sectionAddressesCriterion(
  section: RfpSection,
  criterion: RfpEvaluationCriterion,
  strategy: RfpWinStrategy
): boolean {
  const generatedUsing = section.generatedUsing;
  if (!generatedUsing) return false;

  // Check if win strategy was used
  if (!generatedUsing.hasWinStrategy) return false;

  // Check if any applied themes relate to this criterion
  const themesApplied = generatedUsing.winThemesApplied || [];
  const criterionLower = criterion.label.toLowerCase();

  // Find themes that match the criterion
  for (const themeId of themesApplied) {
    const theme = strategy.winThemes.find(t => t.id === themeId);
    if (theme) {
      // Check if theme label/description relates to criterion
      const themeLower = `${theme.label} ${theme.description}`.toLowerCase();
      if (themeLower.includes(criterionLower) ||
          criterionLower.split(' ').some(word => word.length > 3 && themeLower.includes(word))) {
        return true;
      }
    }
  }

  // Check if section is in suggested sections for this criterion
  const suggestedSections = getSuggestedSectionsForCriterion(criterion);
  if (suggestedSections.includes(section.sectionKey)) {
    // Section type matches - assume it addresses the criterion if it has content
    return section.status !== 'empty' && generatedUsing.hasWinStrategy;
  }

  return false;
}

/**
 * Calculate proof coverage score for a criterion based on applied proof items
 */
function calculateProofCoverageForCriterion(
  coveredSections: RfpSection[],
  strategy: RfpWinStrategy
): number {
  if (coveredSections.length === 0) return 0;
  if (strategy.proofPlan.length === 0) return 100; // No proof required = full score

  // Collect all proof items applied across covering sections
  const allProofApplied = new Set<string>();
  for (const section of coveredSections) {
    const proofApplied = section.generatedUsing?.proofItemsApplied || [];
    proofApplied.forEach(p => allProofApplied.add(p));
  }

  if (allProofApplied.size === 0) return 0;

  // Score based on priority of applied proof items
  let totalPriorityPoints = 0;
  let earnedPriorityPoints = 0;

  for (const proof of strategy.proofPlan) {
    const priorityWeight = proof.priority || 3;
    totalPriorityPoints += priorityWeight;
    if (allProofApplied.has(proof.id)) {
      earnedPriorityPoints += priorityWeight;
    }
  }

  return totalPriorityPoints > 0
    ? Math.round((earnedPriorityPoints / totalPriorityPoints) * 100)
    : 100;
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute rubric coverage across all sections
 * @param strategy - RFP Win Strategy with evaluation criteria
 * @param sections - RFP sections to analyze
 * @param personaSettings - Optional persona settings for persona risk detection
 */
export function computeRubricCoverage(
  strategy: RfpWinStrategy | null | undefined,
  sections: RfpSection[],
  personaSettings?: RfpPersonaSettings | null
): RubricCoverageResult {
  const hasPersonaSettings = !!personaSettings?.enabled;

  // Handle empty/missing strategy
  if (!strategy || strategy.evaluationCriteria.length === 0) {
    return {
      criterionCoverage: [],
      sectionCoverage: sections.map(s => {
        const { primary, secondary } = getPersonaForSection(s.sectionKey as RfpSectionKey, personaSettings);
        return {
          sectionKey: s.sectionKey,
          sectionId: s.id,
          criteriaTouched: [],
          missingHighWeightCriteria: [],
          themesApplied: s.generatedUsing?.winThemesApplied || [],
          proofApplied: s.generatedUsing?.proofItemsApplied || [],
          coverageScore: 100,
          needsReview: false,
          primaryPersona: primary,
          secondaryPersonas: secondary,
        };
      }),
      overallHealth: 100,
      uncoveredHighWeightCount: 0,
      sectionsNeedingReview: 0,
      summaryNotes: ['No evaluation criteria defined in win strategy'],
      personaMismatchCount: 0,
      hasPersonaSettings,
    };
  }

  // Build section map for quick lookup
  const sectionMap = new Map<string, RfpSection>();
  for (const section of sections) {
    sectionMap.set(section.sectionKey, section);
  }

  // Compute criterion coverage
  const criterionCoverages: CriterionCoverage[] = [];
  const sectionCriteriaMap = new Map<string, string[]>(); // sectionKey -> criteria labels

  for (let i = 0; i < strategy.evaluationCriteria.length; i++) {
    const criterion = strategy.evaluationCriteria[i];
    const weight = criterion.weight ?? 0.5; // Default to medium weight
    const suggestedSections = getSuggestedSectionsForCriterion(criterion);

    // Find sections that address this criterion
    const coveringSections: RfpSection[] = [];
    const coveredBySectionKeys: string[] = [];

    for (const section of sections) {
      if (sectionAddressesCriterion(section, criterion, strategy)) {
        coveringSections.push(section);
        coveredBySectionKeys.push(section.sectionKey);

        // Track criteria per section
        const existing = sectionCriteriaMap.get(section.sectionKey) || [];
        existing.push(criterion.label);
        sectionCriteriaMap.set(section.sectionKey, existing);
      }
    }

    // Find missing sections
    const missingSections = suggestedSections.filter(
      sKey => !coveredBySectionKeys.includes(sKey)
    );

    // Calculate coverage score
    const coverageScore = suggestedSections.length > 0
      ? Math.round((coveredBySectionKeys.length / suggestedSections.length) * 100)
      : 100;

    // Calculate proof coverage score
    const proofCoverageScore = calculateProofCoverageForCriterion(
      coveringSections,
      strategy
    );

    // Calculate weighted score (lower is worse)
    const weightedScore = coverageScore * (1 + (1 - weight));

    // Build notes
    const notes: string[] = [];
    if (coverageScore === 0) {
      notes.push(`Not covered by any section`);
    } else if (coverageScore < 50) {
      notes.push(`Only ${coveredBySectionKeys.length}/${suggestedSections.length} expected sections cover this`);
    }
    if (proofCoverageScore < 50 && strategy.proofPlan.length > 0) {
      notes.push(`Low proof coverage (${proofCoverageScore}%)`);
    }
    if (weight >= 0.3 && coverageScore < 100) {
      notes.push(`High-weight criterion with coverage gaps`);
    }

    const isRisk = weight >= 0.2 && (coverageScore < 50 || proofCoverageScore < 30);

    // V4: Persona risk detection
    let expectedPersona: EvaluatorPersonaType | undefined;
    let coveringPersonas: EvaluatorPersonaType[] = [];
    let hasPersonaMismatch = false;
    let personaRiskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    let personaRiskDescription: string | undefined;

    if (hasPersonaSettings) {
      // Infer which persona should evaluate this criterion
      expectedPersona = inferCriterionPersona(criterion.label) || undefined;

      // Get personas of covering sections
      coveringPersonas = coveredBySectionKeys.map(sKey => {
        const { primary } = getPersonaForSection(sKey as RfpSectionKey, personaSettings);
        return primary;
      });

      // Check for mismatch
      if (expectedPersona && coveringPersonas.length > 0) {
        const hasMatchingPersona = coveringPersonas.some(p => p === expectedPersona);
        hasPersonaMismatch = !hasMatchingPersona;

        if (hasPersonaMismatch) {
          // Determine risk level based on weight and whether any secondary personas match
          const coveringSectionsWithSecondary = coveredBySectionKeys.map(sKey => {
            const { primary, secondary } = getPersonaForSection(sKey as RfpSectionKey, personaSettings);
            return { primary, secondary };
          });

          const hasSecondaryMatch = coveringSectionsWithSecondary.some(
            ({ secondary }) => secondary.includes(expectedPersona!)
          );

          if (hasSecondaryMatch) {
            personaRiskLevel = 'low';
            personaRiskDescription = `${getPersonaLabel(expectedPersona)} criterion covered in section(s) where they review as secondary`;
          } else if (weight >= 0.3) {
            personaRiskLevel = 'high';
            personaRiskDescription = `High-weight ${getPersonaLabel(expectedPersona)} criterion covered only in ${coveringPersonas.map(getPersonaLabel).join('/')} sections`;
          } else {
            personaRiskLevel = 'medium';
            personaRiskDescription = `${getPersonaLabel(expectedPersona)} criterion framed for ${coveringPersonas.map(getPersonaLabel).join('/')} evaluators`;
          }

          notes.push(`Persona skew: ${personaRiskDescription}`);
        }
      }
    }

    criterionCoverages.push({
      criterionLabel: criterion.label,
      criterionIndex: i,
      weight,
      coveredBySectionKeys,
      coverageScore,
      proofCoverageScore,
      weightedScore,
      notes,
      missingSections,
      isRisk,
      // V4: Persona risk fields
      expectedPersona,
      coveringPersonas,
      hasPersonaMismatch,
      personaRiskLevel,
      personaRiskDescription,
    });
  }

  // Sort by priority: highest weight * lowest coverage first (most critical gaps at top)
  criterionCoverages.sort((a, b) => {
    // Primary sort: risk items first
    if (a.isRisk !== b.isRisk) {
      return a.isRisk ? -1 : 1;
    }
    // Secondary sort: higher weight, lower coverage = higher priority
    const aPriority = a.weight * (100 - a.coverageScore);
    const bPriority = b.weight * (100 - b.coverageScore);
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    // Tertiary: stable sort by original index
    return a.criterionIndex - b.criterionIndex;
  });

  // Compute section coverage
  const sectionCoverages: SectionCoverage[] = [];
  const highWeightThreshold = 0.25;

  for (const section of sections) {
    const criteriaTouched = sectionCriteriaMap.get(section.sectionKey) || [];

    // Find high-weight criteria that should be in this section but aren't
    const missingHighWeightCriteria: string[] = [];
    for (const criterion of strategy.evaluationCriteria) {
      const weight = criterion.weight ?? 0.5;
      if (weight >= highWeightThreshold) {
        const suggestedSections = getSuggestedSectionsForCriterion(criterion);
        if (suggestedSections.includes(section.sectionKey) && !criteriaTouched.includes(criterion.label)) {
          missingHighWeightCriteria.push(criterion.label);
        }
      }
    }

    const themesApplied = section.generatedUsing?.winThemesApplied || [];
    const proofApplied = section.generatedUsing?.proofItemsApplied || [];

    // Calculate section coverage score
    const suggestedCriteria = strategy.evaluationCriteria.filter(c => {
      const suggested = getSuggestedSectionsForCriterion(c);
      return suggested.includes(section.sectionKey);
    });

    const coverageScore = suggestedCriteria.length > 0
      ? Math.round((criteriaTouched.length / suggestedCriteria.length) * 100)
      : 100;

    const needsReview = missingHighWeightCriteria.length > 0 ||
                        (suggestedCriteria.length > 0 && coverageScore < 50);

    // V4: Get persona for this section
    const { primary: primaryPersona, secondary: secondaryPersonas } = getPersonaForSection(
      section.sectionKey as RfpSectionKey,
      personaSettings
    );

    sectionCoverages.push({
      sectionKey: section.sectionKey,
      sectionId: section.id,
      criteriaTouched,
      missingHighWeightCriteria,
      themesApplied,
      proofApplied,
      coverageScore,
      needsReview,
      // V4: Persona fields
      primaryPersona,
      secondaryPersonas,
    });
  }

  // Calculate overall health
  const totalWeight = criterionCoverages.reduce((sum, c) => sum + c.weight, 0);
  const weightedCoverageSum = criterionCoverages.reduce(
    (sum, c) => sum + (c.coverageScore * c.weight),
    0
  );
  const overallHealth = totalWeight > 0
    ? Math.round(weightedCoverageSum / totalWeight)
    : 100;

  // Count issues
  const uncoveredHighWeightCount = criterionCoverages.filter(
    c => c.weight >= highWeightThreshold && c.coverageScore === 0
  ).length;

  const sectionsNeedingReview = sectionCoverages.filter(s => s.needsReview).length;

  // V4: Count persona mismatches
  const personaMismatchCount = criterionCoverages.filter(
    c => c.hasPersonaMismatch && c.personaRiskLevel !== 'low'
  ).length;

  // Build summary notes
  const summaryNotes: string[] = [];
  if (uncoveredHighWeightCount > 0) {
    summaryNotes.push(`${uncoveredHighWeightCount} high-weight criteria uncovered`);
  }
  if (sectionsNeedingReview > 0) {
    summaryNotes.push(`${sectionsNeedingReview} sections need review`);
  }
  if (personaMismatchCount > 0) {
    summaryNotes.push(`${personaMismatchCount} criteria with persona skew`);
  }
  if (overallHealth < 50) {
    summaryNotes.push(`Coverage health is low - major gaps in criteria alignment`);
  } else if (overallHealth < 75) {
    summaryNotes.push(`Some criteria have coverage gaps`);
  }
  if (summaryNotes.length === 0) {
    summaryNotes.push(`Good coverage across evaluation criteria`);
  }

  return {
    criterionCoverage: criterionCoverages,
    sectionCoverage: sectionCoverages,
    overallHealth,
    uncoveredHighWeightCount,
    sectionsNeedingReview,
    summaryNotes,
    // V4: Persona risk tracking
    personaMismatchCount,
    hasPersonaSettings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get suggested sections for an uncovered criterion
 */
export function getSuggestedSectionsForReview(
  criterionLabel: string,
  strategy: RfpWinStrategy
): string[] {
  const criterion = strategy.evaluationCriteria.find(c => c.label === criterionLabel);
  if (!criterion) return [];
  return getSuggestedSectionsForCriterion(criterion);
}

/**
 * Get a short label for a section key
 */
export function getShortSectionLabel(sectionKey: string): string {
  const labels: Record<string, string> = {
    agency_overview: 'Overview',
    approach: 'Approach',
    team: 'Team',
    work_samples: 'Work',
    plan_timeline: 'Plan',
    pricing: 'Pricing',
    references: 'Refs',
  };
  return labels[sectionKey] || sectionKey;
}

/**
 * Get coverage status class for UI
 */
export function getCoverageStatusClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400';
  if (score >= 50) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
}

/**
 * Check if a criterion is covered by a specific section
 */
export function isCriterionCoveredBySection(
  criterionLabel: string,
  sectionKey: string,
  coverage: RubricCoverageResult
): boolean {
  const criterion = coverage.criterionCoverage.find(c => c.criterionLabel === criterionLabel);
  return criterion?.coveredBySectionKeys.includes(sectionKey) || false;
}
