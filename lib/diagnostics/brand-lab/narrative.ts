// lib/diagnostics/brand-lab/narrative.ts
// Brand Lab V2 Narrative Generator
//
// Generates consultant-style narrative summaries for Brand Lab results.

import type { BrandLabDimension, BrandMaturityStage, BrandDimensionKey } from './types';

// ============================================================================
// Types
// ============================================================================

export interface NarrativeInput {
  dimensions: BrandLabDimension[];
  overallScore: number;
  maturityStage: BrandMaturityStage;
  benchmarkLabel?: string;
  summary?: string; // V1 summary for context
}

// ============================================================================
// Main Narrative Generator
// ============================================================================

/**
 * Generate narrative summary for Brand Lab results
 */
export function generateBrandNarrative(input: NarrativeInput): string {
  const { dimensions, overallScore, maturityStage, benchmarkLabel, summary } = input;

  // Categorize dimensions by status
  const strongDims = dimensions.filter((d) => d.status === 'strong');
  const weakDims = dimensions.filter((d) => d.status === 'weak');
  const moderateDims = dimensions.filter((d) => d.status === 'moderate');

  // Find weakest dimension for focus recommendation
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];

  // Build narrative parts
  const parts: string[] = [];

  // Opening statement about current state
  parts.push(buildOpeningStatement(maturityStage, overallScore, benchmarkLabel));

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
  parts.push(buildClosingRecommendation(weakest, maturityStage));

  return parts.join(' ');
}

// ============================================================================
// Statement Builders
// ============================================================================

function buildOpeningStatement(
  stage: BrandMaturityStage,
  score: number,
  benchmarkLabel?: string
): string {
  const stageDescriptions: Record<BrandMaturityStage, string> = {
    unproven: 'at an early stage with significant gaps in clarity and consistency',
    emerging: 'emerging with foundational elements in place',
    scaling: 'at a scaling stage with solid brand fundamentals',
    established: 'well-established with mature brand practices',
  };

  const stageDesc = stageDescriptions[stage];
  const benchmarkText = benchmarkLabel ? ` (${benchmarkLabel.toUpperCase()})` : '';

  return `Brand performance is currently ${stageDesc}, with an overall score of ${score}/100${benchmarkText}.`;
}

function buildStrengthsStatement(strongDims: BrandLabDimension[]): string {
  if (strongDims.length === 0) return '';

  const labels = strongDims.map((d) => dimensionToNaturalName(d.key));

  if (labels.length === 1) {
    return `Strength lies in ${labels[0].toLowerCase()}.`;
  }

  const lastLabel = labels.pop();
  return `Strengths include ${labels.map((l) => l.toLowerCase()).join(', ')} and ${lastLabel!.toLowerCase()}.`;
}

function buildWeaknessStatement(
  weakDims: BrandLabDimension[],
  weakest: BrandLabDimension
): string {
  if (weakDims.length === 0) return '';

  const labels = weakDims.map((d) => dimensionToNaturalName(d.key));

  if (labels.length === 1) {
    return `The key weakness is in ${labels[0].toLowerCase()}.`;
  }

  const lastLabel = labels.pop();
  return `Key weaknesses are in ${labels.map((l) => l.toLowerCase()).join(', ')} and ${lastLabel!.toLowerCase()}.`;
}

function buildImprovementStatement(moderateDims: BrandLabDimension[]): string {
  if (moderateDims.length === 0) return '';

  const label = dimensionToNaturalName(moderateDims[0].key);
  return `There's room for improvement in ${label.toLowerCase()}.`;
}

function buildClosingRecommendation(
  weakest: BrandLabDimension,
  stage: BrandMaturityStage
): string {
  // Recommendations based on weakest dimension
  const recommendations: Record<BrandDimensionKey, string> = {
    identity:
      'Clarifying the core brand identity and promise should be the immediate priority to establish a strong foundation.',
    messaging:
      'Improving messaging clarity and value propositions will strengthen visitor understanding and conversion.',
    positioning:
      'Sharpening brand positioning and differentiation will help stand out in the competitive landscape.',
    audienceFit:
      'Better aligning brand messaging to the target audience will improve resonance and engagement.',
    trust:
      'Building trust through social proof, testimonials, and human presence will reduce buyer hesitation.',
    visual:
      'Strengthening the visual brand system will improve recognition and professional perception.',
    assets:
      'Documenting brand guidelines and building an asset library will ensure consistency as the brand scales.',
    consistency:
      'Addressing brand inconsistencies will create a more cohesive and trustworthy brand experience.',
  };

  return recommendations[weakest.key] || 'Focus on addressing the key weaknesses to strengthen overall brand health.';
}

// ============================================================================
// Helpers
// ============================================================================

function dimensionToNaturalName(key: BrandDimensionKey): string {
  const names: Record<BrandDimensionKey, string> = {
    identity: 'Brand identity',
    messaging: 'Messaging clarity',
    positioning: 'Market positioning',
    audienceFit: 'Audience alignment',
    trust: 'Trust and credibility',
    visual: 'Visual brand system',
    assets: 'Brand assets',
    consistency: 'Brand consistency',
  };
  return names[key] || key;
}
