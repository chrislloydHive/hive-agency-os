// lib/os/artifacts/analysis.ts
// Artifact analysis helpers for retrospectives and learning
//
// These functions answer questions about artifact impact:
// - Which artifacts were never attached to work?
// - Which artifacts were associated with completed work?
// - What artifact types correlate with completion?
//
// Note: These helpers are read-only analysis tools.
// They will be surfaced in Strategy/Plan retrospective views.

import type { Artifact, ArtifactType, ArtifactUsage } from '@/lib/types/artifact';
import { createDefaultUsage } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactAnalysisResult {
  /** Total artifacts analyzed */
  totalArtifacts: number;
  /** Artifacts never attached to any work */
  neverAttached: Artifact[];
  /** Artifacts attached but no completed work */
  attachedNotCompleted: Artifact[];
  /** Artifacts with completed work */
  withCompletedWork: Artifact[];
  /** Breakdown by type */
  byType: TypeAnalysis[];
  /** Overall impact score (0-100) */
  impactScore: number;
}

export interface TypeAnalysis {
  type: ArtifactType;
  typeLabel: string;
  total: number;
  neverAttached: number;
  attachedNotCompleted: number;
  withCompletedWork: number;
  completionRate: number; // 0-1
}

export interface StrategyArtifactAnalysis {
  strategyId: string;
  artifacts: ArtifactAnalysisResult;
  /** Artifacts that should have been used but weren't */
  underutilized: Artifact[];
  /** Recommendations based on analysis */
  recommendations: string[];
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze a set of artifacts for impact and usage patterns
 */
export function analyzeArtifacts(artifacts: Artifact[]): ArtifactAnalysisResult {
  const neverAttached: Artifact[] = [];
  const attachedNotCompleted: Artifact[] = [];
  const withCompletedWork: Artifact[] = [];

  // Categorize artifacts
  for (const artifact of artifacts) {
    const usage = artifact.usage ?? createDefaultUsage();

    if (usage.attachedWorkCount === 0 && usage.firstAttachedAt === null) {
      neverAttached.push(artifact);
    } else if (usage.completedWorkCount > 0) {
      withCompletedWork.push(artifact);
    } else {
      attachedNotCompleted.push(artifact);
    }
  }

  // Analyze by type
  const typeMap = new Map<ArtifactType, TypeAnalysis>();

  for (const artifact of artifacts) {
    const usage = artifact.usage ?? createDefaultUsage();

    if (!typeMap.has(artifact.type)) {
      typeMap.set(artifact.type, {
        type: artifact.type,
        typeLabel: getTypeLabel(artifact.type),
        total: 0,
        neverAttached: 0,
        attachedNotCompleted: 0,
        withCompletedWork: 0,
        completionRate: 0,
      });
    }

    const typeAnalysis = typeMap.get(artifact.type)!;
    typeAnalysis.total++;

    if (usage.attachedWorkCount === 0 && usage.firstAttachedAt === null) {
      typeAnalysis.neverAttached++;
    } else if (usage.completedWorkCount > 0) {
      typeAnalysis.withCompletedWork++;
    } else {
      typeAnalysis.attachedNotCompleted++;
    }
  }

  // Calculate completion rates
  for (const typeAnalysis of typeMap.values()) {
    const attached = typeAnalysis.total - typeAnalysis.neverAttached;
    typeAnalysis.completionRate = attached > 0
      ? typeAnalysis.withCompletedWork / attached
      : 0;
  }

  const byType = Array.from(typeMap.values()).sort((a, b) =>
    b.completionRate - a.completionRate
  );

  // Calculate impact score
  const impactScore = calculateImpactScore(artifacts);

  return {
    totalArtifacts: artifacts.length,
    neverAttached,
    attachedNotCompleted,
    withCompletedWork,
    byType,
    impactScore,
  };
}

/**
 * Analyze artifacts for a specific strategy
 */
export function analyzeStrategyArtifacts(
  strategyId: string,
  allArtifacts: Artifact[]
): StrategyArtifactAnalysis {
  // Filter artifacts from this strategy
  const strategyArtifacts = allArtifacts.filter(
    (a) => a.sourceStrategyId === strategyId
  );

  const analysis = analyzeArtifacts(strategyArtifacts);

  // Identify underutilized artifacts (final status but never attached)
  const underutilized = strategyArtifacts.filter((a) => {
    const usage = a.usage ?? createDefaultUsage();
    return a.status === 'final' && usage.attachedWorkCount === 0;
  });

  // Generate recommendations
  const recommendations = generateRecommendations(analysis, underutilized);

  return {
    strategyId,
    artifacts: analysis,
    underutilized,
    recommendations,
  };
}

/**
 * Get artifacts that were generated from a strategy but never used
 */
export function getUnusedStrategyArtifacts(
  strategyId: string,
  artifacts: Artifact[]
): Artifact[] {
  return artifacts.filter((a) => {
    if (a.sourceStrategyId !== strategyId) return false;
    const usage = a.usage ?? createDefaultUsage();
    return usage.attachedWorkCount === 0 && usage.firstAttachedAt === null;
  });
}

/**
 * Get artifacts that contributed to completed work
 */
export function getCompletedWorkArtifacts(
  artifacts: Artifact[]
): Artifact[] {
  return artifacts.filter((a) => {
    const usage = a.usage ?? createDefaultUsage();
    return usage.completedWorkCount > 0;
  });
}

/**
 * Get artifact types that correlate with completed work
 * Returns types ordered by completion rate
 */
export function getTypeCompletionCorrelation(
  artifacts: Artifact[]
): TypeAnalysis[] {
  const analysis = analyzeArtifacts(artifacts);
  return analysis.byType.filter((t) => t.total > 0);
}

/**
 * Calculate feedback summary for a set of artifacts
 */
export function calculateFeedbackSummary(artifacts: Artifact[]): {
  totalFeedback: number;
  helpfulCount: number;
  neutralCount: number;
  notHelpfulCount: number;
  helpfulRate: number;
} {
  let totalFeedback = 0;
  let helpfulCount = 0;
  let neutralCount = 0;
  let notHelpfulCount = 0;

  for (const artifact of artifacts) {
    const feedback = artifact.feedback ?? [];
    for (const entry of feedback) {
      totalFeedback++;
      switch (entry.rating) {
        case 'helpful':
          helpfulCount++;
          break;
        case 'neutral':
          neutralCount++;
          break;
        case 'not_helpful':
          notHelpfulCount++;
          break;
      }
    }
  }

  const helpfulRate = totalFeedback > 0 ? helpfulCount / totalFeedback : 0;

  return {
    totalFeedback,
    helpfulCount,
    neutralCount,
    notHelpfulCount,
    helpfulRate,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate an overall impact score (0-100)
 * Based on usage, completion, and feedback
 */
function calculateImpactScore(artifacts: Artifact[]): number {
  if (artifacts.length === 0) return 0;

  let usedCount = 0;
  let completedCount = 0;
  let helpfulFeedback = 0;
  let totalFeedback = 0;

  for (const artifact of artifacts) {
    const usage = artifact.usage ?? createDefaultUsage();

    if (usage.attachedWorkCount > 0) usedCount++;
    if (usage.completedWorkCount > 0) completedCount++;

    const feedback = artifact.feedback ?? [];
    for (const entry of feedback) {
      totalFeedback++;
      if (entry.rating === 'helpful') helpfulFeedback++;
    }
  }

  // Usage rate (40% weight)
  const usageRate = usedCount / artifacts.length;

  // Completion rate (40% weight)
  const completionRate = completedCount / Math.max(1, usedCount);

  // Feedback sentiment (20% weight)
  const feedbackRate = totalFeedback > 0 ? helpfulFeedback / totalFeedback : 0.5;

  const score = usageRate * 40 + completionRate * 40 + feedbackRate * 20;

  return Math.round(score);
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  analysis: ArtifactAnalysisResult,
  underutilized: Artifact[]
): string[] {
  const recommendations: string[] = [];

  // High number of unused artifacts
  if (analysis.neverAttached.length > analysis.totalArtifacts * 0.5) {
    recommendations.push(
      'Many artifacts were created but never used. Consider reviewing artifact generation strategy.'
    );
  }

  // Underutilized final artifacts
  if (underutilized.length > 0) {
    recommendations.push(
      `${underutilized.length} finalized artifact${underutilized.length === 1 ? ' was' : 's were'} never attached to work items.`
    );
  }

  // Low completion rate
  const attachedCount = analysis.totalArtifacts - analysis.neverAttached.length;
  if (attachedCount > 0 && analysis.withCompletedWork.length < attachedCount * 0.3) {
    recommendations.push(
      'Few artifacts are associated with completed work. Review work item completion practices.'
    );
  }

  // Type-specific insights
  for (const typeAnalysis of analysis.byType) {
    if (typeAnalysis.total >= 3 && typeAnalysis.completionRate === 0) {
      recommendations.push(
        `${typeAnalysis.typeLabel} artifacts have no completed work associations. Consider whether this type is effective.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Artifact usage patterns look healthy.');
  }

  return recommendations;
}

/**
 * Get human-readable type label
 */
function getTypeLabel(type: ArtifactType): string {
  const labels: Record<string, string> = {
    strategy_doc: 'Strategy Document',
    qbr_slides: 'QBR Slides',
    brief_doc: 'Brief Document',
    media_plan: 'Media Plan',
    rfp_response_doc: 'RFP Response',
    proposal_slides: 'Proposal Slides',
    pricing_sheet: 'Pricing Sheet',
    custom: 'Custom',
    creative_brief: 'Creative Brief',
    media_brief: 'Media Brief',
    content_brief: 'Content Brief',
    campaign_brief: 'Campaign Brief',
    seo_brief: 'SEO Brief',
    strategy_summary: 'Strategy Summary',
    stakeholder_summary: 'Stakeholder Summary',
    acquisition_plan_summary: 'Acquisition Plan Summary',
    execution_playbook: 'Execution Playbook',
    experiment_roadmap: 'Experiment Roadmap',
    channel_analysis: 'Channel Analysis',
    competitive_positioning: 'Competitive Positioning',
  };

  return labels[type] || type;
}
