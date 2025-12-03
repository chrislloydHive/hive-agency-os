// lib/diagnostics/ops-lab/narrative.ts
// Ops Lab Narrative Generator - Creates strategist-style summaries

import type {
  OpsLabDimension,
  OpsMaturityStage,
} from './types';
import { getDimensionLabel, getMaturityStageDescription } from './types';

// ============================================================================
// Types
// ============================================================================

export interface NarrativeInput {
  dimensions: OpsLabDimension[];
  overallScore: number;
  maturityStage: OpsMaturityStage;
}

// ============================================================================
// Main Narrative Generator
// ============================================================================

/**
 * Generate a strategist-style narrative summary for Ops Lab results
 */
export function generateOpsNarrative(input: NarrativeInput): string {
  const { dimensions, overallScore, maturityStage } = input;

  // Identify strengths and weaknesses
  const strengths = dimensions.filter((d) => d.status === 'strong');
  const weaknesses = dimensions.filter((d) => d.status === 'weak');
  const moderate = dimensions.filter((d) => d.status === 'moderate');

  // Build narrative
  const parts: string[] = [];

  // Opening with maturity assessment
  const maturityDesc = getMaturityStageDescription(maturityStage);
  if (maturityStage === 'established') {
    parts.push(
      `Marketing operations are well-developed with an overall score of ${overallScore}/100.`
    );
  } else if (maturityStage === 'scaling') {
    parts.push(
      `Marketing operations show strong foundations (${overallScore}/100) with ${maturityDesc.toLowerCase()}`
    );
  } else if (maturityStage === 'emerging') {
    parts.push(
      `Marketing operations are in an emerging state (${overallScore}/100). ${maturityDesc}`
    );
  } else {
    parts.push(
      `Marketing operations need foundational work (${overallScore}/100). ${maturityDesc}`
    );
  }

  // Highlight strengths
  if (strengths.length > 0) {
    const strengthNames = strengths.map((d) => getDimensionLabel(d.key).split(' & ')[0].toLowerCase());
    if (strengths.length === 1) {
      parts.push(`Strength in ${strengthNames[0]}.`);
    } else {
      parts.push(
        `Strengths include ${strengthNames.slice(0, -1).join(', ')} and ${strengthNames.slice(-1)}.`
      );
    }
  }

  // Highlight key gaps
  if (weaknesses.length > 0) {
    const weakestDim = weaknesses.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    const focusArea = getDimensionLabel(weakestDim.key).split(' & ')[0].toLowerCase();
    parts.push(`Priority focus: improving ${focusArea}.`);
  } else if (moderate.length > 0) {
    const lowestModerate = moderate.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    const focusArea = getDimensionLabel(lowestModerate.key).split(' & ')[0].toLowerCase();
    parts.push(`Opportunity to strengthen ${focusArea}.`);
  }

  return parts.join(' ');
}

/**
 * Generate dimension-specific recommendations
 */
export function getDimensionRecommendation(key: OpsLabDimension['key']): string {
  const recommendations: Record<OpsLabDimension['key'], string> = {
    tracking:
      'Ensure GA4 and GTM are properly configured with key conversion events defined. Add retargeting pixels for paid media efficiency.',
    data:
      'Standardize UTM naming conventions across all campaigns. Implement data governance practices for clean attribution.',
    crm:
      'Integrate CRM with marketing tools for end-to-end lead visibility. Ensure forms feed directly into pipeline stages.',
    automation:
      'Implement marketing automation for scalable lead nurturing. Create automated journeys for key lifecycle stages.',
    experimentation:
      'Deploy an experimentation platform for data-driven optimization. Start with landing page and CTA testing.',
  };

  return recommendations[key] || 'Focus on building foundational capabilities in this area.';
}

/**
 * Generate executive summary for longer reports
 */
export function generateExecutiveSummary(input: NarrativeInput): string {
  const { dimensions, overallScore, maturityStage } = input;

  const strengths = dimensions.filter((d) => d.status === 'strong');
  const weaknesses = dimensions.filter((d) => d.status === 'weak');

  let summary = '';

  // Maturity overview
  summary += `This company's marketing operations infrastructure is at a "${maturityStage}" maturity level with an overall readiness score of ${overallScore}/100. `;

  // Stack overview
  summary += `The analysis evaluated five key operational dimensions: tracking & instrumentation, data quality & governance, CRM & pipeline hygiene, automation & journeys, and experimentation & optimization. `;

  // Strengths
  if (strengths.length > 0) {
    const strengthList = strengths.map((d) => getDimensionLabel(d.key).toLowerCase()).join(', ');
    summary += `Areas of strength include ${strengthList}. `;
  }

  // Gaps
  if (weaknesses.length > 0) {
    const weakList = weaknesses.map((d) => getDimensionLabel(d.key).toLowerCase()).join(', ');
    summary += `Critical gaps exist in ${weakList}. `;
  }

  // Call to action
  if (maturityStage === 'unproven' || maturityStage === 'emerging') {
    summary +=
      'Priority should be given to establishing foundational tracking and data governance before investing in advanced automation or experimentation.';
  } else if (maturityStage === 'scaling') {
    summary +=
      'Focus on closing identified gaps while optimizing existing systems for efficiency and scale.';
  } else {
    summary +=
      'Continue to optimize and expand capabilities while maintaining operational excellence.';
  }

  return summary;
}
