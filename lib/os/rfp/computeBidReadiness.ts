// lib/os/rfp/computeBidReadiness.ts
// Bid Readiness + Go/No-Go Intelligence for RFPs
//
// Computes a single readiness score and provides actionable Go/No-Go recommendations
// based on Firm Brain readiness, win strategy health, rubric coverage, proof coverage,
// and persona alignment.

import type { RfpSection, RfpSectionKey } from '@/lib/types/rfp';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';
import type { RfpPersonaSettings } from '@/lib/types/rfpEvaluatorPersona';
import type { FirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import type { StrategyHealth } from '@/lib/types/rfpWinStrategy';
import {
  computeRubricCoverage,
  type RubricCoverageResult,
  type CriterionCoverage,
  type SectionCoverage,
  getShortSectionLabel,
} from './computeRubricCoverage';
import {
  getBidReadinessConfig,
  type BidReadinessConfig,
  type BidReadinessWeights,
} from './bidReadinessConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Bid readiness recommendation levels
 */
export type BidRecommendation = 'go' | 'conditional' | 'no_go';

/**
 * A single actionable fix to improve bid readiness
 */
export interface BidReadinessFix {
  /** Section key to improve */
  sectionKey: string;
  /** Human-readable reason for the fix */
  reason: string;
  /** Expected score lift if fixed (0-100 points) */
  expectedLift: number;
  /** Effort level required */
  effort: 'low' | 'medium' | 'high';
  /** Priority rank (lower = more important) */
  priority: number;
}

/**
 * Risk factor identified in bid readiness assessment
 */
export interface BidRisk {
  /** Risk category */
  category: 'strategy' | 'coverage' | 'proof' | 'persona' | 'firm_brain';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description of the risk */
  description: string;
  /** How to mitigate this risk */
  mitigation?: string;
}

/**
 * Complete bid readiness assessment
 */
export interface BidReadiness {
  /** Overall readiness score (0-100) */
  score: number;
  /** Go/Conditional/No-Go recommendation */
  recommendation: BidRecommendation;
  /** Reasons supporting the recommendation */
  reasons: string[];
  /** Top risks to winning */
  topRisks: BidRisk[];
  /** Highest impact fixes to improve score */
  highestImpactFixes: BidReadinessFix[];
  /** Breakdown of component scores */
  breakdown: BidReadinessBreakdown;
  /** Whether we have enough data to make a reliable assessment */
  isReliableAssessment: boolean;
  /** If conditional, what conditions must be met */
  conditions?: string[];
}

/**
 * Breakdown of component scores contributing to bid readiness
 */
export interface BidReadinessBreakdown {
  /** Firm Brain readiness (0-100), weighted 25% */
  firmBrainReadiness: number;
  /** Win strategy health (0-100), weighted 20% */
  winStrategyHealth: number;
  /** Rubric coverage health (0-100), weighted 25% */
  rubricCoverageHealth: number;
  /** Proof coverage (0-100), weighted 15% */
  proofCoverage: number;
  /** Persona alignment (0-100, derived from mismatch count), weighted 15% */
  personaAlignment: number;
  /** Weights used for each component */
  weights: {
    firmBrain: number;
    strategy: number;
    coverage: number;
    proof: number;
    persona: number;
  };
}

/**
 * Inputs for bid readiness computation
 */
export interface BidReadinessInputs {
  /** Firm Brain readiness assessment */
  firmBrainReadiness: FirmBrainReadiness | null;
  /** Win strategy health assessment */
  strategyHealth: StrategyHealth | null;
  /** Rubric coverage result */
  rubricCoverage: RubricCoverageResult | null;
  /** Win strategy (for proof plan analysis) */
  strategy: RfpWinStrategy | null;
  /** RFP sections for analysis */
  sections: RfpSection[];
  /** Persona settings */
  personaSettings?: RfpPersonaSettings | null;
}

// ============================================================================
// Configuration (loaded from centralized config)
// ============================================================================

/**
 * Get current configuration
 * Uses centralized config from bidReadinessConfig.ts
 */
function getConfig(): BidReadinessConfig {
  return getBidReadinessConfig();
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

/**
 * Calculate persona alignment score from mismatch data
 * Higher mismatch count = lower alignment score
 */
function calculatePersonaAlignmentScore(
  rubricCoverage: RubricCoverageResult | null
): number {
  if (!rubricCoverage || !rubricCoverage.hasPersonaSettings) {
    // No persona data = assume neutral (75%)
    return 75;
  }

  const totalCriteria = rubricCoverage.criterionCoverage.length;
  if (totalCriteria === 0) return 100;

  const mismatchCount = rubricCoverage.personaMismatchCount;

  // Calculate weighted mismatch penalty
  // Consider severity of mismatches (high-weight criteria matter more)
  let weightedMismatchPenalty = 0;
  for (const criterion of rubricCoverage.criterionCoverage) {
    if (criterion.hasPersonaMismatch && criterion.personaRiskLevel !== 'none') {
      const weight = criterion.weight || 0.5;
      const severityMultiplier =
        criterion.personaRiskLevel === 'high' ? 1.5 :
        criterion.personaRiskLevel === 'medium' ? 1.0 : 0.5;
      weightedMismatchPenalty += weight * severityMultiplier;
    }
  }

  // Normalize penalty to 0-100 scale
  // Max penalty would be if all criteria had high-severity mismatches
  const maxPenalty = totalCriteria * 0.5 * 1.5; // Average weight * max multiplier
  const normalizedPenalty = Math.min(1, weightedMismatchPenalty / Math.max(maxPenalty, 1));

  return Math.round(100 * (1 - normalizedPenalty));
}

/**
 * Calculate proof coverage score across sections
 */
function calculateProofCoverageScore(
  rubricCoverage: RubricCoverageResult | null
): number {
  if (!rubricCoverage || rubricCoverage.criterionCoverage.length === 0) {
    return 0;
  }

  // Average proof coverage across all criteria
  const totalProofScore = rubricCoverage.criterionCoverage.reduce(
    (sum, c) => sum + c.proofCoverageScore,
    0
  );
  return Math.round(totalProofScore / rubricCoverage.criterionCoverage.length);
}

/**
 * Calculate the overall bid readiness score
 */
function calculateOverallScore(breakdown: BidReadinessBreakdown): number {
  const { weights } = breakdown;

  const weightedScore =
    (breakdown.firmBrainReadiness * weights.firmBrain) +
    (breakdown.winStrategyHealth * weights.strategy) +
    (breakdown.rubricCoverageHealth * weights.coverage) +
    (breakdown.proofCoverage * weights.proof) +
    (breakdown.personaAlignment * weights.persona);

  return Math.round(weightedScore);
}

// ============================================================================
// Risk Assessment Functions
// ============================================================================

/**
 * Identify risks based on component scores
 */
function identifyRisks(
  breakdown: BidReadinessBreakdown,
  inputs: BidReadinessInputs
): BidRisk[] {
  const risks: BidRisk[] = [];

  // Firm Brain risks
  if (breakdown.firmBrainReadiness < getConfig().riskThresholds.critical) {
    risks.push({
      category: 'firm_brain',
      severity: 'critical',
      description: 'Firm Brain data is severely incomplete - responses will be generic',
      mitigation: 'Add agency profile, team members, and case studies before proceeding',
    });
  } else if (breakdown.firmBrainReadiness < getConfig().riskThresholds.high) {
    risks.push({
      category: 'firm_brain',
      severity: 'high',
      description: 'Firm Brain data is incomplete - some sections may lack specificity',
      mitigation: 'Review and complete missing Firm Brain components',
    });
  } else if (breakdown.firmBrainReadiness < getConfig().riskThresholds.medium) {
    risks.push({
      category: 'firm_brain',
      severity: 'medium',
      description: 'Firm Brain could use improvement for stronger responses',
    });
  }

  // Strategy risks
  if (breakdown.winStrategyHealth < getConfig().riskThresholds.critical) {
    risks.push({
      category: 'strategy',
      severity: 'critical',
      description: 'No win strategy defined - responses will not be aligned to evaluation criteria',
      mitigation: 'Define evaluation criteria, win themes, and proof plan',
    });
  } else if (breakdown.winStrategyHealth < getConfig().riskThresholds.high) {
    risks.push({
      category: 'strategy',
      severity: 'high',
      description: 'Win strategy is incomplete - alignment with RFP requirements may be weak',
      mitigation: 'Complete all strategy components including criteria weights and proof plan',
    });
  }

  // Coverage risks
  if (breakdown.rubricCoverageHealth < getConfig().riskThresholds.critical) {
    risks.push({
      category: 'coverage',
      severity: 'critical',
      description: 'Evaluation criteria are not being addressed in sections',
      mitigation: 'Review and regenerate sections with win strategy enabled',
    });
  } else if (breakdown.rubricCoverageHealth < getConfig().riskThresholds.high) {
    risks.push({
      category: 'coverage',
      severity: 'high',
      description: 'Several evaluation criteria have coverage gaps',
      mitigation: 'Review sections flagged for missing criteria and regenerate',
    });
  }

  // Proof risks
  if (breakdown.proofCoverage < getConfig().riskThresholds.high) {
    risks.push({
      category: 'proof',
      severity: breakdown.proofCoverage < getConfig().riskThresholds.critical ? 'high' : 'medium',
      description: 'Proof points (case studies, references) are underutilized',
      mitigation: 'Add more proof items to the strategy and regenerate relevant sections',
    });
  }

  // Persona alignment risks
  if (breakdown.personaAlignment < getConfig().riskThresholds.high) {
    risks.push({
      category: 'persona',
      severity: 'high',
      description: 'Significant persona skew detected - content may not resonate with evaluators',
      mitigation: 'Review persona assignments and adjust section framing',
    });
  } else if (breakdown.personaAlignment < getConfig().riskThresholds.medium) {
    risks.push({
      category: 'persona',
      severity: 'medium',
      description: 'Some content framing may not match expected evaluator preferences',
    });
  }

  // Add specific high-weight uncovered criteria as risks
  if (inputs.rubricCoverage) {
    const uncoveredHighWeight = inputs.rubricCoverage.criterionCoverage.filter(
      c => c.weight >= 0.3 && c.coverageScore < 50
    );
    for (const criterion of uncoveredHighWeight.slice(0, 3)) {
      risks.push({
        category: 'coverage',
        severity: 'high',
        description: `High-weight criterion "${criterion.criterionLabel}" (${Math.round(criterion.weight * 100)}%) has only ${criterion.coverageScore}% coverage`,
        mitigation: `Review and strengthen ${criterion.missingSections.map(s => getShortSectionLabel(s)).join(', ')} section(s)`,
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks;
}

// ============================================================================
// Fix Recommendation Functions
// ============================================================================

/**
 * Identify highest-impact fixes to improve bid readiness
 */
function identifyHighestImpactFixes(
  breakdown: BidReadinessBreakdown,
  inputs: BidReadinessInputs
): BidReadinessFix[] {
  const fixes: BidReadinessFix[] = [];

  // Calculate potential lift for each component
  // Lift = (100 - currentScore) * weight
  const componentGaps = [
    {
      key: 'firmBrain',
      score: breakdown.firmBrainReadiness,
      weight: getConfig().weights.firmBrain,
      sectionKey: 'firm_brain',
      fixDescription: 'Complete Firm Brain profile, add team members and case studies',
      effort: 'high' as const,
    },
    {
      key: 'strategy',
      score: breakdown.winStrategyHealth,
      weight: getConfig().weights.strategy,
      sectionKey: 'strategy',
      fixDescription: 'Complete win strategy with criteria, themes, and proof plan',
      effort: 'medium' as const,
    },
  ];

  for (const gap of componentGaps) {
    if (gap.score < 80) {
      const potentialLift = Math.round((100 - gap.score) * gap.weight);
      if (potentialLift >= 5) {
        fixes.push({
          sectionKey: gap.sectionKey,
          reason: gap.fixDescription,
          expectedLift: potentialLift,
          effort: gap.effort,
          priority: potentialLift > 15 ? 1 : potentialLift > 10 ? 2 : 3,
        });
      }
    }
  }

  // Find sections with highest impact potential from rubric coverage
  if (inputs.rubricCoverage) {
    const sectionFixes = identifySectionFixes(inputs.rubricCoverage);
    fixes.push(...sectionFixes);
  }

  // Sort by priority (lower = more important), then by expected lift (higher = better)
  fixes.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.expectedLift - a.expectedLift;
  });

  // Return top 5 fixes
  return fixes.slice(0, 5);
}

/**
 * Identify section-level fixes from rubric coverage data
 */
function identifySectionFixes(rubricCoverage: RubricCoverageResult): BidReadinessFix[] {
  const fixes: BidReadinessFix[] = [];

  // Find sections that need review
  const sectionsNeedingWork = rubricCoverage.sectionCoverage.filter(
    s => s.needsReview || s.missingHighWeightCriteria.length > 0
  );

  for (const section of sectionsNeedingWork) {
    // Calculate potential lift based on missing criteria weight
    let potentialLift = 0;
    for (const criterionLabel of section.missingHighWeightCriteria) {
      const criterion = rubricCoverage.criterionCoverage.find(
        c => c.criterionLabel === criterionLabel
      );
      if (criterion) {
        potentialLift += (criterion.weight || 0.3) * 20; // Rough estimate
      }
    }
    potentialLift = Math.min(Math.round(potentialLift * getConfig().weights.coverage), 25);

    if (potentialLift >= 3) {
      const missingCount = section.missingHighWeightCriteria.length;
      fixes.push({
        sectionKey: section.sectionKey,
        reason: `Add coverage for ${missingCount} high-weight criteria in ${getShortSectionLabel(section.sectionKey)}`,
        expectedLift: potentialLift,
        effort: missingCount > 2 ? 'high' : missingCount > 1 ? 'medium' : 'low',
        priority: missingCount > 2 ? 1 : 2,
      });
    }
  }

  // Find persona skew fixes
  const personaSkewSections = new Set<string>();
  for (const criterion of rubricCoverage.criterionCoverage) {
    if (criterion.hasPersonaMismatch && criterion.personaRiskLevel === 'high') {
      criterion.coveredBySectionKeys.forEach(s => personaSkewSections.add(s));
    }
  }

  for (const sectionKey of personaSkewSections) {
    const potentialLift = Math.round(10 * getConfig().weights.persona);
    fixes.push({
      sectionKey,
      reason: `Adjust ${getShortSectionLabel(sectionKey)} framing to match evaluator expectations`,
      expectedLift: potentialLift,
      effort: 'low',
      priority: 3,
    });
  }

  return fixes;
}

// ============================================================================
// Recommendation Logic
// ============================================================================

/**
 * Determine the recommendation and reasons
 */
function determineRecommendation(
  score: number,
  breakdown: BidReadinessBreakdown,
  risks: BidRisk[]
): { recommendation: BidRecommendation; reasons: string[]; conditions?: string[] } {
  const reasons: string[] = [];
  const conditions: string[] = [];

  // Check for critical blockers that override score-based recommendation
  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const highRisks = risks.filter(r => r.severity === 'high');

  // Hard blockers
  if (breakdown.firmBrainReadiness < 20 && breakdown.winStrategyHealth < 20) {
    return {
      recommendation: 'no_go',
      reasons: [
        'Both Firm Brain and Win Strategy are critically incomplete',
        'Responses would be generic and uncompetitive',
        'Recommend completing foundational data before bidding',
      ],
    };
  }

  // Score-based recommendation with adjustments
  if (score >= getConfig().thresholds.go) {
    // High score - but check for any critical issues
    if (criticalRisks.length > 0) {
      return {
        recommendation: 'conditional',
        reasons: [
          `Overall readiness score is ${score}%, but critical issues remain`,
          ...criticalRisks.slice(0, 2).map(r => r.description),
        ],
        conditions: criticalRisks.map(r => r.mitigation).filter(Boolean) as string[],
      };
    }

    reasons.push(`Overall readiness score is ${score}% - ready to proceed`);
    if (breakdown.winStrategyHealth >= 70) {
      reasons.push('Win strategy is well-defined');
    }
    if (breakdown.rubricCoverageHealth >= 70) {
      reasons.push('Good coverage across evaluation criteria');
    }
    if (breakdown.firmBrainReadiness >= 70) {
      reasons.push('Strong foundation data in Firm Brain');
    }

    return { recommendation: 'go', reasons };
  }

  if (score >= getConfig().thresholds.conditionalMin) {
    reasons.push(`Overall readiness score is ${score}% - proceed with caution`);

    // Add top improvement suggestions as conditions
    if (breakdown.firmBrainReadiness < 60) {
      conditions.push('Strengthen Firm Brain data (currently at ' + breakdown.firmBrainReadiness + '%)');
    }
    if (breakdown.winStrategyHealth < 60) {
      conditions.push('Complete win strategy (currently at ' + breakdown.winStrategyHealth + '%)');
    }
    if (breakdown.rubricCoverageHealth < 60) {
      conditions.push('Improve section coverage (currently at ' + breakdown.rubricCoverageHealth + '%)');
    }
    if (breakdown.personaAlignment < 60) {
      conditions.push('Address persona skew in sections');
    }

    // Add risk context
    if (highRisks.length > 0) {
      reasons.push(`${highRisks.length} high-priority risk(s) identified`);
    }

    return {
      recommendation: 'conditional',
      reasons,
      conditions: conditions.length > 0 ? conditions : undefined,
    };
  }

  // Below conditional threshold = NO GO
  reasons.push(`Overall readiness score is ${score}% - not ready to proceed`);

  if (criticalRisks.length > 0) {
    reasons.push(`${criticalRisks.length} critical issue(s) must be resolved`);
  }
  if (highRisks.length > 0) {
    reasons.push(`${highRisks.length} high-priority risk(s) present`);
  }

  // Provide specific blockers
  if (breakdown.firmBrainReadiness < 40) {
    reasons.push('Firm Brain data is too incomplete for competitive response');
  }
  if (breakdown.winStrategyHealth < 40) {
    reasons.push('Win strategy needs significant improvement');
  }

  return { recommendation: 'no_go', reasons };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Compute comprehensive bid readiness assessment
 *
 * @param inputs - All inputs needed for bid readiness calculation
 * @returns Complete bid readiness assessment with recommendations
 */
export function computeBidReadiness(inputs: BidReadinessInputs): BidReadiness {
  // Calculate component scores
  const firmBrainScore = inputs.firmBrainReadiness?.score ?? 0;
  const strategyScore = inputs.strategyHealth?.completenessScore ?? 0;
  const rubricScore = inputs.rubricCoverage?.overallHealth ?? 0;
  const proofScore = calculateProofCoverageScore(inputs.rubricCoverage);
  const personaScore = calculatePersonaAlignmentScore(inputs.rubricCoverage);

  // Build breakdown
  const breakdown: BidReadinessBreakdown = {
    firmBrainReadiness: firmBrainScore,
    winStrategyHealth: strategyScore,
    rubricCoverageHealth: rubricScore,
    proofCoverage: proofScore,
    personaAlignment: personaScore,
    weights: getConfig().weights,
  };

  // Calculate overall score
  const score = calculateOverallScore(breakdown);

  // Identify risks
  const risks = identifyRisks(breakdown, inputs);

  // Identify fixes
  const fixes = identifyHighestImpactFixes(breakdown, inputs);

  // Determine recommendation
  const { recommendation, reasons, conditions } = determineRecommendation(
    score,
    breakdown,
    risks
  );

  // Determine if we have enough data for reliable assessment
  const isReliableAssessment =
    inputs.firmBrainReadiness !== null &&
    inputs.strategyHealth !== null &&
    inputs.rubricCoverage !== null;

  return {
    score,
    recommendation,
    reasons,
    topRisks: risks.slice(0, 5),
    highestImpactFixes: fixes,
    breakdown,
    isReliableAssessment,
    conditions,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if bid is ready to proceed
 */
export function isBidReady(inputs: BidReadinessInputs): boolean {
  const readiness = computeBidReadiness(inputs);
  return readiness.recommendation === 'go';
}

/**
 * Get recommendation label for UI display
 */
export function getRecommendationLabel(recommendation: BidRecommendation): string {
  switch (recommendation) {
    case 'go': return 'Go';
    case 'conditional': return 'Conditional Go';
    case 'no_go': return 'No-Go';
  }
}

/**
 * Get recommendation color class for UI
 */
export function getRecommendationColorClass(recommendation: BidRecommendation): string {
  switch (recommendation) {
    case 'go': return 'text-emerald-400';
    case 'conditional': return 'text-amber-400';
    case 'no_go': return 'text-red-400';
  }
}

/**
 * Get recommendation background class for UI
 */
export function getRecommendationBgClass(recommendation: BidRecommendation): string {
  switch (recommendation) {
    case 'go': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'conditional': return 'bg-amber-500/10 border-amber-500/20';
    case 'no_go': return 'bg-red-500/10 border-red-500/20';
  }
}

/**
 * Get effort label for UI
 */
export function getEffortLabel(effort: BidReadinessFix['effort']): string {
  switch (effort) {
    case 'low': return '~30 min';
    case 'medium': return '~2 hrs';
    case 'high': return '~1 day';
  }
}

/**
 * Get bid readiness summary for display
 */
export function getBidReadinessSummary(readiness: BidReadiness): string {
  const { score, recommendation } = readiness;

  switch (recommendation) {
    case 'go':
      return `Bid readiness is ${score}%. Ready to proceed with high confidence.`;
    case 'conditional':
      return `Bid readiness is ${score}%. Can proceed, but address ${readiness.topRisks.length} risk(s) for best results.`;
    case 'no_go':
      return `Bid readiness is ${score}%. Not recommended to proceed without significant improvements.`;
  }
}
