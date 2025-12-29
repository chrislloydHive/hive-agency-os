// lib/os/rfp/assignSectionPersona.ts
// Heuristic-based section-to-persona assignment
// Allows automatic inference and manual override of evaluator personas per section

import type { RfpSectionKey } from '@/lib/types/rfp';
import type { RfpSection } from '@/lib/types/rfp';
import type { ParsedRequiredSection } from '@/lib/types/rfp';
import {
  type EvaluatorPersonaType,
  type SectionPersonaAssignment,
  type RfpPersonaSettings,
  DEFAULT_SECTION_PERSONAS,
  inferCriterionPersona,
} from '@/lib/types/rfpEvaluatorPersona';

// ============================================================================
// Heuristic Mappings
// ============================================================================

/**
 * Keywords in section titles that suggest specific personas
 */
const SECTION_TITLE_PERSONA_HINTS: Record<EvaluatorPersonaType, string[]> = {
  procurement: [
    'pricing', 'cost', 'investment', 'fees', 'budget', 'payment',
    'references', 'qualifications', 'insurance', 'compliance',
    'terms', 'conditions', 'warranty', 'contract', 'legal',
  ],
  technical: [
    'approach', 'methodology', 'technical', 'implementation', 'team',
    'process', 'quality', 'development', 'architecture', 'design',
    'tools', 'technology', 'testing', 'integration', 'timeline',
    'plan', 'milestones', 'deliverables', 'work samples', 'portfolio',
  ],
  executive: [
    'overview', 'executive summary', 'introduction', 'partnership',
    'vision', 'strategy', 'value', 'outcomes', 'why us', 'about us',
    'company', 'agency', 'firm', 'organization',
  ],
};

/**
 * Keywords in content that reinforce persona assignment
 */
const CONTENT_PERSONA_SIGNALS: Record<EvaluatorPersonaType, string[]> = {
  procurement: [
    'rate', 'hourly', 'fixed price', 'milestone payment', 'net 30',
    'sla', 'service level', 'penalty', 'indemnification',
  ],
  technical: [
    'agile', 'sprint', 'scrum', 'ci/cd', 'devops', 'api',
    'framework', 'stack', 'database', 'infrastructure',
  ],
  executive: [
    'roi', 'market share', 'competitive advantage', 'brand equity',
    'digital transformation', 'thought leadership',
  ],
};

// ============================================================================
// Inference Functions
// ============================================================================

/**
 * Infer the best persona for a section based on its key and title
 */
export function inferSectionPersona(
  sectionKey: RfpSectionKey,
  sectionTitle?: string
): { primary: EvaluatorPersonaType; secondary: EvaluatorPersonaType[]; confidence: 'high' | 'medium' | 'low' } {
  // Start with defaults for this section type
  const defaults = DEFAULT_SECTION_PERSONAS[sectionKey];
  if (!defaults) {
    return { primary: 'technical', secondary: [], confidence: 'low' };
  }

  // If no title to analyze, use defaults with high confidence
  if (!sectionTitle) {
    return { ...defaults, confidence: 'high' };
  }

  const titleLower = sectionTitle.toLowerCase();

  // Count hints for each persona
  const hintCounts: Record<EvaluatorPersonaType, number> = {
    procurement: 0,
    technical: 0,
    executive: 0,
  };

  for (const [persona, hints] of Object.entries(SECTION_TITLE_PERSONA_HINTS)) {
    for (const hint of hints) {
      if (titleLower.includes(hint)) {
        hintCounts[persona as EvaluatorPersonaType]++;
      }
    }
  }

  // Find the highest scoring persona
  const maxCount = Math.max(...Object.values(hintCounts));

  // If no hints matched, use defaults
  if (maxCount === 0) {
    return { ...defaults, confidence: 'high' };
  }

  // If hints point to a different persona than default
  const topPersonas = Object.entries(hintCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([persona]) => persona as EvaluatorPersonaType);

  if (topPersonas.length === 1) {
    const inferred = topPersonas[0];
    if (inferred === defaults.primary) {
      return { ...defaults, confidence: 'high' };
    }
    // Override default based on title hints
    const secondary = [defaults.primary, ...defaults.secondary.filter(p => p !== inferred)];
    return {
      primary: inferred,
      secondary: [...new Set(secondary)].slice(0, 2),
      confidence: maxCount >= 2 ? 'high' : 'medium',
    };
  }

  // Multiple personas tied - use default
  return { ...defaults, confidence: 'medium' };
}

/**
 * Infer persona from parsed RFP section requirements
 */
