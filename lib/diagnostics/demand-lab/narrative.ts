// lib/diagnostics/demand-lab/narrative.ts
// Demand Lab V2 Narrative Engine
//
// Generates strategist-style narrative summaries for demand generation analysis

import type {
  DemandLabDimension,
  DemandMaturityStage,
} from './types';

// ============================================================================
// Main Narrative Function
// ============================================================================

/**
 * Generate a concise strategist summary (2-3 sentences)
 * V2: Improved narrative with strengths/weaknesses and focus recommendation
 */
export function generateDemandNarrative(params: {
  dimensions: DemandLabDimension[];
  overallScore: number;
  maturityStage: DemandMaturityStage;
}): string {
  const { dimensions, overallScore, maturityStage } = params;

  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strengths = sorted.filter((d) => d.status === 'strong').map((d) => d.label);
  const weaknesses = sorted.filter((d) => d.status === 'weak').map((d) => d.label);

  const strengthText =
    strengths.length > 0 ? `Strengths include ${strengths.join(', ')}. ` : '';
  const weaknessText =
    weaknesses.length > 0 ? `Key weaknesses are in ${weaknesses.join(', ')}. ` : '';

  const focusText = weakest
    ? `Improving ${weakest.label.toLowerCase()} will unlock the biggest near-term gains.`
    : '';

  return [
    `Demand generation is currently at a ${maturityStage} stage with an overall score of ${overallScore}/100.`,
    strengthText + weaknessText + focusText,
  ]
    .join(' ')
    .trim();
}

// ============================================================================
// Extended Narrative Helpers
// ============================================================================

/**
 * Generate executive summary for the report
 */
export function generateExecutiveSummary(params: {
  dimensions: DemandLabDimension[];
  overallScore: number;
  maturityStage: DemandMaturityStage;
  companyType?: string | null;
}): string {
  const { dimensions, overallScore, maturityStage, companyType } = params;

  const strongDimensions = dimensions.filter((d) => d.status === 'strong');
  const weakDimensions = dimensions.filter((d) => d.status === 'weak');
  const totalIssues = dimensions.reduce((sum, d) => sum + d.issues.length, 0);
  const highSeverityIssues = dimensions.reduce(
    (sum, d) => sum + d.issues.filter((i) => i.severity === 'high').length,
    0
  );

  const paragraphs: string[] = [];

  // Overview paragraph
  const companyTypeText = companyType ? ` for a ${formatCompanyType(companyType)} business` : '';
  paragraphs.push(
    `This assessment evaluates demand generation capabilities${companyTypeText} across five key dimensions: ` +
      `channel mix, targeting, creative, funnel architecture, and measurement. ` +
      `With an overall score of ${overallScore}/100, the demand engine is currently at the "${maturityStage}" stage.`
  );

  // Findings paragraph
  if (strongDimensions.length > 0) {
    const strongAreas = strongDimensions.map((d) => d.label.toLowerCase()).join(', ');
    paragraphs.push(
      `Strengths were found in ${strongAreas}. ` +
        `${
          weakDimensions.length > 0
            ? `However, ${weakDimensions.length} dimension(s) need attention, with ${highSeverityIssues} high-priority issues identified.`
            : `The assessment identified ${totalIssues} total improvement opportunities across all areas.`
        }`
    );
  } else {
    paragraphs.push(
      `The assessment identified ${totalIssues} improvement opportunities, ` +
        `including ${highSeverityIssues} high-priority issues that should be addressed first. ` +
        `Building foundational capabilities will be essential for scaling demand generation.`
    );
  }

  // Recommendation paragraph
  const lowestDimension = [...dimensions].sort((a, b) => a.score - b.score)[0];
  if (lowestDimension) {
    paragraphs.push(
      `The primary opportunity lies in ${lowestDimension.label.toLowerCase()}, ` +
        `which scored ${lowestDimension.score}/100. Improvements here will have outsized impact on overall demand generation effectiveness.`
    );
  }

  return paragraphs.join('\n\n');
}

/**
 * Format company type for display
 */
function formatCompanyType(companyType: string): string {
  const mapping: Record<string, string> = {
    b2b_services: 'B2B services',
    local_service: 'local service',
    ecommerce: 'e-commerce',
    saas: 'SaaS',
    agency: 'agency',
    nonprofit: 'nonprofit',
    media: 'media',
    other: 'business',
  };
  return mapping[companyType] || companyType;
}

/**
 * Get dimension-specific recommendation text
 */
export function getDimensionRecommendation(dimensionKey: string): string {
  const recommendations: Record<string, string> = {
    channel_mix: 'Diversify traffic sources and test paid channels',
    targeting: 'Create targeted landing pages for key audiences',
    creative: 'Clarify CTAs and strengthen value propositions',
    funnel: 'Add lead capture forms and optimize conversion paths',
    measurement: 'Implement analytics and conversion tracking',
  };
  return recommendations[dimensionKey] || 'Address foundational gaps';
}
