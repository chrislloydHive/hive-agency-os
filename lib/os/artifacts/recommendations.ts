// lib/os/artifacts/recommendations.ts
// Artifact Recommendations - Smarter scoring for artifact type suggestions
//
// Provides scored recommendations based on:
// - Source type (strategy, plan:media, plan:content)
// - Existing artifacts (avoid duplicates)
// - Strategy completeness
// - Tactic channel presence

import type { ArtifactSourceType, ArtifactTypeDefinition } from './registry';
import { getArtifactTypesForSource, ARTIFACT_TYPES } from './registry';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export interface RecommendationContext {
  /** Source type for artifact generation */
  sourceType: ArtifactSourceType;
  /** Current strategy (optional for enhanced recommendations) */
  strategy?: CompanyStrategy | null;
  /** Existing artifacts (to avoid recommending duplicates) */
  existingArtifacts?: Artifact[];
  /** Detected tactic channels */
  tacticChannels?: {
    hasMediaTactics: boolean;
    hasContentTactics: boolean;
    hasSeoTactics: boolean;
    hasExperiments: boolean;
  };
}

export interface ScoredRecommendation {
  type: ArtifactTypeDefinition;
  score: number;
  reasons: string[];
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Scoring Constants
// ============================================================================

const SCORE_WEIGHTS = {
  // Source match
  SOURCE_MATCH: 10,

  // Tactic alignment
  TACTIC_ALIGNMENT: 8,

  // Strategy completeness signals
  HAS_GOAL_STATEMENT: 3,
  HAS_OBJECTIVES: 3,
  HAS_PILLARS: 2,

  // Novelty
  NOT_YET_GENERATED: 5,

  // Category priorities (some are more common starting points)
  CATEGORY_BRIEF: 2,
  CATEGORY_SUMMARY: 1,
  CATEGORY_PLAYBOOK: 0,
  CATEGORY_REPORT: 0,
};

// ============================================================================
// Main Recommendation Function
// ============================================================================

/**
 * Get scored artifact recommendations based on context
 */
export function getArtifactRecommendations(
  context: RecommendationContext
): ScoredRecommendation[] {
  const { sourceType, strategy, existingArtifacts = [], tacticChannels } = context;

  // Get types that support this source
  const availableTypes = getArtifactTypesForSource(sourceType);

  // Score each type
  const scored: ScoredRecommendation[] = availableTypes.map(type => {
    const { score, reasons } = calculateScore(type, context);
    return {
      type,
      score,
      reasons,
      priority: score >= 15 ? 'high' : score >= 10 ? 'medium' : 'low',
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Get top N recommendations (for UI display)
 */
export function getTopRecommendations(
  context: RecommendationContext,
  count: number = 3
): ArtifactTypeDefinition[] {
  const scored = getArtifactRecommendations(context);
  return scored.slice(0, count).map(r => r.type);
}

// ============================================================================
// Scoring Logic
// ============================================================================

function calculateScore(
  type: ArtifactTypeDefinition,
  context: RecommendationContext
): { score: number; reasons: string[] } {
  const { sourceType, strategy, existingArtifacts = [], tacticChannels } = context;
  let score = 0;
  const reasons: string[] = [];

  // Base: source support (already filtered, so this is guaranteed)
  score += SCORE_WEIGHTS.SOURCE_MATCH;
  reasons.push('Supports current source');

  // Tactic channel alignment
  if (tacticChannels) {
    const tacticScore = getTacticAlignmentScore(type.id, tacticChannels);
    if (tacticScore > 0) {
      score += tacticScore;
      reasons.push('Matches active channels');
    }
  }

  // Strategy completeness signals
  if (strategy) {
    if (strategy.goalStatement) {
      score += SCORE_WEIGHTS.HAS_GOAL_STATEMENT;
    }
    if (strategy.objectives && strategy.objectives.length > 0) {
      score += SCORE_WEIGHTS.HAS_OBJECTIVES;
    }
    if (strategy.pillars && strategy.pillars.some((p: StrategyPillar) => p.status === 'active')) {
      score += SCORE_WEIGHTS.HAS_PILLARS;
    }
  }

  // Novelty - prefer types not yet generated
  const existingOfType = existingArtifacts.filter(a => a.type === type.id);
  if (existingOfType.length === 0) {
    score += SCORE_WEIGHTS.NOT_YET_GENERATED;
    reasons.push('Not yet generated');
  }

  // Category bonus
  switch (type.category) {
    case 'brief':
      score += SCORE_WEIGHTS.CATEGORY_BRIEF;
      break;
    case 'summary':
      score += SCORE_WEIGHTS.CATEGORY_SUMMARY;
      break;
  }

  // Special case: strategy_summary is always useful as first artifact
  if (type.id === 'strategy_summary' && existingOfType.length === 0) {
    score += 3;
    reasons.push('Great starting point');
  }

  // Special case: creative_brief is universally useful
  if (type.id === 'creative_brief') {
    score += 2;
  }

  return { score, reasons };
}

function getTacticAlignmentScore(
  typeId: string,
  channels: RecommendationContext['tacticChannels']
): number {
  if (!channels) return 0;

  // Map artifact types to their relevant channels
  const typeChannelMap: Record<string, (keyof typeof channels)[]> = {
    media_brief: ['hasMediaTactics'],
    campaign_brief: ['hasMediaTactics', 'hasContentTactics'],
    content_brief: ['hasContentTactics'],
    seo_brief: ['hasSeoTactics', 'hasContentTactics'],
    experiment_roadmap: ['hasExperiments'],
    channel_analysis: ['hasMediaTactics'],
    acquisition_plan_summary: ['hasMediaTactics'],
  };

  const relevantChannels = typeChannelMap[typeId] || [];
  const matchCount = relevantChannels.filter(c => channels[c]).length;

  return matchCount * SCORE_WEIGHTS.TACTIC_ALIGNMENT;
}

// ============================================================================
// Legacy Compatibility - Keep existing function signature
// ============================================================================

/**
 * Get recommended artifact types (legacy interface for backwards compatibility)
 * @deprecated Use getTopRecommendations instead for scored results
 */
export function getRecommendedArtifactTypesLegacy(tacticChannels: {
  hasMediaTactics?: boolean;
  hasContentTactics?: boolean;
  hasSeoTactics?: boolean;
  hasExperiments?: boolean;
}): ArtifactTypeDefinition[] {
  return getTopRecommendations({
    sourceType: 'strategy',
    tacticChannels: {
      hasMediaTactics: tacticChannels.hasMediaTactics ?? false,
      hasContentTactics: tacticChannels.hasContentTactics ?? false,
      hasSeoTactics: tacticChannels.hasSeoTactics ?? false,
      hasExperiments: tacticChannels.hasExperiments ?? false,
    },
  }, 5);
}