export function inferPersonaFromRequiredSection(
  section: ParsedRequiredSection
): EvaluatorPersonaType {
  const combined = `${section.title} ${section.description || ''}`.toLowerCase();

  const scores: Record<EvaluatorPersonaType, number> = {
    procurement: 0,
    technical: 0,
    executive: 0,
  };

  for (const [persona, hints] of Object.entries(SECTION_TITLE_PERSONA_HINTS)) {
    for (const hint of hints) {
      if (combined.includes(hint)) {
        scores[persona as EvaluatorPersonaType]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'technical'; // Default fallback

  const winners = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([persona]) => persona as EvaluatorPersonaType);

  // Prefer in order: technical > executive > procurement
  if (winners.includes('technical')) return 'technical';
  if (winners.includes('executive')) return 'executive';
  return 'procurement';
}

/**
 * Analyze content and reinforce or adjust persona assignment
 */
export function analyzeContentForPersona(
  content: string,
  currentPersona: EvaluatorPersonaType
): { reinforced: boolean; alternativePersona?: EvaluatorPersonaType } {
  const contentLower = content.toLowerCase();

  const signalCounts: Record<EvaluatorPersonaType, number> = {
    procurement: 0,
    technical: 0,
    executive: 0,
  };

  for (const [persona, signals] of Object.entries(CONTENT_PERSONA_SIGNALS)) {
    for (const signal of signals) {
      if (contentLower.includes(signal)) {
        signalCounts[persona as EvaluatorPersonaType]++;
      }
    }
  }

  const maxCount = Math.max(...Object.values(signalCounts));
  if (maxCount === 0) {
    return { reinforced: true }; // No signals either way
  }

  // Check if current persona has the most signals
  if (signalCounts[currentPersona] >= maxCount) {
    return { reinforced: true };
  }

  // Find the persona with most signals
  const topPersona = Object.entries(signalCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([persona]) => persona as EvaluatorPersonaType)[0];

  return {
    reinforced: false,
    alternativePersona: topPersona,
  };
}

// ============================================================================
// Assignment Management
// ============================================================================

/**
 * Get or create persona assignments for all sections
 */
export function getPersonaAssignments(
  sections: RfpSection[],
  existingSettings?: RfpPersonaSettings | null
): SectionPersonaAssignment[] {
  const assignments: SectionPersonaAssignment[] = [];
  const existingMap = new Map(
    (existingSettings?.sectionAssignments || []).map(a => [a.sectionKey, a])
  );

  for (const section of sections) {
    // Check for existing assignment
    const existing = existingMap.get(section.sectionKey);
    if (existing) {
      assignments.push(existing);
      continue;
    }

    // Infer assignment
    const inferred = inferSectionPersona(section.sectionKey, section.title);
    assignments.push({
      sectionKey: section.sectionKey,
      primaryPersona: inferred.primary,
      secondaryPersonas: inferred.secondary,
      isManualOverride: false,
    });
  }

  return assignments;
}

/**
 * Override the persona assignment for a section
 */
export function overridePersonaAssignment(
  settings: RfpPersonaSettings,
  sectionKey: string,
  primaryPersona: EvaluatorPersonaType,
  reason?: string
): RfpPersonaSettings {
  const existingIndex = settings.sectionAssignments.findIndex(
    a => a.sectionKey === sectionKey
  );

  const defaults = DEFAULT_SECTION_PERSONAS[sectionKey as RfpSectionKey];
  const secondary = defaults?.secondary.filter(p => p !== primaryPersona) || [];

  const newAssignment: SectionPersonaAssignment = {
    sectionKey,
    primaryPersona,
    secondaryPersonas: secondary,
    overrideReason: reason,
    isManualOverride: true,
  };

  const newAssignments = [...settings.sectionAssignments];
  if (existingIndex >= 0) {
    newAssignments[existingIndex] = newAssignment;
  } else {
    newAssignments.push(newAssignment);
  }

  return {
    ...settings,
    sectionAssignments: newAssignments,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reset a section's persona to the default
 */
export function resetPersonaToDefault(
  settings: RfpPersonaSettings,
  sectionKey: RfpSectionKey
): RfpPersonaSettings {
  const defaults = DEFAULT_SECTION_PERSONAS[sectionKey];
  if (!defaults) return settings;

  const existingIndex = settings.sectionAssignments.findIndex(
    a => a.sectionKey === sectionKey
  );

  const defaultAssignment: SectionPersonaAssignment = {
    sectionKey,
    primaryPersona: defaults.primary,
    secondaryPersonas: defaults.secondary,
    isManualOverride: false,
  };

  const newAssignments = [...settings.sectionAssignments];
  if (existingIndex >= 0) {
    newAssignments[existingIndex] = defaultAssignment;
  } else {
    newAssignments.push(defaultAssignment);
  }

  return {
    ...settings,
    sectionAssignments: newAssignments,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a summary of persona distribution across sections
 */
export function getPersonaDistribution(
  assignments: SectionPersonaAssignment[]
): Record<EvaluatorPersonaType, number> {
  const distribution: Record<EvaluatorPersonaType, number> = {
    procurement: 0,
    technical: 0,
    executive: 0,
  };

  for (const assignment of assignments) {
    distribution[assignment.primaryPersona]++;
  }

  return distribution;
}

/**
 * Check if a criterion is likely reviewed by a specific persona
 */
export function isCriterionReviewedByPersona(
  criterionLabel: string,
  persona: EvaluatorPersonaType
): boolean {
  const inferred = inferCriterionPersona(criterionLabel);
  return inferred === persona;
}

/**
 * Get sections that should address a criterion based on persona alignment
 */
export function getSuggestedSectionsForCriterionByPersona(
  criterionLabel: string,
  assignments: SectionPersonaAssignment[]
): string[] {
  const expectedPersona = inferCriterionPersona(criterionLabel);
  if (!expectedPersona) return [];

  // Find sections where this persona is primary or secondary
  return assignments
    .filter(a =>
      a.primaryPersona === expectedPersona ||
      a.secondaryPersonas.includes(expectedPersona)
    )
    .map(a => a.sectionKey);
}
