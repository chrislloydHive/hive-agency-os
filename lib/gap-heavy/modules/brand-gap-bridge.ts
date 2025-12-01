// lib/gap-heavy/modules/brand-gap-bridge.ts
// Brand Lab → GAP Integration Bridge
//
// Maps Brand Lab results to a structured context for GAP Engine consumption.
// GAP Plan and GAP Full Report should use this instead of re-analyzing brand from scratch.

import type {
  BrandDiagnosticResult,
  BrandActionPlan,
  BrandForGap,
  BrandWorkItem,
} from './brandLab';

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

export interface MapBrandLabToGapInput {
  diagnostic: BrandDiagnosticResult;
  actionPlan: BrandActionPlan;
}

/**
 * Map Brand Lab results to a structured context for GAP Engine.
 *
 * This function converts detailed Brand Lab output into a compact,
 * consumption-ready format that GAP can inject into its prompts.
 *
 * @param input - Brand Lab diagnostic and action plan
 * @returns BrandForGap - Compact brand context for GAP
 */
export function mapBrandLabToGapContext(input: MapBrandLabToGapInput): BrandForGap {
  const { diagnostic, actionPlan } = input;

  console.log('[Brand-GAP Bridge] Mapping Brand Lab results to GAP context');

  // Extract core promise and tagline from identity system
  const corePromise = diagnostic.identitySystem.corePromise || null;
  const tagline = diagnostic.identitySystem.tagline || null;

  // Get positioning theme
  const positioningTheme = diagnostic.positioning.positioningTheme || 'Unknown';

  // Build ICP summary from audience fit
  const icpSummary = buildIcpSummary(diagnostic);

  // Extract key brand strengths
  const keyBrandStrengths = extractBrandStrengths(diagnostic);

  // Extract key brand weaknesses
  const keyBrandWeaknesses = extractBrandWeaknesses(diagnostic);

  // Extract top brand risks
  const topBrandRisks = extractTopRisks(diagnostic);

  // Extract recommended work items from NOW bucket
  const recommendedBrandWorkItems = extractRecommendedWorkItems(actionPlan);

  return {
    brandScore: diagnostic.score,
    benchmarkLabel: diagnostic.benchmarkLabel,
    corePromise,
    tagline,
    positioningTheme,
    icpSummary,
    keyBrandStrengths,
    keyBrandWeaknesses,
    topBrandRisks,
    recommendedBrandWorkItems,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildIcpSummary(diagnostic: BrandDiagnosticResult): string {
  const { audienceFit } = diagnostic;

  let summary = audienceFit.primaryICPDescription || 'ICP not clearly defined';

  // Add alignment context
  if (audienceFit.alignmentScore < 50) {
    summary += ` (poor alignment: ${audienceFit.alignmentScore}/100)`;
  } else if (audienceFit.alignmentScore >= 70) {
    summary += ` (good alignment: ${audienceFit.alignmentScore}/100)`;
  }

  // Add ICP signals if available
  if (audienceFit.icpSignals && audienceFit.icpSignals.length > 0) {
    const signals = audienceFit.icpSignals.slice(0, 3).join(', ');
    summary += `. Key signals: ${signals}`;
  }

  return summary;
}

function extractBrandStrengths(diagnostic: BrandDiagnosticResult): string[] {
  const strengths: string[] = [];

  // Check identity system
  if (diagnostic.identitySystem.corePromiseClarityScore >= 70) {
    strengths.push('Clear core promise');
  }
  if (diagnostic.identitySystem.toneConsistencyScore >= 70) {
    strengths.push(`Consistent tone of voice (${diagnostic.identitySystem.toneOfVoice})`);
  }

  // Check messaging
  if (diagnostic.messagingSystem.messagingFocusScore >= 70) {
    strengths.push('Focused messaging');
  }
  if (diagnostic.messagingSystem.icpClarityScore >= 70) {
    strengths.push('Clear ICP targeting');
  }

  // Check positioning
  if (diagnostic.positioning.positioningClarityScore >= 70) {
    strengths.push(`Clear positioning: ${diagnostic.positioning.competitiveAngle}`);
  }

  // Check trust
  if (diagnostic.trustAndProof.trustSignalsScore >= 70) {
    strengths.push('Strong trust signals');
  }
  if (diagnostic.trustAndProof.humanPresenceScore >= 70) {
    strengths.push('Strong human presence');
  }

  // Check visual
  if (diagnostic.visualSystem.visualConsistencyScore >= 70) {
    strengths.push('Consistent visual brand');
  }
  if (diagnostic.visualSystem.brandRecognitionScore >= 70) {
    strengths.push('Memorable visual identity');
  }

  // Check brand pillars for explicit strengths
  const strongPillars = diagnostic.brandPillars
    .filter(p => p.strengthScore >= 70 && p.isExplicit)
    .slice(0, 2)
    .map(p => p.name);

  strengths.push(...strongPillars);

  // Check differentiators
  if (diagnostic.messagingSystem.differentiators?.length > 0) {
    const topDiff = diagnostic.messagingSystem.differentiators[0];
    strengths.push(`Differentiator: ${topDiff}`);
  }

  return strengths.slice(0, 6); // Limit to 6 strengths
}

function extractBrandWeaknesses(diagnostic: BrandDiagnosticResult): string[] {
  const weaknesses: string[] = [];

  // Check identity gaps
  if (diagnostic.identitySystem.identityGaps?.length > 0) {
    weaknesses.push(...diagnostic.identitySystem.identityGaps.slice(0, 2));
  }

  // Check messaging clarity issues
  if (diagnostic.messagingSystem.clarityIssues?.length > 0) {
    weaknesses.push(...diagnostic.messagingSystem.clarityIssues.slice(0, 2));
  }

  // Check positioning risks
  if (diagnostic.positioning.positioningRisks?.length > 0) {
    weaknesses.push(...diagnostic.positioning.positioningRisks.slice(0, 2));
  }

  // Check credibility gaps
  if (diagnostic.trustAndProof.credibilityGaps?.length > 0) {
    weaknesses.push(...diagnostic.trustAndProof.credibilityGaps.slice(0, 2));
  }

  // Check visual gaps
  if (diagnostic.visualSystem.visualGaps?.length > 0) {
    weaknesses.push(...diagnostic.visualSystem.visualGaps.slice(0, 2));
  }

  // Check audience misalignment
  if (diagnostic.audienceFit.misalignmentNotes?.length > 0) {
    weaknesses.push(...diagnostic.audienceFit.misalignmentNotes.slice(0, 1));
  }

  // Low score areas
  if (diagnostic.identitySystem.corePromiseClarityScore < 50) {
    weaknesses.push('Unclear core promise');
  }
  if (diagnostic.messagingSystem.messagingFocusScore < 50) {
    weaknesses.push('Scattered messaging');
  }
  if (diagnostic.positioning.positioningClarityScore < 50) {
    weaknesses.push('Unclear positioning');
  }

  // Deduplicate and limit
  const unique = [...new Set(weaknesses)];
  return unique.slice(0, 6);
}

function extractTopRisks(diagnostic: BrandDiagnosticResult): string[] {
  // Start with explicit risks from diagnostic
  const risks: string[] = diagnostic.risks
    ?.sort((a, b) => b.severity - a.severity)
    .slice(0, 4)
    .map(r => `${r.riskType}: ${r.description}`) || [];

  // Add high-severity inconsistencies as risks
  const highInconsistencies = diagnostic.inconsistencies
    ?.filter(i => i.severity === 'high')
    .slice(0, 2)
    .map(i => `Inconsistency on ${i.location}: ${i.description}`);

  if (highInconsistencies) {
    risks.push(...highInconsistencies);
  }

  return risks.slice(0, 5);
}

function extractRecommendedWorkItems(actionPlan: BrandActionPlan): string[] {
  // Get NOW bucket items, prioritized by impact
  const nowItems = actionPlan.now
    ?.sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5)
    .map(item => item.title) || [];

  // If fewer than 3 NOW items, add high-impact NEXT items
  if (nowItems.length < 3 && actionPlan.next) {
    const nextItems = actionPlan.next
      .filter(item => item.impactScore >= 4)
      .slice(0, 3 - nowItems.length)
      .map(item => item.title);
    nowItems.push(...nextItems);
  }

  return nowItems;
}

// ============================================================================
// GAP PROMPT HELPER
// ============================================================================

/**
 * Format BrandForGap as a string for injection into GAP prompts.
 *
 * @param brandContext - BrandForGap object
 * @returns Formatted string for prompt injection
 */
export function formatBrandContextForGapPrompt(brandContext: BrandForGap): string {
  return `
=== BRAND LAB CONTEXT (Pre-Analyzed) ===
Do NOT re-audit the brand from scratch. Use this context:

Brand Score: ${brandContext.brandScore}/100 (${brandContext.benchmarkLabel})
${brandContext.tagline ? `Tagline: "${brandContext.tagline}"` : 'Tagline: Not established'}
${brandContext.corePromise ? `Core Promise: "${brandContext.corePromise}"` : 'Core Promise: Not clearly defined'}
Positioning Theme: ${brandContext.positioningTheme}
ICP Summary: ${brandContext.icpSummary}

Key Brand Strengths:
${brandContext.keyBrandStrengths.map(s => `• ${s}`).join('\n')}

Key Brand Weaknesses:
${brandContext.keyBrandWeaknesses.map(w => `• ${w}`).join('\n')}

Top Brand Risks:
${brandContext.topBrandRisks.map(r => `• ${r}`).join('\n')}

Recommended Brand Work (from Brand Lab):
${brandContext.recommendedBrandWorkItems.map(w => `• ${w}`).join('\n')}

All brand recommendations in this GAP report should align with Brand Lab findings above.
=== END BRAND LAB CONTEXT ===
`.trim();
}
