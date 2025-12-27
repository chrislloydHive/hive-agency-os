// lib/os/ai/sectionConfidence.ts
// Section Confidence Scoring for RFP/Proposal Sections
// Helps guide human review by showing trust level in AI-generated content

export type SectionConfidence = 'high' | 'medium' | 'low';

export interface ConfidenceFactors {
  /** Firm Brain readiness score (0-100) */
  firmBrainReadiness: number;
  /** Number of Firm Brain inputs used in generation (0-6) */
  inputsUsedCount: number;
  /** Whether content was human-edited after generation */
  isHumanEdited: boolean;
  /** Whether content was pulled from section library */
  isFromLibrary: boolean;
  /** Whether library content came from a won deal */
  fromWonDeal: boolean;
}

export interface ConfidenceResult {
  confidence: SectionConfidence;
  score: number; // 0-100
  factors: ConfidenceFactors;
  reasons: string[];
}

/**
 * Calculate section confidence based on various factors
 *
 * Scoring rules:
 * - High: Human edited OR from won deal OR (FB readiness ≥80 AND inputs ≥4)
 * - Medium: FB readiness ≥50 AND inputs ≥2
 * - Low: Everything else
 */
export function calculateSectionConfidence(factors: ConfidenceFactors): ConfidenceResult {
  const reasons: string[] = [];
  let score = 0;

  // Human-edited content gets automatic high confidence
  if (factors.isHumanEdited) {
    reasons.push('Human-reviewed and edited');
    return {
      confidence: 'high',
      score: 100,
      factors,
      reasons,
    };
  }

  // Content from won deals gets high confidence
  if (factors.fromWonDeal) {
    reasons.push('From won deal content');
    return {
      confidence: 'high',
      score: 95,
      factors,
      reasons,
    };
  }

  // Content from library (not won deal) gets medium+ confidence
  if (factors.isFromLibrary) {
    reasons.push('From section library');
    score += 30;
  }

  // Score based on Firm Brain readiness
  if (factors.firmBrainReadiness >= 80) {
    reasons.push('Firm Brain fully configured');
    score += 40;
  } else if (factors.firmBrainReadiness >= 50) {
    reasons.push('Firm Brain partially configured');
    score += 20;
  } else {
    reasons.push('Firm Brain needs more data');
  }

  // Score based on inputs used
  if (factors.inputsUsedCount >= 4) {
    reasons.push(`${factors.inputsUsedCount} Firm Brain inputs used`);
    score += 30;
  } else if (factors.inputsUsedCount >= 2) {
    reasons.push(`${factors.inputsUsedCount} Firm Brain inputs used`);
    score += 15;
  } else if (factors.inputsUsedCount >= 1) {
    reasons.push('Limited Firm Brain inputs');
    score += 5;
  } else {
    reasons.push('No Firm Brain inputs used');
  }

  // Calculate final confidence level
  let confidence: SectionConfidence;
  if (score >= 70) {
    confidence = 'high';
  } else if (score >= 40) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    confidence,
    score: Math.min(100, score),
    factors,
    reasons,
  };
}

/**
 * Get confidence display properties for UI
 */
export function getConfidenceDisplay(confidence: SectionConfidence): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'check' | 'minus' | 'alert';
} {
  switch (confidence) {
    case 'high':
      return {
        label: 'High confidence',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        icon: 'check',
      };
    case 'medium':
      return {
        label: 'Review recommended',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: 'minus',
      };
    case 'low':
      return {
        label: 'Needs attention',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: 'alert',
      };
  }
}

/**
 * Count how many Firm Brain inputs were used in generation
 */
export function countInputsUsed(generatedUsing?: Record<string, boolean>): number {
  if (!generatedUsing) return 0;

  const inputKeys = [
    'agencyProfile',
    'teamMembers',
    'caseStudies',
    'references',
    'pricingTemplate',
    'planTemplate',
  ];

  return inputKeys.filter(key => generatedUsing[key]).length;
}

/**
 * Calculate confidence for an RFP section based on its metadata
 */
export function calculateRfpSectionConfidence(section: {
  generatedUsing?: Record<string, boolean>;
  sourceType?: string;
  sourceLibrarySectionId?: string;
  sourceLibraryOutcome?: 'won' | 'lost' | null;
  status?: string;
}, firmBrainReadiness: number): ConfidenceResult {
  const factors: ConfidenceFactors = {
    firmBrainReadiness,
    inputsUsedCount: countInputsUsed(section.generatedUsing),
    isHumanEdited: section.status === 'approved', // Approved means human reviewed
    isFromLibrary: !!section.sourceLibrarySectionId,
    fromWonDeal: section.sourceLibraryOutcome === 'won',
  };

  return calculateSectionConfidence(factors);
}
