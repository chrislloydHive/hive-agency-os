// lib/diagnostics/content-lab/narrative.ts
// Content Lab Narrative Generator
//
// Generates consultant-style narrative summaries for Content Lab results.

import type {
  ContentLabDimension,
  ContentMaturityStage,
  ContentDimensionKey,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface NarrativeInput {
  dimensions: ContentLabDimension[];
  overallScore: number;
  maturityStage: ContentMaturityStage;
  articleCount?: number;
  recentArticlesCount?: number;
}

// ============================================================================
// Main Narrative Generator
// ============================================================================

/**
 * Generate narrative summary for Content Lab results
 */
export function generateContentNarrative(input: NarrativeInput): string {
  const { dimensions, overallScore, maturityStage, articleCount, recentArticlesCount } = input;

  // Categorize dimensions by status
  const strongDims = dimensions.filter(d => d.status === 'strong');
  const weakDims = dimensions.filter(d => d.status === 'weak');
  const moderateDims = dimensions.filter(d => d.status === 'moderate');

  // Find weakest dimension for focus recommendation
  // V2: Handle null scores - filter out not_evaluated dimensions
  const evaluatedDimensions = dimensions.filter(d => d.score !== null);
  const weakest = [...evaluatedDimensions].sort((a, b) => (a.score ?? 50) - (b.score ?? 50))[0];

  // Build narrative parts
  const parts: string[] = [];

  // Opening statement about current state
  parts.push(buildOpeningStatement(maturityStage, overallScore, articleCount));

  // Strengths (if any)
  if (strongDims.length > 0) {
    parts.push(buildStrengthsStatement(strongDims));
  }

  // Weaknesses/opportunities
  if (weakDims.length > 0) {
    parts.push(buildWeaknessStatement(weakDims, weakest));
  } else if (moderateDims.length > 0 && strongDims.length < 3) {
    parts.push(buildImprovementStatement(moderateDims));
  }

  // Closing recommendation
  parts.push(buildClosingRecommendation(weakest, maturityStage, articleCount, recentArticlesCount));

  return parts.join(' ');
}

// ============================================================================
// Statement Builders
// ============================================================================

function buildOpeningStatement(
  stage: ContentMaturityStage,
  score: number,
  articleCount?: number
): string {
  const stageDescriptions: Record<ContentMaturityStage, string> = {
    unproven: 'at an early stage with significant gaps',
    emerging: 'emerging with foundational elements in place',
    scaling: 'at a scaling stage with solid fundamentals',
    established: 'well-established with mature practices',
  };

  const stageDesc = stageDescriptions[stage];

  if (articleCount === 0) {
    return `Content performance is currently ${stageDesc}, with an overall score of ${score}/100. No blog or article content was detected, which limits organic reach and trust-building.`;
  }

  return `Content performance is currently ${stageDesc}, with an overall score of ${score}/100.`;
}

function buildStrengthsStatement(strongDims: ContentLabDimension[]): string {
  if (strongDims.length === 0) return '';

  const labels = strongDims.map(d => dimensionToNaturalName(d.key));

  if (labels.length === 1) {
    return `Strength lies in ${labels[0].toLowerCase()}.`;
  }

  const lastLabel = labels.pop();
  return `Strengths include ${labels.map(l => l.toLowerCase()).join(', ')} and ${lastLabel!.toLowerCase()}.`;
}

function buildWeaknessStatement(
  weakDims: ContentLabDimension[],
  weakest: ContentLabDimension
): string {
  if (weakDims.length === 0) return '';

  const labels = weakDims.map(d => dimensionToNaturalName(d.key));

  if (labels.length === 1) {
    return `The key weakness is in ${labels[0].toLowerCase()}.`;
  }

  const lastLabel = labels.pop();
  return `Key weaknesses are in ${labels.map(l => l.toLowerCase()).join(', ')} and ${lastLabel!.toLowerCase()}.`;
}

function buildImprovementStatement(moderateDims: ContentLabDimension[]): string {
  if (moderateDims.length === 0) return '';

  const label = dimensionToNaturalName(moderateDims[0].key);
  return `There's room for improvement in ${label.toLowerCase()}.`;
}

function buildClosingRecommendation(
  weakest: ContentLabDimension,
  stage: ContentMaturityStage,
  articleCount?: number,
  recentArticlesCount?: number
): string {
  // Special case: no content
  if (articleCount === 0) {
    return 'Starting a content program should be the immediate priority to establish thought leadership and capture organic search traffic.';
  }

  // Special case: stale content
  if (recentArticlesCount === 0 && (articleCount || 0) > 0) {
    return 'The most impactful action is resuming regular content publishing to signal freshness to both users and search engines.';
  }

  // Standard recommendation based on weakest dimension
  const recommendations: Record<ContentDimensionKey, string> = {
    inventory: 'Improving content inventory will unlock the fastest gains—aim to publish consistently and diversify content types.',
    quality: 'Improving content quality through better structure and clearer messaging will strengthen engagement and trust.',
    depth: 'Deepening topic coverage with guides, case studies, and comprehensive articles will establish authority.',
    freshness: 'Improving content freshness with regular publishing and updates will boost both SEO and user trust.',
    seoSignals: 'Improving content SEO through better keyword targeting and optimization will increase organic traffic.',
  };

  return recommendations[weakest.key] || 'Focus on consistently publishing quality content to build momentum.';
}

// ============================================================================
// Helpers
// ============================================================================

function dimensionToNaturalName(key: ContentDimensionKey): string {
  const names: Record<ContentDimensionKey, string> = {
    inventory: 'Content inventory',
    quality: 'Content quality',
    depth: 'Topic depth and coverage',
    freshness: 'Content freshness',
    seoSignals: 'Content-driven SEO',
  };
  return names[key] || key;
}
